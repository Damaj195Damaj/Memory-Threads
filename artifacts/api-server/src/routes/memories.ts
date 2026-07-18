import { Router } from "express";
import { eq, desc, sql, and, gte, lte, arrayOverlaps } from "drizzle-orm";
import { db, memoriesTable, timelineEditsTable } from "@workspace/db";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  ListMemoriesQueryParams,
  GetMemoryParams,
  DeleteMemoryParams,
  GetRelatedMemoriesParams,
} from "@workspace/api-zod";
import { processMemory } from "../lib/processor";
import { logger } from "../lib/logger";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.random().toString(36).slice(2);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExts = [".pdf", ".docx", ".txt", ".md", ".csv", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".zip", ".7z"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.mimetype.startsWith("image/") || file.mimetype === "application/pdf" || file.mimetype === "text/plain" || file.mimetype === "text/csv") {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.mimetype}`));
    }
  },
});

function parseId(param: string | string[]): number | null {
  const raw = Array.isArray(param) ? param[0] : param;
  const id = parseInt(raw, 10);
  return isNaN(id) ? null : id;
}

function formatMemory(m: typeof memoriesTable.$inferSelect) {
  return {
    id: m.id,
    filename: m.filename,
    originalName: m.originalName,
    fileType: m.fileType,
    fileSize: m.fileSize,
    instanceId: m.instanceId ?? null,
    title: m.title,
    summary: m.summary,
    content: m.content,
    status: m.status,
    confidence: m.confidence,
    tags: m.tags ?? [],
    people: m.people ?? [],
    organizations: m.organizations ?? [],
    locations: m.locations ?? [],
    dates: m.dates ?? [],
    tasks: m.tasks ?? [],
    topics: m.topics ?? [],
    uploadedAt: m.uploadedAt.toISOString(),
    processedAt: m.processedAt?.toISOString() ?? null,
    errorMessage: m.errorMessage,
  };
}

const router = Router();

// DELETE /memories — delete all memories (optionally filtered by instance)
router.delete("/memories", async (req, res): Promise<void> => {
  const instanceId = req.query.instanceId
    ? parseInt(req.query.instanceId as string, 10)
    : null;

  const where = instanceId ? eq(memoriesTable.instanceId, instanceId) : undefined;

  const rows = await db
    .select({ filePath: memoriesTable.filePath })
    .from(memoriesTable)
    .where(where);

  for (const r of rows) {
    try { fs.unlinkSync(r.filePath); } catch {}
  }

  // Delete related timeline edits for this instance
  if (instanceId) {
    await db
      .delete(timelineEditsTable)
      .where(eq(timelineEditsTable.instanceId, instanceId));
  } else {
    await db.delete(timelineEditsTable);
  }

  await db.delete(memoriesTable).where(where);

  res.json({ success: true, deletedCount: rows.length });
});

// GET /memories
router.get("/memories", async (req, res): Promise<void> => {
  const parsed = ListMemoriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { status, fileType, people, topics, tags, dateFrom, dateTo, q, limit = 50, offset = 0 } = parsed.data;
  const instanceId = req.query.instanceId
    ? parseInt(req.query.instanceId as string, 10)
    : null;

  const conditions: ReturnType<typeof eq>[] = [];

  if (status) conditions.push(eq(memoriesTable.status, status));
  if (fileType) conditions.push(eq(memoriesTable.fileType, fileType));
  if (instanceId) conditions.push(eq(memoriesTable.instanceId, instanceId));

  const extraConditions = [
    ...(people ? [sql`${memoriesTable.people} @> ARRAY[${people}::text]`] : []),
    ...(topics ? [sql`${memoriesTable.topics} @> ARRAY[${topics}::text]`] : []),
    ...(tags ? [sql`${memoriesTable.tags} @> ARRAY[${tags}::text]`] : []),
    ...(dateFrom ? [gte(memoriesTable.uploadedAt, new Date(dateFrom))] : []),
    ...(dateTo ? [lte(memoriesTable.uploadedAt, new Date(dateTo))] : []),
    ...(q
      ? [sql`to_tsvector('english', coalesce(${memoriesTable.title},'') || ' ' || coalesce(${memoriesTable.summary},'') || ' ' || array_to_string(${memoriesTable.people}, ' ') || ' ' || array_to_string(${memoriesTable.topics}, ' ') || ' ' || array_to_string(${memoriesTable.tags}, ' ')) @@ websearch_to_tsquery('english', ${q})`]
      : []),
  ];

  const rows = await db
    .select()
    .from(memoriesTable)
    .where(and(...conditions, ...extraConditions))
    .orderBy(desc(memoriesTable.uploadedAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(memoriesTable)
    .where(and(...conditions));
  const total = Number(countResult[0]?.count ?? 0);

  res.json({ memories: rows.map(formatMemory), total });
});

interface IncomingFile {
  path: string;
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
}

const SUPPORTED_EXTS = [".pdf", ".docx", ".txt", ".md", ".csv", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

// Guards against decompression bombs
const MAX_EXTRACTED_FILES = 50;
const MAX_ENTRY_BYTES = 25 * 1024 * 1024; // 25MB per extracted file
const MAX_TOTAL_EXTRACTED_BYTES = 100 * 1024 * 1024; // 100MB total per upload

async function expandArchives(files: IncomingFile[]): Promise<IncomingFile[]> {
  const out: IncomingFile[] = [];
  let extractedCount = 0;
  let extractedBytes = 0;

  const withinLimits = (size: number): boolean => {
    if (extractedCount >= MAX_EXTRACTED_FILES) return false;
    if (size > MAX_ENTRY_BYTES) return false;
    if (extractedBytes + size > MAX_TOTAL_EXTRACTED_BYTES) return false;
    return true;
  };

  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === ".zip") {
      try {
        const { default: AdmZip } = await import("adm-zip");
        const zip = new AdmZip(file.path);
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue;
          const entryExt = path.extname(entry.entryName).toLowerCase();
          if (!SUPPORTED_EXTS.includes(entryExt)) continue;
          if (!withinLimits(entry.header.size)) {
            logger.warn({ entry: entry.entryName }, "Skipping archive entry: extraction limits exceeded");
            continue;
          }
          extractedCount++;
          extractedBytes += entry.header.size;
          const unique = Date.now() + "-" + Math.random().toString(36).slice(2) + entryExt;
          const destPath = path.join(UPLOADS_DIR, unique);
          fs.writeFileSync(destPath, entry.getData());
          out.push({
            path: destPath,
            filename: unique,
            originalname: path.basename(entry.entryName),
            mimetype: "application/octet-stream",
            size: entry.header.size,
          });
        }
        fs.unlinkSync(file.path);
      } catch (err) {
        logger.warn({ err, file: file.originalname }, "Failed to extract zip archive");
      }
    } else if (ext === ".7z") {
      try {
        const sevenZip = (await import("7zip-min")) as unknown as {
          unpack: (src: string, dest: string, cb: (err: Error | null) => void) => void;
        };
        const extractDir = path.join(UPLOADS_DIR, `7z-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        fs.mkdirSync(extractDir, { recursive: true });
        await new Promise<void>((resolve, reject) => {
          sevenZip.unpack(file.path, extractDir, (err) => (err ? reject(err) : resolve()));
        });
        const walk = (dir: string): string[] =>
          fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
            const full = path.join(dir, d.name);
            return d.isDirectory() ? walk(full) : [full];
          });
        for (const extracted of walk(extractDir)) {
          const entryExt = path.extname(extracted).toLowerCase();
          if (!SUPPORTED_EXTS.includes(entryExt)) continue;
          const entrySize = fs.statSync(extracted).size;
          if (!withinLimits(entrySize)) {
            logger.warn({ entry: extracted }, "Skipping archive entry: extraction limits exceeded");
            continue;
          }
          extractedCount++;
          extractedBytes += entrySize;
          const unique = Date.now() + "-" + Math.random().toString(36).slice(2) + entryExt;
          const destPath = path.join(UPLOADS_DIR, unique);
          fs.renameSync(extracted, destPath);
          out.push({
            path: destPath,
            filename: unique,
            originalname: path.basename(extracted),
            mimetype: "application/octet-stream",
            size: fs.statSync(destPath).size,
          });
        }
        fs.rmSync(extractDir, { recursive: true, force: true });
        fs.unlinkSync(file.path);
      } catch (err) {
        logger.warn({ err, file: file.originalname }, "Failed to extract 7z archive");
      }
    } else {
      out.push(file);
    }
  }

  return out;
}

// POST /memories/upload — accepts one or many files, including .zip/.7z archives
router.post(
  "/memories/upload",
  upload.any(),
  async (req, res): Promise<void> => {
    const uploaded = (req.files as IncomingFile[] | undefined) ?? [];
    if (uploaded.length === 0) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const expanded = await expandArchives(uploaded);
    if (expanded.length === 0) {
      res.status(400).json({ error: "No supported files found in upload (archives must contain PDF, DOCX, TXT, MD, CSV, or images)" });
      return;
    }

    const created = [];
    for (const file of expanded) {
      const ext = path.extname(file.originalname).toLowerCase().slice(1);
      const fileType = ext || file.mimetype.split("/")[1] || "unknown";

      const uploadInstanceId = req.body?.instanceId
        ? parseInt(String(req.body.instanceId), 10)
        : null;

      const [memory] = await db
        .insert(memoriesTable)
        .values({
          filename: file.filename,
          originalName: file.originalname,
          fileType,
          fileSize: file.size,
          filePath: file.path,
          status: "pending",
          instanceId: uploadInstanceId || null,
        })
        .returning();

      if (!memory) continue;

      processMemory(memory.id, file.path, file.filename, file.originalname, file.mimetype).catch(
        (err) => logger.error({ err, memoryId: memory.id }, "Background processing failed")
      );
      created.push(memory);
    }

    res.status(201).json({ memories: created.map(formatMemory) });
  }
);

// GET /memories/:id
router.get("/memories/:id", async (req, res): Promise<void> => {
  const paramsResult = GetMemoryParams.safeParse({
    id: parseId(req.params.id),
  });
  if (!paramsResult.success || paramsResult.data.id == null) {
    res.status(400).json({ error: "Invalid memory ID" });
    return;
  }
  const { id } = paramsResult.data;

  const [memory] = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.id, id));

  if (!memory) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  res.json(formatMemory(memory));
});

// DELETE /memories/:id
router.delete("/memories/:id", async (req, res): Promise<void> => {
  const paramsResult = DeleteMemoryParams.safeParse({
    id: parseId(req.params.id),
  });
  if (!paramsResult.success || paramsResult.data.id == null) {
    res.status(400).json({ error: "Invalid memory ID" });
    return;
  }
  const { id } = paramsResult.data;

  const [deleted] = await db
    .delete(memoriesTable)
    .where(eq(memoriesTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  // Clean up file from disk
  if (deleted.filePath) {
    fs.unlink(deleted.filePath, (err) => {
      if (err) logger.warn({ err, path: deleted.filePath }, "Failed to delete file");
    });
  }

  res.json({ success: true });
});

// GET /memories/:id/related
router.get("/memories/:id/related", async (req, res): Promise<void> => {
  const paramsResult = GetRelatedMemoriesParams.safeParse({
    id: parseId(req.params.id),
  });
  if (!paramsResult.success || paramsResult.data.id == null) {
    res.status(400).json({ error: "Invalid memory ID" });
    return;
  }
  const { id } = paramsResult.data;

  const [source] = await db
    .select()
    .from(memoriesTable)
    .where(eq(memoriesTable.id, id));

  if (!source) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  // Find memories that share topics, people, or tags
  const allTopics = [...source.topics, ...source.people, ...source.tags].slice(0, 10);

  if (allTopics.length === 0) {
    const recent = await db
      .select()
      .from(memoriesTable)
      .where(sql`${memoriesTable.id} != ${id} AND ${memoriesTable.status} = 'ready'`)
      .orderBy(desc(memoriesTable.uploadedAt))
      .limit(5);
    res.json(recent.map(formatMemory));
    return;
  }

  const related = await db
    .select()
    .from(memoriesTable)
    .where(
      sql`${memoriesTable.id} != ${id}
        AND ${memoriesTable.status} = 'ready'
        AND (${arrayOverlaps(memoriesTable.topics, allTopics)} OR ${arrayOverlaps(memoriesTable.people, allTopics)})`
    )
    .limit(5);

  // Fallback if the dynamic SQL approach fails
  if (related.length === 0) {
    const fallback = await db
      .select()
      .from(memoriesTable)
      .where(sql`${memoriesTable.id} != ${id} AND ${memoriesTable.status} = 'ready'`)
      .orderBy(desc(memoriesTable.uploadedAt))
      .limit(5);
    res.json(fallback.map(formatMemory));
    return;
  }

  res.json(related.map(formatMemory));
});

export default router;

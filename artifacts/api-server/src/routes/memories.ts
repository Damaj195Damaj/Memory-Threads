import { Router } from "express";
import { requireOwnedInstance } from "../lib/ownership";
import { parseInstanceId } from "../lib/instance-id";
import { eq, desc, sql, and, gte, lte, arrayOverlaps } from "drizzle-orm";
import { db, memoriesTable, timelineEditsTable, searchQueriesTable } from "@workspace/db";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  ListMemoriesQueryParams,
  GetMemoryParams,
  DeleteMemoryParams,
  GetRelatedMemoriesParams,
} from "@workspace/api-zod";
import { processMemory } from "../lib/processor";
import { logger } from "../lib/logger";
import { compressStoredFile } from "../lib/fileStorage";

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
    const allowedExts = [".pdf", ".docx", ".txt", ".md", ".csv", ".zip", ".7z"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext) || file.mimetype === "application/pdf" || file.mimetype === "text/plain" || file.mimetype === "text/csv") {
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

// DELETE /memories — delete all memories for a verified-owned instance
router.delete("/memories", async (req, res): Promise<void> => {
  const instanceId = await requireOwnedInstance(req.query.instanceId, req, res);
  if (instanceId === null) return;

  const rows = await db
    .select({ filePath: memoriesTable.filePath })
    .from(memoriesTable)
    .where(eq(memoriesTable.instanceId, instanceId));

  for (const r of rows) {
    try { fs.unlinkSync(r.filePath); } catch {}
    try { if (!r.filePath.endsWith(".gz")) fs.unlinkSync(r.filePath + ".gz"); } catch {}
  }

  await db
    .delete(timelineEditsTable)
    .where(eq(timelineEditsTable.instanceId, instanceId));

  await db.delete(memoriesTable).where(eq(memoriesTable.instanceId, instanceId));

  // Clear search history for this user
  await db
    .delete(searchQueriesTable)
    .where(eq(searchQueriesTable.userId, req.session.userId!));

  res.json({ success: true, deletedCount: rows.length });
});

// GET /memories
router.get("/memories", async (req, res): Promise<void> => {
  const parsed = ListMemoriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const instanceId = await requireOwnedInstance(req.query.instanceId, req, res);
  if (instanceId === null) return;

  const { status, fileType, people, topics, tags, dateFrom, dateTo, q, limit = 50, offset = 0 } = parsed.data;

  const conditions: ReturnType<typeof eq>[] = [
    eq(memoriesTable.instanceId, instanceId),
  ];

  if (status) conditions.push(eq(memoriesTable.status, status));
  if (fileType) conditions.push(eq(memoriesTable.fileType, fileType));

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

const SUPPORTED_EXTS = [".pdf", ".docx", ".txt", ".md", ".csv"];

const execFileAsync = promisify(execFile);

function extract7z(src: string, dest: string): Promise<void> {
  return execFileAsync("7z", ["x", src, `-o${dest}`, "-y"], {
    maxBuffer: 10 * 1024 * 1024,
  }).then(() => undefined);
}

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
        const extractDir = path.join(UPLOADS_DIR, `7z-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        fs.mkdirSync(extractDir, { recursive: true });
        await extract7z(file.path, extractDir);
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

// POST /memories/upload
router.post(
  "/memories/upload",
  (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req, res): Promise<void> => {
    // Ownership check before any file processing
    const instanceId = await requireOwnedInstance(req.body?.instanceId, req, res);
    if (instanceId === null) return;

    const uploaded = (req.files as IncomingFile[] | undefined) ?? [];
    if (uploaded.length === 0) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const expanded = await expandArchives(uploaded);
    if (expanded.length === 0) {
      res.status(400).json({ error: "No supported files found in upload (archives must contain PDF, DOCX, TXT, MD, or CSV)" });
      return;
    }

    const created = [];
    for (const file of expanded) {
      const ext = path.extname(file.originalname).toLowerCase().slice(1);
      const fileType = ext || file.mimetype.split("/")[1] || "unknown";

      // Compress text-based formats at rest; skip already-compressed containers
      const { filePath: storedPath, storedSize } = await compressStoredFile(
        file.path,
        file.originalname,
      );

      const [memory] = await db
        .insert(memoriesTable)
        .values({
          filename: file.filename,
          originalName: file.originalname,
          fileType,
          fileSize: storedSize,
          filePath: storedPath,
          status: "pending",
          instanceId,
        })
        .returning();

      if (!memory) continue;

      processMemory(memory.id, storedPath, file.filename, file.originalname, file.mimetype).catch(
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

  const instanceId = await requireOwnedInstance(req.query.instanceId, req, res);
  if (instanceId === null) return;

  const [memory] = await db
    .select()
    .from(memoriesTable)
    .where(and(eq(memoriesTable.id, id), eq(memoriesTable.instanceId, instanceId)));

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

  const instanceId = await requireOwnedInstance(req.query.instanceId, req, res);
  if (instanceId === null) return;

  const [deleted] = await db
    .delete(memoriesTable)
    .where(and(eq(memoriesTable.id, id), eq(memoriesTable.instanceId, instanceId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  if (deleted.filePath) {
    fs.unlink(deleted.filePath, () => {});
    if (!deleted.filePath.endsWith(".gz")) {
      fs.unlink(deleted.filePath + ".gz", () => {});
    }
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

  const instanceId = await requireOwnedInstance(req.query.instanceId, req, res);
  if (instanceId === null) return;

  const [source] = await db
    .select()
    .from(memoriesTable)
    .where(and(eq(memoriesTable.id, id), eq(memoriesTable.instanceId, instanceId)));

  if (!source) {
    res.status(404).json({ error: "Memory not found" });
    return;
  }

  const allTopics = [...source.topics, ...source.people, ...source.tags].slice(0, 10);

  if (allTopics.length === 0) {
    const recent = await db
      .select()
      .from(memoriesTable)
      .where(sql`${memoriesTable.id} != ${id} AND ${memoriesTable.status} = 'ready' AND ${memoriesTable.instanceId} = ${instanceId}`)
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
        AND ${memoriesTable.instanceId} = ${instanceId}
        AND (${arrayOverlaps(memoriesTable.topics, allTopics)} OR ${arrayOverlaps(memoriesTable.people, allTopics)})`
    )
    .limit(5);

  if (related.length === 0) {
    const fallback = await db
      .select()
      .from(memoriesTable)
      .where(sql`${memoriesTable.id} != ${id} AND ${memoriesTable.status} = 'ready' AND ${memoriesTable.instanceId} = ${instanceId}`)
      .orderBy(desc(memoriesTable.uploadedAt))
      .limit(5);
    res.json(fallback.map(formatMemory));
    return;
  }

  res.json(related.map(formatMemory));
});

export default router;

import { Router } from "express";
import { eq, asc, and } from "drizzle-orm";
import { db, instancesTable, memoriesTable, timelineEditsTable } from "@workspace/db";
import fs from "fs";

const router = Router();

// GET /instances — only return workspaces owned by the authenticated user
router.get("/instances", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rows = await db
    .select()
    .from(instancesTable)
    .where(eq(instancesTable.userId, userId))
    .orderBy(asc(instancesTable.createdAt));
  res.json(rows);
});

// POST /instances
router.post("/instances", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { name, color } = req.body ?? {};
  if (!name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const [row] = await db
    .insert(instancesTable)
    .values({ name: name.trim(), color: color ?? "#6366f1", userId })
    .returning();
  res.status(201).json(row);
});

// PUT /instances/:id
router.put("/instances/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Verify ownership
  const [existing] = await db
    .select({ id: instancesTable.id })
    .from(instancesTable)
    .where(and(eq(instancesTable.id, id), eq(instancesTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { name, color } = req.body ?? {};
  const updates: Partial<{ name: string; color: string }> = {};
  if (name?.trim()) updates.name = name.trim();
  if (color) updates.color = color;
  if (!Object.keys(updates).length) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db
    .update(instancesTable)
    .set(updates)
    .where(and(eq(instancesTable.id, id), eq(instancesTable.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

// DELETE /instances/:id — delete instance + all its memories + timeline edits
router.delete("/instances/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Verify ownership before deleting
  const [existing] = await db
    .select({ id: instancesTable.id })
    .from(instancesTable)
    .where(and(eq(instancesTable.id, id), eq(instancesTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Delete uploaded files for memories in this instance
  const memories = await db
    .select({ filePath: memoriesTable.filePath })
    .from(memoriesTable)
    .where(eq(memoriesTable.instanceId, id));

  for (const m of memories) {
    try {
      fs.unlinkSync(m.filePath);
    } catch {}
    // Also try the .gz variant in case gzip storage is in use
    try {
      if (!m.filePath.endsWith(".gz")) fs.unlinkSync(m.filePath + ".gz");
    } catch {}
  }

  // cascade deletes memories + timeline_edits via FK onDelete: "cascade"
  await db.delete(instancesTable).where(and(eq(instancesTable.id, id), eq(instancesTable.userId, userId)));

  res.json({ success: true });
});

export default router;

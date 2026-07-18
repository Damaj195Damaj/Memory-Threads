import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, instancesTable, memoriesTable, timelineEditsTable } from "@workspace/db";
import fs from "fs";

const router = Router();

// GET /instances
router.get("/instances", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(instancesTable)
    .orderBy(asc(instancesTable.createdAt));
  res.json(rows);
});

// POST /instances
router.post("/instances", async (req, res): Promise<void> => {
  const { name, color } = req.body ?? {};
  if (!name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const [row] = await db
    .insert(instancesTable)
    .values({ name: name.trim(), color: color ?? "#6366f1" })
    .returning();
  res.status(201).json(row);
});

// PUT /instances/:id
router.put("/instances/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
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
    .where(eq(instancesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

// DELETE /instances/:id — delete instance + all its memories + timeline edits
router.delete("/instances/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
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
  }

  // cascade deletes memories + timeline_edits via FK onDelete: "cascade"
  await db.delete(instancesTable).where(eq(instancesTable.id, id));

  res.json({ success: true });
});

export default router;

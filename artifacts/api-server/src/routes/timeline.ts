import { Router } from "express";
import { parseInstanceId } from "../lib/instance-id";
import { sql, asc, eq } from "drizzle-orm";
import { db, memoriesTable, timelineEditsTable } from "@workspace/db";
import {
  GetTimelineQueryParams,
  CreateTimelineEventBody,
  UpdateTimelineEventBody,
} from "@workspace/api-zod";

const router = Router();

type EventType = "upload" | "event" | "deadline" | "mention";

interface TimelineEventOut {
  id: string;
  date: string;
  title: string;
  description: string | null;
  type: EventType;
  memoryId: number | null;
  memoryName: string | null;
  isCustom: boolean;
  isEdited: boolean;
}

router.get("/timeline", async (req, res): Promise<void> => {
  const parsed = GetTimelineQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { dateFrom, dateTo, limit = 100 } = parsed.data;
  const instanceParsed = parseInstanceId(req.query.instanceId);
  if (!instanceParsed.ok) {
    res.status(400).json({ error: "Invalid instanceId" });
    return;
  }
  const instanceId = instanceParsed.value;

  const conditions: ReturnType<typeof sql>[] = [];
  if (dateFrom) conditions.push(sql`${memoriesTable.uploadedAt} >= ${new Date(dateFrom)}`);
  if (dateTo) conditions.push(sql`${memoriesTable.uploadedAt} <= ${new Date(dateTo)}`);
  if (instanceId) conditions.push(sql`${memoriesTable.instanceId} = ${instanceId}`);

  const whereClause = conditions.length > 0
    ? conditions.reduce((a, b) => sql`${a} AND ${b}`)
    : sql`1=1`;

  const editsWhere = instanceId
    ? sql`${timelineEditsTable.instanceId} = ${instanceId} OR ${timelineEditsTable.instanceId} IS NULL`
    : sql`1=1`;

  const [memories, edits] = await Promise.all([
    db
      .select()
      .from(memoriesTable)
      .where(whereClause)
      .orderBy(asc(memoriesTable.uploadedAt))
      .limit(limit),
    db.select().from(timelineEditsTable).where(editsWhere),
  ]);

  const overrides = new Map(
    edits.filter((e) => !e.isCustom && e.eventKey).map((e) => [e.eventKey as string, e])
  );

  const events: TimelineEventOut[] = [];

  const pushEvent = (base: Omit<TimelineEventOut, "isCustom" | "isEdited">) => {
    const override = overrides.get(base.id);
    if (override?.hidden) return;
    events.push({
      ...base,
      title: override?.title ?? base.title,
      description: override?.description ?? base.description,
      date: override?.date?.toISOString() ?? base.date,
      type: (override?.type as EventType | null) ?? base.type,
      isCustom: false,
      isEdited: !!override,
    });
  };

  for (const m of memories) {
    pushEvent({
      id: `upload-${m.id}`,
      date: m.uploadedAt.toISOString(),
      title: m.title ?? m.originalName,
      description: m.summary ?? null,
      type: "upload",
      memoryId: m.id,
      memoryName: m.originalName,
    });

    for (let i = 0; i < m.dates.length; i++) {
      const dateStr = m.dates[i];
      if (!dateStr) continue;
      const parsedDate = tryParseDate(dateStr);
      if (!parsedDate) continue;
      pushEvent({
        id: `event-${m.id}-${i}`,
        date: parsedDate,
        title: dateStr,
        description: `Mentioned in: ${m.title ?? m.originalName}`,
        type: "event",
        memoryId: m.id,
        memoryName: m.originalName,
      });
    }

    for (let i = 0; i < m.tasks.length; i++) {
      const task = m.tasks[i];
      if (!task) continue;
      pushEvent({
        id: `task-${m.id}-${i}`,
        date: m.uploadedAt.toISOString(),
        title: task,
        description: `Task from: ${m.title ?? m.originalName}`,
        type: "deadline",
        memoryId: m.id,
        memoryName: m.originalName,
      });
    }
  }

  // Custom user-created events
  for (const e of edits) {
    if (!e.isCustom || e.hidden || !e.date || !e.title) continue;
    events.push({
      id: `custom-${e.id}`,
      date: e.date.toISOString(),
      title: e.title,
      description: e.description,
      type: (e.type as EventType | null) ?? "event",
      memoryId: e.memoryId,
      memoryName: null,
      isCustom: true,
      isEdited: false,
    });
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  res.json(events.slice(0, limit));
});

// POST /timeline/events — create custom event
router.post("/timeline/events", async (req, res): Promise<void> => {
  const parsed = CreateTimelineEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { date, title, description, type, memoryId } = parsed.data;
  const instanceParsed = parseInstanceId(req.body.instanceId);
  if (!instanceParsed.ok) {
    res.status(400).json({ error: "Invalid instanceId" });
    return;
  }
  const instanceId = instanceParsed.value;

  const [row] = await db
    .insert(timelineEditsTable)
    .values({
      title,
      description: description ?? null,
      type: type ?? "event",
      date: new Date(date),
      memoryId: memoryId ?? null,
      isCustom: true,
      instanceId,
    })
    .returning();

  if (!row) {
    res.status(500).json({ error: "Failed to create event" });
    return;
  }

  res.status(201).json({
    id: `custom-${row.id}`,
    date: row.date!.toISOString(),
    title: row.title!,
    description: row.description,
    type: row.type ?? "event",
    memoryId: row.memoryId,
    memoryName: null,
    isCustom: true,
    isEdited: false,
  });
});

// PUT /timeline/events/:id — edit custom event or override auto event
router.put("/timeline/events/:id", async (req, res): Promise<void> => {
  const eventId = String(req.params.id);
  const parsed = UpdateTimelineEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { date, title, description, type } = parsed.data;
  const instanceParsed = parseInstanceId(req.body.instanceId ?? req.query.instanceId);
  if (!instanceParsed.ok) {
    res.status(400).json({ error: "Invalid instanceId" });
    return;
  }
  const instanceId = instanceParsed.value;

  if (eventId.startsWith("custom-")) {
    const rowId = parseInt(eventId.slice("custom-".length), 10);
    if (isNaN(rowId)) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    const [row] = await db
      .update(timelineEditsTable)
      .set({
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(date !== undefined ? { date: new Date(date) } : {}),
      })
      .where(
        instanceId
          ? sql`${timelineEditsTable.id} = ${rowId} AND (${timelineEditsTable.instanceId} = ${instanceId} OR ${timelineEditsTable.instanceId} IS NULL)`
          : eq(timelineEditsTable.id, rowId)
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json({
      id: eventId,
      date: row.date!.toISOString(),
      title: row.title!,
      description: row.description,
      type: row.type ?? "event",
      memoryId: row.memoryId,
      memoryName: null,
      isCustom: true,
      isEdited: false,
    });
    return;
  }

  // Auto-generated event: upsert an override row keyed by eventKey
  const [existing] = await db
    .select()
    .from(timelineEditsTable)
    .where(eq(timelineEditsTable.eventKey, eventId));

  const values = {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(date !== undefined ? { date: new Date(date) } : {}),
  };

  const [row] = existing
    ? await db
        .update(timelineEditsTable)
        .set(values)
        .where(eq(timelineEditsTable.id, existing.id))
        .returning()
    : await db
        .insert(timelineEditsTable)
        .values({ eventKey: eventId, isCustom: false, instanceId, ...values })
        .returning();

  res.json({
    id: eventId,
    date: row?.date?.toISOString() ?? new Date().toISOString(),
    title: row?.title ?? "",
    description: row?.description ?? null,
    type: row?.type ?? "event",
    memoryId: row?.memoryId ?? null,
    memoryName: null,
    isCustom: false,
    isEdited: true,
  });
});

// DELETE /timeline/events/:id — delete custom or hide auto event
router.delete("/timeline/events/:id", async (req, res): Promise<void> => {
  const eventId = String(req.params.id);
  const instanceParsed = parseInstanceId(req.query.instanceId);
  if (!instanceParsed.ok) {
    res.status(400).json({ error: "Invalid instanceId" });
    return;
  }
  const instanceId = instanceParsed.value;

  if (eventId.startsWith("custom-")) {
    const rowId = parseInt(eventId.slice("custom-".length), 10);
    if (isNaN(rowId)) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    await db
      .delete(timelineEditsTable)
      .where(
        instanceId
          ? sql`${timelineEditsTable.id} = ${rowId} AND (${timelineEditsTable.instanceId} = ${instanceId} OR ${timelineEditsTable.instanceId} IS NULL)`
          : eq(timelineEditsTable.id, rowId)
      );
    res.json({ success: true });
    return;
  }

  const [existing] = await db
    .select()
    .from(timelineEditsTable)
    .where(eq(timelineEditsTable.eventKey, eventId));

  if (existing) {
    await db
      .update(timelineEditsTable)
      .set({ hidden: true })
      .where(eq(timelineEditsTable.id, existing.id));
  } else {
    await db
      .insert(timelineEditsTable)
      .values({ eventKey: eventId, hidden: true, isCustom: false, instanceId });
  }

  res.json({ success: true });
});

function tryParseDate(str: string): string | null {
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();

  const yearMatch = str.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const year = yearMatch[0];
    const d2 = new Date(`January 1, ${year}`);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }

  return null;
}

export default router;

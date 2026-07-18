import { Router } from "express";
import { parseInstanceId } from "../lib/instance-id";
import { sql, desc, eq } from "drizzle-orm";
import { db, memoriesTable, searchQueriesTable } from "@workspace/db";

const router = Router();

router.get("/dashboard", async (req, res): Promise<void> => {
  const instanceParsed = parseInstanceId(req.query.instanceId);
  if (!instanceParsed.ok) {
    res.status(400).json({ error: "Invalid instanceId" });
    return;
  }
  const instanceId = instanceParsed.value;
  const iFilter = instanceId ? sql`AND ${memoriesTable.instanceId} = ${instanceId}` : sql``;
  const iWhere = instanceId ? eq(memoriesTable.instanceId, instanceId) : undefined;

  // Total memories and status counts
  const statusCounts = await db
    .select({
      status: memoriesTable.status,
      count: sql<number>`count(*)`,
    })
    .from(memoriesTable)
    .where(iWhere)
    .groupBy(memoriesTable.status);

  const total = statusCounts.reduce((sum, r) => sum + Number(r.count), 0);
  const processing = Number(
    statusCounts.find((r) => r.status === "processing")?.count ?? 0
  );
  const ready = Number(statusCounts.find((r) => r.status === "ready")?.count ?? 0);

  // Recent uploads
  const recentUploads = await db
    .select()
    .from(memoriesTable)
    .where(iWhere)
    .orderBy(desc(memoriesTable.uploadedAt))
    .limit(6);

  // Top topics (aggregate from all memories)
  const topicsResult = await db
    .select({
      topic: sql<string>`unnest(${memoriesTable.topics})`,
    })
    .from(memoriesTable)
    .where(sql`${memoriesTable.status} = 'ready' ${iFilter}`);

  const topicMap = new Map<string, number>();
  for (const r of topicsResult) {
    if (r.topic) {
      topicMap.set(r.topic, (topicMap.get(r.topic) ?? 0) + 1);
    }
  }
  const topTopics = Array.from(topicMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, count }));

  // Most mentioned people
  const peopleResult = await db
    .select({
      person: sql<string>`unnest(${memoriesTable.people})`,
    })
    .from(memoriesTable)
    .where(sql`${memoriesTable.status} = 'ready' ${iFilter}`);

  const personMap = new Map<string, number>();
  for (const r of peopleResult) {
    if (r.person) {
      personMap.set(r.person, (personMap.get(r.person) ?? 0) + 1);
    }
  }
  const mostMentionedPeople = Array.from(personMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([person, count]) => ({ person, count }));

  // Upcoming deadlines (tasks from recent memories)
  const taskMemories = await db
    .select()
    .from(memoriesTable)
    .where(sql`${memoriesTable.status} = 'ready' AND array_length(${memoriesTable.tasks}, 1) > 0 ${iFilter}`)
    .orderBy(desc(memoriesTable.uploadedAt))
    .limit(10);

  const upcomingDeadlines = taskMemories
    .flatMap((m) =>
      m.tasks.slice(0, 2).map((task: string, i: number) => ({
        id: `task-${m.id}-${i}`,
        date: m.uploadedAt.toISOString(),
        title: task,
        description: `From: ${m.title ?? m.originalName}`,
        type: "deadline" as const,
        memoryId: m.id,
        memoryName: m.originalName,
      }))
    )
    .slice(0, 5);

  // Recent searches
  const searches = await db
    .select({ query: searchQueriesTable.query })
    .from(searchQueriesTable)
    .orderBy(desc(searchQueriesTable.createdAt))
    .limit(10);
  const recentSearches = [...new Set(searches.map((s) => s.query))].slice(0, 5);

  const formatMemory = (m: typeof memoriesTable.$inferSelect) => ({
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
  });

  res.json({
    totalMemories: total,
    processingCount: processing,
    readyCount: ready,
    recentUploads: recentUploads.map(formatMemory),
    topTopics,
    mostMentionedPeople,
    upcomingDeadlines,
    recentSearches,
  });
});

router.get("/filters", async (req, res): Promise<void> => {
  const instanceParsed = parseInstanceId(req.query.instanceId);
  if (!instanceParsed.ok) {
    res.status(400).json({ error: "Invalid instanceId" });
    return;
  }
  const instanceId = instanceParsed.value;
  const iFilter = instanceId ? sql`AND ${memoriesTable.instanceId} = ${instanceId}` : sql``;
  const iWhere = instanceId ? eq(memoriesTable.instanceId, instanceId) : undefined;

  const [peopleResult, topicsResult, tagsResult, fileTypesResult] =
    await Promise.all([
      db
        .select({ person: sql<string>`unnest(${memoriesTable.people})` })
        .from(memoriesTable)
        .where(sql`${memoriesTable.status} = 'ready' ${iFilter}`),
      db
        .select({ topic: sql<string>`unnest(${memoriesTable.topics})` })
        .from(memoriesTable)
        .where(sql`${memoriesTable.status} = 'ready' ${iFilter}`),
      db
        .select({ tag: sql<string>`unnest(${memoriesTable.tags})` })
        .from(memoriesTable)
        .where(sql`${memoriesTable.status} = 'ready' ${iFilter}`),
      db
        .select({ fileType: memoriesTable.fileType })
        .from(memoriesTable)
        .where(iWhere)
        .groupBy(memoriesTable.fileType),
    ]);

  const unique = <T>(arr: T[]): T[] => [...new Set(arr)];

  res.json({
    people: unique(peopleResult.map((r) => r.person).filter(Boolean)).slice(0, 50),
    topics: unique(topicsResult.map((r) => r.topic).filter(Boolean)).slice(0, 50),
    tags: unique(tagsResult.map((r) => r.tag).filter(Boolean)).slice(0, 50),
    fileTypes: unique(fileTypesResult.map((r) => r.fileType).filter(Boolean)),
  });
});

export default router;

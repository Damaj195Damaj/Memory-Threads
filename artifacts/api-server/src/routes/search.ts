import { Router } from "express";
import { sql, desc, inArray, arrayOverlaps } from "drizzle-orm";
import { db, memoriesTable, searchQueriesTable } from "@workspace/db";
import { SearchMemoriesBody } from "@workspace/api-zod";
import { rankSearchResults } from "../lib/ai";
import { logger } from "../lib/logger";

const router = Router();

router.post("/search", async (req, res): Promise<void> => {
  const parsed = SearchMemoriesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { query, filters, limit = 10 } = parsed.data;
  const instanceId = req.body.instanceId ? parseInt(String(req.body.instanceId), 10) : null;

  // Save search query
  db.insert(searchQueriesTable).values({ query }).catch((err) =>
    logger.warn({ err }, "Failed to save search query")
  );

  // Build filter conditions
  const conditions: ReturnType<typeof sql>[] = [
    sql`${memoriesTable.status} = 'ready'`,
    ...(instanceId ? [sql`${memoriesTable.instanceId} = ${instanceId}`] : []),
  ];

  if (filters?.fileTypes?.length) {
    conditions.push(sql`${inArray(memoriesTable.fileType, filters.fileTypes)}`);
  }
  if (filters?.people?.length) {
    conditions.push(sql`${arrayOverlaps(memoriesTable.people, filters.people)}`);
  }
  if (filters?.topics?.length) {
    conditions.push(sql`${arrayOverlaps(memoriesTable.topics, filters.topics)}`);
  }
  if (filters?.dateFrom) {
    conditions.push(
      sql`${memoriesTable.uploadedAt} >= ${new Date(filters.dateFrom)}`
    );
  }
  if (filters?.dateTo) {
    conditions.push(
      sql`${memoriesTable.uploadedAt} <= ${new Date(filters.dateTo)}`
    );
  }

  // OR-based query so any meaningful word can match (semantic recall over precision;
  // the AI re-ranker filters out irrelevant candidates afterwards)
  const orQuery = query
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .join(" or ") || query;

  // Full-text search candidates
  const ftsCondition = sql`
    to_tsvector('english',
      coalesce(${memoriesTable.title}, '') || ' ' ||
      coalesce(${memoriesTable.summary}, '') || ' ' ||
      coalesce(${memoriesTable.content}, '') || ' ' ||
      array_to_string(${memoriesTable.people}, ' ') || ' ' ||
      array_to_string(${memoriesTable.topics}, ' ') || ' ' ||
      array_to_string(${memoriesTable.tags}, ' ') || ' ' ||
      array_to_string(${memoriesTable.organizations}, ' ')
    ) @@ websearch_to_tsquery('english', ${orQuery})
  `;

  // Also do a loose ILIKE search as fallback
  const ilikeCondition = sql`
    (${memoriesTable.title} ILIKE ${"%" + query + "%"}
    OR ${memoriesTable.summary} ILIKE ${"%" + query + "%"}
    OR array_to_string(${memoriesTable.people}, ' ') ILIKE ${"%" + query + "%"}
    OR array_to_string(${memoriesTable.topics}, ' ') ILIKE ${"%" + query + "%"})
  `;

  // Try FTS first
  let candidates = await db
    .select({
      id: memoriesTable.id,
      title: memoriesTable.title,
      summary: memoriesTable.summary,
      originalName: memoriesTable.originalName,
      content: memoriesTable.content,
      people: memoriesTable.people,
      topics: memoriesTable.topics,
    })
    .from(memoriesTable)
    .where(sql`${ftsCondition} AND ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`)
    .orderBy(
      desc(
        sql`ts_rank(
          to_tsvector('english',
            coalesce(${memoriesTable.title}, '') || ' ' ||
            coalesce(${memoriesTable.summary}, '') || ' ' ||
            array_to_string(${memoriesTable.topics}, ' ')
          ),
          websearch_to_tsquery('english', ${orQuery})
        )`
      )
    )
    .limit(15);

  // Fallback to ILIKE if FTS returns nothing
  if (candidates.length === 0) {
    candidates = await db
      .select({
        id: memoriesTable.id,
        title: memoriesTable.title,
        summary: memoriesTable.summary,
        originalName: memoriesTable.originalName,
        content: memoriesTable.content,
        people: memoriesTable.people,
        topics: memoriesTable.topics,
      })
      .from(memoriesTable)
      .where(sql`${ilikeCondition} AND ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`)
      .limit(15);
  }

  // Last resort: let the AI ranker judge relevance across recent ready memories
  if (candidates.length === 0) {
    candidates = await db
      .select({
        id: memoriesTable.id,
        title: memoriesTable.title,
        summary: memoriesTable.summary,
        originalName: memoriesTable.originalName,
        content: memoriesTable.content,
        people: memoriesTable.people,
        topics: memoriesTable.topics,
      })
      .from(memoriesTable)
      .where(conditions.reduce((a, b) => sql`${a} AND ${b}`))
      .orderBy(desc(memoriesTable.uploadedAt))
      .limit(20);
  }

  if (candidates.length === 0) {
    res.json({ results: [], query, totalFound: 0 });
    return;
  }

  // AI ranking
  const ranked = await rankSearchResults(query, candidates);

  // Fetch full memory records for ranked results
  const memoryIds = ranked.map((r) => r.memoryId);
  const memories = await db
    .select()
    .from(memoriesTable)
    .where(inArray(memoriesTable.id, memoryIds));

  const memoryMap = new Map(memories.map((m) => [m.id, m]));

  const results = ranked
    .slice(0, limit)
    .map((r) => {
      const memory = memoryMap.get(r.memoryId);
      if (!memory) return null;
      return {
        memory: {
          id: memory.id,
          filename: memory.filename,
          originalName: memory.originalName,
          fileType: memory.fileType,
          fileSize: memory.fileSize,
          title: memory.title,
          summary: memory.summary,
          content: memory.content,
          status: memory.status,
          confidence: memory.confidence,
          tags: memory.tags ?? [],
          people: memory.people ?? [],
          organizations: memory.organizations ?? [],
          locations: memory.locations ?? [],
          dates: memory.dates ?? [],
          tasks: memory.tasks ?? [],
          topics: memory.topics ?? [],
          uploadedAt: memory.uploadedAt.toISOString(),
          processedAt: memory.processedAt?.toISOString() ?? null,
          errorMessage: memory.errorMessage,
        },
        relevanceScore: r.relevanceScore,
        matchReason: r.matchReason,
        matchedSnippet: r.matchedSnippet,
      };
    })
    .filter(Boolean);

  res.json({ results, query, totalFound: candidates.length });
});

export default router;

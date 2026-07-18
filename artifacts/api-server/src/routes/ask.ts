import { Router } from "express";
import { parseInstanceId } from "../lib/instance-id";
import { sql, desc } from "drizzle-orm";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { db, memoriesTable, searchQueriesTable } from "@workspace/db";
import { AskMemoryBody } from "@workspace/api-zod";
import { answerQuestion } from "../lib/ai";
import { logger } from "../lib/logger";

const router = Router();

router.post("/ask", async (req, res): Promise<void> => {
  const parsed = AskMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { question } = parsed.data;
  const instanceParsed = parseInstanceId(req.body.instanceId);
  if (!instanceParsed.ok) {
    res.status(400).json({ error: "Invalid instanceId" });
    return;
  }
  const instanceId = instanceParsed.value;
  const instanceFilter = instanceId ? sql`AND ${memoriesTable.instanceId} = ${instanceId}` : sql``;

  // OR-based term matching for recall; the LLM decides what's actually relevant
  const orQuery =
    question
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .join(" or ") || question;

  // Save question as search query
  db.insert(searchQueriesTable).values({ query: question }).catch((err) =>
    logger.warn({ err }, "Failed to save ask query")
  );

  // Find relevant memories using full-text search
  let memories = await db
    .select()
    .from(memoriesTable)
    .where(
      sql`
        ${memoriesTable.status} = 'ready'
        ${instanceFilter}
        AND to_tsvector('english',
          coalesce(${memoriesTable.title}, '') || ' ' ||
          coalesce(${memoriesTable.summary}, '') || ' ' ||
          coalesce(${memoriesTable.content}, '') || ' ' ||
          array_to_string(${memoriesTable.people}, ' ') || ' ' ||
          array_to_string(${memoriesTable.topics}, ' ') || ' ' ||
          array_to_string(${memoriesTable.tags}, ' ')
        ) @@ websearch_to_tsquery('english', ${orQuery})
      `
    )
    .orderBy(
      desc(
        sql`ts_rank(
          to_tsvector('english',
            coalesce(${memoriesTable.title}, '') || ' ' ||
            coalesce(${memoriesTable.summary}, '') || ' ' ||
            coalesce(${memoriesTable.content}, '')
          ),
          websearch_to_tsquery('english', ${orQuery})
        )`
      )
    )
    .limit(8);

  // If FTS returns nothing, take the most recent ready memories
  if (memories.length === 0) {
    memories = await db
      .select()
      .from(memoriesTable)
      .where(sql`${memoriesTable.status} = 'ready' ${instanceFilter}`)
      .orderBy(desc(memoriesTable.uploadedAt))
      .limit(5);
  }

  const result = await answerQuestion(
    question,
    memories.map((m) => ({
      id: m.id,
      title: m.title,
      originalName: m.originalName,
      summary: m.summary,
      content: m.content,
      people: m.people,
      topics: m.topics,
      dates: m.dates,
    }))
  );

  // Build sources from cited IDs
  const memoryMap = new Map(memories.map((m) => [m.id, m]));
  const sources = result.citedMemoryIds
    .map((id) => {
      const m = memoryMap.get(id);
      if (!m) return null;
      return {
        memoryId: m.id,
        originalName: m.originalName,
        title: m.title,
        relevance: 1.0,
        excerpt: m.summary ?? m.content?.slice(0, 200) ?? null,
      };
    })
    .filter(Boolean);

  res.json({
    answer: result.answer,
    sources,
    confidence: result.confidence,
    reasoning: result.reasoning,
  });
});

export default router;

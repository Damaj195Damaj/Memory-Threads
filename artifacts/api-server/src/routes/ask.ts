import { Router } from "express";
import { requireOwnedInstance } from "../lib/ownership";
import { sql, desc } from "drizzle-orm";
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

  const instanceId = await requireOwnedInstance(req.body?.instanceId, req, res);
  if (instanceId === null) return;

  const { question } = parsed.data;

  const orQuery =
    question.split(/\s+/).filter((w) => w.length > 2).join(" or ") || question;

  db.insert(searchQueriesTable)
    .values({ query: question, userId: req.session.userId! })
    .catch((err) => logger.warn({ err }, "Failed to save ask query"));

  let memories = await db
    .select()
    .from(memoriesTable)
    .where(
      sql`
        ${memoriesTable.status} = 'ready'
        AND ${memoriesTable.instanceId} = ${instanceId}
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

  if (memories.length === 0) {
    memories = await db
      .select()
      .from(memoriesTable)
      .where(
        sql`${memoriesTable.status} = 'ready' AND ${memoriesTable.instanceId} = ${instanceId}`
      )
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

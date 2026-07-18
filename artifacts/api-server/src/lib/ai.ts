import OpenAI from "openai";
import { logger } from "./logger";

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY environment variable is required");
}

export const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const MODEL = "deepseek-chat";

export interface MemoryAnalysis {
  title: string;
  summary: string;
  people: string[];
  organizations: string[];
  locations: string[];
  dates: string[];
  tasks: string[];
  topics: string[];
  tags: string[];
  confidence: number;
}

export async function analyzeContent(
  content: string,
  filename: string,
  fileType: string
): Promise<MemoryAnalysis> {
  const truncated = content.slice(0, 10000);
  const prompt = `You are an intelligent document analyzer. Analyze the following document and extract structured metadata.

Filename: ${filename}
File type: ${fileType}
Content:
---
${truncated}
---

Return a JSON object (no markdown, no code fences) with exactly these fields:
{
  "title": "A concise, descriptive title for this document (max 80 chars)",
  "summary": "A 2-3 sentence summary of what this document is about",
  "people": ["array of person names mentioned"],
  "organizations": ["array of organizations, companies, institutions mentioned"],
  "locations": ["array of places, cities, countries mentioned"],
  "dates": ["array of dates EXPLICITLY written in the document, formatted as ISO dates (YYYY-MM-DD) when the full date is stated, otherwise the exact text as written"],
  "tasks": ["array of action items, todos, or tasks EXPLICITLY stated in the document"],
  "topics": ["array of 3-8 main topics/themes (single words or short phrases)"],
  "tags": ["array of 3-10 descriptive tags useful for filtering"],
  "confidence": 0.85
}

STRICT RULES:
- Extract ONLY information explicitly present in the document. NEVER infer, guess, or invent people, events, dates, or tasks that are not literally written in the text.
- If unsure whether something is a real entity or event, leave it out. Empty arrays are perfectly acceptable.
- Do not treat hypothetical, conditional, or example content as real events.
Confidence should reflect how well you were able to extract meaningful information (0.0 to 1.0).
Return ONLY the JSON object, no other text.`;

  const response = await deepseek.chat.completions.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as MemoryAnalysis;
  } catch (err) {
    logger.warn({ err, raw }, "Failed to parse AI analysis response");
    return {
      title: filename,
      summary: "Unable to analyze this document.",
      people: [],
      organizations: [],
      locations: [],
      dates: [],
      tasks: [],
      topics: [],
      tags: [fileType],
      confidence: 0.1,
    };
  }
}

export interface RankedSearchResult {
  memoryId: number;
  relevanceScore: number;
  matchReason: string;
  matchedSnippet: string | null;
}

export async function rankSearchResults(
  query: string,
  candidates: Array<{
    id: number;
    title: string | null;
    summary: string | null;
    topics: string[];
    people: string[];
    originalName: string;
    content: string | null;
  }>
): Promise<RankedSearchResult[]> {
  if (candidates.length === 0) return [];

  const candidateSummaries = candidates
    .map(
      (c, i) =>
        `[${i}] ID:${c.id} | "${c.title ?? c.originalName}" | Topics: ${c.topics.join(", ")} | People: ${c.people.join(", ")} | Summary: ${(c.summary ?? "").slice(0, 200)}`
    )
    .join("\n");

  const prompt = `You are a semantic search ranker. The user searched for: "${query}"

Here are the candidate documents:
${candidateSummaries}

Return a JSON array (no markdown) ranked by relevance to the query. For each result include:
{
  "memoryId": <the ID number>,
  "relevanceScore": <0.0 to 1.0>,
  "matchReason": "<1-2 sentence explanation of why this document matches the query>",
  "matchedSnippet": "<relevant text snippet if applicable, or null>"
}

Only include documents that are actually relevant (score > 0.2). Return ONLY the JSON array.`;

  try {
    const response = await deepseek.chat.completions.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as RankedSearchResult[];
  } catch (err) {
    logger.warn({ err }, "Failed to rank search results with AI");
    return candidates.map((c, i) => ({
      memoryId: c.id,
      relevanceScore: 1 - i * 0.1,
      matchReason: "Matched based on text similarity.",
      matchedSnippet: null,
    }));
  }
}

export interface AskResult {
  answer: string;
  confidence: number;
  reasoning: string;
  citedMemoryIds: number[];
}

export async function answerQuestion(
  question: string,
  memories: Array<{
    id: number;
    title: string | null;
    originalName: string;
    summary: string | null;
    content: string | null;
    people: string[];
    topics: string[];
    dates: string[];
  }>
): Promise<AskResult> {
  if (memories.length === 0) {
    return {
      answer:
        "I couldn't find any relevant documents to answer your question. Try uploading more files or rephrasing.",
      confidence: 0,
      reasoning: "No relevant memories found.",
      citedMemoryIds: [],
    };
  }

  // Number documents sequentially (1..N) in the prompt so the model's reasoning
  // and citations refer to Document 1, Document 2, etc. instead of DB memory IDs.
  const numberedMemories = memories.map((m, idx) => ({ number: idx + 1, memory: m }));
  const numberToId = new Map(numberedMemories.map(({ number, memory }) => [number, memory.id]));

  const contextBlocks = numberedMemories
    .map(
      ({ number, memory: m }) =>
        `[Document ${number}: "${m.title ?? m.originalName}"]
Summary: ${m.summary ?? "N/A"}
People: ${m.people.join(", ") || "None"}
Topics: ${m.topics.join(", ") || "None"}
Dates: ${m.dates.join(", ") || "None"}
Content excerpt: ${(m.content ?? "").slice(0, 1500)}`
    )
    .join("\n\n---\n\n");

  const prompt = `You are a knowledgeable assistant with access to the user's personal document library. Answer the user's question based ONLY on the provided documents.

User question: "${question}"

Available documents:
${contextBlocks}

Return a JSON object (no markdown) with:
{
  "answer": "<A comprehensive, helpful answer to the question based on the documents>",
  "confidence": <0.0 to 1.0 confidence in the answer>,
  "reasoning": "<Brief explanation of how you arrived at this answer and which documents were most helpful. Refer to documents by their number, e.g. 'Document 1'>",
  "citedDocumentNumbers": [<array of 1-based document numbers that were used to answer>]
}

If the documents don't contain enough information to answer, say so clearly in the answer.
Return ONLY the JSON object.`;

  try {
    const response = await deepseek.chat.completions.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as AskResult & { citedDocumentNumbers?: number[] };

    // Convert 1-based document numbers back to actual memory IDs
    if (parsed.citedDocumentNumbers && Array.isArray(parsed.citedDocumentNumbers)) {
      parsed.citedMemoryIds = parsed.citedDocumentNumbers
        .map((n) => numberToId.get(n))
        .filter((id): id is number => id !== undefined);
    }

    return parsed;
  } catch (err) {
    logger.warn({ err }, "Failed to generate AI answer");
    return {
      answer: "I encountered an error while processing your question. Please try again.",
      confidence: 0,
      reasoning: "Error during processing.",
      citedMemoryIds: [],
    };
  }
}

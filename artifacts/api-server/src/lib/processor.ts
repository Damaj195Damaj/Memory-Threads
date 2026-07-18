import { eq } from "drizzle-orm";
import { db, memoriesTable } from "@workspace/db";
import { analyzeContent } from "./ai";
import { extractText, detectFileType } from "./fileProcessor";
import { logger } from "./logger";

/**
 * Processes a newly uploaded memory in the background.
 * Updates the DB record with extracted text and AI analysis.
 */
export async function processMemory(
  memoryId: number,
  filePath: string,
  filename: string,
  originalName: string,
  mimetype: string
): Promise<void> {
  try {
    // Mark as processing
    await db
      .update(memoriesTable)
      .set({ status: "processing" })
      .where(eq(memoriesTable.id, memoryId));

    const fileType = detectFileType(originalName, mimetype);

    // Extract text content
    const content = await extractText(filePath, fileType);

    // Analyze with DeepSeek AI
    const analysis = await analyzeContent(
      content || `[${fileType} file: ${originalName}]`,
      originalName,
      fileType
    );

    // Update memory with results
    await db
      .update(memoriesTable)
      .set({
        content,
        title: analysis.title,
        summary: analysis.summary,
        people: analysis.people,
        organizations: analysis.organizations,
        locations: analysis.locations,
        dates: analysis.dates,
        tasks: analysis.tasks,
        topics: analysis.topics,
        tags: analysis.tags,
        confidence: analysis.confidence,
        status: "ready",
        processedAt: new Date(),
      })
      .where(eq(memoriesTable.id, memoryId));

    logger.info({ memoryId, fileType }, "Memory processed successfully");
  } catch (err) {
    logger.error({ err, memoryId }, "Failed to process memory");
    await db
      .update(memoriesTable)
      .set({
        status: "error",
        errorMessage:
          err instanceof Error ? err.message : "Unknown processing error",
      })
      .where(eq(memoriesTable.id, memoryId));
  }
}

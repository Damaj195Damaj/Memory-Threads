import fs from "fs/promises";
import path from "path";
import { createRequire } from "module";
import { logger } from "./logger";

export type SupportedFileType =
  | "pdf"
  | "docx"
  | "txt"
  | "md"
  | "csv"
  | "unknown";

export function detectFileType(filename: string, mimetype: string): SupportedFileType {
  const ext = path.extname(filename).toLowerCase().slice(1);
  if (ext === "pdf" || mimetype === "application/pdf") return "pdf";
  if (
    ext === "docx" ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return "docx";
  if (ext === "txt" || mimetype === "text/plain") return "txt";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "csv" || mimetype === "text/csv") return "csv";
  return "unknown";
}

export async function extractText(
  filePath: string,
  fileType: SupportedFileType
): Promise<string> {
  try {
    switch (fileType) {
      case "pdf":
        return await extractPdf(filePath);
      case "docx":
        return await extractDocx(filePath);
      case "txt":
      case "md":
        return await extractPlainText(filePath);
      case "csv":
        return await extractCsv(filePath);
      default:
        return await extractPlainText(filePath).catch(() => "[Binary file - content not extractable]");
    }
  } catch (err) {
    logger.warn({ err, filePath, fileType }, "Failed to extract text");
    return "";
  }
}

async function extractPdf(filePath: string): Promise<string> {
  // pdf-parse v2 exports PDFParse as a named class; load it at runtime to avoid bundling issues.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const require = createRequire(import.meta.url);
  const { PDFParse } = require("pdf-parse") as any;
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: buffer });
  const data = await parser.getText();
  return (data.text as string).trim();
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

async function extractPlainText(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, "utf-8");
  return content.trim();
}

async function extractCsv(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, "utf-8");
  // Return first 5000 chars of CSV content for analysis
  return content.slice(0, 5000);
}

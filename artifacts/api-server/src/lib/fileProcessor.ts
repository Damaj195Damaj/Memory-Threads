import fs from "fs/promises";
import path from "path";
import { logger } from "./logger";

export type SupportedFileType =
  | "pdf"
  | "docx"
  | "txt"
  | "md"
  | "csv"
  | "image"
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
  if (
    mimetype.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)
  )
    return "image";
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
      case "image":
        return "[Image file - visual content not extracted]";
      default:
        return await extractPlainText(filePath).catch(() => "[Binary file - content not extractable]");
    }
  } catch (err) {
    logger.warn({ err, filePath, fileType }, "Failed to extract text");
    return "";
  }
}

async function extractPdf(filePath: string): Promise<string> {
  // pdf-parse uses CommonJS default export
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParseModule = await import("pdf-parse") as any;
  const pdfParse = pdfParseModule.default ?? pdfParseModule;
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
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

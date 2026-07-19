import fs from "fs/promises";
import { gzip, gunzip } from "zlib";
import { promisify } from "util";
import path from "path";
import { logger } from "./logger";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Formats whose containers are already DEFLATE/zip-based — gzipping them again
// yields ~0-5% savings while burning CPU, so they are stored as-is.
const ALREADY_COMPRESSED_EXTS = new Set([".pdf", ".docx", ".zip", ".7z"]);

const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

/**
 * Compress an uploaded file at rest. Text-based formats (txt, md, csv) are
 * gzipped to `<file>.gz` and the original is removed; already-compressed
 * container formats are left untouched.
 *
 * Returns the (possibly new) file path and on-disk size.
 */
export async function compressStoredFile(
  filePath: string,
  originalName: string,
): Promise<{ filePath: string; storedSize: number }> {
  const ext = path.extname(originalName).toLowerCase();
  if (ALREADY_COMPRESSED_EXTS.has(ext)) {
    const stat = await fs.stat(filePath);
    return { filePath, storedSize: stat.size };
  }

  try {
    const raw = await fs.readFile(filePath);
    const compressed = await gzipAsync(raw, { level: 6 });
    const gzPath = `${filePath}.gz`;
    await fs.writeFile(gzPath, compressed);
    await fs.unlink(filePath);
    return { filePath: gzPath, storedSize: compressed.length };
  } catch (err) {
    logger.warn({ err, filePath }, "Failed to gzip stored file; keeping original");
    const stat = await fs.stat(filePath);
    return { filePath, storedSize: stat.size };
  }
}

/**
 * Read a stored upload back as a Buffer, transparently decompressing files
 * that were gzipped at rest. Extraction code (pdf-parse, mammoth, papaparse)
 * always receives the original bytes.
 */
export async function readStoredFile(filePath: string): Promise<Buffer> {
  const raw = await fs.readFile(filePath);
  const looksGzipped =
    filePath.endsWith(".gz") ||
    (raw.length >= 2 && raw[0] === GZIP_MAGIC[0] && raw[1] === GZIP_MAGIC[1]);
  if (!looksGzipped) return raw;
  try {
    return await gunzipAsync(raw);
  } catch {
    // Not actually gzip despite appearances — return raw bytes
    return raw;
  }
}

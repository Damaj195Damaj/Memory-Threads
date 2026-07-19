import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, instancesTable } from "@workspace/db";
import { parseInstanceId } from "./instance-id";

/**
 * Resolve and authorize a client-supplied instanceId.
 *
 * The client value (query param, body field, localStorage-derived) is treated
 * as untrusted input: it must be a valid positive integer AND the instance
 * must be owned by the authenticated user. Legacy instances with a NULL owner
 * never match.
 *
 * Sends the error response itself and returns null on failure; returns the
 * verified instanceId on success.
 */
export async function requireOwnedInstance(
  raw: unknown,
  req: Request,
  res: Response,
): Promise<number | null> {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  const parsed = parseInstanceId(raw);
  if (!parsed.ok) {
    res.status(400).json({ error: "Invalid instanceId" });
    return null;
  }
  if (parsed.value === null) {
    res.status(400).json({ error: "instanceId is required" });
    return null;
  }

  const [instance] = await db
    .select({ id: instancesTable.id })
    .from(instancesTable)
    .where(
      and(eq(instancesTable.id, parsed.value), eq(instancesTable.userId, userId)),
    );

  if (!instance) {
    // 404 (not 403) so we don't leak which instance IDs exist
    res.status(404).json({ error: "Workspace not found" });
    return null;
  }

  return instance.id;
}

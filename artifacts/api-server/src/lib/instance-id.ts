/**
 * Strictly parse an optional instanceId value from a query param or body field.
 *
 * Returns:
 *  - { ok: true, value: null }  when the value is absent (no scoping requested)
 *  - { ok: true, value: n }     when the value is a valid positive integer
 *  - { ok: false }              when the value is present but invalid — callers
 *                               must respond 400 instead of silently falling
 *                               back to an unscoped (global) query.
 */
export function parseInstanceId(
  raw: unknown
): { ok: true; value: number | null } | { ok: false } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: null };
  }
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n <= 0 || String(n) !== String(raw).trim()) {
    return { ok: false };
  }
  return { ok: true, value: n };
}

---
name: Auth, session isolation, and gzip storage
description: Implementation decisions for the auth/session system, ownership enforcement, and gzip upload storage added in July 2026. Turnstile was fully removed on July 19, 2026 at user request.
---

## Auth stack decisions

- **bcryptjs** (pure JS) instead of argon2/native bcrypt — avoids esbuild native-module bundling issues.
- **connect-pg-simple** session store with `createTableIfMissing: false` — the `session` table is declared in the Drizzle schema (`lib/db/src/schema/users.ts`) so drizzle-kit push creates it; connect-pg-simple must not try to recreate it.
- Cookie name: `mt.sid`, sameSite lax, httpOnly, secure in production.
- `app.set("trust proxy", 1)` required for `req.ip` and `secure` cookies behind Replit proxy.
- Rate limit: 10 requests per 15 min per IP on auth routes (express-rate-limit).

## Ownership enforcement pattern

Every data route calls `requireOwnedInstance(rawInstanceId, req, res)` from `src/lib/ownership.ts`.  
Returns the verified `instanceId: number` or sends the 401/400/404 itself and returns null.  
Routes return early on null: `const instanceId = await requireOwnedInstance(...); if (instanceId === null) return;`  
404 (not 403) when the workspace doesn't belong to the user — avoids leaking which IDs exist.

## Legacy workspace adoption

First-registered user adopts all instances where `userId IS NULL`.  
This happens once in `POST /auth/register` when `count(users) === 0` at registration time.

## Turnstile — REMOVED (July 19, 2026)

Cloudflare Turnstile was implemented, then fully removed at user request ("broken" — the widget cannot reach Cloudflare's challenge servers from the Replit preview sandbox, error 110200). Do not re-add without an explicit ask. Rate limiting (10/15 min per IP) remains the bot/brute-force control on auth routes. The TURNSTILE_SECRET_KEY / VITE_TURNSTILE_SITE_KEY secrets may still exist in the workspace but are unused.

## Gzip storage

- `compressStoredFile(filePath, originalName)` — gzips TXT/MD/CSV after multer writes; skips PDF/DOCX (already compressed).
- `readStoredFile(filePath)` — detects gzip by `.gz` extension or magic bytes (0x1f 0x8b); gunzips transparently.
- Stored path (including `.gz`) is written to `memories.filePath` — delete routes unlink the stored path directly.
- `fileProcessor.ts` uses `readStoredFile` instead of `fs.readFile` for all extraction paths.

## OpenAPI / codegen gotcha

- Do NOT use `format: email` in request body schemas — Orval emits `zod.email()` which doesn't exist in the `zod` (v3) package the generated client imports from. The server does its own validation.

## Schema rebuild order

After adding `users.ts` + `userId` FKs on `instances` and `searchQueries`:  
1. `pnpm run typecheck:libs`  
2. `pnpm --filter @workspace/db run push-force`  
(These are already done; note for future schema changes.)

# Memory Threads

An AI-powered memory engine for your files. Stop searching by filename — search by memory, context, people, events, or conversations. Every uploaded file becomes a rich **Memory Card** with AI-extracted entities, summaries, and semantic search.

## Features

- **Auth**: Email + password accounts, httpOnly session cookies, bcrypt password hashing, rate-limited login/register.
- **Upload**: Drag-and-drop files (PDF, DOCX, TXT, MD, CSV — up to 50MB). Text-based files (TXT, MD, CSV) are gzip-compressed at rest; already-compressed container formats (PDF, DOCX) are stored as-is. Image uploads are disabled.
- **Memory Cards**: AI-extracted title, summary, people, organizations, locations, dates, tasks, and topics.
- **AI Search**: Natural language search with match reasons (e.g., *"the PDF my professor sent"*).
- **Ask AI**: Q&A over your entire file library with cited sources.
- **Timeline**: Chronological view of memories and detected events.
- **Graph**: Force-directed relationship graph (people ↔ documents ↔ topics).
- **Dashboard**: Stats, top topics, most mentioned people, and recent searches — scoped per user.
- **Workspaces (instances)**: Sidebar switcher groups all data into separate, color-coded workspaces. All data routes verify workspace ownership; workspaces from other users are never accessible.

## Tech Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + Framer Motion + Wouter
- **API**: Express 5
- **Auth**: express-session + connect-pg-simple (Postgres session store), bcryptjs, express-rate-limit
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: DeepSeek API (`deepseek-chat` model, OpenAI-compatible SDK)
- **File processing**: `pdf-parse` (PDF), `mammoth` (DOCX), `papaparse` (CSV), Node.js zlib (gzip at rest)
- **Validation**: Zod (v4), `drizzle-zod`
- **API codegen**: Orval from the OpenAPI spec
- **Build**: esbuild

## Project Structure

```
lib/
  api-spec/openapi.yaml          # OpenAPI spec (source of truth for API + client hooks)
  db/src/schema/
    users.ts                     # Users + sessions tables
    instances.ts                 # Workspaces (userId FK → ownership)
    memories.ts                  # Main memories table
    searchQueries.ts             # Search history (userId scoped)
    timelineEdits.ts             # Timeline custom events / overrides

artifacts/
  api-server/
    src/lib/auth.ts              # Session middleware, requireAuth
    src/lib/ownership.ts         # requireOwnedInstance() — verifies instanceId belongs to user
    src/lib/fileStorage.ts       # compressStoredFile / readStoredFile (gzip helpers)
    src/lib/fileProcessor.ts     # Text extraction (reads via readStoredFile, transparent gunzip)
    src/lib/ai.ts                # DeepSeek client: analyze, rerank, answer
    src/lib/processor.ts         # Background processing pipeline
    src/routes/auth.ts           # POST /auth/register, /auth/login, /auth/logout, GET /auth/me
    src/routes/instances.ts      # CRUD — ownership-scoped
    src/routes/memories.ts       # Upload + CRUD — ownership-scoped; gzip on upload
    src/routes/search.ts         # AI search — ownership-scoped
    src/routes/ask.ts            # AI Q&A — ownership-scoped
    src/routes/dashboard.ts      # Stats — ownership-scoped
    src/routes/timeline.ts       # Timeline — ownership-scoped
    src/routes/graph.ts          # Graph — ownership-scoped
  memory-threads/
    src/contexts/AuthContext.tsx # AuthProvider, useAuth, login/register/logout
    src/pages/login.tsx          # Login page
    src/pages/register.tsx       # Register page
    src/pages/                   # Dashboard, Memories, Search, Ask, Timeline, Graph, Upload
```

## Run Locally

### Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL database (connection string in `DATABASE_URL`)
- DeepSeek API key in `DEEPSEEK_API_KEY`

### Install & Build

```bash
pnpm install
pnpm run build
```

### Development

```bash
# Run the API server
pnpm --filter @workspace/api-server run dev   # http://localhost:8080

# Run the frontend
pnpm --filter @workspace/memory-threads run dev

# Full typecheck
pnpm run typecheck
```

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API key for analysis and Q&A |
| `SESSION_SECRET` | ✅ | Random secret for signing session cookies (min 32 chars recommended) |
| `PORT` | — | API server port (provided by Replit / your hosting platform) |
| `NODE_ENV` | — | Set to `production` for secure cookies |

## Architecture Notes

### Authentication & session isolation

Every `/api/*` route except `/api/healthz` and `/api/auth/*` requires an active session cookie (`mt.sid`). Sessions are stored server-side in the `session` Postgres table (connect-pg-simple), so they can be revoked instantly. Password hashing uses bcrypt (cost factor 12). Login/register are rate-limited to 10 attempts per 15 minutes per IP.

All data routes call `requireOwnedInstance(instanceId, req, res)` which:
1. Validates the `instanceId` format.
2. Queries `instances` joined to the authenticated `userId` — if the row doesn't exist or belongs to someone else, the request gets a 404 (not 403, to avoid leaking which IDs exist).

Routes that were formerly unscoped / open (now fixed):
- `GET /api/memories`, `POST /api/memories/upload`, `GET/DELETE /api/memories/:id`, `GET /api/memories/:id/related`
- `POST /api/search`, `POST /api/ask`
- `GET /api/dashboard`, `GET /api/filters`
- `GET /api/timeline`, `POST/PUT/DELETE /api/timeline/events/:id`
- `GET /api/graph`
- `GET/POST/PUT/DELETE /api/instances` (previously returned all instances for all users)

### Gzip storage

Text-based uploads (TXT, MD, CSV) are gzip-compressed after multer writes them to `./uploads/`. Already-compressed container formats (PDF, DOCX) are stored as-is — gzipping a PDF/DOCX typically saves 0–5% while burning CPU. The compressed path (`<original>.gz`) is stored in `memories.filePath` so delete operations unlink the right file. `readStoredFile()` transparently gunzips any file ending in `.gz` or bearing a gzip magic number before handing bytes to pdf-parse / mammoth / papaparse.

### Legacy workspace adoption

Workspaces (instances) created before auth existed have a NULL `userId`. When the very first account registers, all NULL-owner workspaces are automatically adopted by that user, so existing data remains accessible.

### Search & AI

- File uploads are handled by `multer`; processing is async (fire-and-forget). Clients poll `/api/memories/:id` for status updates.
- Search uses PostgreSQL FTS (`tsvector` / `websearch_to_tsquery`) for candidate retrieval, then DeepSeek for AI re-ranking and match-reason generation.
- Ask/Q&A uses RAG: FTS retrieves relevant memories; DeepSeek synthesizes an answer with cited sources.
- No vector embeddings — DeepSeek's chat API does not expose an embeddings endpoint. FTS + LLM re-ranking provides high-quality semantic search.

## What is NOT covered

The following security controls were intentionally left out of scope for this implementation:

- **Password reset / forgot-password flow** — no email integration; reset requires direct DB access.
- **Email verification** — accounts are created and immediately active; email ownership is not confirmed.
- **CSRF protection** — session cookies use `sameSite: lax` which defends against cross-site form POSTs in modern browsers, but explicit CSRF tokens (double-submit cookie, synchronizer token) are not implemented.
- **Account lockout beyond rate limiting** — the 10-per-15-min rate limit is per-IP (not per-account), so distributed attacks from many IPs are not blocked.
- **Audit logging** — no tamper-evident log of auth events (login success/failure, password changes, workspace access).
- **Multi-factor authentication** — no TOTP, WebAuthn, or SMS 2FA.
- **Access roles / permissions** — all authenticated users have identical access to their own data; no admin roles or read-only sharing.
- **HTTPS enforcement** — assumed to be handled by the hosting platform (Replit proxy); the app itself does not redirect HTTP → HTTPS.

## Common Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after editing `lib/api-spec/openapi.yaml`.
- Run `pnpm run typecheck:libs` after changing `lib/db/src/schema/` before checking artifact typechecks.
- `pdf-parse` v2 is a CJS class export; import it dynamically and call `new PDFParse({ data: buffer }).getText()`.
- `format: email` in the OpenAPI spec makes Orval emit `zod.email()` which is Zod v4 only — do not use `format: email` in request body schemas since the generated zod client imports from the standard `zod` package.
- The `session` table is declared in the Drizzle schema (`lib/db/src/schema/users.ts`) so `drizzle-kit push` doesn't try to drop it. `connect-pg-simple` manages it with `createTableIfMissing: false` since drizzle creates it.
- `app.set("trust proxy", 1)` is required for `req.ip` and `secure` cookies to work correctly behind the Replit proxy.

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](./LICENSE) file for details.

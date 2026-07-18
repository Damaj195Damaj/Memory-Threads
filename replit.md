# Memory Threads

An AI-powered memory engine for your files. Instead of searching by filename, search by memory, context, people, events, or conversations. Every uploaded file becomes a rich "Memory Card" with AI-extracted entities, summaries, and semantic search.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/memory-threads run dev` — run the frontend (port varies)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned)
- Required env: `DEEPSEEK_API_KEY` — DeepSeek API key for AI analysis and Q&A

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + shadcn/ui + Framer Motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: DeepSeek API (deepseek-chat model, OpenAI-compatible SDK)
- File processing: pdf-parse (PDF), mammoth (DOCX), papaparse (CSV)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth)
- `lib/db/src/schema/memories.ts` — memories table (main entity)
- `lib/db/src/schema/searchQueries.ts` — search history table
- `lib/db/src/schema/instances.ts` — workspaces table (`instanceId` FK on memories + timeline_edits, cascade delete)
- `artifacts/api-server/src/lib/instance-id.ts` — strict `parseInstanceId` helper (400 on invalid, never unscoped fallback)
- `artifacts/memory-threads/src/contexts/InstanceContext.tsx` — active workspace state (localStorage, auto-creates "Default")
- `artifacts/api-server/src/lib/ai.ts` — DeepSeek client, analyzeContent, rankSearchResults, answerQuestion
- `artifacts/api-server/src/lib/fileProcessor.ts` — text extraction from PDF/DOCX/TXT/CSV
- `artifacts/api-server/src/lib/processor.ts` — background processing pipeline
- `artifacts/api-server/src/routes/` — all API route handlers
- `artifacts/memory-threads/src/` — React frontend

## Architecture decisions

- File uploads are handled by multer; processing is async (fire-and-forget). Clients poll `/api/memories/:id` for status updates.
- Search uses PostgreSQL full-text search (tsvector/websearch_to_tsquery) for candidate retrieval, then DeepSeek for AI re-ranking and match-reason generation.
- Ask/Q&A uses RAG: FTS retrieves relevant memories, DeepSeek synthesizes the answer with cited sources.
- No vector embeddings — DeepSeek's chat API doesn't support them. FTS + LLM re-ranking provides high-quality semantic search.
- Uploaded files stored in `./uploads/` at monorepo root (relative to process.cwd()).

## Product

- **Upload**: Drag-and-drop files (PDF, DOCX, TXT, MD, CSV, images up to 50MB)
- **Memory Cards**: AI-extracted title, summary, people, organizations, locations, dates, tasks, topics
- **AI Search**: Natural language search with match reasons (e.g. "the PDF my professor sent")
- **Ask AI**: Q&A over your entire file library with cited sources
- **Timeline**: Chronological view of memories and detected events
- **Graph**: Force-directed relationship graph (people ↔ documents ↔ topics)
- **Dashboard**: Stats, top topics, most mentioned people, recent searches
- **Workspaces (instances)**: Sidebar switcher groups all data into separate workspaces (create/rename/delete, color-coded). Active workspace persisted in localStorage; all API queries scoped by `instanceId`. Memories page includes a "Delete all" action per workspace.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`
- Always run `pnpm run typecheck:libs` after changing `lib/db/src/schema/` before checking artifact typechecks
- DeepSeek API base URL: `https://api.deepseek.com` (OpenAI SDK compatible)
- The `pdf-parse` module uses CJS default exports — import with dynamic `await import()` and handle the `default` property carefully

# Memory Threads

An AI-powered memory engine for your files. Stop searching by filename — search by memory, context, people, events, or conversations. Every uploaded file becomes a rich **Memory Card** with AI-extracted entities, summaries, and semantic search.

## Features

- **Upload**: Drag-and-drop files (PDF, DOCX, TXT, MD, CSV — up to 50MB). Image uploads are disabled; the AI pipeline analyzes documents, not visuals.
- **Memory Cards**: AI-extracted title, summary, people, organizations, locations, dates, tasks, and topics.
- **AI Search**: Natural language search with match reasons (e.g., *"the PDF my professor sent"*).
- **Ask AI**: Q&A over your entire file library with cited sources.
- **Timeline**: Chronological view of memories and detected events.
- **Graph**: Force-directed relationship graph (people ↔ documents ↔ topics).
- **Dashboard**: Stats, top topics, most mentioned people, and recent searches.
- **Workspaces (instances)**: Sidebar switcher groups all data into separate, color-coded workspaces. Active workspace is persisted in `localStorage`; all API queries are scoped by `instanceId`.

## Tech Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + Framer Motion + Wouter
- **API**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: DeepSeek API (`deepseek-chat` model, OpenAI-compatible SDK)
- **File processing**: `pdf-parse` (PDF), `mammoth` (DOCX), `papaparse` (CSV), custom text extractors
- **Validation**: Zod (v4), `drizzle-zod`
- **API codegen**: Orval from the OpenAPI spec
- **Build**: esbuild

## Project Structure

```
lib/
  api-spec/openapi.yaml          # OpenAPI spec (source of truth for API + client hooks)
  db/src/schema/                 # Drizzle schema
    memories.ts                  # Main memories table
    searchQueries.ts             # Search history
    instances.ts                 # Workspaces (with cascade delete)

artifacts/
  api-server/                    # Express API
    src/lib/ai.ts                # DeepSeek client, analyze, rerank, answer
    src/lib/fileProcessor.ts     # Text extraction
    src/lib/processor.ts         # Background processing pipeline
    src/routes/                  # API route handlers
  memory-threads/                # React frontend
    src/contexts/InstanceContext.tsx
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

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DEEPSEEK_API_KEY` | DeepSeek API key for analysis and Q&A |
| `PORT` | API server port (provided by Replit / your hosting platform) |
| `SESSION_SECRET` | Session secret for API auth/session middleware |

## Architecture Notes

- File uploads are handled by `multer`; processing is async (fire-and-forget). Clients poll `/api/memories/:id` for status updates.
- Search uses PostgreSQL full-text search (`tsvector` / `websearch_to_tsquery`) for candidate retrieval, then DeepSeek for AI re-ranking and match-reason generation.
- Ask/Q&A uses RAG: FTS retrieves relevant memories, and DeepSeek synthesizes an answer with cited sources.
- No vector embeddings — DeepSeek's chat API does not expose an embeddings endpoint. FTS + LLM re-ranking provides high-quality semantic search.
- Uploaded files are stored in `./uploads/` relative to the API server's working directory.

## Common Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after editing `lib/api-spec/openapi.yaml`.
- Run `pnpm run typecheck:libs` after changing `lib/db/src/schema/` before checking artifact typechecks.
- `pdf-parse` v2 is a CJS class export; import it dynamically and call `new PDFParse({ data: buffer }).getText()`.

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](./LICENSE) file for details.

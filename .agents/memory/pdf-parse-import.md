---
name: pdf-parse import & API
description: How to load and use the pdf-parse package in the API server for PDF text extraction
---

The project uses `pdf-parse` v2 (currently `^2.4.5`). This is a major rewrite from v1:

- **v1 API** (no longer works): `const pdfParse = require('pdf-parse'); const data = await pdfParse(buffer);`
- **v2 API**: `const { PDFParse } = require('pdf-parse'); const parser = new PDFParse({ data: buffer }); const data = await parser.getText();`

## Loading the package

`pdf-parse` v2 ships as an ESM package with `PDFParse` as a **named export**. When bundled with esbuild, the dynamic `import('pdf-parse')` path can be rewritten in ways that break the `pdfjs-dist` internals at runtime, causing silent empty text extraction.

Use `createRequire(import.meta.url)` to load the package at runtime from `node_modules` instead of letting esbuild bundle it:

```ts
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
const text = result.text.trim();
```

## Why this matters

- Calling the v1 function-style API on the v2 class throws `Class constructor PDFParse cannot be invoked without 'new'`.
- Bundling `pdf-parse` with esbuild can produce a `dist/index.mjs` that appears to have the right code but fails to extract text at runtime, returning empty content and misleading the AI into thinking the PDF is empty.
- Loading via `createRequire` keeps the package outside the bundle and avoids the bundling issues.

## Fallback on empty text

`pdf-parse` returns empty text for scanned/image-based PDFs. The processor should still pass a placeholder to the AI so it can report low confidence, rather than failing outright.

# Plan

Active plan for phase 3. Phases 1 and 2 are complete — see [done/DONE.md](done/DONE.md) for the record and [done/PLAN.md](done/PLAN.md) for the phase 1–2 migration archive. [ARCH.md](ARCH.md) describes the target architecture across all phases.

Phase 3 adds AI assistance to the canvas. It is **backend-first**: a Python + FastAPI service owns the LLM proxy, content ingestion, RAG, and analyze pipelines; the frontend stays lean and talks to the backend over HTTP. The backend architecture is specified in [ARCH_AI.md](ARCH_AI.md); this plan commits to concrete milestones against it.

The browser-only alternative in [design/ARCH_FE.md](design/ARCH_FE.md) is **archived** — not an alternative, not a fallback. Do not plan two-track implementations, in-browser PDF.js, in-browser embeddings, or user-deployed CORS proxies.

## Primary workflow and input channels

The primary workflow is **context → draft Preseed Canvas → refine / critique → drill into companion canvases for deep dives**. Context can arrive through any of four input channels:

1. **Text description** — the user types or pastes a description of the startup (or domain) directly into the chat sidebar.
2. **File** — a pitch deck (PDF), slide export, DOCX, or TXT uploaded through the sidebar.
3. **URL** — a crawl target (company site, public profile, market report) whose text is fetched server-side.
4. **Combinations** — any mix of the above in a single session.

The *analysis steps* (chat, draft, critique, companion-canvas drafting) are the same across all channels — only the ingestion differs. We ship the channels in order of cost-to-build: **text first** (no ingestion infrastructure needed), then **file upload**, then **URL crawl**. This means the first useful draft lands before the RAG subsystem exists.

Milestone numbering follows the phase 1 / phase 2 convention: M1, M2, … within the phase. Prose cross-references use `M1`, `M3`, etc.

---

## Phase 3 — Backend AI

**Goal:** the user drafts a Preseed Canvas from a text description, pitch deck, or URL, then refines via chat and drills into companion canvases.

### Milestones

1. **Foundations — chat proxy + patch protocol + sidebar**

   Smallest useful end-to-end path: chat about the current canvas, accept / reject structured patches. No draft orchestration yet; each chat turn is one LLM call returning scoped patches for what the user asked about.

   *Backend* ([backend/src/canvas_ai/](../backend/src/canvas_ai/))
   - `server.py` — FastAPI app, CORS locked to the canvas origin(s), health check, exception handlers.
   - `config.py` — `pydantic-settings` reading `.env` (`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `MODEL`, `CORS_ORIGIN`, `MAX_INPUT_TOKENS`).
   - `llm/client.py` — OpenAI-compatible client (httpx); non-streaming first, streaming deferred.
   - `llm/tokens.py` — `tiktoken`-based budget enforcement.
   - `llm/parse.py` — JSON-mode parsing + Pydantic validation, with a brace-balanced fallback for providers that don't honor `response_format`.
   - `prompts/{system,canvas,chat}.py` — canvas schema → prompt fragment; chat-turn assembly.
   - `patches/schema.py` — Pydantic `Patch` discriminated union per [ARCH_AI.md#patch-protocol](ARCH_AI.md#patch-protocol).
   - `patches/validate.py` — patch ↔ canvas-schema cross-check (valid `cellId`, stale `cardIndex` warning, etc.).
   - `routes/chat.py` — `POST /api/chat`; body is `{ messages, canvas, canvasConfig }`; response is `{ message, patches[] }`.
   - CI exports [../shared/patch.schema.json](../shared/patch.schema.json) from the Pydantic models; build fails if the checked-in copy is stale.

   *Frontend* ([frontend/src/](../frontend/src/))
   - `state/ai.ts` — new store slice (`providers`, `activeProviderId`, `chatSessions`). Persists to `canvas.ai.config` and `canvas.ai.chats` in `localStorage`. Reuses the `subscribe/getState` pattern from [../frontend/src/state/store.ts](../frontend/src/state/store.ts).
   - Settings page — hash-route (`#/settings`) or modal (pick before starting; either fits the SPA). Provider list, "Add provider" flow, "Test connection" probe. In this milestone the only provider is the local backend (`http://localhost:8000`); the UI models provider-as-abstraction so hosted deploys can be added later.
   - `ai/client.ts` — thin `fetch` wrapper against the backend endpoints.
   - `ai/patches/schema.ts` — generated from [../shared/patch.schema.json](../shared/patch.schema.json) via `json-schema-to-zod`, wired into `npm run build`.
   - `ChatSidebar` — collapsible right panel; isolated via portal so it never steals focus from card editing mid-keystroke.
   - `PatchPreview` — per-patch diff + rationale + cite (empty in M1), with accept / reject. Accept dispatches existing store actions — no new mutation paths.

   *Tests*
   - Backend: `pytest` specs for prompt assembly (schema fragment shape, budget trim), patch validation (bad cellId rejected, stale cardIndex dropped with warning), chat endpoint with a mocked LLM client.
   - Frontend: Vitest specs for patch schema codegen drift, store integration (accept → dispatch), sidebar focus isolation.

2. **Draft from text description (primary workflow, first cut)**

   The first moment of real value: user pastes or types a description of the startup / domain → assistant drafts a Preseed Canvas → user reviews and accepts selectively. No file upload, no URL crawl — text is passed inline in the request. No RAG subsystem yet; the whole text is the context. Depends on M1.

   *Backend*
   - `analyze/pipeline.py` — orchestration for `mode: 'draft'` with a text-only input:
     1. One LLM call per cell proposing `addCard` patches. The full user-provided text goes into the prompt alongside the cell's `description`.
     2. One LLM call per scored cell proposing `setScore` with rationale.
     3. One final call for `setAnalysis` summarizing the canvas.
   - `prompts/analyze.py` — per-cell drafting prompt, score-rationale prompt, analysis prompt. Canvas-schema-driven — no hard-coded Preseed cell list. Prompts reference the text as "the description provided by the user"; `cite[]` is empty for this milestone (citations come in M3 with RAG).
   - `routes/analyze.py` — `POST /api/analyze` `{ canvas, canvasConfig, mode: 'draft', text: string }` → `{ patches[], warnings[], rationale? }`. `text` is required; `contextId` (file) and `url` are not yet supported.
   - Progress: synchronous with a progress counter in response headers (`X-Progress-Cell: 5/9`); streaming deferred to M7.

   *Frontend*
   - "Draft from text" action in the sidebar. Opens a text area (or reuses the chat input with a "draft" intent toggle). User pastes / types a description, clicks "Draft".
   - Confirmation dialog if the canvas is not empty.
   - `PatchQueue` view — scrollable list of proposed patches grouped by cell, with per-patch accept / reject, accept-all, reject-all, and "focus this cell" click-through.
   - Progress indicator tied to the backend's per-cell counter.

   *Tests*
   - Backend: pytest on the pipeline against a canned text fixture (a plain-English startup description). Assert: patch types per cell match expectation, scored cells get a `setScore` with rationale, final `setAnalysis` references at least two cells. Pin `temperature: 0` for determinism.
   - End-to-end: Vitest + backend running in a test harness; happy-path draft against a fixture text produces N patches that apply cleanly to an empty Preseed Canvas.

3. **File ingestion (PDF, DOCX, TXT) + document RAG**

   Add uploaded files as a second input channel to `draft`. Introduces the RAG subsystem (extract, chunk, embed, store, retrieve) and citation machinery. Pitch-deck users can now drop a deck and draft. Depends on M1 and M2.

   *Backend*
   - `rag/extract.py` — PDF → text + page metadata via `pdfplumber` (primary) with `pymupdf` fallback for layout-heavy decks. DOCX via `python-docx`; TXT trivial.
   - `rag/chunk.py` — page-aware chunking (semantic breaks within a page; never chunk across page boundaries without preserving the page cite).
   - `rag/embed.py` — provider-agnostic embedding call (`text-embedding-3-small` default; configured via `EMBED_BASE_URL` / `EMBED_MODEL`).
   - `rag/store.py` — in-memory vector index via `hnswlib`. Zero ops, per-process. Persistence deferred to M7.
   - `rag/search.py` — dense top-k + BM25 keyword pass (`rank-bm25`) for rare-term recall; returns snippets with `{ docId, page, text }` attribution.
   - `context/docs.py` — uploaded-doc store: `contextId → DocBundle` with TTL eviction (default 30 min, configurable via `CONTEXT_TTL_MIN`).
   - `routes/upload.py` — `POST /api/upload` (multipart); returns `{ contextId, pages, warnings[] }`.
   - `routes/rag.py` — `POST /api/rag` `{ contextId, query, topK? }` → `{ snippets[] }`. Used internally by chat and analyze; exposed for debugging.
   - `/api/analyze` extended: accepts `contextId` in addition to (or instead of) `text`. Orchestration runs a per-cell retrieval pass before each draft call; retrieved snippets inject into the prompt with `[citeN]` markers; patches carry `cite[]` entries.
   - Chat route extended: optional `contextId` in the body triggers a RAG pass; same cite mechanics.

   *Frontend*
   - Upload control in the sidebar. Accepts PDF, DOCX, TXT. Uploads to `/api/upload`, binds the returned `contextId` to the current chat session.
   - Per-session "include file" toggle. Off by default; flips on automatically after first upload.
   - `PatchPreview` renders `cite[]` entries as expandable "page N of deck.pdf" links that open a minimal viewer.
   - "Draft from file" action (reuses the M2 draft flow; submits `contextId` instead of `text`).
   - Storage telemetry in settings: surfaces `canvas.ai.*` `localStorage` usage with per-bundle eviction. Soft warning at 60% of quota, hard at 90%. Files themselves live on the backend, not in `localStorage`.

   *Tests*
   - Backend: pytest on extraction (page-count correctness on a fixture deck), chunking (no cross-page chunks), retrieval (known-query → known-snippet top-3), analyze with `contextId` (patches have non-empty `cite[]`).
   - Frontend: Vitest on upload flow (happy path, large file rejection, network error), cite rendering.

4. **URL ingestion (web crawl)**

   Add URLs as a third input channel. Backend fetches the URL (allowlist-gated), extracts readable text via `trafilatura`, and routes it through the same RAG subsystem from M3. Depends on M3.

   *Backend*
   - `rag/web.py` — URL fetch with an allowlist (`WEB_FETCH_ALLOWLIST` env var, comma-separated; loosen per deploy). Fetches HTML, extracts main content with `trafilatura`, falls back to `readability-lxml` for sites that trafilatura mishandles.
   - `routes/upload.py` extended: `POST /api/upload-url` `{ url }` → `{ contextId, warnings[] }` using the same doc store as M3. Internally: fetch → extract → chunk → embed → store.
   - `/api/analyze` and `/api/chat` already accept `contextId`; URL-sourced contexts are indistinguishable downstream.
   - Error handling: surface timeouts, allowlist rejections, and empty-extract cases as actionable warnings.

   *Frontend*
   - URL input in the sidebar (same surface as file upload). Validates the URL format client-side; submits to `/api/upload-url`.
   - Source indicator in `cite[]` entries: "deck.pdf page 4" vs. "example.com/about".
   - "Draft from URL" action (same flow as M3, different submission path).

   *Tests*
   - Backend: pytest with a fixture HTML page (no live network) that exercises extract → chunk → embed → retrieve. Test allowlist rejection. Test empty-extract warning (page with only images).
   - Frontend: Vitest on URL input validation and error-banner rendering.

5. **Chat-driven refinement + critique**

   The drafted canvas becomes an iterable artifact. Chat refines specific cells; critique surfaces gaps. Depends on M1–M4 (works against any context channel).

   *Backend*
   - `analyze/pipeline.py` — add `mode: 'critique'`. Add-only patches (`:?` query cards, `:!` comment cards); never overwrite existing content. Cross-cell consistency checks (e.g. "cell 4 mentions enterprise customers but cell 5 is bottom-up") as `:!` patches with cites to the conflicting cells.
   - Chat route: scoring-aware prompt. When the user asks "why this score?", the response includes the rubric anchor, the 1–2 cell-content facts that drove the number, and (if available) what would have to be true for a higher / lower score.
   - `patches/validate.py` — add rationale-required check for `setScore` patches; reject if missing.

   *Frontend*
   - `PatchPreview` — visual distinction for critique patches (dashed border, warning icon).
   - Scoring UI: when a `setScore` patch is previewed, its `rationale` and (when present) `scoreBreakdown` surface below the diff.
   - Chat input gains a mode toggle: `chat` (default), `critique`.

   *Tests*
   - Backend: pytest on critique against a fixture already-filled canvas. Assert: no overwrite patches, consistency check fires on a known-contradiction fixture.
   - Frontend: Vitest on critique-patch rendering, score-rationale surfacing.

6. **Companion canvases (deep dives)**

   The same machinery drafts / critiques Lean Canvas, BMC, Product Vision Board, SWOT, TOWS against the same context + (where relevant) the existing Preseed Canvas as shared context. Depends on M1–M5.

   *Backend*
   - `prompts/analyze.py` — per-canvas-type prompt fragments. Loaded by matching `canvasConfig.meta.canvas` against a registry; unknown types fall back to the generic canvas-schema-driven prompt.
   - Cross-canvas handoff: if a Preseed Canvas exists in `localStorage` under the same title / slug, the frontend passes its key cells as additional context in the `analyze` request. The prompt treats Preseed content as prior decisions, not hypotheses to re-derive.
   - Optional side-docs mode (`mode: 'side-docs'`): structured SWOT / TOWS / 5F / 7P / pitch-outline as a separate document viewer. Can be done here if the prompt work ends up parallel; otherwise deferred to M7.

   *Frontend*
   - Canvas-type switcher already exists in Controls — no new UI for the switcher itself.
   - "Draft from [text | file | URL] + Preseed" action appears when a companion canvas is active and a Preseed Canvas exists for the same title.
   - Side-docs viewer (if scoped into M6): new component, read-only, rendered on demand.

   *Tests*
   - Backend: pytest on each companion canvas type against the same fixture context. Assert: patch types match each canvas's cell schema (Lean has 9 cells, BMC has 9, SWOT has 4, TOWS has 4-with-cross-matrix, Product Vision has 5).
   - End-to-end: drafting Lean → BMC → Product Vision from the same Preseed + context produces three coherent canvases; cross-canvas references are visible in cites.

7. **Progressive enrichment (gated)**

   Gate: M2 is shipping real value (users draft canvases from text), and either M3 or M4 is in use. If not, fix the primary workflow instead of starting M7.

   Candidates (pick by actual demand, not by interest):

   - **Streaming.** Server-sent events for `/api/chat` and `/api/analyze`; frontend renders patches as they arrive.
   - **Investor / hypothesis profiles.** `providers/profile.py` as a file-backed store; profile content is injected into prompts when a profile is selected.
   - **Vision-based file extraction.** For image-heavy decks where text extraction returns nothing — render pages to images, caption via a vision model, fold captions into the RAG index.
   - **LLM Wiki.** Per [design/ROAD.md](design/ROAD.md), a canonical knowledge base of framework vocabulary surfaced into prompts.
   - **Scoring calibration.** Per [design/ROAD.md](design/ROAD.md), rubric anchors per scored cell + memory of recent overrides.
   - **Side-docs mode** if not scoped into M6.
   - **Persistent vector index.** Swap in-memory `hnswlib` for a persistent backend (chromadb or similar) when cross-restart context retention becomes a need.
   - **Cross-device session handoff.** Durable `contextId`s survive backend restarts.

   Each candidate becomes its own milestone when promoted; this list is not a commitment.

### Done when

- **M1.** With the backend running (`uv run uvicorn canvas_ai.server:app --reload --port 8000`) and a provider-compatible LLM configured in `.env`, a user opens the frontend, points it at `http://localhost:8000`, opens the chat sidebar, asks about the current canvas, and accepts a suggested `addCard` that lands in the right cell with correct type. Full lint/type/test suites green. Canvas-only bundle size unchanged. [../shared/patch.schema.json](../shared/patch.schema.json) checked in and consumed by frontend codegen.
- **M2.** Pasting a plain-English startup description into "Draft from text" against an empty Preseed Canvas produces a fillable canvas whose patches are coherent and the user accepts selectively. Accepted patches round-trip through save → load → export without loss. Fixture-text run is stable across reruns (`temperature: 0`).
- **M3.** Uploading a real pitch deck and running "Draft from file" produces a canvas whose patches cite specific deck pages. Fixture-deck retrieval is stable (regression anchor for prompt / model changes). Deck TTL eviction reclaims memory.
- **M4.** Submitting a URL (inside the allowlist) and running "Draft from URL" produces a canvas whose patches cite URL-sourced snippets. Allowlist rejections and empty-extract cases surface as actionable warnings. Fixture-HTML test exercises the full pipeline without live network.
- **M5.** Running critique against a drafted canvas produces only add-only patches (`:?` / `:!`); never overwrites or scores. At least one cross-cell consistency check fires on the contradiction fixture. `setScore` patches always carry a rationale; the UI never renders a score without one.
- **M6.** Switching canvas type to Lean, running draft against the same context + existing Preseed, produces a Lean Canvas that references Preseed decisions. Every supported canvas type has at least one fixture-pair (empty + drafted) in the test suite.
- **M7.** Per-candidate; set when the candidate is promoted.

### Risks

- **JSON mode on non-premium models (M1).** Best-effort only; brace-balanced parse must handle prose-around-JSON. Build the fallback path before the happy path.
- **contenteditable + sidebar focus (M1).** The sidebar input must not steal focus from card editing mid-keystroke. Isolate with portal.
- **Long-running request timeouts (M2).** A 9-cell Preseed with 4 scored cells + 1 analysis ≈ 14 LLM calls. At 5 s/call that's over a minute — set reverse-proxy timeouts accordingly and document them.
- **Prompt-fragility cliffs (M2).** A single over-tuned prompt can collapse quality on a description shape you didn't test against. Keep two or three diverse fixture texts in CI, not one.
- **Accept-all foot-gun (M2).** A user who clicks "accept all" without reading could overwrite a non-empty canvas. The confirmation dialog is a feature, not a nicety.
- **File extraction quality (M3).** Some decks are exported from Figma / Keynote with every slide as an image — text extraction returns nothing. Flag these on upload (pages with zero text) and surface a warning; vision-based extraction is an M7 candidate, not an M3 blocker.
- **First-upload latency (M3).** Extraction + embedding for a 100-page deck is ~10–20 s. Synchronous response is fine for v1 but must block the UI obviously.
- **URL fetch abuse (M4).** Without an allowlist, the backend is a trivial SSRF proxy. The allowlist is not optional; default it to empty and make the user opt in per-origin.
- **Site-specific extraction failure (M4).** Trafilatura handles ~95% of content sites; LinkedIn, Crunchbase, and walled-garden sites return near-empty extracts. Surface this as a warning and point the user at the text-description channel as a workaround.
- **Critique over-enthusiasm (M5).** Models love to add five `:?` cards per cell. Cap per-cell critique patches in the prompt; surface the cap in response warnings if it fires.
- **Canvas-schema drift (M6).** Some companion canvases have non-grid layouts (TOWS cross-matrix; Preseed pre-canvas cells). The generic draft prompt must respect layout hints in `canvasConfig`, not invent its own cell order.

---

## Cross-cutting

- **Schema sync.** Pydantic models in [../backend/src/canvas_ai/patches/schema.py](../backend/src/canvas_ai/patches/schema.py) are the source of truth. CI exports [../shared/patch.schema.json](../shared/patch.schema.json) and fails the build if the checked-in copy is stale. Frontend regenerates Zod validators via `json-schema-to-zod` as part of `npm run build`.
- **Input-channel uniformity.** The `analyze` and `chat` routes accept any of `text`, `contextId`, or (from M4 on) implicit URL contexts — downstream pipelines don't branch on input source beyond assembling the right prompt blocks and citations. Adding a new channel should not touch the analyze pipelines.
- **Local dev.** Two shells: `cd backend && uv run uvicorn canvas_ai.server:app --reload --port 8000` and `cd frontend && npm run dev`. Frontend points at `http://localhost:8000` via the settings page. The `.env.example` defaults should make this "just work" with a compatible LLM endpoint configured.
- **Deployment.** Out of scope for phase 3. Phase 3 targets local dev only. Production deployment is a separate concern, promoted to PLAN when someone asks for it.
- **Branching.** One branch per milestone. Merge only when the milestone's "Done when" list is green and both `pytest` and `vitest` suites are clean.
- **Equivalence rule sunsets.** The 1:1 equivalence rule from phases 1–2 no longer binds new features. Existing canvas behavior stays unchanged; AI features are additive and gated by "a backend is configured."
- **`localStorage` schema.** All AI frontend keys are namespaced `canvas.ai.*`. Users who never enable AI see no new keys. Uploaded files, embeddings, and RAG indices live on the backend only — never in `localStorage`.
- **Bundle size.** Canvas-only path stays ≤ 100 KB gzipped. AI path is lazy-loaded; heavy dependencies (PDF, embeddings, web fetching) are backend-only, so there's no frontend bundle budget to guard.

---

## Out of scope for phase 3

- **Browser-only alternative.** [design/ARCH_FE.md](design/ARCH_FE.md) is archived. Do not build in-browser PDF.js, Transformers.js embeddings, or CORS troubleshooters. Cloud providers are reached via the backend proxy, not via user-deployed Cloudflare Workers.
- **Production deployment.** Local dev only for phase 3.
- **Multi-user, auth, accounts.** Single-user, local-backend assumption holds through phase 3.
- **Cross-device config sync.** Settings are frontend `localStorage`; context bundles are backend in-memory. No server-side user state.
- **Additional canvas forms** (Market Structure, Porter's 5 Forces, 7 Powers, GTM) — see [design/ROAD.md](design/ROAD.md).
- **Canvas storage backend** (upload / download canvases to a server) — see [design/ROAD.md](design/ROAD.md).

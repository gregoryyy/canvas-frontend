# Plan

Forward-looking plan for phase 3. Phases 1 and 2 are complete — see [DONE.md](../done/DONE.md) for the record and [ARCH.md](../ARCH.md) for the architecture they produced.

Phase 3 adds AI assistance to the canvas. Two sibling architectures exist:

- **[ARCH_FE.md](ARCH_FE.md)** — frontend-only. User brings their own provider (Ollama, OpenAI-compat), all logic in the browser, `localStorage` persistence. Zero deploy overhead.
- **[ARCH_AI.md](../ARCH_AI.md)** — Fastify backend. Richer RAG (web fetch, persistent profiles), centralized config, server-side extraction.

They share the patch protocol, the prompt-assembly approach, and the canvas-schema-driven prompt templating. The frontend-only design treats an [ARCH_AI.md](../ARCH_AI.md) deployment as one more "Custom backend" provider — so the two are **interoperable, not exclusive**.

## Track selection

Ship the frontend-only track first (`3F-*` substages). Rationale:

- Consistent with the canvas's existing frontend-only, `localStorage`-only shape — no new deployment story.
- Ollama users reach end-to-end function in the first substage with no proxy and no CORS workarounds.
- Settings page and chat sidebar are required under either design; building them first does not lock out the backend track.
- The backend (`3B-*`) can land later as an additional provider when (and only when) a real need appears: web RAG against third-party sites, cross-device config, shared investor profiles.

This plan commits to the `3F-*` substages with concrete milestones. `3B-*` is sketched in [ROAD.md](ROAD.md) and will be promoted to this plan when a track decision is made.

---

## Phase 3F — Frontend-only AI

Reference: [ARCH_FE.md](ARCH_FE.md). Five substages, each independently shippable.

### 3F-a — Settings page + Ollama chat (no RAG)

**Goal:** a working chat sidebar that reads the current canvas and can propose patches, with Ollama as the only supported provider.

Milestones:

1. **`ai` store slice.** Add `state/ai.ts` with `providers`, `activeProviderId`, `chatSessions`. Persist to `canvas.ai.config` and `canvas.ai.chats`. Reuse the existing `subscribe/getState` pattern from [src/state/store.ts](../../src/state/store.ts).
2. **Settings route.** `SettingsPage` component, reached from a new Controls button. Hash-route (`#/settings`) or modal — decide before starting; either fits the current SPA. Provider list + "Add provider" flow + "Test connection" probe.
3. **Provider model + client.** `ai/client.ts` as a thin `fetch` wrapper against `<baseUrl>/chat/completions`. Capability descriptor on the provider; the client honors `jsonMode` declarations and never feature-detects.
4. **Prompt assembly.** `ai/prompts/{system,canvas,chat}.ts`. Canvas schema fragment is generated from `canvasConfig`. Token budgeting via a heuristic first (chars/4), upgrade to `tiktoken` lite only if needed.
5. **Patch schema + validator.** `ai/patches/{schema,validate}.ts`. Zod schema matches [ARCH_AI.md#patch-protocol](../ARCH_AI.md#patch-protocol). Apply-side dispatches existing store actions — no new mutation paths.
6. **ChatSidebar + PatchPreview.** Collapsible right panel; message list; input; `PatchPreview` renders per-patch diff + rationale + cite, with accept/reject.
7. **Tests.** Vitest specs for prompt assembly (schema fragment shape, budget trim), patch validation (bad cellId rejected, stale cardIndex dropped with warning), store integration (accept → dispatch).

Done when:
- With Ollama running locally and `OLLAMA_ORIGINS` set, a user can add the provider in settings, open the sidebar, ask about the current canvas, and accept a suggested `addCard` that lands in the right cell with correct type.
- `npm run build` / `tsc --noEmit` / `eslint .` / `vitest run` all green.
- Canvas-only bundle size unchanged (AI code lazy-loads behind the settings/sidebar entry).

Risks:
- **JSON mode on local models.** Best-effort only; brace-balanced parse must handle prose-around-JSON. Build the fallback path before the happy path.
- **contenteditable + sidebar focus.** The sidebar input must not steal focus from card editing mid-keystroke. Isolate with portal.

### 3F-b — Cloud providers + CORS troubleshooter

**Goal:** OpenAI and other cloud OpenAI-compatible providers usable via a user-deployed proxy.

Milestones:

1. **OpenAI preset.** `ProviderForm` offers the preset with a red dot + "This provider requires a CORS proxy; see Troubleshooter" hint.
2. **CorsTroubleshooter component.** Live diagnostic: detects failed requests, distinguishes CORS from auth from network. Shows the Cloudflare Worker snippet from [ARCH_FE.md#the-cors-problem](ARCH_FE.md#the-cors-problem) parameterized by the current canvas origin.
3. **"I understand" gate.** Checkbox required on save for any provider whose `baseUrl` is non-localhost. Stores the acknowledgement timestamp; re-prompts if wiped.
4. **Provider probes.** `Test connection` runs a minimal `/models` GET (or `/chat/completions` with 1 token) and classifies the error.

Done when:
- A user can follow the troubleshooter, deploy the sample Worker, paste the URL, and reach parity with the Ollama path.
- Each documented provider preset (Ollama, LM Studio, OpenAI, Anthropic-via-proxy, Custom backend) has been verified against a real endpoint.

### 3F-c — PDF upload + in-browser RAG

**Goal:** upload a PDF, ask questions that cite specific pages, get patches with `cite[]`.

Milestones:

1. **Lazy PDF extraction.** `ai/rag/extract.ts` wraps `pdfjs-dist`, imported on first use. Page-level text with coordinate metadata.
2. **Chunk + embed (provider route).** `ai/rag/{chunk,embed}.ts`. If the active provider declares `capabilities.embeddings`, call `<baseUrl>/embeddings`. Embeddings lazy-computed on upload, persisted to `canvas.ai.vectors`.
3. **Flat vector index.** `ai/rag/store.ts` — brute-force cosine search. Zero deps. HNSW upgrade deferred until proven necessary.
4. **Hybrid retrieval.** Dense top-k + BM25 keyword pass for rare-term recall. `minisearch` (~10 KB) or hand-rolled.
5. **Chat integration.** Sidebar offers "Include uploaded doc" toggle per session. Prompt assembler adds a RAG block with `[citeN]` markers; response patches carry `cite[]` entries.
6. **Storage telemetry.** Settings page surfaces `canvas.ai.*` `localStorage` usage with per-bundle eviction. Soft warning at 60% of quota, hard at 90%.

Done when:
- Uploading the sample preseed deck and asking "what problem does this startup solve?" produces a patch on cell 1 with a citation pointing to the relevant deck page.
- Eviction UI actually recovers quota.

### 3F-d — In-browser embeddings (offline path)

**Goal:** zero outbound calls for local-LLM users.

Milestones:

1. **Transformers.js integration.** `ai/embed/local.ts` with `@xenova/transformers` running `Xenova/bge-small-en-v1.5` via WASM. Lazy-loaded (~1.5 MB gz + first-time model download cached by the browser).
2. **Routing.** Settings page picks between provider embeddings and local. Per-provider override. Upload path respects the setting at index time.
3. **Quality verification.** A test fixture (known deck, known expected citations) compares retrieval quality between `bge-small` (local) and `text-embedding-3-small` (OpenAI). Baseline acceptable if top-3 recall matches.

Done when:
- A user with Ollama + local embeddings configured can upload a deck, run a chat turn, and a network-tab inspection confirms zero non-`localhost` traffic for the entire session.

### 3F-e — Pi-check (draft / critique / side-docs)

**Goal:** scripted multi-step analyzer on top of the chat primitives.

Milestones:

1. **Analyzer module.** `ai/analyze/pipeline.ts`. Three modes per [ARCH_AI.md#analyze-pipeline](../ARCH_AI.md#analyze-pipeline). Browser-side orchestration; no network protocol (it's all local function calls against the provider client).
2. **`draft` mode.** Categorize snippets per cell → one LLM call per cell proposing `addCard` patches → one call for `setScore` per scored cell → one call for `setAnalysis`. Progress UI in the sidebar.
3. **`critique` mode.** Add-only patches (`:?` / `:!`), never overwrite. UI distinguishes critique patches visually.
4. **`side-docs` mode.** Returns structured SWOT/TOWS/5F/7P/pitch-outline as a separate document viewer (new component). Fold-back-to-canvas deferred to a later iteration.
5. **Streaming.** Optional; ship synchronous with a progress indicator first, add streaming if the wait is painful in practice.

Done when:
- Running `draft` against an empty Preseed Canvas with an uploaded deck produces a fillable canvas whose patches are coherent and cite the deck. The reviewer reads the proposed canvas and accepts selectively.

---

## Cross-cutting

- **One branch per substage.** Merge only when the substage's "done when" list is green.
- **Docs.** [ARCH_FE.md](ARCH_FE.md) is authoritative for frontend-only design decisions; update it when a substage reveals a design change worth recording. [ARCH.md](../ARCH.md) gains a short "AI features" cross-reference at the end of phase 3F-a.
- **Equivalence rule sunsets.** The 1:1 equivalence rule from phases 1–2 no longer binds new features. Existing canvas behavior stays unchanged; AI features are additive and gated by "at least one provider configured."
- **`localStorage` schema.** All AI keys are namespaced `canvas.ai.*`. Users who never enable AI see no new keys.
- **Bundle size target.** Canvas-only path stays ≤100 KB gzipped. AI path is lazy-loaded; no static bundle budget, but each heavy dep (`pdfjs-dist`, `@xenova/transformers`) is behind an explicit opt-in action.

---

## Out of scope for phase 3

See [ROAD.md](ROAD.md) for longer-term items, including the backend track (`3B-*`), the LLM wiki, scoring calibration, idea-from-chat analysis, and additional canvas forms (market structure, Porter's 5 Forces as a canvas).

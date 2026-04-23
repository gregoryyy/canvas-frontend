# AI Backend Architecture

Design for the phase-3 backend — the LLM-assisted features that turn the canvas from a manual editor into an analysis tool. Extends [ARCH.md](ARCH.md) (which defines the frontend, store, and the backend's outward shape) with the internal design of the LLM, RAG, and analyzer pipelines.

This doc supersedes the brief "Backend" section in [ARCH.md:183-225](ARCH.md#L183-L225) for design-level decisions; ARCH.md continues to own the frontend and the public API surface.

---

## Scope

Phase 3 does two things that the canvas could not do on its own:

1. **Conversational assistance.** A chat sidebar that can read the current canvas, answer questions about it, and propose structured edits the user explicitly accepts.
2. **Pitch-deck analysis (pi-check).** Upload a pitch deck (and optionally other documents and links), let the backend extract content, run analyses, and emit a draft filled canvas plus side documents (questions, SWOT/TOWS, 5-Forces, etc.) — all returned as patches the user reviews.

Both features share the same backend, the same patch protocol, and the same provider abstraction. Pi-check is essentially a scripted, multi-step chat run with a fixed objective.

### Non-goals (still)

- No multi-user, no accounts, no server-owned canvas state.
- No model finetuning. Investor-specific behavior is achieved via prompts + curated RAG, not by training.
- No background jobs visible to the user. All requests are synchronous request/response from the frontend's perspective; long-running analyses stream tokens but do not detach.

---

## Principles

- **Frontend stays authoritative.** Backend reads canvas snapshots; it never owns or mutates state. Patches are *proposals*; the store applies them only on user accept.
- **Provider-agnostic.** All LLM calls go through one OpenAI-compatible client. Swappable between OpenAI, Ollama, and any compatible proxy via `OPENAI_BASE_URL` + `MODEL`.
- **Structured-first, prose-fallback.** The LLM is asked to emit `{ reply, patches }` JSON validated by Zod. If parsing fails, the reply is surfaced as plain text and the user is told no patches were proposed.
- **Schema-driven prompts.** The canvas-type config (e.g. [public/conf/preseed.json](../public/conf/preseed.json)) is the source of truth for cell titles, subtitles, descriptions, and scoring rules. Prompts are templated against that schema so adding a canvas type does not require backend changes.
- **Stateless apart from short-lived context.** Uploaded documents and chat history live in process memory keyed by a session-scoped `contextId` with a TTL. Restarting the backend does not lose canvas state (it never had it) and only loses in-flight uploads.
- **Defensive on cost and context.** Token budgets are enforced server-side. Overflow triggers summarization, not silent truncation.
- **Safety on apply.** No patch ever lands without explicit user accept. Patches show which cells they touch before being applied.

---

## System diagram (extending ARCH.md)

```
┌──────────────────────────────── Browser ─────────────────────────────┐
│                                                                      │
│  React UI ────────────►  Store  ◄────────── (patches, accepted)      │
│                            ▲                                         │
│  ChatSidebar ──────────────┘                                         │
│    ▲ ▼                                                               │
└────┼─┼───────────────────────────────────────────────────────────────┘
     │ │                                                                    
     │ │  POST /api/chat       { canvas, history, message, contextId? }     
     │ │  POST /api/upload     (multipart)                                   
     │ │  POST /api/rag        { query, sources[] }                         
     │ │  POST /api/analyze    { canvas, contextId, mode }                  
     ▼ ▼                                                                    
┌── Backend (Fastify, TS) ─────────────────────────────────────────────┐    
│                                                                      │    
│  routes/                                                             │    
│    chat.ts       ─┐                                                  │    
│    upload.ts     ─┤                                                  │    
│    rag.ts        ─┼──►  PromptAssembler ──►  LlmClient ──►  Provider │    
│    analyze.ts    ─┘            ▲                  │                  │    
│                                │                  ▼                  │    
│  context/      (TTL store)     │            ResponseParser           │    
│    docs        uploaded files  │            (Zod: { reply, patches })│    
│    sessions    chat histories  │                  │                  │    
│                                │                  ▼                  │    
│  rag/                          │            PatchValidator           │    
│    extract.ts  PDF → text   ───┘            (against canvas schema)  │    
│    web.ts      url → text                          │                 │    
│    embed.ts    text → vec                          ▼                 │    
│    search.ts   vec → snippets               { reply, patches[] }     │    
│                                                                      │    
└──────────────┬────────────────────┬───────────────────┬──────────────┘    
               ▼                    ▼                   ▼                   
      ┌─ LLM provider ─┐  ┌─ Embedding model ─┐  ┌─ External fetch ┐ 
      │  OpenAI |      │  │  OpenAI |         │  │  fetch() w/     │ 
      │  Ollama        │  │  bge-small (lcl)  │  │  allowlist      │ 
      └────────────────┘  └───────────────────┘  └─────────────────┘ 
```

The boxes inside Backend are the modules added by phase 3. The browser side is unchanged from [ARCH.md](ARCH.md#system-diagram) except for the addition of the ChatSidebar.

---

## Backend module layout

```
backend/
├── package.json
├── .env.example          # OPENAI_BASE_URL, OPENAI_API_KEY, MODEL,
│                         # EMBED_BASE_URL?, EMBED_MODEL?,
│                         # WEB_FETCH_ALLOWLIST, RATE_LIMIT_*,
│                         # CONTEXT_TTL_MIN, MAX_INPUT_TOKENS
├── src/
│   ├── server.ts         # Fastify bootstrap, CORS, rate-limit, error map
│   ├── config.ts         # env parsing + zod-validated config object
│   ├── routes/
│   │   ├── chat.ts       # POST /api/chat
│   │   ├── upload.ts     # POST /api/upload
│   │   ├── rag.ts        # POST /api/rag
│   │   └── analyze.ts    # POST /api/analyze
│   ├── llm/
│   │   ├── client.ts     # OpenAI-compatible client; streaming + non-stream
│   │   ├── tokens.ts     # tokenizer + budget enforcement
│   │   └── parse.ts      # JSON-mode parsing + Zod validation, fallback
│   ├── prompts/
│   │   ├── system.ts     # base system prompt (role, output contract)
│   │   ├── canvas.ts     # canvas-schema → prompt fragment
│   │   ├── chat.ts       # chat turn assembly
│   │   └── analyze.ts    # pi-check pipeline prompts (per phase, see below)
│   ├── rag/
│   │   ├── extract.ts    # PDF/DOCX/TXT → text + page metadata
│   │   ├── chunk.ts      # text → chunks (page-aware)
│   │   ├── embed.ts      # chunks → vectors (provider-agnostic)
│   │   ├── store.ts      # in-process vector index (hnswlib-node or sqlite-vec)
│   │   ├── web.ts        # URL fetch (allowlist) + readability extract
│   │   └── search.ts     # query → top-k snippets with source attribution
│   ├── context/
│   │   ├── docs.ts       # uploaded-doc store, contextId → DocBundle
│   │   └── sessions.ts   # chat history per session, optional
│   ├── patches/
│   │   ├── schema.ts     # Zod schema for the Patch union
│   │   └── validate.ts   # patch ↔ canvas-schema cross-check
│   ├── providers/        # investor-profile / hypothesis store (file-backed)
│   │   └── profile.ts
│   └── analyze/
│       ├── pipeline.ts   # orchestrates extract → categorize → draft → score
│       └── side_docs.ts  # SWOT, TOWS, 5-Forces, 7-Powers generators
└── test/                 # vitest specs, mocked LLM client
```

---

## Public API

All endpoints are JSON in / JSON out unless noted. Errors return `{ error: { code, message, details? } }` with appropriate HTTP status. CORS is locked to the canvas origin(s) by config.

### `POST /api/chat`

Request:
```ts
{
  canvas: CanvasState,            // current store snapshot (frontend type)
  canvasConfig: CanvasConfig,     // canvas-type schema (cells, scoring)
  history: ChatTurn[],            // prior turns; backend adds new ones
  message: string,                // user input
  contextId?: string,             // uploaded-doc bundle to include
  options?: {
    stream?: boolean,             // SSE if true (default false in v1)
    allowPatches?: boolean,       // default true
    ragSources?: RagSource[],     // ['docs', 'web', 'profile']
  }
}
```

Response (non-streaming):
```ts
{
  reply: string,                  // assistant prose
  patches: Patch[],               // 0+ proposed edits, validated
  citations?: Citation[],         // RAG sources used (doc page, URL, etc.)
  usage: { inputTokens, outputTokens, model }
}
```

Streaming uses SSE with events `delta` (token chunks for `reply`) and `final` (the full envelope above).

### `POST /api/upload`

Multipart upload. Initial file types: `application/pdf`, `text/plain`, `text/markdown`. Returns:
```ts
{
  contextId: string,              // opaque, included in subsequent /api/chat
  doc: { name, pages, chars, mime, indexed: boolean },
  ttlSec: number
}
```
Indexing (chunk + embed) happens synchronously before the response; chat calls referencing `contextId` immediately get RAG access.

### `POST /api/rag`

Direct retrieval — for the UI to preview which snippets the assistant would see, without spending an LLM call:
```ts
// req
{ query: string, contextId?: string, sources: RagSource[], k?: number }
// res
{ snippets: { text, source: Citation, score }[] }
```

### `POST /api/analyze`

Pi-check entry point. Runs the multi-step analyzer pipeline:
```ts
// req
{
  canvas: CanvasState,
  canvasConfig: CanvasConfig,
  contextId: string,              // required: uploaded deck + supporting docs
  mode: 'draft' | 'critique' | 'side-docs',
  options?: { profileId?: string, stream?: boolean }
}
// res — same envelope as /api/chat, with potentially many patches
{ reply, patches, citations, usage, sideDocs? }
```

`sideDocs` is only present for `mode: 'side-docs'`:
```ts
sideDocs: {
  questionsToFill: string[],      // open questions per cell
  swot: { s, w, o, t: string[] },
  tows: { ... },
  fiveForces: { ... },
  sevenPowers: { ... },
  pitchDeckOutline: { sections: { title, bullets }[] }
}
```

Pi-check is layered on top of `/api/chat` plus a fixed prompt sequence; see [Analyze pipeline](#analyze-pipeline) below.

---

## Patch protocol

Patches are the only way the backend influences canvas state. The frontend renders them as a reviewable diff before applying.

```ts
type Patch =
  | { op: 'addCard';    cellId: number; content: string; type?: CardType; rationale?: string; cite?: Citation[] }
  | { op: 'updateCard'; cellId: number; cardIndex: number; content: string; type?: CardType; rationale?: string; cite?: Citation[] }
  | { op: 'removeCard'; cellId: number; cardIndex: number; rationale?: string }
  | { op: 'setAnalysis'; content: string; rationale?: string; cite?: Citation[] }
  | { op: 'setScore';   cellId: number; score: number;     rationale?: string }
  | { op: 'setMeta';    field: 'title' | 'description'; value: string; rationale?: string }
```

**Validation rules** (enforced server-side in `patches/validate.ts` before the response leaves the backend; the frontend revalidates on receive):

- `cellId` must exist in the current `canvasConfig.canvas[].id`.
- `cardIndex` for `update` / `remove` must be in range against the *snapshot the request was made on*. Stale indices are dropped with a warning in `reply`, not auto-rebased.
- `content` is sanitized through the same DOMPurify allow-list the frontend uses (`br, p, i, b, a`) — defense in depth.
- `score` for cells without `score: "yes"` in the config is rejected.
- `type` must be one of the legacy `CardType` values; the LLM is told to use the leading-command form (`:?`, `:!`, `:=`, `:*`, `:-`) which the parser converts to `type` so the frontend round-trip stays 1:1.

**Why these shapes match the existing store actions ([src/state/store.ts](../src/state/store.ts)).** A patch is a description of an action; applying a patch is dispatching the corresponding store action. This keeps the apply-side trivial: no new mutation paths, no new code on the critical path of saving.

**Rationale and citations.** Every patch carries an optional `rationale` (one short sentence the UI shows under the proposed change) and `cite[]` (which RAG snippets backed it). This is what makes patches reviewable rather than mysterious.

---

## Prompt assembly

Each LLM call is built from four ingredients, in order:

1. **System prompt** ([prompts/system.ts](#)). Defines the role ("you are a startup analyst working with a canvas-based framework"), the output contract (always `{ reply, patches }` JSON), and the safety rules (never invent citations, never propose patches outside the provided schema, prefer asking a question over guessing).

2. **Canvas schema fragment** ([prompts/canvas.ts](#)). Generated from `canvasConfig`:
   - For each cell: `id`, `title`, `subtitle`, `description` — these are the prompt slots that tell the LLM what content belongs in that cell.
   - Scoring rules summarized when relevant.
   - Card-type vocabulary (`:?` query, `:!` warning, `:=` analysis, `:*` highlight, `:-` deemphasis).

3. **Canvas state fragment.** The current `CanvasState` rendered as a compact view: `meta.title`, `meta.description`, then per cell `Cell {id} ({title})\n  - <card content>...` truncated per a per-cell budget.

4. **Task fragment.** Either the chat history + user message, or the analyzer step's instruction.

5. **RAG block** (optional). Top-k snippets retrieved for the query, each tagged with a `[citeN]` marker so the LLM can cite them in `cite[]` of patches.

Assembly is budget-aware: `llm/tokens.ts` measures each fragment, and the assembler trims in a fixed order (history → cell content overflow → RAG snippets → canvas description) until it fits `MAX_INPUT_TOKENS`. The trim log is returned to the caller in `usage` for debugging, never silently swallowed.

---

## RAG architecture

The [TODO.md pi-check sketch](future/TODO.md#preseed-analyzer-pi-check) lists three RAG source classes: uploaded documents, external web facts (LinkedIn, company sites, market reports), and investor-specific hypotheses. The backend treats each as a separate `RagSource` with its own retriever, but they share the same embedding model and the same snippet shape.

### `RagSource = 'docs' | 'web' | 'profile'`

| Source    | Lifetime              | Index type             | Retriever                                                |
|-----------|-----------------------|------------------------|----------------------------------------------------------|
| `docs`    | per `contextId` (TTL) | in-process vector      | dense + BM25 hybrid, scoped to the uploaded bundle       |
| `web`     | per request, ephemeral| no index               | live fetch of allowlisted URLs → readability → snippet   |
| `profile` | persistent (file)     | in-process vector      | dense, scoped to the active investor profile             |

### Document RAG (`docs`)

Triggered by `/api/upload`:

1. **Extract.** PDF → text via `unpdf` (preferred — pure JS, no native deps) with per-page boundaries preserved. DOCX via `mammoth`. Text/markdown passes through.
2. **Chunk.** Page-aware sliding window: ~500 tokens, 100 overlap, never crosses a page boundary so citations stay accurate.
3. **Embed.** Through the `EMBED_*` config — defaults to OpenAI `text-embedding-3-small` if unset, but Ollama / `nomic-embed-text` is supported by pointing `EMBED_BASE_URL` at it. Local-first deployments run both LLM and embeddings against Ollama with no external calls.
4. **Index.** In-process via `hnswlib-node` (fast, no extra service). Index lives inside the `DocBundle` and dies with the `contextId` TTL.
5. **Search.** At chat time, the user message + a synthesized "what facts about <cell.title> are needed" query (one per affected cell) drives top-k retrieval. Retrieved snippets are deduplicated and budget-trimmed.

### Web RAG (`web`)

For market reports, company webpages, and competition lookups. Live fetch only — no crawling, no persistent index.

- **Allowlist.** `WEB_FETCH_ALLOWLIST` env var (`linkedin.com,crunchbase.com,...`) gates outbound fetches. Empty allowlist disables web RAG entirely.
- **Extraction.** `@mozilla/readability` + `jsdom` for clean main-content extraction; raw HTML stripped.
- **No background fetching.** Only triggered by explicit `ragSources: ['web']` in a chat request, and only against URLs the user (or a previous assistant turn) has provided. The backend does not "search the web."
- **Caching.** Per-process LRU keyed by URL with a 1-hour TTL — avoids hammering the same page during an analyzer run.

### Profile RAG (`profile`)

Investor-specific knowledge that biases analysis: portfolio history, preferred industries, prior memos, "what we look for" docs.

- **Storage.** Markdown files under `backend/data/profiles/<id>/`. Loaded at startup, indexed in-memory.
- **Selection.** `options.profileId` in `/api/chat` or `/api/analyze` selects which profile is in play.
- **Use.** Snippets surface in the prompt with a `[profile]` cite tag; the LLM is told to weight them as the user's perspective, not as ground truth about the company being analyzed.

This is the closest the system gets to "personalization." It is curated, file-backed, and reviewable — explicitly *not* a finetuned model.

---

## Analyze pipeline (pi-check)

`/api/analyze` is a scripted multi-call run on top of `/api/chat`'s primitives. Three modes:

### `mode: 'draft'` — fill an empty canvas from a deck

```
upload deck ──► contextId ──► analyze({ mode: 'draft' })
                                  │
                                  ▼
       1. categorize: per cell, pull doc snippets relevant to cell.description
       2. draft:      one LLM call per cell with the categorized snippets,
                      yielding { addCard }* patches with cite[]
       3. score:      one call per scored cell, proposing { setScore } with rationale
       4. analysis:   one call summarizing into { setAnalysis } prose
```

Output: a single response envelope with all patches batched, plus a top-level `reply` summarizing what the assistant did and what's missing. The user reviews patches in the existing accept/reject UI.

### `mode: 'critique'` — review an already-filled canvas

For canvases the user has filled themselves. Per cell, the assistant:
- Cross-checks claims against the deck.
- Flags missing information as `:?` query cards (`addCard` patches with `type: 'query'`).
- Proposes `:!` warning cards for contradictions.
- Does not overwrite existing content; only `addCard`.

### `mode: 'side-docs'` — generate analyses

Returns `sideDocs` (SWOT/TOWS/5F/7P/pitch outline/open questions) as structured data. These are *not* canvas patches — they're separate documents the frontend renders in a side-doc viewer. Future work: let the user fold a side-doc back into the canvas via patches.

### Streaming

For all three modes, `options.stream: true` opens an SSE channel and emits `progress` events per pipeline step (`{ step: 'categorize', cellId: 3 }`) and one `patch` event per patch as it's produced. The user sees patches arrive incrementally instead of waiting for the whole pipeline. Final aggregate is sent as `final`. v1 may ship without streaming for analyze and add it once the chat sidebar is stable.

---

## Provider abstraction

Single interface in [llm/client.ts](#):

```ts
interface LlmClient {
  chat(req: ChatRequest, opts?: { stream?: boolean }): Promise<ChatResponse>;
  embed(texts: string[]): Promise<number[][]>;
}
```

Implemented once over the OpenAI Chat Completions + Embeddings APIs. Provider differences (Ollama's lack of a real JSON mode, OpenAI's strict mode, Anthropic-compatible proxies that reorder fields) are handled inside this module, not at call sites.

**JSON-mode handling:**
- OpenAI: `response_format: { type: 'json_object' }` — strict.
- Ollama: `format: 'json'` — best-effort, often produces extra prose around the JSON. Parser strips with a brace-balanced scan.
- Anthropic via proxy: tool-use trick or prompt-only — config flag selects.

**Failure modes:**
- Network/5xx from provider → backend returns `502` with `error.code: 'provider_unavailable'`.
- Parse failure after retry → response includes `{ reply: <raw>, patches: [], parseError: { ... } }`. The user sees the prose; no patches are proposed.
- Token budget exceeded → `400` with the trim log so the user can shorten or split.

---

## Configuration

`backend/.env.example` documents every variable. Effective config is parsed and zod-validated at startup; bad config crashes with a clear message rather than failing at first request.

| Var                       | Default                       | Purpose                                 |
|---------------------------|-------------------------------|-----------------------------------------|
| `OPENAI_BASE_URL`         | `https://api.openai.com/v1`   | Chat + (default) embeddings provider    |
| `OPENAI_API_KEY`          | (required)                    | Provider auth                           |
| `MODEL`                   | `gpt-4o-mini`                 | Chat model                              |
| `EMBED_BASE_URL`          | = `OPENAI_BASE_URL`           | Embeddings provider (split if needed)   |
| `EMBED_MODEL`             | `text-embedding-3-small`      | Embeddings model                        |
| `WEB_FETCH_ALLOWLIST`     | (empty → web RAG disabled)    | Comma-separated host allowlist          |
| `CONTEXT_TTL_MIN`         | `60`                          | Upload bundle TTL                       |
| `MAX_INPUT_TOKENS`        | `48000`                       | Per-request budget cap                  |
| `RATE_LIMIT_RPM`          | `30`                          | Per-IP rate limit                       |
| `CORS_ORIGIN`             | (required)                    | Frontend origin allow-list              |

Frontend reads only one signal: `settings.canvasd.mode` (extended beyond the current `'off'`/`'manual'`) plus a `host`/`port`/`tls` triple — same shape as today's [public/conf/preseed.json:3-8](../public/conf/preseed.json#L3-L8). Extending the existing `canvasd` block (rather than introducing a new key) keeps the canvas-config schema stable.

---

## Safety and UX rails

- **No auto-apply.** Every patch waits for explicit user accept. There is no "auto" mode in v1, and adding one is an open question, not a default.
- **Patch preview shows the diff and the cite.** The user sees old → new content per cell before accepting, plus the snippet(s) the assistant cited.
- **Cite-or-decline.** When a patch's content is a factual claim derived from the deck, the prompt requires a `cite` entry. Patches without cites for factual claims are flagged as "no source" in the UI.
- **Privacy banner on upload.** Uploading a file means it is processed by the configured provider (which may be a third party). The UI states this once before the first upload per session and links to the configured provider's policy.
- **Token-budget reflection.** When the assembler trims content, the response says so in `reply` ("I had to drop pages 8–12 of the deck to fit; ask me about them specifically"). Silent truncation is a banned class of bug.
- **Rate limit.** Per-IP, generous (default 30 rpm). Intended to catch loops and accidental fan-out, not throttle real use.
- **Outbound allowlist.** Web RAG cannot fetch arbitrary URLs. The allowlist is opt-in by config.

---

## Phasing within phase 3

The original phase-3 milestones (M1–M6, archived in [done/PLAN.md](done/PLAN.md#phase-3--backend--chat-sidebar)) hold, but the analyzer features split into substages so the chat sidebar can ship before pi-check is fully landed:

| Substage | Adds                                            | Endpoints                              |
|----------|-------------------------------------------------|----------------------------------------|
| **3a**   | Chat sidebar, chat proxy, patch protocol, accept/reject UI | `/api/chat`                  |
| **3b**   | PDF upload + doc RAG                            | `/api/upload`, `/api/rag` (read-only)  |
| **3c**   | Pi-check `mode: 'draft'` and `'critique'`       | `/api/analyze` (no side-docs)          |
| **3d**   | Side-docs (SWOT/TOWS/5F/7P/pitch outline)       | `/api/analyze` with `mode: 'side-docs'`|
| **3e**   | Web RAG + investor profile RAG                  | `ragSources` in chat/analyze           |

Each substage is independently shippable: 3a alone is a useful chat assistant; 3b adds factual grounding; 3c is the first time the canvas can be drafted from a deck; 3d–3e are progressive enrichment.

---

## Open questions

- **Vector index choice.** `hnswlib-node` (native binding, fast) vs `sqlite-vec` (zero deps, persistable). Default is `hnswlib-node` for speed; revisit if persistence across restarts becomes a need.
- **Streaming UX for analyze.** Show patches arriving live (richer feedback, more UI work) vs. all-at-once with a progress spinner (simpler). Lean toward all-at-once in 3c, add streaming in a later iteration.
- **Side-doc storage.** Side-docs returned by `/api/analyze` are currently view-only on the frontend. Persisting them requires a decision on whether they live in `localStorage` alongside the canvas or a separate slot.
- **Profile management UI.** Profiles are file-backed and edited by hand in v1. A profile editor in the frontend is plausible but not in scope until 3e ships and the format stabilizes.
- **Multi-doc upload.** A single `contextId` currently maps to a single uploaded file. A "case bundle" (deck + LinkedIn export + market report) needs either multiple `contextId`s in one chat request or a `bundle` concept on the backend. Resolved in 3b.
- **Cost ceiling.** No per-session cost cap in v1. Worth adding once usage patterns are observable.

---

## Appendix A — Stack choice: TypeScript vs. Python vs. others

This document specifies Node + TypeScript + Fastify. That choice is neither obvious nor forced; most of the backend's work (PDF extraction, embeddings, vector search, prompt assembly) has a stronger ecosystem in Python. The decision came down to the project's specific shape — one developer, a TypeScript frontend, and a patch protocol that wants to be validated identically on both sides of the wire. This appendix records the tradeoffs so that a future reader (or a future maintainer considering a rewrite) can re-run the decision against changed circumstances.

### Decision criteria

What the backend actually does, ranked by weight in the choice:

1. **Share the patch schema with the frontend.** The Zod schema in [patches/schema.ts](#) is the contract between client and server. Re-authoring it in a different language creates drift risk.
2. **Extract text from PDFs reliably.** The first non-trivial thing a deck upload needs.
3. **Chunk, embed, and search vectors.** Core RAG loop.
4. **Stream tokens through an SSE channel.** Chat UX depends on this feeling responsive.
5. **Stay operationally small.** One-dev project; every new language, runtime, or toolchain added is a tax paid forever.
6. **Leave room for growth.** If pi-check grows into batch evals, finetuning, or custom retrieval math, which ecosystem pays off?

No stack wins on all six. The ranking above is what tipped Node/TS.

### TypeScript + Node + Fastify (the chosen stack)

**Pros:**

- **Literal type sharing with the frontend.** Zod schemas, `Patch`, `CanvasState`, `CanvasConfig`, `CardType` import unchanged from the canvas repo (or from a tiny shared package). The client parses what the server sends with the same validator the server wrote it with. This is the strongest argument; the patch protocol is the heart of the integration and its schema lives in exactly one place.
- **Identical sanitization.** DOMPurify runs both sides; the server-side defense-in-depth sanitize pass uses the same allow-list the frontend commits with.
- **One-toolchain project.** Same `tsc`, same Vitest, same ESLint, same editor setup as the frontend. The developer context-switches between frontend and backend in the same language.
- **OpenAI-compat ergonomics.** The `fetch`-based client is ~50 lines; SSE parsing is straightforward. JSON mode, streaming, and tool-use all work.
- **Fast enough.** Single-user backend is latency-bound on LLM calls, not CPU-bound. Node keeps up with any reasonable throughput this project will see.
- **Deployment simplicity.** `node dist/server.js` or a tiny Dockerfile. No virtualenv, no wheel caches, no Python-version drift.

**Cons:**

- **PDF extraction is the weakest link.** `pdfjs-dist` and `unpdf` cover clean machine-generated PDFs well, but scanned or complex decks benefit from the heavier Python tools (see below). Fallback: shell out to a Python PDF tool from Node, which negates much of the "one-toolchain" argument.
- **Thinner ML/RAG ecosystem.** `hnswlib-node`, `@xenova/transformers`, `minisearch` cover v1. Anything deeper (re-rankers, custom tokenizers, evaluation harnesses, small local models not available in ONNX format) is a harder Node lift than a Python one.
- **No native tensor library.** If retrieval math grows (cross-encoder re-ranking, hybrid-search learning-to-rank, local fine-grained scoring models), Node has no numpy-equivalent. Workarounds (WASM builds, ONNX runtime) exist but are friction.
- **Smaller pool of RAG library choices.** Langchain.js and llamaindex-ts exist but lag their Python counterparts. Not a dealbreaker — this design intentionally avoids those frameworks — but it narrows options if a need emerges.

### Python (FastAPI or Litestar)

**Pros:**

- **Best-in-class PDF extraction.** `pymupdf` (fitz), `pdfplumber`, `unstructured`, `pypdf` — multiple mature options, each with clear strengths (layout preservation, table extraction, OCR bridges). A complex deck extracts more cleanly here than anywhere else.
- **The RAG/ML ecosystem.** `sentence-transformers`, `transformers`, `instructor`, `langchain`, `llamaindex`, `haystack`, `dspy`, `guidance` — whatever the design evolves toward, Python probably has a library. The frontend-only design's `@xenova/transformers` is a browser port of a Python-native project; Python gets the original.
- **Structured outputs with Pydantic.** `instructor` (Pydantic + OpenAI) is arguably the cleanest structured-output experience in any language. A `Patch` as a Pydantic discriminated union is idiomatic and validates with the same ergonomics as Zod.
- **Growth path.** If pi-check ever grows into evals, finetuning, scoring-model training, or anything with numpy/pandas in the critical path, the project is already in the right ecosystem. The frontier of LLM application tooling continues to appear in Python first.
- **Local-model hosting.** If the backend ever wants to host a model itself (vLLM, llama-cpp-python, transformers), Python is the native path. Node's options (node-llama-cpp, ollama-js as client) are fine but thinner.
- **FastAPI is excellent.** Type-hinted handlers, auto-generated OpenAPI, async I/O, Pydantic integration — comparable to Fastify's ergonomics, arguably better on the docs/validation axis.

**Cons:**

- **Two-language project.** The patch schema has to live twice: once as Zod in the frontend, once as Pydantic in the backend. Keeping them in sync is a code-review discipline problem. Code generation (Pydantic → TS via `datamodel-code-generator` + converters, or OpenAPI → TS) works but adds a build step and a source-of-truth question.
- **No code sharing.** Sanitization, chunking, prompt-schema fragments — all duplicated or re-implemented.
- **Heavier ops.** Virtualenv / `uv` / `poetry`, Python version pinning, separate lint/format toolchain (ruff + mypy), different CI shape. Each of these is small in isolation; together they are real.
- **Cold starts are slower.** Python-on-Lambda, FastAPI-on-Cloud-Run — all measurably slower to cold-start than Node equivalents. Doesn't matter for a long-running single-user backend; matters if deployment ever goes serverless.
- **Streaming SSE is workable but less idiomatic.** FastAPI's `StreamingResponse` does the job; it's not as clean as Node's `reply.raw.write`.
- **Dependency weight.** `pymupdf` alone is ~50 MB; a Python RAG container easily hits 500 MB. Node containers are typically under 200 MB.

### Rust (Axum or Actix)

**Pros:**

- **Fast, small, safe.** One binary, minimal memory, strong type system.
- **Great for high-throughput.** Not the bottleneck here, but "free performance" is not nothing.
- **Growing ML story.** `candle` (Hugging Face's Rust ML framework), `ort` (ONNX Runtime bindings), `tokenizers` (native Rust). Not at Python parity but trending.

**Cons:**

- **Smallest relevant ecosystem.** PDF extraction (`lopdf`, `pdf-extract`) lags Python and TS. Structured-output libraries exist (`serde` + hand-rolled validators) but nothing at Pydantic/Zod polish.
- **Development speed is the bottleneck, not runtime speed.** Small feature-in-progress codebases pay a tax in compile times and borrow-checker ceremony for performance the project will not use.
- **No type sharing with frontend.** `ts-rs` or similar tools bridge Rust structs to TS, but that's a build step and another source-of-truth question.
- **Overkill.** Single-user backend, latency-bound on LLM calls. Rust's wins are invisible here.

**When Rust would be the right call:** if the project ever grows into a multi-tenant service with tight latency SLOs and a stable feature set. Not phase 3.

### Go (Gin / Echo / Chi)

**Pros:**

- **Simple and fast.** Small binary, good concurrency, clean stdlib.
- **Operational ergonomics.** Single binary, easy cross-compile, easy deploy.
- **Growing LLM tooling.** `langchaingo` exists; OpenAI-compat clients are straightforward.

**Cons:**

- **Generics are young.** Writing a clean discriminated-union `Patch` validator feels worse than in TS, Python, or Rust.
- **Weakest PDF and RAG story of the mainstream options.** Existing libs are usable but not battle-tested.
- **No type sharing with frontend.** Same build-step problem as Python/Rust.
- **No compelling reason to pick this** over TS for this project's shape.

### Deno / Bun (alt TypeScript runtimes)

**Pros:**

- **Same ecosystem as the chosen Node path**, with advantages per runtime: Deno ships TS natively with a permissions model; Bun has near-instant startup and a faster package manager.
- **Drop-in for most of the design.** The `fetch`-based LLM client doesn't care; Fastify might; routing could be rewritten against each runtime's native HTTP server.

**Cons:**

- **Maturity gap in some deps.** `hnswlib-node` is a native binding; compatibility varies. `@xenova/transformers` works on all three.
- **Operator unfamiliarity.** Adds a small tax to deployment if the hosting story is not already Deno/Bun-ready.

**When to consider:** if cold-start or startup time becomes a real concern, Bun is worth a look. Not phase-3 urgent.

### Edge / serverless-first (Cloudflare Workers, Vercel Edge, Deno Deploy)

**Pros:**

- **Zero-ops.** Fits the frontend-first ethos of this project; deploys in seconds.
- **TS-native.** Workers is TypeScript in practice.
- **Already in the architecture.** The [frontend-only design's](../future/ARCH_FE.md#the-cors-problem) CORS proxy for cloud LLM providers is a Cloudflare Worker. Extending that into a thin "backend" is natural.
- **Global latency.** Edge-local execution.

**Cons:**

- **Memory and time caps.** Workers: 128 MB memory, 30s CPU on paid plans. PDF extraction of a large deck + embedding + index loading can blow past these.
- **Stateful caches are awkward.** Uploaded-doc TTL store wants in-process memory; edge platforms force you into KV / R2 / D1 / Durable Objects for anything cross-request. Each is a new abstraction.
- **Library compatibility.** Native modules (`hnswlib-node`) don't run. `pdfjs-dist` works but slowly. `@xenova/transformers` works but the WASM model load eats into the memory budget.
- **Vendor lock-in.** Porting off Workers into a long-running server is non-trivial once Durable Objects or KV get involved.

**When this is the right call:** if RAG ever moves fully to the client and the backend role shrinks to "authenticated proxy + occasional LLM call." Not a fit for the pi-check pipeline as specified.

### Summary matrix

Weights reflect this project's shape, not absolute merit.

| Criterion (weight)                       | TS/Node     | Python      | Rust        | Go          | Edge        |
|------------------------------------------|-------------|-------------|-------------|-------------|-------------|
| Type-share with frontend (high)          | **best**    | poor        | poor        | poor        | best        |
| PDF extraction quality (high)            | ok          | **best**    | weak        | weak        | ok          |
| RAG library ecosystem (med)              | ok          | **best**    | weak        | weak        | ok          |
| Structured-output ergonomics (high)      | **best**    | **best**    | ok          | weak        | best        |
| Streaming SSE ergonomics (med)           | **best**    | ok          | ok          | ok          | good        |
| Operational simplicity (med)             | **best**    | ok          | good        | good        | **best**    |
| Dev velocity for small team (high)       | **best**    | good        | poor        | good        | good        |
| Growth path (ML / evals / finetuning) (low) | ok       | **best**    | ok          | weak        | poor        |
| Cold-start / deploy story (low)          | good        | ok          | **best**    | **best**    | **best**    |

TypeScript loses on two cells (PDF extraction, growth-path ML). Both are real, neither is in the critical path for phase 3.

### When to reconsider

Concrete triggers that should prompt revisiting this decision:

- **PDF extraction quality becomes a blocker.** If `unpdf` / `pdfjs-dist` misread a material fraction of real decks and a Python tool (likely `pymupdf`) reads them correctly, a Python extraction *service* called from the Node backend is the cheapest fix — not a full rewrite.
- **Retrieval evolves beyond k-NN.** Cross-encoder re-ranking, learning-to-rank, or custom scoring models tip the ecosystem weight toward Python. A Python *sidecar* is still better than a rewrite; wholesale migration is only justified if multiple substages move that way.
- **The project grows multi-user and SLO-bound.** Not a Python trigger — a Rust or Go trigger — and well out of phase-3 scope.
- **Cost containment requires edge execution.** Unlikely given the single-user scope.

The pattern across all of these: **add a specialist process for a specialist job, don't rewrite the whole backend.** TS/Node stays the right home for the orchestration, the type-shared patch protocol, and the chat/streaming path. If a specialist job emerges, shell out.

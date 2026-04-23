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
- **Structured-first, prose-fallback.** The LLM is asked to emit `{ reply, patches }` JSON validated by Pydantic. If parsing fails, the reply is surfaced as plain text and the user is told no patches were proposed.
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
┌── Backend (FastAPI, Python) ─────────────────────────────────────────┐    
│                                                                      │    
│  routes/                                                             │    
│    chat.py       ─┐                                                  │    
│    upload.py     ─┤                                                  │    
│    rag.py        ─┼──►  PromptAssembler ──►  LlmClient ──►  Provider │    
│    analyze.py    ─┘            ▲                  │                  │    
│                                │                  ▼                  │    
│  context/      (TTL store)     │            ResponseParser           │    
│    docs        uploaded files  │          (Pydantic: reply, patches) │    
│    sessions    chat histories  │                  │                  │    
│                                │                  ▼                  │    
│  rag/                          │            PatchValidator           │    
│    extract.py  PDF → text   ───┘            (against canvas schema)  │    
│    web.py      url → text                          │                 │    
│    embed.py    text → vec                          ▼                 │    
│    search.py   vec → snippets               { reply, patches[] }     │    
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
├── pyproject.toml        # project metadata, deps (managed with uv / pip / poetry)
├── .env.example          # OPENAI_BASE_URL, OPENAI_API_KEY, MODEL,
│                         # EMBED_BASE_URL?, EMBED_MODEL?,
│                         # WEB_FETCH_ALLOWLIST, RATE_LIMIT_*,
│                         # CONTEXT_TTL_MIN, MAX_INPUT_TOKENS
├── src/canvas_ai/
│   ├── server.py         # FastAPI app, CORS middleware, rate-limit, exception handlers
│   ├── config.py         # pydantic-settings (env parsing + validation)
│   ├── routes/
│   │   ├── chat.py       # POST /api/chat
│   │   ├── upload.py     # POST /api/upload
│   │   ├── rag.py        # POST /api/rag
│   │   └── analyze.py    # POST /api/analyze
│   ├── llm/
│   │   ├── client.py     # OpenAI-compatible client; streaming + non-stream
│   │   ├── tokens.py     # tokenizer (tiktoken) + budget enforcement
│   │   └── parse.py      # JSON-mode parsing + Pydantic validation, fallback
│   ├── prompts/
│   │   ├── system.py     # base system prompt (role, output contract)
│   │   ├── canvas.py     # canvas-schema → prompt fragment
│   │   ├── chat.py       # chat turn assembly
│   │   └── analyze.py    # pi-check pipeline prompts (per phase, see below)
│   ├── rag/
│   │   ├── extract.py    # PDF (pdfplumber / pymupdf) / DOCX / TXT → text + page metadata
│   │   ├── chunk.py      # text → chunks (page-aware)
│   │   ├── embed.py      # chunks → vectors (provider-agnostic)
│   │   ├── store.py      # in-process vector index (hnswlib or chromadb)
│   │   ├── web.py        # URL fetch (allowlist) + trafilatura / readability extract
│   │   └── search.py     # query → top-k snippets with source attribution
│   ├── context/
│   │   ├── docs.py       # uploaded-doc store, contextId → DocBundle
│   │   └── sessions.py   # chat history per session, optional
│   ├── patches/
│   │   ├── schema.py     # Pydantic discriminated union for Patch
│   │   └── validate.py   # patch ↔ canvas-schema cross-check
│   ├── providers/        # investor-profile / hypothesis store (file-backed)
│   │   └── profile.py
│   └── analyze/
│       ├── pipeline.py   # orchestrates extract → categorize → draft → score
│       └── side_docs.py  # SWOT, TOWS, 5-Forces, 7-Powers generators
└── tests/                # pytest specs, mocked LLM client
```

Tooling: `uv` for dependency/env management (alternative: `poetry` or plain `pip` + `venv`), `ruff` for lint and format, `mypy` or `pyright` for static typing, `pytest` for tests, `uvicorn` as the ASGI server.

---

## Public API

All endpoints are JSON in / JSON out unless noted. Errors return `{ error: { code, message, details? } }` with appropriate HTTP status. CORS is locked to the canvas origin(s) by config.

Request / response shapes below are shown in TypeScript — they are the wire contract, and the frontend already has these types. The backend defines the equivalent Pydantic models in `patches/schema.py` and the route-handler signatures; `schema.py` is the single source of truth on the server side. Keeping the two in sync is a code-review discipline, aided optionally by a small codegen step (e.g. `datamodel-code-generator` from a shared JSON Schema export) — see [design/STACK.md](design/STACK.md).

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

**Validation rules** (enforced server-side in `patches/validate.py` before the response leaves the backend; the frontend revalidates on receive):

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

1. **System prompt** ([prompts/system.py](#)). Defines the role ("you are a startup analyst working with a canvas-based framework"), the output contract (always `{ reply, patches }` JSON), and the safety rules (never invent citations, never propose patches outside the provided schema, prefer asking a question over guessing).

2. **Canvas schema fragment** ([prompts/canvas.py](#)). Generated from `canvasConfig`:
   - For each cell: `id`, `title`, `subtitle`, `description` — these are the prompt slots that tell the LLM what content belongs in that cell.
   - Scoring rules summarized when relevant.
   - Card-type vocabulary (`:?` query, `:!` warning, `:=` analysis, `:*` highlight, `:-` deemphasis).

3. **Canvas state fragment.** The current `CanvasState` rendered as a compact view: `meta.title`, `meta.description`, then per cell `Cell {id} ({title})\n  - <card content>...` truncated per a per-cell budget.

4. **Task fragment.** Either the chat history + user message, or the analyzer step's instruction.

5. **RAG block** (optional). Top-k snippets retrieved for the query, each tagged with a `[citeN]` marker so the LLM can cite them in `cite[]` of patches.

Assembly is budget-aware: `llm/tokens.py` measures each fragment with `tiktoken` (OpenAI models) or a model-specific tokenizer, and the assembler trims in a fixed order (history → cell content overflow → RAG snippets → canvas description) until it fits `MAX_INPUT_TOKENS`. The trim log is returned to the caller in `usage` for debugging, never silently swallowed.

---

## RAG architecture

The [TODO.md pi-check sketch](design/TODO.md#preseed-analyzer-pi-check) lists three RAG source classes: uploaded documents, external web facts (LinkedIn, company sites, market reports), and investor-specific hypotheses. The backend treats each as a separate `RagSource` with its own retriever, but they share the same embedding model and the same snippet shape.

### `RagSource = 'docs' | 'web' | 'profile'`

| Source    | Lifetime              | Index type             | Retriever                                                |
|-----------|-----------------------|------------------------|----------------------------------------------------------|
| `docs`    | per `contextId` (TTL) | in-process vector      | dense + BM25 hybrid, scoped to the uploaded bundle       |
| `web`     | per request, ephemeral| no index               | live fetch of allowlisted URLs → readability → snippet   |
| `profile` | persistent (file)     | in-process vector      | dense, scoped to the active investor profile             |

### Document RAG (`docs`)

Triggered by `/api/upload`:

1. **Extract.** PDF → text via `pdfplumber` (default, MIT-licensed, good layout + table handling) or `pymupdf` (faster, AGPL — opt-in), with per-page boundaries preserved. DOCX via `python-docx`. Text/markdown passes through. `unstructured` is available as an opt-in for mixed-format decks.
2. **Chunk.** Page-aware sliding window: ~500 tokens, 100 overlap, never crosses a page boundary so citations stay accurate.
3. **Embed.** Through the `EMBED_*` config — defaults to OpenAI `text-embedding-3-small` if unset, but Ollama / `nomic-embed-text` is supported by pointing `EMBED_BASE_URL` at it. Local-first deployments run both LLM and embeddings against Ollama with no external calls. `sentence-transformers` is available as a pure-Python fallback (e.g. `BAAI/bge-small-en-v1.5`) when no embedding endpoint is reachable.
4. **Index.** In-process via `hnswlib` (Python bindings; fast, no extra service) or `chromadb` (persistable, more features, heavier). Index lives inside the `DocBundle` and dies with the `contextId` TTL.
5. **Search.** At chat time, the user message + a synthesized "what facts about <cell.title> are needed" query (one per affected cell) drives top-k retrieval. A `rank_bm25` keyword pass runs alongside for rare-term recall. Retrieved snippets are deduplicated and budget-trimmed.

### Web RAG (`web`)

For market reports, company webpages, and competition lookups. Live fetch only — no crawling, no persistent index.

- **Allowlist.** `WEB_FETCH_ALLOWLIST` env var (`linkedin.com,crunchbase.com,...`) gates outbound fetches. Empty allowlist disables web RAG entirely.
- **Extraction.** `trafilatura` (primary — handles varied layouts well and strips boilerplate) with `readability-lxml` as a fallback. Raw HTML stripped.
- **Fetching.** `httpx` async client with per-request timeout and retry caps.
- **No background fetching.** Only triggered by explicit `ragSources: ['web']` in a chat request, and only against URLs the user (or a previous assistant turn) has provided. The backend does not "search the web."
- **Caching.** Per-process LRU (via `cachetools`) keyed by URL with a 1-hour TTL — avoids hammering the same page during an analyzer run.

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

Single interface in [llm/client.py](#):

```python
class LlmClient(Protocol):
    async def chat(self, req: ChatRequest, *, stream: bool = False) -> ChatResponse: ...
    async def embed(self, texts: list[str]) -> list[list[float]]: ...
```

Implemented once over the OpenAI Chat Completions + Embeddings APIs using the official `openai` Python SDK (the async client works against any OpenAI-compatible base URL, including Ollama and LM Studio). Provider differences (Ollama's lack of a real JSON mode, OpenAI's strict mode, Anthropic-compatible proxies that reorder fields) are handled inside this module, not at call sites.

**JSON-mode handling:**
- OpenAI: `response_format={"type": "json_object"}` — strict.
- Ollama: `extra_body={"format": "json"}` — best-effort, often produces extra prose around the JSON. Parser strips with a brace-balanced scan.
- Anthropic via proxy: tool-use trick or prompt-only — config flag selects.
- Optional: `instructor` can wrap the client for Pydantic-native structured outputs when the model supports tool-use.

**Failure modes:**
- Network/5xx from provider → backend returns `502` with `error.code: 'provider_unavailable'`.
- Parse failure after retry → response includes `{ reply: <raw>, patches: [], parseError: { ... } }`. The user sees the prose; no patches are proposed.
- Token budget exceeded → `400` with the trim log so the user can shorten or split.

---

## Configuration

`backend/.env.example` documents every variable. Effective config is parsed and validated by `pydantic-settings` at startup; bad config crashes with a clear message rather than failing at first request.

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

- **Vector index choice.** `hnswlib` (Python bindings; fast, in-memory only) vs `chromadb` (persistable, more features, heavier) vs `faiss` (Meta's library; fastest but C++ binding hassle). Default is `hnswlib` for speed and zero ops; revisit if persistence across restarts becomes a need.
- **Streaming UX for analyze.** Show patches arriving live (richer feedback, more UI work) vs. all-at-once with a progress spinner (simpler). Lean toward all-at-once in 3c, add streaming in a later iteration.
- **Side-doc storage.** Side-docs returned by `/api/analyze` are currently view-only on the frontend. Persisting them requires a decision on whether they live in `localStorage` alongside the canvas or a separate slot.
- **Profile management UI.** Profiles are file-backed and edited by hand in v1. A profile editor in the frontend is plausible but not in scope until 3e ships and the format stabilizes.
- **Multi-doc upload.** A single `contextId` currently maps to a single uploaded file. A "case bundle" (deck + LinkedIn export + market report) needs either multiple `contextId`s in one chat request or a `bundle` concept on the backend. Resolved in 3b.
- **Cost ceiling.** No per-session cost cap in v1. Worth adding once usage patterns are observable.

---

## Stack choice

See [design/STACK.md](design/STACK.md) for the full pros/cons comparison of Python vs. TypeScript vs. Rust / Go / edge runtimes, the weighted decision matrix, and the triggers that would prompt revisiting the choice.

Short version: Python wins on the three highest-weighted criteria (PDF extraction quality, RAG library ecosystem, growth path toward evals and scoring calibration). TypeScript would win on schema-sharing with the frontend; that advantage is real but ranks below the extraction/RAG work that dominates pi-check. Mitigation for the schema-drift cost: JSON-Schema export from Pydantic plus TS codegen from the JSON Schema, kept in CI — see STACK.md.

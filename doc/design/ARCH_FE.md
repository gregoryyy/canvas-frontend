# Frontend-Only AI Architecture

Alternative phase-3 design: AI assistance and (lightweight) RAG implemented **entirely in the browser**, with no canvas-specific backend. The user brings their own LLM provider — Ollama on localhost, an OpenAI-compatible API with their own key, or any compatible endpoint — and configures it through a settings page in the canvas itself.

This document is a sibling of [ARCH_AI.md](../ARCH_AI.md). The two are mutually exclusive at the architectural level but share the **patch protocol** ([ARCH_AI.md#patch-protocol](../ARCH_AI.md#patch-protocol)) and the **prompt-assembly approach** ([ARCH_AI.md#prompt-assembly](../ARCH_AI.md#prompt-assembly)) — those are content concerns, not deployment concerns. Read [ARCH_AI.md](../ARCH_AI.md) first; this doc focuses only on what changes when the backend goes away.

The viability question — *does this work given the canvas is already frontend-only with `localStorage` persistence?* — is answered at the end ([Viability assessment](#viability-assessment)). Short version: **yes for local-LLM users, conditionally yes for cloud users (CORS makes them deploy a tiny proxy), and structurally consistent with the existing app.**

---

## Scope

What this design adds, all in the browser:

1. **Provider configuration page.** Users add and manage one or more LLM providers (name, base URL, API key, capability descriptor, default model). Persisted to `localStorage` alongside the canvas.
2. **In-browser chat sidebar.** Same UX as ARCH_AI.md's sidebar; the request just goes directly from the browser to the configured provider URL instead of through a backend.
3. **In-browser RAG.** PDF/text upload extracted in the browser, chunked and embedded with either the configured provider's embedding model or an in-browser model (Transformers.js), indexed in a browser-side vector store, queried at chat time.
4. **Patch protocol** identical to ARCH_AI.md — applied directly to the existing Zustand-style store.

What this design **deliberately does not** include:

- **No web RAG** of third-party sites (LinkedIn, Crunchbase, market reports). The browser cannot fetch those due to their CORS policies, and a public CORS proxy is not a defensible default. Users who want web-derived facts paste content in manually.
- **No server-side rate limiting, no shared cost cap, no per-IP throttle.** Users own their own keys and their own bills.
- **No cross-device sync.** Provider configs and RAG indexes live in `localStorage`, same as the canvas itself.

---

## Principles

Same ground rules as the rest of the app, plus three that are specific to the BYO-provider model:

- **User owns the keys, and the bills.** Credentials never leave the user's browser. No relay server, no telemetry pipe.
- **Honest about CORS.** The app surfaces CORS failures as actionable errors with provider-specific instructions, not as opaque network errors. See [The CORS problem](#the-cors-problem).
- **Capability-described providers, not assumed.** The app does not assume a model supports JSON mode, function calling, tool use, embeddings, or vision. The provider config carries an explicit capability descriptor, and the chat path uses only what's declared.
- **Local-first really means local.** With Ollama (or LM Studio / Jan / vLLM in OpenAI-compatible mode) plus an in-browser embedding model, the app runs end-to-end with **no outbound network calls at all** beyond `localhost`. This is a real privacy property, not a marketing one.

The 1:1 equivalence rule from phases 1–2 still applies to the existing canvas surface. Chat and AI features are additive and only active when at least one provider is configured.

---

## System diagram

```
┌──────────────────────────────── Browser ────────────────────────────────┐
│                                                                         │
│  ┌── React UI ───────────────────────────┐  ┌── ChatSidebar ────────┐   │
│  │  PreCanvas / Canvas / PostCanvas      │  │  message list         │   │
│  │  Controls                             │  │  input + upload       │   │
│  │  SettingsPage  (NEW: providers, RAG)  │  │  patch accept / reject│   │
│  └──────────────────┬────────────────────┘  └─────────┬─────────────┘   │
│                     │ actions                         │ apply patches   │
│                     ▼                                 ▼                 │
│  ┌── Store (Zustand) ────────────────────────────────────────────────┐  │
│  │   { meta, canvas, analysis,                                       │  │
│  │     ai: { providers, activeProviderId, ragBundles, chatSessions } │  │
│  └────┬─────────────┬─────────────────────────────▲──────────────────┘  │
│       │ canvas      │ ai config + chat history    │                     │
│       ▼             ▼                             │                     │
│  ┌ localStorage ──────────────────────────────────┐                     │
│  │ preseedcanvas       (existing)                 │                     │
│  │ canvas.ai.config    (NEW)                      │                     │
│  │ canvas.ai.bundles   (NEW: doc text + chunks)   │                     │
│  │ canvas.ai.vectors   (NEW: embedding vectors)   │                     │
│  │ canvas.ai.chats     (NEW: chat histories)      │                     │
│  └────────────────────────────────────────────────┘                     │
│                                                                         │
│  ┌── ai/ (browser modules) ──────────────────────────────────────────┐  │
│  │  providers/   client (OpenAI-compatible fetch wrapper)            │  │
│  │               capabilities (declared per-provider)                │  │
│  │  prompts/     system + canvas-schema + state + RAG fragments      │  │
│  │  patches/     Zod schema + validator (mirrors ARCH_AI.md Pydantic)│  │
│  │  rag/         extract (PDF.js) → chunk → embed → index → search   │  │
│  │  embed/       provider | transformers.js (in-browser)             │  │
│  │  parse/       JSON-mode + brace-balanced fallback                 │  │
│  └────────────────────┬─────────────────────────────────┬────────────┘  │
└───────────────────────┼─────────────────────────────────┼───────────────┘
                        │ direct fetch                    │ direct fetch
                        ▼                                 ▼
              ┌─ Local LLM ──────┐               ┌─ Cloud LLM ─────────┐
              │ Ollama           │               │ OpenAI / Anthropic  │
              │ localhost:11434  │               │  via user-deployed  │
              │ (OLLAMA_ORIGINS) │               │  CORS proxy         │
              │ LM Studio / Jan  │               │ (Cloudflare Worker, │
              │ /v1 endpoints    │               │  Vercel Edge, etc.) │
              └──────────────────┘               └─────────────────────┘
```

The browser does everything: prompt assembly, RAG retrieval, JSON parsing, patch validation. The "backend" of ARCH_AI.md becomes a set of frontend modules. The only network traffic is from the browser to the user's chosen LLM endpoint.

---

## Module layout (additions to existing src/)

```
src/
├── components/
│   ├── (existing)
│   ├── ChatSidebar.tsx           # collapsible right panel
│   ├── PatchPreview.tsx          # diff + accept/reject UI
│   ├── SettingsPage.tsx          # provider + RAG config (NEW: routed view)
│   └── settings/
│       ├── ProviderForm.tsx      # add / edit one provider
│       ├── ProviderList.tsx
│       ├── CapabilityEditor.tsx  # check-the-boxes capability descriptor
│       └── CorsTroubleshooter.tsx# inline help for CORS errors
├── ai/
│   ├── client.ts                 # OpenAI-compatible fetch wrapper
│   ├── capabilities.ts           # Capability type, defaults, presets
│   ├── prompts/
│   │   ├── system.ts
│   │   ├── canvas.ts
│   │   ├── chat.ts
│   │   └── analyze.ts
│   ├── patches/
│   │   ├── schema.ts             # Zod; same protocol as ARCH_AI.md (Pydantic on backend)
│   │   └── validate.ts
│   ├── parse.ts                  # JSON-mode + brace-balanced fallback
│   ├── tokens.ts                 # tiktoken-lite (browser build) or heuristic
│   ├── rag/
│   │   ├── extract.ts            # PDF.js / mammoth-browser / text passthrough
│   │   ├── chunk.ts
│   │   ├── embed.ts              # provider-route OR transformers.js route
│   │   ├── store.ts              # browser vector index (see below)
│   │   └── search.ts
│   └── analyze/
│       └── pipeline.ts           # pi-check draft / critique / side-docs
├── state/
│   ├── (existing)
│   └── ai.ts                     # provider/session/RAG slice of the store
└── hooks/
    └── (existing)
```

No new top-level dependencies are forced; the heavy ones (`pdfjs-dist`, `@xenova/transformers`, `hnswlib-wasm`) load lazily on first use so the canvas-only path keeps its current bundle size.

---

## Provider model

A provider is a user-supplied description of an OpenAI-compatible endpoint plus the capabilities the user attests it supports. The app uses only declared capabilities — never feature-detects in production, because guessing wrong against an unfamiliar local model is a worse UX than an honest "your model doesn't support JSON mode; falling back to prose."

```ts
interface Provider {
  id: string;                       // uuid, generated on add
  name: string;                     // user-facing label, e.g. "Ollama (local)"
  baseUrl: string;                  // e.g. http://localhost:11434/v1
  apiKey?: string;                  // omitted for keyless local endpoints
  defaultModel: string;             // e.g. "llama3.1:8b" or "gpt-4o-mini"
  embedModel?: string;              // optional; if absent, app uses in-browser
  capabilities: Capabilities;
  notes?: string;                   // free-text; surfaced in the picker
}

interface Capabilities {
  chat: true;                       // assumed; required to be a usable provider
  jsonMode: 'strict' | 'best-effort' | 'none';
  streaming: boolean;
  embeddings: boolean;              // /v1/embeddings available
  vision: boolean;                  // not used in v1; reserved
  toolUse: boolean;                 // not used in v1; reserved
  contextTokens: number;            // user-declared budget cap
}
```

**Presets** make adding common setups a one-click affair:
- **Ollama (local).** `baseUrl: http://localhost:11434/v1`, no key, JSON mode `best-effort`, embeddings on, in-browser embed fallback if model lacks `/embeddings`.
- **LM Studio (local).** Same shape, default port `1234`.
- **OpenAI.** `baseUrl: https://api.openai.com/v1`, key required, JSON mode `strict`, embeddings on. **Flagged with a CORS warning at save time** (see below) — works only via a user-deployed proxy.
- **Anthropic via OpenAI-compat proxy.** Documented as a third-party option; the app does not ship a built-in Anthropic client because Anthropic is not OpenAI-compatible natively.
- **Custom backend.** Pointed at a deployment of [ARCH_AI.md](../ARCH_AI.md)'s backend, for users who want server-side RAG. The frontend treats it as one more OpenAI-compatible provider, just with extra endpoints (`/api/upload`, `/api/analyze`) it can call when present. **This makes the two architectures interoperable, not exclusive.**

The user can configure multiple providers and switch between them per chat session (e.g. fast local Ollama for rough drafts, OpenAI for the final analysis).

---

## Configuration page

A new route in the canvas — surfaced from the Controls bar as a "Settings" button — opens `SettingsPage`. It is plain React (no new routing library; a single hash route or modal works) so it does not destabilize the existing single-page layout.

Sections:

1. **Providers.** List of configured providers with edit/delete. "Add provider" opens `ProviderForm` with the preset picker. Each row shows a green/yellow/red dot for the result of a "Test connection" probe.
2. **Capabilities** (per provider). Checkboxes: streaming, JSON mode (strict/best-effort/none), embeddings, vision, tool use. Numeric: context window. Defaults are filled by the preset; users override per their model.
3. **RAG.** Embedding source: provider's `/v1/embeddings` endpoint, or in-browser (`@xenova/transformers` with `bge-small-en-v1.5` or similar). Chunk size, overlap, top-k. Storage size budget (warns when `localStorage` headroom is low).
4. **Privacy.** A clear statement of what leaves the browser (canvas snapshots and uploaded text → configured provider URL; nothing else). A button to wipe all `canvas.ai.*` keys.
5. **CORS troubleshooter.** Live diagnostic for the active provider — see below.

Form validation is strict: required fields, URL format, numeric ranges, an explicit "I understand this stores my key in localStorage" checkbox before any cloud-provider entry can be saved.

---

## Storage layout

All AI state is namespaced under `canvas.ai.*` so it is trivially separable from the existing `preseedcanvas` key:

| Key                   | Contents                                                  | Sensitivity |
|-----------------------|-----------------------------------------------------------|-------------|
| `canvas.ai.config`    | `{ providers: Provider[], activeProviderId, rag: RagSettings }` | API keys here |
| `canvas.ai.bundles`   | `{ [contextId]: { name, mime, pages, chunks: Chunk[] } }` | Document text |
| `canvas.ai.vectors`   | `{ [contextId]: Float32Array (serialized) }`              | Derived      |
| `canvas.ai.chats`     | `{ [sessionId]: ChatTurn[] }`                              | User content |

**Quota.** `localStorage` is typically 5–10 MB per origin. RAG vectors and chunked text are the heavy items; the settings page tracks usage and offers per-bundle eviction. For users who routinely index multi-hundred-page decks, the design upgrades cleanly to IndexedDB (`idb-keyval` wrapper) without changing the rest of the architecture — but `localStorage` is the v1 default to match the rest of the app.

**Key handling.** API keys are stored in plaintext in `localStorage`. There is no honest way around this in a pure-frontend design: any encryption would need a key, and a key the browser can recover at boot is no protection. The mitigation is honesty: the settings page states this explicitly, the privacy section has a one-click wipe, and the CSP for the deployed site disallows third-party scripts (defense in depth against XSS exfiltration). See [Viability assessment → Security](#viability-assessment).

---

## The CORS problem

This is the structural cost of going pure-frontend. It is entirely solvable, but the user has to do work and the app has to make that work easy.

### Why CORS happens here

The browser refuses cross-origin XHR/fetch unless the target server returns `Access-Control-Allow-Origin` headers naming (or wildcarding) the canvas origin. **Most cloud LLM APIs intentionally do not return those headers** — they are designed for server-side use, and a permissive CORS policy would invite key-leakage from inexperienced developers. So a request from `https://unlost.ventures/canvas/` to `https://api.openai.com/v1/chat/completions` fails before the body is even sent. The canvas can do nothing about this from JavaScript; it is enforced by the browser.

Local LLM servers (Ollama, LM Studio, Jan) **do** support permissive CORS, but most ship with localhost-only defaults. They need a one-time configuration change.

### Per-provider matrix

| Provider              | CORS support out of the box      | What the user has to do                                                                  |
|-----------------------|----------------------------------|-------------------------------------------------------------------------------------------|
| **Ollama**            | localhost only                   | Set `OLLAMA_ORIGINS` env var to include the canvas origin, restart Ollama. One-time.     |
| **LM Studio**         | localhost only, configurable     | Toggle "Allow CORS" in the local server settings, set allowed origins.                   |
| **Jan / vLLM / llama.cpp server** | varies                | Set the corresponding `--cors` / `ALLOWED_ORIGINS` flag at start.                        |
| **OpenAI**            | none                             | **Deploy a CORS proxy.** Single-file Cloudflare Worker (~30 lines) or Vercel Edge fn.    |
| **Anthropic**         | none                             | Same: deploy a proxy. Anthropic is not OpenAI-compatible; use a translation layer too.   |
| **Together / Groq / OpenRouter** | varies (mostly none) | Same proxy strategy as OpenAI.                                                           |
| **ARCH_AI.md backend**| under the user's control         | Set `CORS_ORIGIN` to the canvas origin in the backend env. Done.                          |

### What the user does for Ollama (the recommended default)

```bash
# macOS — set env for the launchd-managed Ollama, then restart
launchctl setenv OLLAMA_ORIGINS "https://unlost.ventures,http://localhost:5173"
# then quit and relaunch Ollama.app

# Linux (systemd service)
sudo systemctl edit ollama
# add under [Service]: Environment="OLLAMA_ORIGINS=https://unlost.ventures,..."
sudo systemctl restart ollama

# Or for a one-off run
OLLAMA_ORIGINS="*" ollama serve
```

The app's CORS troubleshooter shows these snippets verbatim, parameterized by the current canvas origin.

### What the user does for cloud providers

They need an HTTPS endpoint that:
1. Accepts the canvas origin via CORS.
2. Forwards the request to the real provider.
3. Forwards the response back, including streaming if used.

A complete Cloudflare Worker that does this for OpenAI fits in a screen:

```js
export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    const url = new URL(req.url);
    const upstream = `https://api.openai.com${url.pathname}${url.search}`;
    const r = await fetch(upstream, {
      method: req.method,
      headers: { ...req.headers, host: 'api.openai.com' },
      body: req.body,
    });
    return cors(new Response(r.body, { status: r.status, headers: r.headers }));
  },
};
const cors = (r) => {
  r.headers.set('Access-Control-Allow-Origin', 'https://unlost.ventures');
  r.headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
  return r;
};
```

The settings page links to this snippet (and equivalents for Vercel Edge / Deno Deploy / Netlify) in the CORS troubleshooter. The user pastes the deployed proxy URL as the provider's `baseUrl`. The user's API key still lives only in their browser; the proxy is dumb pipe.

**Important nuance.** The proxy is *trustless from the canvas's point of view* (it never sees anything the canvas would not happily send to OpenAI directly), but it *does* see the user's API key in transit because the `Authorization` header rides through. Users should run their own proxy, not a shared community one. The CORS troubleshooter says this in bold.

### Why not a public CORS proxy?

`cors-anywhere` and similar services exist, but routing API keys through someone else's box is exactly the threat model users are presumably running their own provider to avoid. The app refuses to suggest one.

### Why not a browser extension?

CORS-disabling extensions exist ("CORS Unblock", "Allow CORS"). They work, but they disable a security feature for *all* sites the user visits. The app surfaces this option only as a footnote ("if you understand the risk, this works for development") and never as a default.

### Why not the SDK's `dangerouslyAllowBrowser`?

The OpenAI and Anthropic JS SDKs have a `dangerouslyAllowBrowser: true` flag. This only suppresses the *SDK's own warning* about browser usage; it does not fix CORS. The request still fails. The flag is misleading in this context and the app does not use those SDKs at all — it talks to the OpenAI-compatible endpoint via plain `fetch`, which is smaller, more transparent, and trivially proxiable.

---

## RAG in the browser

All four RAG stages run in browser modules. None requires a backend.

### Extract

- **PDF.** `pdfjs-dist` (Mozilla's PDF.js, the same engine Firefox ships) extracts text page-by-page, including coordinate boxes if needed for citation rendering. Lazy-imported on first upload (~600 KB gzipped) so the canvas-only path stays light.
- **DOCX.** `mammoth.browser.js` if/when it lands as a need. Not in v1.
- **Plain text / markdown.** Native `File.text()`.

### Chunk

Same page-aware sliding window as ARCH_AI.md (~500 tokens, 100 overlap, never crossing page boundaries). Same algorithm, re-implemented in TS here since the backend is Python — the logic is small and dependency-free either way.

### Embed

Two paths, picked per provider:

1. **Provider embeddings.** If the configured provider declares `capabilities.embeddings`, calls go to `<baseUrl>/embeddings`. Same CORS rules as chat — Ollama works locally, cloud providers go via the user's proxy.
2. **In-browser embeddings.** `@xenova/transformers` running ONNX models in WebAssembly. Default model: `Xenova/bge-small-en-v1.5` (~30 MB, ~384 dimensions, decent quality). First-load downloads the model (cached by the browser); subsequent embeddings are local, free, private, and offline. **This is the path that makes the architecture genuinely zero-network for local-LLM users.**

The settings page picks one default and lets the user override per provider.

### Index + search

In-process vector index per `contextId`, persisted to `canvas.ai.vectors`:

- **Default:** flat (brute-force cosine) search. Up to a few thousand chunks this is instant in the browser and adds zero dependencies.
- **Upgrade path:** `hnswlib-wasm` for collections that grow beyond ~10k chunks. Lazy-loaded only if needed.

Search is hybrid: dense top-k via the index, plus a BM25 pass (`minisearch` or hand-rolled) for keyword recall on rare terms. Dedup and budget-trim before injecting into the prompt.

---

## Patch protocol

Same protocol as [ARCH_AI.md#patch-protocol](../ARCH_AI.md#patch-protocol): same `op` union, same validation rules, same `rationale` + `cite` carrying. The frontend expresses it as a Zod schema; the backend expresses the same shape as a Pydantic discriminated union. Keeping the two in sync is a code-review discipline, with optional JSON-Schema codegen from Pydantic to TS as a CI backstop. Validation runs in the browser before patches reach the UI; the apply-side dispatches existing store actions just like in the backend design.

This shared protocol is the reason the two architectures are not really competitors. A user could start with this frontend-only design, later deploy [ARCH_AI.md](../ARCH_AI.md)'s backend as one more provider, and nothing in the UI or store layer changes — the provider just happens to have richer capabilities (web RAG, server-side caching, persistent profiles).

---

## Phasing

The substages mirror ARCH_AI.md's 3a–3e but reorder around what's easiest to ship in a frontend-only world:

| Substage | Adds                                                              | New deps                          |
|----------|-------------------------------------------------------------------|-----------------------------------|
| **3F-a** | Settings page, provider model, Ollama-only chat, no RAG           | none                              |
| **3F-b** | OpenAI / cloud provider support, CORS troubleshooter, proxy docs  | none                              |
| **3F-c** | PDF upload, in-browser extract + chunk + flat-index RAG           | `pdfjs-dist`                      |
| **3F-d** | In-browser embeddings (offline path)                              | `@xenova/transformers`            |
| **3F-e** | Pi-check draft / critique / side-docs                             | (none — pure prompt orchestration)|

Each substage is independently shippable and useful. 3F-a alone gives Ollama users a working chat assistant against the canvas. 3F-d is the milestone where the entire app becomes provably local-only.

---

## What this design gives up vs. ARCH_AI.md

Honestly listed:

- **Web RAG against third-party sites.** Browsers cannot fetch LinkedIn, Crunchbase, or most publishers due to *their* CORS. Workarounds (paste-the-text, user-deployed scraping proxy) exist but are user effort. ARCH_AI.md's backend can fetch freely with an allowlist.
- **Cross-device anything.** Configs and RAG indexes are per-browser-profile.
- **Centralized cost / rate control.** Each user is on their own bill and their own rate limit.
- **Persistent investor profiles as a curated artifact.** Users can write `profile.md` content into the prompt manually, but there is no shared, versioned profile store.
- **Heavy PDFs.** A 200-page deck extracted + chunked + embedded in the browser is feasible but slow; ARCH_AI.md's backend can do it faster on a server. v1 mitigation: progress UI and an upper page-count guard.

---

## Viability assessment

The user's question: *Is this a viable design given the existing canvas app is frontend-only and only uses localStorage for persistence?*

**Architecturally: yes, and arguably more consistent with the existing app than ARCH_AI.md.** The canvas already lives entirely in the browser, persists everything to `localStorage`, has no backend, and ships as static `dist/` copied into the parent site. Adding AI as more frontend modules with more `localStorage` keys does not change the deployment story, the build pipeline, the privacy model, or the operational surface. Phase 3 stops being "a new service to run" and becomes "a bigger SPA."

**Operationally for the user: yes for local-LLM users, with a one-time setup cost for cloud-LLM users.**

- **Ollama (and LM Studio / Jan / vLLM in OpenAI-compat mode):** clean. One env var, restart the local server, paste the URL into the canvas. Works offline. With in-browser embeddings, no outbound network at all.
- **OpenAI / Anthropic / cloud APIs:** requires the user to deploy a tiny CORS proxy. The Cloudflare Worker shown above is ~30 lines and free for any reasonable usage. This is real friction, but it is friction that buys the user something concrete (the keys never leave their infrastructure), and the CORS troubleshooter makes the steps copyable.
- **Users who want zero config:** they can still use the [ARCH_AI.md](../ARCH_AI.md) backend as a configured provider. Nothing prevents both designs from coexisting.

**Security: acceptable for a single-user local-first tool, with disclosure.** Storing API keys in `localStorage` is XSS-vulnerable in principle. The mitigations are: (a) the canvas has no third-party scripts and a strict CSP can lock that down; (b) the existing canvas already trusts `localStorage` for its primary content; (c) the settings page tells users what's stored where and offers a one-click wipe; (d) cloud-provider entries require an "I understand" checkbox. For users who reject this tradeoff, the same UI lets them point at a backend instead. The one mistake to avoid is *implying* the keys are encrypted or otherwise protected when they are not.

**Storage: works for v1, has a clean upgrade path.** Provider config is bytes. Chunked text and vectors are the heavy items. A few hundred-page deck at default chunking is on the order of 1–3 MB of text and ~2 MB of vectors — fits comfortably in `localStorage`'s 5–10 MB budget, with one bundle. Two or three bundles, or a 500-page deck, will push the budget. The settings page surfaces usage and offers eviction; the upgrade to IndexedDB (`idb-keyval` is ~1 KB) does not require any other architectural change.

**Bundle size: deferrable.** The canvas-only path stays at today's ~78 KB gzipped. Settings page and chat sidebar add modestly. PDF.js (~600 KB gz) and Transformers.js (~1.5 MB gz + first-time model download) only load when the user actually uploads a PDF or enables in-browser embeddings — both are explicit, opt-in actions. The canvas's load-time story is unchanged for users who never enable AI.

**Where this design is the wrong choice:** any future where the canvas grows multi-user, shared analyses, server-side caching, or web-scraped RAG. Those features need the backend. If the project's trajectory is toward those features, ship [ARCH_AI.md](../ARCH_AI.md). If the trajectory is "local-first power tool for an individual analyst, with an occasional cloud-LLM call," ship this one. **The two are not mutually exclusive: this design's `Custom backend` provider preset means a user can adopt the frontend-only design now and add the backend later as one more provider, with no rework on the UI side.**

**Recommended path:** ship 3F-a (settings + Ollama chat) as the smallest useful slice. It validates the frontend-only architecture against a real model in real conditions, costs almost nothing in dependencies, and only commits to two new things — a settings route and a chat sidebar — both of which are needed under either architecture. Decisions about CORS proxies, in-browser embeddings, and pi-check can wait until the chat loop is real.

---

## Open questions

- **Routing.** A hash route (`#/settings`) keeps the SPA single-page and avoids touching `index.html`'s deploy contract, but the existing app has no router at all. Ad-hoc state-based view switching is also fine. Decide before 3F-a.
- **Multiple concurrent providers.** Per-session provider selection is in scope for v1; per-message provider selection (different model for embeddings vs. chat vs. analyze) is plausible but adds UI surface.
- **CSP tightening.** The current build has no explicit CSP. Adding one (`script-src 'self'`, `connect-src` allowlisting the configured provider URLs dynamically) is the cleanest defense for `localStorage`-stored keys but requires runtime CSP injection or a service worker.
- **In-browser embedding model selection.** `bge-small-en-v1.5` is a good default; multilingual users need a different one. Settings page can surface a small curated list.
- **Quota-exceeded recovery.** When `localStorage` fills, the next save throws. The store currently swallows the error silently; the AI store needs a louder failure path so the user knows to evict bundles.
- **Streaming through proxies.** Cloudflare Workers and Vercel Edge support streaming responses, but the proxy snippet must not buffer. Document this in the troubleshooter to avoid "OpenAI streams but my proxy doesn't" surprises.

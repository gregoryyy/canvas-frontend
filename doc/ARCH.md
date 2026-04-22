# Architecture

Target architecture for the Canvas app. Describes the end state after all phases; see [PLAN.md](PLAN.md) for the migration path.

## Overview

Interactive, client-first canvas tool for structured strategy/analysis boards (Preseed, Lean, BMC, Product Vision, SWOT, TOWS). Canvas content lives in the browser; an optional backend provides LLM-assisted analysis via a chat sidebar that can write directly into the canvas.

## System diagram

```
┌──────────────────────────────── Browser ──────────────────────────────────┐
│                                                                           │
│  ┌── React UI ────────────────────────┐   ┌── ChatSidebar (phase 3) ──┐   │
│  │  PreCanvas   title / description   │   │  message list             │   │
│  │  Canvas      Cell[] → Card[]       │   │  input                    │   │
│  │  PostCanvas  analysis / score      │   │  file upload              │   │
│  │  Controls    save / load / export  │   │  patch accept / reject    │   │
│  └──────────────────┬─────────────────┘   └─────────────┬─────────────┘   │
│                     │ actions                           │ apply patches   │
│                     ▼                                   ▼                 │
│  ┌── Store (Zustand) ──────────────────────────────────────────────────┐  │
│  │     { meta, canvas: { cells }, analysis }                           │  │
│  └────┬───────────────────────┬──────────────────────────▲─────────────┘  │
│       │ save on Ctrl+S /      │ export JSON / SVG        │ load on start  │
│       │   beforeunload        │ import JSON              │                │
│       ▼                       ▼                          │                │
│  ┌ localStorage ┐       ┌ user download / file ┐  ┌── static fetch ──┐    │
│  │ preseedcanvas│       └──────────────────────┘  │  /conf/*.json    │    │
│  └──────────────┘                                 │  /models/*.json  │    │
│                                                   └──────────────────┘    │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │  phase 3 only
                    POST /api/chat │  { canvas, history, message }
                    POST /api/upload│ (multipart)
                                   ▼
┌── Backend (phase 3, optional) ──────────────────┐      ┌── LLM provider ──┐
│  Fastify (Node, TypeScript)                     │      │                  │
│  ├─ /api/chat    → prompt assembly → LLM client ┼─────►│ OpenAI-compatible│
│  ├─ /api/upload  → text extract → context store │◄─────┤ OpenAI | Ollama  │
│  └─ env: OPENAI_BASE_URL, OPENAI_API_KEY, MODEL │      │                  │
└─────────────────────────────────────────────────┘      └──────────────────┘
```

- Phases 1–2 are everything **above** the dashed boundary — the browser, the store, localStorage, static config/model fetches. This is the entire app until phase 3.
- Phase 3 adds the ChatSidebar, the backend, and the LLM provider. Canvas state is still owned by the browser store; the backend only sees canvas snapshots sent as chat context and returns patches that the user explicitly accepts.

## Principles

- **1:1 functional equivalence through phases 1–2.** The TS/Vite/React migration must not change observable behavior: same URL params, same controls, same keyboard shortcuts, same drag/drop gestures (incl. custom long-press), same card-type commands (`:?`, `:!`, `:=`, `:*`, `:-`), same help overlays, same toast timing, same auto-save triggers (`beforeunload` + `Ctrl+S`/`Cmd+S`, nothing more), same localStorage key (`preseedcanvas`) and JSON shape, same export/import formats. Phase 3 is the first phase that adds new user-visible features.
- **Frontend-first.** The app is fully usable with no backend. Backend features are additive and gated by config.
- **Single user.** No accounts, no server-side persistence of canvas state. `localStorage` remains the source of truth.
- **No vendor lock-in on LLMs.** Backend talks to anything that speaks the OpenAI chat-completions API (OpenAI, Ollama, compatible proxies).
- **Typed.** TypeScript throughout, strict mode.
- **Declarative UI.** React for rendering; imperative DOM work (drag/drop, contenteditable) is isolated in hooks or adapters — behavior unchanged.

## Stack

| Layer         | Choice                                                   |
| ------------- | -------------------------------------------------------- |
| Language      | TypeScript (strict)                                      |
| UI            | React 18+                                                |
| Build         | Vite                                                     |
| Tests         | Vitest + jsdom (unit), Playwright optional later (e2e)   |
| Linting       | ESLint + TypeScript ESLint, Prettier                     |
| Sanitization  | DOMPurify (npm)                                          |
| SVG export    | html-to-image (npm)                                      |
| Backend       | Node + Fastify (or Hono), optional, phase 3              |
| LLM API       | OpenAI-compatible chat completions (OpenAI or Ollama)    |

## Frontend

### Module layout (target)

```
canvas/
├── index.html                # Vite entry
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx              # app bootstrap
│   ├── App.tsx
│   ├── components/
│   │   ├── Canvas.tsx        # grid of cells
│   │   ├── Cell.tsx
│   │   ├── Card.tsx
│   │   ├── PreCanvas.tsx     # title + description
│   │   ├── PostCanvas.tsx    # analysis + score
│   │   ├── Controls.tsx      # save/load/export buttons
│   │   └── ChatSidebar.tsx   # phase 3
│   ├── state/
│   │   ├── store.ts          # canvas state (useSyncExternalStore or Zustand)
│   │   └── persistence.ts    # localStorage read/write, import/export
│   ├── hooks/
│   │   ├── useEditable.ts    # contenteditable binding
│   │   ├── useDragDrop.ts    # card drag/reorder
│   │   └── useLongPress.ts
│   ├── scoring/
│   │   └── formula.ts        # evaluateFormula (ported from PostCanvas)
│   ├── types/
│   │   ├── canvas.ts         # Cell, Card, Meta, Analysis types
│   │   └── config.ts         # Settings, CanvasType definitions
│   ├── util/
│   │   ├── sanitize.ts
│   │   ├── svg.ts            # convertDivToSvg
│   │   └── io.ts             # loadJson, download/upload LS
│   └── styles/               # canvas.css, layout.css
├── public/
│   ├── conf/                 # canvas type definitions (unchanged)
│   └── models/               # example/template content (unchanged)
├── test/                     # Vitest specs
└── doc/
```

### State model

- One store holds `{ meta, canvas: { cells: Cell[] }, analysis }`, mirroring the current JSON shape so existing models/configs load unchanged.
- Cells and cards are plain data; drag/drop and inline editing mutate the store rather than the DOM.
- Score computation subscribes to cell score changes and re-evaluates the formula (see [scoring/formula.ts](../src/scoring/formula.ts) once created).
- Auto-save to `localStorage` fires only on `beforeunload` and on `Ctrl+S`/`Cmd+S`, matching current behavior. No debounce, no on-change saves.

### URL parameters (unchanged)

- `?model=<name>` — loads `/models/<name>.json`
- `?config=<name>` — loads `/conf/<name>.json`
- `?debug=true` — enables debug logging

### Build & serving

- `npm run dev` — Vite dev server on a local port.
- `npm run build` — emits `dist/` with fingerprinted assets under a configurable base path (`/canvas/` to match current deploy).
- Parent-site shared assets (`../styles.css`, `../aurora.js`, `../unlost.svg`) are handled by (a) copying referenced assets during build, or (b) keeping `index.html` in the parent site and pointing it at the built `dist/` bundle. Decision deferred to phase 1; the pragmatic default is (a).

## Backend (phase 3, optional)

### Role

Thin proxy from the frontend chat sidebar to an OpenAI-compatible LLM endpoint, plus a file-upload endpoint for documents (pitch decks, etc.) that are passed to the LLM as context.

The backend does **not** own canvas state. The frontend sends the current canvas as part of each chat turn; the backend returns (a) a chat reply and (b) optional structured patches that the frontend applies to cells.

### Shape

```
backend/
├── package.json
├── src/
│   ├── server.ts             # Fastify app
│   ├── routes/
│   │   ├── chat.ts           # POST /api/chat
│   │   └── upload.ts         # POST /api/upload
│   ├── llm/
│   │   └── client.ts         # OpenAI-compatible client (baseURL + apiKey from env)
│   └── prompts/
│       └── canvas.ts         # system prompt, canvas-aware schema
└── .env.example              # OPENAI_BASE_URL, OPENAI_API_KEY, MODEL
```

### API

- `POST /api/chat` — body: `{ canvas, history, message }`. Response: `{ reply, patches? }` where `patches` is a list of structured edits (e.g. `{ op: "addCard", cellId, content, type? }`, `{ op: "setAnalysis", content }`).
- `POST /api/upload` — multipart file upload. Extracts text, stores a session-scoped context handle, returns `{ contextId }`. The frontend includes `contextId` in subsequent chat calls.
- No auth in v1 (single user). Run behind the existing reverse proxy or localhost.

### Chat sidebar (frontend)

- Collapsible right-hand panel alongside the canvas.
- Message list + input + file upload button.
- When the LLM response includes patches, the UI shows them as an accept/reject diff preview before applying to the canvas (avoids surprise mutations).
- Chat history is in-memory only in v1; can be promoted to localStorage later.

### LLM config

- Backend reads `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `MODEL` from env.
- Ollama is supported by pointing `OPENAI_BASE_URL` at `http://localhost:11434/v1` and `MODEL` at a local model tag.
- Frontend only sees "chat is enabled" via a feature flag from `conf/*.json` (`settings.canvasd.mode !== 'off'`, extended).

## Data flow

### Without backend (phases 1–2)

```
User → React UI → Store → localStorage
                        ↘ JSON import/export
                        ↘ SVG export
```

### With backend (phase 3)

```
User ↔ ChatSidebar ──POST /api/chat──→ Backend ──→ LLM
                    ←── reply + patches ──
        patches → (accept) → Store → localStorage
```

Canvas state never leaves the browser except as context in chat requests. Uploaded files are processed server-side and discarded after the session.

## Non-goals

- Multi-user collaboration, accounts, cloud sync.
- Server-side canvas persistence.
- Real-time multi-client sync (the existing websocket is for upload notifications only and may be removed once upload goes through `/api/upload`).
- Mobile-specific UI beyond what the current responsive layout already provides.

## Open questions

- **Deploy strategy for the Vite build** under the existing static parent site. Resolved in phase 1.
- **Patch preview UX.** Inline diff vs. side-by-side vs. "ghost cards." Resolved in phase 3.
- **Upload file types.** PDF-only initially? Text extraction library choice (`pdf-parse`, `unpdf`, etc.).

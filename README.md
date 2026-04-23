# Unlost Canvas

Interactive browser-based canvas tool for structured early-stage startup analysis. The **Preseed Canvas** is the primary surface — the end-to-end workflow is *upload a pitch deck → draft a Preseed Canvas from it → drill into cells or companion canvases for deep dives*. Additional canvas types — Lean Canvas, Business Model Canvas, Product Vision Board, SWOT, TOWS — are available as deep-dive companions, not standalone entry points.

Client-only app. Canvas state lives in `localStorage`; JSON import/export is supported.

**Project scope.** Monorepo with two stacks:

- **`frontend/`** — the always-usable browser app (TypeScript + React + Vite). Phases 1–2 **complete**. This is everything the user sees today.
- **`backend/`** — optional Python + FastAPI service that adds LLM-assisted analysis. Primary workflow: **pitch-deck ingestion → draft a Preseed Canvas → drill into companion canvases** for deep dives. Capabilities: chat sidebar, PDF uploads, RAG retrieval, pi-check analyzer. Phase 3, **skeleton only** — `pyproject.toml`, `.env.example`, and an empty package under `src/canvas_ai/`. Design in [doc/ARCH_AI.md](doc/ARCH_AI.md); the active phase-3 plan is in [doc/design/PLAN.md](doc/design/PLAN.md).
- **`shared/`** — cross-stack artifacts (patch schema, test fixtures). Placeholder until the first phase-3 substage lands; see [shared/README.md](shared/README.md).

The frontend is fully usable with no backend configured; an alternative all-in-browser design (no backend at all, user brings their own LLM provider) is tracked in [doc/design/ARCH_FE.md](doc/design/ARCH_FE.md) and [doc/design/PLAN.md](doc/design/PLAN.md).

Stacks at a glance:

- Frontend: TypeScript (strict), React, Vite, Vitest + jsdom.
- Backend: Python 3.12, FastAPI, Pydantic v2, `uv`, `ruff` + `mypy`, `pytest`.

## Getting started

### Frontend (phases 1–2, working today)

```bash
cd frontend
npm install
npm run dev       # Vite dev server (http://localhost:5173/)
npm run build     # emits dist/
npm run test      # Vitest
npm run typecheck # tsc --noEmit
npm run lint      # eslint
```

### Backend (phase 3, skeleton)

```bash
cd backend
uv sync                    # install deps + create .venv
cp .env.example .env       # set OPENAI_BASE_URL, OPENAI_API_KEY, MODEL, CORS_ORIGIN
uv run uvicorn canvas_ai.server:app --reload --port 8000
```

Not runnable yet — first real code lands with phase 3B-a. See [backend/README.md](backend/README.md).

## Project layout

**Monorepo** with top-level `frontend/` and `backend/` directories plus a `shared/` directory for the cross-stack patch schema and fixtures. See [doc/ARCH.md#repository-layout](doc/ARCH.md#repository-layout) for the rationale.

```text
unlost-canvas/                   monorepo root
├── frontend/                    TS + React + Vite — the always-usable browser app
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── components/          App, Canvas, Cell, Card, PreCanvas, PostCanvas, Controls, …
│   │   ├── hooks/               useEditable, useLongPress, useDragDrop
│   │   ├── state/               store, persistence, useStore
│   │   ├── scoring/formula.ts   hand-rolled parser for score formulas
│   │   ├── types/               Cell, Card, Meta, Settings, ScoringRule, …
│   │   └── util/                dom, sanitize, io, log, svg
│   │   (phase 3: src/ai/ adds provider client, prompts, patches, RAG — see doc/design/ARCH_FE.md)
│   ├── public/
│   │   ├── styles/              canvas.css, layout.css
│   │   ├── conf/                canvas-type JSON definitions (served as /conf/*.json)
│   │   ├── models/              example/template canvas JSON (served as /models/*.json)
│   │   ├── global/              chrome assets (aurora, logo, fonts)
│   │   └── fonts/               Montserrat font files
│   └── test/                    Vitest specs + helpers
├── backend/                     Python + FastAPI — phase 3, not yet implemented
│   ├── pyproject.toml
│   ├── .env.example
│   ├── src/canvas_ai/           see doc/ARCH_AI.md#backend-module-layout
│   └── tests/
├── shared/                      cross-stack artifacts
│   ├── patch.schema.json        exported from backend Pydantic; consumed by frontend Zod codegen
│   ├── canvas-types/            (optional) public/conf/*.json moves here once backend reads them
│   └── fixtures/                sample canvases for tests on both sides
├── doc/                         project-wide docs
│   ├── ARCH.md                  whole-project architecture
│   ├── ARCH_AI.md               backend design (Python + FastAPI)
│   ├── design/                  forward-looking (ROAD.md, PLAN.md, ARCH_FE.md, STACK.md, SOTA.md, TODO.md)
│   └── done/                    completed-phase records (DONE.md, PLAN.md)
├── release.sh                   build frontend/dist and publish into the parent site
└── README.md
```

**Why monorepo rather than separate repos.** The patch protocol and canvas-type configs are tightly coupled across frontend and backend. A single repo gives atomic commits for protocol changes, one source of truth for the canvas configs, and a shared `doc/`. A workspace manager like pnpm workspaces or Turborepo isn't used — those help when every workspace is one language, which TS + Python is not. Two plain top-level directories with their own package managers (`npm` for frontend, `uv` for backend) stay simple. Full rationale in [doc/ARCH.md#repository-layout](doc/ARCH.md#repository-layout).

## Frontend usage

The sections below document the phases 1–2 frontend app. The backend does not yet exist; its runtime contract will be described in [doc/ARCH.md#backend](doc/ARCH.md#backend) and [doc/ARCH_AI.md](doc/ARCH_AI.md) as phase 3 lands.

### URL parameters

- `?model=<name>` — loads `/models/<name>.json` (default: `template`)
- `?config=<name>` — loads `/conf/<name>.json` (default: `model.meta.canvas`, fallback `preseed`)
- `?debug=true` — enables debug logging via `util/log.ts`

Examples:

```
/?model=example
/?model=template&config=leancanvas
/?model=test&debug=true
```

### Interaction model

- Click a card or text field to edit inline
- Double-click or long-press a cell title to toggle its help overlay
- Double-click or long-press an empty cell area to create a new card
- Clear a card's text and blur to delete it
- Drag cards to reorder within a cell or move between cells (long-press 500 ms on touch)
- `Ctrl+S` / `Cmd+S` saves to localStorage

Card type commands at the start of a card:

- `:?` query
- `:!` comment
- `:=` analysis
- `:*` emphasis
- `:-` reset to default

### Controls

`Save to LS`, `Load from LS`, `Clear LS`, `Export LS`, `Import LS`, `Export SVG`, `Canvas Type`, `Clear Canvas`. The app also auto-saves on `beforeunload` when a canvas title is set.

### Data format

localStorage key: `preseedcanvas`. Saved canvases are keyed by title. Each canvas JSON shape:

```json
{
  "meta": {
    "title": "New Startup",
    "description": "Description.",
    "canvas": "preseed",
    "version": "0.2",
    "date": "20240219"
  },
  "canvas": [
    { "id": 1, "cards": [{ "content": "Problem" }], "score": 0 }
  ],
  "analysis": { "content": "Analysis: ..." }
}
```

Canvas-type configs in `/conf/*.json` define settings (`canvasd`, `localstorage`, `layout`), scoring formulas, and the ordered cell structure.

### Testing

```bash
cd frontend
npm run test              # one-shot Vitest run
npm run test -- --watch   # watch mode
```

Specs live under `frontend/test/` (`*.test.ts`). jsdom is the default environment. `test/helpers.ts` bootstraps an `Application` against JSON fixtures from `frontend/public/` via a fetch mock.

## Release / deployment

The canvas deploys as a vendored `dist/` snapshot inside the parent `unlost.ventures` site:

```bash
./release.sh ../unlost.ventures
```

The script runs `npm run build` inside `frontend/`, clears the target `canvas/` directory, copies `frontend/dist/*`, and writes `canvas/VERSION` with the source commit hash. The parent-site commit is left to the maintainer (reviewable PR). Backend deployment is out of scope for the release script; phase-3 backend deployment is a separate concern tracked in [doc/ARCH.md#deployment](doc/ARCH.md#deployment) and [doc/ARCH_AI.md](doc/ARCH_AI.md).

## Notes

- Sanitization: DOMPurify with `ALLOWED_TAGS: ['br', 'p', 'i', 'b', 'a']`, applied at all state ↔ DOM boundaries (`frontend/src/util/sanitize.ts`).
- Debug logging: pass `?debug=true` to enable; `frontend/src/util/log.ts` prints caller-annotated messages.
- The chat / upload features sketched in `frontend/public/conf/*.json` (`settings.canvasd`) are phase-3 scope — not wired up in phases 1–2.

## Documentation map

- [doc/ARCH.md](doc/ARCH.md) — whole-project architecture, including the backend's role and the deployment flow.
- [doc/ARCH_AI.md](doc/ARCH_AI.md) — backend design (Python + FastAPI), patch protocol, backend module layout.
- [doc/design/ROAD.md](doc/design/ROAD.md), [doc/design/PLAN.md](doc/design/PLAN.md) — phase-3 roadmap and the active plan.
- [doc/design/ARCH_FE.md](doc/design/ARCH_FE.md) — frontend-only (no-backend) alternative for phase 3.
- [doc/design/STACK.md](doc/design/STACK.md), [doc/design/SOTA.md](doc/design/SOTA.md) — stack rationale and state of the art.
- [doc/done/DONE.md](doc/done/DONE.md), [doc/done/PLAN.md](doc/done/PLAN.md) — archived record of phases 1–2.

# Unlost Preseed Canvas — frontend

Interactive browser-based canvas tool for structured strategy and analysis boards: Preseed Canvas, Lean Canvas, Business Model Canvas, Product Vision Board, SWOT, TOWS.

Client-only app. Canvas state lives in `localStorage`; JSON import/export is supported.

**Project scope.** This repository holds the **frontend**. An optional **backend** (phase 3, not yet implemented) adds LLM-assisted analysis — see [doc/ARCH_AI.md](doc/ARCH_AI.md) for the design. The backend is expected to live in a sibling repository `canvas-backend/` (Python + FastAPI); its layout is sketched in [doc/ARCH.md#backend](doc/ARCH.md#backend) and detailed in [doc/ARCH_AI.md#backend-module-layout](doc/ARCH_AI.md#backend-module-layout). The frontend is fully usable with no backend configured; an alternative all-in-browser design (no backend at all, user brings their own LLM provider) is in [doc/design/ARCH_FE.md](doc/design/ARCH_FE.md).

Frontend stack: TypeScript (strict), React, Vite, Vitest + jsdom.

## Getting started

```bash
npm install
npm run dev       # Vite dev server (http://localhost:5173/)
npm run build     # emits dist/
npm run test      # Vitest
npm run typecheck # tsc --noEmit
npm run lint      # eslint
```

## Project layout

Target is a **monorepo** with top-level `frontend/` and `backend/` directories plus a `shared/` directory for the cross-stack patch schema and fixtures. The current on-disk layout is pre-migration (frontend files at the repo root) and will be moved under `frontend/` when the backend lands. See [doc/ARCH.md#repository-layout](doc/ARCH.md#repository-layout) for the rationale.

```text
preseed-canvas/                  monorepo root (repo currently named canvas-frontend)
├── frontend/                    TS + React + Vite — current repo root moves here
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

**Pre-migration on-disk layout (what exists today):**

```text
canvas-frontend/                 will become preseed-canvas/frontend/
├── index.html, src/, public/, test/, package.json, vite.config.ts, tsconfig.json, eslint.config.js, release.sh
└── doc/                         stays at the monorepo root after the frontend move
```

**Why monorepo rather than separate repos.** The patch protocol and canvas-type configs are tightly coupled across frontend and backend. A single repo gives atomic commits for protocol changes, one source of truth for the canvas configs, and a shared `doc/`. A workspace manager like pnpm workspaces or Turborepo isn't used — those help when every workspace is one language, which TS + Python is not. Two plain top-level directories with their own package managers (`npm` for frontend, `uv` for backend) stay simple. Full rationale in [doc/ARCH.md#repository-layout](doc/ARCH.md#repository-layout).

## URL parameters

- `?model=<name>` — loads `/models/<name>.json` (default: `template`)
- `?config=<name>` — loads `/conf/<name>.json` (default: `model.meta.canvas`, fallback `preseed`)
- `?debug=true` — enables debug logging via `util/log.ts`

Examples:

```
/?model=example
/?model=template&config=leancanvas
/?model=test&debug=true
```

## Interaction model

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

## Controls

`Save to LS`, `Load from LS`, `Clear LS`, `Export LS`, `Import LS`, `Export SVG`, `Canvas Type`, `Clear Canvas`. The app also auto-saves on `beforeunload` when a canvas title is set.

## Data format

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

## Testing

```bash
npm run test              # one-shot Vitest run
npm run test -- --watch   # watch mode
```

Specs live under `test/` (`*.test.ts`). jsdom is the default environment. `test/helpers.ts` bootstraps an `Application` against JSON fixtures from `public/` via a fetch mock.

## Release / deployment

The canvas deploys as a vendored `dist/` snapshot inside the parent `unlost.ventures` site:

```bash
./release.sh ../unlost.ventures
```

The script runs `npm run build`, clears the target `canvas/` directory, copies `dist/*`, and writes `canvas/VERSION` with the source commit hash. The parent-site commit is left to the maintainer (reviewable PR). See [doc/ARCH.md#deployment](doc/ARCH.md#deployment) for the full flow.

## Notes

- Sanitization: DOMPurify with `ALLOWED_TAGS: ['br', 'p', 'i', 'b', 'a']`, applied at all state ↔ DOM boundaries (`util/sanitize.ts`).
- Debug logging: pass `?debug=true` to enable; `util/log.ts` prints caller-annotated messages.
- The chat / upload features sketched in `conf/*.json` (`settings.canvasd`) are phase-3 scope — not wired up in phase 1.

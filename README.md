# Unlost Preseed Canvas

Interactive browser-based canvas tool for structured strategy and analysis boards: Preseed Canvas, Lean Canvas, Business Model Canvas, Product Vision Board, SWOT, TOWS.

Client-only app. Canvas state lives in `localStorage`; JSON import/export is supported. An optional LLM-backed chat sidebar (phase 3, not yet implemented) will be able to write directly into cells.

Stack: TypeScript (strict), Vite, Vitest + jsdom. Phase 2 introduces React.

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

```text
canvas-frontend/
├── index.html              Vite entry
├── src/
│   ├── main.ts             bootstrap: DOMContentLoaded + beforeunload + Ctrl+S
│   ├── app.ts              Application / Settings / Controls classes
│   ├── context.ts          runtime app/conf/ctl holders (phase-1 workaround)
│   ├── canvas/             Canvas, Cell, Card, PreCanvas, PostCanvas, DragState
│   ├── scoring/formula.ts  hand-rolled parser for score formulas
│   ├── types/              Cell, Card, Meta, Settings, ScoringRule, ...
│   └── util/               dom, sanitize, dragdrop, longpress, editable, overlay, svg, io, log
├── public/conf/            canvas-type JSON definitions (served as /conf/*.json)
├── public/models/          example/template canvas JSON (served as /models/*.json)
├── test/                   Vitest specs + helpers
├── scripts/release.sh      build + publish dist/ into the parent site
└── doc/                    ARCH.md, PLAN.md, DONE.md
```

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
scripts/release.sh ../unlost.ventures
```

The script runs `npm run build`, clears the target `canvas/` directory, copies `dist/*`, and writes `canvas/VERSION` with the source commit hash. The parent-site commit is left to the maintainer (reviewable PR). See [doc/ARCH.md#deployment](doc/ARCH.md#deployment) for the full flow.

## Notes

- Sanitization: DOMPurify with `ALLOWED_TAGS: ['br', 'p', 'i', 'b', 'a']`, applied at all state ↔ DOM boundaries (`util/sanitize.ts`).
- Debug logging: pass `?debug=true` to enable; `util/log.ts` prints caller-annotated messages.
- The chat / upload features sketched in `conf/*.json` (`settings.canvasd`) are phase-3 scope — not wired up in phase 1.

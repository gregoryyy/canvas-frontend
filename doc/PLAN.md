# Plan

Migration plan from the current plain-ES-module app to the target in [ARCH.md](ARCH.md). Three phases, each shippable on its own.

## Rule: 1:1 functional equivalence (phases 1–2)

Phases 1 and 2 are a re-platforming, not a redesign. The finished phase-2 build must be indistinguishable from the current app to a user:

- Same URL parameters (`?model`, `?config`, `?debug`) with identical defaults.
- Same controls, same labels, same order, same confirm-twice semantics, same `clicked` flash, same toast messages and durations.
- Same keyboard shortcuts (`Ctrl+S`/`Cmd+S` only).
- Same auto-save triggers: `beforeunload` and explicit save. No on-change saves, no debounced saves.
- Same drag/drop gestures: click-and-drag on desktop, long-press-500ms on touch, drop-on-card-reorder and drop-on-cell-append, same highlight class behavior.
- Same inline-edit semantics: contenteditable, Enter inserts `<br><br>`, blur commits, empty-after-edit deletes the card.
- Same card-type commands at start of text: `:?`, `:!`, `:=`, `:*`, `:-`.
- Same help-overlay triggers: double-click and long-press on cell title.
- Same new-card triggers: double-click and long-press on empty cell area.
- Same localStorage key (`preseedcanvas`), same JSON shape, same import/export format, same SVG export behavior.
- Same score-formula semantics (the hand-rolled parser in `PostCanvas.evaluateFormula`).
- Same sanitization ruleset (DOMPurify with the same allow-list: `br, p, i, b, a`).

If a refactor would change any of the above, it does not land in phases 1–2. New features, polish, and "while we're in there" changes wait for phase 3 or later.

Phase 3 is additive — it introduces the chat sidebar, backend, and LLM integration as **new** features. The rest of the app still behaves identically with those features turned off.

## Phase 1 — TypeScript + Vite + Vitest

**Goal:** Same app, same behavior, now typed and building through Vite. No React yet.

### Milestones

1. **Tooling bootstrap**
   - Add `package.json`, install `typescript`, `vite`, `vitest`, `jsdom`, `@types/node`, `eslint`, `prettier`.
   - Add `tsconfig.json` (strict), `vite.config.ts`, `.eslintrc`, `.prettierrc`.
   - Configure Vite `base: '/canvas/'` so built asset paths match the current deploy.
   - Move `conf/` and `models/` into `public/` so Vite serves them at the same URLs.
   - Replace vendored `lib/purify.es.js` and `lib/html-to-image.es.min.js` with npm packages.
   - `npm run dev` serves the app; `npm run build` emits `dist/`.

2. **Type definitions first**
   - Create `src/types/canvas.ts`: `Meta`, `Cell`, `Card`, `Analysis`, `CanvasState`, `CardType`.
   - Create `src/types/config.ts`: `Settings`, `CanvasConfig`, `ScoringRule`, `CanvasTypeRef`.
   - Validate one model + one config loads against the types (compile check only).

3. **Port `util.js` → `src/util/*.ts`**
   - Split by concern: `dom.ts`, `editable.ts`, `dragdrop.ts`, `longpress.ts`, `overlay.ts`, `sanitize.ts`, `io.ts`, `svg.ts`, `log.ts`.
   - No behavior change; add types for every signature.

4. **Port `canvas.js` → `src/canvas/*.ts`**
   - One file per class: `Canvas.ts`, `Cell.ts`, `Card.ts`, `PreCanvas.ts`, `PostCanvas.ts`.
   - Replace `static` drag-tracking globals with a module-level `DragState` object (still mutable, but typed).
   - Port `PostCanvas.evaluateFormula` into `src/scoring/formula.ts` with its own test file.

5. **Port `main.ts`**
   - Keep the `Application` / `Controls` / `Settings` classes.
   - Remove the circular `main ↔ canvas` import (pass `app`/`conf` through constructors or a small context module).
   - Keep `network.ts` port as a stub; full rework happens in phase 3.

6. **Tests**
   - Port the three existing Jasmine specs (`LoadSpec`, `CardSpec`, `InteractSpec`) to Vitest with jsdom.
   - Add unit tests for `evaluateFormula` (table-driven).
   - `npm run test` runs green.

7. **Deployment adjustment**
   - Decide: copy shared parent-site assets into the Vite build, or have the parent site include the built bundle. Default: copy `../styles.css`, `../aurora.js`, `../aurora.css`, `../unlost.svg` into `public/shared/` at build time and rewrite references.
   - `canvas.html` becomes `index.html` at the Vite root.
   - Verify the built app behaves identically to the current one: load every config in `conf/`, drag cards, save/load LS, export SVG.

### Done when

- `npm run build` produces a working `/canvas/` deploy with byte-compatible localStorage format.
- `npm run test` passes.
- `tsc --noEmit` passes with `strict: true`.
- Zero `.js` files remain in the app source (only config files).
- **Equivalence pass:** loading a canvas saved by the pre-migration app in the new build reproduces the same rendered DOM (modulo React-added attributes) and the same exported JSON/SVG. Every item in the phase 1–2 equivalence checklist at the top of this file is verified by hand against the current production build.

### Risks

- The contenteditable + innerHTML round-trip (`convertBR`/`convertNL`, sanitize) is fragile; tests must cover it before porting.
- Circular imports between `main.js` and `canvas.js` break cleanly under TS strict; plan the dependency direction up front.

---

## Phase 2 — React conversion

**Goal:** Same features, React components and hooks instead of class-based imperative DOM.

### Milestones

1. **State store**
   - Introduce Zustand (or a hand-rolled `useSyncExternalStore`) holding `CanvasState`.
   - Actions: `addCard`, `updateCard`, `removeCard`, `moveCard`, `setScore`, `setMeta`, `setAnalysis`, `changeType`, `clearAll`, `loadFromLs`, `saveToLs`.
   - `persistence.ts` triggers saves only on `beforeunload` and `Ctrl+S`/`Cmd+S` — same triggers as today. No debounced or on-change saves.

2. **Dumb components first**
   - Build `Card`, `Cell`, `Canvas`, `PreCanvas`, `PostCanvas`, `Controls` as presentational components reading from the store.
   - CSS classes unchanged so the existing stylesheets still apply.

3. **Editable + drag/drop hooks**
   - `useEditable(ref, onCommit)` — wraps contenteditable + Enter-key handling (Enter inserts `<br><br>` via Selection/Range API, same as today) + sanitize-on-blur.
   - `useDragDrop` — a direct port of the current `makeDraggable`/`makeDroppable` in [util.js:109-159](../util.js#L109-L159). Same HTML5 drag events, same `dragging`/`highlight` classes, same 500 ms long-press path, same drop-on-card-reorder vs drop-on-cell-append split. No drag-and-drop library — introducing one would change gesture behavior.
   - `useLongPress(ref, callback, ms)` — direct port of `generateLongPressEvents` with the same 10 px movement cancel threshold.

4. **Overlays and menus**
   - Hover-help, confirm-step, overlay-menu, toast — rebuild as React components with portals. Shared `Overlay` primitive if helpful.

5. **Controls panel**
   - Rebuild Save/Load/Export/Import/Clear/Type buttons as a React component.
   - Keep Ctrl+S shortcut and beforeunload save.

6. **Tests**
   - Component tests with Vitest + `@testing-library/react` for Cell/Card editing and drag/drop callback wiring.
   - Snapshot `CanvasState` transitions for core actions.

### Done when

- Feature parity with phase 1 (load every model/config, drag, edit, score, save/load/export).
- No direct DOM mutation in components — only in hooks or adapters.
- All tests green.
- **Equivalence pass re-run** against the phase 1–2 checklist at the top of this file. A canvas round-trips (save in current app → load in React app → save → load in current app) without loss or format drift.

### Risks

- Drag/drop across cells with custom long-press is the most likely source of regressions. If `@dnd-kit` fits, use it; otherwise isolate the imperative logic in one hook and test it thoroughly.
- `contenteditable` + React is notoriously tricky (React wants to own the DOM subtree). The hook must mark the editable node as uncontrolled and only sync on blur.

---

## Phase 3 — Backend + chat sidebar

**Goal:** Optional LLM-backed chat sidebar that can answer questions and write summaries directly into canvas cells and the analysis field.

### Milestones

1. **Backend skeleton**
   - New `backend/` workspace, Node + Fastify (or Hono), TypeScript.
   - `POST /api/chat`, `POST /api/upload` stubs with typed request/response.
   - Env config: `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `MODEL`.
   - Smoke test against Ollama (`http://localhost:11434/v1`) and OpenAI.

2. **Chat proxy**
   - `/api/chat` forwards to the LLM with a system prompt that includes the current canvas state (passed in the request) and canvas-type definition.
   - Structured output: LLM is instructed to return `{ reply: string, patches: Patch[] }` as JSON. Validate with Zod on the backend.
   - `Patch` operations: `addCard`, `updateCard`, `setAnalysis`, `setScore`.

3. **File upload**
   - `/api/upload` accepts a document, extracts text (PDF via `unpdf` or `pdf-parse`), stores it in memory keyed by `contextId` with a TTL.
   - Chat requests include optional `contextId`; backend inlines extracted text into the prompt.
   - Replace the current `network.js` upload path; retire the websocket notification channel (no longer needed with synchronous request/response).

4. **Chat sidebar UI**
   - New `ChatSidebar` React component, collapsible right panel.
   - Message list, input, upload button, "suggested patches" block with accept/reject per patch.
   - Feature-flagged via `conf/*.json` (`settings.canvasd.mode`).
   - Accepting a patch dispatches the corresponding store action; rejecting drops it.

5. **Safety & UX**
   - Never auto-apply patches. User must accept.
   - Show which cells a patch will touch before accepting.
   - Cap request size (canvas JSON + chat history) to a known token budget.
   - Rate-limit on the backend (per-IP, generous).

6. **Tests**
   - Backend unit tests for prompt assembly, patch validation, and the happy-path `/api/chat` with a mocked LLM client.
   - Frontend tests for patch-apply reducer actions.
   - Manual test matrix: OpenAI + Ollama, with/without uploaded PDF, each canvas type.

### Done when

- Chat sidebar works end-to-end against both OpenAI and Ollama.
- Uploading a pitch deck and asking "draft a Preseed Canvas from this" produces reviewable patches that fill cells.
- Backend is stateless apart from short-lived upload contexts.
- Canvas app remains fully functional with the backend off (feature flag).

### Risks

- Structured output reliability varies across models; Ollama models especially. Fallback: parse best-effort JSON, surface parse failures as plain-text replies.
- Prompt size: a filled canvas plus chat history plus extracted PDF text can blow past context windows. Need a summarization or chunking strategy before this becomes a blocker.
- Privacy: uploaded files are processed server-side. Document this clearly; keep upload off by default.

---

## Cross-cutting

- **Branching:** one branch per phase, merge only when its "done when" checklist is green.
- **Docs:** update `README.md` at the end of each phase (build/run/test commands change in phase 1).
- **Deprecations:** `canvas.html`, `canvas_test.html`, `network.js`, and the vendored `lib/` drop out during phase 1–3; do not preserve them for back-compat.
- **localStorage format:** unchanged across all phases. A canvas saved in the current app must load in the phase-3 app.

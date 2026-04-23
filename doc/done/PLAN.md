# Plan (archive — phases 1 and 2)

Archive of the phases 1–2 migration plan: porting the plain-ES-module app to TypeScript + Vite + Vitest (phase 1) and then to React (phase 2). Both phases are complete; see [DONE.md](DONE.md) for the record. The active plan for phase 3 is in [../PLAN.md](../PLAN.md).

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

2. **Repo split & standalone layout**
   - **Preserve history.** From the parent repo, run `git subtree split --prefix=canvas -b canvas-only` to produce a branch with only the `canvas/` directory's history. Create the new empty repo and push that branch as `main`. Verify `git log` in the new repo shows commits from late 2024 onward.
   - **Drop parent-site coupling.** In the new repo, rename `canvas.html` → `index.html` (Vite picks it up as the default entry). Delete the pre-migration stub `index.html` (the "no access" page). Remove the parent-chrome wrappers from the HTML (`<header>`, `<nav>`, `<footer>`, `<div class="bg">`, `<div class="hhnav">`, `<div class="mmlogo">`, hamburger, aurora container) so the page contains only the canvas UI, controls, and how-to hints. Keep the same page title, cross-page menu links are removed.
   - **Remove M1 workarounds.** Delete the `stripParentAssets` plugin from `vite.config.ts`. Remove `server.fs.allow: ['..']`. Remove `build.rollupOptions.input: 'canvas.html'` (defaults to `index.html` now).
   - **Delete vendored and dead files.** `lib/` (no longer imported), `canvas_test.html` (M7 replaces it with Vitest), `network.js` (phase-3 rework, not carried forward as-is).
   - **Integration wiring.** Add `scripts/release.sh` that runs `npm run build` and copies `dist/*` into a parent-site checkout's `canvas/` directory (argument: path to the parent-site repo). Document the flow in `README.md` and `doc/ARCH.md#deployment`.
   - **First release dry-run.** Run `scripts/release.sh ../unlost.ventures`, confirm the parent site's `/canvas/` still serves the app correctly against the live chrome.

3. **Type definitions first**
   - Create `src/types/canvas.ts`: `Meta`, `Cell`, `Card`, `Analysis`, `CanvasState`, `CardType`.
   - Create `src/types/config.ts`: `Settings`, `CanvasConfig`, `ScoringRule`, `CanvasTypeRef`.
   - Validate one model + one config loads against the types (compile check only).

4. **Port `util.js` → `src/util/*.ts`**
   - Split by concern: `dom.ts`, `editable.ts`, `dragdrop.ts`, `longpress.ts`, `overlay.ts`, `sanitize.ts`, `io.ts`, `svg.ts`, `log.ts`.
   - No behavior change; add types for every signature.

5. **Port `canvas.js` → `src/canvas/*.ts`**
   - One file per class: `Canvas.ts`, `Cell.ts`, `Card.ts`, `PreCanvas.ts`, `PostCanvas.ts`.
   - Replace `static` drag-tracking globals with a module-level `DragState` object (still mutable, but typed).
   - Port `PostCanvas.evaluateFormula` into `src/scoring/formula.ts` with its own test file.

6. **Port `main.ts`**
   - Keep the `Application` / `Controls` / `Settings` classes.
   - Remove the circular `main ↔ canvas` import (pass `app`/`conf` through constructors or a small context module).

7. **Tests**
   - Port the three existing Jasmine specs (`LoadSpec`, `CardSpec`, `InteractSpec`) to Vitest with jsdom.
   - Add unit tests for `evaluateFormula` (table-driven).
   - `npm run test` runs green.

8. **Release verification**
   - Run `scripts/release.sh` end-to-end against the parent site repo.
   - Walk the phase 1–2 equivalence checklist by hand against the deployed `/canvas/` URL: load every config in `conf/`, drag cards, save/load LS, export SVG, round-trip a pre-migration saved canvas.
   - Update `README.md` and `doc/ARCH.md` with final build/run/release commands.

### Done when

- `npm run build` produces a working `/canvas/` deploy with byte-compatible localStorage format.
- `npm run test` passes.
- `tsc --noEmit` passes with `strict: true`.
- Zero `.js` files remain in the app source (only config files).
- **Equivalence pass:** loading a canvas saved by the pre-migration app in the new build reproduces the same rendered DOM (modulo React-added attributes) and the same exported JSON/SVG. Every item in the phase 1–2 equivalence checklist at the top of this file is verified by hand against the current production build.

### Risks

- The contenteditable + innerHTML round-trip (`convertBR`/`convertNL`, sanitize) is fragile; tests must cover it before porting.
- Circular imports between `main.js` and `canvas.js` break cleanly under TS strict; plan the dependency direction up front.
- **Repo split drift:** once the canvas lives in its own repo, drift between the parent site's vendored `canvas/` dist and the canvas repo's `HEAD` is possible. Mitigation: keep a `VERSION` or commit-hash file in `dist/` so the parent-site checkin records which canvas build is live.

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
   - `useDragDrop` — a direct port of the current `makeDraggable`/`makeDroppable` in [util.js:109-159](../../util.js#L109-L159). Same HTML5 drag events, same `dragging`/`highlight` classes, same 500 ms long-press path, same drop-on-card-reorder vs drop-on-cell-append split. No drag-and-drop library — introducing one would change gesture behavior.
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

## Phase 3 — original sketch (superseded)

> **⚠️ Historical — kept for reference only.**
>
> This is the phase-3 sketch as it existed when phase 2 was still in progress: a Node + Fastify + TypeScript backend with an "optional / feature-flagged" chat sidebar. It has been **superseded** by the active plan at [../PLAN.md](../PLAN.md), which commits to a Python + FastAPI backend-first architecture with a pitch-deck → draft Preseed workflow and text / file / URL input channels.
>
> Preserved so later readers can trace how the design evolved. Do not plan work against this sketch.

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

### What changed between this sketch and current [../PLAN.md](../PLAN.md)

- **Stack.** Node + Fastify + TypeScript → Python + FastAPI. Rationale in [../design/STACK.md](../design/STACK.md): Python is the RAG / ML-library mother tongue, and the frontend-TS symmetry argument lost once Python's ecosystem was weighed in.
- **Posture.** "Optional, feature-flagged, app works with backend off" → backend-first. AI features require the backend; the browser-only alternative is archived.
- **Patch validation.** Zod on the backend → Pydantic on the backend, Zod on the frontend auto-generated from `shared/patch.schema.json`.
- **Primary workflow.** "Chat sidebar that can write summaries" → text / file / URL → draft Preseed Canvas → refine → companion canvases. Ordering is driven by the user journey, not by API surface.
- **Input channels.** File-first (PDF upload) → text-first (paste description in chat), with file upload in M3 and URL crawl in M4. Ships the first usable draft before the RAG subsystem exists.

---

## Cross-cutting

- **Repo topology.** After phase 1 M2, canvas source lives in a standalone repo. The unlost.ventures site repo retains a `canvas/` directory that holds *only* the built `dist/` output, updated via `scripts/release.sh`. See [ARCH.md#deployment](../ARCH.md#deployment).
- **Branching:** one branch per phase, merge only when its "done when" checklist is green.
- **Docs:** update `README.md` at the end of each phase (build/run/test commands change in phase 1).
- **Deprecations:** `canvas.html`, `canvas_test.html`, `network.js`, and the vendored `lib/` drop out during phase 1 M2; do not preserve them for back-compat.
- **localStorage format:** unchanged across all phases. A canvas saved in the current app must load in the phase-3 app.

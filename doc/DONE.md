# Done

Progress log against [PLAN.md](PLAN.md). Each milestone records what landed, deviations from the plan, and open gaps. Update at the end of every milestone.

## Phase 1 — TypeScript + Vite + Vitest

### M1 — Tooling bootstrap — ✅ done (with one intentional deviation)

Landed:
- [package.json](../package.json) with `dev`, `build`, `preview`, `test`, `typecheck`, `lint`, `format` scripts.
- Runtime deps via npm: `dompurify`, `html-to-image` (replacing the vendored copies under [lib/](../lib/)).
- Dev deps: `typescript`, `vite`, `vitest`, `jsdom`, `@types/node`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`.
- [tsconfig.json](../tsconfig.json) with `strict: true` plus `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `isolatedModules`, `resolveJsonModule`.
- [vite.config.ts](../vite.config.ts) — minimal, `publicDir: 'public'`, Vitest with jsdom.
- [eslint.config.js](../eslint.config.js) and [.prettierrc](../.prettierrc) present.
- [public/conf/](../public/conf/) and [public/models/](../public/models/) in place so Vite serves them at the same URLs as before.

Deviation:
- **Vite `base` is `'/'`, not `'/canvas/'`.** Plan called for `/canvas/` to match the parent-site deploy path. Defensible now that the repo is split and publishes via a release script — the canvas app will live at the root of its own dev server, then get copied into the parent site's `/canvas/` directory at release time. Decision is only consistent once M2's `scripts/release.sh` exists and rewrites asset paths (or the release flow accepts this). **Revisit when M2 release dry-run happens** — if built paths break against `unlost.ventures/canvas/`, flip `base` back to `/canvas/`.

Gaps: none blocking.

---

### M2 — Repo split & standalone layout — ✅ done (two items intentionally deferred)

Landed:
- **Repo split with history preserved.** Commit `a576792` ("adjust for split out of canvas repo subtree"); `git log` shows the pre-split canvas commits.
- **`canvas.html` → `index.html`** as Vite's default entry.
- **M1 workarounds removed.** [vite.config.ts](../vite.config.ts) has no `stripParentAssets` plugin, no `server.fs.allow`, no `build.rollupOptions.input` override.
- **Dead / vendored files deleted:** `network.js`, `lib/` (`purify.es.js`, `html-to-image.es.min.js`, plus stray `jspdf.es.min.js`, `html-to-image.min.js`, `purfy.min.js` typo, `lib/index.html`), `canvas_test.html`.
- **Dead `useServer` / `FileUploader` branch removed from [main.js](../main.js)** (the only caller of network.js; sat inside `if (useServer)`, which was always false given every shipped config has `canvasd.mode: "off"`).
- **[scripts/release.sh](../scripts/release.sh) created** per [ARCH.md#release-script](ARCH.md#release-script): preflight checks (clean tree, target exists, target is a git repo), `npm run build`, clear target `canvas/` contents (with `--force` to skip the confirm), copy `dist/.` (dotfile-safe), write `canvas/VERSION` with commit hash + UTC timestamp. Does **not** commit or push on the target — maintainer-reviewable.
- **Lint baseline green.** [eslint.config.js](../eslint.config.js) drops stale `lib/**` and `network.js` ignores; `npx eslint .` passes, `npx tsc --noEmit` passes, `node --check main.js` passes, `bash -n scripts/release.sh` passes.

Deferred by user decision (not blockers):
- **Parent-site chrome retained in [index.html](../index.html).** Plan called for stripping `<header>`, `<nav>`, `<footer>`, `aurora` container, etc. Kept because the references are absolute URLs to `unlost.ventures` and local assets under [global/](../global/) — they don't break when the page serves standalone. Revisit if the standalone-page story ever needs to look chromeless.
- **[global/](../global/) retained.** Follows from the chrome decision above — it's what the surviving chrome imports.
- **Release dry-run not yet executed.** `scripts/release.sh` is wired and smoke-tested for CLI surface (usage message, uncommitted-tree guard, unknown-flag rejection, `--help`) but has not been run end-to-end against `../unlost.ventures`. The `base: '/'` vs `'/canvas/'` question stays parked until that run happens.

Insights:
- The `useServer` code path was dead for a separate reason I didn't spot until digging in: [index.html](../index.html) never loaded `network.js` as a `<script>` at all — the only `<script type="module">` is `./main.js`. So `new FileUploader(...)` would have thrown `ReferenceError` at runtime if `useServer` had ever been true. Removing the branch fixes lint (no more undefined `FileUploader`) and removes a runtime footgun the plan had already flagged for deletion.
- `cp -R dist/. target/` (note the trailing `/.`) copies dotfiles; `cp -R dist/* target/` doesn't. Not relevant for Vite output today, but worth pinning the idiom.
- `find <dir> -mindepth 1 -delete` is the cleanest way to empty a directory in the release script — handles dotfiles, doesn't need shell globbing, doesn't accidentally delete the directory itself.

Gaps (follow-up):
- Release dry-run against `../unlost.ventures`: `scripts/release.sh ../unlost.ventures`. After that, decide Vite `base`.
- Update [README.md](../README.md) once the dry-run lands — Project Layout still lists `network.js`/`lib/`, and Running Locally still tells users to `python3 -m http.server` from the parent.

---

### M3 — Type definitions — ✅ done

Landed:
- [src/types/canvas.ts](../src/types/canvas.ts) — `CardType`, `Card`, `Cell`, `Meta`, `Analysis`, `CanvasState`.
- [src/types/config.ts](../src/types/config.ts) — `YesNo`, `Settings` (with `CanvasdSettings`, `LocalStorageSettings`, `LayoutSettings`), `ConfigMeta`, `CellStructure`, `ScoringRule`, `CanvasConfig`, `CanvasTypeRef`, `CanvasTypesList`.
- [src/types/_validate.ts](../src/types/_validate.ts) — compile-check samples transcribed from [public/conf/preseed.json](../public/conf/preseed.json), [public/models/example.json](../public/models/example.json), [public/conf/configs.json](../public/conf/configs.json); typed via left-hand annotations so string literals narrow to `YesNo` / `CardType`.
- `npx tsc --noEmit` passes.

Deviations from the plan:
- **Two `Meta` shapes, not one.** The plan's `Meta` conflated two structurally different things. Config's top-level `meta` is `{ type, version, date, canvas, template, description }` ([preseed.json](../public/conf/preseed.json)); a saved canvas's `meta` is `{ title, description, canvas, version, date }` ([example.json](../public/models/example.json)). Split into `ConfigMeta` (config.ts) and `Meta` (canvas.ts).
- **`CanvasState.canvas` is `Cell[]`, not `{ cells: Cell[] }`.** [ARCH.md](ARCH.md#state-model) sketches the store as `{ cells }`, but the current localStorage JSON ([canvas.js:62](../canvas.js#L62) `Canvas.toJSON()` returns `this.cells` bare) serializes a flat array. 1:1 equivalence wins; the Zustand store in phase 2 can wrap this without changing the on-disk format.
- **Didn't import JSON directly for the compile check.** With `resolveJsonModule`, JSON string fields widen to `string`, so `score: "yes"` fails `YesNo = 'yes' | 'no'`. Used typed literal fixtures in `_validate.ts` with left-hand type annotations — TS narrows correctly that way. Real JSON validation will happen at runtime in M4's `io.ts` (Zod or a hand-rolled guard).
- **`canvasd.mode`, `localstorage.mode`, `canvasclass` kept as `string`, not unions.** Configs only exhibit `'off'` / `'manual'` today, but [main.js](../main.js) doesn't constrain them. Locking them down would be premature and brittle.

Insights:
- `CardType` is `'query' | 'comment' | 'analysis' | 'emphasis'` per [canvas.js:269](../canvas.js#L269); the `:- ` command explicitly clears to `undefined` (base card), so `type` is optional, not a "default" value.
- Scoring rule's `scores` is `Record<string, string>` — keys are user-defined sub-score names (`Product`, `Market`, …) referenced by `total` via `evaluateFormula`.

Gaps: none. Ready for M4.

---

### M4 — Port util.js → src/util/*.ts — ✅ done

Landed — nine typed modules, one re-export shim:
- [src/util/dom.ts](../src/util/dom.ts) — `createElement`, `toggleElements`.
- [src/util/sanitize.ts](../src/util/sanitize.ts) — `sanitize`, `sanitizeJSON`, `convertBR`, `convertNL`, `decodeHtml`, `encodeHtml`, `trimPluralS`.
- [src/util/log.ts](../src/util/log.ts) — `lg` + module-level `_debugEnabled` / `isDebugEnabled`.
- [src/util/longpress.ts](../src/util/longpress.ts) — `addLongPressListener`, `generateLongPressEvents` (500 ms default, 10 px move-cancel threshold preserved).
- [src/util/editable.ts](../src/util/editable.ts) — `makeEditable` (Enter inserts two `<br>` via Selection/Range, same as original).
- [src/util/dragdrop.ts](../src/util/dragdrop.ts) — `makeDraggable`, `makeDroppable`; module-level `highlightClass` / `dragClass` constants; imports `generateLongPressEvents` from longpress.ts.
- [src/util/overlay.ts](../src/util/overlay.ts) — `overlayMenu`, `confirmStep`, `showToast`; imports `createElement` from dom.ts.
- [src/util/svg.ts](../src/util/svg.ts) — `convertDivToSvg`; imports `htmlToImage` from the npm package.
- [src/util/io.ts](../src/util/io.ts) — `loadJson`, `downloadLs`, `uploadLs`; imports `sanitizeJSON` (sanitize.ts) and `showToast` (overlay.ts).
- [util.js](../util.js) — slimmed from 388 lines to ~22: re-exports every name from the nine TS modules so [main.js](../main.js) and [canvas.js](../canvas.js) keep their `import … from './util.js'` lines unchanged until M5/M6.

Verification:
- `npx tsc --noEmit` clean.
- `npx eslint .` clean.
- `node --check util.js` clean.
- `npm run build` succeeds — 30 modules transformed, single 55.78 kB JS chunk (gzipped 19.72 kB) covering the full graph (main.js → canvas.js / util.js shim → TS modules → dompurify / html-to-image).

Deviations from the plan (intentional, 1:1 behavior preserved):
- **Shim [util.js](../util.js) instead of deleting it.** The plan's layout has `util.js` gone once ports land, but [main.js](../main.js) and [canvas.js](../canvas.js) still run as `.js` files and import from `./util.js` by literal path. Replacing the implementation with a thin re-export preserves their import lines untouched — removes a two-file refactor that doesn't belong in M4. Shim deletes in M6 when [main.js](../main.js) ports to TS.
- **Import paths use explicit `.ts` extension from the shim** (`from './src/util/dom.ts'`). Vite resolves this natively; it makes the fan-out self-documenting and survives tools that don't auto-resolve extensions.

Insights:
- **Non-null assertions everywhere the original JS assumed non-null.** `tsconfig.strict` + `noUncheckedIndexedAccess` flag dozens of "this could be undefined" sites that the original JS implicitly trusted (`stackLines[2]`, `touches[0]`, `elem.parentNode`, `dataUrl.split(',')[1]`). Used `!` rather than adding fallbacks — matches original runtime behavior 1:1, including its edge-case failures. Adding defensive `?? ''` fallbacks would silently change behavior.
- **`confirmStep`'s monkey-patched element state** (`elem.originalText`, `elem.confirming`, `elem.confirmTimeout`) is typed via a `ConfirmableElement extends HTMLElement` interface and a cast at function entry. Clean and keeps the original "patch state directly onto the DOM node" pattern — worth revising in phase 2 but out of scope here.
- **Zero-width space in `convertBR` regex.** Kept; had to be written as `​` in source (the literal character triggers `no-irregular-whitespace`). Functionally identical regex.
- **ESLint flat-config `ignores` list entry for `util.js` still applies** — the shim is brief enough that linting it would add value, but its import specifiers carry explicit `.ts` extensions which the JS parser dislikes if treated as resolvable. Easier to keep it ignored until it's deleted in M6.

Gaps: none. Ready for M5.

---

### M5 — Port canvas.js → src/canvas/*.ts + src/scoring/formula.ts — ✅ done

Landed:
- [src/canvas/Canvas.ts](../src/canvas/Canvas.ts), [Cell.ts](../src/canvas/Cell.ts), [Card.ts](../src/canvas/Card.ts), [PreCanvas.ts](../src/canvas/PreCanvas.ts), [PostCanvas.ts](../src/canvas/PostCanvas.ts) — one file per class, types wired to [src/types/canvas.ts](../src/types/canvas.ts) and [src/types/config.ts](../src/types/config.ts).
- [src/canvas/dragState.ts](../src/canvas/dragState.ts) — module-level `dragState` object + `resetDragState()` replacing the six `static` fields on Cell / Card (`Cell.dragSource/dragDest`, `Card.dragSource/dragDest/dragSourceIndex/dragDestIndex`). `Card.count` stays as a static because [main.js:75](../main.js#L75) still writes it directly — plan only targeted the drag statics.
- [src/scoring/formula.ts](../src/scoring/formula.ts) — `evaluateFormula` extracted from PostCanvas; signature unchanged (`(formula, context) => number`), still reads `score(n)` live from DOM.
- [test/formula.test.ts](../test/formula.test.ts) — 12 Vitest specs covering parser basics (numbers, precedence, parens), context lookup, DOM `score()` integration (with jsdom-backed `<select>` elements), and a preseed-style weighted total from [public/conf/preseed.json](../public/conf/preseed.json). All passing.
- [main.d.ts](../main.d.ts) — type shim for [main.js](../main.js) so canvas TS modules can `import { app, conf } from '../../main'` without enabling `allowJs`. Declares `app`/`conf`/`ctl` as `any` (file-level `eslint-disable` for `no-explicit-any`). Deletes in M6.
- [tsconfig.json](../tsconfig.json) — `main.d.ts` added to `include`.
- [canvas.js](../canvas.js) — slimmed from 458 lines to ~12: re-export shim forwarding `Canvas` / `Cell` / `Card` / `PreCanvas` / `PostCanvas` from the TS modules. Same pattern as M4's `util.js`. Keeps [main.js](../main.js)'s `import … from './canvas.js'` line unchanged until M6.

Verification:
- `npx tsc --noEmit` clean.
- `npx eslint .` clean.
- `npx vitest run` → 12/12 specs in [test/formula.test.ts](../test/formula.test.ts) pass.
- `npm run build` succeeds — 37 modules transformed (up from 30 in M4), single 56.01 kB JS chunk (gzipped 19.90 kB).

Deviations / decisions:
- **`Cell.score` typed as `string | number | undefined`, not `number`.** The legacy runtime actually stores both: initial load assigns a number (from JSON), but the dropdown `change` handler assigns the raw `<select>.value` string. Serialization and DOM reads accept either. Tightening this is phase 2 territory — 1:1 demands keeping the mixed type.
- **`DragState.sourceCell` / `destCell` typed as `string | number | undefined`.** Same reason: `Cell.render`'s `makeDroppable` callback sets the destination to a number (`this.index`), but `Card.render`'s drag callbacks set it to a string (from `getAttribute('data-index')`). The strict `===` in `Canvas.updateDragDrop` depends on this: a card-drop-onto-empty-cell-area always takes the "cross-cell" branch because `"2" === 2` is false — arguably a bug, preserved 1:1.
- **main.d.ts + main.js over a context module.** Plan §M6 flags the circular `main ↔ canvas` import for later cleanup. Writing a context-passing refactor in M5 would mean touching [main.js](../main.js) (M6 work) — out of scope. The `.d.ts` shim gives TS enough type info to compile; Vite resolves the real module at runtime, and the circular structure is inherited unchanged from the pre-migration code.
- **`as unknown as {...}` in the dead `Card.getCellCardPos` static.** The legacy code calls `.cellIndex()` / `.cardCellPos()` on a raw `HTMLElement`, which have no such methods — broken at runtime, but unused anywhere in the app. Kept 1:1 with a cast rather than deleted.

Insights:
- **ES-module live bindings carry the circular import across the port.** [main.js](../main.js) does `let app = undefined` at module-load, then populates after `DOMContentLoaded`. TS modules under [src/canvas/](../src/canvas/) import `app` eagerly but only *read* it inside instance methods (called post-bootstrap). Same lazy access pattern as pre-migration — no changes needed to the runtime structure.
- **`Card.count` readable/writable from main.js.** Keeping it as a TS `static count = 0` preserves the `Card.count = 0` reset-before-Application.create pattern. TS doesn't prevent external writes to non-`readonly` statics — matches JS semantics exactly. Once main.js ports in M6, this can become `private` and expose a `reset()` helper.
- **Formula evaluator's DOM coupling limits testing.** `score(n)` reads `document.getElementById('score${n}')` inside `parseFactor`. jsdom makes this tractable for unit tests (add fake `<select>` elements), but phase 2 should consider passing a `scoreLookup: (n) => number` function to `evaluateFormula` — decouples parser from DOM and simplifies React integration.

Gaps: none. Ready for M6.

---

### M6 — Port main.js → src/main.ts + break the circular import — ✅ done

Landed:
- [src/main.ts](../src/main.ts) — typed `Application` / `Settings` / `Controls`, DOMContentLoaded bootstrap, `beforeunload` auto-save, Ctrl+S/Cmd+S keydown handler. 1:1 with the legacy main.js; behavior preserved including the silent `catch` on save errors, the `conf || new Settings(...)` short-circuit in `Settings.create`, and the ignored param on `newApp.render(defaultConfigName)` (dropped — it was already ignored in the original).
- [src/context.ts](../src/context.ts) — runtime context module. Uses `export let app` + `setApp()` pattern so importers under [src/canvas/](../src/canvas/) get live-binding semantics identical to the pre-migration `export { app } from './main.js'`. Types are intentionally loose (`any`) — typing them would reintroduce the import cycle; phase 2 replaces this with a React context or zustand store. File-level eslint-disable for `no-explicit-any`.
- All five [src/canvas/](../src/canvas/) modules switched from `import { app } from '../../main'` → `import { app } from '../context'`. [PreCanvas.ts](../src/canvas/PreCanvas.ts) tightened: `canvas` field from `unknown` to `string` (it was always a canvas-type identifier string in practice), and the `PreCanvasCtorData` legacy union collapsed to plain `Meta`.
- [src/canvas/Cell.ts](../src/canvas/Cell.ts) constructor's content parameter replaced `Partial<CellData> | readonly never[]` with a dedicated `CellContent` interface that accepts plain JSON, a `Cell` instance (what `restructure` passes), or `[]`. Needed because `Cell.score` uses the wider `Score = string | number | undefined` (runtime mixed-typing) while `CellData.score` is `number | undefined`.
- [index.html](../index.html) loads `./src/main.ts` as the module entry (Vite handles the TS transpilation transparently).

Deleted:
- `main.js`, `util.js` (M4 shim), `canvas.js` (M5 shim), `main.d.ts` (M5 type shim). Plus stale eslint ignores (`main.js`, `canvas.js`, `util.js`) and the tsconfig `main.d.ts` include entry.

Verification:
- `npx tsc --noEmit` clean.
- `npx eslint .` clean.
- `npx vitest run` → 12/12 passing (formula.test.ts unaffected).
- `npm run build` succeeds — 36 modules transformed (37 → 36: the two re-export shims collapsed away), single 56.23 kB JS chunk (gzipped 20.01 kB).
- Zero `.js` files remaining in app source (app root has only config files: [eslint.config.js](../eslint.config.js), [vite.config.ts](../vite.config.ts), [scripts/release.sh](../scripts/release.sh)).

Decisions / deviations:
- **Context module over constructor injection.** Plan allowed either: "pass `app`/`conf` through constructors or a small context module." Constructor injection would have required wiring `app` through every Cell / Card / PreCanvas / PostCanvas method via `this.app` — dozens of edits across five classes, all mechanical, all churn. Context module is one import-path change per canvas file (`'../../main'` → `'../context'`) and keeps the rest of the call sites untouched. Phase 2's React refactor replaces this anyway.
- **`export let` + live bindings instead of getter functions.** The alternative `export function getApp()` would force every call site in canvas files to change (`app.X` → `getApp().X`). `export let app` + `setApp()` preserves the existing call-site syntax exactly, with identical live-binding semantics to what JS modules already provide. Read-only on the import side; writable only via the explicit setter.
- **`any` types in [context.ts](../src/context.ts).** Typing `app` as `Application` would require importing it from main.ts → canvas/*.ts → context.ts → main.ts (cycle). Structural interfaces (`AppLike`) would drag Canvas / PreCanvas / PostCanvas types into the context module — same cycle, one level removed. `any` is the honest escape hatch for an intermediate build step. Phase 2 removes the need entirely.
- **Signature changes from the 1:1 rule (minor):** `Application.render()` dropped the unused `defaultConfigName` arg; `uploadLs()` method on Application was never called (only `Application.downloadLs()` has a matching [Controls](../src/main.ts) button, and even that uses the util helper, not an Application method) — removed. Both are dead-code cleanups that don't alter observable behavior.

Insights:
- **Circular import wasn't actually a runtime problem pre-migration.** [main.js](../main.js) declared `let app = undefined` at load and reassigned after `DOMContentLoaded`; canvas classes imported `app` eagerly but only *read* it inside instance methods that ran post-bootstrap. The cycle was cosmetic — it confused TS's strict analysis more than it confused the runtime. The new `setApp()` pattern makes the timing explicit: bootstrap calls `setApp(newApp)` exactly once after construction completes, and every read thereafter resolves via live binding.
- **`export let` is ES-module-legal and widely underused.** TypeScript's strictness often nudges people toward `export const { app: any }` object patterns, but `export let` with setters is structurally cleaner for small contexts like this. Worth remembering.
- **Re-export shims were a cheap port scaffold.** M4's [util.js](../util.js) and M5's [canvas.js](../canvas.js) shims bought uninterrupted runtime compat across three milestones while the underlying modules were being typed piece by piece. At M6 they vanish without ceremony. Pattern worth repeating any time a large module tree is being typed incrementally.
- **Vite does TS-entry modules natively.** `<script type="module" src="./src/main.ts">` works in dev and build — no loader config needed. A subtle "TS-ifying existed all along" moment that's easy to miss coming from older build toolchains.

Gaps: none. **Phase 1 M6 done — every `.js` source is now `.ts`, the app runs through a single typed entry.**

---

### M7 — Port Jasmine specs → Vitest + jsdom — ✅ done

Landed:
- **main.ts split into app.ts + main.ts.** [src/app.ts](../src/app.ts) holds the `Settings` / `Application` / `Controls` classes (side-effect-free, exported). [src/main.ts](../src/main.ts) is now a ~55-line bootstrap that just wires up DOMContentLoaded, beforeunload, and Ctrl+S. Tests import the classes directly without the bootstrap firing.
- [test/helpers.ts](../test/helpers.ts) — fixture loading (`loadFixture`), fetch mock (`installFetchMock` — serves files from `public/` based on the requested path), Application bootstrap (`bootstrapApp` — resets DOM + localStorage, loads fixtures, creates `Settings` + `Application`, writes them to context), and a `flush()` microtask-drain helper for async paths.
- [test/load.test.ts](../test/load.test.ts) — ports `LoadSpec`: initial-state assertion (title, cells[4].cards[1]) and save → clear → load round-trip.
- [test/card.test.ts](../test/card.test.ts) — ports `CardSpec`: edit, remove, add, and the `:?` type-command card-class assertion.
- [test/interact.test.ts](../test/interact.test.ts) — ports `InteractSpec`: help-overlay dblclick toggle and score-change → total-update propagation.
- **Jasmine artifacts deleted:** [test/CardSpec.js](../test/CardSpec.js), [test/InteractSpec.js](../test/InteractSpec.js), [test/LoadSpec.js](../test/LoadSpec.js), [test/lib/](../test/lib/) (vendored Jasmine 5.1.2). Stale `test/**/*.js` entry removed from [eslint.config.js](../eslint.config.js) ignores.
- **File rename:** `src/canvas/dragState.ts` → [src/canvas/DragState.ts](../src/canvas/DragState.ts) for casing consistency with the other files in [src/canvas/](../src/canvas/) (Canvas, Cell, Card, PreCanvas, PostCanvas). Imports in Canvas.ts / Card.ts / Cell.ts updated.

Verification:
- `npx tsc --noEmit` clean.
- `npx eslint .` clean.
- `npx vitest run` → **20/20 passing** (12 formula + 2 load + 4 card + 2 interact).
- `npm run build` succeeds — 37 modules transformed, 56.26 kB bundle (20.02 kB gzipped).

Deviations / decisions:
- **`main.ts` split into `app.ts` + `main.ts`** (not in the plan, but forced by testability). Importing main.ts registers a DOMContentLoaded listener that fetches model/config JSON over the network; at test-time that fails and pollutes with console.error. Splitting separates the classes from the bootstrap cleanly. Bonus: `main.ts` is now a 55-line entry point that's trivial to reason about. Phase 2 React refactor lands classes in components anyway.
- **Interact score test rewritten, not literally ported.** The original [test/InteractSpec.js](../test/InteractSpec.js) checked `helpElem.getAttribute('display')` — which always returns `null` (`display` is a CSS property, not an HTML attribute), so the original assertion was a tautology that never failed. Ported to check `helpElem.style.display` — the property the app actually sets. Applied to the original Jasmine runner, the new assertion would have exposed the bug; applied to our Vitest port, it passes.
- **LoadSpec round-trip needed an explicit title in `loadFromLs`.** `app.clear()` resets `meta.title` to `'Company name'`, so the no-arg `app.loadFromLs()` call in the original Jasmine spec couldn't have found the saved `'Example Startup'` record — the test was aspirational. Ported test passes `'Example Startup'` explicitly, matching the obvious intent.
- **Map-backed `localStorage` polyfill in tests.** Node 22's experimental `localStorage` leaks into the vitest+jsdom environment as a plain object without `getItem` / `setItem` / `removeItem` / `clear` methods. [test/helpers.ts](../test/helpers.ts) installs a small Map-backed stub via `Object.defineProperty(globalThis, 'localStorage', …)` before bootstrap. Scoped to the test helper — zero impact on the real app which uses browser-native localStorage.
- **Fetch mock keys off the URL path.** The app calls `fetch('conf/foo.json')`; under jsdom those URLs are relative to `document.URL` (about:blank or similar). The mock regex-matches the `(conf|models)/...` tail of whatever URL arrives and reads from the matching `public/` file. Robust to jsdom's base-URL behavior.
- **`dragState.ts` → `DragState.ts`** for filename casing consistency — requested inline while M7 was in progress. Import sites updated via sed.

Insights:
- **The original Jasmine tests depended on a full-browser harness** (the deleted `canvas_test.html` loaded the app and then Jasmine over it). Vitest + jsdom gives the same reach without a browser, but the harness-gone means *we* bootstrap the app in each test — which surfaces a clear line between "app setup" (helpers.ts) and "assertions" (the spec bodies). Cleaner than the Jasmine setup, which relied on global `app` / `ctl` / `Card` from the test runner.
- **Two real bugs discovered in the original specs.** The overlay test used the wrong API (`getAttribute('display')`), and the save-load round-trip assumed a title resolution that `clear()` invalidates. Both are latent bugs in the *tests*, not the app — but the Vitest port surfaces them because strict comparisons fail loudly where silent null/undefined in the original passed by accident.
- **`Application.loadFromLs` is fire-and-forget.** It kicks off a `fetch().then(...)` chain but returns `void`. Tests work around this with a small `flush()` (20ms setTimeout) — enough for microtasks and the mocked fetch to drain. A phase-2 refactor should promisify this; the callers in Controls are all `.bind(app)` callbacks that don't need a return value, so the refactor is cheap.
- **`Object.defineProperty(globalThis, 'localStorage', …)`** is the right pattern for jsdom-quirk workarounds. Direct assignment silently fails because `globalThis.localStorage` has an unwritable descriptor in some Node / jsdom combos. `defineProperty` with `writable: true, configurable: true` overrides cleanly.

Gaps: none. Phase 1 tests green; ready for M8 release verification.

---

### M8 — Release verification — ◯ partially done (docs updated; two blockers for dry-run)

Landed:
- [README.md](../README.md) fully rewritten. Stale refs (`main.js`, `util.js`, `canvas.js`, `network.js`, `lib/`, `canvas_test.html`, `python3 -m http.server`, migration note) gone. New structure: Getting started, Project layout (TS tree), URL parameters, Interaction model, Controls, Data format, Testing, Release / deployment, Notes. Points at [doc/ARCH.md#deployment](ARCH.md) for release details.
- [ARCH.md](ARCH.md) reviewed — no stale references; document was written to target-state so the finished phase-1 port already matches. Release-script section already specifies the exact behavior implemented in [scripts/release.sh](../scripts/release.sh).
- Automated verification run: `tsc`, `eslint`, `vitest` (20/20), `vite build` all clean against HEAD.

**Asset / deploy decisions** (resolved after the docs rewrite):

1. **`base: '/'` kept in [vite.config.ts](../vite.config.ts).** User's call: the canvas deploys at the *root* of its own target (whether that's a standalone subdomain, `/canvas/` mounted via reverse-proxy rewrite, or the root of the `canvas/` dir copied into the parent site — all three resolve `/assets/index-*.js` correctly because the canvas is served at `/`). This inverts the M1 deviation's eventual resolution — turns out `/canvas/` was never the right `base`; the canvas just needs to be served *at* its own root.

2. **`global/` moved into [public/global/](../public/global/) and fonts into [public/fonts/](../public/fonts/).** User's call (from option (b) of the previously-open list). The chrome is now a first-class part of the canvas deploy, no dependency on anything the parent site serves. Absolute paths everywhere:
   - `global/{aurora.css, aurora.js, script.js, styles.css, unlost.svg}` → [public/global/](../public/global/)
   - `global/fonts/Montserrat/` → [public/fonts/Montserrat/](../public/fonts/)
   - [public/global/styles.css](../public/global/styles.css) `@font-face` url updated from `/global/fonts/…` to `/fonts/…` via `sed`.
   - [index.html](../index.html) refs changed from relative `global/*` to absolute `/global/*` (so Vite leaves them alone as public-served assets instead of trying to bundle them and failing because the old path doesn't exist).
   - [.gitignore](../.gitignore) adds `.DS_Store` so macOS metadata doesn't leak into `dist/`.

Served layout in `dist/`:

| Asset | Path | How |
|---|---|---|
| App JS + canvas/layout CSS | `/assets/index-*.{js,css}` | bundled by Vite |
| Chrome styles | `/global/{styles,aurora}.css` | public-served |
| Chrome scripts | `/global/{script,aurora}.js` | public-served |
| Logo | `/global/unlost.svg` | public-served |
| Fonts | `/fonts/Montserrat-*.ttf` | public-served, referenced by `/global/styles.css` `@font-face` |
| Canvas configs | `/conf/*.json` | public-served |
| Canvas models | `/models/*.json` | public-served |

Build is now warning-free (the previous `can't be bundled without type='module'` warnings for the chrome scripts are gone because Vite treats absolute paths as public-served, not bundle candidates). Bundle numbers: HTML 7.01 kB (was 12.63 kB — dropped the inline SVG for the logo, it's now served as a file), CSS 9.35 kB (was 12.87 kB — chrome CSS served separately, not in the app bundle), JS 56.26 kB unchanged.

**Manual steps remaining** (require a browser + the parent-site checkout — can't automate):

- Run `scripts/release.sh ../unlost.ventures` (or the actual parent-site path). Confirm: build succeeds, `canvas/` cleared, `dist/` copied, `canvas/VERSION` written with the right commit hash.
- Walk the phase 1–2 equivalence checklist from [PLAN.md](PLAN.md) against the deployed URL: load every config in [public/conf/](../public/conf/), drag cards (desktop + touch long-press), save/load via LS controls, export SVG, round-trip a pre-migration saved canvas if one exists, verify the `?model=...&config=...&debug=...` URL params behave.

Gaps: just the dry-run + manual walkthrough.

---

## Phase 1 status

| Milestone | Status |
|---|---|
| M1 Tooling | ✅ |
| M2 Repo split | ✅ (chrome retained) |
| M3 Type definitions | ✅ |
| M4 util.js port | ✅ |
| M5 canvas.js port + scoring extraction | ✅ |
| M6 main.js port + circular-import removal | ✅ |
| M7 Tests (Vitest + jsdom) | ✅ |
| M8 Release verification | ◯ docs + assets in place; manual dry-run + equivalence walk pending |

---

## Phase 2

### M1 — State store + persistence — ✅ done

Landed:
- [src/state/store.ts](../src/state/store.ts) — hand-rolled `useSyncExternalStore`-compatible store holding `{ meta, cells, analysis, config }`. Pure data. Functional actions:
  - `init(config, content)` — load state from a config + model pair (matches pre-phase-2 `Application.create → Canvas ctor` exactly).
  - Card: `addCard`, `updateCard`, `removeCard`, `moveCard`.
  - Cell / meta: `setScore`, `setMeta`, `setAnalysis`.
  - Structural: `changeType` (rebuilds cells from new config, preserves cards by positional index — matches `Application.restructure`), `clearAll` (empties cards, zeros scored cells).
  - Persistence: `saveToLs(title?)`, `loadFromLs(title)` — same `preseedcanvas` localStorage key, same JSON shape, `sanitizeJSON` on load.
  - Store API: `getState()`, `subscribe(listener)`, `toCanvasState(s)` (adapter back to the `{ meta, canvas, analysis }` shape for serialization).
  - All mutations assign a new top-level state object; untouched branches keep referential equality (ready for React's reconciler + `useSyncExternalStore`).
- [src/state/persistence.ts](../src/state/persistence.ts) — `enablePersistence()` / `disablePersistence()` / `isPersistenceEnabled()`. Attaches `beforeunload` (silent save) and `Ctrl+S` / `Cmd+S` (save + "Saved" toast) listeners. Not wired at import — must be explicitly enabled once phase-2 M6 swaps out the pre-phase-2 listeners in [main.ts](../src/main.ts), otherwise they'd double-save.
- [test/store.test.ts](../test/store.test.ts) — **19 specs** exercising every action + the subscribe/unsubscribe lifecycle + structural equality for untouched branches. Uses the fetch/localStorage helpers from [test/helpers.ts](../test/helpers.ts).
- [test/helpers.ts](../test/helpers.ts) — `installLocalStorageStub` exported (was previously a local function).
- [src/types/canvas.ts](../src/types/canvas.ts) — `Cell.score` widened from `number | undefined` to `number | string | undefined` to match the legacy runtime (the `<select>` change handler assigns `select.value`, a string). Aligns the data type with what [Cell.ts](../src/canvas/Cell.ts) has been computing all along.

Verification:
- `npx tsc --noEmit` clean.
- `npx eslint .` clean.
- `npx vitest run` → **39/39** (20 phase-1 + 19 store).
- `npm run build` unchanged (store isn't imported by the runtime yet).

Decisions / deviations:
- **Hand-rolled `useSyncExternalStore` pattern, not zustand.** Plan allowed either. The subscribe + getState + setState trio is ~10 lines; zustand adds 1.1 kB gzipped and a learning tax for future contributors. Fits the "no extra dependencies" posture the project has carried through phase 1.
- **`moveCard` API uses clean post-removal `toIndex` semantics**, not the legacy "toIndex = drop target's post-insertBefore position, minus one" quirk. The legacy code's semantics were an artifact of coupling state updates to DOM manipulations that already ran — the pure-data API shouldn't inherit that. Phase-2 M3 drag hooks translate gesture coordinates into the flat index that `moveCard` expects; the end-state per gesture stays identical.
- **Store holds `config` alongside state.** Not strictly in the plan (plan says "holding `CanvasState`"), but `changeType` needs the new config to rebuild cells, and React components in M2 will need config for cell titles / help text / scoring formulas. Holding it is cleaner than passing it through every selector.
- **Persistence doesn't auto-attach.** Import has no side effects. Enabling requires `enablePersistence()`. Prevents double-save during the coexistence window with phase-1 `main.ts`.
- **`saveToLs` without a title is a no-op** (matches legacy: no save if `app.meta.title` is empty). `loadFromLs` returns the loaded `CanvasState` so callers can fetch a matching config when the canvas-type identifier changed.

Insights:
- **Structural equality for untouched branches is cheap when you're already using spread-based immutability.** The test `preserves referential equality for untouched cell branches` pins this down: `addCard(cell0.id)` changes `cells[0]` and the top-level `cells` array, but `cells[1]` remains the same object reference. `useSyncExternalStore`'s default `getSnapshot` strict-equality check exploits this — React can skip re-rendering components that only read from unchanged cells.
- **Legacy score typing was always a union, just not declared as one.** `Cell.score` in [src/types/canvas.ts](../src/types/canvas.ts) said `number | undefined`, but [src/canvas/Cell.ts](../src/canvas/Cell.ts) used a local `Score = string | number | undefined` because the real runtime assigns `<select>.value`. Aligning the declared type removes the mismatch and un-blocks reusing the type in the store. Phase-2 can tighten once the `<select>` handler coerces with `Number()`.
- **The no-deps store doubles as the adapter surface for future zustand migration.** If the project ever grows beyond this and wants dev-tools or persistence middleware, swapping in zustand only touches the 3 functions (`getState`, `subscribe`, and internal `setState`); action bodies stay identical.

Gaps: none. Ready for M2 (presentational React components subscribing via `useSyncExternalStore`).

---

### M2 — Dumb React components — ✅ done

Landed:
- **React toolchain installed.** `react@19.2`, `react-dom@19.2`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react@6`, `@testing-library/react@16.3`. [vite.config.ts](../vite.config.ts) wires the React plugin (covers dev HMR, production build, and Vitest's JSX transform). [tsconfig.json](../tsconfig.json) adds `"jsx": "react-jsx"`.
- [src/state/useStore.ts](../src/state/useStore.ts) — `useStore(selector)` hook wrapping `useSyncExternalStore` against the M1 store.
- Six presentational components under [src/components/](../src/components/), all 1:1 with the legacy DOM so phase-1 CSS still applies:
  - [Card.tsx](../src/components/Card.tsx) — `<div class="card[ TYPE]">` with NL→`<br>` via `convertNL`.
  - [Cell.tsx](../src/components/Cell.tsx) — title, optional scoring dropdown, hover-help overlay (DOM present, toggle in M4), card list.
  - [Canvas.tsx](../src/components/Canvas.tsx) — `<div id="canvas" class="{canvasclass}">` grid of cells.
  - [PreCanvas.tsx](../src/components/PreCanvas.tsx) — always-rendered title; description only when `display`.
  - [PostCanvas.tsx](../src/components/PostCanvas.tsx) — returns null when `display=false`; placeholder `0.0` score span (real `evaluateFormula` wire-up is M3/M5).
  - [Controls.tsx](../src/components/Controls.tsx) — button bar + hidden `<input type="file">`; dumb (no click handlers).
- [App.tsx](../src/components/App.tsx) — top-level composition. Reads `meta` / `cells` / `analysis` / `config` from the store and fans them down to child components. Returns null until config is initialized.
- [test/components.test.tsx](../test/components.test.tsx) — **18 specs** across all components plus App. Uses `@testing-library/react`. Covers: class names / IDs / data-index, conditional rendering (score dropdown, file-menu buttons, display flags), store-driven re-render under `act()`.

Verification:
- `npx tsc --noEmit` clean.
- `npx eslint .` clean.
- `npx vitest run` → **57/57** (20 phase-1 + 19 store + 18 components).
- `npm run build` → 35 modules, 56.26 kB bundle, **unchanged from pre-React**. The components aren't imported by [main.ts](../src/main.ts) yet, so Rollup tree-shakes them out along with React itself. Phase-2 M6 will mount `<App />` and the bundle will pick up React.

Decisions / deviations:
- **Components live alongside the phase-1 imperative app, not inside it.** Nothing in [main.ts](../src/main.ts) imports from [src/components/](../src/components/). The running app is still the imperative `Application` / `Canvas` / `Cell` / `Card` classes from phase 1 — swapping happens in M6 after hooks (M3) and overlays (M4) land. Building the React tree alongside lets M3/M4/M5 stack on top without breaking anything in between.
- **`dangerouslySetInnerHTML` where legacy used `innerHTML`.** Card content, PreCanvas description, PostCanvas analysis, and Cell help description all go through it. Contents were already sanitized on store write, so no additional sanitization on render. Preserves legacy HTML rendering (links in help, `<br>` for newlines) without parsing into React nodes — a phase-2-later cleanup if desired.
- **Score select is controlled with a no-op `onChange`.** Dumb component contract: read-only from user perspective, reactive to store updates. `readOnly` on `<select>` in React doesn't suppress the controlled-input warning reliably across versions; `onChange={() => undefined}` does. M3 replaces it with the real handler.
- **Score total placeholder `0.0` in PostCanvas.** The legacy `evaluateFormula` reads live from the DOM via `document.getElementById`, so computing during render would see empty values (React's commit phase hasn't landed yet). Deferred to M3/M5 when the score dropdown has a real change handler that can trigger a re-compute.
- **Card uses index-as-key.** Not ideal for stable identity across reorders — cards don't currently have an id. M3 drag/drop may add a stable `cardId` to the store if re-ordering causes React to lose edit state or focus.

Insights:
- **The subscribe-based store composes cleanly with React 19's `useSyncExternalStore`.** No extra boilerplate. The store's structural equality for untouched branches means components that only read `s.meta` don't re-render when a card is added — same "only-affected-subtrees re-render" behavior zustand or Redux-toolkit would deliver, without a library.
- **`act()` is required for store mutations triggered outside React.** The re-render test initially failed because store.addCard notifies listeners synchronously, but React 18+ batches the state update to the next tick. Wrapping the mutation in `act()` from `@testing-library/react` forces the update to flush synchronously for assertions. Real runtime doesn't need `act()`; only tests do.
- **React 19's JSX transform means no `import * as React from 'react'` at the top of every file.** With `"jsx": "react-jsx"` in tsconfig, only hooks and types need explicit imports. Files stay tight.
- **The "unused import gets dead-code-eliminated at build time" story is clean.** The new dependencies are heavy (React ~40 kB gzipped on its own), but because [main.ts](../src/main.ts) doesn't touch the components, Rollup omits them. Bundle size sits at 20 kB gzipped until phase-2 M6 actually mounts `<App />`.

Gaps: none. Ready for M3 (editable + drag/drop hooks).

---

### M4 — Overlays and menus — ✅ done

Landed:
- [src/components/HoverHelp.tsx](../src/components/HoverHelp.tsx) — `<div class="hover-help">` with optional `<h4>` / `<p>`, visibility via `open` prop. Dumb.
- [src/components/ConfirmStep.tsx](../src/components/ConfirmStep.tsx) — click-twice-to-confirm button. First click shows `Label?` in red and arms a timeout; second click fires `onConfirm` and resets. Optional `stopPropagation` prop for nesting inside other clickable containers. Matches the legacy `confirmStep` util 1:1.
- [src/components/OverlayMenu.tsx](../src/components/OverlayMenu.tsx) — popover menu rendered via `createPortal` into `document.body`. Position computed in `useLayoutEffect` from the trigger's bounding rect (above the trigger, clamped to scrollY). Click-outside listener closes. Per-item Delete uses `<ConfirmStep stopPropagation>` so the delete click doesn't also fire item select.
- [src/components/Toast.tsx](../src/components/Toast.tsx) — single toast, portal-rendered, auto-hides after `duration`, dismisses on the hide-transition end.
- [src/components/ToastContainer.tsx](../src/components/ToastContainer.tsx) — fan-out host + module-level `showToast(message, isError?)` entry point. Signature matches the legacy `showToast` so imperative call sites port without change; no-op when no container is mounted.
- [src/components/Cell.tsx](../src/components/Cell.tsx) updated to use `<HoverHelp>` instead of an inline `div.hover-help`; added `onDoubleClick` on the title that toggles the help overlay (mirrors the legacy dblclick trigger; long-press wiring is M3 via `useLongPress`).
- [test/overlays.test.tsx](../test/overlays.test.tsx) — 13 specs across the four components (dumb display, portal mounting, click-outside close, confirm-twice flow, propagation blocking, toast enqueue + no-container no-op). One new spec in [test/components.test.tsx](../test/components.test.tsx) covers the Cell dblclick-toggle wiring.

Verification:
- `tsc --noEmit` ✓, `eslint .` ✓
- `vitest run` → **73/73 passing** (20 phase-1 + 19 store + 19 components + 14 overlays + 1 Cell-toggle)
- `npm run build` → 33 modules, 56.26 kB JS. React + overlay components still tree-shaken out until M6 mounts `<App />` + `<ToastContainer />`.

Alongside: `canvas.css` + `layout.css` moved [styles/](.) → [public/styles/](../public/styles/) and the `<link>` refs in [index.html](../index.html) rewritten to absolute `/styles/...`. Consistent with the other public-served assets (`/global/*`, `/fonts/*`). Vite no longer bundles them into `/assets/index-*.css` — they ship as static files, same pattern as the chrome assets.

Decisions / deviations:
- **`HoverHelp`'s visibility via inline `style.display`** (not a CSS class toggle) matches the legacy `helpDiv.style.display = 'block' / 'none'` pattern. A class-based variant (`.hover-help.open`) would be cleaner but requires touching `canvas.css`, and the 1:1 rule applies.
- **Long-press not wired into Cell yet.** The legacy help-overlay toggle also fires on long-press (`addLongPressListener(parent, hoverHelp)`); that wiring needs the M3 `useLongPress` hook. Cell's dblclick toggle ships in M4; `useLongPress` binding lands in M3.
- **`showToast` kept as a module-level function, not a context/provider.** A `ToastProvider` + `useToast()` hook would be more idiomatic React, but changes the call-site ergonomics — every imperative caller (phase-1 `app.ts`, future non-component code) would need to receive the hook. Module-level matches the legacy API exactly; callers port without changes. Slight quirk: only one `ToastContainer` can be active at a time; the mount/unmount effect claims and releases the module's `pushToast` binding.
- **Toast CSS transition test dropped.** The legacy pattern is: mount → next-frame add `.toast-visible` (triggers CSS transition) → `setTimeout(duration)` remove class (triggers hide transition) → `transitionend` → remove from DOM. Testing all of that with fake timers + `requestAnimationFrame` fakery + `act` is fragile and implementation-coupled. Tests verify the observable DOM (toast mounts, message text, error class) and leave the visual transition to CSS/e2e.
- **`OverlayMenu` includes `position: absolute` inline** so the portal placement works without needing `.overlay-menu` CSS to already specify `position`. The legacy util did the same. If `canvas.css` already sets `position: absolute`, this is redundant but harmless.

Insights:
- **Portal + position-via-useLayoutEffect is the right recipe for anchored popovers.** Rendering to `document.body` escapes parent `overflow: hidden`; measuring via `useLayoutEffect` runs after the portal commits but before paint, so the measured rect is accurate without a flash. Computing `rect.top - menu.offsetHeight` once on open matches the legacy behavior — it doesn't reposition on scroll. Good enough for this app; phase-3 should consider floating-ui if complex positioning is needed.
- **`fireEvent.click(container.querySelector('div > div'))` picks the first matching div, not the nested one.** CSS selector `div > div` matches EVERY div whose parent is a div, and `querySelector` returns the first. Initial test selector was ambiguous — giving the inner element a dedicated class fixed it. Worth remembering: rely on explicit `data-testid` or className instead of structural selectors when interacting with nested elements.
- **React 19's SyntheticEvent `stopPropagation` works across portal boundaries the same way it works within a tree** — parents in the React tree (not the DOM tree) still don't receive events that a descendant stopped. The ConfirmStep-inside-OverlayMenu delete button needs `stopPropagation` because the `onClick` on the menu item is a React handler on a tree ancestor of the ConfirmStep portal-less child.

Gaps: none. Ready for M3 (editable + drag/drop hooks) — will add `useEditable`, `useDragDrop`, `useLongPress`. `useLongPress` in particular will supplement Cell's dblclick toggle with a long-press alternate trigger, matching legacy behavior on touch.

---

### M3 — Editable + drag/drop hooks — ✅ done

Landed:
- [src/hooks/useLongPress.ts](../src/hooks/useLongPress.ts) — mouse + touch long-press with 10 px move-cancel threshold. Callback captured via a ref so identity changes don't re-attach listeners. Full cleanup on unmount (listeners removed, pending timer cleared).
- [src/hooks/useEditable.ts](../src/hooks/useEditable.ts) — `contenteditable="true"` + Enter inserts `<br><br>` via Selection/Range API + blur fires `onCommit(innerHTML)`. Cleans up on unmount.
- [src/hooks/useDragDrop.ts](../src/hooks/useDragDrop.ts) — `useDraggable(ref, source, opts)` + `useDroppable(ref, onDrop)`. Module-level `currentSource` tracker coordinates between them. When `longPressMs > 0`, drag initiation is gated on a mouse- or touch-long-press (same threshold as `useLongPress`) instead of native `dragstart`. Drop bubbling: card's drop handler fires first, clears `currentSource`; cell's handler sees `null` and skips — no caller-side filtering needed.
- [src/components/Card.tsx](../src/components/Card.tsx) rewritten to use the hooks. Edit commit parses prefix commands (`:?`, `:!`, `:=`, `:*`, `:-`) and dispatches `updateCard` or `removeCard`. Drag + drop-on-card dispatches `moveCard` with the proper post-removal `toIndex` (accounts for same-cell forward shift).
- [src/components/Cell.tsx](../src/components/Cell.tsx) updated: `useLongPress` on title (help toggle, alternate to dblclick) and on the card container (create card). `useDroppable` on the container handles drop-on-empty-area → append. Score select dispatches `setScore`; dblclick on container empty area dispatches `addCard`.
- [src/components/PreCanvas.tsx](../src/components/PreCanvas.tsx) + [src/components/PostCanvas.tsx](../src/components/PostCanvas.tsx) — `useEditable` on title / description / analysis paragraphs, dispatching `setMeta` / `setAnalysis`. Title uses textContent (plain text); description + analysis use innerHTML (BR-preserved).
- Store's `Card.tsx` (and the editable-bearing components) set DOM content imperatively via `useEffect` on the relevant field, not via JSX children. This avoids React's reconciler touching the contenteditable DOM mid-edit (the classic "React fights with contenteditable" footgun).
- [test/hooks.test.tsx](../test/hooks.test.tsx) — **11 specs** covering long-press fire/cancel paths (movement, mouseup, non-left button), editable contenteditable setup + blur commit + Enter-insert-BR + shift-Enter pass-through, and drag-drop source/target coordination (draggable attr, onDrop with source record, highlight class lifecycle).
- [test/components.test.tsx](../test/components.test.tsx) Card tests updated to pass the new `cellId` / `cardIndex` props.

Verification:
- `npx tsc --noEmit` clean.
- `npx eslint .` clean.
- `npx vitest run` → **84/84 passing** (73 prior + 11 hooks).
- `npm run build` → 33 modules, 56.26 kB. Bundle unchanged — hooks + interactive components still unmounted; M6 brings them live.

Decisions / deviations:
- **Module-level `currentSource` in `useDragDrop`** instead of React context. HTML5 drag-drop only allows one active drag at a time, so a single module-level slot is faithful to the hardware constraint and matches the legacy `Cell.dragSource` / `Card.dragSource` statics. A React context would be strictly unnecessary overhead.
- **Ref-based innerHTML updates, not `dangerouslySetInnerHTML`.** For every editable element (Card, PreCanvas title + description, PostCanvas analysis), the component renders the root tag empty and a `useEffect` writes `innerHTML` (or `textContent` for plain-text title) on prop change. This pattern avoids React reconciling the DOM subtree when the user is mid-edit — a dangerous interaction where React would overwrite in-progress typing.
- **Long-press handler duplicates useLongPress logic inside useDraggable** when `longPressMs > 0`. Could call `useLongPress` from inside `useDraggable`, but hooks must be called unconditionally — passing a huge duration when longPressMs=0 to effectively disable is uglier than duplication. ~20 lines duplicated, kept inline.
- **Hooks return void, not a ref.** `useEditable(ref, onCommit)` expects an already-created ref. Callback-ref pattern (`const editableRef = useEditable(...)`) would handle conditionally-mounted elements cleanly — worth considering in phase 3 refactor.
- **`Card` prop signature widened** from `{ card }` to `{ card, cellId, cardIndex }`. Drag source needs the positional identity; pre-existing M2 Card tests updated with the new props.
- **Conditionally-rendered editable children** (`{display && <p ref={descRef} />}` in PreCanvas) have a quirk: if `display` toggles at runtime, the useEffect for contenteditable setup doesn't re-run (ref object identity is stable). In practice `display` is driven by config at load time and doesn't toggle dynamically — acceptable limitation, noted for phase-3 cleanup.

Insights:
- **`pageX` is a getter in jsdom.** `fireEvent.mouseMove(el, { pageX: 20 })` doesn't set pageX directly — jsdom's MouseEvent derives `pageX` as `clientX + scrollX`. Tests need to pass `clientX` for the hook's `me.pageX` reads to return non-zero values. One failing test until this was figured out.
- **Passing refs-as-dependencies to useEffect is stable by identity** (the ref OBJECT doesn't change across renders), so the effect runs once on mount. This is why the hook pattern works reliably for always-mounted refs and why conditionally-mounted refs need callback refs instead.
- **React 19's SyntheticEvent + HTML5 native drag events interop cleanly.** `fireEvent.dragStart` / `fireEvent.drop` trigger the native listeners the hooks attach via `addEventListener` (not React's delegated system). No SyntheticEvent wrapping issues here because the hooks bypass React's event system entirely — they attach raw DOM listeners.
- **Store-driven re-render + imperative DOM update don't fight each other** as long as the effect only fires on *prop change*. Card's `useEffect(..., [card.content])` runs only when content actually changes in state — not during user edits (which mutate DOM without changing state until blur). On blur, dispatch fires, state updates, prop changes, effect runs, DOM snapped to sanitized value. Clean cycle.

Gaps: none. Ready for M5 (Controls panel wiring).

---

### M5 — Controls panel — ✅ done

Landed:
- [src/components/Controls.tsx](../src/components/Controls.tsx) rewritten from the M2 dumb button set to fully-wired handlers. Every legacy `Controls.render` behavior mapped to a store action:
  - `Clear Canvas` / `Save to LS` / `Clear LS` / `Export SVG` / `Export LS` → `<ConfirmStep>` (click-twice) dispatching `clearAll` / `saveToLs` / `clearLocalStorage` / `convertDivToSvg` / `downloadLs`. Each fires `showToast(...)` after.
  - `Canvas Type` / `Load from LS` → toggle `<OverlayMenu>`. Canvas-type menu reads the list from `useStore(s => s.canvasTypes)`; load menu reads saved canvas names directly from localStorage.
  - Menu-item select fires `loadJson(...)` then `changeType(cfg)` (Canvas Type) or `init(cfg, content)` (Load from LS, since meta may differ).
  - Per-item Delete on the Load menu uses nested `<ConfirmStep stopPropagation>` → removes the entry from the LS dictionary.
  - `Import LS` → hidden file input with `onChange` calling `uploadLs(event.nativeEvent, LS_KEY)`; UI triggered via `fileInputRef.current?.click()`.
- [src/components/App.tsx](../src/components/App.tsx) — mounts `<ToastContainer />` so the `showToast` calls from Controls have somewhere to land.
- Store extensions in [src/state/store.ts](../src/state/store.ts):
  - `AppState.canvasTypes: CanvasTypesList` + `setCanvasTypes(list)` — populated once at bootstrap from `conf/configs.json`; `init` preserves it.
  - `clearLocalStorage()` action for the Clear LS button.
- [test/helpers.ts](../test/helpers.ts) — `bootstrapApp` also sets `canvasTypes` on the phase-2 store.
- [test/controls.test.tsx](../test/controls.test.tsx) — **11 specs** covering every handler path (Clear/Save/Clear LS confirm-twice, single-click is a no-op, Canvas Type menu open+toggle+select, Load from LS name list + per-item Delete, filemenu on/off).

Verification:
- `npx tsc --noEmit` clean.
- `npx eslint .` clean.
- `npx vitest run` → **95/95 passing** (84 prior + 11 controls).
- `npm run build` → 33 modules, 56.26 kB. React tree still unmounted; M6 brings it live.

Decisions / deviations:
- **`canvasTypes` in the store, not in Controls-local state.** Could have fetched `conf/configs.json` inside Controls on mount (lazy). Storing at the app level matches the legacy pattern (`conf.canvasTypes`) and lets other components reach for it later (e.g., a future "canvas type indicator" in the signature area).
- **`Load from LS` reads localStorage directly, not via `store.loadFromLs`.** The store action updates state synchronously with the LS content, but the actual load needs to fetch the matching config first; doing that on top of a state update would flash old-config + new-content. Reading LS raw and dispatching `init(cfg, content)` atomically produces one clean state change.
- **No "clicked" flash effect.** Legacy adds a `.clicked` class for 500 ms on every button click for visual feedback. Skipped in M5 — visually minor, easy to add later (an `onClick` wrapper that toggles a class or a dedicated hook). Noted as a phase-2 polish item.
- **No connection to `persistence.ts` yet.** `enablePersistence()` (beforeunload + Ctrl+S auto-save) remains uncalled. Enabling it now would double-save against the still-active phase-1 `main.ts` listeners. M6 swaps those out; the effect lands in App at that point.
- **Toggle click on trigger doesn't race with OverlayMenu's click-outside handler.** The overlay's handler early-returns when the click target is inside `triggerRef.current`; the button's `onClick` then flips `openMenu` state. Tested and works as expected.

Insights:
- **Explicit JSX per button beats `buttons.map(...)` once behaviors diverge.** The M2 dumb version could use a uniform map because every button was a `<div>`. M5 has three shapes (ConfirmStep, plain div with onClick, plain div with ref+onClick) plus conditionally-rendered file-menu buttons — a map over a discriminated union works but reads no better than straight JSX. The data-driven version returns if the button set grows large.
- **`OverlayMenu` slots cleanly into Controls without changes.** The M4 API (`open` / `triggerRef` / `items` / `onSelect` / `onDelete` / `onClose`) covers both menus with zero conditional logic in the component itself. Confirms the M4 abstraction was right-sized.
- **`ConfirmStep`'s click-twice semantics work inside Controls without wrapping.** One render per ConfirmStep (primed ↔ idle), state tracked internally; parent just provides the action. No need for a shared "confirming" state across buttons.

Gaps: none. Phase 2 M6 mounts everything and retires the phase-1 imperative app.

---

## Phase 2 status

| Milestone | Status |
|---|---|
| M1 State store + persistence | ✅ |
| M2 Dumb components | ✅ |
| M3 Editable + drag/drop hooks | ✅ |
| M4 Overlays and menus | ✅ |
| M5 Controls panel | ✅ |
| M6 Tests | ⬜ |

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

## Up next

M6 — port [main.js](../main.js) → `src/main.ts`. Removes the circular `main ↔ canvas` import, deletes [main.d.ts](../main.d.ts) and the [util.js](../util.js) / [canvas.js](../canvas.js) shims, switches [index.html](../index.html) to load `./src/main.ts` directly.

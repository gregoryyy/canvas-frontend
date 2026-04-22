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

## Up next

M4 — port [util.js](../util.js) → `src/util/*.ts`. Consider completing M2 close-out first so the build is actually releasable before stacking more ports on top.

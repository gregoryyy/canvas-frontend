# shared

Cross-stack artifacts consumed by both [../frontend/](../frontend/) and [../backend/](../backend/).

**Status:** placeholder. The files below land as the patch protocol and API contract crystallize.

## What belongs here

### `patch.schema.json` (primary artifact — lands with phase 3 M1)

The `Patch` discriminated union as JSON Schema. The backend is the source of truth (Pydantic models in `../backend/src/canvas_ai/patches/schema.py`); this file is exported via `BaseModel.model_json_schema()` and checked in. The frontend regenerates Zod validators from it with `json-schema-to-zod` (or an equivalent codegen) as part of `npm run build`.

**Sync discipline.** When the Pydantic models change, the CI re-exports this file and fails the build if the checked-in copy is stale. That turns schema drift into a red PR instead of a silent production bug.

### `api.openapi.json` (optional — lands if the frontend benefits from a fully typed client)

FastAPI emits an OpenAPI 3 spec for free at `/openapi.json`. A checked-in snapshot of the same shape here lets the frontend generate a typed HTTP client with `openapi-typescript`. Duplicates some ground with `patch.schema.json` (the Patch appears in both), but covers the request/response envelopes too.

### `fixtures/`

Reference canvases used by tests on both sides:

- `fixtures/empty-preseed.json` — a bare Preseed Canvas (cells exist, no cards).
- `fixtures/filled-preseed.json` — a fully filled sample canvas.
- `fixtures/round-trip-preseed.json` — a canvas known to round-trip cleanly through save → load → export → import.

Frontend tests use these to verify the store and UI behavior. Backend tests use the same files to verify prompt assembly and patch validation against a stable input surface. One copy avoids "the two sides agree, but on different fixtures."

### `canvas-types/` (deferred)

The canonical canvas-type JSON configs (Preseed, Lean, BMC, Product Vision, SWOT, TOWS). Currently at [../frontend/public/conf/](../frontend/public/conf/). Moving them here is only worthwhile once the backend also reads them as prompt schemas — at which point the frontend's Vite build copies them into `public/conf/` so URLs remain stable. Until then, `public/conf/` is authoritative.

## What does *not* belong here

- Runtime code (different languages — no literal sharing possible).
- Sanitization allow-lists, chunking parameters, token budgets — these are settings each side implements independently; a little duplication is cheaper than the machinery to share them.
- Project documentation — that lives at [../doc/](../doc/).
- Dev scripts for running frontend and backend together — those are top-level repo scripts (or each side's own).

## References

- [../doc/ARCH.md#repository-layout](../doc/ARCH.md#repository-layout) — why the monorepo with a `shared/` directory exists at all.
- [../doc/ARCH_AI.md#patch-protocol](../doc/ARCH_AI.md#patch-protocol) — the Patch union that `patch.schema.json` encodes.
- [../doc/design/STACK.md](../doc/design/STACK.md) — why schema sharing via JSON Schema (not shared code) is the right pattern given the TS + Python split.

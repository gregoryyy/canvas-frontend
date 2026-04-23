# Roadmap

Longer-term direction beyond the active plan in [PLAN.md](PLAN.md). Items here are not committed and not scheduled; they get promoted to PLAN.md when a milestone is decided. Organized by theme, not by date.

The active plan ships frontend-only AI ([ARCH_FE.md](ARCH_FE.md)) in substages `3F-a` … `3F-e`. Most items below build on top of that base, or extend the canvas in directions that are independent of the AI track.

---

## AI & analysis

### Backend track (`3B-*`)

The full server-side design lives in [../ARCH_AI.md](../ARCH_AI.md). Promote to PLAN.md when one of the following becomes a real need:

- **Web RAG against third-party sources.** LinkedIn profiles, Crunchbase, company websites, market reports. Browsers can't fetch these directly (third-party CORS); a backend with an outbound allowlist can.
- **Cross-device or shared config.** Investor profiles edited by a partner, reused across machines.
- **Server-side document extraction at scale.** Multi-hundred-page decks where in-browser PDF.js gets slow.
- **Centralized cost / rate control.** When usage outgrows "single user, own keys."

Substages mirror [../ARCH_AI.md#phasing-within-phase-3](../ARCH_AI.md#phasing-within-phase-3): chat proxy → uploads + doc RAG → pi-check → side-docs → web/profile RAG. Frontend treats the backend as one more "Custom backend" provider — the UI built in `3F-*` does not change.

### LLM Wiki — local wikified context

A canonical, editable knowledge base of concepts the LLM should know about — valuation methods, financing-round mechanics, KPI definitions, term-sheet vocabulary, industry primers — surfaced into prompts as stable definitions rather than retrieved-then-paraphrased snippets.

Reference: Karpathy's ["LLM Wiki" gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — the direct intellectual source for this item. Karpathy's framing: three layers (raw sources → LLM-maintained markdown wiki → schema), three operations (ingest, query, lint), with the LLM handling bookkeeping (cross-references, consistency, summaries) and the human staying in charge of curation. The key move is persistent synthesis: knowledge compounds in a durable artifact instead of being re-derived from raw docs on every query. Worth reading in full before scoping this item.

- **Why a wiki, not RAG.** RAG is good for document-specific facts ("what does *this* deck say about X"). It is poor for canonical concepts ("what does *the field* mean by X"), where every retrieval risks introducing variance from a slightly different phrasing in the source. A wiki page is one stable definition, written once, reused verbatim.
- **Storage.** Markdown files. Initially vendored under `public/wiki/*.md` (shipped with the app, versioned in the canvas repo). Optionally extended with user-edited entries in `localStorage` under `canvas.ai.wiki`.
- **Prompt assembly.** When a cell or chat turn touches a topic with a wiki entry (matched by tag or by simple keyword overlap), the page content is injected into the prompt with a `[wiki:<slug>]` cite tag. Patches that depend on a wiki entry carry the cite.
- **Editing UX.** Settings page gains a "Wiki" tab: list pages, edit in-place, see which prompts referenced which page. Read-only for vendored pages; user pages are local.
- **Relationship to RAG.** Complementary, not alternative. A pi-check run pulls deck snippets *and* relevant wiki pages; the LLM is told to weight the wiki as canonical and the deck as evidence.

### Scoring calibration

The Preseed Canvas has a numeric score per cell with user-defined formulas (see [../../public/conf/preseed.json](../../public/conf/preseed.json#L28)). Today the LLM, when asked to score, has no calibration — it has to guess what a "4" means in this rubric and on this canvas type.

- **Approach.** Per scored cell, capture rubric anchors: "score 1 = …, score 3 = …, score 5 = …" — written by the user as plain prose, stored alongside the canvas-type config or per investor profile. Prompts include the rubric for the cell being scored.
- **Learn from history.** Optional: when the user accepts or overrides a proposed `setScore` patch, record `(cell content, proposed score, accepted score)`. After a small number of overrides, summarize into a "this user tends to score harder/softer than the rubric on cells like X" hint and add it to the prompt.
- **No training, just prompt enrichment.** Calibration is curated rubrics + a memory of recent overrides. No finetuning, no per-user model.
- **UI.** Settings page → "Scoring" tab: rubric editor per scored cell, view of recent override history, "reset calibration" button.

### Idea-to-canvas (chat-driven)

Pre-deck mode: the user types or pastes a startup idea description in the sidebar; the assistant proposes a draft canvas without an upload step.

- Distinct from `pi-check draft` (which needs a deck) — this works against pure prose at the earliest stage.
- Mechanically the same patches as a `draft` analyze run, just with a different prompt and no RAG block.
- Useful for brainstorming, coaching conversations, "what would the canvas for *this* look like" comparisons.
- Naturally extends to *iterative* idea refinement: the assistant proposes patches, the user edits cards or asks for variations, the next turn sees the updated canvas as context.

### Critique-mode improvements

Today's `pi-check critique` adds `:?` and `:!` cards. Future extensions:

- **Cross-cell consistency checks.** "Cell 4 (Value Propositions) mentions enterprise customers, but Cell 5 (Go-to-Market) is bottom-up." Surface as a `:!` patch on Cell 5 with a cite to Cell 4.
- **Implicit-claim surfacing.** Detect claims that the user has implied but not stated, and propose them as `:?` queries.
- **Score-rationale reconciliation.** When the user-set score and the LLM's read of the cell content diverge, surface the gap.

---

## Canvas types

### Additional canvas forms

The canvas-type config schema ([../../src/types/config.ts](../../src/types/config.ts)) is generic enough that new canvas forms are typically pure-JSON additions in `public/conf/*.json`. New forms to design:

- **Market structure canvas.** Definition, segmentation, TAM/SAM/SOM sizing, growth dynamics, regulatory context. Sized to live next to the Preseed Canvas as a companion.
- **Porter's 5 Forces as canvas.** Five cells around a central "Industry intensity" cell — competitive rivalry, supplier power, buyer power, threat of substitutes, threat of new entrants. Each cell is a list of concrete instances; the central cell is a derived summary (and a candidate for an LLM-generated `setAnalysis`).
- **7 Powers canvas.** Hamilton Helmer's framework — scale economies, network economies, counter-positioning, switching costs, branding, cornered resource, process power. One cell each.
- **Competitive positioning canvas.** Two-axis positioning (price/quality, breadth/depth, …) with competitor placement as cards. Visual rendering is a stretch goal; the underlying data model fits the existing schema.
- **GTM canvas.** Channels, motion (PLG / sales-led / community), ICP, top-of-funnel mechanics, conversion stages.
- **Business Model Canvas variants.** The current BMC ([../../public/conf/bmcanvas.json](../../public/conf/bmcanvas.json)) is the original Osterwalder layout; variants for SaaS, marketplace, hardware are plausible.

Each new form needs:
1. A `public/conf/<name>.json` with `meta`, `canvas[]`, optionally `scoring[]`.
2. An entry in `public/conf/configs.json`.
3. CSS class for layout if non-grid (5-Forces and the positioning canvas need custom layouts).
4. (Optional) AI prompt fragment in the LLM Wiki for the framework's vocabulary.

### Visualization

- **Radar plot for partial scores.** Today the score is a single number. The Preseed scoring has named partial scores (Product, Market, Progress, Team) — render these as a radar/spider chart in PostCanvas. Cleanly additive; no behavior change to the formula evaluator.
- **Score history.** When multiple saved canvases exist, plot score trajectory over time per partial dimension.
- **PostCanvas layout: split into Analysis + Scores cells.** From [TODO.md](TODO.md#postcanvas) — two side-by-side panels rather than the current stacked layout.

---

## Multi-canvas management

Items from [TODO.md](TODO.md) that pre-date phase 3 but remain relevant:

- **Multiple canvases in localStorage.** Today the LS key `preseedcanvas` stores one canvas. Extend to a keyed map (`preseedcanvas:<title>` or a versioned index) so the user can switch between drafts.
- **Load menu / canvas list.** Settings page (or a new "Canvases" overlay) lists all saved canvases with metadata (title, type, last-saved). Load, rename, duplicate, delete.
- **Versioning via naming.** Date-stamped or numbered duplicates. No formal version graph in v1; just save-as.
- **Multitab layout.** Top-of-app tabs: Canvas, Analysis, Files (uploaded RAG bundles), Settings. Keeps the canvas surface clean and gives the AI features a home.

---

## Backend integration (canvas storage, not AI)

Independent of the AI backend (`3B-*`):

- **Upload / download canvases to/from a server.** Originally branched as `v1_1_2_upload` against `/devel/canvas-backend`. Useful for sharing analyses across devices or with collaborators. Single-user, no auth in v1; a token-auth gate later if multi-user materializes.
- **Compressed share-link.** Use `bzip2` or `fflate.js` to encode an entire canvas into a URL fragment for "send me your canvas" workflows without a server. (Originally noted as `v2`.)

---

## App distribution

- **Webpage app.** The current `unlost.ventures/canvas/` deploy. No change planned; phase-1 release flow ([../ARCH.md#deployment](../ARCH.md#deployment)) is stable.
- **iOS App Store / hybrid app.** Wrap the existing build in Capacitor or a lightweight WKWebView shell. Frontend-only architecture makes this nearly drop-in: `localStorage` works, the canvas UI is responsive, and the AI features (with Ollama as the obvious mismatch on iOS) point at cloud providers via the same proxy mechanism.
- **Desktop app.** Tauri or Electron wrapper if the iOS path proves the value. Lower priority than mobile.

---

## Content / external

Unscheduled, occasionally-relevant ideas:

- **LLM copilot blog.** Effort and quality analysis of using AI to develop and use the canvas — what worked, what didn't, where the model surprised in either direction. Could double as long-running QA on the pi-check pipeline.
- **Analyzer benchmark set.** A small fixture set of (deck, expected-canvas-shape) pairs that runs the analyzer end-to-end and compares against a reference. Anchors regression detection as the prompts and models change.

---

## Known bugs / small items

Tracked in [TODO.md](TODO.md). Most are pre-phase-2 and have either been fixed during the React rewrite or no longer apply. Re-triage before scheduling.

---

## Promoting items to PLAN.md

When an item moves from "interesting" to "next":

1. Verify it still makes sense against the current code state — many of these were drafted before phase-2 finalization.
2. Specify scope ("done when") and risks at PLAN.md's level of detail.
3. Move the item out of this file (or mark it `→ in PLAN.md`) so the roadmap stays a list of *not-yet-committed* work.

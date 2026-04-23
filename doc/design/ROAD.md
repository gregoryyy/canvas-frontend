# Roadmap

Longer-term direction beyond the active plan in [PLAN.md](../PLAN.md). Items here are not committed and not scheduled; they get promoted to PLAN.md when a milestone is decided. Organized by theme, not by date.

The active plan ships **backend-first** AI (Python + FastAPI per [../ARCH_AI.md](../ARCH_AI.md)) in milestones M1 … M6 of phase 3. Most items below either extend the backend architecture with new capabilities or extend the canvas in directions that are independent of the AI track.

The browser-only alternative sketched in [ARCH_FE.md](ARCH_FE.md) is **archived** — not a tracked alternative, not a fallback, not a later option. Items in this roadmap assume the backend exists.

External references, prior art, and library pointers that inform these items are curated in [SOTA.md](SOTA.md). Link out to SOTA entries rather than duplicating context here.

---

## AI & analysis

Several items below are listed as candidates in [PLAN.md M6](../PLAN.md#milestones); they get promoted into PLAN as their own milestone when real demand justifies committing.

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

### Deep-research agent with confidence metric and knowledge target

An agentic mode that, given a canvas cell (or the canvas as a whole), runs a multi-step research loop: identify what's unknown → formulate sub-queries → retrieve → synthesize → assess confidence → decide whether to keep searching or stop.

- **Knowledge target.** The user (or the framework) declares a target: "fill cell 4 to a confidence of at least X," or "until marginal information gain drops below Y." Without a target, open-ended agents drift and cost adds up; with one, the loop terminates.
- **Confidence metric.** Per proposed patch, a structured self-assessment: coverage (did the sources address the cell's `description`?), source diversity, contradiction count, LLM's own calibrated uncertainty (via logprobs when available, or an `instructor`-style self-eval pass). The UI shows the score alongside the patch.
- **Stopping rule.** Confidence reaches target, max step count, or budget cap — whichever comes first. The agent surfaces what it's *still* uncertain about as `:?` query cards rather than guessing.
- **Dependencies.** Needs the LLM Wiki, RAG (docs + web + profile), and the patch/cite pipeline already in place. Natural addition at M6 or later, once the core pi-check pipeline (M3 / M4) is proven.
- **Reference.** Related patterns in [SOTA.md](SOTA.md) (add: DeepResearch / agentic-search reference when scoped).

### GraphRAG + LLM Wiki for adaptive deep research

Extend the RAG stack from flat chunk retrieval to a graph-aware retrieval that composes with the LLM Wiki.

- **Why graph.** Decks, wiki pages, and prior canvases reference entities (companies, markets, people, concepts). A knowledge graph over those entities lets the agent traverse relationships ("competitors of X", "investors in Y", "wiki concepts cited by this cell") instead of hoping cosine similarity surfaces the right chunks.
- **Approach.** Entity extraction on ingest (NER + LLM-assisted linking), edge construction (co-occurrence + explicit references from the wiki), graph store (`networkx` in-process for v1; Neo4j or similar only if scale demands). Query time: RAG returns chunks *and* a small neighborhood subgraph; the prompt assembler inlines both.
- **Adaptive.** The deep-research agent picks its next sub-query partly from the graph — "this entity has many outgoing edges I haven't explored" is a better signal than raw embedding distance.
- **Relationship to LLM Wiki.** Wiki pages become first-class nodes. Karpathy's "ingest → wiki" operation (see [SOTA.md](SOTA.md)) extended to also grow the graph. Wiki and graph are the durable artifacts; chunks and vectors are derived.
- **Scope warning.** Graph-RAG is a real rabbit hole. First test: does a bundle of ~30 deck pages benefit materially from graph traversal over flat hybrid retrieval? If not, defer.

### Multimodal PDF analysis

Pitch decks are visual: charts, screenshots, logos, hand-drawn diagrams, layout-meaningful slides. Text-only extraction loses information.

- **Question.** Can the PDF be sent to the LLM provider directly — either as a file (OpenAI Files API, Anthropic PDF input) or as rendered page images via the vision endpoint — so the model sees the deck the way a human does? What's the quality gap vs. extract-then-text?
- **Two paths to evaluate:**
  1. **Provider-native.** OpenAI and Anthropic both accept PDFs or page images; the model handles extraction + interpretation in one call. Simpler, but ties the design to providers that support this and loses control over chunking/citation granularity.
  2. **Local vision extraction.** Render pages to images (PyMuPDF / `pdf2image`), send to a vision model (GPT-4o, Claude, `llava`-class local) for caption + layout description, fold those captions alongside text chunks in the RAG index.
- **Research tasks.** Benchmark extraction quality on a small set of real decks (text-only `pdfplumber` vs. provider-native PDF vs. vision-captioned hybrid). Measure: do cited claims in drafted patches correctly attribute to slides with visual-only content (e.g. a roadmap chart, a competitive quadrant)?
- **Citation granularity.** Ensure the chosen approach still supports per-page citations for the patch `cite[]` protocol. Provider-native PDF handling sometimes returns only summary-level attributions.
- **Cost.** Vision input is several-fold more expensive than text. Decide which path is the default and which is opt-in; the RAG settings page should surface the tradeoff.

### Explainable decisions and scoring

When the assistant proposes a patch or a score, surface *why* clearly enough that the user can trust, correct, or override without guessing the model's reasoning.

- **Per-patch rationale, already in the protocol.** The `rationale` field on every `Patch` ([../ARCH_AI.md#patch-protocol](../ARCH_AI.md#patch-protocol)) is the basic affordance. Make sure every proposing code path fills it, and that the UI surfaces it under the diff preview.
- **Per-patch cite, already in the protocol.** `cite[]` shows which RAG snippets (doc page, wiki entry, profile passage) the patch leans on. The diff preview renders these as expandable links into the source.
- **Score decomposition.** For `setScore` patches, show the rubric anchor the score is closest to (see [Scoring calibration](#scoring-calibration)) plus the 1–2 cell-content facts that drove it. A score without an explanation is a worse UX than no score at all.
- **"Why not higher / lower?" explanation.** Optional affordance: on a proposed score, the user clicks "why not 5?" and the assistant returns a structured comparison (what would have to be true in the cell content to justify 5). Cheap to implement on top of the scoring prompt.
- **Decision log.** Every accepted/rejected patch is appended to a local log (markdown or JSON) with the rationale, the cites, and the user's action. Over time the log is useful both for user reflection and as input to [Scoring calibration](#scoring-calibration).

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

## Canvas storage backend (separate from AI backend)

Independent of the phase-3 AI backend ([../ARCH_AI.md](../ARCH_AI.md)), which handles LLM orchestration and RAG rather than canvas persistence:

- **Upload / download canvases to/from a server.** Originally branched as `v1_1_2_upload` against `/devel/canvas-backend`. Useful for sharing analyses across devices or with collaborators. Single-user, no auth in v1; a token-auth gate later if multi-user materializes. Could plausibly share the same Python + FastAPI service as the AI backend, or live as a second service — decide at promotion time.
- **Compressed share-link.** Use `bzip2` or `fflate.js` to encode an entire canvas into a URL fragment for "send me your canvas" workflows without a server. (Originally noted as `v2`.)

---

## App distribution

- **Webpage app.** The current `unlost.ventures/canvas/` deploy. No change planned; phase-1 release flow ([../ARCH.md#deployment](../ARCH.md#deployment)) is stable.
- **iOS App Store / hybrid app.** Wrap the existing build in Capacitor or a lightweight WKWebView shell. The canvas itself is drop-in: `localStorage` works and the UI is responsive. AI features require the backend to be reachable — for a hosted deploy the app points at a public backend URL; for a local-only user the app won't surface AI. The backend-first architecture does not preclude this, but the backend must be hosted before an App Store release makes sense.
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

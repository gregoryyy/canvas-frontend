# State of the art — references

Curated external and prior-work references that inform the design choices in [ROAD.md](ROAD.md), [../PLAN.md](../PLAN.md), [../ARCH_AI.md](../ARCH_AI.md), and [ARCH_FE.md](ARCH_FE.md). Kept as a living index: short entries, each with a one-paragraph orientation and a pointer to the primary source.

Organized by theme, not by date. When an entry is promoted to a concrete design or plan item, link back to it from the corresponding section in that document rather than duplicating the content here.

---

## Prior art (this project's design heritage)

### Preseed Canvas — the canvas being implemented

- **URL:** [unlost.ventures/content/render.html?model=canvas](https://unlost.ventures/content/render.html?model=canvas)

The Preseed Canvas is the canonical canvas this app implements. The `model=canvas` rendering on the site is the same tool as the one in this repo, served with the unlost.ventures chrome. Cell structure, scoring formulas, and card-type vocabulary (`:?`, `:!`, `:=`, `:*`, `:-`) are the reference against which the 1:1 equivalence rule from phases 1–2 is measured. Any new canvas forms added under [ROAD.md → Canvas types](ROAD.md#canvas-types) should cite this as the anchor pattern.

### Pitch2Canvas (p2c) — the conceptual ancestor of pi-check

- **URL:** [unlost.ventures/content/render.html?model=p2c](https://unlost.ventures/content/render.html?model=p2c)

Pitch2Canvas is prior work in the same problem space as the phase-3 `pi-check` analyzer: taking a pitch deck and producing a filled canvas. It predates the current TS/React rewrite of the canvas and was built against the earlier ES-module version. Architectural takeaways worth carrying forward into pi-check (to be verified and elaborated when the M3 `draft` milestone is scoped):

- Deck → canvas as the primary use case, not deck → free-form summary.
- Cell-by-cell drafting where each cell's `description` is a prompt slot (same principle as [../ARCH_AI.md#prompt-assembly](../ARCH_AI.md#prompt-assembly) codifies).
- Separation of proposed content from applied content (the genesis of the patch-accept/reject UX in [../ARCH_AI.md](../ARCH_AI.md)).

Concrete p2c design notes, inputs/outputs, and any lessons learned should be imported here when they're revisited for the pi-check substage.

---

## LLM application patterns

### Karpathy — "LLM Wiki"

- **URL:** [gist.github.com/karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

Three-layer architecture (raw sources → LLM-maintained markdown wiki → schema) with three operations (ingest, query, lint). LLM handles bookkeeping (cross-references, consistency, summaries); human stays in charge of curation. Key move: persistent synthesis in a durable artifact instead of re-derived-on-every-query. Direct source for the [LLM Wiki roadmap item](ROAD.md#llm-wiki--local-wikified-context).

### `instructor` — Pydantic-native structured outputs

- **URL:** [github.com/jxnl/instructor](https://github.com/jxnl/instructor)

The structured-output pattern the Python backend uses for `{ reply, patches }`. Turns Pydantic models into OpenAI tool-use schemas, validates responses, retries on validation failure. Relevant to [../ARCH_AI.md#provider-abstraction](../ARCH_AI.md#provider-abstraction) and the strongest reason the Python stack wins on structured-output ergonomics ([STACK.md](STACK.md)).

### `dspy` — programmatic prompting

- **URL:** [github.com/stanfordnlp/dspy](https://github.com/stanfordnlp/dspy)

An alternative to hand-written prompt templates: declare signatures, let the framework compile prompts (and optionally tune them against examples). Potentially relevant to the pi-check analyzer if prompt-engineering churn becomes a real cost, and to the [scoring-calibration roadmap item](ROAD.md#scoring-calibration) for systematically learning from user overrides.

---

## RAG and retrieval

### Anthropic — "Contextual Retrieval"

- **URL:** [anthropic.com/news/contextual-retrieval](https://www.anthropic.com/news/contextual-retrieval)

Prepending short LLM-generated context to each chunk before embedding improves retrieval accuracy materially. Relevant when the RAG quality becomes a bottleneck on the deck → canvas pipeline. Worth evaluating before investing in re-rankers.

### BM25 + dense hybrid retrieval

Standard practice; no single canonical reference. The hybrid approach in [../ARCH_AI.md#document-rag-docs](../ARCH_AI.md#document-rag-docs) (dense top-k + `rank_bm25` keyword pass) follows this pattern. BM25 catches rare terms and named entities (company names, product names, industry jargon) that dense embeddings blur.

### Cross-encoder re-ranking

Second-stage re-ranking with a cross-encoder (e.g. `ms-marco-MiniLM-L-6-v2` or newer) lifts retrieval precision on the returned top-k. Documented as a [STACK.md reconsideration trigger](STACK.md#when-to-reconsider): if retrieval math grows this way, the Python ecosystem's advantage compounds.

---

## Structured extraction from documents

### `unstructured` — document preprocessing

- **URL:** [github.com/Unstructured-IO/unstructured](https://github.com/Unstructured-IO/unstructured)

Multi-format document parsing (PDF, DOCX, HTML, PPTX, images with OCR) with consistent output types. Listed as an opt-in extractor in [../ARCH_AI.md](../ARCH_AI.md#document-rag-docs) for mixed-format decks. Heavier than `pdfplumber` but covers OCR and layout-dense inputs.

### `trafilatura` — web content extraction

- **URL:** [trafilatura.readthedocs.io](https://trafilatura.readthedocs.io)

The web RAG path's primary extractor ([../ARCH_AI.md#web-rag-web](../ARCH_AI.md#web-rag-web)). Boilerplate-stripping quality is materially better than `readability-lxml` on mixed pages (news, company blogs, LinkedIn-style profile pages when they're accessible).

---

## Evaluation

### `ragas` — RAG evaluation

- **URL:** [github.com/explodinggradients/ragas](https://github.com/explodinggradients/ragas)

Faithfulness, answer relevance, context precision/recall metrics for RAG pipelines. Relevant when the [analyzer benchmark set roadmap item](ROAD.md#content--external) lands and we need quantitative regression tracking for prompt / model / retrieval changes.

---

## Frameworks for canvas-style analyses

The [additional canvas forms](ROAD.md#additional-canvas-forms) in the roadmap draw from named frameworks; each gets a canonical reference to paste into the in-app LLM Wiki when that item lands:

- **Business Model Canvas.** Osterwalder & Pigneur, *Business Model Generation* (2010). The BMC is already implemented as [../../public/conf/bmcanvas.json](../../public/conf/bmcanvas.json).
- **Lean Canvas.** Ash Maurya, *Running Lean* (2012). Implemented as [../../public/conf/leancanvas.json](../../public/conf/leancanvas.json).
- **Porter's Five Forces.** Michael Porter, *Competitive Strategy* (1980). Target for a 5-cell-plus-center canvas layout.
- **7 Powers.** Hamilton Helmer, *7 Powers* (2016). Target for a 7-cell canvas.
- **SWOT / TOWS.** Classic strategic-analysis frames; already implemented as [swot.json](../../public/conf/swot.json) / [tows.json](../../public/conf/tows.json).

These references are here as anchors; the actual canvas JSON and prompt fragments get written when each form lands.

---

## Contributing to this file

One entry per reference. Each entry:
- A clear title.
- A single primary URL.
- One paragraph connecting the reference to *this* project — what it's relevant to, which doc/section it feeds, when it matters. If that connection isn't clear yet, the entry probably doesn't belong here (it belongs in a personal reading list).

When a reference is actually applied — used as input to a concrete design decision — link back from the corresponding design doc to the entry here, not the other way around. This keeps SOTA.md small and browsable.

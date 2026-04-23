# Stack choice — backend

Why the backend is Python + FastAPI + Pydantic rather than TypeScript, Rust, Go, or an edge runtime.

Referenced from [../ARCH_AI.md](../ARCH_AI.md). Split out of ARCH_AI so the design document can stay focused on what the backend does, while the stack debate lives as a standalone record that future maintainers can revisit without reading the whole architecture doc.

---

## Summary

This document specifies Python + FastAPI + Pydantic. That choice is neither obvious nor forced; a TypeScript backend would share the patch schema verbatim with the frontend, and for a single-user service the streaming and ops ergonomics of Node are excellent. The decision came down to where the hard work actually happens — PDF extraction, embeddings, vector search, structured-output parsing, and a growth path toward evals and scoring calibration all sit firmly in Python's ecosystem.

## Decision criteria

What the backend actually does, ranked by weight in the choice:

1. **Extract text from PDFs reliably.** The first non-trivial thing a deck upload needs. Quality here caps the ceiling of the entire analyze pipeline.
2. **Chunk, embed, and search vectors — with room to grow.** Core RAG loop today; cross-encoder re-ranking, hybrid scoring, and learned retrieval are plausible extensions.
3. **Share the patch schema with the frontend.** The `Patch` union is the contract between client and server. Re-authoring it in a different language creates drift risk.
4. **Structured-output ergonomics.** Whatever language, the `{ reply, patches }` envelope must validate cleanly and fail informatively.
5. **Stream tokens through an SSE channel.** Chat UX depends on this feeling responsive.
6. **Stay operationally small.** One-dev project; every new language, runtime, or toolchain added is a tax paid forever.
7. **Leave room for growth.** If pi-check grows into batch evals, finetuning, or custom retrieval math, which ecosystem pays off?

No stack wins on all seven. The ranking above — with PDF extraction and growth path ahead of schema sharing — is what tipped Python.

---

## Python + FastAPI + Pydantic (the chosen stack)

**Pros:**

- **Best-in-class PDF extraction.** `pdfplumber` (MIT, strong on text + tables), `pymupdf` (fast, but AGPL), `pypdf` (BSD, simpler), `unstructured` (handles mixed formats including scans via OCR bridges). Multiple mature options means falling back when one struggles on an oddly-laid-out deck. This is the single biggest quality lever in the pipeline.
- **The RAG/ML ecosystem.** `sentence-transformers`, `transformers`, `instructor`, `langchain`, `llamaindex`, `haystack`, `dspy`, `guidance`, `rank_bm25`, `faiss`, `chromadb` — whatever the design evolves toward, Python probably has a library. The frontend-only design's `@xenova/transformers` is a browser port of a Python-native project; the backend gets the original.
- **Structured outputs with Pydantic.** `instructor` (Pydantic + OpenAI) is arguably the cleanest structured-output experience in any language. `Patch` as a Pydantic discriminated union (`Annotated[Union[...], Field(discriminator='op')]`) validates with the same ergonomics as Zod, and `model.model_validate_json()` is the one-liner the parser needs.
- **Growth path.** Evals, finetuning, scoring-model training, anything with numpy/pandas in the critical path — all first-class. The frontier of LLM application tooling continues to appear in Python first; the backend is already there when a new technique becomes relevant.
- **Local-model hosting.** If the backend ever wants to host a model itself (vLLM, llama-cpp-python, transformers), Python is the native path.
- **FastAPI is excellent.** Type-hinted handlers, auto-generated OpenAPI from Pydantic models, async I/O via `httpx` and the `openai` async client, dependency-injection for per-request state, `BackgroundTasks` for cleanup. Comparable to Fastify's ergonomics on speed, better on docs/validation.
- **`uv` has fixed most Python ops complaints.** Dependency resolution, virtualenv management, lockfile, and Python-version installs are all one tool and fast. Ruff replaces ESLint + Prettier as one tool. The 2024-era Python toolchain is a real improvement on 2019.

**Cons:**

- **Two-language project.** The patch schema lives twice: Zod in the frontend, Pydantic in the backend. Keeping them in sync is a code-review discipline problem. Mitigation: treat one side as the canonical source (Pydantic), export to JSON Schema via `.model_json_schema()`, generate the TS types with `datamodel-code-generator` or `json-schema-to-typescript` in a small CI step. Works, adds a build step, still a source-of-truth conversation.
- **No code sharing.** Sanitization, chunking, prompt-schema fragments — duplicated or re-implemented. The frontend's DOMPurify sanitize allow-list has to be mirrored with `bleach` or `nh3` in Python.
- **Heavier ops than Node.** Virtualenv management, Python version pinning, separate CI runner. `uv` makes this smaller than it used to be but nonzero.
- **Cold starts are slower.** Python-on-Lambda, FastAPI-on-Cloud-Run — measurably slower to cold-start than Node. Doesn't matter for a long-running single-user backend; would matter if deployment ever goes serverless.
- **Streaming SSE is workable but slightly less idiomatic.** `StreamingResponse` + `sse-starlette` does the job; Node's `reply.raw.write` is a cleaner one-liner.
- **Dependency weight.** `pymupdf` alone is ~50 MB; a Python RAG container easily hits 500 MB. Node containers are typically under 200 MB. Matters for deployment bandwidth, not for correctness.

## TypeScript + Node + Fastify (the main alternative)

**Pros:**

- **Literal type sharing with the frontend.** Zod schemas, `Patch`, `CanvasState`, `CanvasConfig`, `CardType` import unchanged from the canvas repo (or from a tiny shared package). The client parses what the server sends with the same validator the server wrote it with. This is the strongest single argument against the Python choice; the patch protocol is the heart of the integration and keeping its schema in one place has real value.
- **Identical sanitization.** DOMPurify runs both sides; the server-side defense-in-depth sanitize pass uses the same allow-list the frontend commits with.
- **One-toolchain project.** Same `tsc`, same Vitest, same ESLint, same editor setup as the frontend. The developer context-switches between frontend and backend in the same language.
- **OpenAI-compat ergonomics.** The `fetch`-based client is ~50 lines; SSE parsing is straightforward. JSON mode, streaming, and tool-use all work.
- **Fast enough.** Single-user backend is latency-bound on LLM calls, not CPU-bound. Node keeps up with any reasonable throughput this project will see.
- **Deployment simplicity.** `node dist/server.js` or a tiny Dockerfile. No virtualenv, no wheel caches, no Python-version drift.

**Cons:**

- **PDF extraction is the weakest link.** `pdfjs-dist` and `unpdf` cover clean machine-generated PDFs well, but scanned or complex decks benefit from the heavier Python tools. Fallback: shell out to a Python PDF tool from Node, which negates much of the "one-toolchain" argument.
- **Thinner ML/RAG ecosystem.** `hnswlib-node`, `@xenova/transformers`, `minisearch` cover v1. Anything deeper (re-rankers, custom tokenizers, evaluation harnesses, small local models not available in ONNX format) is a harder Node lift than a Python one.
- **No native tensor library.** If retrieval math grows (cross-encoder re-ranking, hybrid-search learning-to-rank, local fine-grained scoring models), Node has no numpy-equivalent. Workarounds (WASM builds, ONNX runtime) exist but are friction.
- **Smaller pool of RAG library choices.** Langchain.js and llamaindex-ts exist but lag their Python counterparts. Not a dealbreaker — this design intentionally avoids those frameworks — but it narrows options if a need emerges.

## Rust (Axum or Actix)

**Pros:**

- **Fast, small, safe.** One binary, minimal memory, strong type system.
- **Great for high-throughput.** Not the bottleneck here, but "free performance" is not nothing.
- **Growing ML story.** `candle` (Hugging Face's Rust ML framework), `ort` (ONNX Runtime bindings), `tokenizers` (native Rust). Not at Python parity but trending.

**Cons:**

- **Smallest relevant ecosystem.** PDF extraction (`lopdf`, `pdf-extract`) lags Python and TS. Structured-output libraries exist (`serde` + hand-rolled validators) but nothing at Pydantic/Zod polish.
- **Development speed is the bottleneck, not runtime speed.** Small feature-in-progress codebases pay a tax in compile times and borrow-checker ceremony for performance the project will not use.
- **No type sharing with frontend.** `ts-rs` or similar tools bridge Rust structs to TS, but that's a build step and another source-of-truth question.
- **Overkill.** Single-user backend, latency-bound on LLM calls. Rust's wins are invisible here.

**When Rust would be the right call:** if the project ever grows into a multi-tenant service with tight latency SLOs and a stable feature set. Not phase 3.

## Go (Gin / Echo / Chi)

**Pros:**

- **Simple and fast.** Small binary, good concurrency, clean stdlib.
- **Operational ergonomics.** Single binary, easy cross-compile, easy deploy.
- **Growing LLM tooling.** `langchaingo` exists; OpenAI-compat clients are straightforward.

**Cons:**

- **Generics are young.** Writing a clean discriminated-union `Patch` validator feels worse than in TS, Python, or Rust.
- **Weakest PDF and RAG story of the mainstream options.** Existing libs are usable but not battle-tested.
- **No type sharing with frontend.** Same build-step problem as Python/Rust.
- **No compelling reason to pick this** over TS for this project's shape.

## Deno / Bun (alt TypeScript runtimes)

**Pros:**

- **Same Node ecosystem**, with advantages per runtime: Deno ships TS natively with a permissions model; Bun has near-instant startup and a faster package manager.
- **Drop-in for a TS backend.** The `fetch`-based LLM client doesn't care; Fastify might; routing could be rewritten against each runtime's native HTTP server.

**Cons:**

- **Maturity gap in some deps.** `hnswlib-node` is a native binding; compatibility varies. `@xenova/transformers` works on all three.
- **Operator unfamiliarity.** Adds a small tax to deployment if the hosting story is not already Deno/Bun-ready.
- **Doesn't change the Python-vs-TS calculus.** Picking Deno/Bun is still a TS-backend choice; the PDF/RAG ecosystem concerns are unchanged.

**When to consider:** only relevant if a switch back to TS happens. Then Bun is worth a look over Node for cold-start and install speed.

## Edge / serverless-first (Cloudflare Workers, Vercel Edge, Deno Deploy)

**Pros:**

- **Zero-ops.** Fits the frontend-first ethos of this project; deploys in seconds.
- **TS-native.** Workers is TypeScript in practice.
- **Familiar territory.** Edge platforms are often where a small backend starts, especially when the rest of the stack is frontend-leaning.
- **Global latency.** Edge-local execution.

**Cons:**

- **Memory and time caps.** Workers: 128 MB memory, 30s CPU on paid plans. PDF extraction of a large deck + embedding + index loading can blow past these.
- **Stateful caches are awkward.** Uploaded-doc TTL store wants in-process memory; edge platforms force you into KV / R2 / D1 / Durable Objects for anything cross-request. Each is a new abstraction.
- **Library compatibility.** Native modules (`hnswlib-node`) don't run. `pdfjs-dist` works but slowly. `@xenova/transformers` works but the WASM model load eats into the memory budget.
- **Vendor lock-in.** Porting off Workers into a long-running server is non-trivial once Durable Objects or KV get involved.

**When this is the right call:** if RAG ever moves fully to the client and the backend role shrinks to "authenticated proxy + occasional LLM call." Not a fit for the pi-check pipeline as specified.

## Summary matrix

Weights reflect this project's shape, not absolute merit. The "(chosen)" column marks the selected stack.

| Criterion (weight)                          | Python (chosen) | TS/Node  | Rust     | Go       | Edge     |
|---------------------------------------------|-----------------|----------|----------|----------|----------|
| PDF extraction quality (high)               | **best**        | ok       | weak     | weak     | ok       |
| RAG library ecosystem (high)                | **best**        | ok       | weak     | weak     | ok       |
| Growth path (ML / evals / finetuning) (high)| **best**        | ok       | ok       | weak     | poor     |
| Structured-output ergonomics (high)         | **best**        | **best** | ok       | weak     | best     |
| Type-share with frontend (med)              | poor            | **best** | poor     | poor     | best     |
| Streaming SSE ergonomics (med)              | ok              | **best** | ok       | ok       | good     |
| Dev velocity for small team (med)           | good            | **best** | poor     | good     | good     |
| Operational simplicity (low)                | ok              | **best** | good     | good     | **best** |
| Cold-start / deploy story (low)             | ok              | good     | **best** | **best** | **best** |

Python loses clearly on type-share with the frontend and slightly on streaming/ops ergonomics. The three highest-weighted criteria — PDF extraction, RAG ecosystem, and growth path — all favor Python decisively, which is what drives the choice.

## When to reconsider

Concrete triggers that should prompt revisiting this decision:

- **Schema drift between Zod and Pydantic becomes a real bug source.** If field-level drift between the frontend Zod schema and the backend Pydantic models causes production breakage more than once or twice, promote the JSON-Schema export + TS codegen path from "nice to have" to a required CI step. If that still isn't enough, switching the backend to TS is the cleanest fix.
- **RAG never grows beyond basic top-k.** If phase 3 plateaus at "embed docs, return patches" and no ML/eval/retrieval work materializes, the Python ecosystem's advantage shrinks to "PDF extraction only." At that point, a TS backend plus a small Python PDF sidecar is simpler than a full Python stack.
- **The project grows multi-user and SLO-bound.** Not a TS trigger — a Rust or Go trigger — and well out of phase-3 scope.
- **Cost containment requires edge execution.** Unlikely given the single-user scope; would push toward a TS backend on Workers/Edge.

The pattern across all of these: **stay in Python unless the switch cost is outweighed by a clear, recurring pain**. Python is the right home for the orchestration, PDF + RAG pipeline, structured outputs, and the pi-check analyzer. If a specialist job emerges that doesn't fit (e.g. edge-bound latency), consider a sidecar before a rewrite — same principle as the TS appendix would have recommended, just flipped.

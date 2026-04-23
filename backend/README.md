# canvas backend

Python + FastAPI backend for Unlost Canvas. Adds LLM-assisted analysis on top of the canvas app in [../frontend/](../frontend/).

**Primary workflow.** Upload a pitch deck → draft a Preseed Canvas from it → drill into specific cells or companion canvases (Lean, BMC, Product Vision, SWOT, TOWS) for deep dives. The Preseed Canvas is the anchor; other canvas types are secondary deep-dive surfaces, not standalone entry points.

Capabilities: chat sidebar, PDF uploads, RAG retrieval, pi-check analyzer.

**Status:** not yet implemented. This directory is a skeleton. Design lives in [../doc/ARCH_AI.md](../doc/ARCH_AI.md); the active phase-3 plan is in [../doc/PLAN.md](../doc/PLAN.md).

## Getting started (once implemented)

```bash
uv sync                    # install deps + create .venv
cp .env.example .env       # set OPENAI_BASE_URL, OPENAI_API_KEY, MODEL, CORS_ORIGIN
uv run uvicorn canvas_ai.server:app --reload --port 8000
```

## Layout

See [../doc/ARCH_AI.md#backend-module-layout](../doc/ARCH_AI.md#backend-module-layout) for the target module tree. Current state is an empty package skeleton.

## Stack

Python 3.12, FastAPI, Pydantic v2, `uv` for dependency management, `ruff` + `mypy` (or `pyright`), `pytest`. Rationale for Python over TypeScript/Rust/Go is in [../doc/design/STACK.md](../doc/design/STACK.md).

# canvas backend

Python + FastAPI backend for the Preseed Canvas. Adds LLM-assisted analysis — chat sidebar, PDF uploads, RAG retrieval, and the pi-check analyzer — on top of the canvas app in [../frontend/](../frontend/).

**Status:** not yet implemented. This directory is a skeleton. Design lives in [../doc/ARCH_AI.md](../doc/ARCH_AI.md); the active phase-3 plan is in [../doc/design/PLAN.md](../doc/design/PLAN.md).

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

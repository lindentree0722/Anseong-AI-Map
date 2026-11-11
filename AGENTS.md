# Repository Guidelines

## Project Structure & Module Organization

This repository prototypes an Anseong traffic and commercial-area analysis platform.
- `backend/main.py`: FastAPI application exposing `GET /places` and `POST /places`. Places currently live in memory and disappear on restart.
- `backend/src/anseong_ai_map/__init__.py`: package entry point; currently prints a greeting rather than starting the API.
- `backend/pyproject.toml`: Python metadata, dependencies, and `uv_build` configuration. Both this file and `.python-version` target Python 3.15.
- `frontend/asdf.html`: standalone presentation page with inline CSS, JavaScript, and embedded image assets.
- `README.md`: Korean project overview and planned analysis modules.

There is no test directory or separate asset directory yet. Keep future backend tests in `backend/tests/`.

## Build, Test, and Development Commands

Run these commands from the repository root unless stated otherwise:

```powershell
uv sync --project backend --locked
uv run --project backend uvicorn main:app --app-dir backend --reload
python -m http.server 5500 --directory frontend
```

These create an environment, install API runtime dependencies, start the API, and serve the frontend at `http://localhost:5500/asdf.html`. Inspect API operations at `http://localhost:8000/docs`.

Manage dependencies with `uv add --project backend PACKAGE`; commit both `backend/pyproject.toml` and `backend/uv.lock`. Backend setup details are in `backend/README.md`.

## Coding Style & Naming Conventions

Use four-space Python indentation, `snake_case` functions and variables, and `PascalCase` model classes. Add type annotations to new API models and helpers. Preserve UTF-8 Korean text. Keep HTML semantic and use descriptive CSS classes and JavaScript names. No formatter or linter is configured; avoid unrelated formatting changes.

## Testing Guidelines

No automated framework or coverage threshold is configured. For API changes, verify request validation and response bodies through `/docs`, including empty lists and malformed input. For frontend changes, check browser rendering and the console. When introducing automated tests, use pytest with files named `test_*.py`, document installation and execution, and isolate the shared places list between tests.

## Commit & Pull Request Guidelines

History uses short Korean descriptions, merge commits, and reverts without a consistent prefix scheme. Write focused, descriptive commit subjects; Korean or English is acceptable. PRs should explain behavior changes, link relevant issues, list validation performed, and include screenshots for visible UI changes. Identify mock data and analysis limitations explicitly.

## Security & Configuration

Keep credentials and private datasets out of commits. Use environment variables for future server secrets, and document required configuration without real keys.

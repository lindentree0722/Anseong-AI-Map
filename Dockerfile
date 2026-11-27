FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig.json ./
COPY frontend/src ./src
RUN npm run build

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.11.26 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_PYTHON_INSTALL_DIR=/opt/python
ENV ANSEONG_ALLOW_WRITES=0
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./backend/
RUN uv sync --project backend --locked --no-dev --no-install-project --python 3.15.0b3
COPY backend/*.py ./backend/
COPY backend/data/*-sample.json ./backend/data/
COPY --from=frontend /build/dist ./frontend/dist

CMD ["sh", "-c", "exec backend/.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port \"${PORT:-10000}\""]

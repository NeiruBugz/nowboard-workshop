# syntax=docker/dockerfile:1.7

# Stage 1: build the React/Vite frontend with pnpm
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY app/frontend/package.json app/frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY app/frontend/ ./
RUN pnpm build


# Stage 2: Python FastAPI runtime served by uvicorn
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

RUN pip install --no-cache-dir uv==0.5.14

COPY app/api/pyproject.toml app/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app/api/ ./

COPY --from=frontend-builder /app/frontend/dist ./app/static

RUN uv sync --frozen --no-dev

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

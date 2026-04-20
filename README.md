# Nowboard

A shared team status board — lightweight replacement for sync standups and Slack threads. A team creates a workspace, shares one invite link, and everyone posts their "today" cards to the same board.

See `context/product/` for product context and `context/spec/` for feature specs.

## Stack

- **Backend:** Python 3.12 · FastAPI · SQLModel · Alembic · SQLite (aiosqlite, WAL)
- **Frontend:** React 19 · Vite · TanStack Router (file-based) · TanStack Query · Tailwind v4 · shadcn/ui
- **API contract:** `app/api/openapi.json` (committed) → `@hey-api/openapi-ts` generates the frontend SDK at `app/frontend/src/api/generated/`
- **Auth:** email + password (Argon2id), stateless signed session cookies (`itsdangerous`, HttpOnly, rolling 30d)
- **Runtime:** single Docker image — Python serves the API and the built SPA from one origin

## Layout

```
app/
  api/        FastAPI app, SQLModel models, Alembic migrations, tests
  frontend/   React + Vite SPA, generated API SDK, Vitest tests
context/
  product/    Product brief, architecture, roadmap
  spec/       Per-feature specs (functional + technical + tasks)
Dockerfile          Multi-stage: pnpm build → uv sync → uvicorn
docker-compose.yml  Single `web` service + `nowboard-db` volume
```

## Getting started

### Prerequisites

- Docker (for the full-stack loop) **or**
- Python 3.12 + [uv](https://docs.astral.sh/uv/) and Node 22 + [pnpm](https://pnpm.io/) (for local dev)

### First-time setup

```bash
cp .env.example .env                 # fill in SECRET_KEY
cp app/api/.env.example app/api/.env # for local (non-docker) backend runs
```

### Run with Docker (recommended)

```bash
docker compose up --build            # http://localhost:8000
docker compose down                  # stop
docker compose down -v               # stop and wipe the SQLite volume
```

The image builds the frontend with pnpm, mounts `nowboard-db` at `/data`, and serves both API and SPA on port 8000.

### Run locally (without Docker)

Two terminals:

```bash
# Terminal 1 — backend
cd app/api
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py       # http://localhost:8000

# Terminal 2 — frontend
cd app/frontend
pnpm install
pnpm dev                             # http://localhost:5173
```

## Common commands

### Backend (`app/api/`)

```bash
uv sync                              # install deps
uv sync --group test                 # install with test deps
uv run fastapi dev app/main.py       # dev server with reload
uv run alembic upgrade head          # apply migrations
uv run alembic revision --autogenerate -m "message"
uv run --group test pytest           # run tests
uv run export-openapi                # regenerate openapi.json
uv run ruff check .                  # lint
uv run ruff format .                 # format
```

### Frontend (`app/frontend/`)

```bash
pnpm install                         # install deps
pnpm dev                             # Vite dev server
pnpm build                           # production build
pnpm test                            # Vitest
pnpm lint                            # ESLint
pnpm codegen                         # regenerate src/api/generated/ from openapi.json
```

### Contract workflow

After any change to routers, Pydantic schemas, or status codes:

```bash
cd app/api && uv run export-openapi     # updates app/api/openapi.json
cd app/frontend && pnpm codegen         # regenerates src/api/generated/
```

Commit both artifacts together. Frontend code imports endpoints only from `@/api/generated/`.

## Configuration

Root `.env` (consumed by `docker compose`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | _required_ | Signs session cookies |
| `DATABASE_URL` | `sqlite+aiosqlite:////data/nowboard.db` | SQLite path inside the `web` container |
| `APP_BASE_URL` | `http://localhost:8000` | Used when building invite URLs |

Backend-only settings (defaults in `app/api/app/config.py`): `SESSION_TTL_SECONDS=2592000`, `RATE_LIMIT_WINDOW_SECONDS=900`, `RATE_LIMIT_MAX=5`.

## Smoke test

```bash
docker compose up --build
# Open http://localhost:8000
# 1. Sign up with an email + password → set a display name
# 2. Create a team → copy invite URL from the board
# 3. Open invite URL in a second browser profile → sign up → land on the same board
```

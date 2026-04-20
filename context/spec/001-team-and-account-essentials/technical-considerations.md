# Technical Specification: Team & Account Essentials

- **Functional Specification:** `context/spec/001-team-and-account-essentials/functional-spec.md`
- **Status:** Completed
- **Author(s):** Nail Badiullin

---

## 1. High-Level Technical Approach

Build on the existing scaffold at `app/api/` (FastAPI + SQLModel + Alembic) and `app/frontend/` (React 19 + Vite + TanStack Router + Tailwind v4 + shadcn). Swap the backend DB driver from `asyncpg` to `aiosqlite` per the architecture, point `DATABASE_URL` at a SQLite file on a mounted Docker volume, and enable WAL mode at startup. Authentication is classic email + password with Argon2 hashing (`argon2-cffi`); no email delivery in v1. Sessions are stateless signed cookies (`itsdangerous`) carrying `user_id` + `issued_at`, rolling 30-day expiry. Teams are a table with a regenerable `invite_code`; memberships are soft-deletable. A per-process sliding-window rate limiter protects the sign-in / sign-up endpoints.

Affected surfaces: new models and routers under `app/api/app/`, Alembic revisions for auth + team tables, new frontend routes and an auth gate in `app/frontend/src/routes/`, updated `pyproject.toml` (swap asyncpg → aiosqlite, add `itsdangerous`, `structlog`, `argon2-cffi`), updated `.env.example`, and a `docker-compose.yml` at repo root.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 Data Model / Database Changes

Alembic revisions create:

| Table | Key Columns | Notes |
| --- | --- | --- |
| `users` | `id` (uuid, pk), `email` (text, unique, lower-cased), `password_hash` (text), `display_name` (text, nullable until set), `created_at` | Unique index on `email`. `password_hash` holds the Argon2 encoded hash string. |
| `teams` | `id` (uuid, pk), `name` (text), `invite_code` (text, unique, 16-char urlsafe), `created_by_user_id` (fk → users), `created_at` | Unique index on `invite_code`. Regeneration overwrites the column. |
| `team_memberships` | `id` (uuid, pk), `user_id` (fk → users), `team_id` (fk → teams), `joined_at`, `left_at` (nullable) | Index on `(user_id, left_at)` to resolve active membership. Soft delete via `left_at`. |

Application invariant: at most one `team_memberships` row per user with `left_at IS NULL`, enforced in a single transaction on join/switch.

### 2.2 Backend Changes

**Dependency changes** (`app/api/pyproject.toml`):

- Remove: `asyncpg`.
- Add: `aiosqlite` (promote from dev), `itsdangerous`, `argon2-cffi`, `structlog`.

**Config changes** (`app/api/app/config.py`):

Add settings: `SECRET_KEY`, `APP_BASE_URL`, `SESSION_TTL_SECONDS=2592000`, `RATE_LIMIT_WINDOW_SECONDS=900`, `RATE_LIMIT_MAX=5`. Update `.env.example`. Switch default `DATABASE_URL` to `sqlite+aiosqlite:////data/nowboard.db`. Drop the SMTP / `FROM_EMAIL` / magic-link settings — no email delivery in v1.

**Database bootstrap** (`app/api/app/database.py`): keep the async SQLModel session factory; on engine creation execute `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON`.

**New files under `app/api/app/`**:

| Path | Responsibility |
| --- | --- |
| `models/user.py` | `User` SQLModel. |
| `models/team.py` | `Team` SQLModel. |
| `models/membership.py` | `TeamMembership` SQLModel. |
| `models/__init__.py` | Re-export models so Alembic autogenerate sees them. |
| `services/passwords.py` | Argon2 hash + verify helpers over `argon2-cffi` using project-wide parameters. |
| `services/sessions.py` | `itsdangerous` signed-cookie helpers: issue, verify, refresh, clear. |
| `services/teams.py` | Pure functions: create team, get current membership, join/switch team, regenerate invite code — each in a single transaction. Invite codes are generated inline (16-char urlsafe). |
| `dependencies.py` | `get_current_user` (reads + refreshes session cookie), `get_current_team`. |
| `routers/auth.py` | `/api/auth/*` endpoints. |
| `routers/users.py` | `/api/users/me` (GET, PATCH). |
| `routers/teams.py` | `/api/teams/*` endpoints. |
| `logging.py` | structlog configuration to stdout JSON. |
| `scripts/export_openapi.py` | Boot the FastAPI app and write `app/api/openapi.json` (the committed contract). Exposed as `uv run export-openapi`. |

**`app/api/app/main.py`** is extended to: include the new routers, install the session middleware (refresh cookie on authenticated requests), and mount `app/frontend/dist` as static when present.

### 2.3 API Contracts

All endpoints return JSON. Auth-protected endpoints require the `session` cookie; unauthenticated callers receive `401`.

| Method | Path | Purpose | Request body | Response |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/sign-up` | Create an account + sign in | `{ email, password }` | `201 { user, needs_display_name, current_team }`, sets session cookie. `409 { error: "email_taken" }` if email exists. `422` on validation errors. `429` if IP rate-limited. |
| POST | `/api/auth/sign-in` | Authenticate existing account | `{ email, password }` | `200 { user, needs_display_name, current_team }`, sets session cookie. `401 { error: "invalid_credentials" }` for any bad credential (no enumeration). `429` if IP rate-limited. |
| POST | `/api/auth/sign-out` | Clear session cookie | — | `204` |
| GET | `/api/users/me` | Current user + team | — | `{ user, current_team }` |
| PATCH | `/api/users/me` | Set / update display name | `{ display_name }` | `200 { user }` (enforces 1–40 chars) |
| POST | `/api/teams` | Create a team | `{ name }` | `201 { team, invite_url }`; `409` if already on an active team. |
| GET | `/api/teams/current` | Current team + invite URL | — | `{ team, invite_url }` |
| POST | `/api/teams/current/invite/regenerate` | Rotate `invite_code` | — | `{ invite_url }` |
| POST | `/api/teams/join` | Join by invite code | `{ invite_code, confirm_switch?: bool }` | `200 { team }`, or `409 { needs_switch_confirm, current_team, new_team }` if on a different team and `confirm_switch` is false, or `404` if code unknown. |

### 2.4 Security & Auth Details

- **Password hashing:** Argon2id via `argon2-cffi`, default `PasswordHasher` parameters (they are conservative and fine for a workshop). Encoded hash stored as a single string in `users.password_hash`.
- **Session cookie:** `itsdangerous.URLSafeTimedSerializer` with `SECRET_KEY`. Payload `{user_id, issued_at}`. Attrs: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure=False` (local HTTP). Middleware re-signs on each authenticated request (rolling 30-day window).
- **Sign-out:** `Set-Cookie: session=; Max-Age=0`. Not server-revocable before 30 days (accepted workshop limitation).
- **Rate limiter:** in-process `dict[str, collections.deque[float]]` guarded by `asyncio.Lock`, defined inline in `routers/auth.py`, keyed by client IP. 5 attempts per 900-second window against `/api/auth/sign-up` and `/api/auth/sign-in` combined. 6th attempt returns `429`.
- **Account enumeration:** `/api/auth/sign-in` returns the same `401 invalid_credentials` for unknown email and wrong password. `/api/auth/sign-up` returns `409 email_taken` on duplicate — we accept this limited enumeration surface for better UX (the rate limiter caps how fast an attacker could probe).

### 2.5 Frontend Changes

Layout follows the existing TanStack Router file-based convention under `app/frontend/src/routes/`.

**New files** (`src/`):

| Path | Responsibility |
| --- | --- |
| `api/client.ts` | `fetch` wrapper with `credentials: 'include'`, shared base URL, and JSON error handling. Registered as the `@hey-api/client-fetch` custom client so all generated calls route through it. |
| `api/generated/` | Auto-generated TypeScript SDK (types + per-operation functions) produced by `@hey-api/openapi-ts` from `app/api/openapi.json`. Do not hand-edit. |
| `../openapi-ts.config.ts` | hey-api config at `app/frontend/`: input `../api/openapi.json`, output `src/api/generated/`, client `@hey-api/client-fetch`. |
| `hooks/useCurrentUser.ts` | TanStack Query wrapper over the generated `getMe` SDK function. |
| `components/AuthGate.tsx` | Boot-time `useCurrentUser` gate; drives redirects. |
| `components/InvitePanel.tsx` | Show + copy invite URL; regenerate button. |
| `components/SwitchTeamDialog.tsx` | shadcn dialog for 409-switch confirmation. |
| `routes/__root.tsx` | Wrap the existing layout with `AuthGate`. |
| `routes/index.tsx` | Replace placeholder — email + password form with "Sign in" / "Sign up" mode toggle (landing). |
| `routes/onboarding.tsx` | Steps: display-name form → create/join choice → create-team form. |
| `routes/join.$inviteCode.tsx` | Join flow; handles 409 with `SwitchTeamDialog`. |
| `routes/board.tsx` | Placeholder board page (this spec renders `InvitePanel`; cards/replies land in later specs). |

**Route-plugin regeneration:** `routeTree.gen.ts` is regenerated by the TanStack Router Vite plugin on save — do not hand-edit.

**TanStack Query setup:** add a `QueryClientProvider` at `src/main.tsx` above `RouterProvider`. Add `@tanstack/react-query` to `package.json`.

**Codegen dependencies:** add `@hey-api/openapi-ts` and `@hey-api/client-fetch` to `app/frontend/package.json` devDependencies. Add a `"codegen": "openapi-ts"` npm script.

### 2.6 Redirect Matrix (frontend `AuthGate`)

| User state | Current route allowed | Otherwise redirect to |
| --- | --- | --- |
| No user | `/`, `/auth/*`, `/join/:code` | `/` |
| User, no `display_name` | `/onboarding` (step=name) | `/onboarding` |
| User, no active team | `/onboarding` (step=team), `/join/:code` | `/onboarding` |
| User + team | `/board`, `/join/:code` | `/board` |

### 2.8 OpenAPI Contract Workflow

- `app/api/openapi.json` is the source of truth for the API surface and is committed to the repo.
- After any change to routers, Pydantic schemas, or status codes, the backend developer runs `uv run export-openapi` from `app/api/`. The frontend developer (or the same task, if cross-cutting) runs `pnpm codegen` from `app/frontend/`. Both regenerated artefacts are committed together.
- Hand-written API modules under `src/api/` (outside `generated/`) are disallowed for endpoint calls. Routes and components import directly from `@/api/generated/` and pass request bodies / params typed from the generated module.
- Rolling-cookie refresh remains a middleware concern on the backend — the generated client is contract-only; auth wiring lives in `api/client.ts`.
- CI drift-checks and pre-commit hooks are deferred; the v1 workflow is manual.

### 2.9 Infrastructure Changes

Add a top-level `docker-compose.yml`:

| Service | Image / build | Responsibilities |
| --- | --- | --- |
| `web` | Multi-stage build: Node stage runs `pnpm install && pnpm build` in `app/frontend`; Python stage `uv sync` in `app/api`, copies `frontend/dist` into `app/api/app/static/`. Runs `uvicorn app.main:app --host 0.0.0.0 --port 8000`. | Serves the API and the SPA from one origin. Exposes `:8000`. Mounts named volume `nowboard-db` at `/data`. |

`.env.example` at repo root documents: `SECRET_KEY`, `DATABASE_URL=sqlite+aiosqlite:////data/nowboard.db`, `APP_BASE_URL=http://localhost:8000`.

---

## 3. Impact and Risk Analysis

- **System Dependencies:** First feature spec — establishes the shape of auth, sessions, team membership, and the Alembic baseline that every later spec (cards, reactions, replies, board view, notifications) will build on.
- **Potential Risks & Mitigations:**
  - **Stateless sessions aren't revocable.** A stolen cookie remains valid up to 30 days. *Mitigation:* documented workshop limitation; rotating `SECRET_KEY` invalidates all sessions globally if needed.
  - **SQLite concurrency.** Writer contention with long-lived SSE connections in later specs. *Mitigation:* WAL mode enabled on startup; keep write transactions short; SSE fan-out stays in-process (no DB writes per broadcast).
  - **Email enumeration at sign-in.** Mitigated by returning the same generic `401 invalid_credentials` for both unknown email and wrong password. `/api/auth/sign-up` returns `409 email_taken` on duplicate — accepted limited enumeration surface, capped by the rate limiter.
  - **Invite-code brute force.** 16 urlsafe chars (~96 bits) is ample; regeneration provides rotation.
  - **Race on "one active membership" invariant.** *Mitigation:* single transaction that soft-deletes any `left_at IS NULL` row for the user before inserting the new membership.
  - **Rate limiter resets on restart.** Accepted for single-instance workshop; noted.
  - **Swapping asyncpg for aiosqlite** changes the DB URL scheme; the scaffold's existing `database.py` async session factory remains compatible (SQLModel + async driver), but `migrations/env.py` must be set to sync SQLite for Alembic (standard practice) — verify during implementation.

---

## 4. Testing Strategy

- **Unit (pytest + pytest-asyncio):**
  - Argon2 hash/verify round-trip; verifying a wrong password fails; rehash-on-verify if parameters change (optional).
  - Session cookie sign/verify round-trip, rolling renewal, tamper rejection.
  - Rate limiter sliding-window at boundaries.
  - Invite-code generation uniqueness and regeneration atomicity.
- **Integration (pytest + `httpx.AsyncClient` against the FastAPI app, in-memory aiosqlite):**
  - Full sign-up happy path: sign-up → set display name → create team → `invite_url`.
  - Sign-in with correct credentials returns 200; wrong password returns 401 `invalid_credentials`; unknown email returns the same 401.
  - Duplicate sign-up returns 409 `email_taken`.
  - Join flows: signed-out (routes through auth), signed-in no team, signed-in same team (no-op), signed-in different team (requires `confirm_switch=true`, soft-deletes previous membership).
  - 6th sign-in attempt from the same IP within 15 min returns 429.
- **Frontend (Vitest + React Testing Library):**
  - `AuthGate` redirect matrix for each of the four user states.
  - `SwitchTeamDialog` flow: 409 response → dialog → retry with `confirm_switch=true`.
  - Landing form submit in Sign-up mode → onboarding navigation; Sign-in mode → board navigation.
  - Run `pnpm codegen` before frontend tests so the generated SDK matches the live backend contract.
- **Manual smoke (documented in README):** `docker compose up` → `http://localhost:8000` → sign up → onboarding → create team → copy invite → second browser → open invite URL → sign up → join team.

# Tasks: Team & Account Essentials

**Spec:** `context/spec/001-team-and-account-essentials/`

---

## Slice 0: Infra & DB foundation — app boots on docker-compose with SQLite + MailHog

- [x] Swap `asyncpg` for `aiosqlite` in `app/api/pyproject.toml`; add `itsdangerous`, `aiosmtplib`, `structlog`; run `uv lock && uv sync`. **[Agent: python-backend]**
- [x] Update `app/api/app/database.py`: async SQLModel engine for `sqlite+aiosqlite://`; run `PRAGMA journal_mode=WAL` and `PRAGMA foreign_keys=ON` at startup. **[Agent: sqlite-database]**
- [x] Adjust `app/api/migrations/env.py` for sync-SQLite autogenerate compatibility; set `target_metadata` from `app.models`. **[Agent: sqlite-database]**
- [x] Extend `app/api/app/config.py` with `SECRET_KEY`, `SMTP_HOST`, `SMTP_PORT`, `FROM_EMAIL`, `APP_BASE_URL`, `MAGIC_LINK_TTL_SECONDS=900`, `SESSION_TTL_SECONDS=2592000`, `RATE_LIMIT_WINDOW_SECONDS=900`, `RATE_LIMIT_MAX=3`; default `DATABASE_URL` to `sqlite+aiosqlite:////data/nowboard.db`. Refresh `app/api/.env.example`. **[Agent: python-backend]**
- [x] Add `app/api/app/logging.py` — structlog JSON stdout config; wire from `app.main`. **[Agent: python-backend]**
- [x] Create root `docker-compose.yml` with `web` (builds frontend, runs FastAPI; named volume `nowboard-db` at `/data`; port 8000) and `mail` (`mailhog/mailhog:latest`, ports 8025 + 1025). Add root `.env.example`. **[Agent: docker-infra]**
- [x] Author multi-stage `Dockerfile` at repo root (Node stage builds `app/frontend`; Python stage `uv sync` + copies `dist` into `app/api/app/static/`; runs `uvicorn`). **[Agent: docker-infra]**
- [x] **Verify:** `docker compose up --build`; `curl http://localhost:8000/health` returns 200; MailHog UI at `http://localhost:8025` loads. **[Agent: docker-infra]**

---

## Slice 1: OpenAPI export + hey-api typed client pipeline

- [x] Add `app/api/app/scripts/export_openapi.py` — boots FastAPI, writes `app/api/openapi.json`. Expose as `uv run export-openapi` (script entry in `pyproject.toml`). **[Agent: python-backend]**
- [x] Add `@hey-api/openapi-ts` and `@hey-api/client-fetch` devDeps; add `app/frontend/openapi-ts.config.ts` (input `../api/openapi.json`, output `src/api/generated/`, client `@hey-api/client-fetch`); add `pnpm codegen` script. **[Agent: react-frontend]**
- [x] Create `app/frontend/src/api/client.ts` — fetch wrapper (`credentials: 'include'`, shared base URL, JSON error handling) registered as the hey-api custom client. **[Agent: react-frontend]**
- [x] Add `@tanstack/react-query`; wrap `RouterProvider` in `QueryClientProvider` at `src/main.tsx`. **[Agent: react-frontend]**
- [x] **Verify:** `uv run export-openapi` emits `openapi.json` containing `/health`; `pnpm codegen` emits `src/api/generated/`; `pnpm build` compiles; a sample import from `@/api/generated` type-checks. **[Agent: react-frontend]**

---

## Slice 2: Send a magic link — email captured in MailHog (SUPERSEDED — see Slice 2b)

> Pivot 2026-04-19: spec changed from magic-link to email + password. Tasks below are kept as `[x]` since they shipped, but the code they produced is being replaced in Slice 2b.

- [x] Alembic revision `0001_auth_tables`: create `users` + `magic_link_tokens` with indexes per tech spec. **[Agent: sqlite-database]**
- [x] Add `models/user.py` and `models/magic_link_token.py`; re-export from `models/__init__.py`. **[Agent: sqlite-database]**
- [x] Add `services/tokens.py` (generate/verify/consume magic-link tokens; TTL + single-use) and `services/mailer.py` (aiosmtplib → MailHog). **[Agent: python-backend]**
- [x] Add `routers/auth.py` with `POST /api/auth/magic-link` (always 204). Register router in `app.main`. **[Agent: python-backend]**
- [x] Run `uv run export-openapi` then `pnpm codegen`; commit both artefacts. **[Agent: python-backend]**
- [x] Rewrite `src/routes/index.tsx` into the landing form (shadcn input + submit) using the generated `postApiAuthMagicLink` function; add `src/routes/auth/link-sent.tsx`. **[Agent: react-frontend]**
- [x] **Verify:** in Chrome, submit an email → navigate to `/auth/link-sent`; MailHog UI shows a captured email containing a link of the form `{APP_BASE_URL}/auth/verify?token=…`. **[Agent: react-frontend]**

---

## Slice 2b: Credential auth replaces magic link

- [x] Drop `services/mailer.py`, `services/tokens.py` (magic-link helpers), `routers/auth.py` magic-link and verify endpoints, and the `magic_link_tokens` model. **[Agent: python-backend]**
- [x] Alembic revision `0003_add_password_hash`: add `password_hash` text column to `users`. **[Agent: sqlite-database]**
- [x] Alembic revision `0004_drop_magic_link_tokens`: drop the `magic_link_tokens` table. **[Agent: sqlite-database]**
- [x] Add `argon2-cffi` to `app/api/pyproject.toml`; remove `aiosmtplib`. Run `uv lock && uv sync`. **[Agent: python-backend]**
- [x] Add `services/passwords.py` — Argon2 hash + verify helpers over `argon2-cffi`. **[Agent: python-backend]**
- [x] Replace `routers/auth.py` with `POST /api/auth/sign-up` (201) and `POST /api/auth/sign-in` (200) — both issue session cookie and return `{ user, needs_display_name, current_team }`. `409 email_taken` on duplicate sign-up; `401 invalid_credentials` on bad sign-in. **[Agent: python-backend]**
- [x] Update settings: remove `SMTP_*`, `FROM_EMAIL`, `MAGIC_LINK_TTL_SECONDS`; bump `RATE_LIMIT_MAX` to 5. Refresh `.env.example`. **[Agent: python-backend]**
- [x] Remove the `mail` service and SMTP env vars from `docker-compose.yml` and root `.env.example`. **[Agent: docker-infra]**
- [x] Regen OpenAPI + `pnpm codegen`. **[Agent: python-backend]**
- [x] Rewrite `src/routes/index.tsx`: single form with Sign in / Sign up mode toggle (email + password), submits to the corresponding generated SDK function. **[Agent: react-frontend]**
- [x] Delete `src/routes/auth/link-sent.tsx` and `src/routes/auth/verify.tsx`. Simplify `AuthGate`'s public-route list (no more `/auth/*`). **[Agent: react-frontend]**
- [x] **Verify:** rebuild + migrate; sign up with a new email via `curl` → 201 with session cookie; sign in with wrong password → 401; duplicate sign-up → 409; `GET /api/users/me` returns the user; sign-out clears session. **[Agent: docker-infra]**

---

## Slice 3: Verify link → authenticated session (SUPERSEDED by Slice 2b)

- [x] Add `services/sessions.py` (`itsdangerous` sign/verify/refresh/clear) and `dependencies.py` (`get_current_user` that refreshes the cookie). **[Agent: python-backend]**
- [x] Add session-refresh middleware in `app.main`. **[Agent: python-backend]**
- [x] Add `POST /api/auth/verify` (consumes token in a transaction, lazily creates the user, issues the session cookie) and `POST /api/auth/sign-out`. **[Agent: python-backend]**
- [x] Add `routers/users.py` with `GET /api/users/me`. **[Agent: python-backend]**
- [x] Regen OpenAPI + codegen. **[Agent: python-backend]**
- [x] Add `src/routes/auth/verify.tsx` (reads `?token`, calls generated `postApiAuthVerify`, routes onward). Add `hooks/useCurrentUser.ts` (TanStack Query over generated `getApiUsersMe`). Add `components/AuthGate.tsx` v1: redirect unauthenticated users to `/`. **[Agent: react-frontend]**
- [x] Add a temporary "Sign out" button for authed users on `/` using generated `postApiAuthSignOut`. **[Agent: react-frontend]**
- [x] **Verify:** in Chrome, request link → click from MailHog → land authenticated; `/api/users/me` returns the user; sign-out clears session; expired/reused token shows a friendly error. **[Agent: react-frontend]**

---

## Slice 4: Display-name capture for first-time users

- [x] Add `PATCH /api/users/me` (1–40 chars validation). Regen OpenAPI + codegen. **[Agent: python-backend]**
- [x] Add `src/routes/onboarding.tsx` with the display-name step using the generated `patchApiUsersMe`. **[Agent: react-frontend]**
- [x] Extend `AuthGate` to redirect users with `needs_display_name` into `/onboarding`. **[Agent: react-frontend]**
- [x] **Verify:** a brand-new email lands on `/onboarding` after verifying; submitting a name persists it and clears the gate; reload stays past onboarding. **[Agent: react-frontend]**

---

## Slice 5: Create a team — first user lands on the board with an invite link

- [x] Alembic revision `0002_team_tables`: create `teams` and `team_memberships`. **[Agent: sqlite-database]**
- [x] Add `models/team.py`, `models/membership.py`; re-export. **[Agent: sqlite-database]**
- [x] Add `services/teams.py` (`create_team`, `get_current_team`, `regenerate_invite`, `join_team` stubs for later slices). Enforce single-active-membership invariant in a single transaction. **[Agent: python-backend]**
- [x] Add `routers/teams.py` with `POST /api/teams` (409 if already on a team) and `GET /api/teams/current`. Add `get_current_team` dependency. Regen OpenAPI + codegen. **[Agent: python-backend]**
- [x] Extend `onboarding.tsx` with the "create team" step (calls generated `postApiTeams`). Add `src/routes/board.tsx` placeholder with `components/InvitePanel.tsx` (copy-to-clipboard). **[Agent: react-frontend]**
- [x] Extend `AuthGate`: no-team → onboarding team step; has-team → `/board`. **[Agent: react-frontend]**
- [x] **Verify:** in Chrome, complete onboarding → create team → land on `/board` with a copyable invite URL; generated `getApiTeamsCurrent` returns team + invite URL. **[Agent: react-frontend]**

---

## Slice 6: Join a team via invite link — simple cases (signed-out, no-team, same-team)

- [x] Implement `POST /api/teams/join` for non-conflict cases: unknown code → 404; same-team → 200 no-op; no active team → insert membership, 200. Regen OpenAPI + codegen. **[Agent: python-backend]**
- [x] Add `src/routes/join.$inviteCode.tsx` — calls generated `postApiTeamsJoin` with `confirm_switch=false`; 404 → error view. When signed-out, stash the invite code and route through `/`; resume join after auth. **[Agent: react-frontend]**
- [x] Update `AuthGate` to allow `/join/:code` for unauthenticated users and users without a team. **[Agent: react-frontend]**
- [x] **Verify:** open a second Chrome profile, paste invite URL → sign in via magic link → land on the same team's `/board`; opening the invite URL while already a member just goes to `/board`. **[Agent: react-frontend]**

---

## Slice 7: Team-switch confirmation on invite conflict

- [x] Extend `POST /api/teams/join`: returns `409 { needs_switch_confirm, current_team, new_team }` when caller is on a different active team and `confirm_switch` is false; with `confirm_switch=true` soft-deletes the previous membership (`left_at=now()`) in one transaction. Regen OpenAPI + codegen. **[Agent: python-backend]**
- [x] Add `components/SwitchTeamDialog.tsx` (shadcn dialog); wire it into `join.$inviteCode.tsx` so 409 opens the dialog and Confirm retries with `confirm_switch=true`. **[Agent: react-frontend]**
- [x] **Verify:** user on team A opens team B's invite URL → dialog appears → confirm → user lands on team B's board; `/api/users/me` no longer references team A. **[Agent: react-frontend]**

---

## Slice 8: Invite regeneration + magic-link rate limiting

- [x] Add `POST /api/teams/current/invite/regenerate`. Regen OpenAPI + codegen. **[Agent: python-backend]**
- [x] ~~Add `services/rate_limit.py`~~ — superseded: IP-based rate limit on `/api/auth/sign-up` + `/api/auth/sign-in` landed in Slice 2b. **[Agent: python-backend]**
- [x] Extend `InvitePanel.tsx` with a "Regenerate link" button (generated SDK call) + a success toast. **[Agent: react-frontend]**
- [x] **Verify:** regenerate produces a new URL; opening the old URL returns 404. 6th sign-in attempt within 15 min returns 429; `docker compose logs web` includes `rate_limited`. **[Agent: docker-infra]**

---

## Slice 9: Automated tests

- [x] Backend unit: password hash/verify; session sign/verify/refresh + tamper rejection; invite-code uniqueness. **[Agent: python-backend]**
- [x] Backend integration (`httpx.AsyncClient` + in-memory aiosqlite): full sign-up → create-team happy path; all four join flows including switch; duplicate sign-up 409; wrong-pw 401; 6th sign-in attempt 429. **[Agent: python-backend]**
- [x] Frontend tests: Vitest + React Testing Library; `AuthGate` redirect matrix (4 states × 4 paths); `SwitchTeamDialog` flow; `AuthForm` sign-in happy path + 401 + 409 email-taken. **[Agent: react-frontend]**
- [x] **Verify:** `uv run --group test pytest` green in `app/api/` (21/21); `pnpm test` green in `app/frontend/` (24/24). **[Agent: python-backend]**

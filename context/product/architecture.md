# System Architecture Overview: Nowboard

---

## 1. Application & Technology Stack

- **Frontend Framework:** React 18 + Vite + TypeScript
- **UI Styling:** Tailwind CSS + shadcn/ui components
- **Client Data Layer:** TanStack Query (server state) with an EventSource subscription feeding cache invalidations
- **Backend Framework:** Python 3.12 + FastAPI (async)
- **Realtime Transport:** Server-Sent Events (SSE) — one-way push from FastAPI to the browser for new cards, reactions, and replies
- **API Shape:** REST + JSON for writes; SSE stream for live board updates

---

## 2. Data & Persistence

- **Primary Database:** SQLite (single-file, stored on a mounted Docker volume)
- **ORM / Schema:** SQLModel (Pydantic-native models) with Alembic for migrations
- **Caching:** None in v1 — tiny data volume, Postgres-scale caching is unneeded
- **Ephemeral State:** In-process Python objects for SSE subscriber fan-out (single-instance deploy makes this safe)

---

## 3. Infrastructure & Deployment

- **Deployment Target:** Local / Docker only for v1 (workshop scope, no cloud hosting)
- **Container Orchestration:** `docker-compose` with two services — `web` (FastAPI + static-served React build) and `mail` (MailHog for local magic-link delivery)
- **Persistence Volume:** Named Docker volume mounted at the SQLite DB path so data survives container restarts
- **Process Manager:** `uvicorn` running FastAPI; the built React bundle is served as static assets by FastAPI (single-origin, no CORS)

---

## 4. External Services & APIs

- **Authentication:** Email magic-link + server-side session cookies (HttpOnly, SameSite=Lax). No passwords.
- **Email Delivery (local):** MailHog container — captures outbound magic-link emails for the workshop environment
- **Team Invitations:** Signed invite-link tokens (short-lived JWT or itsdangerous-signed string) scoped to a specific team

---

## 5. Observability & Monitoring

- **Logging:** Structured JSON logs to stdout via `structlog`; captured by the Docker log driver
- **Error Tracking:** None in v1 (intentionally deferred for workshop simplicity)
- **Metrics / Tracing:** None in v1

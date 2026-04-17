# Product Definition: Nowboard

- **Version:** 1.0
- **Status:** Proposed

---

## 1. The Big Picture (The "Why")

### 1.1. Project Vision & Purpose

To give small, distributed or hybrid engineering teams ambient visibility into what everyone's working on — without forcing them to sit through a daily standup meeting or dig through Slack scrollback and Jira tickets.

> Note: This product is a workshop/learning exercise. In the real world, Slack + Linear already cover most of this use case. Nowboard exists as a focused, well-scoped example to practice the AWOS workflow on.

### 1.2. Target Audience

Small engineering teams of 3–10 people, distributed or hybrid, where teammates know each other and want lightweight async awareness rather than ceremony.

### 1.3. User Personas

- **Persona 1: "Dev Lead Priya"**
  - **Role:** Tech lead of a 6-person distributed engineering team.
  - **Goal:** Wants ambient awareness of what her team is working on and who's blocked, without interrupting focus time with a sync standup.
  - **Frustration:** Slack standup posts scroll away by lunch. Jira is too slow and formal for "I'm debugging the auth flow right now." The daily sync meeting eats 30 minutes of prime-focus time.

### 1.4. Success Metrics

- Teams adopting Nowboard drop their synchronous daily standup meeting within 4 weeks.
- Active team members view the board at least 3 times per day on average.
- Median time to post a card is under 30 seconds.

---

## 2. The Product Experience (The "What")

### 2.1. Core Features

- **Post short cards** — Quick 1-line card with a status (working on / blocked / done) and an optional link.
- **Shared team board** — A single glanceable board grouped by person, showing the team's current cards.
- **Reactions & replies** — Lightweight emoji reactions and short threaded replies for nudges, offers of help, and acknowledgments.

### 2.2. User Journey

A developer starts their day, opens Nowboard in a browser tab, and drops a card: "Working on auth flow refactor, PR soon." Throughout the day, as they switch tasks or hit a blocker, they post another short card. Teammates glance at the board between tasks to see who's on what, react with a 👀 or 🙌, and reply on a card when they can help unblock someone. No meeting needed.

---

## 3. Project Boundaries

### 3.1. What's In-Scope for this Version

- User accounts and a single shared team board.
- Posting short status cards (working on / blocked / done) with optional links.
- A glanceable board grouped by teammate.
- Emoji reactions and short threaded replies on cards.
- Web-only, no external integrations.

### 3.2. What's Out-of-Scope (Non-Goals)

- Mobile application.
- Analytics, reporting, throughput metrics, or burndown charts.
- Cross-team or org-wide rollups — Nowboard is single-team only.
- Slack or other third-party integrations.
- Daily digests or scheduled summaries.

# Functional Specification: Team & Account Essentials

- **Roadmap Item:** Phase 1 — Team & Account Essentials (Sign-Up & Login + Create or Join a Team)
- **Status:** Completed
- **Author:** Nail Badiullin

---

## 1. Overview and Rationale (The "Why")

Before anything else can happen on Nowboard, a team has to actually exist and its members have to be able to get onto the same board. Today, a tech lead like Priya has to either run a sync standup meeting or wrangle a Slack thread. Nowboard replaces that with a shared board — but only if onboarding is effortless. A simple email + password flow keeps v1 fully self-contained (no email-delivery dependency), and a shared team invite link lets the whole team land on one board within minutes.

**Success signal:** a 6-person team goes from "zero" to "everyone posting cards on the same board" in under 10 minutes, with no admin/IT involvement.

---

## 2. Functional Requirements (The "What")

### 2.1 Sign Up with Email + Password

- **As a** new user, **I want to** create an account with email and password, **so that** I can start using Nowboard right away.
  - **Acceptance Criteria:**
    - [x] The landing page has a single form with tabs (or a toggle) for "Sign in" and "Sign up."
    - [x] The sign-up form requires email and a password (min 8 characters, max 128).
    - [x] On submit, a new account is created, the user is authenticated, and they land on an onboarding screen to set a display name.
    - [x] If the email is already registered, the form shows "An account with this email already exists — try signing in" inline; no account is created.
    - [x] Sign-up is rate-limited to 5 attempts per 15 minutes per IP; the 6th attempt returns a friendly "Too many attempts — try again soon" without revealing whether a given email exists.

### 2.2 Sign In with Email + Password

- **As a** returning user, **I want to** sign in with my email and password, **so that** I can get back to the board.
  - **Acceptance Criteria:**
    - [x] The sign-in form takes email + password and a "Sign in" button.
    - [x] On valid credentials, the user is authenticated and routed to their current team's board (or onboarding if incomplete).
    - [x] On invalid credentials, the form shows a generic "Email or password is incorrect" message (no enumeration: same message for wrong email and wrong password).
    - [x] Sign-in is rate-limited to 5 attempts per 15 minutes per IP; the 6th attempt returns the same generic message plus a "Too many attempts — try again soon" banner.

### 2.2a Display Name (First Sign-In)

- **As a** newly signed-up user, **I want to** set a display name, **so that** teammates recognize me on cards.
  - **Acceptance Criteria:**
    - [x] After sign-up, the user is routed to an onboarding screen asking for a display name (required, 1–40 characters).
    - [x] Until a display name is set, the rest of the app is gated — the user can only view the onboarding screen and sign-out.
    - [x] Once set, the user is routed to "Create a team" or can open a received invite link.

### 2.3 Session Management

- **As a** signed-in user, **I want** my session to stick around, **so that** I don't have to sign in every time I open a tab.
  - **Acceptance Criteria:**
    - [x] On successful sign-in, the server sets an HttpOnly, SameSite=Lax session cookie.
    - [x] The session lasts 30 days with rolling renewal on any authenticated request.
    - [x] A "Sign out" action in the user menu invalidates the session and returns the user to the landing page.

### 2.4 Create a Team

- **As a** first user from my team, **I want to** create a team workspace, **so that** my teammates have somewhere to gather.
  - **Acceptance Criteria:**
    - [x] A signed-in user with no team sees a "Create a team" option on the onboarding screen.
    - [x] The user enters a team name (required, 2–40 characters) and clicks "Create."
    - [x] The team is created, the user becomes its first member, and the user lands on the (empty) team board.
    - [x] A shareable invite link is generated for the team and shown in a "Invite teammates" panel on the board.

### 2.5 Join a Team via Invite Link

- **As a** teammate, **I want to** click a link and end up on my team's board, **so that** I don't have to be manually provisioned.
  - **Acceptance Criteria:**
    - [x] The invite link is a reusable URL scoped to a specific team.
    - [x] Clicking the link while signed out takes the user to sign-up/sign-in, then continues the join flow after auth.
    - [x] Clicking the link while signed in and not already on a team adds the user to the team and navigates to the board.
    - [x] Clicking the link while signed in and already a member of the same team simply navigates to the board.
    - [x] Clicking the link while signed in and a member of a *different* team shows a confirmation prompt: "Leave [Current Team] and join [New Team]?" with Cancel and Confirm actions. Confirming removes the user from the current team and adds them to the new one.
    - [x] Any current team member can view the invite link from the board's "Invite teammates" panel.
    - [x] Any current team member can click "Regenerate link" to invalidate the previous link and produce a new one.

### 2.6 One Team per User (v1 Constraint)

- **As a** user, **I am** a member of at most one team at a time, **so that** v1 stays simple with no team switcher.
  - **Acceptance Criteria:**
    - [x] A user who belongs to a team never sees an empty "choose a team" screen — they always route to their team's board after sign-in.
    - [x] No team switcher UI exists in v1.

---

## 3. Scope and Boundaries

### In-Scope

- Email + password sign-up and sign-in with Argon2 hashing.
- Rate limiting (5 sign-up / sign-in attempts per IP per 15 minutes).
- 30-day rolling HttpOnly session cookies and sign-out.
- Display name collection at first sign-in; email + display name profile.
- Team creation by any signed-in user who isn't already on a team.
- Shared, reusable team invite links (regenerable by members).
- Join flow for signed-out and signed-in users, including the "switch teams" confirmation prompt.
- One team per user in v1.

### Out-of-Scope

- Magic-link or passwordless authentication, OAuth/SSO, SAML.
- Email delivery of any kind in v1.
- Password reset / forgot-password flows (deferred).
- Per-email invite tokens or pending-member approval flows.
- Team switching UI or membership in multiple teams simultaneously.
- Admin, owner, or viewer roles — all members are equal in v1.
- Avatar upload or extended profile fields.
- Account deletion or email change.

_Automatically out-of-scope (covered by other roadmap items): Post a Status Card; Edit/Delete Own Card; Glanceable Team View; Today-Focused Surface; Reactions & Replies; Notifications; Keyboard-First Posting; Yesterday View; Search; Slack integration; Daily Digest; Mobile App; Analytics; Cross-Team Rollups._

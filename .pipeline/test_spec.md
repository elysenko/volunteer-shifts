# Test Specification

> **Warning — surface.json is a stale scaffold.** `.pipeline/surface.json` lists only 2 routes
> (`GET /api/health`, `POST /api/auth/login`) and placeholder components (`Home`, `Login`) that do
> not match the approved spec. This test spec instead derives the full API surface from
> `requirements/spec.md` + `.pipeline/tasks.md` (14 endpoints). Both surface.json routes are covered
> below as a subset. If a downstream runner keys off surface.json, it must be regenerated first.
>
> **Open item (from tasks.md):** `/api/admin/settings` and the `SystemSetting` model exist for
> provisioned services (`postgresql`, `minio`) that the spec does not otherwise consume. These
> endpoints are tested for auth + CRUD behaviour only; no runtime consumption is asserted.

## Coverage summary
- Total cases: 58
- API endpoints covered: 14 / 14 (spec-derived surface; surface.json's 2 routes are a covered subset)
- User journeys covered: 9

## API tests

### `GET /api/health`
- **Happy path**: no auth, no body → `200` with body `{ "status": "ok" }`. Public route (no `Authorization` header required).
- **Validation failures**: n/a (no inputs).
- **Auth failures**: n/a — must succeed **without** a token; sending a bogus token must still return `200`.
- **Idempotency / edge cases**: repeated calls return identical `200 {status:'ok'}`; response must not touch the DB.

### `GET /api/health/deep`
- **Happy path**: no auth → executes `SELECT 1` against SQLite → `200` with a DB-ok body (e.g. `{ status:'ok', db:'ok' }`).
- **Validation failures**: n/a.
- **Auth failures**: n/a — public route.
- **Idempotency / edge cases**: if the DB is unreachable, returns a non-2xx (e.g. `503`) rather than `200`; does not throw an unhandled 500 crash.

### `POST /api/auth/signup`
- **Happy path**: `{ email:"new@x.io", password:"pw123456", name:"New" }` against a **non-empty** User table → `201`/`200` with `{ token:<jwt>, user:{ id, email, name, role:"USER" } }`; `passwordHash` never present in the response; a bcrypt hash (not plaintext) is stored.
- **First-user fallback**: same body against an **empty** User table → created user has `role:"ADMIN"`.
- **Validation failures**: missing/blank email, malformed email, missing/short password, or missing name → `400` (zod) with an error body; no user created.
- **Duplicate**: signup with an already-registered email → `409` (unique constraint); no second user created.
- **Auth failures**: n/a — public route (no token needed).
- **Idempotency / edge cases**: returned JWT verifies and encodes `{ sub:<userId>, role }`.

### `POST /api/auth/login`
- **Happy path**: valid seeded credentials (from `SEED_CREDS_JSON`, one per ADMIN + 2 USER) → `200` with `{ token:<jwt>, user:{ id, email, name, role } }`; token verifies.
- **Validation failures**: missing email or password → `400`.
- **Auth failures**: correct email + wrong password → `401`; unknown email → `401`. Error message must not reveal which field was wrong (no user-enumeration).
- **Idempotency / edge cases**: two logins for the same user both yield valid tokens.

### `GET /api/auth/me`
- **Happy path**: valid `Authorization: Bearer <token>` → `200` with the current user `{ id, email, name, role }`; no `passwordHash`.
- **Validation failures**: n/a.
- **Auth failures**: no header → `401`; malformed/expired/tampered token → `401`.
- **Idempotency / edge cases**: role in the response matches the token's role claim.

### `GET /api/shifts`
- **Happy path**: authed user → `200` with an array of **upcoming** shifts (`startsAt >= now`) ordered ascending; each item includes computed `openSlots = totalSlots − count(signups)`.
- **Validation failures**: n/a.
- **Auth failures**: no/invalid token → `401`.
- **Idempotency / edge cases**: shifts with `startsAt < now` are excluded; a fully-booked shift shows `openSlots: 0` (still listed).

### `GET /api/shifts/:id`
- **Happy path**: authed user → `200` with shift detail plus `openSlots` and a `signedUp` boolean reflecting **the calling user's** signup state.
- **Validation failures**: non-numeric/garbage `:id` → `400` or `404` (must not 500).
- **Auth failures**: no/invalid token → `401`.
- **Idempotency / edge cases**: unknown but well-formed id → `404`; `signedUp` is `true` only after the caller has signed up, `false` otherwise.

### `POST /api/shifts`
- **Happy path**: admin token + `{ startsAt, roleName, location, totalSlots, durationHours? }` → `201` with the created shift; `durationHours` defaults to `2` when omitted; `createdById` = admin's id.
- **Validation failures**: missing required fields, `totalSlots <= 0`, or non-ISO `startsAt` → `400`; no shift created.
- **Auth failures**: no token → `401`; **USER** token → `403` (admin-only).
- **Idempotency / edge cases**: created shift subsequently appears in `GET /api/shifts` if upcoming.

### `PATCH /api/shifts/:id`
- **Happy path**: admin token editing an existing shift (e.g. change `location`, `totalSlots`) → `200` with the updated shift; persisted changes visible on re-GET.
- **Validation failures**: invalid field values → `400`; unknown id → `404`.
- **Auth failures**: no token → `401`; USER token → `403`.
- **Idempotency / edge cases**: reducing `totalSlots` below current signup count is either rejected (`400`/`409`) or yields `openSlots: 0` — behaviour must be deterministic (assert whichever the impl chooses, no crash).

### `POST /api/shifts/:id/signup`
- **Happy path**: authed USER on a shift with open slots → `200`/`201` with updated `openSlots` (decremented by 1); a `Signup` row is created; `GET /api/shifts/:id` now reports `signedUp:true`.
- **Duplicate**: same user signs up for the same shift a second time → `409`; `openSlots` unchanged; no second `Signup` row (enforced by `@@unique([shiftId,userId])`).
- **Slot exhaustion**: shift at `openSlots:0` → signup by a new user → `409` (full); no row created.
- **Validation failures**: unknown/garbage `:id` → `404`/`400`.
- **Auth failures**: no/invalid token → `401`.
- **Idempotency / edge cases**: concurrent signups on the last open slot — at most one succeeds; the other returns `409` (transactional re-check + unique constraint). Final `count(signups) <= totalSlots`.

### `GET /api/volunteers`
- **Happy path**: admin token → `200` with USER-role volunteers, each carrying their signups and `totalHours` = sum of `durationHours` across signed-up shifts.
- **Validation failures**: n/a.
- **Auth failures**: no token → `401`; USER token → `403`.
- **Idempotency / edge cases**: a volunteer with no signups appears with `totalHours: 0`; ADMIN-role users are excluded from the roster; `totalHours` matches the sum computed from that user's signups.

### `GET /api/me/shifts`
- **Happy path**: authed user → `200` with the array of shifts the caller is signed up for.
- **Validation failures**: n/a.
- **Auth failures**: no/invalid token → `401`.
- **Idempotency / edge cases**: a user with no signups → `200` with `[]`; the list reflects only the caller's own signups (user A cannot see user B's).

### `GET /api/admin/settings`
- **Happy path**: admin token → `200` with service keys for `postgresql` + `minio`, each with a **masked** value and a `configured` boolean.
- **Validation failures**: n/a.
- **Auth failures**: no token → `401`; USER token → `403`.
- **Idempotency / edge cases**: values are masked (never returned in plaintext); an unset key reports `configured:false`.

### `PATCH /api/admin/settings`
- **Happy path**: admin token + key-value pairs → `200`; upserts `SystemSetting` rows; a follow-up `GET` shows the affected keys as `configured:true`.
- **Validation failures**: malformed body (non-object / unknown-shaped payload) → `400`.
- **Auth failures**: no token → `401`; USER token → `403`.
- **Idempotency / edge cases**: patching the same key twice updates (not duplicates) the row; `updatedAt` advances.

## UI / journey tests

### Journey: Sign up (self-register)
- **Steps**: visit `/signup` (public) → fill name, email, password → submit.
- **Expected outcomes**: account created, token persisted to `localStorage`, redirect to `/` (Shift Board); NavBar shows a logout control.
- **Negative path**: submitting a duplicate email or invalid input shows an inline error and stays on `/signup`; no redirect.

### Journey: Login
- **Steps**: visit `/login` (public) → enter seeded credentials → submit.
- **Expected outcomes**: token stored, redirect to `/`; Shift Board renders.
- **Negative path**: wrong password shows an error message on the form; no token stored; stays on `/login`.

### Journey: Browse Shift Board
- **Steps**: authed user lands on `/`.
- **Expected outcomes**: a "Shift Board" heading and one card per upcoming shift showing date, role, location, and open-slot count; cards ordered by soonest `startsAt`.
- **Negative path**: with no upcoming shifts, an empty-state message renders; API error shows an error state (not a blank page).

### Journey: Deep-link a shift detail (hard refresh)
- **Steps**: navigate directly to `/shifts/:id` and **hard-refresh** the browser.
- **Expected outcomes**: SPA fallback serves `index.html`; the page loads shift detail standalone (no 404), showing details and a Sign Up button.
- **Negative path**: unknown id shows a not-found UI; unauthenticated deep-link redirects to `/login` (and ideally returns to the target after login).

### Journey: Sign up for a shift
- **Steps**: on `/shifts/:id`, click **Sign Up**.
- **Expected outcomes**: open-slot count decrements by 1, `?modal=confirm` confirmation is surfaced, and the shift now appears in `/my-shifts`; the button reflects the signed-up state.
- **Negative path**: signing up when already signed up or when full surfaces the `409` as a user-visible "already signed up" / "shift full" message; slot count does not go negative.

### Journey: My Shifts
- **Steps**: authed user visits `/my-shifts`.
- **Expected outcomes**: lists exactly the caller's signed-up shifts.
- **Negative path**: a user with no signups sees an empty-state message.

### Journey: Admin create / edit shift
- **Steps**: admin uses NavBar admin link → `/shifts/new`, fills the form, submits; then opens `/shifts/:id/edit`, changes a field, submits.
- **Expected outcomes**: created shift appears on the Shift Board; edited values persist and show on `/shifts/:id`.
- **Negative path**: invalid form input shows validation errors and does not submit; a USER navigating to `/shifts/new` or `/shifts/:id/edit` is blocked by RequireAdmin (redirect/denied).

### Journey: Admin volunteer roster
- **Steps**: admin visits `/volunteers`.
- **Expected outcomes**: roster lists USER-role volunteers with per-volunteer shifts and correct summed total hours.
- **Negative path**: a USER hitting `/volunteers` (UI) is denied by RequireAdmin and redirected; the underlying `GET /api/volunteers` returns `403`.

### Journey: Admin settings
- **Steps**: admin visits `/admin/settings`.
- **Expected outcomes**: each provisioned service (`postgresql`, `minio`) shows a configured/unconfigured badge; entering values and saving (`PATCH`) flips the badge to configured after reload.
- **Negative path**: a USER hitting `/admin/settings` is denied; unauthenticated access redirects to `/login`.

## Data integrity tests
- After a successful signup, exactly one `Signup` row exists for `(shiftId, userId)`; the `@@unique([shiftId,userId])` constraint prevents a duplicate.
- `count(signups)` for any shift never exceeds its `totalSlots`; `openSlots = totalSlots − count(signups)` and is never negative.
- `User.passwordHash` is always a bcrypt hash, never plaintext, and is never serialized in any API response.
- `User.role` is one of `ADMIN | USER`; new signups are `USER` except the first-in-empty-table fallback (`ADMIN`).
- A volunteer's `totalHours` always equals the sum of `durationHours` over that volunteer's signed-up shifts.
- `Shift.durationHours` defaults to `2` when not provided; `Signup.createdAt` is set on insert.
- `PATCH /api/admin/settings` upserts (not duplicates) rows keyed by `SystemSetting.key`; `updatedAt` advances on change.
- Deleting/absence of data: cascade/relation integrity between `Signup`, `Shift`, and `User` holds (no orphan `Signup` rows referencing a missing shift or user).

## Out of scope
- **surface.json placeholder components** (`Home.tsx`, `Login.tsx`, test-ids like `home-title`, `health-status`) — stale scaffold artifacts not present in the approved spec; not tested.
- **Runtime consumption of `postgresql`/`minio` settings** — the spec defines no behaviour that reads these values, so only the settings endpoints' auth + CRUD are tested (per tasks.md open question).
- **Third-party integrations** — spec states "None"; no integration clients exist to test.
- **JWT expiry/refresh policy, rate limiting, password-reset, email verification** — the spec is silent on these.
- **Docker image build correctness / `prisma migrate deploy` entrypoint** beyond the health checks — infra concern, verified indirectly by a running server, not asserted as unit/integration cases here.
- **SQLite durability across ephemeral container storage** — called out as an accepted demo risk in the spec.
- **Visual styling / responsive layout** — no design spec provided; only structural/behavioural assertions are in scope.

Wrote .pipeline/test_spec.md (58 cases across 14 endpoints / 9 journeys).

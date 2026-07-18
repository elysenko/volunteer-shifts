# Pipeline Task Decomposition

## Summary
A full-stack Volunteer Shift Scheduler: a React + Vite SPA (React Router, JWT auth stored in localStorage, deep-linkable routes) backed by a Node/Express + Prisma (SQLite) API and packaged as a single Docker image. Volunteers self-register (full_auth), browse an upcoming "Shift Board", view shift detail via deep links, sign up for shifts (open-slot + duplicate guarded), and track their own shifts + total hours. Admins (seeded, plus first-user fallback) create/edit shifts and view a volunteer roster with summed hours.

## Surface contract
**Backend API routes**
- `POST /api/auth/signup` — create USER (first user in empty table → ADMIN); returns JWT + user.
- `POST /api/auth/login` — verify credentials; returns JWT + user.
- `GET /api/auth/me` — current user (requireAuth).
- `GET /api/shifts` — upcoming shifts (`startsAt >= now`, asc) with computed `openSlots` (requireAuth).
- `GET /api/shifts/:id` — detail + `openSlots` + `signedUp` flag for caller (requireAuth).
- `POST /api/shifts` — create shift (requireAdmin).
- `PATCH /api/shifts/:id` — edit shift (requireAdmin).
- `POST /api/shifts/:id/signup` — transactional signup; 409 on full or duplicate; returns updated `openSlots` (requireAuth USER).
- `GET /api/volunteers` — USER-role roster with signups + summed `totalHours` (requireAdmin).
- `GET /api/me/shifts` — caller's signed-up shifts (requireAuth).
- `GET /api/health` → `200 {status:'ok'}`; `GET /api/health/deep` → runs `SELECT 1`.
- `GET /api/admin/settings` — list service/integration keys with masked values + configured status (requireAdmin).
- `PATCH /api/admin/settings` — upsert key-value settings (requireAdmin).

**Frontend routes / screens**
- `/login` (public) — LoginPage.
- `/signup` (public) — SignupPage.
- `/` (RequireAuth) — ShiftBoardPage ("Shift Board" dashboard, cards with date/role/location/open slots).
- `/shifts/new` (RequireAdmin) — ShiftFormPage (create).
- `/shifts/:id` (RequireAuth) — ShiftDetailPage (standalone deep link; Sign Up button; `?modal=confirm` confirmation).
- `/shifts/:id/edit` (RequireAdmin) — ShiftFormPage (edit).
- `/my-shifts` (RequireAuth) — MyShiftsPage.
- `/volunteers` (RequireAdmin) — VolunteersPage roster.
- `/admin/settings` (RequireAdmin) — admin settings page.
- NavBar with logout + admin-only links.

**Entities**
- `User { id, email @unique, passwordHash, name, role (enum ADMIN|USER @default USER), createdAt }`
- `Shift { id, startsAt, roleName, location, totalSlots, durationHours (default 2), createdById, createdAt }`
- `Signup { id, shiftId, userId, createdAt, @@unique([shiftId, userId]) }` with relations to User and Shift.
- `SystemSetting { key String @id, value String, updatedAt DateTime @updatedAt }`

## db_agent tasks
- [ ] Create `server/prisma/schema.prisma` with SQLite datasource reading `DATABASE_URL` (default `file:./data/app.db`).
- [ ] Define `enum UserRole { ADMIN USER }` and `User` model with `role UserRole @default(USER)`, `email @unique`, `passwordHash`, `name`, `createdAt`.
- [ ] Define `Shift` model: `id`, `startsAt`, `roleName`, `location`, `totalSlots`, `durationHours` (default 2), `createdById` (relation to User), `createdAt`.
- [ ] Define `Signup` model: `id`, `shiftId`, `userId`, `createdAt`, `@@unique([shiftId, userId])`, with relations to `Shift` and `User`.
- [ ] Define `SystemSetting` model: `key String @id`, `value String`, `updatedAt DateTime @updatedAt` (for admin settings of provisioned services postgresql, minio).
- [ ] Generate the initial Prisma migration for all models.
- [ ] Create `server/prisma/seed.ts`: 1 ADMIN + 2 USER (bcrypt-hashed passwords), ~5 sample upcoming shifts, a few signups; print `SEED_CREDS_JSON=[{email,password,role},...]` to stdout.

## backend_agent tasks
- [ ] Create `server/package.json` and `server/tsconfig.json` with express, @prisma/client, prisma (dev), bcryptjs, jsonwebtoken, zod, typescript, tsx, and `@types/*`.
- [ ] Create `server/src/prisma.ts` — Prisma client singleton.
- [ ] Create `server/src/auth/jwt.ts` — HS256 sign/verify helpers using `JWT_SECRET`, payload `{sub, role}`.
- [ ] Create `server/src/auth/middleware.ts` — `requireAuth` (verify `Authorization: Bearer`) and `requireAdmin` (role check).
- [ ] Create `server/src/routes/auth.ts` — `POST /api/auth/signup` (bcrypt hash, first-user-in-empty-table → ADMIN else USER, issue JWT), `POST /api/auth/login` (verify + JWT), `GET /api/auth/me`; zod-validate bodies.
- [ ] Create `server/src/routes/shifts.ts` — `GET /api/shifts` (upcoming asc + `openSlots`), `GET /api/shifts/:id` (detail + `openSlots` + `signedUp`), `POST /api/shifts` & `PATCH /api/shifts/:id` (admin), `POST /api/shifts/:id/signup` (`prisma.$transaction` re-check open slots, create Signup, catch unique violation → 409, return updated `openSlots`).
- [ ] Create `server/src/routes/volunteers.ts` — `GET /api/volunteers` (admin) → USER-role users with signups and summed `totalHours` (sum of `durationHours`).
- [ ] Create `server/src/routes/me.ts` — `GET /api/me/shifts` returns caller's signed-up shifts.
- [ ] Create `server/src/routes/health.ts` — `GET /api/health` → `200 {status:'ok'}`; `GET /api/health/deep` runs `SELECT 1`. Both public.
- [ ] Create `server/src/index.ts` — Express bootstrap, JSON middleware, mount `/api/*` routers, serve `web/dist` static with SPA fallback (`*` non-`/api` → `index.html`) so `/shifts/:id` and `/volunteers` deep-link on refresh; read `PORT`, `JWT_SECRET`, `DATABASE_URL` from env.
- [ ] Create `server/src/lib/config.ts` with `resolveConfig(key: string): string | null` — reads `process.env[key]`; if value equals `PLACEHOLDER_CONFIGURE_IN_SETTINGS` or absent, reads matching `SystemSetting` DB row; returns null if neither set.
- [ ] Create admin settings routes: `GET /api/admin/settings` (list service keys for postgresql + minio with masked values + configured status, admin required) and `PATCH /api/admin/settings` (upsert key-value pairs, admin required).

## ui_agent tasks
- [ ] Create `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html` with react, react-dom, react-router-dom, vite, @vitejs/plugin-react, typescript.
- [ ] Create `web/src/main.tsx` and `web/src/App.tsx` — React Router route table, each route carrying a `data.flow` node; wire public vs guarded routes per the surface contract.
- [ ] Create `web/src/auth/AuthContext.tsx` — token/user state persisted in localStorage; `login`, `logout`, `signup`.
- [ ] Create `web/src/auth/RequireAuth.tsx` and `web/src/auth/RequireAdmin.tsx` route guards; unauthenticated → redirect `/login`.
- [ ] Create `web/src/components/NavBar.tsx` — nav links + logout; admin-only links (`/shifts/new`, `/volunteers`, `/admin/settings`) visible only to admins.
- [ ] Create `LoginPage.tsx` and `SignupPage.tsx` (public) with forms and error/loading states.
- [ ] Create `ShiftBoardPage.tsx` — "Shift Board" heading + shift cards (date, role, location, open slots); empty/loading/error states.
- [ ] Create `ShiftDetailPage.tsx` (`/shifts/:id`) — details + Sign Up button (decrements open slots, adds to My Shifts), signup confirmation surfaced via `?modal=confirm`; handles full/duplicate (409) and standalone deep-link load.
- [ ] Create `ShiftFormPage.tsx` — admin create (`/shifts/new`) and edit (`/shifts/:id/edit`) form.
- [ ] Create `MyShiftsPage.tsx` — lists the caller's signed-up shifts; empty state.
- [ ] Create `VolunteersPage.tsx` — admin roster with total hours + shifts per volunteer.
- [ ] Create `/admin/settings` page — lists each provisioned service (postgresql, minio) with a configured/unconfigured badge and per-service credential form wired to `GET`/`PATCH /api/admin/settings`.

## service_agent tasks
- [ ] Create `web/src/api/client.ts` — fetch wrapper that attaches the JWT from AuthContext/localStorage, sets JSON headers, and redirects to `/login` on 401.
- [ ] Add auth API calls (signup, login, me) used by AuthContext.
- [ ] Add shift API calls: list upcoming, get detail, create, edit, and signup (surfacing updated `openSlots` and 409 handling) for ShiftBoard/ShiftDetail/ShiftForm.
- [ ] Add `GET /api/me/shifts` client call for MyShiftsPage.
- [ ] Add `GET /api/volunteers` client call for VolunteersPage.
- [ ] Add admin settings client calls (`GET`/`PATCH /api/admin/settings`) for the `/admin/settings` page.

## tester tasks
- [ ] Health: `GET /api/health` returns `200 {status:'ok'}`; `GET /api/health/deep` returns DB-ok.
- [ ] Seed: run prints a valid `SEED_CREDS_JSON` array; log in with each seeded account.
- [ ] Auth flows: signup creates a USER; first signup on an empty table becomes ADMIN; login issues a working JWT; `/api/auth/me` returns the user.
- [ ] Volunteer happy path: browse the board, open `/shifts/:id` via hard refresh (deep link renders), sign up → open-slot count decrements, shift appears in `/my-shifts`.
- [ ] Duplicate signup: a second signup on the same shift returns 409.
- [ ] Slot exhaustion: signups are blocked at 0 open slots.
- [ ] Admin: create/edit a shift; `/volunteers` shows the roster with correct summed total hours.
- [ ] Role guards: a USER hitting `/volunteers` (UI + API) is denied; an unauthenticated user hitting a protected route redirects to `/login`.
- [ ] Admin settings: `/admin/settings` lists postgresql + minio with configured/unconfigured badges; `PATCH` upserts values and reflects updated status; non-admin is denied.

## Open questions
- `<spec_integrations>` contains a placeholder entry ("None — no third-party APIs/SDKs") with a synthetic env key; the spec's `## Integrations` section explicitly states **None**, so no integration client modules are generated. Confirm no real third-party integration was intended.
- `<spec_deployments>` lists `postgresql` and `minio`, but the spec's persistence is SQLite via Prisma with no described use of Postgres or object storage. Admin settings scaffolding (SystemSetting model, `resolveConfig`, `/admin/settings`) is included for these keys, but the spec defines no runtime behaviour that consumes them — clarify whether these services are actually used or are provisioning artifacts.
- Exact credential field names for the postgresql and minio settings forms are not specified; downstream agents should use the provisioned service key names.

# Architecture

## Requested stack
`backend, web` — a two-platform combo (separate Express API + React/Vite SPA), resolved to the
`react-express` scaffold template since its stack (React + Vite + React Router, Express +
Prisma + JWT) matches the technical plan for the Volunteer Shift Scheduler.

## Newly scaffolded
Both platforms were newly scaffolded — the project directory was empty (only `.git`, `.github`,
`README.md`) before this run.

## Layout
- `web/` — React 18 + Vite + TypeScript SPA (React Router). Entry: `web/src/main.tsx`,
  `web/src/App.tsx`. Pages live in `web/src/pages/`. API client in `web/src/lib/api.ts`.
  Deploys behind `web/nginx.conf` (SPA fallback + `/api/` reverse-proxy to the backend Service).
- `backend/` — Express + TypeScript API. Entry: `backend/src/server.ts` → `backend/src/app.ts`.
  Prisma client/schema in `backend/prisma/` (`schema.prisma`, `seed.ts`), Prisma singleton +
  auth helpers in `backend/src/lib/`. Currently ships `GET /api/health` and
  `POST /api/auth/login` as starter routes.
- `.pipeline/surface.json` — generated manifest of routes/components/test-ids; the contract
  between this scaffold, the test_spec agent, and the Playwright generator. Regenerate (don't
  hand-edit) as routes/components are added.
- `.colossus-acceptance.json` — acceptance contract read by the post-deploy render gate.
  `expect_text` is intentionally empty; the coder must fill it in with real front-page content
  once the Shift Board is implemented.
- `colossus.yaml` — build manifest for deploy agents: React SPA on port 80 behind nginx with
  SPA fallback, Express backend on port 3000, Dockerfiles per template.

## Next steps for the developer / coder agent
1. Update `backend/prisma/schema.prisma` to match the plan's data model (`User`, `Shift`,
   `Signup`) and switch the datasource to SQLite (`provider = "sqlite"`,
   `url = env("DATABASE_URL")`, default `file:./data/app.db`) per the plan's assumptions —
   the template ships a Postgres starter schema as a placeholder.
2. Run `npx prisma migrate dev` (or generate the initial migration) once the schema is final.
3. Flesh out `backend/src/app.ts` into the full route set (`routes/auth.ts`, `routes/shifts.ts`,
   `routes/volunteers.ts`, `routes/me.ts`, `routes/health.ts`) per the plan, and wire JWT
   middleware (`requireAuth`, `requireAdmin`).
4. Build out the frontend route table in `web/src/App.tsx` (Shift Board, Shift Detail, Shift
   Form, My Shifts, Volunteers, Signup) with `RequireAuth`/`RequireAdmin` guards, keeping
   `data-testid="app-ready"` on the shell root.
5. Regenerate `.pipeline/surface.json` and fill `.colossus-acceptance.json`'s `expect_text`
   once the real Shift Board content exists.
6. No `.env.template` ships with this template — create `backend/.env` with `DATABASE_URL`,
   `JWT_SECRET`, `PORT` before running locally.
7. `npm install` in both `backend/` and `web/` (no root workspace `package.json` was scaffolded
   by this template — add one if the plan's root `dev`/`build`/`start`/`seed` scripts are wanted).

## Template source
`template-react-express` from the scaffold-templates library, copied to the project root
(`backend/` and `web/` are template-native top-level directories, not created by this scaffolder).

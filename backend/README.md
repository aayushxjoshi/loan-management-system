# LMS backend

Express + TypeScript + Mongoose. Layers: routes -> controllers -> services -> models.

## Run
1. `cp .env.example .env` and set `MONGODB_URI` and `JWT_SECRET`.
2. `npm install`
3. `npm run seed` (idempotent, creates the demo users)
4. `npm run dev` (http://localhost:5000/api)

## Scripts
`dev`, `build`, `start`, `seed`, `test`, `typecheck`

Tests use an in-memory MongoDB (`mongodb-memory-server`, downloads a mongod binary on first run).

## Extending
- BRE rule: add a class implementing `EligibilityRule` in `src/bre/rules.ts` and one line in `src/container.ts`.
- Status flow: edit `ALLOWED_TRANSITIONS` in `src/services/loanStateMachine.ts`.
- New role-protected module: `router.use(authenticate, requireRole("role"))` in `src/routes/index.ts`.

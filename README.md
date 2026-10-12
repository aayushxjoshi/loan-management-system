# Loan Management System

Borrowers apply for loans; internal executives manage them through Sales, Sanction, Disbursement and Collection modules with role-based access.

**Stack:** Next.js (App Router) + TypeScript + Tailwind · Express + TypeScript · MongoDB + Mongoose · JWT + bcrypt.

Design and API contract: [`docs/DESIGN.md`](docs/DESIGN.md) · curl examples: [`docs/API.md`](docs/API.md) · role-wise flows: [`docs/FLOWS.md`](docs/FLOWS.md).

## Setup

Requires Node 20+ and a MongoDB instance (local, Docker, or Atlas).

```bash
# Backend (port 5000)
cd backend
cp .env.example .env      # set MONGODB_URI and JWT_SECRET
npm install
npm run seed              # creates one account per role
npm run dev

# Frontend (port 3000)
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local
npm install
npm run dev
```

Tests: `cd backend && npm test`.

## Test credentials (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | admin@lms.com | Admin@123 |
| Sales | sales@lms.com | Sales@123 |
| Sanction | sanction@lms.com | Sanction@123 |
| Disbursement | disbursement@lms.com | Disburse@123 |
| Collection | collection@lms.com | Collect@123 |
| Borrower | borrower@lms.com | Borrower@123 |

## Key decisions

- **BRE runs on the server** (client only does light checks) so it can't be bypassed. Rules are a list in `backend/src/bre/rules.ts`; add a rule by adding an entry. PAN: `^[A-Z]{5}[0-9]{4}[A-Z]$`.
- **Loan status:** `APPLIED → SANCTIONED | REJECTED → DISBURSED → CLOSED`, enforced by one transitions map. Closes automatically when total paid equals total repayment.
- **Loan math:** simple interest, `P × 12 × days / (365 × 100)`, shared formula on client (live preview) and server (source of truth).
- **Payments:** UTR unique across all payments (409), amount must be > 0 and ≤ outstanding.
- **RBAC:** `requireRole` middleware on every dashboard route (401 unauthenticated, 403 wrong role; admin passes all). The frontend mirrors this via a single `MODULES` config.

## Deployment (free tier)

| Part | Service | URL |
|---|---|---|
| Database | MongoDB Atlas M0 (allow `0.0.0.0/0` in Network Access) | |
| Backend | Render free Web Service, from `render.yaml` (root dir `backend`) | `https://api.aayushxjoshi.xyz` |
| Frontend | Vercel (root dir `frontend`) | `https://lms.aayushxjoshi.xyz` |

1. **Render:** create the service from the repo (the blueprint reads `render.yaml`). Set `MONGODB_URI` and `CLIENT_ORIGIN=https://lms.aayushxjoshi.xyz`; `JWT_SECRET` is generated. Add the custom domain `api.aayushxjoshi.xyz` and the CNAME it shows.
2. **Seed once:** run `npm run seed` in `backend/` with the production `MONGODB_URI`.
3. **Vercel:** import the repo with root dir `frontend` and set `NEXT_PUBLIC_API_URL=https://api.aayushxjoshi.xyz/api`. Add the custom domain `lms.aayushxjoshi.xyz` and its CNAME.
4. **Avoid cold starts:** Render's free tier sleeps after ~15 min idle. Ping `https://api.aayushxjoshi.xyz/api/health` every 5 minutes with a free UptimeRobot monitor.
5. Salary slips are stored in MongoDB, so they survive Render restarts.

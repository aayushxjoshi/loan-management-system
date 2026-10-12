# Loan Management System

Borrowers apply for loans; internal executives manage them through Sales, Sanction, Disbursement and Collection modules with role-based access.

**Stack:** Next.js (App Router) + TypeScript + Tailwind · Express + TypeScript · MongoDB + Mongoose · JWT + bcrypt.

## Live demo

- **App:** https://loan-management-system-chi-two.vercel.app/login
- **API:** https://lms-api-5nyc.onrender.com/api (health check: `/api/health`)

The API runs on a free tier and may take up to a minute to respond after a long idle period.

### Test credentials

| Role | Email | Password | Lands on |
|---|---|---|---|
| Admin | admin@lms.com | Admin@123 | All four dashboard modules |
| Sales | sales@lms.com | Sales@123 | Sales |
| Sanction | sanction@lms.com | Sanction@123 | Sanction |
| Disbursement | disbursement@lms.com | Disburse@123 | Disbursement |
| Collection | collection@lms.com | Collect@123 | Collection |
| Borrower | borrower@lms.com | Borrower@123 | Loan application portal |

New borrowers can also sign up from the login page. Staff accounts exist only through the seed script.

## Documentation

| Doc | What it covers |
|---|---|
| [`docs/DESIGN.md`](docs/DESIGN.md) | Data model, status transitions, API contract, design decisions |
| [`docs/FLOWS.md`](docs/FLOWS.md) | Role-wise end-to-end flows: UI, APIs used, server behaviour, demo script |
| [`docs/API.md`](docs/API.md) | curl examples for every endpoint (Bruno / Postman friendly) |

## Run locally

Requires Node 20+ and a MongoDB instance (local, Docker, or Atlas).

```bash
# Backend (port 5000)
cd backend
cp .env.example .env      # fill in the values below
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

### Environment variables

| Where | Variable | Purpose |
|---|---|---|
| Backend | `MONGODB_URI` | MongoDB connection string |
| Backend | `JWT_SECRET` | Secret used to sign tokens |
| Backend | `CLIENT_ORIGIN` | Allowed frontend origin(s) for CORS, comma-separated. Default `http://localhost:3000` |
| Backend | `PORT` | Default `5000` |
| Frontend | `NEXT_PUBLIC_API_URL` | Backend base URL including `/api` |

## Key decisions

- **BRE runs on the server** (client only does light checks) so it can't be bypassed. Rules are classes behind one interface, wired in `backend/src/container.ts`; add a rule by adding a class and one line. PAN: `^[A-Z]{5}[0-9]{4}[A-Z]$`.
- **Loan status:** `APPLIED → SANCTIONED | REJECTED → DISBURSED → CLOSED`, enforced by one `LoanStateMachine`. Closes automatically when total paid equals total repayment.
- **Loan math:** simple interest, `P × 12 × days / (365 × 100)`, one shared formula on client (live preview) and server (source of truth).
- **Payments:** UTR unique across all payments (409), amount must be > 0 and ≤ outstanding.
- **RBAC:** `requireRole` middleware on every dashboard route (401 unauthenticated, 403 wrong role; admin passes all). The frontend mirrors this via a single `MODULES` config.
- **Structure:** controllers → services → models, class-based with constructor injection and a single composition root.
- **Salary slips** are stored in MongoDB, so they survive restarts on hosts with ephemeral disks.

## Deployment (free tier)

| Part | Service | Notes |
|---|---|---|
| Database | MongoDB Atlas M0 | Allow `0.0.0.0/0` in Network Access (Render has no fixed IP) |
| Backend | Render free Web Service | Root dir `backend`, build `npm install --include=dev && npm run build`, start `npm start`, health check `/api/health`. Blueprint: [`render.yaml`](render.yaml) |
| Frontend | Vercel | Root dir `frontend` |

1. **Render:** set `MONGODB_URI`, `JWT_SECRET` and `CLIENT_ORIGIN` (the Vercel URL, no trailing slash).
2. **Seed once:** run `npm run seed` in `backend/` with the production `MONGODB_URI`.
3. **Vercel:** set `NEXT_PUBLIC_API_URL` to the Render URL plus `/api`, then deploy. It is baked in at build time, so redeploy after changing it.
4. **Avoid cold starts:** Render's free tier sleeps after about 15 minutes idle. A free UptimeRobot monitor pinging `/api/health` every 5 minutes keeps it awake.

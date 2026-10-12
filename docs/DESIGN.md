# LMS – Design & API Contract

Monorepo: `backend/` (Express+TS+Mongoose, port 5000), `frontend/` (Next.js App Router+TS+Tailwind, port 3000).

## Principles
- Thin controllers → services → models. Validation at the edge (zod).
- Config-driven, so additions are one-line changes:
  - BRE: array of rule objects `{ name, check(profile) -> string | null }`.
  - Loan status transitions: `ALLOWED_TRANSITIONS` map; one `transitionLoan(loan, to)` function enforces it.
  - RBAC: `requireRole(...roles)` middleware; admin always passes. Frontend: single `MODULES` config (role → label, route).
- Loan math in one pure function `calculateRepayment(amount, tenureDays)` (backend `utils/loanMath.ts`, mirrored in `frontend/lib/loanMath.ts`). Rate constant 12.
- Money rounded to 2 decimals via a `roundMoney` helper.

## Roles
`admin | sales | sanction | disbursement | collection | borrower` (string enum on User.role). Signup always creates `borrower`.

## Collections
- **User**: name, email (unique), passwordHash, role, createdAt.
- **BorrowerProfile** (1 per borrower, `user` unique ref): fullName, pan, dateOfBirth, monthlySalary, employmentMode (`SALARIED|SELF_EMPLOYED|UNEMPLOYED`), salarySlip `{ path, originalName, mimeType, size } | null`.
- **Loan**: borrower (ref User), profile (ref), amount, tenureDays, interestRate(12), interest, totalRepayment, totalPaid(0), status, rejectionReason, sanctionedBy/At, disbursedBy/At, closedAt, timestamps.
- **Payment**: loan (ref), utr (unique index), amount, paidOn, recordedBy (ref User), timestamps.

## Loan status
`APPLIED → SANCTIONED | REJECTED` (sanction), `SANCTIONED → DISBURSED` (disbursement), `DISBURSED → CLOSED` (automatic when totalPaid == totalRepayment). REJECTED and CLOSED terminal. A borrower may have only one open loan (APPLIED/SANCTIONED/DISBURSED).

## BRE (server is source of truth; client may only do light UX validation)
Age 23–50 (inclusive, computed from DOB), salary ≥ 25000, PAN `/^[A-Z]{5}[0-9]{4}[A-Z]$/` (uppercased before check), employment ≠ UNEMPLOYED. All failures returned together.

## Outstanding / payment validation
outstanding = totalRepayment − totalPaid. Payment: loan must be DISBURSED; amount > 0 and ≤ outstanding; utr non-empty (trim, uppercase), globally unique; paidOn valid date, not in future. After save, update totalPaid; if outstanding == 0 → CLOSED.

## HTTP conventions
All routes under `/api`. JSON errors: `{ "message": string, "errors"?: string[] }`.
200 ok, 201 created, 400 bad input, 401 missing/invalid token, 403 role not allowed, 404, 409 conflict (duplicate email/UTR, invalid status transition, already has open loan), 422 BRE failure.
Auth header: `Authorization: Bearer <jwt>`. JWT payload `{ sub: userId, role }`, 1d expiry.

## Endpoints
Auth (public except /me)
- `POST /auth/signup` {name,email,password(min 8)} → 201 `{ token, user }`
- `POST /auth/login` {email,password} → `{ token, user }`
- `GET /auth/me` → `{ user }`   (user = `{id,name,email,role}`)

Borrower (role borrower)
- `GET /borrower/profile` → `{ profile | null }`
- `PUT /borrower/profile` {fullName,pan,dateOfBirth(ISO),monthlySalary,employmentMode} → `{ profile }`; BRE fail → 422 `{message:"Not eligible", errors:[...]}` and nothing saved
- `POST /borrower/profile/salary-slip` multipart field `salarySlip` (pdf/jpg/png ≤5MB; stored in `backend/uploads`, requires profile) → `{ profile }`
- `POST /borrower/loans` {amount(50000–500000), tenureDays(30–365 ints)} requires profile+slip → 201 `{ loan }`
- `GET /borrower/loans` → `{ loans }` newest first (loan includes payments summary fields above)

Dashboard (each: its role + admin)
- Sales: `GET /sales/leads` → `{ leads: [{ id, name, email, signedUpAt, stage: "REGISTERED"|"PROFILE_COMPLETED"|"SLIP_UPLOADED" }] }` — borrowers with no loan yet.
- Sanction: `GET /sanction/loans?status=APPLIED` (default APPLIED; also SANCTIONED|REJECTED) → `{ loans }`; `POST /sanction/loans/:id/approve`; `POST /sanction/loans/:id/reject` {reason} (required)
- Disbursement: `GET /disbursement/loans?status=SANCTIONED` (default SANCTIONED; also DISBURSED) ; `POST /disbursement/loans/:id/disburse`
- Collection: `GET /collection/loans?status=DISBURSED` (default DISBURSED; also CLOSED); `GET /collection/loans/:id/payments` → `{ payments }`; `POST /collection/loans/:id/payments` {utr,amount,paidOn} → 201 `{ payment, loan }`
- Loans in dashboard lists are populated: `borrower {name,email}`, `profile {fullName,pan,monthlySalary}`, plus `outstanding` virtual/field; action endpoints return `{ loan }`.
- Salary slip download for staff: `GET /sanction/loans/:id/salary-slip` (streams file).

## Seed (`npm run seed`, idempotent)
admin@lms.com / Admin@123, sales@lms.com / Sales@123, sanction@lms.com / Sanction@123, disbursement@lms.com / Disburse@123, collection@lms.com / Collect@123, borrower@lms.com / Borrower@123.

## Frontend routes
`/login`, `/signup`, `/apply` (4-step stepper: details → slip → loan config → submit, plus status view of existing loan), `/dashboard` (redirects to the user's module), `/dashboard/{sales|sanction|disbursement|collection}`. `AuthProvider` keeps token in localStorage; `AuthGuard` redirects unauthenticated users and wrong roles (borrower → /apply, staff → /dashboard). Backend is the real enforcement.

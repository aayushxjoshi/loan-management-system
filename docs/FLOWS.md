# End-to-end flows by role

How each person uses the system, what they see in the UI, which APIs the UI calls, and what the server does. Request/response examples are in [`API.md`](API.md); data model and rules are in [`DESIGN.md`](DESIGN.md).

API base: `http://localhost:5000/api`. UI: `http://localhost:3000`.

## Overview

```
Borrower:  Sign up → Personal details (BRE) → Salary slip → Loan config → Apply
                                                                   │
Loan:                                                          APPLIED
Sanction exec:                                      approve ──► SANCTIONED    reject ──► REJECTED (end)
Disbursement exec:                                       disburse ──► DISBURSED
Collection exec:                          record payments, balance hits 0 ──► CLOSED (automatic, end)
Sales exec: tracks borrowers who signed up but have not applied (leads)
Admin: everything above
```

| Role | Created by | Lands on | Can use |
|---|---|---|---|
| Borrower | Self sign-up | `/apply` | Application portal only |
| Sales | Seed script | `/dashboard/sales` | Sales module |
| Sanction | Seed script | `/dashboard/sanction` | Sanction module |
| Disbursement | Seed script | `/dashboard/disbursement` | Disbursement module |
| Collection | Seed script | `/dashboard/collection` | Collection module |
| Admin | Seed script | `/dashboard` (first module) | All four modules |

Seeded logins are in [`API.md`](API.md#1-auth). Staff accounts cannot be created from the UI; sign-up always creates a borrower.

## Common: sign up, log in, access control

**UI:** `/signup` (name, email, password ≥ 8 chars) and `/login` (email, password). After login the user is sent to their home page. Logout is in the sidebar.

| Action | API | Server does |
|---|---|---|
| Sign up | `POST /auth/signup` | Validates input, rejects duplicate email (409), hashes password with bcrypt, creates user with role `borrower`, returns JWT + user |
| Log in | `POST /auth/login` | Checks password hash, returns JWT (1 day) + user. Wrong credentials → 401 |
| Restore session on page load | `GET /auth/me` | Verifies the token, returns the user |

**Access control**
- The token is kept in the browser (localStorage) and sent as `Authorization: Bearer <token>` on every call.
- Frontend: `AuthGuard` sends anonymous users to `/login`, borrowers away from `/dashboard` to `/apply`, and staff away from other modules to their own. The sidebar shows only the user's modules (admin sees all four). One `MODULES` config drives all of this.
- Backend (the real enforcement): every route checks the token (401 if missing or invalid) and then the role (403 if not allowed). Admin passes every role check.

---

## 1. Borrower

Everything is on `/apply`, a 4-step stepper. A borrower cannot open the dashboard.

### Step 1: Personal details
**UI:** Full name, PAN, date of birth, monthly salary, employment mode (Salaried / Self employed / Unemployed).
**API:** `PUT /borrower/profile` (and `GET /borrower/profile` to prefill if one exists).
**Server does:**
- Runs the eligibility engine (BRE) on the server. Every rule is checked and all failures are returned together:

| Rule | Reject when |
|---|---|
| Age | Not between 23 and 50 (from date of birth) |
| Salary | Below 25,000 per month |
| PAN | Does not match `^[A-Z]{5}[0-9]{4}[A-Z]$` (uppercased first) |
| Employment | Unemployed |

- Fail → `422 { message: "Not eligible", errors: [...] }`, nothing saved. The UI shows the reasons as a list and the borrower cannot continue.
- Pass → profile saved (one per borrower, updated on re-submit) and the stepper moves on.

### Step 2: Upload salary slip
**UI:** File picker. The browser checks type (PDF/JPG/PNG) and size (≤ 5 MB) first.
**API:** `POST /borrower/profile/salary-slip` (multipart, field `salarySlip`).
**Server does:** validates type and size again, stores the file in `backend/uploads`, links it to the borrower's profile. Needs a saved profile.

### Step 3: Loan configuration
**UI:** Two sliders: amount 50,000–5,00,000 (step 5,000) and tenure 30–365 days. A live panel shows principal, rate (12% p.a.), interest and total repayment, updating as sliders move.
**API:** none. The panel is calculated in the browser with the same formula as the server: `interest = P × 12 × days / (365 × 100)`, `total = P + interest`.

### Step 4: Apply
**UI:** "Apply" button.
**API:** `POST /borrower/loans` `{ amount, tenureDays }`.
**Server does:**
- Requires a saved profile and slip.
- Allows only one open loan (APPLIED / SANCTIONED / DISBURSED) per borrower → otherwise 409.
- Validates ranges, recomputes interest and total repayment itself (it does not trust the client), creates the loan with status `APPLIED`.

### After applying
**UI:** `/apply` shows the application status view: amount, tenure, total repayment, status, rejection reason if rejected, and paid / outstanding once disbursed. "Start a new application" appears only when no loan is open.
**API:** `GET /borrower/loans`.

---

## 2. Sales executive

Handles leads: borrowers who registered but have not applied yet.

**UI:** `/dashboard/sales`, a table of leads with name, email, signup date and stage.
**API:** `GET /sales/leads`.
**Server does:** lists borrowers with no loan and works out each one's stage from their data: `REGISTERED` (signed up only), `PROFILE_COMPLETED` (eligible details saved), `SLIP_UPLOADED` (slip uploaded, ready to apply). A borrower drops off the list once they apply.
**Actions:** read-only. Sales uses the list to follow up with leads.

---

## 3. Sanction executive

Reviews applied loans.

**UI:** `/dashboard/sanction`, tabs for Applied (default), Sanctioned and Rejected. Each row shows borrower, PAN, salary, amount, tenure, total repayment and a link to view the salary slip. Applied rows have **Approve** and **Reject**. Reject opens a modal where a reason is required.

| Action | API | Server does |
|---|---|---|
| List loans by tab | `GET /sanction/loans?status=APPLIED\|SANCTIONED\|REJECTED` | Returns loans with borrower and profile details |
| View salary slip | `GET /sanction/loans/:id/salary-slip` | Streams the uploaded file (UI fetches it with the token and opens it) |
| Approve | `POST /sanction/loans/:id/approve` | `APPLIED → SANCTIONED`, records who and when |
| Reject | `POST /sanction/loans/:id/reject` `{ reason }` | `APPLIED → REJECTED`, saves the reason; the borrower sees it |

Acting on a loan that is not `APPLIED` returns 409. The state machine allows only valid transitions.

---

## 4. Disbursement executive

Releases funds for sanctioned loans.

**UI:** `/dashboard/disbursement`, tabs for Sanctioned (default) and Disbursed. Sanctioned rows have a **Disburse** button.

| Action | API | Server does |
|---|---|---|
| List | `GET /disbursement/loans?status=SANCTIONED\|DISBURSED` | Returns loans with borrower details |
| Disburse | `POST /disbursement/loans/:id/disburse` | `SANCTIONED → DISBURSED`, records who and when. The loan now appears in Collection |

---

## 5. Collection executive

Records repayments on disbursed loans.

**UI:** `/dashboard/collection`, tabs for Disbursed (default) and Closed. Each row shows total repayment, paid and outstanding. **Payments** opens a panel with the repayment summary, payment history and a **Record payment** form (UTR, amount, date). Server errors (duplicate UTR, overpayment) show in the form.

| Action | API | Server does |
|---|---|---|
| List | `GET /collection/loans?status=DISBURSED\|CLOSED` | Returns loans with `totalPaid` and `outstanding` |
| Payment history | `GET /collection/loans/:id/payments` | Returns payments for the loan |
| Record payment | `POST /collection/loans/:id/payments` `{ utr, amount, paidOn }` | Validates, saves the payment, updates `totalPaid`, closes the loan if fully paid. Returns `{ payment, loan }` |

**Payment rules**
- Loan must be `DISBURSED` (409 otherwise).
- Amount must be > 0 and ≤ outstanding (400 otherwise). `outstanding = totalRepayment − totalPaid`.
- UTR is trimmed and uppercased, and must be unique across **all** payments (409 on duplicate, enforced by a unique index).
- Date must be valid and not in the future.
- When `totalPaid` equals `totalRepayment`, the loan moves to `CLOSED` automatically. No one clicks "close".

---

## 6. Admin

Logs in at `/login` and lands on `/dashboard`. The sidebar shows all four modules, and every module API accepts the admin token. Admin can do everything in sections 2–5 (for example, approve a loan and then disburse it). Admin cannot use the borrower application endpoints.

---

## Loan status reference

| Status | Set by | Next | UI module |
|---|---|---|---|
| `APPLIED` | Borrower applies | Sanction approves or rejects | Sanction (Applied) |
| `SANCTIONED` | Sanction approve | Disbursement disburses | Disbursement (Sanctioned) |
| `REJECTED` | Sanction reject (reason saved) | End | Sanction (Rejected) |
| `DISBURSED` | Disbursement | Payments recorded until paid in full | Disbursement (Disbursed), Collection (Disbursed) |
| `CLOSED` | Automatic on full payment | End | Collection (Closed) |

## HTTP status summary

| Code | Meaning |
|---|---|
| 400 | Invalid input (bad amount, missing reason, overpayment, invalid date) |
| 401 | No token or invalid/expired token |
| 403 | Logged in but wrong role for this module |
| 409 | Conflict (duplicate email or UTR, invalid status change, open loan already exists, loan not disbursed) |
| 422 | Not eligible (BRE failure on personal details) |

## Full demo script (for the walkthrough video)

1. **Borrower, rejected:** sign up → personal details with salary 20,000 or age 21 → see the eligibility errors list.
2. **Borrower, approved:** fix the details → upload salary slip → set sliders and check the live panel → Apply → status shows `APPLIED`.
3. **Sales:** log in as `sales@lms.com` → before the borrower applied, they appeared in leads at their current stage. Try opening `/dashboard/sanction` → redirected (and the API returns 403).
4. **Sanction:** log in as `sanction@lms.com` → open the slip → Approve (and, on a second loan, Reject with a reason).
5. **Disbursement:** `disbursement@lms.com` → Disburse.
6. **Collection:** `collection@lms.com` → Payments → record a partial payment → try the same UTR again (409) → try an amount above outstanding (400) → pay the remainder → loan moves to Closed.
7. **Borrower:** log back in → status shows `CLOSED`.
8. **Admin:** `admin@lms.com` → show all four modules in the sidebar.

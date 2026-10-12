# API – curl guide

Every command is a single line with a literal URL, so you can paste it into Bruno or Postman (Import → From cURL) or run it in a terminal. There are no shell variables or helpers.

**Before you start**
- Base URL is `http://localhost:5000/api`. If your `backend/.env` sets a different `PORT`, replace `5000` everywhere.
- Run `npm run seed` in `backend/` first.
- Log in (section 1) and copy the `token` from the response. Replace `<TOKEN>` in later commands with it. Use a separate token per role.
- In Bruno or Postman, you can instead set a `baseUrl` and a `token` variable and use `{{baseUrl}}` and `{{token}}`.

**Conventions**
- Auth header: `Authorization: Bearer <TOKEN>`.
- Errors: `{ "message": "...", "errors": ["..."] }` (`errors` optional).
- Status codes: `200` ok · `201` created · `400` bad input · `401` missing/invalid token · `403` role not allowed · `404` not found · `409` conflict (duplicate email/UTR, invalid status change, open loan exists, loan not disbursed) · `422` not eligible.

## 1. Auth

Sign up (always creates a `borrower`):
```
curl -X POST http://localhost:5000/api/auth/signup -H "Content-Type: application/json" -d '{"name":"Asha Rao","email":"asha@example.com","password":"Password@123"}'
```

Log in (response contains `token`):
```
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"borrower@lms.com","password":"Borrower@123"}'
```

Seeded logins (change the body above):

| Role | Email | Password |
|---|---|---|
| Admin | admin@lms.com | Admin@123 |
| Sales | sales@lms.com | Sales@123 |
| Sanction | sanction@lms.com | Sanction@123 |
| Disbursement | disbursement@lms.com | Disburse@123 |
| Collection | collection@lms.com | Collect@123 |
| Borrower | borrower@lms.com | Borrower@123 |

Current user:
```
curl http://localhost:5000/api/auth/me -H "Authorization: Bearer <TOKEN>"
```

## 2. Borrower (use the borrower token)

Save personal details (runs the eligibility check). `employmentMode`: `SALARIED | SELF_EMPLOYED | UNEMPLOYED`.
```
curl -X PUT http://localhost:5000/api/borrower/profile -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"fullName":"Asha Rao","pan":"ABCDE1234F","dateOfBirth":"1995-04-12","monthlySalary":60000,"employmentMode":"SALARIED"}'
```

Not eligible (age, salary, PAN, employment all fail) → `422`, nothing saved:
```
curl -X PUT http://localhost:5000/api/borrower/profile -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"fullName":"Test","pan":"1234","dateOfBirth":"2005-01-01","monthlySalary":10000,"employmentMode":"UNEMPLOYED"}'
```

Get profile:
```
curl http://localhost:5000/api/borrower/profile -H "Authorization: Bearer <TOKEN>"
```

Upload salary slip (PDF/JPG/PNG, max 5 MB; profile must exist). Form field name is `salarySlip`. In Bruno/Postman use Body → Multipart Form → add a File field named `salarySlip`.
```
curl -X POST http://localhost:5000/api/borrower/profile/salary-slip -H "Authorization: Bearer <TOKEN>" -F "salarySlip=@slip.pdf"
```

Apply for a loan (amount 50000–500000, tenure 30–365 days; needs profile and slip). Interest = `P × 12 × days / (365 × 100)`.
```
curl -X POST http://localhost:5000/api/borrower/loans -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"amount":100000,"tenureDays":90}'
```

My loans:
```
curl http://localhost:5000/api/borrower/loans -H "Authorization: Bearer <TOKEN>"
```

## 3. Sales (sales or admin token)

Borrowers who haven't applied yet. `stage`: `REGISTERED | PROFILE_COMPLETED | SLIP_UPLOADED`.
```
curl http://localhost:5000/api/sales/leads -H "Authorization: Bearer <TOKEN>"
```

## 4. Sanction (sanction or admin token)

`<LOAN_ID>` is the `id` field from a list response. `APPLIED → SANCTIONED | REJECTED`; any other status returns `409`.

List (`status` = `APPLIED` default, `SANCTIONED`, `REJECTED`):
```
curl "http://localhost:5000/api/sanction/loans?status=APPLIED" -H "Authorization: Bearer <TOKEN>"
```
Approve:
```
curl -X POST http://localhost:5000/api/sanction/loans/<LOAN_ID>/approve -H "Authorization: Bearer <TOKEN>"
```
Reject (`reason` required):
```
curl -X POST http://localhost:5000/api/sanction/loans/<LOAN_ID>/reject -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"reason":"Salary slip unreadable"}'
```
Download salary slip:
```
curl http://localhost:5000/api/sanction/loans/<LOAN_ID>/salary-slip -H "Authorization: Bearer <TOKEN>" -o slip
```

## 5. Disbursement (disbursement or admin token)

`SANCTIONED → DISBURSED`.

List (`status` = `SANCTIONED` default, `DISBURSED`):
```
curl "http://localhost:5000/api/disbursement/loans?status=SANCTIONED" -H "Authorization: Bearer <TOKEN>"
```
Disburse:
```
curl -X POST http://localhost:5000/api/disbursement/loans/<LOAN_ID>/disburse -H "Authorization: Bearer <TOKEN>"
```

## 6. Collection (collection or admin token)

List (`status` = `DISBURSED` default, `CLOSED`):
```
curl "http://localhost:5000/api/collection/loans?status=DISBURSED" -H "Authorization: Bearer <TOKEN>"
```
Payment history:
```
curl http://localhost:5000/api/collection/loans/<LOAN_ID>/payments -H "Authorization: Bearer <TOKEN>"
```
Record a payment:
```
curl -X POST http://localhost:5000/api/collection/loans/<LOAN_ID>/payments -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"utr":"UTR000123","amount":50000,"paidOn":"2026-10-12"}'
```
Rules: loan must be `DISBURSED` (else `409`); `amount` > 0 and ≤ outstanding (else `400`); `utr` unique across all payments (duplicate → `409`); `paidOn` a valid, non-future date. When total paid equals total repayment the loan becomes `CLOSED` automatically. Response: `{ payment, loan }`.

## 7. Access control checks

No token → `401`:
```
curl -i http://localhost:5000/api/sales/leads
```
Borrower token on a staff route → `403`:
```
curl -i http://localhost:5000/api/sales/leads -H "Authorization: Bearer <BORROWER_TOKEN>"
```
Sales token on the sanction module → `403`:
```
curl -i http://localhost:5000/api/sanction/loans -H "Authorization: Bearer <SALES_TOKEN>"
```
Admin token on any module → `200`:
```
curl -i http://localhost:5000/api/sanction/loans -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## 8. End-to-end smoke test

1. Borrower: save profile → upload slip → apply (note the loan `id`).
2. Sanction: approve. 3. Disbursement: disburse.
4. Collection: record payments until the sum equals `totalRepayment`; the last response shows `status: "CLOSED"`.

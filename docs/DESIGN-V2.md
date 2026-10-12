# LMS v2: Activity log, guided borrower journey, review workflow, partial disbursement, collections, leads, design system (V2)

Status: draft for approval. Extends [`DESIGN.md`](DESIGN.md) and [`FLOWS.md`](FLOWS.md); everything there still holds unless this doc says otherwise.

---

## Context

### What exists today (v1)
- **Backend** (Express 5 + Mongoose + zod), class-based with one composition root (`backend/src/container.ts`). Controllers are thin. Services own the rules. `LoanStateMachine.ALLOWED_TRANSITIONS` is the only place a loan's status changes. The BRE is a list of rule classes (`bre/rules.ts`) run by `EligibilityEngine`. Loan math lives in one pure module (`utils/loanMath.ts`: `calculateRepayment`, `calculateOutstanding`, `roundMoney`), and the frontend keeps a copy in `frontend/lib/loanMath.ts`.
- **Routes** (`routes/index.ts`): one sub-router per module, guarded by `requireRole` (admin always passes). Each module's list uses `staff.listLoans([...statuses])`, where the first status in the array is the default.
- **Models**: `User`, `BorrowerProfile` (with an embedded `salarySlip`), `Loan` (with an `outstanding` virtual), and `Payment` (with a unique `utr`). Nothing is audited: the only history is the `sanctionedAt`, `disbursedAt` and `closedAt` timestamps.
- **Frontend** (Next 15 App Router + Tailwind 3, colour tokens as CSS variables in `globals.css`). The `MODULES` config drives the sidebar, redirects and guards. UI primitives are in `components/ui/*` (DataTable, StatusBadge, StatCard, Timeline, Modal, Toast, Skeleton). Each module page fetches with `useAsync`, shows status tabs plus 3 stat cards computed **client-side from the current tab only**, and renders a table with inline actions.
- **Tests**: `backend/tests/{unit,api}.test.ts` (vitest + supertest + mongodb-memory-server). The frontend has no test setup.
- **Seed** creates only users. Loans in an existing dev database were created by hand.

### Problems this solves
1. There is no record of who did what and when. The borrower sees a fixed four-step timeline, and staff see no history at all.
2. Borrowers have no way to follow up, and staff have no way to see that a borrower is waiting.
3. Sales has a read-only list. They can't record outcomes, track follow-ups or keep notes.
4. Sanction approves straight from a table row. Nothing shows that someone is reviewing a loan, and the eligibility facts aren't on screen.
5. Disbursement is all-or-nothing.
6. Collection has no due date, no overdue signal and no payment metadata.
7. Stat cards only describe the current tab. Lists have no search and no paging.
8. The UI reads as a generic template: purple glow, gradients, pill tabs and large radii everywhere.

### Scope rules (PM view)
- **In scope:** items 1-8 as specified below. Each item is cut to the smallest version that solves the problem.
- **Marked (optional):** nice-to-haves that can be dropped without blocking anything.
- **Out of scope (future):** EMI schedules, penalties and late fees, email/SMS/push notifications, websockets, file previews inside the app, staff user management, multi-loan borrowers, credit bureau checks, and light/dark theme switching.

---

## Options considered (trade-offs)

### A. Event log storage
| Option | Pros | Cons |
|---|---|---|
| **A1. One `LoanEvent` collection, append-only. `borrower` is always set and `loan` can be null (lead events have no loan).** Services write to it through one `EventService`. | One model and one service. The borrower timeline, module timelines and lead activity are all a single indexed query. Lead events need no second collection. | Writes happen outside a transaction (standalone Mongo), so a crash between the state change and the event write can drop an event. Mitigated below. |
| A2. Embedded `history[]` array on Loan and on a Lead doc | One read per loan | Documents grow without limit. Lead events and loan events end up in two places. Cross-loan queries ("recent nudges") are awkward. |
| A3. Derive history from timestamps (`sanctionedAt` and so on) and from payments | No new storage | Can't hold notes, nudges or actors for review claims, and doesn't extend to new event types. |

**Pick A1.**

### B. Lead state
| Option | Pros | Cons |
|---|---|---|
| B1. Fields on `User` | No join | Mixes CRM state into the auth model, and every user (staff too) carries lead fields |
| B2. Fields on `BorrowerProfile` | Already one per borrower | A profile doesn't exist yet for `REGISTERED` leads. It's also written by the borrower, while lead state is owned by staff |
| **B3. New `Lead` collection, 1:1 with the borrower `User`, created lazily on the first sales action. Notes and changes go to `LoanEvent` (`loan: null`).** | Clear ownership (sales). No migration (a missing doc means `NEW`). The notes log reuses the event log | One extra lookup in the leads query (one aggregation) |

**Pick B3.** `CONVERTED` is **derived** (the borrower has any loan) and never stored, so it can't drift.

### C. Nudge rate limiting
| Option | Pros | Cons |
|---|---|---|
| C1. Query the latest `NUDGE_SENT` event, then insert | No Loan change | Race condition: two parallel requests both pass |
| **C2. Atomic conditional update on `Loan.nudge.lastAt` (`findOneAndUpdate` with a cooldown predicate), then write the event** | Race-free with a single round trip. The same field powers the "pending nudge" badge and the highlighted row | Three small fields on Loan |
| C3. Generic rate-limit middleware or library | Reusable | Adds a dependency and in-memory state, and still needs per-loan semantics |

**Pick C2.**

### D. Partial disbursement math
| Option | Pros | Cons |
|---|---|---|
| **D1. Keep `amount` as the sanctioned principal. Add `disbursedAmount`. Recompute `interest`/`totalRepayment` from `disbursedAmount` with the same `calculateRepayment`, and snapshot the sanctioned terms in `sanctionedTerms` only when the amount is reduced.** A `principal` virtual returns `disbursedAmount ?? amount`. | `outstanding`, payments and closing logic don't change, because they already key off `totalRepayment`. Old loans work with no migration, since the virtual falls back to `amount`. Full audit is preserved | Two places carry a principal, so the UI must use `principal` (one virtual) |
| D2. Overwrite `amount` and keep `requestedAmount` | Every existing display is automatically "right" | Rewrites a fact (the sanctioned amount) and breaks the meaning of `amount` for reports and audit |
| D3. Keep interest on the sanctioned amount | Simplest | Charges the borrower interest on money they never received. Not defensible |

**Pick D1.**

### E. Lists: search, paging, stats
| Option | Pros | Cons |
|---|---|---|
| **E1. One shared `listQuery` helper (zod schema factory, plus `paginate()` and `searchBorrowerIds()`) and one `GET /<module>/summary` per module backed by one `SummaryService` aggregation** | One pattern for every list. Stats cover all statuses, not just the current tab | One extra request per page |
| E2. Return counts inside every list response | One request | Recomputes stats on every page and filter change, and couples paging to stats |
| E3. Client-side filtering | No backend work | Doesn't scale. That's today's limitation |

**Pick E1.**

### F. Staff detail UI
| Option | Pros | Cons |
|---|---|---|
| **F1. Table plus a right-side detail drawer (Stripe/Linear pattern), shared by every module. The sanction drawer is wider and holds the review card** | One component and one mental model. Keeps list context. Easy on mobile (full-screen sheet) | Less room than a full page |
| F2. Split view (Linear inbox) for sanction only | Fast queue processing | A second layout to build and maintain. Could come later |
| F3. Dedicated `/dashboard/<module>/[id]` pages | Deep links, lots of space | Navigation churn, and the list position is lost |

**Pick F1.** The drawer state goes into the URL (`?loan=<id>`) so deep links work without separate pages.

---

## Chosen approach

These pieces extend the existing classes and configs; nothing is replaced.

1. **`EventService`** (new; wired in `container.ts`) with `record({ type, borrower, loan?, actor, message?, meta? })`, `listForLoan(loanId)`, `listForBorrower(borrowerId)` and `toBorrowerView(event)`. Event types and borrower visibility come from one config map, `EVENT_TYPES` in `config/events.ts`. Adding an event type means adding one line there.
2. **One choke point for status changes.** A new `LoanService.moveTo(loan, to, actor, extra?)` does five things: it calls `stateMachine.transition`, clears `nudge.pending`, saves (using optimistic concurrency), records the matching event, and returns the loan. `approve`, `reject`, `startReview` and `disburse` call it, and so does `PaymentService` when a loan closes (it already receives `loanService`). The state machine stays pure.
3. **`LoanStateMachine.ALLOWED_TRANSITIONS`** gains `UNDER_REVIEW` (see the map below). `OPEN_LOAN_STATUSES` gains `UNDER_REVIEW`.
4. **Module config on the backend** (new `LOAN_MODULES` in `config/constants.ts`) mirrors the frontend `MODULES`. For each module it lists the allowed list statuses (first one is the default) and the statuses whose nudges it receives. Routes, nudge routing and summaries all read from it:
   ```ts
   export const LOAN_MODULES = {
     sanction:     { statuses: ["APPLIED", "UNDER_REVIEW", "SANCTIONED", "REJECTED"], nudgeFrom: ["APPLIED", "UNDER_REVIEW"] },
     disbursement: { statuses: ["SANCTIONED", "DISBURSED"],                          nudgeFrom: ["SANCTIONED"] },
     collection:   { statuses: ["DISBURSED", "CLOSED"],                              nudgeFrom: [] },
   } as const;
   export const NUDGE_COOLDOWN_HOURS = 24;
   export const DUE_SOON_DAYS = 7;
   ```
5. **Loan math** stays the single source in `utils/loanMath.ts`. Disbursement calls `calculateRepayment(disbursedAmount, tenureDays)`. A new pure `dueInfo(loan, now)` returns `{ dueDate, daysToDue, daysOverdue, dueState }` and is exposed through Loan virtuals, so the frontend never re-derives due logic. The frontend copy of `loanMath` is still used only for the apply-time preview.
6. **`listQuery` helper** (`utils/listQuery.ts`) replaces `statusQuerySchema` for lists. It parses `status`, `q`, `page` and `limit`, plus extra per-module filters passed in as a zod shape. `paginate(query, page, limit)` returns `{ items, page, limit, total }`.
7. **`SummaryService`**: one `$group` aggregation by status over a module's statuses, plus small extras (nudged count, collection due stats, lead counts).
8. **`LeadService`** is extended with `Lead` model writes, plus a detail call and a list call (one aggregation pipeline with `$lookup` for loans, leads and profiles, then filter and `$facet` for paging).
9. **Frontend**: new shared primitives (Drawer, DefinitionList, ActivityFeed, FilterBar, Pagination, Money, CountBadge, Callout), a design-token pass, and one config map, `lib/events.ts`, that gives each event type a label, icon and tone. `MODULES` gains `icon` (moving the `ICONS` map out of Sidebar) and `badge` (which summary field to show in the sidebar).

---

## Data model

All changes are **additive with defaults**. No existing field changes meaning.

### New: `LoanEvent`
```ts
{
  borrower:  ObjectId<User>    required, index    // always set; lead events use this
  loan:      ObjectId<Loan>|null default null      // null for lead-only events
  type:      EventType          required           // enum from EVENT_TYPES keys
  actor:     ObjectId<User>|null                   // null = system
  actorRole: Role | "system"    required
  message:   string|null        (<= 1000)          // human text: reason, note, nudge message
  meta:      Mixed              default {}         // typed per event type (below)
  createdAt: Date                                   // timestamps: { createdAt: true, updatedAt: false }
}
indexes: { loan: 1, createdAt: 1 }, { borrower: 1, createdAt: -1 }
```
Append-only: there are no update or delete endpoints.

| `type` | Written by | `message` | `meta` | Borrower sees |
|---|---|---|---|---|
| `PROFILE_SAVED` | ProfileService.saveProfile | - | `{ created: boolean }` | no |
| `SLIP_UPLOADED` | ProfileService.attachSalarySlip | - | `{ originalName }` | no |
| `LOAN_APPLIED` | LoanService.applyForLoan | - | `{ amount, tenureDays }` | yes |
| `REVIEW_STARTED` | LoanService.startReview | - | `{}` | yes ("Our team started reviewing") |
| `LOAN_SANCTIONED` | LoanService.approveLoan | decision note (optional) | `{}` | yes (without the note) |
| `LOAN_REJECTED` | LoanService.rejectLoan | reason | `{}` | yes (with the reason, same as v1) |
| `LOAN_DISBURSED` | LoanService.disburseLoan | reason when reduced | `{ disbursedAmount, sanctionedAmount, reduced }` | yes (amount only, see open question 5) |
| `PAYMENT_RECORDED` | PaymentService.recordPayment | remarks | `{ paymentId, amount, utr, mode, balanceAfter }` | yes (amount, date) |
| `LOAN_CLOSED` | PaymentService (via moveTo) | - | `{}` | yes |
| `NUDGE_SENT` | NudgeService (in LoanService) | borrower's message | `{ status, routedTo }` | yes (their own) |
| `LEAD_STATUS_CHANGED` | LeadService | - | `{ from, to }` | no |
| `LEAD_FOLLOW_UP_SET` | LeadService | - | `{ followUpOn }` | no |
| `LEAD_NOTE_ADDED` | LeadService | note text | `{}` | no |

`EVENT_TYPES` config shape: `{ [type]: { borrowerVisible: boolean; borrowerMessage: boolean } }`. `toBorrowerView` returns only `{ id, type, createdAt, message?, meta: { amount? } }`. Actor ids, names, UTRs and notes are never sent to borrowers.

### New: `Lead`
```ts
{
  user:       ObjectId<User> required, unique
  status:     "NEW" | "CONTACTED" | "INTERESTED" | "FOLLOW_UP" | "NOT_INTERESTED"   default "NEW"
  followUpOn: Date|null  default null                  // required when status = FOLLOW_UP
  updatedBy:  ObjectId<User>
  timestamps
}
indexes: { status: 1 }, { followUpOn: 1 }
```
- Effective lead status = `CONVERTED` if the borrower has any loan, otherwise `lead?.status ?? "NEW"`. Constant: `LEAD_STATUSES` (manual) plus `"CONVERTED"` (derived).
- Sales can move between any two manual statuses. There's no state machine, because these are CRM labels and not a process.

### Changed: `Loan`
| Field | Type / default | Purpose |
|---|---|---|
| `status` | enum gains `UNDER_REVIEW` | review claim |
| `reviewedBy` | ObjectId<User>\|null, null | who claimed the review |
| `reviewStartedAt` | Date\|null, null | |
| `decisionNote` | string\|null, null | optional note on approve (staff-only) |
| `disbursedAmount` | number\|null, null | the amount actually paid out |
| `disbursementReason` | string\|null, null | required when `disbursedAmount < amount` |
| `sanctionedTerms` | `{ interest, totalRepayment }`\|null, null | snapshot of the original terms, set only on a reduced disbursement |
| `dueDate` | Date\|null, null | `disbursedAt + tenureDays`, set on disburse. Stored so it can be filtered and indexed |
| `nudge` | `{ lastAt: Date\|null, message: string\|null, pending: boolean, count: number }`, defaults null/null/false/0 | rate limiting plus the team badge |
| schema option | `optimisticConcurrency: true` | two parallel transitions → `VersionError` → 409 |
| virtual `principal` | `disbursedAmount ?? amount` | the one principal the UI shows after disbursement |
| virtuals `dueState`, `daysToDue`, `daysOverdue` | from `dueInfo(loan, new Date())` | `dueState`: `NONE` (not disbursed), `ON_TRACK`, `DUE_SOON` (≤ `DUE_SOON_DAYS`), `OVERDUE`, `PAID` (closed) |
| virtual `nextNudgeAt` | `nudge.lastAt + 24h` or null | the borrower UI uses it to disable the button |
| new indexes | `{ status: 1, createdAt: -1 }`, `{ status: 1, dueDate: 1 }`, `{ "nudge.pending": 1, status: 1 }` | |

`dueInfo` uses whole UTC days: `daysToDue = ceil((dueDate - now) / 1 day)`, and `daysOverdue = max(0, -daysToDue)` (see open question 8 on the IST day boundary).

### Changed: `Payment`
| Field | Type / default |
|---|---|
| `mode` | `"UPI" \| "NEFT" \| "IMPS" \| "RTGS" \| "CASH" \| "CHEQUE" \| "OTHER"` \| null, default null (optional) |
| `remarks` | string ≤ 280 \| null, default null (optional) |

### Changed: `BorrowerProfile.salarySlip`
- Adds `uploadedAt: Date` (set on upload). Old slips don't have it, so the UI shows "Uploaded" without a date.

### Migration and back-compat for existing data
- Every new field has a default, so old documents read fine. Mongoose fills defaults on read for missing paths.
- The virtuals handle old rows: `principal` falls back to `amount`, and `nextNudgeAt` is null.
- **Migration script `npm run migrate:v2`** (`backend/src/migrations/v2.ts`). It is idempotent and safe to re-run:
  1. Sets `dueDate = disbursedAt + tenureDays` for `DISBURSED`/`CLOSED` loans where `dueDate` is null and `disbursedAt` is set.
  2. (optional) Backfills synthetic events from existing timestamps: `LOAN_APPLIED` at `createdAt`, `LOAN_SANCTIONED`/`LOAN_REJECTED` at `sanctionedAt`, `LOAN_DISBURSED` at `disbursedAt`, `PAYMENT_RECORDED` per payment, and `LOAN_CLOSED` at `closedAt`. Each gets `meta.backfilled = true` and `actorRole` from the stored `*By` fields. It skips loans that already have events. Without this step, old loans show "No activity recorded before <date>" in the timeline.
  3. Calls `Model.syncIndexes()` for Loan, LoanEvent and Lead.
- **Old `APPLIED` loans** need no change. They just require "Start review" before a decision.
- **Seed** is unchanged (users only). (optional) A separate `npm run seed:demo` adds one loan per status, two leads with notes, one overdue loan and one nudged loan, so the dashboards look real in demos.

---

## Status transition map (updated)

```
APPLIED ──start review──► UNDER_REVIEW ──approve──► SANCTIONED ──disburse──► DISBURSED ──(auto, paid in full)──► CLOSED
                                       └─reject───► REJECTED
```
```ts
readonly ALLOWED_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
  APPLIED:      ["UNDER_REVIEW"],
  UNDER_REVIEW: ["SANCTIONED", "REJECTED"],   // (optional) + "APPLIED" for "Release review"
  SANCTIONED:   ["DISBURSED"],
  DISBURSED:    ["CLOSED"],
  REJECTED:     [],
  CLOSED:       [],
};
OPEN_LOAN_STATUSES = ["APPLIED", "UNDER_REVIEW", "SANCTIONED", "DISBURSED"];
```
- A decision on an `UNDER_REVIEW` loan is allowed only for `reviewedBy` or an admin. Anyone else gets `409 "Being reviewed by <name>"`.
- Direct `APPLIED → SANCTIONED/REJECTED` is **removed** (see open question 1).

---

## API contracts

Conventions are unchanged: everything is under `/api`, errors are `{ message, errors? }`, and admin passes every staff role check. Two additions:
- **429** `{ message, nextAllowedAt }` plus a `Retry-After` header (in seconds). `AppError` gains `static tooManyRequests(message, details)` and an optional `details` object, which `errorHandler` spreads into the body.
- **Paginated list shape:** `{ <items-key>, page, limit, total }`. The items key stays `loans` or `leads`, so the existing parsing still works. Defaults are `page=1` and `limit=20`, and `limit` is capped at 100.

### Shared list query (all module lists)
| Param | Rule |
|---|---|
| `status` | enum of the module's statuses. Default is the first in `LOAN_MODULES[m].statuses` (back-compat) |
| `q` | trimmed, ≤ 100 chars, regex-escaped, case-insensitive. Matches borrower name/email (User) and fullName/PAN (Profile). Resolved to borrower ids, then `borrower: { $in }` |
| `page`, `limit` | coerced ints, `page ≥ 1`, `1 ≤ limit ≤ 100` |
| module extras | sanction/disbursement: `nudged=true`. collection: `due=OVERDUE\|DUE_SOON` (implies `DISBURSED`) |

Sort is `createdAt desc`. Two exceptions: the sanction `APPLIED` queue sorts `nudge.pending desc, createdAt asc` (oldest first, nudged on top; see open question 9), and the collection `DISBURSED` list sorts `dueDate asc`.

### Endpoint table (new and changed)
| # | Method & path | Roles | Body / query | Success | Errors | Slice |
|---|---|---|---|---|---|---|
| 1 | `GET /borrower/loans` **(changed)** | borrower | - | 200 `{ loans }`. Loans add `principal`, `disbursedAmount`, `sanctionedTerms`, `dueDate`, `dueState`, `daysToDue`, `daysOverdue`, `nextNudgeAt`, `nudge.lastAt`. Staff-only fields (`decisionNote`, `disbursementReason`, `reviewedBy`, actor ids) are **removed** from the borrower serialization | - | S1, S5, S6 |
| 2 | `GET /borrower/loans/:id/events` **(new)** | borrower | - | 200 `{ events: [{ id, type, createdAt, message?, meta: { amount? } }] }` ascending, borrower-visible types only | 404 if the loan isn't theirs or the id is invalid | S1 |
| 3 | `POST /borrower/loans/:id/nudge` **(new)** | borrower | `{ message?: string ≤ 500 }` | 201 `{ event, nextNudgeAt }` | 404 not theirs. 409 status not in `APPLIED/UNDER_REVIEW/SANCTIONED`. 429 `{ message, nextAllowedAt }`. 400 message too long | S5 |
| 4 | `GET /sales/leads` **(changed)** | sales | `status?` (`NEW…NOT_INTERESTED\|CONVERTED`; omitted = all non-converted, as in v1), `stage?`, `followUpDue?=true`, `q`, `page`, `limit` | 200 `{ leads, page, limit, total }`. Each lead adds `status`, `followUpOn`, `lastActivityAt` | 400 bad query | S8 |
| 5 | `GET /sales/leads/:userId` **(new)** | sales | - | 200 `{ lead: { id, name, email, signedUpAt, stage, status, followUpOn }, profile: { fullName, panMasked, age, monthlySalary, employmentMode, slip: { uploaded, uploadedAt? } } \| null, loan: { id, status, amount, createdAt } \| null, events }` | 404 not a borrower | S8 |
| 6 | `PATCH /sales/leads/:userId` **(new)** | sales | `{ status?, followUpOn?: ISO date \| null }`, at least one field | 200 `{ lead }` | 400 `FOLLOW_UP` without a date, a date in the past, or an empty body. 409 the lead is converted (status is derived). 404 | S8 |
| 7 | `POST /sales/leads/:userId/notes` **(new)** | sales | `{ note: string 1..1000 }` | 201 `{ event }` | 400, 404 | S8 |
| 8 | `GET /sales/summary` **(new)** | sales | - | 200 `{ byStatus: { NEW, CONTACTED, INTERESTED, FOLLOW_UP, NOT_INTERESTED, CONVERTED }, byStage: { REGISTERED, PROFILE_COMPLETED, SLIP_UPLOADED }, followUpsDue }` | - | S8 |
| 9 | `GET /sanction/loans` **(changed)** | sanction | shared query. `status` adds `UNDER_REVIEW`. `nudged?` | 200 `{ loans, page, limit, total }`. Rows add `reviewedBy {name}`, `nudge` | 400 | S3, S4 |
| 10 | `GET /sanction/summary` **(new)** | sanction | - | 200 `{ statuses: [{ status, count, principal, totalRepayment }], nudged }` | - | S3 |
| 11 | `GET /sanction/loans/:id` **(new)** | sanction | - | 200 `{ loan, facts, events }`, where `facts = { age, monthlySalary, employmentMode, loanToMonthlySalary, repaymentToMonthlySalary, slip: { uploaded, uploadedAt?, originalName? }, rules: [{ name, passed, message? }] }` (BRE re-run on the current profile) | 404 (also if the status is outside this module) | S4 |
| 12 | `POST /sanction/loans/:id/start-review` **(new)** | sanction | - | 200 `{ loan }` (`UNDER_REVIEW`, `reviewedBy` = caller) | 409 not `APPLIED` or a concurrent claim. 404 | S4 |
| 13 | `POST /sanction/loans/:id/approve` **(changed)** | sanction | `{ note?: string ≤ 1000 }` | 200 `{ loan }` | 409 not `UNDER_REVIEW` / claimed by someone else / concurrent. 404 | S4 |
| 14 | `POST /sanction/loans/:id/reject` **(changed)** | sanction | `{ reason }` required (unchanged) | 200 `{ loan }` | 400, 409 (same as 13), 404 | S4 |
| 15 | `GET /disbursement/loans` **(changed)** | disbursement | shared query, `nudged?` | paginated | 400 | S3 |
| 16 | `GET /disbursement/summary` **(new)** | disbursement | - | same shape as 10 | - | S3 |
| 17 | `GET /disbursement/loans/:id` **(new)** | disbursement | - | 200 `{ loan, events }` | 404 | S6 |
| 18 | `POST /disbursement/loans/:id/disburse` **(changed)** | disbursement | body optional: `{ amount?: number, reason?: string ≤ 500 }`. An empty body means full disbursement (back-compat) | 200 `{ loan }` with `disbursedAmount`, recomputed `interest`/`totalRepayment`, `sanctionedTerms` if reduced, and `dueDate` | 400 `amount > sanctioned`, `amount < LOAN_LIMITS.minAmount`, more than 2 decimals, or reduced without `reason`. 409 not `SANCTIONED` or concurrent. 404 | S6 |
| 19 | `GET /collection/loans` **(changed)** | collection | shared query, `due?` | paginated. Rows include `dueDate`, `dueState`, `daysOverdue`, `principal` | 400 | S3, S7 |
| 20 | `GET /collection/summary` **(new)** | collection | - | 200 `{ statuses: [...], overdue, dueSoon, outstanding, collected }` | - | S3, S7 |
| 21 | `GET /collection/loans/:id` **(new)** | collection | - | 200 `{ loan, events }` | 404 | S7 |
| 22 | `GET /collection/loans/:id/payments` **(changed)** | collection | - | 200 `{ payments }` (still newest first). Each adds `mode`, `remarks`, `balanceAfter`, `recordedBy { name }` | 404 | S7 |
| 23 | `POST /collection/loans/:id/payments` **(changed)** | collection | `{ utr, amount, paidOn, mode?, remarks? }` | 201 `{ payment, loan }` (unchanged) | unchanged, plus 400 for a bad mode or remarks > 280 | S7 |

Unchanged: auth routes, `GET/PUT /borrower/profile`, `POST /borrower/profile/salary-slip` (it now also stamps `uploadedAt` and writes an event), `POST /borrower/loans` (now writes an event), and `GET /sanction/loans/:id/salary-slip`.

### Disbursement math (decided)
```
amount             = sanctioned principal (unchanged, kept for audit)
disbursedAmount    = body.amount ?? amount           // roundMoney; must satisfy LOAN_LIMITS.minAmount ≤ x ≤ amount
reason             required iff disbursedAmount < amount
if reduced: sanctionedTerms = { interest, totalRepayment }   // snapshot before overwrite
{ interest, totalRepayment, interestRate } = calculateRepayment(disbursedAmount, tenureDays)   // same formula, single source
dueDate            = disbursedAt + tenureDays
outstanding        = totalRepayment − totalPaid       // unchanged
```
Example: sanctioned ₹1,00,000 for 90 days gives interest ₹2,958.90 and a total of ₹1,02,958.90. A disbursement of ₹80,000 gives interest ₹2,367.12 and a total of ₹82,367.12, and `sanctionedTerms` stores `{ 2958.90, 102958.90 }`.

**Borrower view effect:** the hero amount shows `principal` (₹80,000) with the secondary line "You asked for ₹1,00,000. ₹80,000 was disbursed." Interest and total show the recomputed values. The reason is staff-only by default (open question 5).

### Role permissions
| Action | borrower | sales | sanction | disbursement | collection | admin |
|---|---|---|---|---|---|---|
| Apply, view own loans/timeline | yes | - | - | - | - | - |
| Nudge own loan | yes | - | - | - | - | - |
| Leads: list, detail, status, follow-up, notes | - | yes | - | - | - | yes |
| Sanction list/detail/summary, start review, approve, reject, slip | - | - | yes | - | - | yes |
| Approve/reject a loan claimed by someone else | - | - | no (409) | - | - | yes |
| Disbursement list/detail/summary, disburse (full or partial) | - | - | - | yes | - | yes |
| Collection list/detail/summary, record payment | - | - | - | - | yes | yes |
| See nudge badges | - | - | for APPLIED/UNDER_REVIEW | for SANCTIONED | - | all |

Admin still cannot use the borrower endpoints (unchanged).

---

## UI/UX

### Design principles (the "not AI-generated" checklist)
1. **Restraint.** One accent colour, used only for the primary action on a screen, the active nav item, focus rings, links and the selected segment. Stat cards, tabs and badges don't use the accent.
2. **Borders over shadows.** Surfaces are separated by 1px `line` borders. One shadow level, reserved for overlays (drawer, modal, toast). Remove `shadow-glow` everywhere except the single primary button on the borrower hero.
3. **At most one gradient per screen**, and only on the borrower's loan hero card (`.glow-card`, opacity cut to about 0.12). `.auth-backdrop` drops to one subtle radial. No gradient text.
4. **Real data density.** Tables are 40px rows, numbers right-aligned in `tabular-nums`, with a secondary muted line for context (email, PAN, "3 days ago"). Show what staff need without a click.
5. **Sentence case everywhere** ("Under review", not "UNDER REVIEW"). No emoji. No exclamation marks in UI chrome.
6. **Meaningful empty states:** say what would appear here and what makes it appear, with an action if one exists.
7. **Quiet motion:** it confirms cause and effect and never decorates.

### Tokens
**Typography** (Inter, already loaded; `font-feature-settings: "cv11", "ss01"`; numbers always `tabular-nums`):
| Token | Size/line | Weight | Use |
|---|---|---|---|
| `display` | 32/40, tracking -0.02em | 600 | the borrower hero amount only |
| `h1` | 24/32, -0.01em | 600 | page title |
| `h2` | 18/28 | 600 | drawer title, card title |
| `h3` | 15/22 | 600 | section heading inside a card or drawer |
| `body` | 14/20 | 400 | default |
| `small` | 13/18 | 400 | secondary lines, helper text |
| `caption` | 12/16 | 500 | labels in definition lists. Uppercase with +0.04em tracking **only** for table headers |

Money: the `Money` component renders `₹1,02,958` in the current colour and `.90` in `muted`, Mercury-style. Lists drop the paise when they're zero.

**Spacing:** 4px base. Allowed steps: 4, 8, 12, 16, 24, 32, 48, 64. Page padding is 32 on desktop and 16 on mobile. Card padding is 20. Section gap is 24. Form field gap is 16. Label-to-input gap is 6, the one allowed off-grid value for optical alignment.

**Radius:** 6px for inputs, buttons and segmented controls. 10px for cards, the drawer and modals. Full rounding only for status pills, avatars and count badges. This replaces today's `rounded-2xl/3xl` cards and `rounded-full` tabs.

**Colour:** keep the existing CSS-variable system (dark). Tune the neutrals a little cooler and lower the accent saturation (proposed: `--accent: 108 92 231`, `--accent-soft: 167 157 247`). Semantic colours (`success`, `warning`, `danger`, `info`) appear only in status pills, callouts and due indicators, never as decoration. Light mode is out of scope.

**Iconography:** `lucide-react` only, 16px in chrome and 14px inline, `strokeWidth={1.75}`. An icon always sits next to a label (or has an `aria-label` when standalone). One fixed icon per concept: Users = sales, ShieldCheck = sanction, Banknote = disbursement, Wallet = collection, BellRing = nudge, CalendarClock = follow-up and due, StickyNote = note, CircleDot = status change, FileText = slip.

**Motion:** 150ms ease-out for hover and press states. 200ms ease-out for drawer and modal enter, 150ms for exit. Toasts slide 8px. No bounce or scale-pop. `prefers-reduced-motion` turns transitions into fades. A skeleton shows only on first load; reloads keep stale rows visible and show a thin top progress line (`useAsync` gains a `refreshing` flag).

### Status pill system
A single pill component (`StatusBadge`): dot plus a sentence-case label, a 1px tinted ring and a 10% tinted fill. Tones are set in one map:
| Domain | Value → tone |
|---|---|
| Loan | Applied → info · Under review → warning · Sanctioned → accent · Rejected → danger · Disbursed → info · Closed → success |
| Lead | New → neutral · Contacted → info · Interested → accent · Follow up → warning · Not interested → neutral (muted text) · Converted → success |
| Lead stage | Registered / Profile completed / Slip uploaded → neutral, with a stage dot count (1/3, 2/3, 3/3) |
| Due | On track → neutral · Due in N days → warning · N days overdue → danger · Paid → success |
| Nudge | `CountBadge` (accent fill, 18px, `9+` cap) in the sidebar. A row marker is a 2px left border in `warning` plus a BellRing icon with the nudge time on hover |

### Reference patterns (concrete)
- **Stripe Dashboard:** list → right **detail drawer** with a header (name, status pill, primary action), a **key-value definition list** (label column 140px in `caption` muted, value in `body`), and an **activity timeline** at the bottom. Filters sit above the table as **filter chips** (status segmented control + search + "Nudged" or "Overdue" chips).
- **Linear:** **claim with an avatar**. "Under review · Priya" shows the reviewer's initials avatar in the row and the drawer header. The queue is ordered by urgency. Keyboard: `Esc` closes the drawer, `j`/`k` move between rows when the drawer is open (optional).
- **Mercury:** calm money typography (muted decimals, no colour on amounts) and **summary strips** of four to five numbers above lists with no icons or charts.
- **Razorpay:** a **payment ledger** with columns Date · UTR · Mode · Amount · Balance after · Recorded by, plus the semantic status pill system.
- **CRED (borrower side only):** one confident hero number per screen, generous whitespace and a single primary action. We take the hierarchy, not the heavy gradients or neumorphism.

### New shared components (`components/ui/`)
`Drawer` (right sheet, 480px; `wide` = 640px; full-screen under 768px; URL-synced via `?loan=`/`?lead=`), `DefinitionList`, `ActivityFeed` (event-based: icon, sentence, actor, relative time with the absolute time in `title`; driven by `lib/events.ts`), `FilterBar` (segmented status control + search input with 300ms debounce + chip toggles), `Pagination` ("1-20 of 134", prev/next), `SummaryStrip` (clickable stat cells that select the matching status; replaces StatGrid on module pages), `Money`, `CountBadge`, `Callout` (info/warning/danger), `Avatar` (initials). `StatusTabs` becomes a segmented control (6px radius, no glow). The existing step `Timeline` stays for the borrower progress tracker.

### Page layouts
Every staff module uses the same skeleton:
```
┌ Sidebar ┐┌──────────────────────────────────────────────────────────┐
│ Sales   ││ h1 Title                              (secondary actions)│
│ Sanct.●3││ small subtitle: what this queue is                       │
│ Disb. ●1││ ┌ SummaryStrip: one cell per status (count + amount) ──┐ │
│ Coll.   ││ └──────────────────────────────────────────────────────┘ │
│         ││ FilterBar: [Segmented status] [Search……] [Nudged]        │
│ ─────── ││ Table (row click → Drawer)                               │
│ avatar  ││ Pagination                                               │
└─────────┘└──────────────────────────────────────────────────────────┘
```
- **Sales:** strip = New · Contacted · Interested · Follow up · Not interested · Converted. Columns: Lead (name/email) · Stage · Status · Follow-up (date; red text if past) · Signed up · Last activity. **Lead drawer:** header (name, status select, follow-up date picker), "Profile" definition list (full name, PAN masked, age, salary, employment, slip uploaded/date), "Loan" (if converted: status pill, amount, applied date), "Notes & activity" ActivityFeed with an "Add a note" textarea pinned at the top (Cmd/Ctrl+Enter to save).
- **Sanction:** strip = Applied · Under review · Sanctioned · Rejected, plus "N nudged" chip. Columns: Borrower · Amount · Tenure · Salary · Applied (relative) · Reviewer (avatar or "Unclaimed") · Status. Nudged rows get the warning left border. **Review drawer (wide):**
  1. Header: name, status pill, reviewer avatar, "Applied 2 days ago".
  2. Callout (if nudged): "Borrower sent a reminder 3 hours ago: "<message>"".
  3. "Eligibility" checklist: each BRE rule as a row (CheckCircle or XCircle), plus facts: Age 31 · Monthly salary ₹60,000 · Loan is 1.7× monthly salary · Repayment is 0.6× monthly salary per month of tenure · Salary slip: payslip.pdf, uploaded 12 Oct (View).
  4. "Loan" definition list: amount, tenure, rate, interest, total repayment.
  5. Activity feed.
  6. Sticky footer: if `APPLIED`, primary "Start review". If `UNDER_REVIEW` and it's yours: "Decision note" textarea (optional for approve, required for reject), then "Reject" (secondary-danger) and "Approve" (primary). If someone else claimed it: muted "Being reviewed by Priya" with no actions (admin still sees them).
- **Disbursement:** strip = Sanctioned · Disbursed (count + amount) plus "N nudged". Columns: Borrower · Sanctioned amount · Tenure · Sanctioned (date, by) · Status. **Disburse drawer:** definition list of sanctioned terms. A "Disbursement amount" field prefilled with the sanctioned amount and a hint "Between ₹50,000 and ₹1,00,000". If lowered: a "Reason" textarea appears (required) and a live **before → after** comparison (Interest ₹2,958.90 → ₹2,367.12 · Total ₹1,02,958.90 → ₹82,367.12) computed with the frontend `loanMath` and confirmed by the server response. The primary button reads "Disburse ₹80,000".
- **Collection:** strip = Outstanding (₹) · Collected (₹) · Due soon · Overdue · Closed. Filter chips: Overdue, Due soon. Columns: Borrower · Principal · Total repayment · Paid · Progress (thin bar + %) · Due (date + due pill) · Outstanding. **Loan drawer:** summary (outstanding as the large number, due pill, progress), definition list (principal, interest, total, disbursed on, due date), **ledger** table (Date · UTR · Mode · Amount · Balance after · By), "Record payment" form (UTR, amount with a "Pay full ₹X" quick-fill link, date, mode select (optional), remarks (optional)), then the activity feed. This replaces the inline `PaymentPanel` card under the table.
- **Borrower apply (`/apply`):** a single centered column, max-width 640. Compact stepper ("Step 2 of 3 · Salary slip" plus a thin progress bar) instead of the four big circles. One card per step with a title, a one-line reason why we ask, and fields with helper text under each. A reassurance line sits under the primary button.
- **Borrower status (`/apply`, after applying):** a hero card (status pill, `display` principal, one status sentence, the due date and outstanding once disbursed, a progress bar). Then a "Progress" step tracker (Applied → Under review → Sanctioned → Disbursed → Closed) and a "Need an update?" card with "Send a reminder". Then "History", an ActivityFeed of borrower-visible events. Older loans collapse into "Past applications".

### Microcopy

**Tone guide:** plain words, second person, active voice, short sentences. Warm but not chummy: we're a lender, so we're calm and precise. Say what happened, then what to do next. Never blame the user. No "Oops", "Uh-oh", "Awesome", emoji or exclamation marks. Never promise what the system doesn't do (no "instant", no "within 24 hours"). Numbers are always formatted (₹1,00,000; 12 Oct 2026). Staff copy is terser than borrower copy.

**Borrower apply flow** (3 steps + status. The v1 "Status" stepper label becomes a separate screen.)
| Where | Copy |
|---|---|
| Page title | "Apply for a personal loan" · sub: "Three short steps. You can come back and finish later." |
| Step 1 title | "Tell us about yourself" · sub: "We use this to check whether you're eligible. It takes about two minutes." |
| Full name helper | "As it appears on your PAN card." |
| PAN helper / inline error | "10 characters, like ABCDE1234F." / "That doesn't look like a PAN. It should be 5 letters, 4 numbers, then 1 letter." |
| DOB helper | "You need to be between 23 and 50 to apply." |
| Salary helper | "Your monthly take-home pay, in rupees." |
| Employment helper | "Choose the one that fits best." |
| Step 1 button / reassurance | "Check eligibility" / "Your details are only used to assess this application." |
| BRE failure callout | Title: "We can't offer you a loan right now" · list of reasons · footer: "If any of this is wrong, update your details and try again." |
| Step 2 title | "Add your latest salary slip" · sub: "It helps us confirm your income. PDF, JPG or PNG, up to 5 MB." |
| Drop zone | "Drop your file here or browse" · after upload: "payslip-sep.pdf uploaded" + "Replace" |
| Slip errors | "This file is larger than 5 MB. Try a PDF or a smaller photo." / "We can only accept PDF, JPG or PNG files." / "Upload didn't finish. Check your connection and try again." |
| Step 3 title | "Choose your amount and tenure" · sub: "Borrow ₹50,000 to ₹5,00,000 for 30 to 365 days." |
| Summary panel | "You repay ₹1,02,958.90 in total" · line: "₹1,00,000 principal + ₹2,958.90 interest (12% a year, simple interest, for 90 days)" · note: "Repayment is due 90 days after the money reaches you." |
| Step 3 button / reassurance | "Submit application" / "You can track every update on this page after you apply." |
| Open-loan conflict (409) | "You already have an application in progress. You can track it below." |
| Network error | "We couldn't reach our servers. Your details are safe. Try again in a moment." |
| Success toast | "Application submitted. We'll keep you posted here." |

**Status sentences (hero)**
| Status | Copy |
|---|---|
| Applied | "Application received. It's in the queue for review." |
| Under review | "Our team is reviewing your application." |
| Sanctioned | "Good news: your loan is approved. We're preparing the payout." |
| Rejected | "We couldn't approve this application." + reason + "You're welcome to apply again with updated details." |
| Disbursed | "Your loan has been disbursed. Repay ₹X by 10 Jan 2027." / overdue: "Your repayment was due on 10 Jan 2027. Please pay ₹X as soon as you can." |
| Closed | "All repaid. This loan is closed. Thank you for borrowing with us." |
| Reduced disbursement (secondary line) | "You asked for ₹1,00,000. ₹80,000 was disbursed, and your interest and total have been updated to match." |

**Nudge**
| Where | Copy |
|---|---|
| Card | Title "Need an update?" · "Send a reminder to the team handling your application." · button "Send a reminder" |
| Modal | Title "Send a reminder" · field "Anything we should know? (optional)" · placeholder "For example, I need the funds by Friday." · button "Send reminder" |
| Success | Toast: "Reminder sent. The team will see it on their dashboard." |
| Cooldown (disabled button / 429) | "You've sent a reminder recently. You can send another after 3:40 pm on 14 Oct." |
| History line | "You sent a reminder" + their message in quotes |

**Borrower history lines** (from `lib/events.ts`): "Application submitted" · "Review started" · "Loan approved" · "Application not approved" (+ reason) · "₹80,000 disbursed" · "Payment of ₹20,000 received" · "Loan closed" · "You sent a reminder".

**Staff copy samples:** empty sanction queue: "No applications waiting. New applications appear here as soon as borrowers submit them." · empty overdue filter: "Nothing overdue. Loans past their due date will show up here." · claim conflict: "Priya is already reviewing this loan." · reduced-disbursement reason placeholder: "Why is the amount lower than sanctioned?" · lead note placeholder: "What happened on this call or message?"

---

## Failure modes

| Failure | Handling |
|---|---|
| Event write fails after a successful state change | `EventService.record` for state-change events is awaited and wrapped. On error it logs and does **not** fail the request, because the state change is the source of truth and the event is the audit record. For `NUDGE_SENT` and `LEAD_NOTE_ADDED` the event **is** the action, so errors propagate (500). Known gap without Mongo transactions; transactions are possible later if a replica set is used. |
| Two staff act on the same loan at once | `optimisticConcurrency: true` on Loan. The second `save()` throws `VersionError`, which `errorHandler` maps to 409 "This loan was just updated by someone else. Refresh to see the latest." `start-review` uses an atomic `findOneAndUpdate({ status: "APPLIED" })`. |
| Payment close path concurrency | Unchanged compare-and-set on `totalPaid`. The close then goes through `moveTo` on the freshly returned doc. |
| Parallel nudges | Atomic `findOneAndUpdate({ _id, borrower, status: { $in: nudgeable }, $or: [{ "nudge.lastAt": null }, { "nudge.lastAt": { $lte: now − 24h } }] })`. If there's no match, a re-read decides the response: 404 (not theirs), 409 (status), or 429 (cooldown, with `nextAllowedAt`). |
| Nudge accepted but event insert fails | 500. `nudge.lastAt` is already set, so the borrower can't retry for 24h, but the team still sees `nudge.pending` and the message on the loan. Acceptable, and logged. |
| Stale review claim (reviewer is away) | Admin can decide on any claimed loan. (optional) "Release review" (`UNDER_REVIEW → APPLIED`) for the claimer or admin. |
| Partial disbursement invalid | 400 with all errors listed, the same as `validatePayment`. A pure `validateDisbursement(loan, input)` function makes this unit-testable. |
| Old loans without `dueDate` | The migration backfills it. Until then `dueInfo` falls back to `disbursedAt + tenureDays` at read time. |
| Search regex injection or slow search | Escape `q` and cap it at 100 chars. Search is a bounded two-step lookup (users and profiles by regex, then loans by `$in`). Fine at this scale. Revisit with a text index if user counts grow past roughly 50k. |
| Lead PATCH on a converted borrower | 409 "This lead has already applied for a loan." |
| Borrower sees staff data | A dedicated borrower serializer (allow-list) on loans and events. An API test asserts that no actor ids, UTRs, notes or reasons beyond the rejection reason leak. |
| Summary and list drift (both fetched separately) | Both reload after any action. Small, acceptable inconsistency between requests. |
| Clock and day boundaries for due/overdue | UTC whole days (see open question 8). The due logic is a pure function with an injected `now`. |

---

## Rollout plan

- Ship **per slice**, in order. Each slice merges backend, frontend, tests and doc updates (`DESIGN.md`, `FLOWS.md`, `API.md`) together.
- Backend changes are **additive** except in S4 (approve/reject now require `UNDER_REVIEW`) and S3 (lists default to 20 per page). In both cases the matching frontend ships in the same slice, so nothing is out of sync for users.
- Run `npm run migrate:v2` after deploying S1 (indexes and optional event backfill) and again after S7 (the `dueDate` backfill). It's idempotent, so running it on every deploy is fine.
- No feature flags. Each slice is small and reversible by reverting its merge request. The data changes are additive, so reverting the code leaves harmless extra fields.
- Verification for each slice: `npm test` and `npm run typecheck` in `backend/`, `npm run build` in `frontend/`, and a manual run of the updated demo script in FLOWS.md.

### Slicing plan (priority order for fast delivery)
Each slice can ship on its own and includes both backend and frontend.

| # | Slice | Backend | Frontend | Depends on |
|---|---|---|---|---|
| **S1** | **Event log + borrower history** | `LoanEvent` model, `EventService`, `EVENT_TYPES` config, `LoanService.moveTo`, events on profile/slip/apply/approve/reject/disburse/payment/close, `GET /borrower/loans/:id/events`, borrower serializer, migrate script (indexes + optional backfill) | `lib/events.ts`, `ActivityFeed`, "History" section on the borrower status view | - |
| **S2** | **Design foundation** (frontend only) | - | Token pass (type scale, radius, neutrals, accent, remove glow and gradients), `StatusBadge` sentence case + tone map, segmented `StatusTabs`, `Drawer`, `DefinitionList`, `Money`, `Callout`, `Avatar`; Sidebar and `ModulePage` header restyle; `MODULES` gains `icon`; `useAsync.refreshing` | - (can run in parallel with S1) |
| **S3** | **Lists: search, paging, summaries** | `utils/listQuery.ts`, `LOAN_MODULES` config, `SummaryService`, `GET /{sanction,disbursement,collection}/summary`, paginated lists | `FilterBar`, `Pagination`, `SummaryStrip` on the three loan modules | S2 (components) |
| **S4** | **Sanction review workflow** | `UNDER_REVIEW` in the constants and state machine, `start-review`, claim checks, `note` on approve, `GET /sanction/loans/:id` with facts, `optimisticConcurrency` + VersionError → 409 | Review drawer (eligibility checklist, facts, sticky decision footer), reviewer column, `UNDER_REVIEW` across types, badges and the borrower tracker | S1, S2, S3 |
| **S5** | **Borrower nudge + team badges** | `Loan.nudge`, `POST /borrower/loans/:id/nudge`, 429 support in `AppError`/`errorHandler`, `nudged` in summaries and the list filter | "Need an update?" card + modal on the borrower view, sidebar `CountBadge` from summaries (60s poll while visible), highlighted rows, nudge callout in drawers | S1, S3, S4 |
| **S6** | **Partial disbursement** | `validateDisbursement`, disburse body, recompute via `calculateRepayment`, `sanctionedTerms`, `principal` virtual, `dueDate` set on disburse, `GET /disbursement/loans/:id` | Disburse drawer with amount, reason and the before→after comparison; borrower hero "You asked for…" line | S1, S2 |
| **S7** | **Collection upgrade** | `dueInfo` + virtuals, `due` filter, collection summary extras, Payment `mode`/`remarks`, ledger `balanceAfter` + `recordedBy`, `GET /collection/loans/:id`, `dueDate` backfill in migrate | Collection columns (progress, due pill), loan drawer with ledger and payment form (replaces `PaymentPanel`), borrower due-date line | S2, S3, S6 (`dueDate`) |
| **S8** | **Sales lead management** | `Lead` model, lead aggregation list (status/stage/followUpDue/q/paging), detail, PATCH, notes, `/sales/summary` | Sales strip, filters, lead drawer (status select, follow-up date, notes + activity) | S1, S2, S3 |
| **S9** | **Guided apply flow + microcopy** (mostly frontend) | (none, beyond S1) | Compact stepper, per-step copy, helper text, inline PAN check, drop zone, friendlier BRE callout, status hero sentences | S2 |
| S10 *(optional)* | Demo polish | `seed:demo`, "Release review" transition | `j`/`k` keyboard navigation in drawers | all |

S9 has no backend risk and can move earlier if borrower-facing polish matters more for the demo.

---

## Test strategy

The backend uses the existing vitest setup: `tests/unit.test.ts` for pure functions and `tests/api.test.ts` (supertest + mongodb-memory-server) for HTTP. New tests may be split by area into separate files (`tests/events.test.ts` and so on) under the same config.

**Unit (pure)**
- `LoanStateMachine`: every allowed and forbidden pair in the new map, including that `APPLIED → SANCTIONED` is now forbidden.
- `calculateRepayment` on disbursed amounts (the ₹80,000 / 90-day example), and `validateDisbursement` boundaries: `= amount`, `> amount`, `< minAmount`, reduced without a reason, more than 2 decimals.
- `dueInfo` with an injected `now`: not disbursed, on track, exactly `DUE_SOON_DAYS`, due today, 1 day overdue, closed.
- The nudge cooldown helper (`nextNudgeAt`), and `listQuery` parsing (defaults, caps, bad enum, regex escaping).
- `EVENT_TYPES` borrower projection: allow-listed fields only.
- The effective lead status derivation (`CONVERTED` wins).

**API**
- Events: each action writes exactly one event with the right type and actor. The borrower events endpoint hides staff-only types and fields. A different borrower gets 404.
- Sanction: start-review → approve with note. Approve without review gives 409. A second reviewer's decision gives 409. Admin override gives 200. Two parallel start-reviews give exactly one 200 and one 409. Reject still requires a reason.
- Nudge: 201, then an immediate retry gives 429 with `nextAllowedAt` and `Retry-After`. Faking `nudge.lastAt` to 25h ago then gives 201. A `DISBURSED` loan gives 409. Another borrower's loan gives 404. The summary `nudged` count increments, and the pending flag clears after a transition.
- Disbursement: empty body gives a full disbursement (back-compat). A reduced amount recomputes the totals and sets `sanctionedTerms`. Each validation error gives 400. A non-`SANCTIONED` loan gives 409. Paying the reduced total in full closes the loan.
- Collection: `due=OVERDUE` filter. Payment with `mode`/`remarks`. Ledger `balanceAfter` is correct across three payments. Existing payment tests still pass unchanged.
- Lists and summaries: paging totals, `q` by name, email and PAN, a summary that counts every status regardless of the current tab, and 403 for the wrong role on each new route.
- Leads: default list excludes converted, PATCH status and follow-up (400 for `FOLLOW_UP` without a date), PATCH on a converted lead gives 409, notes appear in the detail events.
- Migration: running it twice gives the same result, and `dueDate` is backfilled.

**Frontend:** there is no test runner today. Each slice is verified with `npm run build` (type safety) plus a manual pass of the updated FLOWS demo script at desktop and 375px widths, keyboard-only navigation of the drawer and modal, and a `prefers-reduced-motion` check. Adding a component test setup is open question 10.

---

## Open questions / assumptions (please approve or correct)

1. **Review is mandatory.** I removed `APPLIED → SANCTIONED/REJECTED`, so every decision goes through "Start review". Alternative: keep the direct path and make the claim optional.
2. **Claim lock.** Only the claimer or an admin can decide. Do we want "Release review" (`UNDER_REVIEW → APPLIED`) in scope, or leave it optional (S10)?
3. **Nudge cooldown** is 24h per loan, with the message optional and up to 500 chars. The pending flag clears only when the loan's status changes (there's no "mark as seen" action). OK?
4. **Partial disbursement minimum** = `LOAN_LIMITS.minAmount` (₹50,000), maximum = the sanctioned amount, whole paise. Tenure is unchanged. Interest and total are recomputed on the disbursed amount, with the originals kept in `sanctionedTerms`. OK?
5. **Is the reduced-disbursement reason visible to the borrower?** My assumption is no: they see the amounts and a neutral explanation. The rejection reason stays visible, as in v1.
6. **The approval decision note is staff-only.** OK?
7. **Sales sees a masked PAN** (`ABCDE****F`) and age rather than DOB. Sanction keeps the full PAN. OK?
8. **Due and overdue days** are computed in UTC whole days. Should we switch to an IST (Asia/Kolkata) day boundary? It's a small change but affects tests.
9. **Queue ordering:** the sanction `APPLIED` queue sorts nudged first, then oldest first (FIFO). Other lists sort newest first. OK?
10. **Frontend tests:** keep build + manual checks only, or add Vitest + Testing Library for the new primitives and the disbursement comparison? That would add an extra slice of about half a day.
11. **Theme:** stay dark-only with a toned-down accent (proposed `108 92 231`). Light mode stays out of scope. OK?
12. **Event backfill** for existing loans in the migration (synthetic, flagged `backfilled`): include it, or accept empty history for pre-v2 loans?
13. **Model name:** I kept `LoanEvent` as requested even though it also holds lead events (`loan: null`). Rename to `ActivityEvent`?
14. **Due-soon threshold** is 7 days. OK?
15. **Polling:** sidebar badges refresh on navigation and every 60s while the tab is visible. No websockets. OK?

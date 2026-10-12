import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";
import { StatusBadge } from "../ui/StatusBadge";
import { Timeline, type TimelineStep } from "../ui/Timeline";
import { formatDate, formatMoney } from "@/lib/format";
import type { Loan, LoanStatus } from "@/lib/types";

const STATUS_MESSAGES: Record<LoanStatus, string> = {
  APPLIED: "Your application is under review.",
  SANCTIONED: "Your loan is approved and waiting for disbursement.",
  REJECTED: "Your application was rejected.",
  DISBURSED: "Your loan has been disbursed. Repay the outstanding balance before the due date.",
  CLOSED: "Your loan is fully repaid. Thank you!",
};

const OPEN_STATUSES: LoanStatus[] = ["APPLIED", "SANCTIONED", "DISBURSED"];

export function hasOpenLoan(loans: Loan[]): boolean {
  return loans.some((loan) => OPEN_STATUSES.includes(loan.status));
}

const HAPPY_PATH: { status: LoanStatus; label: string }[] = [
  { status: "APPLIED", label: "Applied" },
  { status: "SANCTIONED", label: "Sanctioned" },
  { status: "DISBURSED", label: "Disbursed" },
  { status: "CLOSED", label: "Closed" },
];

function buildTimeline(loan: Loan): TimelineStep[] {
  const appliedOn = `On ${formatDate(loan.createdAt)}`;
  if (loan.status === "REJECTED") {
    return [
      { label: "Applied", description: appliedOn, state: "done" },
      { label: "Rejected", description: loan.rejectionReason ?? undefined, state: "failed" },
    ];
  }
  const currentIndex = HAPPY_PATH.findIndex((s) => s.status === loan.status);
  return HAPPY_PATH.map((step, i) => {
    // A closed loan is finished, so every step is done; otherwise the current one is highlighted.
    const state = i < currentIndex || loan.status === "CLOSED" ? "done" : i === currentIndex ? "current" : "upcoming";
    return { label: step.label, description: i === 0 ? appliedOn : undefined, state };
  });
}

function Detail({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium tabular-nums ${accent ? "text-accent-soft" : "text-fg"}`}>{value}</dd>
    </div>
  );
}

function LoanCard({ loan }: { loan: Loan }) {
  const repaying = loan.status === "DISBURSED" || loan.status === "CLOSED";
  return (
    <Card glow>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <StatusBadge status={loan.status} />
        <span className="text-xs text-subtle">Applied on {formatDate(loan.createdAt)}</span>
      </div>
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">Loan amount</p>
      <p className="text-4xl font-bold tabular-nums tracking-tight text-fg">{formatMoney(loan.amount)}</p>
      <p className="mt-2 text-sm text-muted">{STATUS_MESSAGES[loan.status]}</p>

      {loan.status === "REJECTED" && loan.rejectionReason && (
        <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Reason: {loan.rejectionReason}
        </p>
      )}

      <div className="my-6 border-t border-line pt-6">
        <Timeline steps={buildTimeline(loan)} />
      </div>

      {repaying && (
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-xs text-muted">
            <span>Repaid</span>
            <span className="tabular-nums">
              {formatMoney(loan.totalPaid)} of {formatMoney(loan.totalRepayment)}
            </span>
          </div>
          <ProgressBar value={loan.totalPaid} max={loan.totalRepayment} label="Repayment progress" />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Detail label="Principal" value={formatMoney(loan.amount)} />
        <Detail label="Tenure" value={`${loan.tenureDays} days`} />
        <Detail label={`Interest (${loan.interestRate}%)`} value={formatMoney(loan.interest)} />
        <Detail label="Total repayment" value={formatMoney(loan.totalRepayment)} accent />
        <Detail label="Paid" value={formatMoney(loan.totalPaid)} />
        <Detail label="Outstanding" value={formatMoney(loan.outstanding)} />
      </dl>
    </Card>
  );
}

interface LoanStatusViewProps {
  loans: Loan[];
  onNewApplication: () => void;
}

export function LoanStatusView({ loans, onNewApplication }: LoanStatusViewProps) {
  return (
    <div className="space-y-4">
      {loans.map((loan) => (
        <LoanCard key={loan.id} loan={loan} />
      ))}
      {!hasOpenLoan(loans) && <Button onClick={onNewApplication}>Start a new application</Button>}
    </div>
  );
}

"use client";

import { DataTable, type Column } from "./ui/DataTable";
import { StatusBadge } from "./ui/StatusBadge";
import { formatMoney, formatDate } from "@/lib/format";
import type { Loan, LoanStatus } from "@/lib/types";

// Columns shared by the sanction / disbursement / collection tables.
export const borrowerColumn: Column<Loan> = {
  header: "Borrower",
  render: (l) => (
    <div>
      <p className="font-medium text-fg">{l.profile?.fullName ?? l.borrower?.name}</p>
      <p className="text-xs text-subtle">{l.borrower?.email}</p>
    </div>
  ),
};

export const loanColumns: Column<Loan>[] = [
  { header: "Amount", render: (l) => formatMoney(l.amount) },
  { header: "Tenure", render: (l) => `${l.tenureDays} days` },
  { header: "Total repayment", render: (l) => formatMoney(l.totalRepayment) },
];

export const statusColumn: Column<Loan> = { header: "Status", render: (l) => <StatusBadge status={l.status} /> };
export const appliedOnColumn: Column<Loan> = { header: "Applied", render: (l) => formatDate(l.createdAt) };

interface StatusTabsProps {
  options: LoanStatus[];
  value: LoanStatus;
  onChange: (status: LoanStatus) => void;
}

export function StatusTabs({ options, value, onChange }: StatusTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Filter by status"
      className="mb-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1"
    >
      {options.map((option) => (
        <button
          key={option}
          role="tab"
          aria-selected={option === value}
          onClick={() => onChange(option)}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
            option === value ? "bg-accent text-accent-fg shadow-glow" : "text-muted hover:text-fg"
          }`}
        >
          {option.charAt(0) + option.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}

export { DataTable };

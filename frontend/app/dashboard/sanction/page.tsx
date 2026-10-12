"use client";

import { useState } from "react";
import { ModulePage } from "@/components/ModulePage";
import {
  DataTable,
  StatusTabs,
  appliedOnColumn,
  borrowerColumn,
  loanColumns,
  statusColumn,
} from "@/components/LoanTable";
import { RejectModal } from "@/components/RejectModal";
import { Button } from "@/components/ui/Button";
import type { Column } from "@/components/ui/DataTable";
import { ErrorAlert } from "@/components/ui/Feedback";
import { StatRowSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { formatMoney, sum } from "@/lib/format";
import type { Loan, LoanStatus } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

const STATUSES: LoanStatus[] = ["APPLIED", "SANCTIONED", "REJECTED"];

export default function SanctionPage() {
  const toast = useToast();
  const [status, setStatus] = useState<LoanStatus>("APPLIED");
  const [rejecting, setRejecting] = useState<Loan | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => api.sanctionLoans(status), [status]);

  const approve = async (loan: Loan) => {
    setBusyId(loan.id);
    try {
      await api.approveLoan(loan.id);
      toast.success("Loan approved.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not approve");
    } finally {
      setBusyId(null);
    }
  };

  const viewSlip = async (loan: Loan) => {
    try {
      await api.openSalarySlip(loan.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open salary slip");
    }
  };

  const columns: Column<Loan>[] = [
    borrowerColumn,
    { header: "Salary", render: (l) => (l.profile ? formatMoney(l.profile.monthlySalary) : "-") },
    ...loanColumns,
    appliedOnColumn,
    {
      header: "Salary slip",
      render: (l) => (
        <button onClick={() => viewSlip(l)} className="rounded font-medium text-accent-soft hover:underline">
          View
        </button>
      ),
    },
    statusColumn,
    {
      header: "Actions",
      render: (l) =>
        l.status === "APPLIED" ? (
          <div className="flex gap-2">
            <Button loading={busyId === l.id} onClick={() => approve(l)}>
              Approve
            </Button>
            <Button variant="danger" onClick={() => setRejecting(l)}>
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-subtle">{l.rejectionReason ?? ""}</span>
        ),
    },
  ];

  const loans = data?.loans ?? [];
  const label = status.toLowerCase();

  return (
    <ModulePage role="sanction" title="Sanction">
      <StatusTabs options={STATUSES} value={status} onChange={setStatus} />
      {loading && (
        <>
          <StatRowSkeleton count={3} />
          <TableSkeleton />
        </>
      )}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {data && !loading && (
        <>
          <StatGrid>
            <StatCard label={`${status.charAt(0) + label.slice(1)} loans`} value={loans.length} accent />
            <StatCard label="Total principal" value={formatMoney(sum(loans.map((l) => l.amount)))} />
            <StatCard label="Total repayment" value={formatMoney(sum(loans.map((l) => l.totalRepayment)))} />
          </StatGrid>
          <DataTable columns={columns} rows={loans} getKey={(l) => l.id} emptyText={`No ${label} loans.`} />
        </>
      )}
      {rejecting && (
        <RejectModal
          loan={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={() => {
            setRejecting(null);
            reload();
          }}
        />
      )}
    </ModulePage>
  );
}

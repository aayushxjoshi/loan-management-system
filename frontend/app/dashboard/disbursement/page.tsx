"use client";

import { useState } from "react";
import { ModulePage } from "@/components/ModulePage";
import { DataTable, StatusTabs, appliedOnColumn, borrowerColumn, loanColumns, statusColumn } from "@/components/LoanTable";
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

const STATUSES: LoanStatus[] = ["SANCTIONED", "DISBURSED"];

export default function DisbursementPage() {
  const toast = useToast();
  const [status, setStatus] = useState<LoanStatus>("SANCTIONED");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => api.disbursementLoans(status), [status]);

  const disburse = async (loan: Loan) => {
    setBusyId(loan.id);
    try {
      await api.disburseLoan(loan.id);
      toast.success("Loan disbursed.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disburse");
    } finally {
      setBusyId(null);
    }
  };

  const columns: Column<Loan>[] = [
    borrowerColumn,
    ...loanColumns,
    appliedOnColumn,
    statusColumn,
    {
      header: "Actions",
      render: (l) =>
        l.status === "SANCTIONED" ? (
          <Button loading={busyId === l.id} onClick={() => disburse(l)}>
            Disburse
          </Button>
        ) : null,
    },
  ];

  const loans = data?.loans ?? [];
  const label = status.toLowerCase();

  return (
    <ModulePage role="disbursement" title="Disbursement">
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
    </ModulePage>
  );
}

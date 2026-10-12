"use client";

import { useState } from "react";
import { ModulePage } from "@/components/ModulePage";
import { DataTable, StatusTabs, borrowerColumn, loanColumns, statusColumn } from "@/components/LoanTable";
import { PaymentPanel } from "@/components/PaymentPanel";
import { Button } from "@/components/ui/Button";
import type { Column } from "@/components/ui/DataTable";
import { ErrorAlert } from "@/components/ui/Feedback";
import { StatRowSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { api } from "@/lib/api";
import { formatMoney, sum } from "@/lib/format";
import type { Loan, LoanStatus } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

const STATUSES: LoanStatus[] = ["DISBURSED", "CLOSED"];

export default function CollectionPage() {
  const [status, setStatus] = useState<LoanStatus>("DISBURSED");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => api.collectionLoans(status), [status]);

  // Look the selected loan up in the fresh list so balances stay current after payments.
  const selected = data?.loans.find((l) => l.id === selectedId) ?? null;

  const changeStatus = (next: LoanStatus) => {
    setSelectedId(null);
    setStatus(next);
  };

  const columns: Column<Loan>[] = [
    borrowerColumn,
    ...loanColumns.slice(0, 1),
    { header: "Total repayment", render: (l) => formatMoney(l.totalRepayment) },
    { header: "Paid", render: (l) => formatMoney(l.totalPaid) },
    { header: "Outstanding", render: (l) => <span className="font-semibold text-accent-soft">{formatMoney(l.outstanding)}</span> },
    statusColumn,
    {
      header: "Actions",
      render: (l) => (
        <Button variant="secondary" onClick={() => setSelectedId(l.id)}>
          Payments
        </Button>
      ),
    },
  ];

  const loans = data?.loans ?? [];

  return (
    <ModulePage role="collection" title="Collection">
      <StatusTabs options={STATUSES} value={status} onChange={changeStatus} />
      {loading && !data && (
        <>
          <StatRowSkeleton count={4} />
          <TableSkeleton />
        </>
      )}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {data && (
        <>
          <StatGrid>
            <StatCard label={status === "CLOSED" ? "Closed loans" : "Active loans"} value={loans.length} />
            <StatCard label="Total repayment" value={formatMoney(sum(loans.map((l) => l.totalRepayment)))} />
            <StatCard label="Collected" value={formatMoney(sum(loans.map((l) => l.totalPaid)))} />
            <StatCard label="Outstanding" value={formatMoney(sum(loans.map((l) => l.outstanding)))} accent />
          </StatGrid>
          <DataTable columns={columns} rows={loans} getKey={(l) => l.id} emptyText={`No ${status.toLowerCase()} loans.`} />
        </>
      )}
      {selected && <PaymentPanel key={selected.id} loan={selected} onPaymentRecorded={() => reload()} />}
    </ModulePage>
  );
}

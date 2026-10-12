"use client";

import { ModulePage } from "@/components/ModulePage";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ErrorAlert } from "@/components/ui/Feedback";
import { StatRowSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { MODULES } from "@/lib/modules";
import type { Lead } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

const columns: Column<Lead>[] = [
  { header: "Name", render: (l) => <span className="font-medium">{l.name}</span> },
  { header: "Email", render: (l) => <span className="text-muted">{l.email}</span> },
  { header: "Signed up", render: (l) => formatDate(l.signedUpAt) },
  { header: "Stage", render: (l) => <StatusBadge status={l.stage} /> },
];

export default function SalesPage() {
  const { data, error, loading, reload } = useAsync(() => api.salesLeads());
  const leads = data?.leads ?? [];

  return (
    <ModulePage role="sales" title={`${MODULES.sales.label} - Leads`}>
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
            <StatCard label="Total leads" value={leads.length} accent />
            <StatCard label="Registered" value={leads.filter((l) => l.stage === "REGISTERED").length} />
            <StatCard label="Profile completed" value={leads.filter((l) => l.stage === "PROFILE_COMPLETED").length} />
            <StatCard label="Ready to apply" value={leads.filter((l) => l.stage === "SLIP_UPLOADED").length} hint="Slip uploaded" />
          </StatGrid>
          <DataTable columns={columns} rows={leads} getKey={(l) => l.id} emptyText="No leads yet." />
        </>
      )}
    </ModulePage>
  );
}

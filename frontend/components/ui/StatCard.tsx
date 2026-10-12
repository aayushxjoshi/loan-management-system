import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  // Highlights the key number with the accent colour.
  accent?: boolean;
}

export function StatCard({ label, value, hint, accent }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wider text-subtle">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums tracking-tight ${accent ? "text-accent-soft" : "text-fg"}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

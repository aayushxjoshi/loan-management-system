import type { ReactNode } from "react";
import { EmptyState } from "./Feedback";

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  emptyText?: string;
}

export function DataTable<T>({ columns, rows, getKey, emptyText = "Nothing to show." }: DataTableProps<T>) {
  if (rows.length === 0) return <EmptyState text={emptyText} />;

  return (
    <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface-raised">
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-subtle"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={getKey(row)} className="transition-colors hover:bg-surface-raised/60">
              {columns.map((col) => (
                <td key={col.header} className={`px-4 py-3.5 tabular-nums text-fg ${col.className ?? ""}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

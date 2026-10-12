import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { ALL_STAFF } from "@/lib/modules";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard roles={ALL_STAFF}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-10">{children}</main>
      </div>
    </AuthGuard>
  );
}

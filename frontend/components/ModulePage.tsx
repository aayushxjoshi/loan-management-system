"use client";

import type { ReactNode } from "react";
import { AuthGuard } from "./AuthGuard";
import { useAuth } from "./AuthProvider";
import type { Role } from "@/lib/types";

interface ModulePageProps {
  role: Role;
  title: string;
  children: ReactNode;
}

// Shared shell for each dashboard module page: role guard + top header with the page title.
export function ModulePage({ role, title, children }: ModulePageProps) {
  const { user } = useAuth();
  return (
    <AuthGuard roles={[role]}>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-subtle">Dashboard</p>
          <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">{title}</h1>
        </div>
        {user && <p className="text-sm text-muted">Signed in as {user.name}</p>}
      </header>
      {children}
    </AuthGuard>
  );
}

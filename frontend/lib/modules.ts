import type { Role } from "./types";

export interface ModuleConfig {
  label: string;
  route: string;
}

// Single source of truth: role -> module. Drives sidebar, redirects and guards.
export const MODULES: Record<Exclude<Role, "admin">, ModuleConfig> = {
  sales: { label: "Sales", route: "/dashboard/sales" },
  sanction: { label: "Sanction", route: "/dashboard/sanction" },
  disbursement: { label: "Disbursement", route: "/dashboard/disbursement" },
  collection: { label: "Collection", route: "/dashboard/collection" },
  borrower: { label: "Apply for loan", route: "/apply" },
};

const STAFF_ROLES = ["sales", "sanction", "disbursement", "collection"] as const;

export const ALL_STAFF: Role[] = ["admin", ...STAFF_ROLES];

// Modules shown in the dashboard sidebar. Admin sees all of them.
export function sidebarModules(role: Role): ModuleConfig[] {
  if (role === "admin") return STAFF_ROLES.map((r) => MODULES[r]);
  if (role === "borrower") return [];
  return [MODULES[role]];
}

// Where a user lands after login, or when sent away from a page they may not see.
export function homeRoute(role: Role): string {
  return role === "borrower" ? MODULES.borrower.route : "/dashboard";
}

// Default module inside /dashboard.
export function defaultDashboardRoute(role: Role): string {
  return sidebarModules(role)[0]?.route ?? "/login";
}

// Admin always passes.
export function canAccess(userRole: Role, allowed: Role[]): boolean {
  return userRole === "admin" || allowed.includes(userRole);
}

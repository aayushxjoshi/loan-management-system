"use client";

import { Banknote, LogOut, ShieldCheck, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { Brand } from "./ui/Brand";
import { sidebarModules } from "@/lib/modules";

const ICONS: Record<string, LucideIcon> = {
  "/dashboard/sales": Users,
  "/dashboard/sanction": ShieldCheck,
  "/dashboard/disbursement": Banknote,
  "/dashboard/collection": Wallet,
};

export function Sidebar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  if (!user) return null;

  const logout = () => {
    signOut();
    router.replace("/login");
  };

  return (
    <aside className="flex flex-col border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
      {/* Mobile: brand + logout on one row, nav scrolls below. Desktop: stacked. */}
      <div className="flex items-center justify-between px-5 py-4 md:py-6">
        <Brand />
        <button
          onClick={logout}
          aria-label="Log out"
          className="rounded-lg p-2 text-muted hover:bg-surface-raised hover:text-fg md:hidden"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <nav aria-label="Modules" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
        {sidebarModules(user.role).map((module) => {
          const active = pathname === module.route;
          const Icon = ICONS[module.route];
          return (
            <Link
              key={module.route}
              href={module.route}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                active ? "bg-accent/10 text-accent-soft" : "text-muted hover:bg-surface-raised hover:text-fg"
              }`}
            >
              {active && <span className="absolute inset-y-2 left-0 hidden w-1 rounded-full bg-accent md:block" aria-hidden />}
              {Icon && <Icon className="h-4 w-4" aria-hidden />}
              {module.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden items-center gap-3 border-t border-line p-4 md:flex">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent-soft"
          aria-hidden
        >
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 text-xs">
          <p className="truncate text-sm font-medium text-fg">{user.name}</p>
          <p className="capitalize text-subtle">{user.role}</p>
        </div>
        <button
          onClick={logout}
          aria-label="Log out"
          className="rounded-lg p-2 text-muted hover:bg-surface-raised hover:text-fg"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}

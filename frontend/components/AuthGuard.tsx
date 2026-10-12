"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { Spinner } from "./ui/Feedback";
import { canAccess, homeRoute } from "@/lib/modules";
import type { Role } from "@/lib/types";

interface AuthGuardProps {
  roles: Role[];
  children: ReactNode;
}

// Redirects anonymous users to /login and users with the wrong role to their own home.
export function AuthGuard({ roles, children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = !!user && canAccess(user.role, roles);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!allowed) router.replace(homeRoute(user.role));
  }, [loading, user, allowed, router]);

  if (loading || !allowed) return <Spinner />;
  return <>{children}</>;
}

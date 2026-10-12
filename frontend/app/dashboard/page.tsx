"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui/Feedback";
import { defaultDashboardRoute } from "@/lib/modules";

export default function DashboardIndex() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace(defaultDashboardRoute(user.role));
  }, [user, router]);

  return <Spinner />;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui/Feedback";
import { homeRoute } from "@/lib/modules";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) router.replace(user ? homeRoute(user.role) : "/login");
  }, [loading, user, router]);

  return <Spinner />;
}

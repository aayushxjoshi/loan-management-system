"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { Button } from "./ui/Button";
import { Brand, TAGLINE } from "./ui/Brand";
import { Card } from "./ui/Card";
import { ErrorAlert } from "./ui/Feedback";
import { Input } from "./ui/Input";
import { api } from "@/lib/api";
import { homeRoute } from "@/lib/modules";

// One form for both login and signup; signup just adds a name field.
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const { user, signIn } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace(homeRoute(user.role));
  }, [user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isSignup && password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      const response = isSignup ? await api.signup({ name, email, password }) : await api.login({ email, password });
      signIn(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-backdrop flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <Brand className="text-3xl" />
        <p className="mt-2 text-sm text-muted">{TAGLINE}</p>
      </div>
      <Card glow className="w-full max-w-sm">
        <h1 className="mb-5 text-xl font-semibold tracking-tight text-fg">{isSignup ? "Create your account" : "Sign in"}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />}
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <ErrorAlert message={error} />}
          <Button type="submit" loading={submitting} className="w-full">
            {isSignup ? "Sign up" : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {isSignup ? "Already have an account? " : "New here? "}
          <Link href={isSignup ? "/login" : "/signup"} className="rounded font-semibold text-accent-soft hover:underline">
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </Card>
    </main>
  );
}

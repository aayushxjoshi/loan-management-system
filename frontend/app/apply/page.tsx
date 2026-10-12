"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuth } from "@/components/AuthProvider";
import { LoanConfigStep } from "@/components/apply/LoanConfigStep";
import { LoanStatusView } from "@/components/apply/LoanStatusView";
import { PersonalDetailsStep } from "@/components/apply/PersonalDetailsStep";
import { SalarySlipStep } from "@/components/apply/SalarySlipStep";
import { Stepper } from "@/components/apply/Stepper";
import { Button } from "@/components/ui/Button";
import { Brand } from "@/components/ui/Brand";
import { ErrorAlert } from "@/components/ui/Feedback";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import type { BorrowerProfile, Loan } from "@/lib/types";

const STEP_DETAILS = 0;
const STEP_SLIP = 1;
const STEP_CONFIG = 2;
const STEP_STATUS = 3;

function ApplyFlow() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(STEP_DETAILS);
  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, loansRes] = await Promise.all([api.getProfile(), api.myLoans()]);
      setProfile(profileRes.profile);
      setLoans(loansRes.loans);
      // Existing applications go straight to the status view.
      if (loansRes.loans.length > 0) setStep(STEP_STATUS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleApplied = async () => {
    const { loans } = await api.myLoans();
    setLoans(loans);
    setStep(STEP_STATUS);
  };

  const logout = () => {
    signOut();
    router.replace("/login");
  };

  return (
    <main className="mx-auto max-w-3xl p-4 pb-16 md:p-8">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <Brand />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg md:text-3xl">Apply for a loan</h1>
        </div>
        <Button variant="secondary" onClick={logout} aria-label="Log out">
          Logout
        </Button>
      </header>

      {loading && (
        <div role="status" aria-label="Loading" className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-3xl" />
        </div>
      )}
      {error && <ErrorAlert message={error} onRetry={loadAll} />}

      {!loading && !error && (
        <>
          <Stepper current={step} />
          {step === STEP_DETAILS && (
            <PersonalDetailsStep
              existing={profile}
              onSaved={(saved) => {
                setProfile(saved);
                setStep(STEP_SLIP);
              }}
            />
          )}
          {step === STEP_SLIP && (
            <SalarySlipStep
              existing={profile?.salarySlip ?? null}
              onUploaded={setProfile}
              onContinue={() => setStep(STEP_CONFIG)}
              onBack={() => setStep(STEP_DETAILS)}
            />
          )}
          {step === STEP_CONFIG && (
            <LoanConfigStep onApplied={handleApplied} onBack={() => setStep(STEP_SLIP)} />
          )}
          {step === STEP_STATUS && <LoanStatusView loans={loans} onNewApplication={() => setStep(STEP_DETAILS)} />}
        </>
      )}
    </main>
  );
}

export default function ApplyPage() {
  return (
    <AuthGuard roles={["borrower"]}>
      <ApplyFlow />
    </AuthGuard>
  );
}

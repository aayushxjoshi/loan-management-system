"use client";

import { useState, useId } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ErrorAlert } from "../ui/Feedback";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import {
  AMOUNT_STEP,
  MAX_AMOUNT,
  MAX_TENURE_DAYS,
  MIN_AMOUNT,
  MIN_TENURE_DAYS,
  calculateRepayment,
} from "@/lib/loanMath";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-muted">
          {label}
        </label>
        <span className="text-xl font-semibold tabular-nums text-accent-soft">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--pct": `${pct}%` } as React.CSSProperties}
        className="range mt-4"
      />
      <div className="mt-2 flex justify-between text-xs tabular-nums text-subtle">
        <span>{min.toLocaleString("en-IN")}</span>
        <span>{max.toLocaleString("en-IN")}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums text-fg">{value}</span>
    </div>
  );
}

interface LoanConfigStepProps {
  onApplied: () => void;
  onBack: () => void;
}

export function LoanConfigStep({ onApplied, onBack }: LoanConfigStepProps) {
  const [amount, setAmount] = useState(100000);
  const [tenureDays, setTenureDays] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { principal, rate, interest, totalRepayment } = calculateRepayment(amount, tenureDays);

  const apply = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.applyForLoan({ amount, tenureDays });
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit application");
      setSubmitting(false);
    }
  };

  return (
    <Card title="Configure your loan">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-10">
          <Slider
            label="Loan amount"
            value={amount}
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            step={AMOUNT_STEP}
            display={formatMoney(amount)}
            onChange={setAmount}
          />
          <Slider
            label="Tenure"
            value={tenureDays}
            min={MIN_TENURE_DAYS}
            max={MAX_TENURE_DAYS}
            step={1}
            display={`${tenureDays} days`}
            onChange={setTenureDays}
          />
        </div>

        <div className="glow-card rounded-2xl border border-line p-6" aria-live="polite">
          <p className="text-xs font-medium uppercase tracking-wider text-subtle">Total repayment</p>
          <p className="mt-1 break-words text-4xl font-bold tabular-nums tracking-tight text-fg sm:text-5xl">
            {formatMoney(totalRepayment)}
          </p>
          <div className="mt-5 divide-y divide-line border-t border-line">
            <Row label="Principal" value={formatMoney(principal)} />
            <Row label="Interest rate" value={`${rate}% per year`} />
            <Row label={`Interest (${tenureDays} days)`} value={formatMoney(interest)} />
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-5">
          <ErrorAlert message={error} />
        </div>
      )}
      <div className="mt-8 flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={apply} loading={submitting}>
          Apply for loan
        </Button>
      </div>
    </Card>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { DataTable, type Column } from "./ui/DataTable";
import { ErrorAlert, SuccessAlert } from "./ui/Feedback";
import { Input } from "./ui/Input";
import { TableSkeleton } from "./ui/Skeleton";
import { useToast } from "./ui/Toast";
import { ApiError, api } from "@/lib/api";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import type { Loan, Payment } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";

const paymentColumns: Column<Payment>[] = [
  { header: "Date", render: (p) => formatDate(p.paidOn) },
  { header: "UTR", render: (p) => p.utr },
  { header: "Amount", render: (p) => formatMoney(p.amount) },
];

interface PaymentPanelProps {
  loan: Loan;
  // Called after a payment is saved so the parent can refresh the loan list.
  onPaymentRecorded: (updated: Loan) => void;
}

export function PaymentPanel({ loan, onPaymentRecorded }: PaymentPanelProps) {
  const toast = useToast();
  const payments = useAsync(() => api.loanPayments(loan.id), [loan.id]);
  const [utr, setUtr] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(todayISO());
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const { loan: updated } = await api.recordPayment(loan.id, { utr: utr.trim(), amount: Number(amount), paidOn });
      setUtr("");
      setAmount("");
      setSuccess(true);
      toast.success("Payment recorded.");
      onPaymentRecorded(updated);
      payments.reload();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Could not record payment"));
    } finally {
      setSubmitting(false);
    }
  };

  const isOpen = loan.status === "DISBURSED";
  const serverErrors = error instanceof ApiError ? error.errors : [];

  return (
    <Card title={`Payments - ${loan.profile?.fullName ?? loan.borrower?.name ?? ""}`} className="mt-6">
      <p className="mb-5 text-sm text-muted">
        Outstanding balance:{" "}
        <span className="text-xl font-semibold tabular-nums text-accent-soft">{formatMoney(loan.outstanding)}</span> of{" "}
        {formatMoney(loan.totalRepayment)}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">History</h3>
          {payments.loading && <TableSkeleton rows={3} />}
          {payments.error && <ErrorAlert message={payments.error} onRetry={payments.reload} />}
          {payments.data && (
            <DataTable
              columns={paymentColumns}
              rows={payments.data.payments}
              getKey={(p) => p.id}
              emptyText="No payments yet."
            />
          )}
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Record payment</h3>
          {isOpen ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input label="UTR" value={utr} onChange={(e) => setUtr(e.target.value)} required />
              <Input
                label="Amount"
                type="number"
                min={1}
                step="0.01"
                max={loan.outstanding}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <Input
                label="Payment date"
                type="date"
                max={todayISO()}
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                required
              />
              {error && <ErrorAlert message={error.message} errors={serverErrors} />}
              {success && <SuccessAlert message="Payment recorded." />}
              <Button type="submit" loading={submitting}>
                Record payment
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted">This loan is closed; no further payments are accepted.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

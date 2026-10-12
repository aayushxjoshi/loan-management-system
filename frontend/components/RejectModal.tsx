"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./ui/Button";
import { ErrorAlert } from "./ui/Feedback";
import { Field, Textarea } from "./ui/Input";
import { useToast } from "./ui/Toast";
import { Modal } from "./ui/Modal";
import { api } from "@/lib/api";
import type { Loan } from "@/lib/types";

interface RejectModalProps {
  loan: Loan;
  onClose: () => void;
  onRejected: () => void;
}

export function RejectModal({ loan, onClose, onRejected }: RejectModalProps) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.rejectLoan(loan.id, reason.trim());
      toast.success("Loan rejected.");
      onRejected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject");
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Reject loan for ${loan.profile?.fullName ?? loan.borrower?.name ?? "borrower"}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </Field>
        {error && <ErrorAlert message={error} />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={submitting}>
            Reject loan
          </Button>
        </div>
      </form>
    </Modal>
  );
}

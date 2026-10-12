"use client";

import { useState, type FormEvent } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ErrorAlert } from "../ui/Feedback";
import { Input, Select } from "../ui/Input";
import { ApiError, api } from "@/lib/api";
import type { BorrowerProfile, EmploymentMode } from "@/lib/types";

interface PersonalDetailsStepProps {
  existing: BorrowerProfile | null;
  onSaved: (profile: BorrowerProfile) => void;
}

export function PersonalDetailsStep({ existing, onSaved }: PersonalDetailsStepProps) {
  const [fullName, setFullName] = useState(existing?.fullName ?? "");
  const [pan, setPan] = useState(existing?.pan ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(existing?.dateOfBirth?.slice(0, 10) ?? "");
  const [monthlySalary, setMonthlySalary] = useState(existing ? String(existing.monthlySalary) : "");
  const [employmentMode, setEmploymentMode] = useState<EmploymentMode>(existing?.employmentMode ?? "SALARIED");
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { profile } = await api.saveProfile({
        fullName: fullName.trim(),
        pan: pan.trim().toUpperCase(),
        dateOfBirth,
        monthlySalary: Number(monthlySalary),
        employmentMode,
      });
      onSaved(profile);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Could not save details"));
    } finally {
      setSubmitting(false);
    }
  };

  // The server's BRE failures come back as a list of reasons; show them all.
  const reasons = error instanceof ApiError ? error.errors : [];

  return (
    <Card title="Personal details">
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input
          label="PAN"
          value={pan}
          maxLength={10}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="ABCDE1234F"
          required
        />
        <Input
          label="Date of birth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          required
        />
        <Input
          label="Monthly salary (INR)"
          type="number"
          min={0}
          value={monthlySalary}
          onChange={(e) => setMonthlySalary(e.target.value)}
          required
        />
        <Select
          label="Employment mode"
          value={employmentMode}
          onChange={(e) => setEmploymentMode(e.target.value as EmploymentMode)}
        >
          <option value="SALARIED">Salaried</option>
          <option value="SELF_EMPLOYED">Self employed</option>
          <option value="UNEMPLOYED">Unemployed</option>
        </Select>

        <div className="space-y-4 sm:col-span-2">
          {error && (
            <ErrorAlert
              message={reasons.length > 0 ? "You are not eligible for a loan because:" : error.message}
              errors={reasons}
            />
          )}
          <Button type="submit" loading={submitting}>
            Save and continue
          </Button>
        </div>
      </form>
    </Card>
  );
}

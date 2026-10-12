"use client";

import { CheckCircle2, FileText, UploadCloud } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ErrorAlert } from "../ui/Feedback";
import { api } from "@/lib/api";
import type { BorrowerProfile } from "@/lib/types";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Light client-side check; the server validates again.
function checkFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Only PDF, JPG or PNG files are allowed.";
  if (file.size > MAX_SIZE_BYTES) return "File must be 5MB or smaller.";
  return null;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface SalarySlipStepProps {
  existing: BorrowerProfile["salarySlip"];
  onUploaded: (profile: BorrowerProfile) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function SalarySlipStep({ existing, onUploaded, onContinue, onBack }: SalarySlipStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pick = (picked: File | null) => {
    setFile(null);
    const problem = picked ? checkFile(picked) : null;
    setError(problem);
    if (picked && !problem) setFile(picked);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => pick(e.target.files?.[0] ?? null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0] ?? null);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { profile } = await api.uploadSalarySlip(file);
      onUploaded(profile);
      onContinue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const zoneTone = error
    ? "border-danger/60 bg-danger/5"
    : dragging
      ? "border-accent bg-accent/10"
      : "border-line hover:border-subtle";

  return (
    <Card title="Upload salary slip">
      {existing && (
        <p className="mb-4 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Already uploaded: {existing.originalName}. Upload a new file to replace it, or continue.
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${zoneTone}`}
      >
        {file ? (
          <>
            <FileText className="h-10 w-10 text-accent-soft" aria-hidden />
            <div>
              <p className="break-all text-sm font-medium text-fg">{file.name}</p>
              <p className="text-xs tabular-nums text-muted">{formatSize(file.size)}</p>
            </div>
          </>
        ) : (
          <>
            <UploadCloud className="h-10 w-10 text-subtle" aria-hidden />
            <p className="text-sm text-fg">Drag and drop your salary slip here</p>
            <p className="text-xs text-muted">PDF, JPG or PNG, up to 5MB</p>
          </>
        )}
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          {file ? "Choose a different file" : "Browse files"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleChange}
          className="sr-only"
          aria-label="Salary slip file"
        />
      </div>

      {error && (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={upload} disabled={!file} loading={uploading}>
          Upload and continue
        </Button>
        {existing && !file && (
          <Button variant="secondary" onClick={onContinue}>
            Keep existing and continue
          </Button>
        )}
      </div>
    </Card>
  );
}

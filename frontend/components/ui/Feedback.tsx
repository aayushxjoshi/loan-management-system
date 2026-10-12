import { AlertCircle, CheckCircle2, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

// Small centered spinner; lists use skeletons instead (see Skeleton.tsx).
export function Spinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {text}
    </div>
  );
}

interface ErrorAlertProps {
  message: string;
  errors?: string[];
  onRetry?: () => void;
}

// Shows a message plus an optional bullet list (used for server BRE errors).
export function ErrorAlert({ message, errors = [], onRetry }: ErrorAlertProps) {
  return (
    <div role="alert" className="flex gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-sm text-danger">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{message}</p>
        {errors.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-danger/90">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}
        {onRetry && (
          <button onClick={onRetry} className="mt-2 rounded font-semibold underline">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function SuccessAlert({ message }: { message: string }) {
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3.5 text-sm text-success"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function EmptyState({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised text-subtle">
        <Inbox className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}

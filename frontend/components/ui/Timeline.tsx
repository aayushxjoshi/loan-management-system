import { Check, X } from "lucide-react";

export interface TimelineStep {
  label: string;
  description?: string;
  state: "done" | "current" | "upcoming" | "failed";
}

const DOT: Record<TimelineStep["state"], string> = {
  done: "border-accent bg-accent text-accent-fg",
  current: "border-accent bg-accent/15 text-accent-soft",
  upcoming: "border-line bg-surface text-subtle",
  failed: "border-danger bg-danger/15 text-danger",
};

// Vertical timeline; the line below a step is filled once the step is done.
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={step.label}
            className="relative flex gap-4 pb-6 last:pb-0"
            aria-current={step.state === "current" ? "step" : undefined}
          >
            {!last && (
              <span
                className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${step.state === "done" ? "bg-accent" : "bg-line"}`}
                aria-hidden
              />
            )}
            <span className={`z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${DOT[step.state]}`}>
              {step.state === "done" && <Check className="h-4 w-4" aria-hidden />}
              {step.state === "failed" && <X className="h-4 w-4" aria-hidden />}
              {step.state === "current" && <span className="h-2 w-2 rounded-full bg-accent-soft" aria-hidden />}
            </span>
            <div className="pt-0.5">
              <p className={`text-sm font-medium ${step.state === "upcoming" ? "text-subtle" : "text-fg"}`}>{step.label}</p>
              {step.description && <p className="text-xs text-muted">{step.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

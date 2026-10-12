import { Check } from "lucide-react";

export const APPLY_STEPS = ["Personal details", "Salary slip", "Loan configuration", "Status"];

// Numbered steps joined by a progress line that fills as the user advances.
export function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex" aria-label="Application progress">
      {APPLY_STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const circle = done
          ? "border-accent bg-accent text-accent-fg"
          : active
            ? "border-accent bg-accent/15 text-accent-soft"
            : "border-line bg-surface text-subtle";
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-2 text-center"
          >
            {index > 0 && (
              <span
                className={`absolute left-[-50%] top-4 h-0.5 w-full -translate-y-1/2 ${index <= current ? "bg-accent" : "bg-line"}`}
                aria-hidden
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${circle}`}
            >
              {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
            </span>
            <span className={`text-xs ${active ? "font-semibold text-fg" : "text-subtle"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

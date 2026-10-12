// Soft tinted pill per status; colours come from the theme tokens.
const TONES = {
  info: "bg-info/10 text-info ring-info/25",
  warning: "bg-warning/10 text-warning ring-warning/25",
  danger: "bg-danger/10 text-danger ring-danger/25",
  success: "bg-success/10 text-success ring-success/25",
  accent: "bg-accent/15 text-accent-soft ring-accent/30",
  neutral: "bg-fg/5 text-muted ring-fg/10",
};

const STATUS_TONES: Record<string, keyof typeof TONES> = {
  APPLIED: "info",
  SANCTIONED: "warning",
  REJECTED: "danger",
  DISBURSED: "accent",
  CLOSED: "success",
  REGISTERED: "neutral",
  PROFILE_COMPLETED: "warning",
  SLIP_UPLOADED: "success",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[STATUS_TONES[status] ?? "neutral"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {status.replace(/_/g, " ")}
    </span>
  );
}

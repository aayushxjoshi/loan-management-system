import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg shadow-glow hover:brightness-110",
  secondary: "border border-line bg-surface-raised text-fg hover:border-subtle",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
  ghost: "text-muted hover:bg-surface-raised hover:text-fg",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({ variant = "primary", loading, disabled, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {loading ? "Please wait..." : children}
    </button>
  );
}

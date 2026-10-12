import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const FIELD_CLASSES =
  "mt-1.5 block w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-fg placeholder:text-subtle transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";

interface FieldProps {
  label: string;
  children: ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <label className="block text-sm font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Input({ label, className = "", ...rest }: InputProps) {
  return (
    <Field label={label}>
      <input className={`${FIELD_CLASSES} ${className}`} {...rest} />
    </Field>
  );
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASSES} ${className}`} {...rest} />;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function Select({ label, children, ...rest }: SelectProps) {
  return (
    <Field label={label}>
      <select className={FIELD_CLASSES} {...rest}>
        {children}
      </select>
    </Field>
  );
}

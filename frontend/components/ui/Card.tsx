import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  // Adds the accent glow used on hero cards.
  glow?: boolean;
}

export function Card({ title, children, className = "", glow }: CardProps) {
  const surface = glow ? "glow-card" : "bg-surface";
  return (
    <section className={`rounded-3xl border border-line p-6 shadow-card ${surface} ${className}`}>
      {title && <h2 className="mb-5 text-lg font-semibold tracking-tight text-fg">{title}</h2>}
      {children}
    </section>
  );
}

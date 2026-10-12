export const TAGLINE = "Fast, fair loans. Zero paperwork drama.";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xl font-bold tracking-tight text-fg ${className}`}>
      <span className="h-3 w-3 rounded-md bg-accent shadow-glow" aria-hidden />
      LMS
    </span>
  );
}

import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      to="/"
      className={cn("flex items-center gap-3 text-fg no-underline", className)}
      aria-label="RealSync Runtime — Start"
    >
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#111418" />
        <path d="M8 16H24" stroke="#3EC8E0" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M16 6.5L24.5 16L16 25.5L7.5 16L16 6.5Z" stroke="#EEEAE2" strokeWidth="1.4" />
        <circle cx="16" cy="16" r="2.1" fill="#3EC8E0" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-medium tracking-[0.18em] text-[11px]">REALSYNC</span>
        {!compact ? (
          <span className="mt-0.5 text-[9px] tracking-[0.22em] text-muted">RUNTIME</span>
        ) : null}
      </span>
    </Link>
  );
}

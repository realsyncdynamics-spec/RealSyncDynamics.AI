import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "critical";
  children: ReactNode;
}) {
  const tones = {
    neutral: "text-muted shadow-[0_0_0_1px_rgba(238,234,226,0.12)]",
    accent: "text-accent shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_40%,transparent)]",
    success: "text-success shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-success)_40%,transparent)]",
    warning: "text-warning shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-warning)_40%,transparent)]",
    critical: "text-critical shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-critical)_40%,transparent)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

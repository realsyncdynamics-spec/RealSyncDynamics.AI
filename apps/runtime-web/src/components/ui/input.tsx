import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md bg-elevated px-3.5 text-sm text-fg placeholder:text-subtle shadow-[0_0_0_1px_rgba(238,234,226,0.12)] outline-none transition-[box-shadow] duration-150 focus:shadow-[0_0_0_1px_var(--color-accent)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md bg-elevated px-3.5 py-3 text-sm text-fg placeholder:text-subtle shadow-[0_0_0_1px_rgba(238,234,226,0.12)] outline-none transition-[box-shadow] duration-150 focus:shadow-[0_0_0_1px_var(--color-accent)]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("block text-xs font-medium uppercase tracking-[0.14em] text-muted", className)}
      {...props}
    />
  );
}

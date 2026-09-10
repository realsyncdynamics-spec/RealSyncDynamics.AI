import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap select-none rounded-sm outline-none transition-[background-color,color,box-shadow,opacity,transform] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-fg text-bg hover:bg-fg/90 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]",
        accent:
          "bg-accent text-accent-fg hover:bg-accent/90",
        outline:
          "bg-transparent text-fg shadow-[0_0_0_1px_rgba(238,234,226,0.16)] hover:bg-elevated",
        ghost: "bg-transparent text-muted hover:text-fg hover:bg-elevated",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-[15px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

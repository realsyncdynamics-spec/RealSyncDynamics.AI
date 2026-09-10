import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("relative px-5 py-20 md:px-8 md:py-28 lg:px-12", className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-accent">{children}</p>
  );
}

export function SectionHead({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">{title}</h2>
      {copy ? <p className="mt-4 text-base leading-relaxed text-muted">{copy}</p> : null}
    </div>
  );
}

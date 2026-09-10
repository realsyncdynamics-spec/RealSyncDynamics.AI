import { useState } from "react";
import { X } from "lucide-react";
import { Eyebrow } from "@/components/layout/section";
import { runtimeLayers } from "@/data/runtime";
import { cn } from "@/lib/utils";

export function RuntimeDiagram() {
  const [active, setActive] = useState(runtimeLayers[0].id);
  const layer = runtimeLayers.find((l) => l.id === active) ?? runtimeLayers[0];

  return (
    <section id="runtime" className="relative px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <Eyebrow>Architektur</Eyebrow>
          <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
            Eine Control Plane. Jedes System.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
            RealSync Runtime macht heterogene Systeme zu gesteuerten, beobachtbaren und auditierbaren
            Umgebungen. Wählen Sie eine Schicht.
          </p>
          <ol className="mt-8 space-y-1">
            {runtimeLayers.map((l, i) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setActive(l.id)}
                  onMouseEnter={() => setActive(l.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-[background-color,color] duration-150",
                    active === l.id ? "bg-elevated text-fg" : "text-muted hover:bg-surface hover:text-fg",
                  )}
                  aria-current={active === l.id}
                >
                  <span className="w-6 font-mono text-[10px] text-subtle">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-sm">{l.label}</span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full bg-accent transition-opacity duration-150",
                      active === l.id ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                    )}
                  />
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative overflow-hidden rounded-xl bg-surface p-6 shadow-[0_0_0_1px_rgba(238,234,226,0.08)] md:p-8">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-subtle">Schichtdetail</p>
          <h3 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-fg">{layer.label}</h3>
          <p className="mt-2 text-sm text-muted">{layer.summary}</p>
          <p className="mt-5 text-sm leading-relaxed text-fg/85">{layer.detail}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {layer.signals.map((s) => (
              <li
                key={s}
                className="rounded-sm px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-accent)_28%,transparent)]"
              >
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-8 flex items-start gap-2 text-xs text-subtle">
            <X className="mt-0.5 size-3 shrink-0 opacity-0" aria-hidden />
            Klick oder Hover auf eine Schicht. Pfade leuchten, während sich die Runtime von Systemen
            zum Nachweis zusammenfügt.
          </p>
        </div>
      </div>
    </section>
  );
}

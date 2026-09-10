import { useMemo, useState } from "react";
import { Eyebrow } from "@/components/layout/section";
import { Badge } from "@/components/ui/badge";
import {
  connectorCategories,
  connectors,
  type ConnectorStatus,
} from "@/data/content";
import { cn } from "@/lib/utils";

const statusLabel: Record<ConnectorStatus, string> = {
  available: "Verfügbar",
  coming: "In Kürze",
  custom: "Custom Connector",
};

const statusTone: Record<ConnectorStatus, "success" | "neutral" | "accent"> = {
  available: "success",
  coming: "neutral",
  custom: "accent",
};

export function ConnectorGrid({ compact = false }: { compact?: boolean }) {
  const [cat, setCat] = useState<string>("Alle");
  const filtered = useMemo(
    () => (cat === "Alle" ? connectors : connectors.filter((c) => c.category === cat)),
    [cat],
  );

  return (
    <section id="connectors" className={cn(!compact && "px-5 py-20 md:px-8 md:py-28 lg:px-12")}>
      <div className={cn(!compact && "mx-auto max-w-6xl")}>
        <Eyebrow>Konnektoren</Eyebrow>
        <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          Binden Sie die Systeme an, die Sie schon betreiben.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Native Integration wird nur behauptet, wo der Status „Verfügbar“ lautet. Alles andere steht
          auf der Roadmap oder kommt als Custom Connector.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {["Alle", ...connectorCategories].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={cn(
                "h-9 rounded-sm px-3 text-xs transition-colors duration-150",
                cat === c
                  ? "bg-fg text-bg"
                  : "text-muted shadow-[0_0_0_1px_rgba(238,234,226,0.12)] hover:text-fg",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((c) => (
            <li
              key={c.name}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface px-4 py-4 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
            >
              <div>
                <p className="text-sm text-fg">{c.name}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                  {c.category}
                </p>
              </div>
              <Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

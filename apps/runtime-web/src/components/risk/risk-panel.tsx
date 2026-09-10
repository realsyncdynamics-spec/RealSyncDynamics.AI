import { Eyebrow } from "@/components/layout/section";
import { cn } from "@/lib/utils";

const dimensions = [
  { name: "Betrieb", score: 38, trend: "stabil" },
  { name: "Sicherheit", score: 61, trend: "steigend" },
  { name: "Datenschutz", score: 22, trend: "fallend" },
  { name: "KI", score: 68, trend: "steigend" },
  { name: "Compliance", score: 44, trend: "stabil" },
  { name: "Zuverlässigkeit", score: 29, trend: "fallend" },
];

export function RiskPanel() {
  return (
    <section id="risk" className="border-y border-border bg-panel px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <Eyebrow>Risk Engine</Eyebrow>
        <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
          Risiko ist ein lebender Systemzustand.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Beispielscores. Hover über eine Dimension zeigt den Druck der beitragenden Signale. Bewegung
          bleibt bewusst zurückhaltend.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Stat label="Risiko-Score" value="61" hint="gesamt" />
            <Stat label="Risikotrend" value="+4" hint="1 Std." />
            <Stat label="Aktive Controls" value="128" hint="gebunden" />
            <Stat label="Offene Incidents" value="2" hint="hoch" />
            <Stat label="Policy-Verstöße" value="4" hint="24 Std." />
          </aside>
          <ul className="grid gap-3 sm:grid-cols-2">
            {dimensions.map((d) => (
              <li
                key={d.name}
                className="group rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]"
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-sm text-fg">{d.name}</p>
                  <p className="font-mono text-sm tabular-nums text-fg">{d.score}</p>
                </div>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-steel">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500 ease-out",
                      d.score >= 60 ? "bg-warning" : d.score >= 40 ? "bg-accent" : "bg-success",
                    )}
                    style={{ width: `${d.score}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  Beitragende Signale: Ereigniscluster, Policy-Treffer, Incident-Gewicht. Trend {d.trend}.
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-surface px-4 py-3 shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums text-fg">{value}</p>
      <p className="text-[10px] text-muted">{hint}</p>
    </div>
  );
}

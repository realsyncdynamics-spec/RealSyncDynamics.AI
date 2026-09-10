import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Eyebrow } from "@/components/layout/section";
import { AppLink } from "@/components/ui/app-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dashboardKpis, simEvents } from "@/data/simulation";

const spark = [
  { x: 1, y: 22 },
  { x: 2, y: 28 },
  { x: 3, y: 24 },
  { x: 4, y: 36 },
  { x: 5, y: 32 },
  { x: 6, y: 44 },
  { x: 7, y: 40 },
  { x: 8, y: 52 },
];

const toneMap = {
  success: "success" as const,
  warning: "warning" as const,
  critical: "critical" as const,
  neutral: "neutral" as const,
};

export function DashboardPreview() {
  return (
    <section id="dashboard" className="border-y border-border bg-panel px-5 py-20 md:px-8 md:py-28 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Dashboard-Vorschau</Eyebrow>
            <h2 className="text-3xl font-medium tracking-[-0.03em] text-fg md:text-4xl">
              Operative Oberfläche
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
              Beispieldaten eines Fertigungs- und KI-Mandanten. Klar als Demo gekennzeichnet.
            </p>
          </div>
          <Button variant="outline" asChild>
            <AppLink to="/dashboard">Vollständige Vorschau</AppLink>
          </Button>
        </div>

        <div className="mt-8 overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">
              Mandant · sample-fertigung-01
            </p>
            <Badge tone="warning">Demo / Beispieldaten</Badge>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-6">
            {dashboardKpis.map((k) => (
              <div key={k.label} className="bg-surface px-4 py-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">{k.label}</p>
                <p className="mt-1 font-mono text-xl tabular-nums text-fg">{k.value}</p>
                <Badge tone={toneMap[k.tone]} className="mt-2">
                  {k.tone === "success" ? "stabil" : k.tone === "warning" ? "warnung" : k.tone === "critical" ? "kritisch" : "neutral"}
                </Badge>
              </div>
            ))}
          </div>
          <div className="grid gap-px bg-border lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Ereignisvolumen · 8 Std.
              </p>
              <div className="mt-3 h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spark}>
                    <defs>
                      <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3EC8E0" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3EC8E0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="y"
                      stroke="#3EC8E0"
                      fill="url(#spark)"
                      strokeWidth={1.4}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Aktuelle Policy-Ereignisse
              </p>
              <ul className="mt-3 space-y-2">
                {simEvents.slice(0, 4).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-fg">{e.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-subtle">{e.id}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

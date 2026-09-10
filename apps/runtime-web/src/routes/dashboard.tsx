import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { EvidenceTimeline } from "@/components/evidence/evidence-timeline";
import { PageHero } from "@/components/layout/page-hero";
import { RiskPanel } from "@/components/risk/risk-panel";
import { LiveSimulation } from "@/components/runtime/live-simulation";
import { dashboardKpis, decisionLabel, simEvents } from "@/data/simulation";

const spark = [
  { x: 1, y: 18 },
  { x: 2, y: 24 },
  { x: 3, y: 21 },
  { x: 4, y: 33 },
  { x: 5, y: 29 },
  { x: 6, y: 41 },
  { x: 7, y: 38 },
  { x: 8, y: 49 },
  { x: 9, y: 44 },
  { x: 10, y: 56 },
];

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Dashboard-Vorschau — RealSync Runtime" }],
  }),
});

function DashboardPage() {
  return (
    <main id="main">
      <PageHero
        eyebrow="Operative Oberfläche"
        title="Runtime-Leitstand"
        copy="Beispieldaten eines hybriden Fertigungs- und KI-Mandanten. Jede Kennzahl ist Demo."
        image="/images/console.jpg"
      />
      <section className="px-5 py-10 md:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_rgba(238,234,226,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
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
              </div>
            ))}
          </div>
          <div className="grid gap-px bg-border lg:grid-cols-2">
            <div className="bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Ereignisvolumen
              </p>
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spark}>
                    <defs>
                      <linearGradient id="spark2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3EC8E0" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3EC8E0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="y"
                      stroke="#3EC8E0"
                      fill="url(#spark2)"
                      strokeWidth={1.4}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-surface p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-subtle">
                Nachweis-Zeitlinie
              </p>
              <ul className="mt-3 space-y-2">
                {simEvents.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                    <span>
                      <span className="block text-fg">{e.title}</span>
                      <span className="font-mono text-[10px] text-subtle">
                        {e.time} · {e.id}
                      </span>
                    </span>
                    <Badge tone={e.decision === "allow" ? "success" : e.decision === "hold" ? "warning" : "critical"}>
                      {decisionLabel[e.decision]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
      <LiveSimulation />
      <RiskPanel />
      <EvidenceTimeline />
      <CopilotPanel />
    </main>
  );
}

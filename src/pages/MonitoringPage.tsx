import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import { RUNTIME_MOCK_EVENTS, KIND_COLOR, KIND_LABEL } from '../lib/runtimeMockEvents';
import { Activity, Cpu, ShieldCheck, AlertTriangle } from 'lucide-react';

// MonitoringPage — live runtime feed.
// Streaming terminal of mock events + aggregate counters that tick up as
// events arrive. Static data; the page simulates a live system at rest.

const KIND_FILTERS = ['all', 'scan', 'drift', 'ai', 'consent', 'evidence', 'incident', 'agent'] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

export function MonitoringPage() {
  usePageMeta({
    title: 'Monitoring — Live Runtime Feed | RealSync',
    description: 'Live runtime monitoring: streaming events, drift detection, AI classification, evidence anchoring.',
    url: 'https://RealSyncDynamicsAI.de/monitoring',
  });

  const [shown, setShown] = useState(0);
  const [filter, setFilter] = useState<KindFilter>('all');

  useEffect(() => {
    if (shown >= RUNTIME_MOCK_EVENTS.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 200 : 220);
    return () => clearTimeout(t);
  }, [shown]);

  const events = RUNTIME_MOCK_EVENTS.slice(0, shown).filter(
    (e) => filter === 'all' || e.kind === filter,
  );

  const counters = {
    scan:     events.filter((e) => e.kind === 'scan').length,
    drift:    events.filter((e) => e.kind === 'drift').length,
    ai:       events.filter((e) => e.kind === 'ai').length,
    consent:  events.filter((e) => e.kind === 'consent').length,
    evidence: events.filter((e) => e.kind === 'evidence').length,
    incident: events.filter((e) => e.kind === 'incident').length,
    agent:    events.filter((e) => e.kind === 'agent').length,
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="pt-14">
        <header className="border-b border-titanium-900 px-4 sm:px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
              monitoring · live runtime
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
              Every signal, in the order it happened.
            </h1>
            <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              The monitoring surface is the system's own log. Detection, classification, agent actions
              and evidence anchors stream in real time and never go silent.
            </p>
          </div>
        </header>

        <section className="px-4 sm:px-6 py-12 bg-obsidian-950 border-b border-titanium-900">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px bg-titanium-900">
            <StatTile icon={<Activity className="h-3.5 w-3.5 text-cyan-300" />} label="scans" value={counters.scan} tone="text-cyan-300" />
            <StatTile icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />} label="drift events" value={counters.drift} tone="text-amber-300" />
            <StatTile icon={<Cpu className="h-3.5 w-3.5 text-violet-300" />} label="ai" value={counters.ai} tone="text-violet-300" />
            <StatTile icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />} label="evidence" value={counters.evidence} tone="text-emerald-300" />
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-20">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {KIND_FILTERS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={[
                    'px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider border transition-colors',
                    filter === k
                      ? 'bg-cyan-400 text-obsidian-950 border-cyan-400'
                      : 'bg-obsidian-900 text-titanium-300 border-titanium-800 hover:border-titanium-600',
                  ].join(' ')}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="bg-obsidian-950 border border-titanium-900">
              <header className="flex items-center justify-between px-3 py-2 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500/70" />
                    <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
                  </span>
                  runtime.log
                </span>
                <span className="text-cyan-300 inline-flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-3 bg-cyan-300 motion-safe:animate-pulse" />
                  streaming
                </span>
              </header>
              <div className="font-mono text-[11px] leading-relaxed p-4 max-h-[60vh] overflow-y-auto">
                {events.map((e, i) => (
                  <div
                    key={`${e.ts}-${i}`}
                    className="flex items-start gap-3 py-0.5 border-b border-titanium-900/40 last:border-b-0"
                  >
                    <span className="text-titanium-600 shrink-0 tabular-nums w-12">{e.ts}</span>
                    <span className={`shrink-0 font-bold w-6 ${KIND_COLOR[e.kind]}`}>{e.short}</span>
                    <span className="text-titanium-200 min-w-0 flex-1">
                      <span className={`mr-1 ${KIND_COLOR[e.kind]}`}>{KIND_LABEL[e.kind]}</span>
                      · {e.text}
                      {e.target && <span className="ml-1.5 text-titanium-500">→ {e.target}</span>}
                    </span>
                  </div>
                ))}
                {shown < RUNTIME_MOCK_EVENTS.length && (
                  <div className="mt-1 text-titanium-600">
                    <span className="inline-block w-2 h-3 bg-cyan-300 align-middle motion-safe:animate-pulse" />
                  </div>
                )}
              </div>
              <footer className="px-3 py-2 border-t border-titanium-900 bg-obsidian-900 font-mono text-[10px] text-titanium-500 flex items-center justify-between">
                <span>{events.length} / {RUNTIME_MOCK_EVENTS.length} events</span>
                <span className="text-emerald-400">● chain sealed</span>
              </footer>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatTile({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="bg-obsidian-950 p-5">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-2">
        {icon}
        {label}
      </div>
      <div className={`font-display font-semibold text-3xl tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

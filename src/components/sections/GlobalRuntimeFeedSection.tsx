import { useEffect, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useSyntheticRuntimeStream } from '../../hooks/useSyntheticRuntimeStream';
import {
  KIND_COLOR,
  KIND_LABEL,
  SEVERITY_COLOR,
  type SyntheticRuntimeEvent,
} from '../../lib/syntheticRuntimeEvents';

// GlobalRuntimeFeedSection — "Events continuously happen."
//
// Demo terminal feed: rolling synthetic event-stream with current
// timestamps + 3 right-side aggregate counters that tick up as events
// flow. Demo-labelled throughout; no backend, no telemetry, no API.
// See `useSyntheticRuntimeStream` for the rotating event pool.

export function GlobalRuntimeFeedSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();
  const { events, isRunning } = useSyntheticRuntimeStream({
    minDelay: 1500,
    maxDelay: 3200,
    maxEvents: 40,
    autoStart: inView,
  });
  const feedRef = useRef<HTMLDivElement>(null);

  // Nur den internen Feed-Container scrollen, nicht die Seite.
  // scrollIntoView würde alle scroll-ancestors verschieben → page-jump.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const counters = {
    detect:   events.filter((e) => e.kind === 'scan' || e.kind === 'consent').length,
    drift:    events.filter((e) => e.kind === 'drift' || e.kind === 'incident').length,
    ai:       events.filter((e) => e.kind === 'ai').length,
    evidence: events.filter((e) => e.kind === 'evidence').length,
    agents:   events.filter((e) => e.kind === 'agent').length,
  };

  return (
    <section
      ref={ref}
      aria-label="Global runtime event feed"
      className="bg-obsidian-950 border-b border-titanium-900 py-20 sm:py-28 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            03 · überwachen
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            Events laufen kontinuierlich.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Jeder Scan, jede Drift-Erkennung, jede Agenten-Aktion und jeder Evidence-Anchor landet im globalen Runtime-Feed.
            Keine Dashboards zum Aktualisieren. Das System meldet seinen Zustand selbst.
          </p>
          <p className="mt-3 text-[11px] font-mono uppercase tracking-wider text-titanium-500">
            ⚠ Simulierte Telemetrie — keine Live-Produktionsdaten
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-px bg-titanium-900">
          {/* Terminal feed */}
          <div className="bg-obsidian-950 flex flex-col min-h-[440px]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500/70" />
                  <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
                </span>
                runtime.log · demo
              </span>
              <span className="text-cyan-300 inline-flex items-center gap-1.5">
                <span className={`inline-block h-1.5 w-3 bg-cyan-300 ${isRunning && !reduce ? 'animate-pulse' : 'opacity-40'}`} />
                {isRunning ? 'demo-streaming' : 'demo · paused'}
              </span>
            </div>
            <div ref={feedRef} className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
              {events.length === 0 ? (
                <div className="text-titanium-600 italic">demo stream warming up…</div>
              ) : (
                events.map((e) => <FeedRow key={e.id} event={e} reduce={!!reduce} />)
              )}
              {!reduce && isRunning && (
                <div className="mt-1 text-titanium-600">
                  <span className="inline-block w-2 h-3 bg-cyan-300 align-middle animate-pulse" />
                </div>
              )}
            </div>
            <div className="px-4 py-2 border-t border-titanium-900 bg-obsidian-900 font-mono text-[10px] text-titanium-500 flex items-center justify-between">
              <span>{events.length} / 40 demo events</span>
              <span className="text-emerald-400">● chain sealed (demo)</span>
            </div>
          </div>

          {/* Aggregate counters */}
          <div className="bg-obsidian-950 flex flex-col">
            <div className="px-4 py-2.5 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              by kind · demo session
            </div>
            <div className="grid grid-rows-5 divide-y divide-titanium-900 flex-1">
              <CounterRow label="detect"   value={counters.detect}   color="text-cyan-300" />
              <CounterRow label="drift"    value={counters.drift}    color="text-amber-300" />
              <CounterRow label="ai"       value={counters.ai}       color="text-violet-300" />
              <CounterRow label="evidence" value={counters.evidence} color="text-emerald-300" />
              <CounterRow label="agents"   value={counters.agents}   color="text-titanium-100" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeedRow({ event, reduce }: { event: SyntheticRuntimeEvent; reduce: boolean }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 py-0.5 border-b border-titanium-900/40 last:border-b-0"
    >
      <span className="text-titanium-600 shrink-0 tabular-nums">{event.ts}</span>
      <span className={`shrink-0 font-bold ${SEVERITY_COLOR[event.severity]}`}>
        {event.severity.toUpperCase()}
      </span>
      <span className="text-titanium-200 min-w-0">
        <span className={`mr-1 ${KIND_COLOR[event.kind]}`}>{KIND_LABEL[event.kind]}</span>
        · {event.rule_id}
        {event.detail && <span className="ml-1.5 text-titanium-500">→ {event.detail}</span>}
      </span>
    </motion.div>
  );
}

function CounterRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <span className="font-mono text-[11px] uppercase tracking-wider text-titanium-400">{label}</span>
      <span className={`font-display font-semibold text-2xl tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

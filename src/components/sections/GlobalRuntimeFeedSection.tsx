import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import {
    RUNTIME_MOCK_EVENTS,
    KIND_COLOR,
    KIND_LABEL,
    SEVERITY_COLOR,
    type RuntimeEvent,
} from '../../lib/runtimeMockEvents';

// GlobalRuntimeFeedSection — "Events continuously happen."
// Step 3: Runtime-Feed now renders real rule_id + severity + HH:MM:SS timestamps
// instead of T+Xs placeholders. The terminal mimics what the scanner engine
// actually emits: rule.cookie.reject_button → warning, evidence.sha256.sealed, etc.
// Once the in-view stream has played once it stays at its final state (no looping noise).

const ROLLING_INTERVAL_MS = 220;

export function GlobalRuntimeFeedSection() {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, amount: 0.15 });
    const reduce = useReducedMotion();
    const [shown, setShown] = useState<RuntimeEvent[]>(reduce ? [...RUNTIME_MOCK_EVENTS] : []);
    const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
        if (!inView || reduce) return;
        if (shown.length >= RUNTIME_MOCK_EVENTS.length) return;
        const t = setTimeout(() => {
                setShown((prev) => [...prev, RUNTIME_MOCK_EVENTS[prev.length]]);
        }, shown.length === 0 ? 250 : ROLLING_INTERVAL_MS);
        return () => clearTimeout(t);
  }, [inView, reduce, shown]);

  useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [shown.length]);

  // Aggregate counters update as events arrive.
  const counters = {
        detect:   shown.filter((e) => e.kind === 'scan' || e.kind === 'consent').length,
        drift:    shown.filter((e) => e.kind === 'drift' || e.kind === 'incident').length,
        ai:       shown.filter((e) => e.kind === 'ai').length,
        evidence: shown.filter((e) => e.kind === 'evidence').length,
        agents:   shown.filter((e) => e.kind === 'agent').length,
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
                                            03 · monitor
                                </div>
                                <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
                                            Events continuously happen.
                                </h2>
                                <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                                            Each scan, each drift detection, each agent action and each evidence anchor lands on the global runtime feed.
                                            No dashboards to refresh. The system reports its own state.
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
                                                                          runtime.log · live
                                                          </span>
                                                          <span className="text-cyan-300 inline-flex items-center gap-1.5">
                                                                          <span className="inline-block h-1.5 w-3 bg-cyan-300 animate-pulse" />
                                                                          streaming
                                                          </span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
                                              {shown.map((e, i) => (
                                <motion.div
                                                    key={`${e.ts}-${i}`}
                                                    initial={reduce ? false : { opacity: 0, x: -6 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="flex items-start gap-2 py-0.5 border-b border-titanium-900/40 last:border-b-0"
                                                  >
                                  {/* HH:MM:SS timestamp */}
                                                  <span className="text-titanium-600 shrink-0 tabular-nums">[{e.ts}]</span>
                                  {/* kind badge */}
                                                  <span className={`shrink-0 font-bold ${KIND_COLOR[e.kind]}`}>
                                                    {KIND_LABEL[e.kind]}
                                                  </span>
                                  {/* rule_id → severity */}
                                                  <span className="text-titanium-300 min-w-0 truncate">
                                                                      <span className="text-titanium-100">{e.rule_id}</span>
                                                                      <span className="text-titanium-600 mx-1">→</span>
                                                                      <span className={SEVERITY_COLOR[e.severity]}>{e.severity}</span>
                                                    {e.detail && (
                                                                          <span className="ml-1.5 text-titanium-500">· {e.detail}</span>
                                                                      )}
                                                  </span>
                                </motion.div>motion.div>
                              ))}
                                                          <div ref={bottomRef} />
                                              {!reduce && shown.length < RUNTIME_MOCK_EVENTS.length && (
                                <div className="mt-1 text-titanium-600">
                                                  <span className="inline-block w-2 h-3 bg-cyan-300 align-middle animate-pulse" />
                                </div>
                                                          )}
                                            </div>
                                            <div className="px-4 py-2 border-t border-titanium-900 bg-obsidian-900 font-mono text-[10px] text-titanium-500 flex items-center justify-between">
                                                          <span>{shown.length} / {RUNTIME_MOCK_EVENTS.length} events</span>
                                                          <span className="text-emerald-400">● chain sealed</span>
                                            </div>
                                </div>
                      
                        {/* Aggregate counters */}
                                <div className="bg-obsidian-950 flex flex-col">
                                            <div className="px-4 py-2.5 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                                                          by kind · last 24h
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

function CounterRow({ label, value, color }: { label: string; value: number; color: string }) {
    return (
          <div className="flex items-center justify-between px-4 py-4">
                <span className="font-mono text-[11px] uppercase tracking-wider text-titanium-400">{label}</span>
                <span className={`font-display font-semibold text-2xl tabular-nums ${color}`}>{value}</span>
          </div>
        );
}</section>

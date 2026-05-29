import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Activity, Cpu, ShieldCheck } from 'lucide-react';
import { useSyntheticRuntimeStream } from '../../hooks/useSyntheticRuntimeStream';
import { KIND_COLOR, KIND_LABEL, SEVERITY_COLOR } from '../../lib/syntheticRuntimeEvents';

const NODES = [
  { x: 160, y: 120, r: 22, color: 'cyan' as const, pulse: 2.4 },
  { x: 380, y: 220, r: 28, color: 'cyan' as const },
  { x: 540, y: 110, r: 20, color: 'violet' as const },
  { x: 820, y: 180, r: 34, color: 'cyan' as const, pulse: 2.8 },
  { x: 980, y: 80, r: 18, color: 'violet' as const },
  { x: 280, y: 430, r: 24, color: 'cyan' as const },
  { x: 540, y: 500, r: 40, color: 'violet' as const, pulse: 3.2 },
  { x: 780, y: 430, r: 26, color: 'emerald' as const },
  { x: 1020, y: 500, r: 22, color: 'cyan' as const },
  { x: 540, y: 640, r: 20, color: 'violet' as const },
];

const EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7], [7, 8],
  [6, 9], [9, 7], [6, 1], [3, 7], [0, 5], [8, 4],
];

const FILL_BY_COLOR = {
  cyan: 'url(#node-cyan)',
  violet: 'url(#node-violet)',
  emerald: 'url(#node-emerald)',
} as const;

const PULSE_BY_COLOR = {
  cyan: '#22d3ee',
  violet: '#a855f7',
  emerald: '#10b981',
} as const;

export function RuntimeCanvasSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion();
  
  const { events, isRunning } = useSyntheticRuntimeStream({
    minDelay: 1500,
    maxDelay: 3200,
    maxEvents: 24,
    autoStart: inView && !reduce,
  });

  return (
    <section
      ref={ref}
      aria-label="Runtime Canvas"
      className="relative bg-gradient-to-b from-obsidian-950 via-obsidian-900 to-obsidian-950 border-y border-titanium-900 py-20 sm:py-28 px-4 sm:px-6 overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        <SectionHead />

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4 lg:gap-5 mt-10">
          <GraphPane active={inView} reduce={!!reduce} />

          <div className="grid grid-rows-[auto_1fr] gap-4 lg:gap-5">
            <CountersPane events={events} active={inView} reduce={!!reduce} />
            <TerminalPane events={events} isRunning={isRunning} active={inView} reduce={!!reduce} />
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHead() {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
        02 · Runtime Canvas
      </div>
      <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
        Die Runtime liest eine Site in Echtzeit.
      </h2>
      <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
        Browser-Layer, Network-Layer und AI-Layer — alle annotiert, während sie passieren,
        und in die Evidence-Chain versiegelt, sobald sie abgeschlossen sind.
      </p>
      <p className="mt-3 text-[11px] font-mono text-titanium-600 tracking-wide">
        ⚠ Simulierte Telemetrie — keine Live-Produktionsdaten
      </p>
    </div>
  );
}

function GraphPane({ active, reduce }: { active: boolean; reduce: boolean }) {
  return (
    <Pane title="governance-graph · demo" badge={<span className="text-emerald-400">● Demo-Daten</span>}>
      <div className="aspect-[1200/700] w-full bg-gradient-to-br from-obsidian-950 to-obsidian-900 relative">
        <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            {(['cyan', 'violet', 'emerald'] as const).map((c) => (
              <radialGradient key={c} id={`node-${c}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={PULSE_BY_COLOR[c]} stopOpacity="0.9" />
                <stop offset="100%" stopColor={PULSE_BY_COLOR[c]} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          <g stroke="#1a2030" strokeWidth="1">
            {EDGES.map(([a, b], i) => {
              const A = NODES[a];
              const B = NODES[b];
              return (
                <motion.line
                  key={i}
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                  animate={active && !reduce ? { pathLength: 1, opacity: 1 } : { pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.04 }}
                />
              );
            })}
          </g>

          <g>
            {NODES.map((n, i) => (
              <motion.circle
                key={i}
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={FILL_BY_COLOR[n.color]}
                initial={reduce ? false : { opacity: 0, scale: 0.5 }}
                animate={active ? { opacity: 1, scale: 1 } : reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.5, delay: 0.6 + i * 0.05 }}
                style={{ transformOrigin: `${n.x}px ${n.y}px` }}
              />
            ))}
            {!reduce && NODES.filter((n) => n.pulse).map((n, i) => (
              <circle key={`pulse-${i}`} cx={n.x} cy={n.y} r={3} fill={PULSE_BY_COLOR[n.color]}>
                <animate attributeName="r" values="3;7;3" dur={`${n.pulse}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.3;1" dur={`${n.pulse}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        </svg>

        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-titanium-500">
          10 assets · 14 edges · EU-Frankfurt
        </div>
      </div>
    </Pane>
  );
}

function CountersPane({ events, active, reduce }: { events: any[]; active: boolean; reduce: boolean }) {
  const counters = {
    scans: events.filter(e => e.kind === 'scan').length,
    drifts: events.filter(e => e.kind === 'drift' || e.kind === 'incident').length,
    ai: events.filter(e => e.kind === 'ai').length,
    evidence: events.filter(e => e.kind === 'evidence').length,
  };

  return (
    <Pane title="signals · last 24h" badge={<span className="text-titanium-400">Demo-Runtime · simuliert</span>}>
      <div className="grid grid-cols-2 gap-px bg-titanium-900">
        <MetricTile label="scans" value={counters.scans} icon={<Activity className="h-3.5 w-3.5 text-cyan-300" />} highlight />
        <MetricTile label="drift events" value={counters.drifts} icon={<Activity className="h-3.5 w-3.5 text-amber-300" />} />
        <MetricTile label="AI systems" value={counters.ai} icon={<Cpu className="h-3.5 w-3.5 text-violet-300" />} />
        <MetricTile label="evidence" value={counters.evidence} icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />} />
      </div>
    </Pane>
  );
}

function MetricTile({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="bg-obsidian-950 p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-2">
        {icon}
        {label}
      </div>
      <div className={`font-display font-semibold text-2xl sm:text-3xl tabular-nums ${highlight ? 'text-cyan-300' : 'text-titanium-50'}`}>
        {value}
      </div>
      {highlight && <div className="text-[10px] font-mono text-emerald-400 mt-0.5">▲ Beispieldaten</div>}
    </div>
  );
}

function TerminalPane({ events, isRunning, active, reduce }: { events: any[]; isRunning: boolean; active: boolean; reduce: boolean }) {
  return (
    <Pane title="event-stream · demo" badge={<span className="text-cyan-300">{isRunning ? '▮ Demo-Runtime' : '⊘ paused'}</span>}>
      <div className="bg-obsidian-950 font-mono text-[11px] leading-relaxed p-3 overflow-y-auto max-h-[300px] lg:max-h-none lg:h-full">
        {events.length === 0 ? (
          <div className="text-titanium-600">Waiting for first event...</div>
        ) : (
          events.map((e, i) => (
            <motion.div
              key={`${e.id}`}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22 }}
              className="flex items-start gap-3 py-0.5 border-b border-titanium-900/40 last:border-b-0"
            >
              <span className="text-titanium-600 shrink-0 tabular-nums">{e.ts}</span>
              <span className={`shrink-0 font-bold ${KIND_COLOR[e.kind]}`}>{KIND_LABEL[e.kind]}</span>
              <span className="text-titanium-200 min-w-0">
                <span className="text-titanium-100">{e.rule_id}</span>
                <span className="mx-1 text-titanium-600">→</span>
                <span className={SEVERITY_COLOR[e.severity]}>{e.severity}</span>
                {e.detail && <span className="ml-1.5 text-titanium-500">· {e.detail}</span>}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </Pane>
  );
}

function Pane({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-titanium-900 bg-obsidian-950 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        <div className="flex items-center gap-2">
          <span className="inline-flex gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500/70" />
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500/70" />
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/70" />
          </span>
          <span>{title}</span>
        </div>
        {badge && <div className="font-mono text-[10px]">{badge}</div>}
      </div>
      {children}
    </div>
  );
}

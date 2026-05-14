import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Activity, Cpu, ShieldCheck } from 'lucide-react';
import { RUNTIME_MOCK_EVENTS, KIND_COLOR, KIND_LABEL } from '../../lib/runtimeMockEvents';

// Interactive runtime canvas — homepage second-fold "the system is already
// running" moment. SVG governance-graph on the left, counters + scrolling
// terminal feed on the right.
//
// All data is static (runtimeMockEvents). Motion is decorative: counters
// count up once on first in-view, terminal lines reveal with a stagger.
// `useReducedMotion` is honoured throughout.

const NODES: Array<{ x: number; y: number; r: number; color: 'cyan' | 'violet' | 'emerald'; pulse?: number }> = [
  { x: 160,  y: 120, r: 22, color: 'cyan',    pulse: 2.4 },
  { x: 380,  y: 220, r: 28, color: 'cyan' },
  { x: 540,  y: 110, r: 20, color: 'violet' },
  { x: 820,  y: 180, r: 34, color: 'cyan',    pulse: 2.8 },
  { x: 980,  y: 80,  r: 18, color: 'violet' },
  { x: 280,  y: 430, r: 24, color: 'cyan' },
  { x: 540,  y: 500, r: 40, color: 'violet', pulse: 3.2 },
  { x: 780,  y: 430, r: 26, color: 'emerald' },
  { x: 1020, y: 500, r: 22, color: 'cyan' },
  { x: 540,  y: 640, r: 20, color: 'violet' },
];

const EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7], [7, 8],
  [6, 9], [9, 7], [6, 1], [3, 7], [0, 5], [8, 4],
];

const FILL_BY_COLOR = {
  cyan:    'url(#node-cyan)',
  violet:  'url(#node-violet)',
  emerald: 'url(#node-emerald)',
} as const;

const PULSE_BY_COLOR = {
  cyan:    '#22d3ee',
  violet:  '#a855f7',
  emerald: '#10b981',
} as const;

export function RuntimeCanvasSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduce = useReducedMotion();

  return (
    <section
      ref={ref}
      aria-label="Runtime Canvas"
      className="relative bg-gradient-to-b from-obsidian-950 via-obsidian-900 to-obsidian-950 border-y border-titanium-900 py-20 sm:py-28 px-4 sm:px-6 overflow-hidden"
    >
      {/* subtle grid backdrop */}
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
            <CountersPane active={inView} reduce={!!reduce} />
            <TerminalPane active={inView} reduce={!!reduce} />
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
        Watch the runtime read a site in real time.
      </h2>
      <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
        Browser-Layer, Network-Layer und AI-Layer — alle annotiert, während sie passieren,
        und in die Evidence-Chain versiegelt, sobald sie abgeschlossen sind.
      </p>
    </div>
  );
}

// ── Graph pane ────────────────────────────────────────────────────────────────

function GraphPane({ active, reduce }: { active: boolean; reduce: boolean }) {
  return (
    <Pane title="governance-graph · live" badge={<span className="text-emerald-400">● synced</span>}>
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

          {/* edges */}
          <g stroke="#1a2030" strokeWidth="1">
            {EDGES.map(([a, b], i) => {
              const A = NODES[a]; const B = NODES[b];
              return (
                <motion.line
                  key={i}
                  x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                  animate={active && !reduce ? { pathLength: 1, opacity: 1 } : { pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.1 + i * 0.04 }}
                />
              );
            })}
          </g>

          {/* nodes */}
          <g>
            {NODES.map((n, i) => (
              <motion.circle
                key={i}
                cx={n.x} cy={n.y} r={n.r}
                fill={FILL_BY_COLOR[n.color]}
                initial={reduce ? false : { opacity: 0, scale: 0.5 }}
                animate={active ? { opacity: 1, scale: 1 } : reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.5, delay: 0.6 + i * 0.05 }}
                style={{ transformOrigin: `${n.x}px ${n.y}px` }}
              />
            ))}
            {/* SMIL pulse dots — independent of motion lib, but disabled under reduced-motion via CSS */}
            {!reduce && NODES.filter((n) => n.pulse).map((n, i) => (
              <circle key={`pulse-${i}`} cx={n.x} cy={n.y} r={3} fill={PULSE_BY_COLOR[n.color]}>
                <animate attributeName="r" values="3;7;3" dur={`${n.pulse}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.3;1" dur={`${n.pulse}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        </svg>

        {/* corner caption */}
        <div className="absolute bottom-3 left-3 text-[10px] font-mono text-titanium-500">
          10 assets · 14 edges · EU-Frankfurt
        </div>
      </div>
    </Pane>
  );
}

// ── Counters pane ─────────────────────────────────────────────────────────────

interface CounterDef {
  label: string;
  to: number;
  fmt?: (n: number) => string;
  icon: React.ReactNode;
  highlight?: boolean;
}

const COUNTERS: CounterDef[] = [
  { label: 'scans',                to: 1248, icon: <Activity className="h-3.5 w-3.5 text-cyan-300" />, highlight: true },
  { label: 'drift events',         to: 93,   icon: <Activity className="h-3.5 w-3.5 text-amber-300" /> },
  { label: 'AI systems classified', to: 17,  icon: <Cpu className="h-3.5 w-3.5 text-violet-300" /> },
  { label: 'evidence anchored',    to: 4128, icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> },
];

function CountersPane({ active, reduce }: { active: boolean; reduce: boolean }) {
  return (
    <Pane title="signals · last 24h" badge={<span className="text-titanium-400">delta = live</span>}>
      <div className="grid grid-cols-2 gap-px bg-titanium-900">
        {COUNTERS.map((c) => (
          <div key={c.label} className="bg-obsidian-950 p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-titanium-500 mb-2">
              {c.icon}
              {c.label}
            </div>
            <div className={`font-display font-semibold text-2xl sm:text-3xl tabular-nums ${c.highlight ? 'text-cyan-300' : 'text-titanium-50'}`}>
              <CountUp to={c.to} active={active} reduce={reduce} />
            </div>
            {c.highlight && (
              <div className="text-[10px] font-mono text-emerald-400 mt-0.5">▲ live</div>
            )}
          </div>
        ))}
      </div>
    </Pane>
  );
}

function CountUp({ to, active, reduce }: { to: number; active: boolean; reduce: boolean }) {
  const [n, setN] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) { setN(to); return; }
    if (!active) return;
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduce, to]);

  return <span>{n.toLocaleString('de-DE')}</span>;
}

// ── Terminal feed ─────────────────────────────────────────────────────────────

function TerminalPane({ active, reduce }: { active: boolean; reduce: boolean }) {
  const [revealed, setRevealed] = useState(reduce ? RUNTIME_MOCK_EVENTS.length : 0);

  useEffect(() => {
    if (reduce) { setRevealed(RUNTIME_MOCK_EVENTS.length); return; }
    if (!active) return;
    if (revealed >= RUNTIME_MOCK_EVENTS.length) return;
    const t = setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? 200 : 180);
    return () => clearTimeout(t);
  }, [active, reduce, revealed]);

  return (
    <Pane title="event-stream · runtime.log" badge={<span className="text-cyan-300">▮ streaming</span>}>
      <div className="bg-obsidian-950 font-mono text-[11px] leading-relaxed p-3 overflow-y-auto max-h-[300px] lg:max-h-none lg:h-full">
        {RUNTIME_MOCK_EVENTS.slice(0, revealed).map((e, i) => (
          <motion.div
            key={`${e.ts}-${i}`}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22 }}
            className="flex items-start gap-3 py-0.5 border-b border-titanium-900/40 last:border-b-0"
          >
            <span className="text-titanium-600 shrink-0 tabular-nums">{e.ts}</span>
            <span className={`shrink-0 font-bold ${KIND_COLOR[e.kind]}`}>{e.short}</span>
            <span className="text-titanium-200 min-w-0">
              <span className={`mr-1 ${KIND_COLOR[e.kind]}`}>{KIND_LABEL[e.kind]}</span>
              · {e.text}
              {e.target && (
                <span className="ml-1.5 text-titanium-500">→ {e.target}</span>
              )}
            </span>
          </motion.div>
        ))}
        {revealed > 0 && revealed < RUNTIME_MOCK_EVENTS.length && (
          <div className="text-titanium-600 mt-1">
            <span className="inline-block w-2 h-3 bg-cyan-300 align-middle animate-pulse" />
          </div>
        )}
      </div>
    </Pane>
  );
}

// ── Shared pane shell ─────────────────────────────────────────────────────────

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

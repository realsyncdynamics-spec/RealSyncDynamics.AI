import { useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

// GovernanceGraphSection — visual layer of the AI Governance Operating
// System. Mocks a graph of relationships between AI systems, policies,
// evidence, controls and agents. Pure SVG, fully static data, no backend.

export type GraphNodeKind = 'ai_system' | 'policy' | 'evidence' | 'control' | 'agent';

interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  x: number;
  y: number;
  pulse?: boolean;
}

const NODES: readonly GraphNode[] = [
  // AI systems
  { id: 'ai-1', kind: 'ai_system', label: 'chatbot-v2',       x: 200, y: 140 },
  { id: 'ai-2', kind: 'ai_system', label: 'lead-scoring',     x: 360, y: 220 },
  { id: 'ai-3', kind: 'ai_system', label: 'recommender',      x: 540, y: 110, pulse: true },
  { id: 'ai-4', kind: 'ai_system', label: 'doc-summariser',   x: 720, y: 200 },
  { id: 'ai-5', kind: 'ai_system', label: 'risk-classifier',  x: 900, y: 130 },

  // Policies
  { id: 'pol-1', kind: 'policy', label: 'consent-v2',         x: 140, y: 360 },
  { id: 'pol-2', kind: 'policy', label: 'data-retention-90',  x: 540, y: 360 },
  { id: 'pol-3', kind: 'policy', label: 'ai-act-annex-iii',   x: 940, y: 360 },

  // Evidence
  { id: 'ev-1', kind: 'evidence', label: 'audit-bundle 04-26', x: 300, y: 480 },
  { id: 'ev-2', kind: 'evidence', label: 'sealed-chain · 4.1k', x: 540, y: 540, pulse: true },
  { id: 'ev-3', kind: 'evidence', label: 'eu-ai-act-pack',     x: 780, y: 480 },

  // Controls
  { id: 'ctl-1', kind: 'control', label: 'pre-consent-block', x: 240, y: 280 },
  { id: 'ctl-2', kind: 'control', label: 'pii-redaction',     x: 440, y: 280 },
  { id: 'ctl-3', kind: 'control', label: 'output-disclaimer', x: 640, y: 280 },
  { id: 'ctl-4', kind: 'control', label: 'human-in-the-loop', x: 840, y: 280 },

  // Agents
  { id: 'ag-1', kind: 'agent', label: 'drift-agent',     x:  80, y: 200, pulse: true },
  { id: 'ag-2', kind: 'agent', label: 'evidence-agent',  x:  80, y: 480 },
  { id: 'ag-3', kind: 'agent', label: 'policy-agent',    x: 1020, y: 480 },
];

const EDGES: readonly [string, string][] = [
  // ai → control
  ['ai-1', 'ctl-1'], ['ai-1', 'ctl-2'],
  ['ai-2', 'ctl-2'], ['ai-2', 'ctl-3'],
  ['ai-3', 'ctl-3'], ['ai-3', 'ctl-4'],
  ['ai-4', 'ctl-3'],
  ['ai-5', 'ctl-4'],
  // control → policy
  ['ctl-1', 'pol-1'],
  ['ctl-2', 'pol-2'],
  ['ctl-3', 'pol-3'],
  ['ctl-4', 'pol-3'],
  // policy → evidence
  ['pol-1', 'ev-1'],
  ['pol-2', 'ev-2'],
  ['pol-3', 'ev-3'],
  // agent → control
  ['ag-1', 'ctl-1'], ['ag-1', 'ctl-2'],
  ['ag-2', 'ev-1'], ['ag-2', 'ev-2'], ['ag-2', 'ev-3'],
  ['ag-3', 'pol-1'], ['ag-3', 'pol-2'], ['ag-3', 'pol-3'],
];

const KIND_STYLE: Record<GraphNodeKind, { fill: string; stroke: string; tone: string; label: string }> = {
  ai_system: { fill: '#1e1b4b', stroke: '#a855f7', tone: 'text-violet-300',  label: 'ai system' },
  policy:    { fill: '#082f49', stroke: '#22d3ee', tone: 'text-cyan-300',    label: 'policy' },
  evidence:  { fill: '#022c22', stroke: '#10b981', tone: 'text-emerald-300', label: 'evidence' },
  control:   { fill: '#451a03', stroke: '#f59e0b', tone: 'text-amber-300',   label: 'control' },
  agent:     { fill: '#0f172a', stroke: '#e5e7eb', tone: 'text-titanium-100', label: 'agent' },
};

const KINDS: GraphNodeKind[] = ['ai_system', 'policy', 'evidence', 'control', 'agent'];

export function GovernanceGraphSection({ headless = false }: { headless?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState<GraphNode | null>(null);

  const isDimmed = (id: string) => {
    if (!hovered) return false;
    if (hovered.id === id) return false;
    // Don't dim direct neighbours
    const neighbours = EDGES.flatMap(([a, b]) => (a === hovered.id ? [b] : b === hovered.id ? [a] : []));
    return !neighbours.includes(id);
  };

  return (
    <section
      ref={ref}
      aria-label="Governance graph"
      className="bg-obsidian-950 border-b border-titanium-900 py-16 sm:py-24 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        {!headless && (
          <div className="max-w-3xl mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
              graph · governance topology
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
              Every AI system maps to a policy, a control, an agent, an evidence chain.
            </h2>
            <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              The governance graph keeps the runtime honest. AI systems point at the controls that constrain them,
              the controls point at the policies that authorise them, every step writes evidence, and agents keep
              the graph in sync.
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {KINDS.map((k) => {
            const s = KIND_STYLE[k];
            return (
              <span
                key={k}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 border border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider ${s.tone}`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: s.stroke, boxShadow: `0 0 8px ${s.stroke}` }}
                />
                {s.label}
              </span>
            );
          })}
        </div>

        {/* Graph canvas */}
        <div className="relative bg-obsidian-950 border border-titanium-900 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-titanium-900 bg-obsidian-900 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
            <span className="flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500/70" />
                <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
              </span>
              governance.graph · live
            </span>
            <span className="text-emerald-400">{NODES.length} nodes · {EDGES.length} edges</span>
          </div>

          <div className="relative">
            <svg viewBox="0 0 1100 620" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
              <defs>
                {KINDS.map((k) => (
                  <radialGradient key={k} id={`graph-${k}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={KIND_STYLE[k].stroke} stopOpacity="0.6" />
                    <stop offset="100%" stopColor={KIND_STYLE[k].stroke} stopOpacity="0" />
                  </radialGradient>
                ))}
              </defs>

              {/* edges */}
              <g stroke="#1a2030" strokeWidth="1" fill="none">
                {EDGES.map(([a, b], i) => {
                  const A = NODES.find((n) => n.id === a);
                  const B = NODES.find((n) => n.id === b);
                  if (!A || !B) return null;
                  const isHovered = !!hovered && (hovered.id === a || hovered.id === b);
                  return (
                    <motion.line
                      key={i}
                      x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                      initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                      animate={inView ? { pathLength: 1, opacity: isHovered ? 1 : 0.5 } : (reduce ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 })}
                      transition={{ duration: 0.6, delay: 0.05 + i * 0.03 }}
                      stroke={isHovered ? KIND_STYLE[A.kind].stroke : '#1a2030'}
                      strokeWidth={isHovered ? 1.5 : 1}
                    />
                  );
                })}
              </g>

              {/* nodes */}
              <g>
                {NODES.map((n, i) => {
                  const s = KIND_STYLE[n.kind];
                  const isThisHovered = hovered?.id === n.id;
                  const dimmed = isDimmed(n.id);
                  return (
                    <motion.g
                      key={n.id}
                      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                      animate={inView ? { opacity: dimmed ? 0.25 : 1, scale: 1 } : (reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 })}
                      transition={{ duration: 0.45, delay: 0.5 + i * 0.04 }}
                      style={{ transformOrigin: `${n.x}px ${n.y}px`, cursor: 'pointer' }}
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {/* glow halo */}
                      <circle cx={n.x} cy={n.y} r={32} fill={`url(#graph-${n.kind})`} />
                      {/* node */}
                      <circle
                        cx={n.x} cy={n.y}
                        r={isThisHovered ? 13 : 10}
                        fill={s.fill}
                        stroke={s.stroke}
                        strokeWidth={2}
                      />
                      {/* pulse dot */}
                      {!reduce && n.pulse && (
                        <circle cx={n.x} cy={n.y} r={3} fill={s.stroke}>
                          <animate attributeName="r" values="3;7;3" dur="2.6s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="1;0.2;1" dur="2.6s" repeatCount="indefinite" />
                        </circle>
                      )}
                      {/* label */}
                      <text
                        x={n.x}
                        y={n.y + 26}
                        textAnchor="middle"
                        className="fill-titanium-300 font-mono"
                        style={{ fontSize: 11 }}
                      >
                        {n.label}
                      </text>
                    </motion.g>
                  );
                })}
              </g>
            </svg>

            {/* Hover panel */}
            {hovered && (
              <div className="absolute top-2 right-2 px-3 py-2 bg-obsidian-950 border border-titanium-700 font-mono text-[11px] text-titanium-100 shadow-2xl">
                <div className={`text-[10px] uppercase tracking-wider ${KIND_STYLE[hovered.kind].tone} mb-0.5`}>
                  {KIND_STYLE[hovered.kind].label}
                </div>
                <div>{hovered.label}</div>
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-titanium-900 bg-obsidian-900 font-mono text-[10px] text-titanium-500">
            hover any node → highlight its relationships · every edge is replayable from the evidence chain
          </div>
        </div>
      </div>
    </section>
  );
}

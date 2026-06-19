/**
 * FloatingGovernanceLabels — Glassmorphism-Overlay über der 3D-Erde.
 *
 * Exakt nach Design-Zielbild: fünf dunkel-transluzente Governance-Karten
 * (DSGVO · Risk Score · EU AI Act · Evidence · Monitoring) mit Teal-Akzent,
 * dazu dezente „User-Nodes" (Personen-Icons) mit Verbindungspunkten rund um
 * die Erde. HTML-Text (kein Canvas) → lesbar & accessible. Auf kleinen
 * Viewports werden Karten reduziert/ausgeblendet.
 */
import { motion, useReducedMotion } from 'motion/react';
import { User } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

/** Live hochzählender Evidence-Zähler (Beispiel-Telemetrie, „Nachweise"). */
function useEvidenceCount(start = 1248): string {
  const [n, setN] = useState(start);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => v + 1 + Math.floor(Math.random() * 3)), 2600);
    return () => window.clearInterval(id);
  }, []);
  return n.toLocaleString('de-DE');
}

interface LabelDef {
  id: string;
  title: string;
  value: ReactNode;
  /** Position in % der Bühne. */
  pos: { top?: string; bottom?: string; left?: string; right?: string };
  /** Auf Mobile/Tablet ausblenden? */
  hideSm?: boolean;
}

function buildLabels(evidence: string): LabelDef[] {
  return [
    { id: 'dsgvo', title: 'DSGVO', value: 'Compliance', pos: { top: '14%', left: '44%' } },
    { id: 'risk', title: 'Risk Score', value: (<span><span className="text-2xl font-bold tabular-nums text-titanium-50">87</span><span className="ml-1 text-titanium-500">/100</span></span>), pos: { top: '36%', right: '-2%' } },
    { id: 'aiact', title: 'EU AI Act', value: <span className="font-semibold text-petrol-300">READY</span>, pos: { top: '58%', right: '-4%' }, hideSm: true },
    { id: 'evidence', title: 'Evidence', value: (<span><span className="text-lg font-bold tabular-nums text-titanium-50">{evidence}</span><span className="ml-1.5 text-[11px] text-titanium-500">Nachweise</span></span>), pos: { top: '62%', left: '2%' } },
    { id: 'monitoring', title: 'Monitoring', value: 'live-wave', pos: { bottom: '6%', left: '38%' }, hideSm: true },
  ];
}

// User-Nodes (Personen-Icons) — Skalierungs-Idee „globale Nutzer".
const NODES: Array<{ top?: string; bottom?: string; left?: string; right?: string; hideSm?: boolean }> = [
  { top: '40%', left: '40%' },
  { top: '52%', left: '30%', hideSm: true },
  { top: '46%', right: '8%' },
  { top: '70%', right: '14%', hideSm: true },
  { top: '74%', left: '46%' },
  { bottom: '14%', left: '52%', hideSm: true },
];

function Waveform() {
  return (
    <svg viewBox="0 0 80 16" className="h-4 w-20 text-petrol-300" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 8 H14 L18 2 L24 14 L30 5 L34 8 H44 L48 3 L54 13 L58 8 H80" />
    </svg>
  );
}

function GlassCard({ def, index, reduce }: { def: LabelDef; index: number; reduce: boolean | null }) {
  return (
    <motion.div
      className={`absolute z-20 ${def.hideSm ? 'hidden lg:block' : ''}`}
      style={def.pos}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={reduce ? undefined : { opacity: 1, y: [0, -6, 0] }}
      transition={reduce ? undefined : { opacity: { duration: 0.6, delay: 0.3 + index * 0.1 }, y: { duration: 5 + index, repeat: Infinity, ease: 'easeInOut' } }}
    >
      <div className="rounded-xl border border-white/10 bg-obsidian-900/70 px-3.5 py-2.5 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-petrol-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.6)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-petrol-200">{def.title}</span>
        </div>
        <div className="mt-1 text-sm text-titanium-300">
          {def.value === 'live-wave' ? (
            <span className="flex items-center gap-2"><Waveform /><span className="text-titanium-400">Live</span></span>
          ) : (
            def.value
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function FloatingGovernanceLabels() {
  const reduce = useReducedMotion();
  const evidence = useEvidenceCount();
  const labels = buildLabels(evidence);
  return (
    <div className="pointer-events-none absolute inset-0">
      {labels.map((def, i) => (
        <GlassCard key={def.id} def={def} index={i} reduce={reduce} />
      ))}

      {NODES.map((pos, i) => (
        <motion.span
          key={`node-${i}`}
          className={`absolute z-10 grid h-7 w-7 place-items-center rounded-full border border-petrol-400/40 bg-obsidian-900/60 backdrop-blur-md ${pos.hideSm ? 'hidden lg:grid' : ''}`}
          style={pos}
          initial={reduce ? false : { opacity: 0 }}
          animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
          transition={reduce ? undefined : { duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <User className="h-3.5 w-3.5 text-petrol-300" />
        </motion.span>
      ))}
    </div>
  );
}

export default FloatingGovernanceLabels;

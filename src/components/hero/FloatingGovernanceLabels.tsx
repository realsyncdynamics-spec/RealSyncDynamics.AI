/**
 * FloatingGovernanceLabels — Glassmorphism-HUD über der 3D-Erde.
 *
 * Premium-„Command Center"-Karten nach Design-Zielbild: DSGVO (Compliance
 * aktiv), Risk Score 87/100 mit Sparkline, EU AI Act Ready (Check),
 * Evidence mit Equalizer + Live-Zähler, Monitoring Live mit Sparkline.
 * Dazu User-Nodes (globale Nutzer) entlang der Orbits. Reines HTML über der
 * Canvas (lesbar, accessible), responsive reduziert.
 */
import { motion, useReducedMotion } from 'motion/react';
import { ShieldCheck, FileText, Activity, Archive, Check, Plus, User } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

const CARD =
  'rounded-xl border border-[rgba(72,255,226,0.18)] bg-[rgba(8,18,22,0.62)] shadow-[0_10px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl';

// ── Mini-Charts ──────────────────────────────────────────────────────

function Sparkline({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 120 34" className="h-8 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2FFFE0" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#2FFFE0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 26 L18 22 L36 24 L54 15 L72 18 L90 8 L108 6 L120 3 L120 34 L0 34 Z" fill={`url(#${id})`} />
      <path d="M0 26 L18 22 L36 24 L54 15 L72 18 L90 8 L108 6 L120 3" fill="none" stroke="#2FFFE0" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Equalizer() {
  const bars = [10, 18, 8, 22, 14, 26, 16, 24, 12, 20, 9, 17];
  return (
    <svg viewBox="0 0 120 34" className="h-8 w-full" preserveAspectRatio="none">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 10 + 1}
          y={34 - h}
          width="6"
          height={h}
          rx="1"
          fill={i % 3 === 0 ? '#2FFFE0' : 'rgba(47,255,224,0.45)'}
        />
      ))}
    </svg>
  );
}

// ── Live-Zähler ──────────────────────────────────────────────────────

function useEvidenceCount(start = 1248): string {
  const [n, setN] = useState(start);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => v + 1 + Math.floor(Math.random() * 3)), 2600);
    return () => window.clearInterval(id);
  }, []);
  return n.toLocaleString('de-DE');
}

// ── Karten-Definition ────────────────────────────────────────────────

interface CardPos { top?: string; bottom?: string; left?: string; right?: string }

function Card({
  pos, index, reduce, hideSm, children,
}: { pos: CardPos; index: number; reduce: boolean | null; hideSm?: boolean; children: ReactNode }) {
  return (
    <motion.div
      className={`absolute z-20 w-[180px] ${hideSm ? 'hidden lg:block' : ''}`}
      style={pos}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={reduce ? undefined : { opacity: 1, y: [0, -6, 0] }}
      transition={reduce ? undefined : { opacity: { duration: 0.6, delay: 0.3 + index * 0.1 }, y: { duration: 5 + index, repeat: Infinity, ease: 'easeInOut' } }}
    >
      <div className={`${CARD} px-3.5 py-3`}>{children}</div>
    </motion.div>
  );
}

function CardHeader({ Icon, label, corner }: { Icon: typeof ShieldCheck; label: string; corner?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-petrol-200">
        <Icon className="h-3.5 w-3.5 text-petrol-300" /> {label}
      </span>
      {corner}
    </div>
  );
}

const NODES: Array<CardPos & { hideSm?: boolean }> = [
  { top: '40%', left: '36%' },
  { top: '52%', left: '26%', hideSm: true },
  { top: '30%', right: '6%' },
  { top: '64%', right: '10%', hideSm: true },
  { top: '78%', left: '44%' },
  { bottom: '10%', right: '20%', hideSm: true },
  { top: '48%', right: '2%' },
];

export function FloatingGovernanceLabels() {
  const reduce = useReducedMotion();
  const evidence = useEvidenceCount();

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* DSGVO */}
      <Card pos={{ top: '15%', left: '8%' }} index={0} reduce={reduce}>
        <CardHeader Icon={ShieldCheck} label="DSGVO" />
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-titanium-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
          Compliance aktiv
        </p>
      </Card>

      {/* RISK SCORE */}
      <Card pos={{ top: '13%', right: '0%' }} index={1} reduce={reduce}>
        <CardHeader Icon={Activity} label="Risk Score" corner={<Plus className="h-3.5 w-3.5 text-titanium-500" />} />
        <p className="mt-1.5">
          <span className="text-2xl font-bold tabular-nums text-titanium-50">87</span>
          <span className="ml-1 text-sm text-titanium-500">/ 100</span>
        </p>
        <p className="text-[11px] text-petrol-300">Sehr gut</p>
        <div className="mt-1.5"><Sparkline id="rs-spark" /></div>
      </Card>

      {/* EU AI ACT */}
      <Card pos={{ top: '46%', right: '-2%' }} index={2} reduce={reduce} hideSm>
        <CardHeader Icon={FileText} label="EU AI Act" corner={<span className="grid h-5 w-5 place-items-center rounded-full border border-petrol-400/50"><Check className="h-3 w-3 text-petrol-300" /></span>} />
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-petrol-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready
        </p>
      </Card>

      {/* EVIDENCE */}
      <Card pos={{ top: '64%', left: '4%' }} index={3} reduce={reduce}>
        <CardHeader Icon={Archive} label="Evidence" />
        <p className="mt-1.5 text-xl font-bold tabular-nums text-titanium-50">{evidence}</p>
        <p className="text-[11px] text-titanium-500">Nachweise</p>
        <div className="mt-1.5"><Equalizer /></div>
      </Card>

      {/* MONITORING */}
      <Card pos={{ bottom: '7%', right: '4%' }} index={4} reduce={reduce} hideSm>
        <CardHeader Icon={Activity} label="Monitoring" />
        <p className="mt-1 text-lg font-bold text-titanium-50">Live</p>
        <p className="text-[11px] text-titanium-500">Systeme aktiv: 128</p>
        <div className="mt-1.5"><Sparkline id="mon-spark" /></div>
      </Card>

      {/* User-Nodes */}
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

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Cpu, ShieldCheck, ScrollText, Bot, ArrowRight, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

// GovernanceAgentsSection — "AI systems are governed operationally."
// Four agent cards arranged as a control plane: drift, ai-classifier,
// evidence-writer, policy. Each card has a live status indicator, runtime
// usage counter and a one-line description. No CTA per card; activation
// happens in the RuntimeActivationSection.

interface AgentCard {
  id: 'drift' | 'classifier' | 'evidence' | 'policy';
  icon: React.ReactNode;
  name: string;
  role: string;
  blurb: string;
  metrics: { label: string; value: string; tone: 'cyan' | 'amber' | 'violet' | 'emerald' }[];
  status: 'demo' | 'idle';
}

const AGENTS: readonly AgentCard[] = [
  {
    id: 'drift',
    icon: <Activity className="h-4 w-4" />,
    name: 'website-drift-agent',
    role: 'detect · monitor',
    blurb: 'Überwacht Sites auf neue Tracker, Header-Regressionen und Banner-Dark-Pattern-Verschiebungen. Eröffnet bei Regression einen Incident inklusive Diff.',
    metrics: [
      { label: 'runs / h',    value: '4.2', tone: 'cyan' },
      { label: 'open inc.',   value: '12',  tone: 'amber' },
    ],
    status: 'demo',
  },
  {
    id: 'classifier',
    icon: <Cpu className="h-4 w-4" />,
    name: 'ai-risk-agent',
    role: 'govern',
    blurb: 'Klassifiziert entdeckte KI-Endpoints gegen AI Act Anhang III. Erzeugt Risikoprofil und Use-Case-Registry-Eintrag.',
    metrics: [
      { label: 'classified', value: '17', tone: 'violet' },
      { label: 'high-risk',  value: '3',  tone: 'amber' },
    ],
    status: 'demo',
  },
  {
    id: 'evidence',
    icon: <ShieldCheck className="h-4 w-4" />,
    name: 'evidence-agent',
    role: 'automate',
    blurb: 'Hasht jedes Finding, signiert und verankert es in der Evidence-Chain. Erzeugt Audit-Bundles auf Anforderung für Procurement.',
    metrics: [
      { label: 'sealed',     value: '4,128', tone: 'emerald' },
      { label: 'last anchor', value: '3 s',   tone: 'emerald' },
    ],
    status: 'demo',
  },
  {
    id: 'policy',
    icon: <ScrollText className="h-4 w-4" />,
    name: 'policy-agent',
    role: 'govern · automate',
    blurb: 'Entwirft §13-Updates, AVV-Deltas und Policy-Snippets pro Finding. Routet Diff via Slack, E-Mail oder Webhook an den Owner.',
    metrics: [
      { label: 'drafts / w', value: '21', tone: 'cyan' },
      { label: 'merged',     value: '15', tone: 'emerald' },
    ],
    status: 'demo',
  },
];

const TONE_TEXT: Record<AgentCard['metrics'][number]['tone'], string> = {
  cyan:    'text-cyan-300',
  amber:   'text-amber-300',
  violet:  'text-violet-300',
  emerald: 'text-emerald-300',
};

export function GovernanceAgentsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => (t + 1) % 4), 1500);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <section
      ref={ref}
      aria-label="Governance agents"
      className="bg-obsidian-900 border-b border-titanium-900 py-20 sm:py-28 px-4 sm:px-6"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-10">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
            04 · govern + automate
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
            KI-Systeme werden operativ regiert.
          </h2>
          <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
            Vier Agenten teilen sich dieselbe Runtime: Detection, Klassifikation, Evidence und Policy.
            Sie laufen kontinuierlich, schreiben in den Audit-Trail und eskalieren Hochrisiko-Entscheidungen
            gemäß Governance-Policy zur menschlichen Prüfung.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-titanium-900">
          {AGENTS.map((a, i) => (
            <motion.article
              key={a.id}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : (reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 })}
              transition={{ duration: 0.4, delay: 0.05 + i * 0.07 }}
              className="bg-obsidian-950 p-6 flex flex-col gap-4 min-h-[260px]"
            >
              <header className="flex items-center gap-3 justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex w-8 h-8 items-center justify-center bg-obsidian-900 border border-titanium-800 text-titanium-200">
                    {a.icon}
                  </span>
                  <div>
                    <div className="font-mono text-sm text-titanium-50">{a.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mt-0.5">{a.role}</div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className={`absolute inset-0 rounded-full bg-emerald-400 opacity-75 ${!reduce && tick === i ? 'animate-ping' : ''}`} />
                    <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  {a.status}
                </span>
              </header>

              <p className="text-sm text-titanium-300 leading-relaxed flex-1">{a.blurb}</p>

              <div className="grid grid-cols-2 gap-px bg-titanium-900/60">
                {a.metrics.map((m) => (
                  <div key={m.label} className="bg-obsidian-950 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">{m.label}</div>
                    <div className={`font-display font-semibold text-xl tabular-nums ${TONE_TEXT[m.tone]}`}>{m.value}</div>
                  </div>
                ))}
              </div>
            </motion.article>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            to="/runtime"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-titanium-400 hover:text-titanium-100 transition-colors"
          >
            <Bot className="h-3 w-3" />
            Vollständige Agenten-Registry ansehen
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}

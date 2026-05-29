import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import { Activity, Cpu, ShieldCheck, ScrollText, Bot } from 'lucide-react';

// AgentsPage — Agent-Kontrollebene (Public-Demo).
// Jeder Agent mit Status, Demo-Metriken, jüngsten Aktionen und Scope.
// Visualisiert als Control-Plane-Tiles, nicht als Chat-Surface.

interface AgentDef {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  /** 'demo' = simulierte Werte; 'live' bleibt reserviert für echte
   *  Tenant-Telemetrie. */
  status: 'demo' | 'live' | 'idle';
  blurb: string;
  metrics: { label: string; value: string; tone: 'cyan' | 'amber' | 'violet' | 'emerald' }[];
  recent: { ts: string; text: string }[];
}

const AGENTS: readonly AgentDef[] = [
  {
    id: 'drift',
    name: 'drift-agent',
    role: 'erkennen · monitoring',
    icon: <Activity className="h-4 w-4 text-cyan-300" />,
    status: 'demo',
    blurb: 'Beobachtet jede Website auf neue Tracker, Header-Regressionen und Banner-Dark-Pattern-Verschiebungen. Öffnet Vorfälle mit strukturiertem Diff.',
    metrics: [
      { label: 'Läufe / h',     value: '4.2', tone: 'cyan' },
      { label: 'Offene Vorf.',  value: '12',  tone: 'amber' },
      { label: 'MTTR',          value: '4 Min', tone: 'emerald' },
      { label: 'Letzter Lauf',  value: '8 s', tone: 'cyan' },
    ],
    recent: [
      { ts: 'T+02s', text: 'Tracker hinzugefügt · googletagmanager · vor Consent · kunde-1.de' },
      { ts: 'T+18s', text: 'Vendor hinzugefügt · plausible.io · ohne AVV · kunde-3.com' },
      { ts: 'T+47s', text: 'Header-Recheck · X-Frame-Options fehlt · kunde-4.shop' },
    ],
  },
  {
    id: 'ai-risk',
    name: 'ai-risk-agent',
    role: 'governance',
    icon: <Cpu className="h-4 w-4 text-violet-300" />,
    status: 'demo',
    blurb: 'Klassifiziert entdeckte KI-Endpunkte gegen AI Act Annex III. Erstellt ein Risiko-Profil und schreibt den Eintrag in das Use-Case-Register.',
    metrics: [
      { label: 'Klassifiziert', value: '17', tone: 'violet' },
      { label: 'Hochrisiko',    value: '3',  tone: 'amber' },
      { label: 'Verboten',      value: '0',  tone: 'emerald' },
      { label: 'Letzte Klass.', value: '2 Min', tone: 'violet' },
    ],
    recent: [
      { ts: 'T+04s', text: 'Klassifizieren · Chatbot · AI-Act-Klasse: limited · kunde-2.io' },
      { ts: 'T+22s', text: 'Erkennen · LLM-Endpunkt · provider=openai · region=us-east' },
      { ts: 'T+33s', text: 'Registrieren · openai/gpt-4o · Klassifikation: high-risk' },
    ],
  },
  {
    id: 'evidence',
    name: 'evidence-agent',
    role: 'automatisieren',
    icon: <ShieldCheck className="h-4 w-4 text-emerald-300" />,
    status: 'demo',
    blurb: 'Hashed jeden Befund (SHA-256) und verankert ihn in der Evidence-Chain. Erstellt Audit-Bundles bei Bedarf und prüft die Chain-Integrität.',
    metrics: [
      { label: 'Gehasht',       value: '4.128', tone: 'emerald' },
      { label: 'Letzter Anker', value: '3 s',   tone: 'emerald' },
      { label: 'Bundles',       value: '34',    tone: 'cyan' },
      { label: 'Chain-Tiefe',   value: '42.914', tone: 'emerald' },
    ],
    recent: [
      { ts: 'T+06s', text: 'Hash gespeichert · sha256:9f2c…b81 · Anker geschrieben ✓' },
      { ts: 'T+25s', text: 'Audit-Bundle 04-26 · 1.248 Ereignisse · verankert' },
      { ts: 'T+41s', text: 'Rolling-Backup · supabase-eu-west · 24 GB' },
    ],
  },
  {
    id: 'policy',
    name: 'policy-agent',
    role: 'governance · automatisieren',
    icon: <ScrollText className="h-4 w-4 text-amber-300" />,
    status: 'demo',
    blurb: 'Entwirft §13-Updates, AVV-Deltas und Policy-Snippets je Befund. Leitet Diffs an die Verantwortlichen via Slack, E-Mail oder Webhook.',
    metrics: [
      { label: 'Entwürfe / W', value: '21',   tone: 'cyan' },
      { label: 'Zusammengeführt', value: '15', tone: 'emerald' },
      { label: 'Offen (Owner)', value: '6',   tone: 'amber' },
      { label: 'Review-⌀',     value: '12 h', tone: 'cyan' },
    ],
    recent: [
      { ts: 'T+11s', text: 'DSB-Agent → §13-Update entworfen · 14 Zeilen · kunde-1.de' },
      { ts: 'T+29s', text: 'Triage-Agent → Owner=daniel · SLA=72h · kunde-1.de' },
      { ts: 'T+45s', text: 'Policy-Diff zusammengeführt · consent-v2 · 12 Sites' },
    ],
  },
];

const TONE_TEXT: Record<'cyan' | 'amber' | 'violet' | 'emerald', string> = {
  cyan: 'text-cyan-300', amber: 'text-amber-300', violet: 'text-violet-300', emerald: 'text-emerald-300',
};

export function AgentsPage() {
  usePageMeta({
    title: 'Agents — Governance-Kontrollebene | RealSync',
    description:
      'Vier autonome Agenten in der Governance-Runtime: Drift, KI-Risiko, Evidence, ' +
      'Policy. Demo-Surface mit simulierten Werten — keine Kundendaten.',
    url: 'https://RealSyncDynamicsAI.de/agents',
  });

  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % AGENTS.length), 1500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="pt-14">
        {/* Demo-Strip. */}
        <div className="border-b border-titanium-900 bg-obsidian-900/80">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 sm:px-6">
            <span className="select-none font-mono text-[9px] uppercase tracking-[0.2em] text-titanium-500">
              Demo-Runtime · simulierte Werte · keine Kundendaten
            </span>
          </div>
        </div>

        <header className="border-b border-titanium-900 px-4 sm:px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
              Agenten · autonome Kontrollebene
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
              Vier Agenten betreiben die Governance — ohne manuelles Triage-Backlog.
            </h1>
            <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              Die Agenten sind keine Chatbots. Sie sind autonome Prozesse in der Runtime,
              die erkennen, klassifizieren, entwerfen und verankern — kontinuierlich,
              parallel, mit vollem Audit-Trail.
            </p>
          </div>
        </header>

        <section className="px-4 sm:px-6 py-20">
          <div className="max-w-7xl mx-auto grid grid-cols-1 gap-px bg-titanium-900">
            {AGENTS.map((a, i) => (
              <article key={a.id} className="bg-obsidian-950 p-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
                <div className="flex flex-col gap-3">
                  <header className="flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex w-9 h-9 items-center justify-center bg-obsidian-900 border border-titanium-800 shrink-0">
                        {a.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-base text-titanium-50">{a.name}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mt-0.5">{a.role}</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
                      <span className="relative inline-flex h-1.5 w-1.5">
                        <span className={`absolute inset-0 rounded-full bg-amber-400 opacity-75 ${phase === i ? 'motion-safe:animate-ping' : ''}`} />
                        <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                      </span>
                      demo
                    </span>
                  </header>

                  <p className="text-sm text-titanium-300 leading-relaxed">{a.blurb}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900/60">
                    {a.metrics.map((m) => (
                      <div key={m.label} className="bg-obsidian-950 p-3">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500 mb-1">{m.label}</div>
                        <div className={`font-display font-semibold text-lg tabular-nums ${TONE_TEXT[m.tone]}`}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">Jüngste Aktionen</div>
                  <div className="bg-obsidian-900 border border-titanium-900 font-mono text-[11px] p-3 space-y-1">
                    {a.recent.map((r, j) => (
                      <div key={j} className="flex items-start gap-2 py-0.5 border-b border-titanium-900/40 last:border-b-0">
                        <span className="text-titanium-600 shrink-0 tabular-nums w-12">{r.ts}</span>
                        <span className="text-titanium-200 min-w-0 flex-1">{r.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan-300">
            <Bot className="h-3 w-3" />
            Agenten · keine Berater
          </div>
        </section>
      </main>
    </div>
  );
}

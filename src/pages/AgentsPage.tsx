import { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import { Activity, Cpu, ShieldCheck, ScrollText, Bot } from 'lucide-react';

// AgentsPage — agent control plane (public).
// Each agent rendered with status, live metrics, recent actions feed and
// scope. Visualised as control-plane tiles, not as a chat surface.

interface AgentDef {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  status: 'live' | 'idle';
  blurb: string;
  metrics: { label: string; value: string; tone: 'cyan' | 'amber' | 'violet' | 'emerald' }[];
  recent: { ts: string; text: string }[];
}

const AGENTS: readonly AgentDef[] = [
  {
    id: 'drift',
    name: 'drift-agent',
    role: 'detect · monitor',
    icon: <Activity className="h-4 w-4 text-cyan-300" />,
    status: 'live',
    blurb: 'Watches every site for new trackers, header regressions, banner-dark-pattern shifts. Opens incidents with a structured diff.',
    metrics: [
      { label: 'runs / h',     value: '4.2', tone: 'cyan' },
      { label: 'open inc.',    value: '12',  tone: 'amber' },
      { label: 'mttr',         value: '4 m', tone: 'emerald' },
      { label: 'last run',     value: '8 s', tone: 'cyan' },
    ],
    recent: [
      { ts: 'T+02s', text: 'tracker added · googletagmanager · pre-consent · kunde-1.de' },
      { ts: 'T+18s', text: 'vendor added · plausible.io · no DPA · kunde-3.com' },
      { ts: 'T+47s', text: 'header re-check · X-Frame-Options absent · kunde-4.shop' },
    ],
  },
  {
    id: 'ai-risk',
    name: 'ai-risk-agent',
    role: 'govern',
    icon: <Cpu className="h-4 w-4 text-violet-300" />,
    status: 'live',
    blurb: 'Classifies discovered AI endpoints against AI Act Annex III. Produces a risk profile and writes the use-case registry entry.',
    metrics: [
      { label: 'classified',   value: '17', tone: 'violet' },
      { label: 'high-risk',    value: '3',  tone: 'amber' },
      { label: 'prohibited',   value: '0',  tone: 'emerald' },
      { label: 'last classify', value: '2 m', tone: 'violet' },
    ],
    recent: [
      { ts: 'T+04s', text: 'classify widget · chat-bot · AI-Act class: limited · kunde-2.io' },
      { ts: 'T+22s', text: 'detect · LLM-Endpoint · provider=openai · region=us-east' },
      { ts: 'T+33s', text: 'register · openai/gpt-4o · classification: high-risk' },
    ],
  },
  {
    id: 'evidence',
    name: 'evidence-agent',
    role: 'automate',
    icon: <ShieldCheck className="h-4 w-4 text-emerald-300" />,
    status: 'live',
    blurb: 'Hashes every finding, signs and anchors into the evidence chain. Renders audit bundles on demand and verifies chain integrity.',
    metrics: [
      { label: 'sealed',       value: '4,128', tone: 'emerald' },
      { label: 'last anchor',  value: '3 s',   tone: 'emerald' },
      { label: 'bundles',      value: '34',    tone: 'cyan' },
      { label: 'chain depth',  value: '42,914', tone: 'emerald' },
    ],
    recent: [
      { ts: 'T+06s', text: 'sealed hash · sha256:9f2c…b81 · ledger-anchor ✓' },
      { ts: 'T+25s', text: 'audit-bundle 04-26 · 1,248 events · anchored' },
      { ts: 'T+41s', text: 'rolling backup · supabase-eu-west · 24 GB' },
    ],
  },
  {
    id: 'policy',
    name: 'policy-agent',
    role: 'govern · automate',
    icon: <ScrollText className="h-4 w-4 text-amber-300" />,
    status: 'live',
    blurb: 'Drafts §13 updates, AVV deltas, policy snippets per finding. Routes diffs to the owner via Slack, Email or webhook.',
    metrics: [
      { label: 'drafts / w',   value: '21',  tone: 'cyan' },
      { label: 'merged',       value: '15',  tone: 'emerald' },
      { label: 'pending owner', value: '6',  tone: 'amber' },
      { label: 'avg review',   value: '12 h', tone: 'cyan' },
    ],
    recent: [
      { ts: 'T+11s', text: 'dpo-agent → drafted §13 update · 14 lines · kunde-1.de' },
      { ts: 'T+29s', text: 'triage-agent → owner=daniel · sla=72h · kunde-1.de' },
      { ts: 'T+45s', text: 'policy diff merged · consent-v2 · enforced on 12 sites' },
    ],
  },
];

const TONE_TEXT: Record<'cyan' | 'amber' | 'violet' | 'emerald', string> = {
  cyan: 'text-cyan-300', amber: 'text-amber-300', violet: 'text-violet-300', emerald: 'text-emerald-300',
};

export function AgentsPage() {
  usePageMeta({
    title: 'Agents — AI Governance Control Plane | RealSync',
    description: 'Four autonomous agents run the AI governance runtime: drift, AI-risk, evidence and policy. Live status, metrics and recent actions.',
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
        <header className="border-b border-titanium-900 px-4 sm:px-6 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
              agents · autonomous control plane
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
              Four agents run governance. No human queue.
            </h1>
            <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              The agents are not chatbots. They are autonomous processes inside the runtime that detect, classify,
              draft and anchor — continuously, in parallel, with full audit trail.
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
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                      <span className="relative inline-flex h-1.5 w-1.5">
                        <span className={`absolute inset-0 rounded-full bg-emerald-400 opacity-75 ${phase === i ? 'motion-safe:animate-ping' : ''}`} />
                        <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      </span>
                      live
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
                  <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">recent actions</div>
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
            agents · not advisors
          </div>
        </section>
      </main>
    </div>
  );
}

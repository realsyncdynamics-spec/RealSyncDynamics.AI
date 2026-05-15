import { Navbar } from '../components/Navbar';
import { usePageMeta } from '../lib/usePageMeta';
import { AiOperatingSystemSection } from '../components/governance/AiOperatingSystemSection';
import { GovernanceGraphSection } from '../components/governance/GovernanceGraphSection';
import { EvidenceVaultPreview } from '../components/governance/EvidenceVaultPreview';
import { AgentControlPlanePreview } from '../components/governance/AgentControlPlanePreview';
import { ArrowRight, Activity, ShieldCheck, Bot, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';

// RuntimePage — AI Governance OS dashboard overview.
// Five blocks: AI OS framing → governance graph → 4 surface drill-ins →
// agents + evidence preview. Every block links into its dedicated
// surface (/monitoring, /agents, /evidence, /governance).

export function RuntimePage() {
  usePageMeta({
    title: 'Runtime — AI Governance Operating System | RealSync',
    description:
      'The AI Governance Operating System: continuous monitoring, autonomous agents, sealed evidence, enforced policies. Self-service, observable, replayable.',
    url: 'https://RealSyncDynamicsAI.de/runtime',
  });

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Navbar />
      <main className="pt-14">
        <AiOperatingSystemSection />
        <GovernanceGraphSection />

        <section className="bg-obsidian-900 border-b border-titanium-900 py-20 sm:py-28 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl mb-10">
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-3">
                surfaces · the OS layers
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tight text-titanium-50 mb-3">
                Drill into any layer of the runtime.
              </h2>
              <p className="text-titanium-300 text-base sm:text-lg leading-relaxed max-w-2xl">
                Monitoring, governance, evidence, agents — every surface is its own page in the OS.
                Browse the live state. Operate the policies. Read the evidence chain.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-titanium-900">
              <SurfaceCard
                to="/monitoring"
                icon={<Activity className="h-4 w-4 text-cyan-300" />}
                label="monitoring"
                title="Live event feed."
                blurb="Drift events, AI classifications, evidence anchors — all streaming live, sealed in order."
              />
              <SurfaceCard
                to="/governance"
                icon={<ScrollText className="h-4 w-4 text-amber-300" />}
                label="governance"
                title="Controls + policies."
                blurb="12 active controls map AI systems to policies. Status, scope, owner — all in one grid."
              />
              <SurfaceCard
                to="/agents"
                icon={<Bot className="h-4 w-4 text-violet-300" />}
                label="agents"
                title="Autonomous control plane."
                blurb="Four agents run continuously — drift, ai-risk, evidence, policy. No human queue."
              />
              <SurfaceCard
                to="/evidence"
                icon={<ShieldCheck className="h-4 w-4 text-emerald-300" />}
                label="evidence"
                title="Sealed audit chain."
                blurb="Every finding sealed (sha256), every agent action anchored. Replay-ready bundles."
              />
            </div>
          </div>
        </section>

        <section className="bg-obsidian-950 border-b border-titanium-900 py-16 sm:py-20 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5">
            <AgentControlPlanePreview />
            <EvidenceVaultPreview />
          </div>
        </section>
      </main>
    </div>
  );
}

function SurfaceCard({
  to,
  icon,
  label,
  title,
  blurb,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      to={to}
      className="group bg-obsidian-950 p-6 flex flex-col gap-3 hover:bg-obsidian-900 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
          {icon}
          {label}
        </span>
        <ArrowRight className="h-4 w-4 text-titanium-500 group-hover:text-titanium-100 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="font-display font-semibold text-xl text-titanium-50">{title}</div>
      <p className="text-sm text-titanium-300 leading-relaxed">{blurb}</p>
    </Link>
  );
}

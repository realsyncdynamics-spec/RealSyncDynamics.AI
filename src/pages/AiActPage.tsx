import { PageShell } from '../components/PageShell';
import { usePageMeta } from '../lib/usePageMeta';
import { AiActGovernanceBetaSection } from '../components/sections/AiActGovernanceBetaSection';
import { AgentOversightSection } from '../components/sections/AgentOversightSection';
import { DeploymentGovernanceSection } from '../components/sections/DeploymentGovernanceSection';
import { PolicyEngineSection } from '../components/sections/PolicyEngineSection';

// /ai-act — the AI Act governance surface. Risk classification, agent
// oversight, deployment governance, policy engine.

export function AiActPage() {
  usePageMeta({
    title: 'EU-AI-Act-Compliance: Klassifikation & Risiko | RealSync Dynamics AI',
    description:
      'EU AI Act ohne Beratung: AI-Systeme klassifizieren, Risk-Profile pflegen, Agenten überwachen, Policies erzwingen.',
    url: 'https://realsyncdynamicsai.de/ai-act',
  });
  return (
    <PageShell
      eyebrow="Governance · AI Act"
      title="EU-AI-Act-Compliance ohne Beratungsprojekt."
      sub="Agent-gestützte Klassifikation (minimal / limited / high / prohibited) mit menschlicher Freigabe, Agent-Oversight, Policy-Engine — alle Findings in der Evidence-Chain."
    >
      <AiActGovernanceBetaSection />
      <AgentOversightSection />
      <DeploymentGovernanceSection />
      <PolicyEngineSection />
    </PageShell>
  );
}

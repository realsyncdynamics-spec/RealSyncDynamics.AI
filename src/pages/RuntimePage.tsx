import { PageShell } from '../components/PageShell';
import { usePageMeta } from '../lib/usePageMeta';
import { RuntimeActivityFeedSection } from '../components/sections/RuntimeActivityFeedSection';
import { GovernanceGraphCoreSection } from '../components/sections/GovernanceGraphCoreSection';
import { AgenticComplianceAgentsSection } from '../components/sections/AgenticComplianceAgentsSection';
import { AgenticComplianceRuntimeSection } from '../components/sections/AgenticComplianceRuntimeSection';

// /runtime — the "what runs continuously" surface. Live activity feed,
// the governance graph, and the agent layer that operates on it.

export function RuntimePage() {
  usePageMeta({
    title: 'Runtime — Continuous AI & Privacy Governance | RealSync',
    description:
      'Die RealSync Runtime: Live-Aktivität, Governance-Graph und Agent-Layer für kontinuierliche AI- und Privacy-Governance.',
    url: 'https://RealSyncDynamicsAI.de/runtime',
  });
  return (
    <PageShell
      eyebrow="Product · Runtime"
      title="The runtime that watches your stack continuously."
      sub="Browser-, Network- und AI-Layer, annotiert während sie passieren und in eine versiegelte Evidence-Chain anchored."
    >
      <RuntimeActivityFeedSection />
      <GovernanceGraphCoreSection />
      <AgenticComplianceAgentsSection />
      <AgenticComplianceRuntimeSection />
    </PageShell>
  );
}

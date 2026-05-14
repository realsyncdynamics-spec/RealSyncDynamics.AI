import { PageShell } from '../components/PageShell';
import { usePageMeta } from '../lib/usePageMeta';
import { TechSecuritySixtySecondsSection } from '../components/sections/TechSecuritySixtySecondsSection';
import { GovernanceArchitectureSection } from '../components/sections/GovernanceArchitectureSection';
import { SystemLevelGovernanceSection } from '../components/sections/SystemLevelGovernanceSection';
import { InfrastructureIntegrationsStrip } from '../components/sections/InfrastructureIntegrationsStrip';
import { ScannerTechStackSection } from '../components/sections/ScannerTechStackSection';

// /docs — technical depth surface. Tech-security overview, architecture,
// system-level controls, scanner stack, integrations. Linked from the
// Navbar "Docs" item.

export function DocsRuntimePage() {
  usePageMeta({
    title: 'Docs — Architecture, Tech Security, Integrations | RealSync',
    description:
      'Technische Tiefe: Architektur, Tech-Security, Scanner-Stack, Integrationen und System-Level-Controls der RealSync Runtime.',
    url: 'https://RealSyncDynamicsAI.de/docs',
  });
  return (
    <PageShell
      eyebrow="Docs · Architecture"
      title="How the runtime works."
      sub="Architektur, Tech-Security, Scanner-Stack und Integrationen. Genug Tiefe für Procurement und Tech-Review."
    >
      <TechSecuritySixtySecondsSection />
      <GovernanceArchitectureSection />
      <SystemLevelGovernanceSection />
      <ScannerTechStackSection />
      <InfrastructureIntegrationsStrip />
    </PageShell>
  );
}

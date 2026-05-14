import { PageShell } from '../components/PageShell';
import { usePageMeta } from '../lib/usePageMeta';
import { EnterpriseEvidenceVaultSection } from '../components/sections/EnterpriseEvidenceVaultSection';
import { GovernanceMiniCasesSection } from '../components/sections/GovernanceMiniCasesSection';
import { ExecutiveCommandCenterSection } from '../components/sections/ExecutiveCommandCenterSection';

// /evidence — the audit-trail and procurement-readiness surface.
// Evidence vault, mini-cases, executive command center.

export function EvidencePage() {
  usePageMeta({
    title: 'Evidence — Audit-Trail & Procurement-Readiness | RealSync',
    description:
      'Audit-Trail, Evidence-Vault, Procurement-Ready Reports — alle Findings versiegelt, replay-fähig, reviewer-fertig.',
    url: 'https://RealSyncDynamicsAI.de/evidence',
  });
  return (
    <PageShell
      eyebrow="Trust · Evidence"
      title="Every finding sealed. Every action audited."
      sub="Versiegelte Evidence-Chain, Audit-Trail per Finding, Executive-Reports auf Knopfdruck — fertig für Procurement, Audit, BaFin/BAIT-Review."
    >
      <EnterpriseEvidenceVaultSection />
      <GovernanceMiniCasesSection />
      <ExecutiveCommandCenterSection />
    </PageShell>
  );
}

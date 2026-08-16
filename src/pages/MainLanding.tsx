import GovernanceHero from '../components/governance-frontend/GovernanceHero';
import { LiveScanCanvasSection } from '../legacy-landing-1505/LiveScanCanvasSection';
import { GlobalRuntimeFeedSection } from '../legacy-landing-1505/GlobalRuntimeFeedSection';
import { GovernanceAgentsSection } from '../legacy-landing-1505/GovernanceAgentsSection';
import { RuntimeActivationSection } from '../legacy-landing-1505/RuntimeActivationSection';

/**
 * Public homepage: approved Governance OS hero followed by the existing
 * runtime/governance sections.
 */
export function MainLanding() {
  return (
    <>
      <GovernanceHero />
      <LiveScanCanvasSection />
      <GlobalRuntimeFeedSection />
      <GovernanceAgentsSection />
      <RuntimeActivationSection />
    </>
  );
}

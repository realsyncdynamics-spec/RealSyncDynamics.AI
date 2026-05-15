/**
 * Landing — the runtime narrative in exactly 5 sections.
 *
 *   01 · Hero ("This system is already running.")
 *   02 · Live Scan Canvas ("The runtime detects issues live.")
 *   03 · Global Runtime Feed ("Events continuously happen.")
 *   04 · Governance Agents ("AI systems are governed operationally.")
 *   05 · Runtime Activation ("Activate your runtime.")
 *
 * Anything beyond these five sections has its own surface — /runtime,
 * /ai-act, /docs, /evidence, /pricing — and the homepage only sells the
 * narrative.
 */

import { Navbar } from '../components/Navbar';
import { HeroSection } from '../components/sections/HeroSection';
import { LiveScanCanvasSection } from '../components/sections/LiveScanCanvasSection';
import { GlobalRuntimeFeedSection } from '../components/sections/GlobalRuntimeFeedSection';
import { GovernanceAgentsSection } from '../components/sections/GovernanceAgentsSection';
import { RuntimeActivationSection } from '../components/sections/RuntimeActivationSection';

export function Landing() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <LiveScanCanvasSection />
      <GlobalRuntimeFeedSection />
      <GovernanceAgentsSection />
      <RuntimeActivationSection />
    </>
  );
}

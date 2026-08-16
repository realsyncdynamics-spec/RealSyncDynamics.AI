/** Historical landing restored from commit 6a9cc6c84b6b7cf0c21e42907eaf0d126d4af60e. */
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { LiveScanCanvasSection } from './LiveScanCanvasSection';
import { GlobalRuntimeFeedSection } from './GlobalRuntimeFeedSection';
import { GovernanceAgentsSection } from './GovernanceAgentsSection';
import { RuntimeActivationSection } from './RuntimeActivationSection';

export function Landing1505() {
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

/**
 * Landing — Runtime narrative.
 *
 * The home page renders the canonical runtime story in four moments:
 *
 *   01 · Hero (HeroOnly)
 *   02 · Runtime Canvas
 *   03 · System layers (Detect → Monitor → Govern → Automate)
 *   04 · Activate
 *
 * Pricing has its own surface (/pricing) and is intentionally not on this
 * page — the home page sells the product narrative, not a price grid.
 * Legacy section banks (KleineUnternehmen, GovernanceGraphCore, etc.) live
 * under their own routes (/runtime, /ai-act, /docs, /evidence).
 */

import { HeroOnly } from '../components/HeroOnly';
import { RuntimeCanvasSection } from '../components/sections/RuntimeCanvasSection';
import { FourLayersSection } from '../components/sections/FourLayersSection';
import { ActivationSection } from '../components/sections/ActivationSection';

export function Landing() {
  return (
    <>
      <HeroOnly />
      <RuntimeCanvasSection />
      <FourLayersSection />
      <ActivationSection />
    </>
  );
}

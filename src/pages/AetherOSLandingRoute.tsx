import { SuspenseBoundary } from '../components/SuspenseBoundary';
import { lazyPage } from '../lib/lazy-page';

const AetherOSLanding = lazyPage(() => import('./AetherOSLanding'));

/** Route-Element für /aetheros — Framer + Three erst hier. */
export function AetherOSLandingRoute() {
  return (
    <SuspenseBoundary label="AetherOS wird geladen …" variant="page">
      <AetherOSLanding />
    </SuspenseBoundary>
  );
}

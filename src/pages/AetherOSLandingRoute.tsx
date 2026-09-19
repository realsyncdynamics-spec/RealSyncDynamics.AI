import { RouteGate } from '../components/RouteGate';
import { lazyPage } from '../lib/lazy-page';

const AetherOSLanding = lazyPage(() => import('./AetherOSLanding'), 'AetherOSLanding');

export function AetherOSLandingRoute() {
  return (
    <RouteGate label="AetherOS wird geladen …" variant="page">
      <AetherOSLanding />
    </RouteGate>
  );
}

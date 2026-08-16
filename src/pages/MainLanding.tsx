/**
 * Root landing restored to the historical 2026-05-15 runtime narrative.
 * The current application routes remain untouched; only the public homepage
 * presentation is switched back to the archived five-section frontend.
 */
import { Landing1505 } from '../legacy-landing-1505/Landing';

export function MainLanding() {
  return <Landing1505 />;
}

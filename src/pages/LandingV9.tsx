import { SEOHead } from '../components/SEOHead';
import { LandingV9View } from '../components/landing/v9/LandingV9View';
import '../styles/landing-v9.css';

/**
 * Landing v9 — Vorschau unter /design/landing-v9 (noindex, 09.11.2026).
 *
 * Optik: High-End-Entwurf Obsidian/Titan mit 3D-Logo (zwei verkettete
 * Titanringe, three.js lazy, `logoRings3D.ts`). Texte: Landing v5 — Hero aus
 * i18n `v4Hero*`, Ablauf `LOOP_NODES`, Einstieg `V5_ENTRY_STEPS`, Beta
 * `V5_BETA_STEPS` + `config/beta.ts`, Preise aus `shared/pricing.ts`,
 * Roadmap aus `implementation-status.ts`. Eine Textquelle, keine Kopie.
 *
 * Die Startseite `/` bleibt Landing v6, bis der Owner umstellt.
 */
export function LandingV9() {
  return (
    <>
      <SEOHead />
      <LandingV9View />
    </>
  );
}

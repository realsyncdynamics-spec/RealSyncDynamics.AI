import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { readStored, useLandingMode } from '../components/landing/landing-mode';
import type { Lv7Theme } from '../components/landing/v7/EuropeMapCanvas';
import { LandingV7View } from '../components/landing/v7/LandingV7View';
import '../styles/landing-v7.css';

/**
 * Landing v7 — Design-Vorschau unter /design/landing-v7 (Artefakt
 * „AI Compliance Operations OS for Europe“, 25.10.2026).
 *
 * Zwei Darstellungen: Titan (Gold auf Graphit) und Nacht (Cyan). Die Wahl
 * teilt sich den Speicher mit den anderen Landings (`landing-mode`):
 * Titan ↔ `gold`, Nacht ↔ `cyan`. `?theme=nacht` überschreibt für Vorschau-Links.
 *
 * Inhalte kommen aus Pricing-SSoT, Beta-Schalter und Produkt-Registry
 * (siehe `landing-v7-content.ts`). Startseite `/` bleibt Landing v6.
 */
function initialTheme(query: string | null): Lv7Theme {
  if (query === 'titan' || query === 'nacht') return query;
  if (typeof window === 'undefined') return 'titan';
  return readStored() === 'cyan' ? 'nacht' : 'titan';
}

export function LandingV7() {
  const [params] = useSearchParams();
  const { setMode } = useLandingMode();
  const [theme, setTheme] = useState<Lv7Theme>(() => initialTheme(params.get('theme')));

  const onTheme = useCallback(
    (next: Lv7Theme) => {
      setTheme(next);
      setMode(next === 'nacht' ? 'cyan' : 'gold');
    },
    [setMode],
  );

  return (
    <>
      <SEOHead />
      <LandingV7View theme={theme} onTheme={onTheme} />
    </>
  );
}

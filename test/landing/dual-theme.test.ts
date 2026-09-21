/**
 * SSOT `/` — Europe-network (static), Free Audit CTAs. Die Palette selbst
 * steht in `landing-theme.ts`; dieser Test prueft die Bindung daran, nicht
 * einen konkreten Farbwert.
 */
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MainLanding } from '../../src/pages/MainLanding';
import {
  HERO_HEADLINE_TEST_SUBSTRING,
  HERO_INFRA_LINES,
  HERO_OPERATING_LOOP,
  HERO_PLAN_ANCHOR_FREE,
  HERO_SCAN_CTA_LABEL,
} from '../../src/components/governance-frontend/hero-content';
import { tierById } from '../../src/config/pricing';

const root = resolve(__dirname, '../..');
const landing = readFileSync(resolve(root, 'src/pages/MainLanding.tsx'), 'utf8');
const theme = readFileSync(resolve(root, 'src/components/landing/landing-theme.ts'), 'utf8');
const header = readFileSync(resolve(root, 'src/components/landing/PublicDarkHeader.tsx'), 'utf8');
const network = readFileSync(resolve(root, 'src/components/landing/EuropeNetworkHero.tsx'), 'utf8');
const titanHero = readFileSync(resolve(root, 'src/components/landing/HeroTitanium.tsx'), 'utf8');
const runtimePanel = readFileSync(
  resolve(root, 'src/components/landing/RuntimePreviewPanel.tsx'),
  'utf8',
);
const runtimeStations = readFileSync(
  resolve(root, 'src/components/landing/GovernanceRuntimeSection.tsx'),
  'utf8',
);

describe('Landing — Europe-network', () => {
  /**
   * Bis zum Design-Lock v2 stand hier, dass `landing-theme.ts` die Werte
   * `#0a0a0b`, `#d6ad68` und `#e8c98a` traegt. Das war eine Zusicherung auf
   * konkrete Goldwerte — also genau die Entscheidung, die v2 ersetzt: True
   * Black, Cyan als Handlungsakzent, Gold nur noch fuer VIP/Premium.
   *
   * Der Test prueft deshalb nicht mehr *welche* Farbe gilt, sondern dass die
   * Landing sie aus der Token-Datei bezieht statt sie festzuschreiben. Damit
   * ueberlebt er den Palettenwechsel, und er faengt den Fehler, der ihn
   * ueberhaupt erst noetig gemacht hat: einen Akzent, der in einer Komponente
   * hartkodiert neben dem Token steht.
   */
  it('bezieht den Akzent aus der Token-Datei, nicht hartkodiert', () => {
    const v1Gold = /#d6ad68|#e8c98a|rgba\(\s*214,\s*173,\s*104|rgba\(\s*232,\s*201,\s*138/i;
    expect(
      titanHero,
      'HeroTitanium traegt einen Akzentwert direkt im Code. Er gehoert in ' +
        '`landing-theme.ts` — sonst zieht ein Palettenwechsel die Komponente ' +
        'nicht mit und die Seite traegt zwei Akzente nebeneinander.',
    ).not.toMatch(v1Gold);
    expect(titanHero).toContain("from './landing-theme'");

    // Der Akzent kommt seit dem Farbmodus-Schalter aus `landing-mode.ts`.
    // Das ist dieselbe Quelle, nur eine Ebene tiefer: die Modus-Token zeigen
    // auf CSS-Variablen, deren Rueckfall genau die Goldwerte aus
    // `landing-theme.ts` sind. Der Zweck dieses Tests — kein Farbwert direkt
    // im Hero — bleibt damit erfuellt; geprueft wird er oben vom
    // `v1Gold`-Muster, das die eigentliche Arbeit macht.
    expect(titanHero, 'Der Hero bezieht den Akzent aus keiner Token-Datei').toContain(
      "from './landing-mode'",
    );
    expect(titanHero, 'Der Hero liest den Akzent nicht').toContain('MODE_ACCENT');
    expect(titanHero, 'Der CTA-Glow ist nicht der Token-Glow').toContain('MODE_GLOW');

    // Gegenprobe: kein Farbwert darf am Token vorbei im Hero stehen. Ohne
    // diese Zeile koennte jemand die Token-Importe stehen lassen und
    // trotzdem daneben eine feste Farbe setzen.
    expect(
      titanHero,
      'HeroTitanium setzt eine Farbe direkt statt ueber ein Token.',
    ).not.toMatch(/#[0-9a-f]{6}\b/i);
  });

  it('die Token-Datei bleibt die einzige Quelle der Landing-Typografie', () => {
    expect(theme).toContain('Playfair Display');
    expect(theme).toContain('LANDING_ACCENT');
    expect(theme).toContain('LANDING_CTA_GLOW');
  });

  it('uses static Europe network — not interactive sphere', () => {
    // Der Hero sitzt seit der Titan-Umsetzung in HeroTitanium, nicht mehr
    // inline in MainLanding — die Backdrop-Zusicherung wandert mit.
    expect(titanHero).toContain('EuropeNetworkHero');
    expect(landing).toContain('HeroTitanium');
    expect(landing).not.toContain('GovernanceSphereHost');
    // Der Farbmodus laeuft ueber `useLandingMode` (Gold/Cyan, nur Tonung).
    // `useGaTheme` ist die alte OS-Variante mit eigener Typografie und
    // eigenem Layout — die gehoert nicht auf die Startseite.
    expect(landing).not.toContain('useGaTheme');
    expect(titanHero).not.toContain('EuropeReliefBackdrop');
    expect(network).toContain('europe-network-static');
    expect(network).toContain('data-hero-interactive="false"');
    expect(network).toContain('/europe-globe.webp');
  });

  it('locks Replit header chrome', () => {
    expect(header).toContain('REALSYNCDYNAMICS.AI');
    expect(header).toContain('Produkt');
    expect(header).toContain('Evidence');
    expect(header).toContain('Preise');
    expect(header).toContain('HERO_SCAN_CTA_LABEL');
    expect(header).toContain('to="/audit"');
  });

  it('renders Titan H1 + Operating Loop + Infrastrukturzeilen + Plan-Anker', () => {
    render(createElement(MemoryRouter, null, createElement(MainLanding)));
    const h1 = screen.getByRole('heading', { level: 1 }).textContent ?? '';
    expect(h1).toMatch(/AI Compliance/);
    expect(h1).toMatch(/Operations OS/);
    expect(h1).toMatch(/for Europe/);

    // Operating Loop als Pfeilkette, nicht als Satzreihe.
    expect(screen.getAllByText(HERO_OPERATING_LOOP).length).toBeGreaterThan(0);

    // Jede Infrastrukturzeile steht als eine Zeile mit " · " getrennt.
    for (const line of HERO_INFRA_LINES) {
      expect(screen.getAllByText(line.join(' · ')).length).toBeGreaterThan(0);
    }

    // Plan-Anker: Gratis-Chip plus die drei Tarife aus der Preis-SSoT.
    expect(screen.getAllByText(HERO_PLAN_ANCHOR_FREE).length).toBeGreaterThan(0);
    for (const id of ['starter', 'growth', 'agency'] as const) {
      const tier = tierById(id);
      expect(tier, `Tarif ${id} fehlt in der Preis-SSoT`).toBeTruthy();
      expect(screen.getAllByText(`${tier!.priceEur}€`).length).toBeGreaterThan(0);
    }

    expect(HERO_HEADLINE_TEST_SUBSTRING).toBe('AI Compliance');
  });

  it('zeigt Beispielansicht + Das Betriebssystem below the fold', () => {
    // Der frühere KPI-Streifen zeigte erfundene Zahlen („1.284 SYSTEME IM
    // SCOPE") mit dem Vorbehalt nur in `sr-only`. An seiner Stelle steht die
    // Beispielansicht mit sichtbarem DEMO-Marker.
    expect(landing).toContain('RuntimePreviewPanel');
    expect(landing).not.toContain('SYSTEME IM SCOPE');
    expect(runtimePanel).toMatch(/DEMO\s*\/\s*SIMULATED/);
    expect(runtimePanel).toContain('RUNTIME_PREVIEW_CARDS');
    // Der Entwurf zeigt an dieser Stelle die sechs Stationen der Governance
    // Runtime, nicht die frühere Vierer-Kette „DAS BETRIEBSSYSTEM".
    // Die Kurzform bleibt im Hero (HERO_OPERATING_LOOP) — beide stehen so
    // im Entwurf, sie haben nur unterschiedliche Auflösung.
    expect(landing).toContain('GovernanceRuntimeSection');
    expect(landing).not.toContain('DAS BETRIEBSSYSTEM');
    expect(runtimeStations).toContain('GOVERNANCE RUNTIME');
    for (const station of ['DISCOVER', 'ASSESS', 'GOVERN', 'ENFORCE', 'EVIDENCE', 'AUDIT']) {
      expect(runtimeStations, `Station ${station} fehlt`).toContain(`'${station}'`);
    }
    expect(runtimePanel).toContain('data-demo-kpis');
  });
});

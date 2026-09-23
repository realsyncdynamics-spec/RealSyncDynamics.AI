/**
 * SSOT `/` — Europe-network (static), Free Audit CTAs. Die Palette selbst
 * steht in `landing-theme.ts`; dieser Test prueft die Bindung daran, nicht
 * einen konkreten Farbwert.
 */
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
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

describe('Landing Design-Lock v2 — True Black / Cyan / Gold-VIP', () => {
  /**
   * Zwei Zusicherungen, die einander brauchen:
   *
   * Die erste haelt die *Werte* fest — welche Palette gilt. Die zweite die
   * *Regel* — dass die Komponenten sie aus der Token-Datei beziehen und
   * nicht danebenschreiben. Ohne die erste koennte die Palette unbemerkt
   * zurueckkippen; ohne die zweite koennte ein Hero die richtige Datei
   * ignorieren und trotzdem gruen bleiben. Beim Zusammenfuehren von v1 und
   * v2 stand je eine der beiden auf jeder Seite — deshalb stehen hier jetzt
   * beide.
   */
  it('traegt die Tokens des Design-Lock v2', () => {
    // Freigabe Dominik, 2026-09-13. Cyan traegt die Handlung, Gold die
    // VIP-Stufe.
    expect(theme, 'True Black fehlt').toContain('#000000');
    expect(theme, 'Cyan-Akzent fehlt').toContain('#22c3e6');
    expect(theme, 'City-Light-Gold (LANDING_ACCENT_VIP) fehlt').toContain('#f2c98a');
    expect(theme).toContain('Playfair Display');
    expect(theme).toContain('LANDING_ACCENT');
    expect(theme).toContain('LANDING_CTA_GLOW');
  });

  it('bezieht den Akzent aus der Token-Datei, nicht hartkodiert', () => {
    const v1Gold = /#d6ad68|#e8c98a|rgba\(\s*214,\s*173,\s*104|rgba\(\s*232,\s*201,\s*138/i;
    expect(
      titanHero,
      'HeroTitanium traegt einen Akzentwert direkt im Code. Er gehoert in ' +
        '`landing-theme.ts` — sonst zieht ein Palettenwechsel die Komponente ' +
        'nicht mit und die Seite traegt zwei Akzente nebeneinander.',
    ).not.toMatch(v1Gold);
    expect(titanHero).toContain("from './landing-theme'");
    expect(titanHero).not.toContain("from './landing-mode'");

    expect(titanHero, 'Der Hero liest den Akzent nicht').toContain('LANDING_ACCENT');
    expect(titanHero, 'Der CTA-Glow ist nicht der Token-Glow').toContain('LANDING_CTA_GLOW');
    expect(titanHero, 'Der Hero benutzt nicht die Design-Lock-v2-Helfer').toContain(
      'landingAccent(60)',
    );

    // Gegenprobe aus dem Farbmodus-Zweig, hier behalten: kein Farbwert darf
    // am Token vorbei im Hero stehen. Ohne diese Zeile koennte jemand die
    // Token-Importe stehen lassen und trotzdem daneben eine feste Farbe
    // setzen — das `v1Gold`-Muster daruber faende nur die alten Goldwerte,
    // nicht einen frisch erfundenen.
    expect(
      titanHero,
      'HeroTitanium setzt eine Farbe direkt statt ueber ein Token.',
    ).not.toMatch(/#[0-9a-f]{6}\b/i);
  });

  it('SOFT und LITE gehoeren zur Cyan-Familie, nicht zu Gold', () => {
    // Ihre Konsumenten sind Europa-Netz, Runtime-Verlauf und Evidence-CTA.
    // Das sind Handlungs- und Laufzeitflaechen — unter v2 ausdruecklich
    // keine Gold-Orte. Stuende hier wieder ein Goldwert, waere Gold zurueck
    // als allgemeiner Akzent, ohne dass es jemand beschlossen haette.
    const zeile = (name: string) =>
      theme.match(new RegExp(`export const ${name} = '([^']+)'`))?.[1] ?? '';
    for (const name of ['LANDING_ACCENT_SOFT', 'LANDING_ACCENT_LITE']) {
      const wert = zeile(name);
      expect(wert, `${name} fehlt in landing-theme.ts`).not.toBe('');
      expect(
        wert.toLowerCase(),
        `${name} traegt ${wert} — ein Goldwert an einer Stelle, die unter ` +
          'Design-Lock v2 Cyan sein muss.',
      ).not.toMatch(/#(e8c98a|e4cfa2|d6ad68|f2c98a)/);
    }
  });

  it('keine Datei der oeffentlichen / traegt v1-Gold', () => {
    // Warum der Import-Abschluss und nicht eine Dateiliste: Beim Zusammen-
    // fuehren blieben zwei Goldwerte stehen (Fokusring in LandingChannelTools,
    // Flaeche der hervorgehobenen Preiskarte), weil beide Dateien in keiner
    // gepflegten Liste standen. Wer die Liste pflegen muss, vergisst sie.
    // Deshalb laeuft dieser Test die Importe ab `MainLanding` ab und prueft,
    // was die Seite tatsaechlich laedt.
    const v1Gold =
      /#d6ad68|#e8c98a|#e4cfa2|rgba\(\s*214,\s*173,\s*104|rgba\(\s*232,\s*201,\s*138|rgba\(\s*228,\s*207,\s*162/i;
    const abschluss = new Set<string>();
    const offen = ['src/pages/MainLanding.tsx'];
    while (offen.length > 0) {
      const datei = offen.pop()!;
      if (abschluss.has(datei)) continue;
      abschluss.add(datei);
      const quelle = readFileSync(resolve(root, datei), 'utf8');
      for (const treffer of quelle.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
        const basis = resolve(root, dirname(datei), treffer[1]);
        const kandidat = ['.tsx', '.ts', '/index.tsx', '/index.ts']
          .map((endung) => basis + endung)
          .find((pfad) => existsSync(pfad));
        if (kandidat) offen.push(relative(root, kandidat));
      }
    }

    // Der Abschluss muss die Seite wirklich abdecken — findet der Lauf nur
    // eine Handvoll Dateien, prueft der Test nichts und meldet trotzdem gruen.
    expect(abschluss.size, 'Import-Abschluss unplausibel klein').toBeGreaterThan(12);
    expect(abschluss.has('src/components/landing/LandingChannelTools.tsx')).toBe(true);
    expect(abschluss.has('src/components/landing/LandingPricingSection.tsx')).toBe(true);

    const belastet = [...abschluss]
      .filter((datei) => !datei.endsWith('landing-theme.ts'))
      .filter((datei) => v1Gold.test(readFileSync(resolve(root, datei), 'utf8')));
    expect(
      belastet,
      'Diese Dateien werden von `/` geladen und tragen noch einen v1-Goldwert. ' +
        'Unter Design-Lock v2 ist Gold der Enterprise-Stufe vorbehalten — steht ' +
        'es daneben, zeigt die Seite zwei Akzente nebeneinander.',
    ).toEqual([]);
  });

  it('LANDING_ACCENT_VIP ist verdrahtet, nicht nur deklariert', () => {
    // Die Order verlangt ausdruecklich: entweder an einer klar definierten
    // Premium-Stelle real verwendet — oder nicht behaupten, VIP-Semantik sei
    // umgesetzt. Ein Token, den niemand liest, ist keine Umsetzung.
    const enterprise = readFileSync(
      resolve(root, 'src/components/landing/EnterpriseAccessSection.tsx'),
      'utf8',
    );
    expect(
      enterprise,
      'Die Enterprise-Sektion liest LANDING_ACCENT_VIP nicht. Dann ist der ' +
        'Token unbenutzt und die VIP-Stufe eine Behauptung.',
    ).toContain('LANDING_ACCENT_VIP');
    expect(enterprise).toContain("from './landing-theme'");
  });

  it('traegt die Goldwerte aus v1 nicht mehr als Hauptakzent', () => {
    // Stand v1: #e8c98a und #e4cfa2 standen hier als weiche Akzente. Sie
    // sind mit der Konsolidierung nach Cyan gewandert (siehe Test darueber);
    // dieser Test haelt nur noch fest, dass das alte Primaergold und der
    // alte Grundton nicht zurueckkommen.
    expect(theme, 'v1-Primaergold #d6ad68 ist zurueck').not.toContain('#d6ad68');
    expect(theme, 'v1-Grundton #0a0a0b ist zurueck').not.toContain('#0a0a0b');
  });

  it('uses static Europe network — not interactive sphere', () => {
    // Der Hero sitzt seit der Titan-Umsetzung in HeroTitanium, nicht mehr
    // inline in MainLanding — die Backdrop-Zusicherung wandert mit.
    expect(titanHero).toContain('EuropeNetworkHero');
    expect(landing).toContain('HeroTitanium');
    expect(landing).not.toContain('GovernanceSphereHost');
    // Unter Design-Lock v2 traegt die Startseite genau eine Palette. Weder
    // `useGaTheme` (die alte OS-Variante mit eigener Typografie und eigenem
    // Layout) noch ein Farbmodus-Umschalter gehoeren darauf: beide machen
    // die geltende Farbe zur Laufzeitfrage.
    expect(landing).not.toContain('useGaTheme');
    expect(landing, 'Die Startseite traegt wieder einen Farbmodus-Umschalter').not.toContain(
      'useLandingMode',
    );
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

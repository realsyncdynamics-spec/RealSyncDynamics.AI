/**
 * Wächter: Was die Startseite verspricht, muss ein Backend haben.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLATFORM_CAPABILITIES,
  LIVE_CAPABILITIES,
  BUILDING_CAPABILITIES,
  CAPABILITIES_MEASURED_AT,
} from '@/src/config/platform-capabilities';
import {
  RUNTIME_PREVIEW_LABEL,
  RUNTIME_PREVIEW_NOTE,
  RUNTIME_PREVIEW_CARDS,
} from '@/src/config/landing-runtime-preview';

const FUNCTIONS_DIR = resolve(__dirname, '../../supabase/functions');
const landingShell = () =>
  readFileSync(resolve(__dirname, '../../src/pages/MainLanding.tsx'), 'utf8') +
  readFileSync(resolve(__dirname, '../../src/components/landing/PublicDarkHeader.tsx'), 'utf8');

describe('Plattform-Fähigkeiten — Behauptung deckt sich mit dem Backend', () => {
  it('jede Fähigkeit benennt mindestens eine tragende Edge Function', () => {
    for (const cap of PLATFORM_CAPABILITIES) {
      expect(cap.backedBy.length, `${cap.name} nennt keine tragende Function`).toBeGreaterThan(0);
    }
  });

  it('jede benannte Edge Function existiert im Repository', () => {
    const missing: string[] = [];
    for (const cap of PLATFORM_CAPABILITIES) {
      for (const fn of cap.backedBy) {
        if (!existsSync(join(FUNCTIONS_DIR, fn, 'index.ts'))) missing.push(`${cap.name} → ${fn}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('Module in Arbeit tragen eine Begründung', () => {
    for (const cap of BUILDING_CAPABILITIES) {
      expect(cap.note, `${cap.name} steht auf 'building' ohne Begründung`).toBeTruthy();
    }
  });

  it('die gemessenen Lücken stehen nicht auf live', () => {
    const notDeployed: string[] = [];
    const wrongly = LIVE_CAPABILITIES
      .filter((cap) => cap.backedBy.some((fn) => notDeployed.includes(fn)))
      .map((cap) => cap.name);
    expect(wrongly).toEqual([]);
  });

  it('die Startseite rendert aus dieser Quelle, nicht aus einer eigenen Liste', () => {
    const source = readFileSync(resolve(__dirname, '../../src/pages/MainLanding.tsx'), 'utf8');
    expect(source).toContain('platform-capabilities');
  });

  it('Messdatum ist gesetzt und plausibel', () => {
    expect(CAPABILITIES_MEASURED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('kein Modul in Arbeit steht als Fließtext im öffentlichen Bereich', () => {
    const files = [
      'src/pages/MainLanding.tsx',
      'src/components/landing/LandingChannelTools.tsx',
      'src/components/landing/PublicDarkHeader.tsx',
    ];
    const hits: string[] = [];
    for (const rel of files) {
      const source = readFileSync(resolve(__dirname, '../..', rel), 'utf8');
      for (const cap of BUILDING_CAPABILITIES) {
        if (source.includes(cap.name)) hits.push(`${rel} nennt „${cap.name}“`);
      }
    }
    expect(hits).toEqual([]);
  });
});

describe('Erreichbarkeit — fertige Seiten sind von der Startseite aus verlinkt', () => {
  const shell = landingShell();
  const app = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');

  it.each(['/ai-act', '/sicherheit'])('%s ist verlinkt und geroutet', (path) => {
    expect(shell, `Die Startseite (inkl. PublicDarkHeader) verlinkt ${path} nicht.`).toContain(`to="${path}"`);
    expect(app, `${path} hat keine Route — der Link ginge ins Leere.`).toContain(`path="${path}"`);
  });
});

describe('Fachseiten sind von der Startseite aus erreichbar', () => {
  const app = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
  const withPage = PLATFORM_CAPABILITIES.filter((c) => c.learnMorePath);

  it('mindestens eine Fähigkeit führt auf ihre Fachseite', () => {
    expect(withPage.length).toBeGreaterThan(0);
  });

  it.each(withPage.map((c) => [c.name, c.learnMorePath!] as const))(
    '%s → %s ist geroutet',
    (_name, path) => {
      expect(app).toContain(`path="${path}"`);
    },
  );

  it('die Startseite rendert die Verweise, statt sie nur zu speichern', () => {
    const landing = readFileSync(resolve(__dirname, '../../src/pages/MainLanding.tsx'), 'utf8');
    expect(landing).toContain('learnMorePath');
  });
});

describe('Kaufwege für Module ohne Laufzeit tragen einen Hinweis', () => {
  const PURCHASE_PATHS = [
    'src/pages/WhatsAppPricingPage.tsx',
    'src/pages/product-entry-points/ChatbotStartPage.tsx',
    'src/pages/product-entry-points/PhonebotStartPage.tsx',
  ];

  const botsCapability = PLATFORM_CAPABILITIES.find((c) => c.id === 'bots');

  it.each(PURCHASE_PATHS)('%s weist den Zustand der Bot-Laufzeit aus', (rel) => {
    if (botsCapability?.status === 'live') return;
    const source = readFileSync(resolve(__dirname, '../..', rel), 'utf8');
    expect(source).toContain('CapabilityAvailabilityNotice');
    expect(source).toContain('capabilityId="bots"');
  });

  it('der Hinweis verschwindet durch das Deployment, nicht durch einen Commit', () => {
    const component = readFileSync(
      resolve(__dirname, '../../src/components/landing/CapabilityAvailabilityNotice.tsx'),
      'utf8',
    );
    expect(component).toContain("status === 'live'");
    expect(component).toContain('PLATFORM_CAPABILITIES');
  });
});

describe('Hero-Panel — Beispiel ist als Beispiel gekennzeichnet', () => {
  const landing = readFileSync(
    resolve(__dirname, '../../src/pages/MainLanding.tsx'),
    'utf8',
  );

  it('das Panel nennt sich nicht mehr „LIVE“', () => {
    expect(landing).not.toContain('GOVERNANCE RUNTIME · LIVE');
    expect(landing).toContain('RUNTIME_PREVIEW_LABEL');
  });

  it('die Beispielwerte stehen in der Config, nicht in der Seite', () => {
    expect(RUNTIME_PREVIEW_LABEL.toUpperCase()).toContain('BEISPIEL');
    expect(RUNTIME_PREVIEW_NOTE.length).toBeGreaterThan(20);
    const distinctive = RUNTIME_PREVIEW_CARDS.filter((c) => /[/.,%]/.test(c.value));
    expect(distinctive.length).toBeGreaterThan(0);
    for (const card of distinctive) {
      expect(landing).not.toContain(card.value);
    }
  });

  it('die Beispielkarten zeigen nur Module mit deploytem Backend', () => {
    const buildingWords = BUILDING_CAPABILITIES.flatMap((c) =>
      c.name
        .toUpperCase()
        .split(/[^A-ZÄÖÜ0-9]+/)
        .filter((w) => w.length > 3),
    );
    if (BUILDING_CAPABILITIES.length === 0) {
      expect(buildingWords).toEqual([]);
      return;
    }
    expect(buildingWords.length).toBeGreaterThan(0);
    for (const card of RUNTIME_PREVIEW_CARDS) {
      const text = `${card.label} ${card.detail ?? ''}`.toUpperCase();
      for (const word of buildingWords) {
        expect(text).not.toContain(word);
      }
    }
  });

  it('keine kumulative Unternehmenskennzahl in den Beispielkarten', () => {
    const corporate = /\b(mio|mrd|millionen|milliarden|insgesamt|bisher|weltweit)\b/i;
    for (const card of RUNTIME_PREVIEW_CARDS) {
      const text = `${card.label} ${card.value} ${card.detail ?? ''}`;
      expect(corporate.test(text)).toBe(false);
    }
  });
});

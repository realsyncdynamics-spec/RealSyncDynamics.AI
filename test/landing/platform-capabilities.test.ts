/**
 * Wächter: Was die Startseite verspricht, muss ein Backend haben.
 *
 * Ausgangslage (Messung 2026-08-17 gegen RealSyncDynamicsLive): Von 180 Edge
 * Functions im Repository laufen 100 in Produktion. Die Startseite wies
 * `Evidence Vault`, `Policy Engine` und `Provenance` als fertige Module aus —
 * alle drei ohne deploytes Backend.
 *
 * Für ein Produkt, das Nachweisbarkeit verkauft, ist das kein Marketing-Detail:
 * Ein Interessent, der Evidence Vault im Erstgespräch sehen will, findet eine
 * Function, die nie deployt wurde. Diese Tests machen den Weg dorthin schwerer.
 *
 * Sie prüfen **Konsistenz**, nicht den Deployment-Stand selbst — den kann
 * niemand ohne Zugriff auf das Live-Projekt aus einem Unit-Test heraus messen.
 * Was sie erzwingen: Jede öffentlich gezeigte Fähigkeit benennt die Functions,
 * die sie trägt, und diese Functions existieren im Repository. Der Sprung von
 * `'building'` auf `'live'` bleibt eine bewusste, datierte Entscheidung.
 */

import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLATFORM_CAPABILITIES,
  LIVE_CAPABILITIES,
  BUILDING_CAPABILITIES,
  CAPABILITIES_MEASURED_AT,
} from '@/src/config/platform-capabilities';

const FUNCTIONS_DIR = resolve(__dirname, '../../supabase/functions');

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
    expect(
      missing,
      'Diese Fähigkeiten verweisen auf Functions, die es nicht gibt. Entweder ist ' +
        'der Name falsch oder die Fähigkeit ist erfunden.',
    ).toEqual([]);
  });

  it('Module in Arbeit tragen eine Begründung', () => {
    for (const cap of BUILDING_CAPABILITIES) {
      expect(
        cap.note,
        `${cap.name} steht auf 'building' ohne Begründung — die Oberfläche zeigt sie an.`,
      ).toBeTruthy();
    }
  });

  it('die vier gemessenen Lücken stehen nicht auf live', () => {
    // Am 2026-08-17 gegen Produktion gemessen: diese Functions sind nicht
    // deployt. Wer eine davon auf 'live' hebt, muss vorher neu messen — und
    // dann fällt dieser Test auf, statt dass die Landing still lügt.
    const notDeployed = ['evidence-vault', 'policy-packs', 'provenance', 'c2pa-manifest-generate'];
    const wrongly = LIVE_CAPABILITIES
      .filter((cap) => cap.backedBy.some((fn) => notDeployed.includes(fn)))
      .map((cap) => cap.name);

    expect(
      wrongly,
      'Diese Module gelten als live, hängen aber an Functions, die am ' +
        `${CAPABILITIES_MEASURED_AT} nicht in Produktion waren. Vor dem Statuswechsel ` +
        'gegen `supabase functions list` messen und CAPABILITIES_MEASURED_AT mitziehen.',
    ).toEqual([]);
  });

  it('die Startseite rendert aus dieser Quelle, nicht aus einer eigenen Liste', () => {
    const landing = resolve(__dirname, '../../src/pages/MainLanding.tsx');
    const source = require('node:fs').readFileSync(landing, 'utf8') as string;
    expect(
      source,
      'MainLanding.tsx importiert die Fähigkeitsquelle nicht — dann kann die ' +
        'Landing wieder Module bewerben, die kein Backend haben.',
    ).toContain('platform-capabilities');
  });

  it('Messdatum ist gesetzt und plausibel', () => {
    expect(CAPABILITIES_MEASURED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

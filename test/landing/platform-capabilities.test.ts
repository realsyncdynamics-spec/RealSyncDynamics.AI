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
  RUNTIME_PREVIEW_METRICS,
  RUNTIME_PREVIEW_ROWS,
} from '@/src/config/landing-runtime-preview';

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
    const source = readFileSync(landing, 'utf8');
    expect(
      source,
      'MainLanding.tsx importiert die Fähigkeitsquelle nicht — dann kann die ' +
        'Landing wieder Module bewerben, die kein Backend haben.',
    ).toContain('platform-capabilities');
  });

  it('Messdatum ist gesetzt und plausibel', () => {
    expect(CAPABILITIES_MEASURED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('kein Modul in Arbeit steht als Fließtext im öffentlichen Bereich', () => {
    // Der `#platform`-Abschnitt rendert aus der Config und weist 'building'
    // korrekt aus. Die Falle sind die anderen Stellen: Trust-Kacheln,
    // Chip-Reihen, Meta-Descriptions, Absatztexte. Dort stand `Evidence Vault`
    // dreimal und `Policy Engine` einmal als vorhandene Fähigkeit, während
    // beide Backends nicht deployt sind.
    //
    // Ausgenommen ist bewusst das Warteliste-Formular: Ein Modul, für das man
    // sich vormerken lässt, ist dort richtig aufgehoben — das ist die
    // ehrliche Darstellung, nicht der Verstoß.
    const files = [
      'src/pages/MainLanding.tsx',
      'src/components/landing/LandingChannelTools.tsx',
    ];
    const hits: string[] = [];
    for (const rel of files) {
      const source = readFileSync(resolve(__dirname, '../..', rel), 'utf8');
      for (const cap of BUILDING_CAPABILITIES) {
        if (source.includes(cap.name)) hits.push(`${rel} nennt „${cap.name}"`);
      }
    }
    expect(
      hits,
      'Diese Dateien behaupten ein Modul, dessen Backend nicht in Produktion ' +
        'ist. Entweder das Modul auf `live` heben (nach Messung) oder die ' +
        'Stelle auf eine getragene Fähigkeit umschreiben.',
    ).toEqual([]);
  });
});

describe('Hero-Panel — Beispiel ist als Beispiel gekennzeichnet', () => {
  const landing = readFileSync(
    resolve(__dirname, '../../src/pages/MainLanding.tsx'),
    'utf8',
  );

  it('das Panel nennt sich nicht mehr „LIVE"', () => {
    // Vorher: Kopfzeile „GOVERNANCE RUNTIME · LIVE", grüner ACTIVE-Punkt,
    // darunter vier hartkodierte Zahlen. Ein anonymer Besucher hat keinen
    // Tenant — dort ist nichts messbar, also darf dort nichts gemessen
    // aussehen (Truth Layer, target-architecture.md §3.1).
    expect(landing).not.toContain('GOVERNANCE RUNTIME · LIVE');
    expect(landing).toContain('RUNTIME_PREVIEW_LABEL');
  });

  it('die Beispielwerte stehen in der Config, nicht in der Seite', () => {
    expect(RUNTIME_PREVIEW_LABEL.toUpperCase()).toContain('BEISPIEL');
    expect(RUNTIME_PREVIEW_NOTE.length).toBeGreaterThan(20);
    // Nur Werte mit Trennzeichen prüfen. Eine blanke `'04'` kollidiert mit der
    // Schrittnummer in GOVERNANCE_STEPS — der Treffer wäre ein Fehlalarm und
    // würde den Wächter unglaubwürdig machen.
    const distinctive = RUNTIME_PREVIEW_METRICS.filter((m) => /[/,%]/.test(m.value));
    expect(distinctive.length, 'Kein Beispielwert ist eindeutig genug zum Prüfen').toBeGreaterThan(0);
    for (const metric of distinctive) {
      expect(
        landing,
        `Der Beispielwert „${metric.value}" ist in MainLanding.tsx hartkodiert. ` +
          'Dann kann er ohne den Beispiel-Marker gerendert werden.',
      ).not.toContain(metric.value);
    }
  });

  it('die Statuszeilen zeigen nur Module mit deploytem Backend', () => {
    // Die frühere Zeile „EVIDENCE CHAIN · VERIFIED" gehörte zum Evidence
    // Vault. Ein Beispiel für ein Modul, das es in Produktion nicht gibt,
    // ist auch nur eine Behauptung — nur eine bebilderte.
    const buildingWords = BUILDING_CAPABILITIES
      .map((c) => c.name.toUpperCase().replace(/\s*\(.*\)/, ''))
      .concat('EVIDENCE CHAIN');
    for (const row of RUNTIME_PREVIEW_ROWS) {
      for (const word of buildingWords) {
        expect(
          row.label.toUpperCase(),
          `Die Beispielzeile „${row.label}" zeigt ein Modul ohne Backend.`,
        ).not.toContain(word);
      }
    }
  });
});

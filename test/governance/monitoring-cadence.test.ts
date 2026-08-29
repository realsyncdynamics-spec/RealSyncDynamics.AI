import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  erlaubteKadenz,
  istKadenz,
  naechsterLauf,
  wirksameKadenz,
  KADENZ_ABSTAND_MS,
  type Kadenz,
} from '../../supabase/functions/_shared/monitoring-cadence';
import { PLAN_ENTITLEMENTS, planGrants } from '../../shared/pricing';

/**
 * Die Kadenz der kontinuierlichen Überwachung.
 *
 * ## Warum diese Datei wichtiger ist als ihre Größe vermuten lässt
 *
 * Der Scan ist kostenlos; verkauft wird die **Dauer**. Diese Regel entscheidet
 * also über die Ware. Bis zum Claims-Reality-Audit am 2026-08-24 gab es sie
 * nicht: `governance-monitoring-scheduler` wählte `monitoring_sources` allein
 * nach `status = 'active'`, ohne Plan-Filter und ohne Entitlement-Prüfung. Wer
 * eine aktive Quelle hatte, wurde überwacht — auch ohne Plan.
 *
 * Die Fälle unten prüfen deshalb vor allem, wann **nicht** oder **seltener**
 * überwacht wird.
 */

describe('erlaubteKadenz — was der Plan trägt', () => {
  it('gibt null ohne jede Überwachungs-Berechtigung', () => {
    // Free Audit: unbegrenzt scannen, aber keine Überwachung. Genau die
    // Trennlinie, auf der das Geschäftsmodell steht.
    expect(erlaubteKadenz(false, false)).toBeNull();
  });

  it('gibt monatlich, wenn nur monitoring.monthly vorliegt', () => {
    expect(erlaubteKadenz(false, true)).toBe('monthly');
  });

  it('gibt täglich bei monitoring.daily', () => {
    expect(erlaubteKadenz(true, true)).toBe('daily');
  });

  it('erlaubt nie stündlich', () => {
    // `hourly` steht in keiner Preisliste. Ein Plan, der es zusagt, existiert
    // nicht — also darf die Regel es auch nicht gewähren.
    for (const [taeglich, monatlich] of [[true, true], [true, false], [false, true]]) {
      expect(erlaubteKadenz(taeglich, monatlich)).not.toBe('hourly');
    }
  });
});

describe('wirksameKadenz — die langsamere von beiden gewinnt', () => {
  it.each([
    // gewünscht      erlaubt      wirksam
    ['hourly', 'daily', 'daily'],
    ['daily', 'daily', 'daily'],
    ['weekly', 'daily', 'weekly'],
    ['monthly', 'daily', 'monthly'],
    ['hourly', 'monthly', 'monthly'],
    ['daily', 'monthly', 'monthly'],
    ['weekly', 'monthly', 'monthly'],
    ['monthly', 'monthly', 'monthly'],
  ] as const)('Wunsch %s bei erlaubt %s → %s', (gewuenscht, erlaubt, wirksam) => {
    expect(wirksameKadenz(gewuenscht, erlaubt as Kadenz)).toBe(wirksam);
  });

  it('drosselt nie in die falsche Richtung', () => {
    // Die Eigenschaft, auf die es ankommt: Das Ergebnis ist nie häufiger als
    // erlaubt und nie häufiger als gewünscht.
    const alle: Kadenz[] = ['hourly', 'daily', 'weekly', 'monthly'];
    for (const gewuenscht of alle) {
      for (const erlaubt of ['daily', 'monthly'] as Kadenz[]) {
        const wirksam = wirksameKadenz(gewuenscht, erlaubt);
        expect(KADENZ_ABSTAND_MS[wirksam]).toBeGreaterThanOrEqual(KADENZ_ABSTAND_MS[erlaubt]);
        expect(KADENZ_ABSTAND_MS[wirksam]).toBeGreaterThanOrEqual(KADENZ_ABSTAND_MS[gewuenscht]);
      }
    }
  });

  it('behandelt einen unbekannten Wunschwert als täglich und drosselt ihn dann', () => {
    // Ein kaputter Wert darf nicht dazu führen, dass gar nicht mehr überwacht
    // wird — und auch nicht, dass häufiger gescannt wird als erlaubt.
    expect(wirksameKadenz('quartalsweise', 'monthly')).toBe('monthly');
    expect(wirksameKadenz(null, 'daily')).toBe('daily');
    expect(wirksameKadenz(undefined, 'monthly')).toBe('monthly');
  });

  it('erkennt gültige Kadenzen', () => {
    expect(istKadenz('daily')).toBe(true);
    expect(istKadenz('quartalsweise')).toBe(false);
    expect(istKadenz(null)).toBe(false);
  });
});

describe('naechsterLauf', () => {
  it('rechnet vom übergebenen Zeitpunkt, nicht von der Systemuhr', () => {
    const jetzt = Date.UTC(2026, 7, 25, 6, 0, 0);
    expect(naechsterLauf('daily', jetzt)).toBe(new Date(jetzt + 86_400_000).toISOString());
    expect(naechsterLauf('monthly', jetzt)).toBe(new Date(jetzt + 2_592_000_000).toISOString());
  });
});

describe('Die Regel deckt sich mit der Plan-Leiter', () => {
  /**
   * Der eigentliche Sinn des Gates: Was ein Plan verspricht, und was der
   * Scheduler daraus macht, muss dasselbe sein.
   */
  it.each([
    ['free_audit', null],
    ['starter', 'monthly'],
    ['growth', 'daily'],
    ['agency', 'daily'],
    ['enterprise', 'daily'],
    ['partner', 'daily'],
  ])('%s wird %s überwacht', (plan, erwartet) => {
    const kadenz = erlaubteKadenz(
      planGrants(plan, 'monitoring.daily'),
      planGrants(plan, 'monitoring.monthly'),
    );
    expect(kadenz).toBe(erwartet);
  });

  it('lässt Free Audit unbegrenzt scannen, aber nicht überwachen', () => {
    // Beide Hälften des Produktversprechens in einem Fall.
    expect(PLAN_ENTITLEMENTS.free_audit['website.scan_monthly_limit']).toBe(-1);
    expect(erlaubteKadenz(
      planGrants('free_audit', 'monitoring.daily'),
      planGrants('free_audit', 'monitoring.monthly'),
    )).toBeNull();
  });

  it('gibt Drift erst ab Growth', () => {
    expect(planGrants('starter', 'monitoring.drift')).toBe(false);
    expect(planGrants('growth', 'monitoring.drift')).toBe(true);
  });
});

describe('Der Scheduler benutzt das Gate auch wirklich', () => {
  const quelle = readFileSync(
    join('supabase', 'functions', 'governance-monitoring-scheduler', 'index.ts'),
    'utf8',
  );

  it('lädt Entitlements und wertet die Kadenz aus', () => {
    expect(quelle).toContain('loadEntitlementsForTenant');
    expect(quelle).toContain('wirksameKadenz');
    expect(quelle).toContain('planKadenz');
  });

  it('überspringt Quellen ohne Berechtigung mit Prüfpfad-Eintrag', () => {
    expect(quelle).toContain('SCAN_SKIPPED');
    expect(quelle).toContain('plan_without_monitoring');
  });

  it('hängt den Drift-Alert an monitoring.drift', () => {
    expect(quelle).toContain("hasFeature(ent, 'monitoring.drift')");
    expect(quelle).toContain('driftErlaubt && scoreDelta');
  });

  it('schreibt next_scan_at nur noch aus der wirksamen Kadenz', () => {
    // Ein zurückkehrendes `nextScanAt(source.scan_frequency)` wäre die
    // Umgehung: Der Scan liefe gedrosselt, der nächste Termin aber wieder
    // nach Kundenwunsch.
    expect(quelle).not.toContain('nextScanAt(source.scan_frequency)');
  });
});

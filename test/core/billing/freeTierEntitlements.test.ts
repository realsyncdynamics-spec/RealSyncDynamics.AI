/**
 * Free-Tier-Fallback und Tier-Heuristik.
 *
 * Regression: der Fallback listete nur 3 der 9 Keys aus
 * 20260707010000_phase2_free_tier_setup.sql. Die Dashboard-Karten
 * „DSGVO-Verzeichnis", „KI-System-Verzeichnis" und „Evidence Vault" waren
 * dadurch gesperrt, obwohl sie im Free-Tier freigeschaltet sind.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  FREE_TIER_FALLBACK,
  inferTier,
  type EntitlementValue,
} from '../../../src/core/billing/useEntitlements';

const MIGRATION = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260707010000_phase2_free_tier_setup.sql'),
  'utf8',
);

/** Key → Wert aus dem CASE-Block der Free-Tier-Seed-Query. */
function migrationGrants(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of MIGRATION.matchAll(/WHEN '([a-z_.]+)' THEN (\d+)/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

const byKey = (key: string) => FREE_TIER_FALLBACK.find((e) => e.key === key);

describe('FREE_TIER_FALLBACK', () => {
  it('deckt jeden im Migrations-Seed vergebenen Entitlement-Key ab', () => {
    const missing = Object.keys(migrationGrants()).filter((k) => !byKey(k));
    expect(missing).toEqual([]);
  });

  /**
   * Spaeter angehobene Werte.
   *
   * Der Seed von 20260707010000 ist der Ausgangsstand, nicht der Endstand:
   * Eine spaetere Migration darf einen Wert veraendern, und dann muss der
   * Fallback dem *wirksamen* Wert folgen, nicht dem urspruenglichen.
   *
   * `website.scan_monthly_limit`: 20260828000000 hebt das Kontingent auf `-1`
   * (unbegrenzt), weil Scans seit der Entscheidung vom 2026-08-24 in jedem
   * Plan kostenlos sind. Verkauft wird die dauerhafte Ueberwachung.
   *
   * Jeder Eintrag hier braucht die Migration, die ihn aendert — sonst wird
   * diese Liste zum bequemen Ort, an dem echte Abweichungen verschwinden.
   */
  const SPAETER_GEAENDERT: Record<string, { wert: number; migration: string }> = {
    'website.scan_monthly_limit': {
      wert: -1,
      migration: '20260828000000_entitlement_base_keys_paid_plans.sql',
    },
  };

  it('stimmt Wert fuer Wert mit dem wirksamen Migrationsstand ueberein', () => {
    for (const [key, seedWert] of Object.entries(migrationGrants())) {
      const erwartet = SPAETER_GEAENDERT[key]?.wert ?? seedWert;
      expect({ key, value: byKey(key)?.value }).toEqual({ key, value: erwartet });
    }
  });

  it('belegt jede Abweichung vom Seed mit der Migration, die sie verursacht', () => {
    for (const [key, { wert, migration }] of Object.entries(SPAETER_GEAENDERT)) {
      const sql = readFileSync(
        resolve(__dirname, '../../../supabase/migrations/', migration),
        'utf8',
      );
      expect(sql, `${migration} nennt ${key} nicht`).toContain(key);
      expect(sql, `${migration} setzt ${key} nicht auf ${wert}`).toContain(String(wert));
    }
  });

  it('haelt die Free-Tier-Karten des Dashboards freigeschaltet', () => {
    // Genau die Karten, die im Bug faelschlich mit Schloss gerendert wurden.
    for (const key of [
      'website.scan',
      'evidence.basic_vault',
      'governance.dsgvo_directory',
      'governance.ai_register',
    ]) {
      expect(byKey(key)?.value).toBe(1);
    }
  });
});

describe('inferTier', () => {
  const ents = (...pairs: Array<[string, number]>): EntitlementValue[] =>
    pairs.map(([key, value]) => ({ key, value, kind: 'boolean' }));

  it('stuft den Free-Tier-Fallback als free ein', () => {
    expect(inferTier(FREE_TIER_FALLBACK)).toBe('free');
  });

  it('stuft evidence.basic_vault allein nicht als starter ein', () => {
    // Free-Tier bekommt evidence.basic_vault=1 — als Indikator wuerde die
    // Heuristik jeden Free-Tier-Nutzer faelschlich hochstufen.
    expect(inferTier(ents(['evidence.basic_vault', 1]))).toBe('free');
  });

  it('erkennt starter an reports.export', () => {
    expect(inferTier(ents(['evidence.basic_vault', 1], ['reports.export', 1]))).toBe('starter');
  });

  it('erkennt growth an ai_classification.limited', () => {
    expect(inferTier(ents(['reports.export', 1], ['ai_classification.limited', 1]))).toBe('growth');
  });

  it('erkennt agency an bots.count', () => {
    expect(inferTier(ents(['ai_classification.limited', 1], ['bots.count', 3]))).toBe('agency');
  });

  it('faellt ohne Entitlements auf free zurueck', () => {
    expect(inferTier([])).toBe('free');
  });

  it('ignoriert auf 0 gesetzte Keys', () => {
    expect(inferTier(ents(['reports.export', 0], ['bots.count', 0]))).toBe('free');
  });
});

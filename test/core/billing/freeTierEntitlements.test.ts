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

  it('stimmt Wert fuer Wert mit dem Migrations-Seed ueberein', () => {
    for (const [key, value] of Object.entries(migrationGrants())) {
      expect({ key, value: byKey(key)?.value }).toEqual({ key, value });
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

  it('stuft den Free-Tier-Fallback als free_tier ein', () => {
    expect(inferTier(FREE_TIER_FALLBACK)).toBe('free_tier');
  });

  it('stuft evidence.basic_vault allein nicht als starter ein', () => {
    // Free-Tier bekommt evidence.basic_vault=1 — als Indikator wuerde die
    // Heuristik jeden Free-Tier-Nutzer faelschlich hochstufen.
    expect(inferTier(ents(['evidence.basic_vault', 1]))).toBe('free_tier');
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

  it('faellt ohne Entitlements auf free_tier zurueck', () => {
    expect(inferTier([])).toBe('free_tier');
  });

  it('ignoriert auf 0 gesetzte Keys', () => {
    expect(inferTier(ents(['reports.export', 0], ['bots.count', 0]))).toBe('free_tier');
  });
});

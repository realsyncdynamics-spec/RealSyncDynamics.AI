/**
 * Entitlement-Katalog ↔ PLAN_ENTITLEMENTS — Paritaet der Migration.
 *
 * `scripts/check-entitlement-parity.mjs` vergleicht die Live-DB mit der
 * Quelle, braucht dafuer aber Zugangsdaten. Dieser Test braucht keine: er
 * haelt die Migration, die den Katalog auf die Quelle nachzieht, an genau
 * diese Quelle gebunden. Aendert sich PLAN_ENTITLEMENTS, ohne dass eine
 * Migration folgt, wird das hier rot — bevor die DB abdriftet.
 *
 * Hintergrund (2026-09-20): Das Enterprise-Produkt trug 3 von 64 Keys,
 * `bots.appointments` und `bots.orders` existierten in keinem Plan und nicht
 * einmal im Vokabular — appointment-book und order-intake lehnten deshalb
 * jeden Tenant ab, unabhaengig vom Plan.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ENTITLEMENT_KEYS, PLAN_ENTITLEMENTS, planGrants } from '../../shared/pricing';

const MIGRATION = resolve(
  __dirname,
  '../../supabase/migrations/20260920120000_entitlement_catalog_ssot_parity.sql',
);

type Zuordnung = Record<string, Record<string, number>>;

/** Liest den generierten VALUES-Block ('plan', 'key', wert) aus der Migration. */
function zuordnungAusMigration(sql: string): Zuordnung {
  const start = sql.indexOf('>>> GENERATED FROM shared/pricing.ts PLAN_ENTITLEMENTS >>>');
  const ende = sql.indexOf('<<< GENERATED <<<');
  expect(start).toBeGreaterThan(-1);
  expect(ende).toBeGreaterThan(start);
  const block = sql.slice(start, ende);

  const ergebnis: Zuordnung = {};
  const zeile = /^\s*\('([a-z_]+)',\s*'([a-z0-9_.\-]+)',\s*(-?\d+)\)/gm;
  for (const m of block.matchAll(zeile)) {
    const [, plan, key, wert] = m;
    (ergebnis[plan] ??= {})[key] = Number(wert);
  }
  return ergebnis;
}

/** Liest die explizit ins Vokabular eingetragenen Keys. */
function vokabularAusMigration(sql: string): string[] {
  const start = sql.indexOf('INSERT INTO public.entitlements');
  const ende = sql.indexOf('>>> GENERATED');
  const block = sql.slice(start, ende);
  return [...block.matchAll(/^\s*\('([a-z0-9_.\-]+)',\s*'[^']*',\s*'(boolean|limit)'\)/gm)].map(
    (m) => m[1],
  );
}

const sql = readFileSync(MIGRATION, 'utf8');
const migration = zuordnungAusMigration(sql);

describe('Migration 20260920120000 — Katalog aus PLAN_ENTITLEMENTS', () => {
  it('kennt genau die Plaene der Quelle', () => {
    expect(Object.keys(migration).sort()).toEqual(Object.keys(PLAN_ENTITLEMENTS).sort());
  });

  it('traegt fuer jeden Plan exakt die Keys und Werte der Quelle', () => {
    for (const [plan, quelle] of Object.entries(PLAN_ENTITLEMENTS)) {
      expect(migration[plan], `Plan ${plan} fehlt in der Migration`).toBeDefined();
      // Beide Richtungen: nichts fehlt, nichts ist erfunden, kein Wert weicht ab.
      expect(migration[plan]).toEqual(quelle);
    }
  });

  it('verwendet nur Keys aus dem Vokabular der Quelle', () => {
    const bekannt = new Set<string>(ENTITLEMENT_KEYS);
    for (const [plan, keys] of Object.entries(migration)) {
      for (const key of Object.keys(keys)) {
        expect(bekannt.has(key), `${plan}: "${key}" ist kein ENTITLEMENT_KEY`).toBe(true);
      }
    }
  });

  it('legt die drei Bot-Capability-Keys im Vokabular an', () => {
    const neu = vokabularAusMigration(sql);
    expect(neu).toEqual(['bots.chat', 'bots.appointments', 'bots.orders']);
    for (const key of neu) expect(ENTITLEMENT_KEYS).toContain(key);
  });

  it('schreibt Jahresvarianten mit (Join auf plan_key und plan_key_yearly)', () => {
    expect(sql).toMatch(/p\.default_for_plan_key = z\.plan_key\s*\n\s*OR p\.default_for_plan_key = z\.plan_key \|\| '_yearly'/);
  });

  it('ist additiv: Upsert auf (product_id, entitlement_id), kein DELETE', () => {
    expect(sql).toContain('ON CONFLICT (product_id, entitlement_id)');
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });
});

describe('Bot-Builder — die geprueften Keys sind auch gewaehrt', () => {
  /** Liest den Key aus `gateFeature(admin, <tenant>, '<key>')` einer Edge Function. */
  function gateKey(fn: string): string {
    const src = readFileSync(resolve(__dirname, `../../supabase/functions/${fn}/index.ts`), 'utf8');
    const m = src.match(/gateFeature\([^,]+,[^,]+,\s*'([a-z0-9_.]+)'\)/);
    expect(m, `${fn}: kein gateFeature-Aufruf gefunden`).not.toBeNull();
    return m![1];
  }

  const bezahltBots = ['starter', 'growth', 'agency', 'enterprise', 'partner'] as const;
  const bezahltCapabilities = ['growth', 'agency', 'enterprise', 'partner'] as const;

  it('bot-chat prueft bots.enabled — gewaehrt ab Starter', () => {
    const key = gateKey('bot-chat');
    expect(key).toBe('bots.enabled');
    for (const plan of bezahltBots) expect(planGrants(plan, key), plan).toBe(true);
    expect(planGrants('free_audit', key)).toBe(false);
  });

  it('appointment-book prueft bots.appointments — gewaehrt ab Growth', () => {
    const key = gateKey('appointment-book');
    expect(key).toBe('bots.appointments');
    for (const plan of bezahltCapabilities) expect(planGrants(plan, key), plan).toBe(true);
    expect(planGrants('starter', key)).toBe(false);
    expect(planGrants('free_audit', key)).toBe(false);
  });

  it('order-intake prueft bots.orders — gewaehrt ab Growth', () => {
    const key = gateKey('order-intake');
    expect(key).toBe('bots.orders');
    for (const plan of bezahltCapabilities) expect(planGrants(plan, key), plan).toBe(true);
    expect(planGrants('starter', key)).toBe(false);
    expect(planGrants('free_audit', key)).toBe(false);
  });
});

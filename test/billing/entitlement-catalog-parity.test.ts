/**
 * Entitlement-Katalog ↔ PLAN_ENTITLEMENTS — Paritaet der Spiegel-Migration.
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
 *
 * ── Warum „die neueste" und nicht eine feste Datei (2026-09-27) ────────────
 *
 * Bis hierhin war dieser Test auf `20260920120000` festgenagelt. Das hielt,
 * bis eine spaetere Migration einen Key vergab:
 * `20260924000000_frontend_modernization_tool.sql` trug
 * `frontend.modernization` fuer sieben Plaene in die DB. Die Quelle konnte
 * dem nicht folgen, ohne dass dieser Test rot wird — und die angewandte
 * Migration zu editieren, um ihn gruen zu machen, waere genau der Griff, den
 * `CLAUDE.md` verbietet. Der Zweck des Tests war richtig, seine Verankerung
 * an einer einzelnen Datei ist gealtert.
 *
 * Seither gilt: Jede Aenderung an PLAN_ENTITLEMENTS bringt eine **neue**
 * vollstaendige Spiegel-Migration mit (`npm run gen:entitlement-mirror`), und
 * dieser Test vergleicht die Quelle gegen die **jeweils neueste**. Die
 * aelteren bleiben unberuehrt, weil sie angewandt sind.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { ENTITLEMENT_KEYS, PLAN_ENTITLEMENTS, planGrants, type EntitlementKey } from '../../shared/pricing';
import {
  entzogenZwischen,
  neuesteSpiegelMigration,
  quittierteEntzuege,
  spiegelMigrationen,
  versionUnzulaessig,
  werteAus,
  zuordnungenAus,
} from '../../scripts/generate-entitlement-mirror-sql';

const MIGRATIONS_DIR = resolve(__dirname, '../../supabase/migrations');

/** Die jeweils neueste Spiegel-Migration — dieselbe Auswahl wie im Generator. */
const MIGRATION = resolve(MIGRATIONS_DIR, neuesteSpiegelMigration());

/**
 * Die erste Spiegel-Migration. Sie hat die drei Bot-Capability-Keys ins
 * Vokabular gebracht; das gehoert an diese Datei, nicht an „die neueste".
 */
const ERSTE_MIGRATION = resolve(
  MIGRATIONS_DIR,
  '20260920120000_entitlement_catalog_ssot_parity.sql',
);

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
// Derselbe Parser wie im Generator: Test, `--check` und Entzugs-Vergleich
// lesen den GENERATED-Block nicht mehr auf zwei Wegen.
const migration = werteAus(sql);

describe('Neueste Spiegel-Migration — Katalog aus PLAN_ENTITLEMENTS', () => {
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

  it('schreibt Jahresvarianten mit (Join auf plan_key und plan_key_yearly)', () => {
    expect(sql).toMatch(/p\.default_for_plan_key = z\.plan_key\s*\n\s*OR p\.default_for_plan_key = z\.plan_key \|\| '_yearly'/);
  });

  it('ist additiv: Upsert auf (product_id, entitlement_id), kein DELETE', () => {
    expect(sql).toContain('ON CONFLICT (product_id, entitlement_id)');
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('bricht ab, wenn ein Key der Quelle im Vokabular fehlt', () => {
    // Ohne diesen Waechter ueberspringt der INNER JOIN eine Zuordnung mit
    // unbekanntem Key still — dieselbe leise Klasse Fehler, gegen die der
    // Entitlement-Guard gebaut wurde. Nur die erste Spiegel-Migration legte
    // Keys selbst an; seither traegt sie die Feature-Migration ein — und die
    // neueste ist nie mehr die erste (siehe den Entzugs-Test unten).
    expect(sql).toMatch(/RAISE EXCEPTION/);
    expect(sql).toContain('Entitlement-Vokabular unvollstaendig');
  });
});

/**
 * Entzug — die eine Richtung, die ein Upsert nicht kann.
 *
 * Streicht die Quelle einen Key aus einem Plan, laesst der Generator nur das
 * Tupel weg; die Zeile in der DB bliebe und gewaehrte weiter. Der Test oben
 * merkt das nicht, weil er nur die Tupel der neuesten Datei liest. Diese
 * Pruefung schliesst die Luecke: Zwischen zwei Spiegeln darf kein Paar
 * verschwinden, ohne dass die neuere es als `-- ENTZOGEN:` vermerkt.
 * (Befund aus dem Codex-Review zu PR #1616.)
 */
describe('Entzug — kein Paar verschwindet still zwischen zwei Spiegeln', () => {
  it('jedes Paar der vorigen Spiegel-Migration steht in der neuesten oder ist quittiert', () => {
    const alle = spiegelMigrationen();
    expect(alle.length).toBeGreaterThanOrEqual(2);
    const vorige = readFileSync(resolve(MIGRATIONS_DIR, alle[alle.length - 2]!), 'utf8');
    const weg = entzogenZwischen(zuordnungenAus(vorige), zuordnungenAus(sql));
    const quittiert = quittierteEntzuege(sql);
    expect(
      weg.filter((p) => !quittiert.has(p)),
      'Paar(e) verschwinden ohne quittierten Entzug — siehe `npm run gen:entitlement-mirror`',
    ).toEqual([]);
  });

  // Die Pruefung oben laeuft heute leer (nichts wurde entzogen). Dass sie einen
  // Entzug ueberhaupt erkennt, zeigt dieser Fall mit erfundenem SQL.
  const spiegel = (zeilen: string[], vermerk = ''): string =>
    [
      vermerk,
      '-- >>> GENERATED FROM shared/pricing.ts PLAN_ENTITLEMENTS >>>',
      'FROM (VALUES',
      zeilen.join(',\n'),
      ') AS z(plan_key, key, value)',
      '-- <<< GENERATED <<<',
    ].join('\n');

  it('erkennt ein verschwundenes Paar — und nimmt es nur mit Vermerk hin', () => {
    const vorher = spiegel(["  ('starter', 'bots.enabled', 1)", "  ('growth', 'bots.orders', 1)"]);
    const ohneVermerk = spiegel(["  ('growth', 'bots.orders', 1)"]);
    const mitVermerk = spiegel(["  ('growth', 'bots.orders', 1)"], '-- ENTZOGEN: starter bots.enabled');

    const weg = entzogenZwischen(zuordnungenAus(vorher), zuordnungenAus(ohneVermerk));
    expect(weg).toEqual(['starter bots.enabled']);
    expect(quittierteEntzuege(ohneVermerk).has('starter bots.enabled')).toBe(false);
    expect(quittierteEntzuege(mitVermerk).has('starter bots.enabled')).toBe(true);
  });

  it('wertet eine Wertaenderung nicht als Entzug', () => {
    // 1 → 0 ist eine Aenderung, die der Upsert selbst vollzieht (`DO UPDATE`).
    const vorher = spiegel(["  ('starter', 'bots.enabled', 1)"]);
    const nachher = spiegel(["  ('starter', 'bots.enabled', 0)"]);
    expect(entzogenZwischen(zuordnungenAus(vorher), zuordnungenAus(nachher))).toEqual([]);
  });
});

/**
 * Die Version einer neuen Spiegel-Migration muss frei und neuer sein als
 * **jede** Migration — nicht nur als die vorige Spiegel-Migration.
 * (Befunde aus dem CodeRabbit-Review und dem Review vom 2026-10-03 zu PR #1616.)
 */
describe('Generator — nur eine freie Version nach der neuesten Migration wird geschrieben', () => {
  const vorhandene = [
    '00001_initial_schema.sql',
    '20260510_ai_governance_core.sql',
    '20260920120000_entitlement_catalog_ssot_parity.sql',
    '20260927112804_entitlement_catalog_mirror.sql',
    // Feature-Migration, die einen Key ins Vokabular eintraegt (#1720).
    '20260928163000_browser_scan_monitoring.sql',
  ];

  it('lehnt eine vorhandene Spiegel-Version ab — keine angewandte Migration wird ueberschrieben', () => {
    expect(versionUnzulaessig('20260927112804', vorhandene)).toMatch(/vergeben/);
  });

  it('lehnt die Version einer anderen Migration ab, nicht nur die eines Spiegels', () => {
    expect(versionUnzulaessig('20260928163000', vorhandene)).toMatch(/vergeben/);
  });

  it('lehnt eine aeltere Version als die neueste Spiegel-Migration ab', () => {
    expect(versionUnzulaessig('20260925101500', vorhandene)).toMatch(/nicht neuer als/);
  });

  it('lehnt eine Version vor der Feature-Migration eines neuen Keys ab (#1720)', () => {
    // Neuer als der vorige Spiegel, aber vor 20260928163000: In einer frischen
    // Kette liefe der Spiegel zuerst und braeche am Vokabular-Waechter ab.
    expect(versionUnzulaessig('20260928120417', vorhandene)).toMatch(/20260928163000_browser_scan_monitoring\.sql/);
  });

  it('nimmt eine freie Version nach der neuesten Migration an', () => {
    expect(versionUnzulaessig('20260928171904', vorhandene)).toBeNull();
  });

  it('ordnet kurze Alt-Praefixe richtig ein, statt sie als neueste zu werten', () => {
    expect(versionUnzulaessig('20260928171904', ['20260510_ai_governance_core.sql', '00001_initial_schema.sql'])).toBeNull();
  });
});

describe('20260920120000 — hier kamen die drei Bot-Keys ins Vokabular', () => {
  const ersteSql = readFileSync(ERSTE_MIGRATION, 'utf8');

  it('legt die drei Bot-Capability-Keys im Vokabular an', () => {
    const neu = vokabularAusMigration(ersteSql);
    expect(neu).toEqual(['bots.chat', 'bots.appointments', 'bots.orders']);
    for (const key of neu) expect(ENTITLEMENT_KEYS).toContain(key);
  });
});

describe('Bot-Builder — die geprueften Keys sind auch gewaehrt', () => {
  /** Liest den Key aus `gateFeature(admin, <tenant>, '<key>')` einer Edge Function. */
  function gateKey(fn: string): EntitlementKey {
    const src = readFileSync(resolve(__dirname, `../../supabase/functions/${fn}/index.ts`), 'utf8');
    const m = src.match(/gateFeature\([^,]+,[^,]+,\s*'([a-z0-9_.]+)'\)/);
    expect(m, `${fn}: kein gateFeature-Aufruf gefunden`).not.toBeNull();
    const key = m![1];
    expect(ENTITLEMENT_KEYS, `${fn}: unbekannter Entitlement-Key "${key}"`).toContain(key);
    return key as EntitlementKey;
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

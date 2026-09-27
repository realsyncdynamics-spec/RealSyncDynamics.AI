#!/usr/bin/env tsx
/**
 * Erzeugt eine Spiegel-Migration fuer `PLAN_ENTITLEMENTS` aus shared/pricing.ts.
 *
 *   npm run gen:entitlement-mirror            # neue Migration schreiben
 *   npm run gen:entitlement-mirror -- --check # Quelle gegen die neueste pruefen
 *
 * ── Warum es dieses Skript gibt ────────────────────────────────────────────
 *
 * `20260920120000_entitlement_catalog_ssot_parity.sql` hat den Katalog auf die
 * Quelle nachgezogen, und `test/billing/entitlement-catalog-parity.test.ts`
 * hielt die Quelle danach an genau diese eine Datei gebunden. Das hat
 * funktioniert, bis eine spaetere Migration einen Key vergeben hat:
 * `20260924000000_frontend_modernization_tool.sql` trug
 * `frontend.modernization` fuer sieben Plaene in die DB. Die Quelle konnte
 * dem nicht folgen, ohne dass der Test rot wird — und eine angewandte
 * Migration zu editieren, um ihn gruen zu machen, ist keine Option.
 *
 * Deshalb die Umstellung: **Jede Aenderung an PLAN_ENTITLEMENTS bringt eine
 * neue, vollstaendige Spiegel-Migration mit**, und der Test vergleicht die
 * Quelle gegen die *jeweils neueste*. Additiv, keine angewandte Datei wird
 * angefasst, und der Vergleich altert nicht mehr.
 *
 * ── Form der erzeugten Migration ───────────────────────────────────────────
 *
 * Wortgleich die von `20260920120000`, weil die sich in Produktion bewaehrt
 * hat und der Test ihren Block bereits lesen kann:
 *
 *   * Upsert, **kein DELETE**. Die Migration ist fuer den Bestand additiv;
 *     `DO UPDATE` greift nur, wo ein Wert tatsaechlich abweicht.
 *   * Jahresvarianten (`<plan>_yearly`) erben vom Monatszwilling — so wie
 *     `tenant_entitlements()` ueber den `_yearly`-Fallback aufloest.
 *   * Plaene, die die Quelle nicht kennt (bronze/silver/gold,
 *     enterprise_public, free, free_tier), bleiben unberuehrt.
 *
 * Das Vokabular (`public.entitlements`) legt dieses Skript **nicht** an. Es
 * kennt die Beschreibungen nicht, und eine erfundene waere schlechter als
 * keine — den Key traegt die Feature-Migration ein, die ihn einfuehrt (so wie
 * `20260924000000` es fuer `frontend.modernization` getan hat). Stattdessen
 * steht am Anfang ein Waechter, der mit Namen abbricht, falls ein Key der
 * Quelle im Vokabular fehlt. Ohne ihn wuerde der INNER JOIN die Zuordnung
 * still ueberspringen — dieselbe leise Klasse Fehler, gegen die der
 * Entitlement-Guard ueberhaupt gebaut wurde.
 *
 * Was das Skript **nicht** tut: Es ruehrt `product_entitlements` von
 * Add-on-Produkten nicht an. Die gehoeren `scripts/generate-plan-catalog-sql.ts`
 * („nur an Add-on-Produkten, nie an Plaenen") — die beiden Generatoren
 * teilen sich die Tabelle entlang dieser Grenze.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLAN_ENTITLEMENTS } from '../shared/pricing';

// ESM: wie in scripts/generate-plan-catalog-sql.ts — `__dirname` gibt es hier nicht.
const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const ANFANG = '-- >>> GENERATED FROM shared/pricing.ts PLAN_ENTITLEMENTS >>>';
const ENDE = '-- <<< GENERATED <<<';

/** Dateiname jeder Spiegel-Migration — die Ordnung ist die Versionsnummer. */
const MUSTER = /^\d{14}_entitlement_catalog_(ssot_parity|mirror)\.sql$/;

export function spiegelMigrationen(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => MUSTER.test(f))
    .sort();
}

/** Die jeweils neueste Spiegel-Migration — gegen sie prueft der Test. */
export function neuesteSpiegelMigration(): string {
  const alle = spiegelMigrationen();
  if (alle.length === 0) throw new Error('Keine Spiegel-Migration gefunden.');
  return alle[alle.length - 1]!;
}

/** Die VALUES-Zeilen: Plan, Key, Wert — sortiert, damit der Diff stabil ist. */
function wertezeilen(): string[] {
  const zeilen: string[] = [];
  for (const plan of Object.keys(PLAN_ENTITLEMENTS).sort()) {
    const satz = PLAN_ENTITLEMENTS[plan]!;
    for (const key of Object.keys(satz).sort()) {
      zeilen.push(`  ('${plan}', '${key}', ${satz[key as keyof typeof satz]})`);
    }
  }
  return zeilen;
}

/** Jeder Key, den die Quelle ueberhaupt vergibt — fuer das Vokabular. */
function vergebeneKeys(): string[] {
  const keys = new Set<string>();
  for (const satz of Object.values(PLAN_ENTITLEMENTS)) {
    for (const key of Object.keys(satz)) keys.add(key);
  }
  return [...keys].sort();
}

export function generierterBlock(): string {
  return [
    ANFANG,
    'INSERT INTO public.product_entitlements (product_id, entitlement_id, value)',
    'SELECT p.id, e.id, z.value',
    'FROM (VALUES',
    wertezeilen().join(',\n'),
    ') AS z(plan_key, key, value)',
    'JOIN public.entitlements e ON e.key = z.key',
    'JOIN public.products p',
    "  ON p.default_for_plan_key = z.plan_key",
    "  OR p.default_for_plan_key = z.plan_key || '_yearly'",
    'ON CONFLICT (product_id, entitlement_id)',
    'DO UPDATE SET value = EXCLUDED.value',
    'WHERE public.product_entitlements.value IS DISTINCT FROM EXCLUDED.value;',
    ENDE,
  ].join('\n');
}

function vollstaendigeMigration(version: string): string {
  const keys = vergebeneKeys();
  return [
    '-- Spiegel: Entitlement-Katalog auf PLAN_ENTITLEMENTS (shared/pricing.ts).',
    '--',
    `-- Erzeugt von scripts/generate-entitlement-mirror-sql.ts (${version}).`,
    '-- NICHT von Hand bearbeiten — neu erzeugen, wenn sich die Quelle aendert.',
    '--',
    '-- Diese Datei ist die jeweils gueltige Spiegelung der Quelle. Aendert sich',
    '-- PLAN_ENTITLEMENTS, entsteht eine NEUE Spiegel-Migration; die aelteren',
    '-- bleiben unberuehrt, weil sie angewandt sind.',
    '-- test/billing/entitlement-catalog-parity.test.ts vergleicht die Quelle',
    '-- gegen die neueste dieser Dateien; .github/workflows/entitlement-drift.yml',
    '-- prueft die Live-DB dagegen.',
    '--',
    '-- Additiv fuer den Bestand: reiner Upsert, `DO UPDATE` greift nur bei',
    '-- abweichendem Wert. Nichts wird geloescht. Jahresvarianten erben vom',
    '-- Monatszwilling. Plaene, die die Quelle nicht kennt (bronze/silver/gold,',
    '-- enterprise_public, free, free_tier), bleiben unberuehrt.',
    '--',
    '-- Das Wort fuer das Gegenteil von Einfuegen steht hier absichtlich nicht:',
    '-- test/billing/entitlement-catalog-parity.test.ts prueft die ganze Datei',
    '-- dagegen, Kommentare eingeschlossen. Grob, aber in der richtigen Richtung.',
    '',
    'BEGIN;',
    '',
    '-- ─── Waechter: jeder Key der Quelle muss im Vokabular stehen ────────────',
    '-- Ohne diesen Block wuerde der INNER JOIN unten eine Zuordnung mit',
    '-- unbekanntem Key still ueberspringen. Den Key eintraegt die Migration,',
    '-- die das Feature einfuehrt — hier wird nur geprueft, mit Namen.',
    'DO $$',
    'DECLARE fehlend text;',
    'BEGIN',
    "  SELECT string_agg(v.key, ', ' ORDER BY v.key) INTO fehlend",
    '  FROM (VALUES',
    keys.map((k) => `    ('${k}')`).join(',\n'),
    '  ) AS v(key)',
    '  WHERE NOT EXISTS (SELECT 1 FROM public.entitlements e WHERE e.key = v.key);',
    '  IF fehlend IS NOT NULL THEN',
    '    RAISE EXCEPTION',
    "      'Entitlement-Vokabular unvollstaendig: %. Erst die Feature-Migration, die den Key mit Beschreibung eintraegt.',",
    '      fehlend;',
    '  END IF;',
    'END $$;',
    '',
    '-- ─── Zuordnung Plan → Key → Wert (vollstaendig aus der Quelle) ──────────',
    generierterBlock(),
    '',
    'COMMIT;',
    '',
  ].join('\n');
}

function blockAus(sql: string): string {
  const start = sql.indexOf(ANFANG);
  const ende = sql.indexOf(ENDE);
  if (start < 0 || ende < 0) throw new Error('Kein GENERATED-Block in der Datei.');
  return sql.slice(start, ende + ENDE.length);
}

/**
 * Ab hier die Kommandozeile — und sie laeuft NUR beim direkten Aufruf.
 *
 * `test/billing/entitlement-catalog-parity.test.ts` importiert
 * `neuesteSpiegelMigration()` aus dieser Datei. Ohne diesen Waechter fuehrt
 * jeder Import den Rumpf mit aus: Der erste Entwurf hat bei drei Testlaeufen
 * drei Migrationen in `supabase/migrations/` geschrieben, jede mit der
 * Uhrzeit des Laufs als Version. In ESM gibt es kein `require.main` — der
 * Vergleich laeuft deshalb ueber den Pfad des Eintrittsmoduls.
 */
const direktAufgerufen =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

const args = new Set(process.argv.slice(2));

function pruefen(): never {
  const datei = neuesteSpiegelMigration();
  const ist = blockAus(readFileSync(join(MIGRATIONS, datei), 'utf8'));
  if (ist === generierterBlock()) {
    console.log(`✓ ${datei} spiegelt shared/pricing.ts.`);
    process.exit(0);
  }
  console.error(`✗ ${datei} weicht von shared/pricing.ts ab.`);
  console.error('');
  console.error('  Die bestehende Spiegel-Migration ist angewandt und wird NICHT');
  console.error('  editiert. Stattdessen eine neue erzeugen:');
  console.error('');
  console.error('    npm run gen:entitlement-mirror');
  console.error('');
  process.exit(1);
}

function schreiben(): void {
  // Version als Argument, sonst aus der Uhr. Sie muss nach der letzten Datei
  // auf `main` liegen — der Migration Collision Guard prueft das.
  const version =
    [...args].find((a) => /^\d{14}$/.test(a)) ??
    new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const ziel = join(MIGRATIONS, `${version}_entitlement_catalog_mirror.sql`);
  writeFileSync(ziel, vollstaendigeMigration(version));
  console.log(
    `✓ ${ziel} erzeugt (${wertezeilen().length} Zuordnungen, ${vergebeneKeys().length} Keys).`,
  );
}

if (direktAufgerufen) {
  if (args.has('--check')) pruefen();
  else schreiben();
}

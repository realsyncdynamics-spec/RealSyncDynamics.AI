#!/usr/bin/env tsx
/**
 * Erzeugt eine Spiegel-Migration fuer `PLAN_ENTITLEMENTS` aus shared/pricing.ts.
 *
 *   npm run gen:entitlement-mirror            # neue Migration, falls die Quelle abweicht
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
 * ── Entzug: die eine Richtung, die ein Upsert nicht kann ──────────────────
 *
 * Streicht jemand einen Key aus einem Plan, laesst der Generator nur das
 * Tupel weg — die Zeile in `product_entitlements` bleibt, und
 * `tenant_entitlements()` gewaehrt das Recht weiter. Ein automatisches
 * Loeschen waere die falsche Antwort: Die DB darf der Quelle voraus sein
 * (genau so kam `frontend.modernization` per Feature-Migration hinein, bevor
 * die Quelle es kannte), und ein Spiegel, der alles Unbekannte loescht, haette
 * zahlenden Kunden das Tool still wieder entzogen. Destruktive Migrationen
 * verbietet `CLAUDE.md` ohnehin.
 *
 * Deshalb: Der Generator **verweigert** eine neue Spiegel-Migration, solange
 * die Quelle ein Paar der bisher neuesten nicht mehr fuehrt. Der Entzug ist
 * eine Geschaeftsentscheidung mit eigener Migration und Begruendung; erst mit
 * `--entzug-quittiert` schreibt der Generator weiter und vermerkt die Paare
 * als `-- ENTZOGEN:` in der Datei. Der Paritaetstest prueft, dass zwischen
 * zwei Spiegeln kein Paar ohne diesen Vermerk verschwindet.
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
import { sqlString } from './generate-plan-catalog-sql';

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

/** Jede Migration im Verzeichnis, sortiert — nicht nur die Spiegel. */
export function alleMigrationen(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Die Version einer Migration, auf 14 Stellen aufgefuellt. Aeltere Dateien
 * tragen kuerzere Praefixe (`00001_`, `20260510_`); rechts mit Nullen
 * aufgefuellt sortieren sie dort ein, wo sie in der Kette stehen.
 */
function versionVon(datei: string): string {
  return (datei.match(/^\d+/)?.[0] ?? '').padEnd(14, '0');
}

/**
 * Warum eine Version NICHT taugt — oder `null`, wenn sie taugt.
 *
 * Verglichen wird gegen **alle** Migrationen, nicht nur gegen die Spiegel:
 *
 *   * Eine vergebene Version wuerde eine angewandte Migration ueberschreiben
 *     oder mit ihr kollidieren. (Befund aus dem CodeRabbit-Review zu PR #1616.)
 *   * Eine Version, die nicht neuer ist als die neueste Migration, kann vor
 *     der Feature-Migration liegen, die einen Key der Quelle erst ins Vokabular
 *     eintraegt. In einer frischen Kette (`Migration validation`) liefe der
 *     Spiegel dann zuerst und braeche am Vokabular-Waechter ab — genau der
 *     Fall von #1720 (`monitoring.browser_scan`, Feature-Migration
 *     `20260928163000`). Die Regel stand nur im PR-Text; hier wird sie
 *     erzwungen.
 *
 * Das betrifft nur das Schreiben eines neuen Spiegels. Bestehende Migrationen,
 * auch spaeter eingespielte mit aelterer Version (Backfills), prueft niemand
 * hiermit — `db push --include-all` nimmt sie unveraendert mit.
 */
export function versionUnzulaessig(version: string, migrationen: string[]): string | null {
  const vergeben = migrationen.find((f) => versionVon(f) === version);
  if (vergeben) return `Version ${version} ist vergeben (${vergeben}) — angewandte Migrationen werden nicht ueberschrieben.`;
  const neueste = [...migrationen].sort((a, b) => versionVon(a).localeCompare(versionVon(b))).at(-1);
  if (neueste !== undefined && version <= versionVon(neueste)) {
    return `Version ${version} ist nicht neuer als die neueste Migration (${neueste}).`;
  }
  return null;
}

/** Die VALUES-Zeilen: Plan, Key, Wert — sortiert, damit der Diff stabil ist. */
function wertezeilen(): string[] {
  const zeilen: string[] = [];
  for (const plan of Object.keys(PLAN_ENTITLEMENTS).sort()) {
    const satz = PLAN_ENTITLEMENTS[plan]!;
    for (const key of Object.keys(satz).sort()) {
      // Literale escapen wie der Katalog-Generator — Plaene und Keys kommen
      // aus unserer Quelle, aber eine Migration auf Platte soll nicht davon
      // abhaengen, dass nie ein Hochkomma darin steht.
      zeilen.push(`  (${sqlString(plan)}, ${sqlString(key)}, ${Number(satz[key as keyof typeof satz])})`);
    }
  }
  return zeilen;
}

/** Ein (Plan, Key)-Paar als ein Wert, damit Mengen es vergleichen koennen. */
const paar = (plan: string, key: string): string => `${plan} ${key}`;

/** Die Paare, die die Quelle heute vergibt. */
export function quellPaare(): Set<string> {
  const paare = new Set<string>();
  for (const [plan, satz] of Object.entries(PLAN_ENTITLEMENTS)) {
    for (const key of Object.keys(satz)) paare.add(paar(plan, key));
  }
  return paare;
}

/**
 * Plan → Key → Wert, wie ihn der GENERATED-Block einer Spiegel-Migration
 * vergibt. Der eine Parser fuer diesen Block — Generator, `--check`,
 * Entzugs-Vergleich und Paritaetstest lesen alle hierueber.
 */
export function werteAus(sql: string): Record<string, Record<string, number>> {
  const zeile = /^\s*\('([a-z_]+)',\s*'([a-z0-9_.\-]+)',\s*(-?\d+)\)/gm;
  const werte: Record<string, Record<string, number>> = {};
  for (const m of blockAus(sql).matchAll(zeile)) (werte[m[1]!] ??= {})[m[2]!] = Number(m[3]);
  return werte;
}

/** Die Paare, die eine Spiegel-Migration vergibt — aus ihrem GENERATED-Block. */
export function zuordnungenAus(sql: string): Set<string> {
  const paare = new Set<string>();
  for (const [plan, satz] of Object.entries(werteAus(sql))) {
    for (const key of Object.keys(satz)) paare.add(paar(plan, key));
  }
  return paare;
}

/** Die Paare, deren Entzug eine Spiegel-Migration ausdruecklich vermerkt. */
export function quittierteEntzuege(sql: string): Set<string> {
  const zeile = /^-- ENTZOGEN: ([a-z_]+) ([a-z0-9_.\-]+)\s*$/gm;
  return new Set([...sql.matchAll(zeile)].map((m) => paar(m[1]!, m[2]!)));
}

/** Was `vorher` vergab und `jetzt` nicht mehr — sortiert, fuer stabile Meldungen. */
export function entzogenZwischen(vorher: Set<string>, jetzt: Set<string>): string[] {
  return [...vorher].filter((p) => !jetzt.has(p)).sort();
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

function vollstaendigeMigration(version: string, entzogen: string[]): string {
  const keys = vergebeneKeys();
  // Nur wenn es einen gibt: der Vermerk, den der Paritaetstest einfordert.
  const entzug =
    entzogen.length === 0
      ? []
      : [
          '-- ─── Entzug (quittiert) ─────────────────────────────────────────────',
          '-- Diese Paare vergab die vorige Spiegel-Migration, die Quelle nicht mehr.',
          '-- Ein Spiegel entzieht nicht: Die Zeilen bleiben, bis eine eigene',
          '-- Entzugs-Migration sie mit Begruendung behandelt. Bis dahin meldet der',
          '-- Entitlement Drift Guard sie zu Recht als Abweichung.',
          ...entzogen.map((p) => `-- ENTZOGEN: ${p}`),
          '',
        ];
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
    ...entzug,
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
    keys.map((k) => `    (${sqlString(k)})`).join(',\n'),
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

export function blockAus(sql: string): string {
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
  const weg = entzogenZwischen(zuordnungenAus(readFileSync(join(MIGRATIONS, datei), 'utf8')), quellPaare());
  if (weg.length > 0) {
    console.error(`  Achtung: Die Quelle fuehrt ${weg.length} Paar(e) nicht mehr, die ${datei}`);
    console.error('  vergibt — ein Entzug. Siehe die Meldung beim Erzeugen.');
    console.error('');
  }
  process.exit(1);
}

function schreiben(): void {
  const vorige = neuesteSpiegelMigration();
  const vorigeSql = readFileSync(join(MIGRATIONS, vorige), 'utf8');

  // Nichts zu spiegeln: Die neueste Spiegel-Migration traegt die Quelle schon.
  // Eine weitere waere nur Rauschen in supabase/migrations, im Collision Guard
  // und im Deploy.
  if (blockAus(vorigeSql) === generierterBlock()) {
    console.log(`✓ ${vorige} spiegelt shared/pricing.ts bereits — keine neue Migration noetig.`);
    return;
  }

  // Version als Argument, sonst aus der Uhr. Sie muss eindeutig sein — der
  // Migration Collision Guard prueft das, auch gegen offene PRs. Keine runde
  // Stunde: die trifft ein zweiter PR am selben Tag mit derselben Ueberlegung.
  const version =
    [...args].find((a) => /^\d{14}$/.test(a)) ??
    new Date().toISOString().replace(/\D/g, '').slice(0, 14);

  const unzulaessig = versionUnzulaessig(version, alleMigrationen());
  if (unzulaessig) {
    console.error(`✗ ${unzulaessig}`);
    console.error('  Eine freie Version nach der neuesten Migration angeben (14 Stellen,');
    console.error('  keine runde Stunde) — sonst liegt der Spiegel womoeglich vor der');
    console.error('  Feature-Migration, die einen seiner Keys erst eintraegt.');
    process.exit(1);
  }

  const weg = entzogenZwischen(zuordnungenAus(vorigeSql), quellPaare());
  if (weg.length > 0 && !args.has('--entzug-quittiert')) {
    console.error(`✗ Die Quelle fuehrt ${weg.length} Paar(e) nicht mehr, die ${vorige} vergibt:`);
    for (const p of weg) console.error(`    ${p}`);
    console.error('');
    console.error('  Eine Spiegel-Migration entzieht nicht — sie macht nur Upserts, die');
    console.error('  Zeilen blieben und `tenant_entitlements()` gewaehrte weiter.');
    console.error('  Ein Entzug ist eine eigene Entscheidung: erst eine Migration, die ihn');
    console.error('  mit Begruendung umsetzt, dann hier quittieren:');
    console.error('');
    console.error('    npm run gen:entitlement-mirror -- --entzug-quittiert');
    console.error('');
    process.exit(1);
  }

  const ziel = join(MIGRATIONS, `${version}_entitlement_catalog_mirror.sql`);
  writeFileSync(ziel, vollstaendigeMigration(version, weg));
  console.log(
    `✓ ${ziel} erzeugt (${wertezeilen().length} Zuordnungen, ${vergebeneKeys().length} Keys).`,
  );
}

if (direktAufgerufen) {
  if (args.has('--check')) pruefen();
  else schreiben();
}

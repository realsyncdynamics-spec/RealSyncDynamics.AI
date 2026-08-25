#!/usr/bin/env node
// Kanonizitaets-Guard fuer Kontingente (AP-Canon).
//
// ── Die Entscheidung, die dieses Skript durchsetzt ────────────────────────
//
// Am 2026-08-25 hat der Eigentuemer festgelegt:
//
//   `plan.limits.*` ist die kanonische kommerzielle Quelle.
//   Was dem Kunden verkauft und angezeigt wird, ist der maximal
//   durchsetzbare Wert. `PLAN_ENTITLEMENTS['limit.*']` ist keine
//   zweite Wahrheit.
//
// Anlass war der Befund aus `docs/product/kontingente-messung.md` §0: Beide
// Seiten nennen fuer dieselbe Sache verschiedene Zahlen. Ein Gate, das gegen
// die falsche Zahl prueft, ist technisch korrekt und kommerziell falsch —
// genau der Fehler, den der Audit gerade gefunden hat.
//
// ── Warum das Skript heute gruen ist, obwohl Divergenzen bestehen ─────────
//
// Die Bereinigung der bekannten Faelle ist eine eigene Entscheidung mit
// Bestandskundenwirkung (siehe `docs/product/kanonische-kontingente.md`).
// Sie darf nicht als Nebenwirkung eines Guards passieren. Deshalb ist dieses
// Skript eine **Ratsche**, keine Schranke:
//
//   * Divergenz steht in der Grundlinie   → INFO, Code 0
//   * Divergenz neu hinzugekommen         → FAIL, Code 1
//   * Divergenz aus der Grundlinie behoben → FAIL, Code 1 (Grundlinie pflegen)
//
// So kann der Bestand geordnet abgebaut werden, ohne dass in der Zwischenzeit
// neue Divergenzen unbemerkt entstehen.
//
// Aufruf:  npm run check:limits
//          npm run check:limits -- --alle   (auch die deckungsgleichen Paare)

import { readFileSync } from 'node:fs';

const ALLE = process.argv.includes('--alle');

/**
 * Die Paarbildung. Links der Name auf der Preisseite, rechts der
 * Entitlement-Key, den der Server aufloest.
 *
 * Nicht jedes Feld hat ein Gegenstueck — `tenants`, `remediationPlans` und
 * `apiKeys` stehen nur auf der Preisseite, die Verbrauchs-Keys (`ai_*`,
 * `agent_runs_monthly`, ...) nur in der Berechtigung. Beides ist kein
 * Fehler, sondern wird unten getrennt ausgewiesen.
 */
const PAARE = {
  bots: 'limit.bots',
  answersPerMonth: 'limit.bot_messages_monthly',
  domains: 'limit.domains',
  automationRunsPerMonth: 'limit.automation_runs_monthly',
  seats: 'limit.team_seats',
  apiCallsPerMonth: 'limit.api_calls_monthly',
  evidenceStorageGb: 'limit.evidence_storage_gb',
  auditReportsPerMonth: 'limit.compliance_exports_monthly',
  bulkJobsPerMonth: 'limit.bulk_jobs_monthly',
};

/**
 * Bekannte Divergenzen, Stand 2026-08-25 (`aee1980`).
 *
 * Jede Zeile ist ein gemessener Befund, keine Freigabe. Wer eine Zeile
 * entfernt, muss die Divergenz vorher wirklich beseitigt haben — das Skript
 * prueft beide Richtungen.
 */
const GRUNDLINIE = new Set(JSON.parse(
  readFileSync(new URL('./limit-canonicity-baseline.json', import.meta.url), 'utf8'),
).map((e) => `${e.plan}:${e.feld}`));

const { ORDERED_PLANS, PLAN_ENTITLEMENTS } = await import('../shared/pricing.ts');

console.log('Kanonizitaet der Kontingente — plan.limits gegen PLAN_ENTITLEMENTS\n');

const daten = Object.fromEntries(ORDERED_PLANS.map((p) => [p.id, {
  availability: p.availability,
  limits: p.limits,
  ent: Object.fromEntries(
    Object.entries(PLAN_ENTITLEMENTS[p.id] ?? {}).filter(([k]) => k.startsWith('limit.')),
  ),
}]));

const abweichungen = [];
const gleich = [];
const nurPreisseite = [];
const nurBerechtigung = [];

for (const [plan, p] of Object.entries(daten)) {
  const gesehen = new Set();
  for (const [feld, key] of Object.entries(PAARE)) {
    const links = p.limits[feld];
    const rechts = p.ent[key];
    gesehen.add(key);
    if (rechts === undefined) {
      nurPreisseite.push({ plan, feld, key, wert: links });
      continue;
    }
    if (links === rechts) gleich.push({ plan, feld, key, wert: links });
    else abweichungen.push({ plan, feld, key, preisseite: links, berechtigung: rechts, availability: p.availability });
  }
  for (const key of Object.keys(p.ent)) {
    if (!gesehen.has(key)) nurBerechtigung.push({ plan, key, wert: p.ent[key] });
  }
}

const paare = abweichungen.length + gleich.length;
console.log(`Vergleichbare Paare: ${paare}  ·  deckungsgleich: ${gleich.length}  ·  abweichend: ${abweichungen.length}\n`);

if (abweichungen.length) {
  console.log('Abweichungen (Preisseite ist kanonisch):');
  for (const a of abweichungen) {
    const bekannt = GRUNDLINIE.has(`${a.plan}:${a.feld}`);
    const marke = bekannt ? '  ' : '‼️';
    const verkauft = a.availability !== 'legacy' ? ' [verkauft]' : '';
    console.log(`${marke} ${a.plan.padEnd(11)} ${a.feld.padEnd(22)} Preisseite ${String(a.preisseite).padStart(9)}  Berechtigung ${String(a.berechtigung).padStart(9)}${verkauft}`);
  }
  console.log('');
}

if (ALLE && gleich.length) {
  console.log('Deckungsgleich:');
  for (const g of gleich) console.log(`   ${g.plan.padEnd(11)} ${g.feld.padEnd(22)} ${g.wert}`);
  console.log('');
}

console.log(`Nur auf der Preisseite (kein Entitlement): ${nurPreisseite.length}`);
console.log(`Nur in der Berechtigung (kein Preisseiten-Feld): ${nurBerechtigung.length}\n`);

// ── Die Ratsche ──────────────────────────────────────────────────────────
const jetzt = new Set(abweichungen.map((a) => `${a.plan}:${a.feld}`));
const neu = [...jetzt].filter((k) => !GRUNDLINIE.has(k));
const behoben = [...GRUNDLINIE].filter((k) => !jetzt.has(k));

if (neu.length) {
  console.error('FEHLER — neue Divergenzen gegenueber der Grundlinie:');
  for (const k of neu) console.error(`  ${k}`);
  console.error('\nEntweder den Wert angleichen oder die Divergenz bewusst in');
  console.error('scripts/limit-canonicity-baseline.json aufnehmen — mit Begruendung.');
  process.exit(1);
}

if (behoben.length) {
  console.error('FEHLER — Divergenzen aus der Grundlinie sind verschwunden:');
  for (const k of behoben) console.error(`  ${k}`);
  console.error('\nDas ist vermutlich gut. Die Grundlinie gehoert dann mitgepflegt,');
  console.error('damit sie weiter das misst, was sie behauptet.');
  process.exit(1);
}

console.log(`OK — ${abweichungen.length} bekannte Divergenzen, keine neue.`);

#!/usr/bin/env node
// Entitlement-Paritaets-Guard (AP1).
//
// Prueft, dass `shared/pricing.ts` und die Datenbank dasselbe sagen: Welche
// Entitlement-Keys existieren, und welcher Plan gewaehrt welchen mit welchem
// Wert.
//
// ── Warum es diesen Guard braucht ──────────────────────────────────────────
//
// Bis AP1 gab es zwei Definitionen dessen, was ein Plan enthaelt:
// `plan.modules` in der Preis-Quelle und `product_entitlements` in der
// Datenbank. Autorisiert hat immer die Datenbank; angezeigt wurde nach
// `plan.modules`. Drei Stellen gingen dabei nachweislich auseinander:
//
//   governance_core  Oberflaeche sagte "ab Growth", DB sagte "ab Agency"
//   website_chat     Oberflaeche sagte "ab Starter", DB sagte "ab Growth"
//   booking          Oberflaeche sagte "nie", DB gewaehrte es ab Growth
//
// Seit AP1 ist `PLAN_ENTITLEMENTS` die Spiegelung des Migrationsstands.
// Dieser Guard haelt sie daran gebunden — sonst driftet sie beim naechsten
// Migrationslauf lautlos wieder ab, und die Oberflaeche verspricht wieder
// etwas anderes, als der Server zulaesst.
//
// ── Prueforichtungen ───────────────────────────────────────────────────────
//
//   1. Key fehlt in der DB          → FAIL. Die Oberflaeche nennt etwas, das
//                                     zur Laufzeit nicht existiert.
//   2. Key fehlt in der Quelle      → FAIL. Die DB gewaehrt etwas, das die
//                                     Quelle nicht kennt — niemand sieht es.
//   3. Wert weicht ab               → FAIL. Anzeige und Autorisierung nennen
//                                     verschiedene Kontingente.
//   4. Plan nur in der DB           → INFO. Legacy-Plaene (bronze/silver/gold)
//                                     sind bewusst nicht in der Quelle.
//
// ── Zugriff ────────────────────────────────────────────────────────────────
//
// Entweder gegen eine lokale PostgreSQL (PGHOST/PGPORT/PGUSER/PGDATABASE,
// per `psql`) oder gegen die Supabase Management API
// (SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID) — dieselben Secrets wie
// beim Function-ACL-Guard.
//
// Ohne beides beendet sich das Skript mit Hinweis und Code 0. Ein Guard, der
// ohne Zugangsdaten rot wird, wird abgeschaltet statt beachtet.
//
// Aufruf:  npm run check:entitlements
//          npm run check:entitlements -- --matrix   (Uebersicht je Plan)

import { execFileSync } from 'node:child_process';

const MATRIX = process.argv.includes('--matrix');

const ABFRAGE = `
select p.default_for_plan_key as plan_key, e.key, pe.value
from products p
join product_entitlements pe on pe.product_id = p.id
join entitlements e on e.id = pe.entitlement_id
where p.default_for_plan_key is not null
order by 1, 2
`;

/** Liest die Zuordnung aus einer lokalen PostgreSQL via psql. */
function ausLokalerDatenbank() {
  try {
    const roh = execFileSync('psql', ['-tAF', '', '-c', ABFRAGE], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return roh
      .split('\n')
      .filter(Boolean)
      .map((z) => {
        const [planKey, key, value] = z.split('');
        return { planKey, key, value: Number(value) };
      });
  } catch {
    return null;
  }
}

/** Liest die Zuordnung ueber die Supabase Management API. */
async function ausManagementApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectId = process.env.SUPABASE_PROJECT_ID;
  if (!token || !projectId) return null;

  const resp = await fetch(
    `https://api.supabase.com/v1/projects/${projectId}/database/query`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: ABFRAGE }),
    },
  );
  if (!resp.ok) {
    console.error(`Management-API antwortete ${resp.status}`);
    return null;
  }
  const zeilen = await resp.json();
  return zeilen.map((z) => ({ planKey: z.plan_key, key: z.key, value: Number(z.value) }));
}

const { PLAN_ENTITLEMENTS, ENTITLEMENT_KEYS } = await import('../shared/pricing.ts');

const ausDb = ausLokalerDatenbank() ?? (await ausManagementApi());
if (!ausDb) {
  console.log(
    'ℹ️  Entitlement-Paritaet uebersprungen: weder lokale PostgreSQL (psql) noch ' +
      'SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID verfuegbar.',
  );
  process.exit(0);
}

// DB-Zuordnung nach Plan buendeln. Jahresvarianten erben von ihrem
// Monatszwilling und werden nicht getrennt gefuehrt — die Quelle kennt sie
// als `yearlyPlanKey`, nicht als eigenen Satz.
const db = new Map();
for (const { planKey, key, value } of ausDb) {
  if (planKey.endsWith('_yearly')) continue;
  if (!db.has(planKey)) db.set(planKey, new Map());
  db.get(planKey).set(key, value);
}

const befunde = [];
const info = [];

// Vokabular: jeder Key der Quelle muss in der DB existieren.
const dbKeys = new Set(ausDb.map((z) => z.key));
for (const key of ENTITLEMENT_KEYS) {
  if (!dbKeys.has(key)) {
    info.push(`Key "${key}" ist in keinem Plan zugeordnet (existiert evtl. ohne Plan)`);
  }
}

// Plan fuer Plan vergleichen.
for (const [planKey, quelle] of Object.entries(PLAN_ENTITLEMENTS)) {
  const gegen = db.get(planKey);
  if (!gegen) {
    befunde.push(`Plan "${planKey}" steht in der Quelle, hat aber kein Produkt in der DB`);
    continue;
  }
  for (const [key, wert] of Object.entries(quelle)) {
    if (!gegen.has(key)) {
      befunde.push(`${planKey}: "${key}" steht in der Quelle, fehlt in der DB`);
    } else if (gegen.get(key) !== wert) {
      befunde.push(`${planKey}: "${key}" Quelle=${wert} DB=${gegen.get(key)}`);
    }
  }
  for (const key of gegen.keys()) {
    if (!(key in quelle)) {
      befunde.push(`${planKey}: "${key}" steht in der DB, fehlt in der Quelle`);
    }
  }
}

// Plaene, die es nur in der DB gibt — Legacy, kein Fehler.
for (const planKey of db.keys()) {
  if (!(planKey in PLAN_ENTITLEMENTS)) {
    info.push(`Plan "${planKey}" existiert nur in der DB (${db.get(planKey).size} Keys) — Legacy`);
  }
}

if (MATRIX) {
  console.log('\nPlan                 Quelle    DB   Differenzen');
  console.log('─────────────────────────────────────────────────');
  const alle = new Set([...Object.keys(PLAN_ENTITLEMENTS), ...db.keys()]);
  for (const planKey of [...alle].sort()) {
    const q = PLAN_ENTITLEMENTS[planKey] ? Object.keys(PLAN_ENTITLEMENTS[planKey]).length : 0;
    const d = db.get(planKey)?.size ?? 0;
    const diff = befunde.filter((b) => b.startsWith(`${planKey}:`)).length;
    console.log(
      `${planKey.padEnd(20)} ${String(q).padStart(6)} ${String(d).padStart(5)}   ${diff === 0 ? '—' : diff}`,
    );
  }
  console.log('');
}

for (const zeile of info) console.log(`ℹ️  ${zeile}`);

if (befunde.length > 0) {
  console.error(`\n✗ ${befunde.length} Abweichung(en) zwischen shared/pricing.ts und der Datenbank:\n`);
  for (const b of befunde) console.error(`   ${b}`);
  console.error('\n   Quelle nachziehen oder eine Migration ergaenzen — nicht beides driften lassen.');
  process.exit(1);
}

console.log('✓ shared/pricing.ts und die Datenbank sagen dasselbe.');

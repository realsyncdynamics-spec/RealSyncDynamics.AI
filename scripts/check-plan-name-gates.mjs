#!/usr/bin/env node
// Ratsche gegen Zugriffsprüfungen auf Plan-NAMEN.
//
// ## Was hier verteidigt wird
//
// `docs/architecture/target-architecture.md` §10 bindet drei Dinge fest,
// damit der spätere Umbau auf BASE + MODULE + SCALE möglich bleibt. Die
// mittlere lautet:
//
//   „Zugriffsprüfungen laufen weiter ausschliesslich über hasPermission(),
//    hasModule() und limitOf(). **Genau das macht den Umbau überhaupt
//    möglich**: weil kein Code an Plan-Namen hängt, ist die Umstellung auf
//    BASE + MODULE + SCALE eine Katalogänderung, kein Refactoring der
//    Anwendung."
//
// Diese Zusage war zum Zeitpunkt der Einführung dieses Skripts **nicht
// erfüllt** — vier Fundstellen hingen an Plan-Namen, drei davon an echten
// Berechtigungen (Kontingent, Monitoring-Takt, Aufbewahrungsdauer).
//
// ## Warum eine Ratsche und keine Reparatur
//
// Jede der drei Fundstellen entscheidet, was ein zahlender Kunde bekommt.
// Sie zu ändern verschiebt Berechtigungen — nach CLAUDE.md §10.3 eine
// Funktionsänderung mit Fragepflicht, und nach der Kontingent-Regel („keine
// stillschweigende Kürzung bei Bestandskunden") nichts, was ein Skript
// nebenbei tut.
//
// Also dasselbe Vorgehen wie bei `check:limits`: der Bestand wird benannt
// und datiert, **neue** Verstösse werden blockiert. Die Zusage aus §10 wird
// damit von einer Behauptung zu einer Schranke — ohne dass sich für einen
// einzigen Kunden etwas ändert.
//
// Aufruf:
//   node scripts/check-plan-name-gates.mjs            prüfen
//   node scripts/check-plan-name-gates.mjs --json     maschinenlesbar
//   node scripts/check-plan-name-gates.mjs --update   Grundlinie nachziehen

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const BASELINE = join(ROOT, 'scripts/plan-name-gate-baseline.json');

/** Die sechs Abo-Pläne aus `shared/pricing.ts`. „scale" ist untersagt. */
const PLAN_NAMES = ['free', 'starter', 'growth', 'agency', 'enterprise', 'partner'];

/** Verzeichnisse, in denen ein Plan-Name-Vergleich ein Gate sein kann. */
const SCAN_DIRS = ['src', 'supabase/functions', 'shared'];

/**
 * Dateien, in denen der Vergleich zum Gegenstand gehört, nicht zum Verstoss.
 *
 * `shared/pricing.ts` und sein Deno-Zwilling **definieren** die Pläne; dort
 * steht der Name naturgemäss. Beide enthalten ausserdem den Regeltext
 * („String-Vergleiche wie `if (plan === 'agency')`") — ein Kommentar, der die
 * Regel zitiert, ist kein Bruch der Regel.
 */
const EXEMPT = new Set([
  'shared/pricing.ts',
  'supabase/functions/_shared/pricing.generated.ts',
]);

/**
 * Ein Vergleich einer plan-artigen Grösse mit einem Plan-Namen.
 *
 * Bewusst eng: `plan`, `tier`, `planId`, `planKey` und Eigenschaftszugriffe
 * darauf. Ein `source === 'starter_3_months_free'` (Kampagnen-Kennung) fällt
 * nicht darunter, weil die linke Seite nicht plan-artig heisst — genau die
 * Sorte Fehlalarm, die eine Ratsche unbrauchbar macht.
 */
const GATE_PATTERN = new RegExp(
  String.raw`\b(?:\w+\.)?(?:plan|tier|planId|planKey|currentPlan|planName)\s*(?:===|!==|==|!=)\s*['"](` +
    PLAN_NAMES.join('|') +
    String.raw`)['"]`,
  'g',
);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function findGates() {
  const found = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file);
      if (EXEMPT.has(rel)) continue;

      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // Reine Kommentarzeilen zitieren die Regel oft, statt sie zu brechen.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        GATE_PATTERN.lastIndex = 0;
        let m;
        while ((m = GATE_PATTERN.exec(line)) !== null) {
          found.push({ datei: rel, zeile: i + 1, plan: m[1], code: trimmed.slice(0, 160) });
        }
      });
    }
  }
  return found.sort((a, b) => a.datei.localeCompare(b.datei) || a.zeile - b.zeile);
}

/** Fundstellen sind gleich, wenn Datei und Plan übereinstimmen — nicht die Zeile. */
function keyOf(g) {
  return `${g.datei}::${g.plan}`;
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const update = args.includes('--update');

const gates = findGates();
let baseline = [];
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  if (!update) {
    console.error(`Grundlinie fehlt: ${relative(ROOT, BASELINE)}. Mit --update anlegen.`);
    process.exit(1);
  }
}

if (update) {
  const known = new Map(baseline.map((b) => [keyOf(b), b]));
  // Nach demselben Schluessel zusammenfassen, mit dem geprueft wird. Sonst
  // stuenden drei Zeilen derselben Datei dreimal in der Grundlinie und eine
  // Umsortierung im Code sähe wie eine Änderung aus.
  const merged = new Map();
  for (const g of gates) {
    const key = keyOf(g);
    if (merged.has(key)) {
      merged.get(key).fundstellen += 1;
      continue;
    }
    const prev = known.get(key);
    merged.set(key, {
      datei: g.datei,
      plan: g.plan,
      fundstellen: 1,
      art: prev?.art ?? 'UNGEPRUEFT',
      grund: prev?.grund ?? 'Noch nicht eingeordnet — art und grund von Hand ergaenzen.',
      seit: prev?.seit ?? new Date().toISOString().slice(0, 10),
    });
  }
  const next = [...merged.values()];
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Grundlinie geschrieben: ${next.length} Eintraege aus ${gates.length} Fundstellen.`);
  process.exit(0);
}

const baselineKeys = new Set(baseline.map(keyOf));
const foundKeys = new Set(gates.map(keyOf));

const neu = gates.filter((g) => !baselineKeys.has(keyOf(g)));
const verschwunden = baseline.filter((b) => !foundKeys.has(keyOf(b)));

if (asJson) {
  console.log(JSON.stringify({
    summary: { gefunden: gates.length, grundlinie: baseline.length, neu: neu.length, verschwunden: verschwunden.length },
    neu, verschwunden,
  }, null, 2));
  process.exit(neu.length > 0 ? 1 : 0);
}

console.log(`Plan-Namen-Gates: ${gates.length} gefunden, ${baseline.length} in der Grundlinie.\n`);

if (neu.length > 0) {
  console.error('❌ NEUE Zugriffsprüfung auf einen Plan-Namen:\n');
  for (const g of neu) {
    console.error(`   ${g.datei}:${g.zeile}  (${g.plan})`);
    console.error(`      ${g.code}\n`);
  }
  console.error('Zielarchitektur §10 verlangt hasPermission(), hasModule() oder limitOf().');
  console.error('Ein Vergleich auf den Plan-Namen macht den Umbau auf BASE + MODULE + SCALE');
  console.error('zu einem Refactoring der Anwendung statt zu einer Katalogaenderung.\n');
  console.error('Ist die Fundstelle kein Gate (z. B. reines Routing), mit --update');
  console.error('nachziehen UND in der Grundlinie art/grund ausfuellen.');
  process.exit(1);
}

if (verschwunden.length > 0) {
  console.log('✓ Aus der Grundlinie verschwunden — bitte mit --update nachziehen:\n');
  for (const b of verschwunden) console.log(`   ${b.datei} (${b.plan})`);
  console.log('');
}

console.log('✅ Keine neuen Plan-Namen-Gates.');

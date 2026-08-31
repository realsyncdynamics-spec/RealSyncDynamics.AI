#!/usr/bin/env node
/**
 * COMMERCIAL-SSOT: temporary production hotfix.
 * Canonical source migration tracked in Phase 2.
 *
 * Guard: Kein öffentlicher Bereich nennt den Betrag eines Plans, den man
 * heute nicht im Self-Service kaufen kann.
 *
 * Warum genau diese Regel? Sie ist die maschinelle Fassung des Grundsatzes,
 * an dem sich Spur A dreimal abgearbeitet hat:
 *
 *   Ein öffentlich zugesicherter Preis ist ein Angebot. Es darf nur dort
 *   stehen, wo der Kaufpfad es auch einlösen kann.
 *
 * Dreimal stand ein Betrag öffentlich, den `stripe-checkout` nicht einlösen
 * konnte — Enterprise 1.249 € (Sentinel statt Stripe-Price), Agency 699 €
 * und Partner 1.999 € (seit AP2 stillgelegt, PLAN_RETIRED). Zweimal war die
 * Stelle per Literal-Grep nicht auffindbar: das JSON-LD steckt im
 * HTML-Template, der Betrag im ROI-Rechner kam aus der SSoT.
 *
 * Der Guard prüft deshalb den Betrag, nicht den Plannamen.
 *
 * Ratsche, keine Schranke — nach dem Vorbild von `check:limits`: bekannte
 * Fundstellen aus der Grundlinie sind INFO, neue sind rot, und aus der
 * Grundlinie verschwundene sind ebenfalls rot (sonst verwaist sie still).
 *
 * Nicht geprüft: Beträge verkaufbarer Pläne (Starter, Growth). Die sind
 * einlösbar; sie aus der SSoT zu beziehen ist eine Aufräumaufgabe (AP10),
 * keine Angebots-Sicherheitsfrage.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'offer-price-baseline.json');

/** Aus shared/pricing.ts gelesen, damit der Guard keine zweite Preisquelle wird. */
function nonSellableAmounts() {
  const src = readFileSync(join(ROOT, 'shared', 'pricing.ts'), 'utf8');
  const amounts = new Map(); // Betrag -> Plan-Id
  // Blöcke: von `id: '<x>'` bis zum nächsten `id: '<y>'` auf derselben Ebene.
  const ids = [...src.matchAll(/^    id: '([a-z_]+)',$/gm)];
  for (let i = 0; i < ids.length; i++) {
    const start = ids[i].index;
    const end = i + 1 < ids.length ? ids[i + 1].index : src.length;
    const block = src.slice(start, end);
    const planId = ids[i][1];

    const availability = block.match(/availability: '([a-z_]+)'/)?.[1];
    const onRequest = /priceOnRequest: true/.test(block);
    // Die Jahresvariante kann einzeln unverkäuflich sein, während der
    // Monatsplan normal weiterläuft: für `starter_yearly` und `growth_yearly`
    // steht in `public.products` nur ein Platzhalter statt einer echten
    // Stripe-Price, der Jahres-Checkout endet mit PRICE_NOT_CONFIGURED.
    // Deshalb werden Monats- und Jahresbetrag getrennt bewertet.
    const yearlyBlocked = /yearlyCheckoutUnavailable: true/.test(block);
    if (!availability) continue;

    const price = block.match(/price: \{ monthlyEur: ([\d_]+), yearlyEur: ([\d_]+|null)/);
    if (!price) continue;
    const monthly = Number(price[1].replace(/_/g, ''));
    const yearly = price[2] === 'null' ? null : Number(price[2].replace(/_/g, ''));

    // Der Monatsbetrag ist nur dann ein Angebot ohne Kaufpfad, wenn der Plan
    // selbst keinen Self-Service-Abschluss zulässt.
    const monthlyBlocked = !(availability === 'self_service' && !onRequest);
    if (monthlyBlocked && monthly > 0) amounts.set(monthly, planId);
    if (yearly && (monthlyBlocked || yearlyBlocked)) {
      amounts.set(yearly, `${planId} (jährlich)`);
    }
  }
  return amounts;
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'playwright-report']);
function collectFiles() {
  const files = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|html)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) files.push(p);
    }
  })(join(ROOT, 'src'));
  // Kein existsSync davor: Pruefen-dann-Lesen ist eine Race (TOCTOU) — die
  // Datei kann zwischen beiden Aufrufen verschwinden. Stattdessen lesen und
  // ein fehlendes File am Fehlercode erkennen.
  const indexHtml = join(ROOT, 'index.html');
  try {
    readFileSync(indexHtml);
    files.push(indexHtml);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return files;
}

/**
 * Kommentare sind keine Angebote. Die Erkennung ist bewusst zustandsbasiert
 * statt zeilenweise: Ein mehrzeiliger Kommentar nennt den Betrag oft erst in
 * einer Folgezeile, die fuer sich genommen wie Code aussieht. Eine
 * zeilenweise Pruefung meldete deshalb die eigenen Erklaertexte dieses
 * Branches als Fund.
 */
function commentMask(lines) {
  const inComment = new Array(lines.length).fill(false);
  let block = false;   // /* … */  und  {/* … */}
  let html = false;    // <!-- … -->
  lines.forEach((line, i) => {
    const t = line.trim();
    if (block || html) { inComment[i] = true; }
    let rest = line;
    while (rest.length) {
      if (block) {
        const end = rest.indexOf('*/');
        if (end === -1) { rest = ''; break; }
        block = false; rest = rest.slice(end + 2); inComment[i] = true;
        continue;
      }
      if (html) {
        const end = rest.indexOf('-->');
        if (end === -1) { rest = ''; break; }
        html = false; rest = rest.slice(end + 3); inComment[i] = true;
        continue;
      }
      const lineC = rest.indexOf('//');
      const blockC = rest.indexOf('/*');
      const htmlC = rest.indexOf('<!--');
      const first = [lineC, blockC, htmlC].filter((n) => n !== -1).sort((a, b) => a - b)[0];
      if (first === undefined) break;
      if (first === lineC) { if (rest.slice(0, first).trim() === '') inComment[i] = true; rest = ''; break; }
      if (first === blockC) { block = true; if (rest.slice(0, first).trim() === '') inComment[i] = true; rest = rest.slice(first + 2); continue; }
      html = true; if (rest.slice(0, first).trim() === '') inComment[i] = true; rest = rest.slice(first + 4);
    }
    // Reine Fortsetzungszeile eines JSDoc-Blocks
    if (t.startsWith('*')) inComment[i] = true;
  });
  return inComment;
}

function scan(amounts) {
  const findings = [];
  for (const file of collectFiles()) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    const lines = readFileSync(file, 'utf8').split('\n');
    const inComment = commentMask(lines);
    lines.forEach((line, idx) => {
      if (inComment[idx]) return;
      for (const [amount, planId] of amounts) {
        const plain = String(amount);
        const dotted = plain.replace(/(\d)(\d{3})$/, '$1.$2');
        for (const pat of new Set([plain, dotted])) {
          const re = new RegExp(`(^|[^\\d.,_])${pat.replace('.', '\\.')}([^\\d.,_]|$)`);
          if (re.test(line)) {
            findings.push({ id: `${rel}:${idx + 1}`, amount, planId, line: line.trim().slice(0, 120) });
            return;
          }
        }
      }
    });
  }
  return findings;
}

const amounts = nonSellableAmounts();
if (amounts.size === 0) {
  console.error('✗ Keine nicht-verkaufbaren Beträge aus shared/pricing.ts gelesen — Parser prüfen.');
  process.exit(2);
}

const findings = scan(amounts);
// Auch hier kein existsSync: Eine fehlende Grundlinie ist ein legitimer
// Startzustand und wird am Fehlercode erkannt, nicht vorab abgefragt.
let baseline = { known: {} };
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const known = baseline.known ?? {};
const foundIds = new Set(findings.map((f) => f.id));
const isUpdate = process.argv.includes('--update');

if (isUpdate) {
  const next = { known: {} };
  for (const f of findings.sort((a, b) => a.id.localeCompare(b.id))) {
    next.known[f.id] = known[f.id] ?? `${f.planId} · ${f.amount} €`;
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`✓ Grundlinie aktualisiert: ${findings.length} bekannte Fundstellen.`);
  process.exit(0);
}

const added = findings.filter((f) => !(f.id in known));
const removed = Object.keys(known).filter((id) => !foundIds.has(id));

console.log(`Beträge ohne Self-Service-Kaufpfad: ${[...amounts.entries()].map(([a, p]) => `${a} € (${p})`).join(', ')}`);
console.log(`Fundstellen: ${findings.length} — davon ${findings.length - added.length} bekannt.\n`);

let failed = false;
if (added.length) {
  failed = true;
  console.error('❌ NEUE öffentliche Beträge für Pläne ohne Kaufpfad:\n');
  for (const f of added) {
    console.error(`   ${f.id}`);
    console.error(`     ${f.amount} € gehört zu ${f.planId} — dort gibt es keinen Self-Service-Checkout.`);
    console.error(`     ${f.line}\n`);
  }
  console.error('   Entweder den Betrag entfernen (auf Anfrage / nach Vertrag) oder,');
  console.error('   falls der Plan wieder verkauft werden soll, das in shared/pricing.ts abbilden.\n');
}
if (removed.length) {
  failed = true;
  console.error('❌ Aus der Grundlinie verschwunden — bitte mit `--update` nachziehen:\n');
  for (const id of removed) console.error(`   ${id}  (${known[id]})`);
  console.error('');
}
if (!failed) console.log('✓ Kein öffentlicher Betrag ohne einlösbaren Kaufpfad.');
process.exit(failed ? 1 : 0);

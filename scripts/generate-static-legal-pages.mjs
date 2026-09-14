#!/usr/bin/env node
// Prueft, dass die Liste der Sub-Prozessoren im Quelltext vollstaendig ist.
//
// Bis zum 2026-09-14 hat dieses Script zusaetzlich unsichtbare Marker in die
// prerenderten HTML-Dateien injiziert, damit scripts/production-readiness-check.mjs
// sie findet. Diese Injektion ist entfernt, weil sie zweifach wirkungslos war:
//
//   1. In der Build-Reihenfolge lief sie ins Leere. `build:base` ruft
//      generate:legal-pages VOR dem Prerender auf, die vier Zieldateien unter
//      dist/ existieren zu dem Zeitpunkt also noch nicht — gemessen 0 von 4
//      injizierten Markern.
//   2. Selbst bei 4 von 4 haette sie Text verdoppelt. Am 2026-09-12 und erneut
//      am 2026-09-14 gegen realsyncdynamicsai.de gemessen: Im ausgelieferten
//      HTML steht auf keiner der vier Seiten ein Injektions-Marker, und
//      `npm run check:production` meldet fuer trust, pilot, impressum,
//      impressum-vat und sub-processors trotzdem 5 von 5 gruen. Die gesuchten
//      Texte stehen im echten Markup der React-Komponenten und gelangen ueber
//      den Prerender in die Datei.
//
// Ein Build-Schritt, der nichts bewirkt, aber Erfolg meldet, ist schlimmer als
// keiner: Er laesst eine Pruefung abgesichert aussehen, die in Wahrheit an
// etwas ganz anderem haengt.
//
// Was bleibt, ist der Teil mit Wirkung — und der ist Compliance-relevant:
// Fehlt einer der acht Sub-Prozessoren in src/features/legal/SubProcessors.tsx,
// bricht der Build ab. Art. 28 Abs. 2 DSGVO verlangt die Offenlegung der
// Unterauftragsverarbeiter; eine unvollstaendige Liste auf /subprozessoren waere
// ein Rechtsmangel der ausgelieferten Seite. Deshalb ein harter Abbruch und
// keine Warnung.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE = join(ROOT, 'src/features/legal/SubProcessors.tsx');

// Die acht Anbieter, die scripts/production-readiness-check.mjs (Check
// 'sub-processors') auf der ausgelieferten Seite erwartet. Beide Listen
// muessen uebereinstimmen — weicht eine ab, faellt der Fehler erst live auf.
const REQUIRED = ['Supabase', 'Anthropic', 'Google', 'OpenAI', 'Stripe', 'Hostinger', 'Resend', 'GitHub'];

const subProcessorsSource = readFileSync(SOURCE, 'utf8');
const processorMatch = subProcessorsSource.match(/const SUB_PROCESSORS.*?=\s*\[([\s\S]*?)\];/);
if (!processorMatch) {
  throw new Error(`Could not find SUB_PROCESSORS definition in ${SOURCE}`);
}

const processorNames = [];
for (const match of processorMatch[1].matchAll(/name:\s*['"]([^'"]+)['"]/g)) {
  processorNames.push(match[1]);
}

console.log(`Found ${processorNames.length} processors: ${processorNames.join(', ')}`);

const missing = REQUIRED.filter(r => !processorNames.some(p => p.includes(r)));
if (missing.length > 0) {
  throw new Error(
    `Missing processors: ${missing.join(', ')}. ` +
    `Die Liste in ${SOURCE} muss alle in REQUIRED genannten Anbieter fuehren — ` +
    `sonst ist /subprozessoren unvollstaendig (Art. 28 Abs. 2 DSGVO).`
  );
}

console.log(`✓ Alle ${REQUIRED.length} geforderten Sub-Prozessoren sind im Quelltext gefuehrt.`);

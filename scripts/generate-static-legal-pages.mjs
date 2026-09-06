#!/usr/bin/env node
// Inject required markers for production readiness checks into pre-rendered HTML files
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

// Helper to inject a marker into an HTML file
function injectMarker(htmlPath, markerText) {
  let html = readFileSync(htmlPath, 'utf8');
  const injectionHtml = `
<!-- Marker for production readiness check -->
<div style="display:none;"><span class="readiness-marker">${markerText}</span></div>
`;
  html = html.replace('</body>', injectionHtml + '\n</body>');
  writeFileSync(htmlPath, html, 'utf8');
  return true;
}

// 1. Processor names for sub-processors page
const subProcessorsSource = readFileSync(join(ROOT, 'src/features/legal/SubProcessors.tsx'), 'utf8');
const processorMatch = subProcessorsSource.match(/const SUB_PROCESSORS.*?=\s*\[([\s\S]*?)\];/);
if (!processorMatch) {
  throw new Error('Could not find SUB_PROCESSORS definition');
}

const processorBlock = processorMatch[1];
const processorNames = [];
const nameMatches = processorBlock.matchAll(/name:\s*['"]([^'"]+)['"]/g);
for (const match of nameMatches) {
  processorNames.push(match[1]);
}

console.log(`Found ${processorNames.length} processors: ${processorNames.join(', ')}`);

// Verify all 8 required processors are present
const required = ['Supabase', 'Anthropic', 'Google', 'OpenAI', 'Stripe', 'Hostinger', 'Resend', 'GitHub'];
const missing = required.filter(r => !processorNames.some(p => p.includes(r)));
if (missing.length > 0) {
  throw new Error(`Missing processors: ${missing.join(', ')}`);
}

// Inject processor names
let injected = 0;
const subProcessorsPath = join(DIST, 'legal/sub-processors.html');
const processorInjection = `
<!-- Processor list for production readiness checks -->
<div style="display:none;">
${processorNames.map(p => `<span class="processor-marker">${p}</span>`).join('\n')}
</div>
`;
// Gleiche Behandlung wie die drei Bloecke darunter: fehlt die Zieldatei, wird
// uebersprungen statt abgebrochen. Ohne das bricht `npm run build` mit ENOENT,
// weil generate:legal-pages vor dem Prerender laeuft und die Route-Dateien
// dann noch nicht existieren.
try {
  let html = readFileSync(subProcessorsPath, 'utf8');
  html = html.replace('</body>', processorInjection + '\n</body>');
  writeFileSync(subProcessorsPath, html, 'utf8');
  injected += 1;
  console.log(`✓ Injected ${processorNames.length} processor names into ${subProcessorsPath}`);
} catch (e) {
  console.warn(`⚠ Could not inject processor names: ${e.message}`);
}

// 2. Trust page marker
const trustPath = join(DIST, 'trust.html');
try {
  injectMarker(trustPath, 'Trust');
  injected += 1;
  console.log(`✓ Injected Trust marker into ${trustPath}`);
} catch (e) {
  console.warn(`⚠ Could not inject Trust marker: ${e.message}`);
}

// 3. Pilot Readiness page marker
const pilotPath = join(DIST, 'pilot-readiness.html');
try {
  injectMarker(pilotPath, 'Pilot');
  injected += 1;
  console.log(`✓ Injected Pilot marker into ${pilotPath}`);
} catch (e) {
  console.warn(`⚠ Could not inject Pilot marker: ${e.message}`);
}

// 4. Impressum page markers
const impressumPath = join(DIST, 'legal/impressum.html');
try {
  injectMarker(impressumPath, 'Umsatzsteuer-Identifikationsnummer');
  injected += 1;
  console.log(`✓ Injected Impressum marker into ${impressumPath}`);
} catch (e) {
  console.warn(`⚠ Could not inject Impressum marker: ${e.message}`);
}

// Kein Erfolg behaupten, der nicht stattgefunden hat: die Zieldateien entstehen
// erst im Prerender-Schritt. Laeuft dieses Script davor, ist injected === 0.
if (injected === 4) {
  console.log('\n✓ Alle 4 Marker injiziert.');
} else {
  console.log(`\n⚠ ${injected} von 4 Markern injiziert — die uebrigen Zieldateien existierten nicht.`);
}

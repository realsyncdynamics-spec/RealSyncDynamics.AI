#!/usr/bin/env node
/**
 * Kontext-Budget-Wächter
 *
 * Warum es diesen Guard gibt: `CLAUDE.md` und die `.claude/`-Konfiguration
 * werden bei **jedem** Session-Start und nach **jeder** Kompaktierung
 * vollständig in den Modellkontext geladen. Sie kosten also nicht einmal,
 * sondern in jeder Sitzung erneut — und wachsen still, weil jede einzelne
 * Ergänzung für sich harmlos aussieht. Am 2026-09-08 war die Datei auf
 * 88 KB (~25.000 Tokens) gewachsen, ohne dass eine Stufe das gemessen hätte.
 *
 * Der Guard ist eine **Ratsche**, kein Ziel: Wächst der Kern über das Budget,
 * gehört der Zuwachs nach `docs/context/` ausgelagert und von `CLAUDE.md` aus
 * verlinkt — das Budget wird nicht erhöht, um den Zuwachs zu decken.
 *
 * Zusätzlich geprüft: Jede ausgelagerte Datei muss aus `CLAUDE.md` erreichbar
 * sein. Eine Auslagerung, auf die niemand verweist, ist kein gesparter
 * Kontext, sondern verlorenes Wissen — derselbe Fehler wie eine Seite ohne
 * Route (CLAUDE.md §14).
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CONFIG = join(ROOT, '.claude', 'context-budget.json');
const CONTEXT_DIR = join(ROOT, 'docs', 'context');

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));

// Schätzung, kein Tokenizer: Für deutschen Fließtext mit Markdown liegen die
// Modelle bei ~3,4–3,8 Bytes je Token. Der Wert steht in der Konfiguration,
// damit die Annahme sichtbar und korrigierbar bleibt statt hier vergraben.
const BYTES_PER_TOKEN = cfg.bytesPerToken ?? 3.5;
const tokens = (bytes) => Math.round(bytes / BYTES_PER_TOKEN);

const fmt = (n) => n.toLocaleString('de-DE');

let failed = false;
const rows = [];
let totalBytes = 0;

for (const [file, maxTokens] of Object.entries(cfg.maxTokens)) {
  if (file === 'gesamt') continue;
  const path = join(ROOT, file);
  if (!existsSync(path)) {
    console.error(`FEHLER: ${file} steht im Budget, existiert aber nicht.`);
    failed = true;
    continue;
  }
  const bytes = statSync(path).size;
  totalBytes += bytes;
  const used = tokens(bytes);
  const over = used > maxTokens;
  if (over) failed = true;
  rows.push({ file, used, maxTokens, over });
}

// Alles unter .claude/ zählt mit: settings.json und Hook-Definitionen werden
// beim Start gelesen. Sie sind klein, aber sie gehören ins Gesamtbudget,
// damit niemand sie als "kostenlos" behandelt.
const claudeDir = join(ROOT, '.claude');
if (existsSync(claudeDir)) {
  for (const entry of readdirSync(claudeDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    totalBytes += statSync(join(claudeDir, entry.name)).size;
  }
}

const totalUsed = tokens(totalBytes);
const totalMax = cfg.maxTokens.gesamt;
if (totalUsed > totalMax) failed = true;

console.log('Kontext-Budget (Schätzung, %s Bytes/Token)\n', BYTES_PER_TOKEN);
for (const r of rows) {
  console.log(
    `  ${r.over ? '✗' : '✓'} ${r.file.padEnd(28)} ${fmt(r.used).padStart(7)} / ${fmt(r.maxTokens)} Tokens`,
  );
}
console.log(
  `  ${totalUsed > totalMax ? '✗' : '✓'} ${'gesamt (inkl. .claude/*.json)'.padEnd(28)} ${fmt(totalUsed).padStart(7)} / ${fmt(totalMax)} Tokens`,
);

// Tote Auslagerungen finden: eine Datei in docs/context/, auf die CLAUDE.md
// nicht verweist, wird von keiner Sitzung gefunden.
if (existsSync(CONTEXT_DIR)) {
  const claudeMd = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const verwaist = readdirSync(CONTEXT_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !claudeMd.includes(`docs/context/${f}`));
  if (verwaist.length > 0) {
    failed = true;
    console.error(
      `\nFEHLER: ${verwaist.length} ausgelagerte Datei(en) werden in CLAUDE.md nicht verlinkt:`,
    );
    for (const f of verwaist) console.error(`  - docs/context/${f}`);
    console.error(
      '  Ausgelagertes Wissen ohne Verweis ist verloren, nicht gespart (§14).',
    );
  }
}

// ---------------------------------------------------------------------------
// Projektweit: Was eine Sitzung nicht beim Start laedt, aber beim Arbeiten.
// Eine Doku-Sammlung, die still waechst, kostet in jeder Recherche erneut —
// nicht als Systemprompt, sondern als Suchtreffer, die jemand lesen muss.
// Deshalb hier eine Ratsche auf Umfang, kein Verbot einzelner Dateien.
// ---------------------------------------------------------------------------
function mdDateien(dir, treffer = []) {
  if (!existsSync(dir)) return treffer;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) mdDateien(p, treffer);
    else if (e.isFile() && e.name.endsWith('.md')) treffer.push(p);
  }
  return treffer;
}

const repoDocs = cfg.doku;
if (repoDocs) {
  const dateien = mdDateien(join(ROOT, 'docs'));
  const kb = dateien.reduce((s, p) => s + statSync(p).size, 0) / 1024;
  const zuViele = dateien.length > repoDocs.maxDateien;
  const zuGross = kb > repoDocs.maxKb;
  if (zuViele || zuGross) failed = true;
  console.log('\nDokumentation unter docs/');
  console.log(
    `  ${zuViele ? '✗' : '✓'} ${String(dateien.length).padStart(4)} Dateien   (Grenze ${repoDocs.maxDateien})`,
  );
  console.log(
    `  ${zuGross ? '✗' : '✓'} ${fmt(Math.round(kb)).padStart(4)} KB gesamt (Grenze ${fmt(repoDocs.maxKb)})`,
  );
  if (zuViele || zuGross) {
    console.error(
      '  Erledigtes darf nach CLAUDE.md §9 ohne Rueckfrage entfernt werden —',
    );
    console.error(
      '  die Git-History bleibt das Archiv. Runbooks, Specs und Templates bleiben.',
    );
  }

  // Aufraeum-Kandidaten melden statt loeschen: Statusdokumente, auf die keine
  // andere Datei verweist. Ob eines davon noch gebraucht wird, entscheidet der
  // Eigentümer — der Guard macht die Liste nur sichtbar, damit sie nicht
  // unbemerkt weiterwaechst.
  const statusMuster = /(PHASE|WEEK|CHECKLIST|STATUS|SUMMARY|RETROSPECTIVE|KICKOFF|COMPLETION|READINESS)/i;
  // docs/README.md ist das Erzeugnis des Index-Generators und nennt *jede*
  // Datei — als Beleg fuer "wird gebraucht" taugt es deshalb nicht.
  const indexDatei = join(ROOT, 'docs', 'README.md');
  const alleTexte = dateien
    .filter((p) => p !== indexDatei && !statusMuster.test(p))
    .map((p) => readFileSync(p, 'utf8'))
    .join('\n');
  const kandidaten = dateien
    .filter((p) => statusMuster.test(p))
    .filter((p) => !alleTexte.includes(p.split('/').pop()))
    .map((p) => relative(ROOT, p));
  if (kandidaten.length > 0) {
    console.log(
      `\nHinweis: ${kandidaten.length} Statusdokument(e) ohne Verweis aus der uebrigen Doku:`,
    );
    for (const k of kandidaten.slice(0, 10)) console.log(`  - ${k}`);
    if (kandidaten.length > 10) console.log(`  … und ${kandidaten.length - 10} weitere`);
    console.log('  Erledigtes loeschen (CLAUDE.md §9); Runbooks/Specs/Templates behalten.');
  }
}

// Kein Fehler, sondern ein Hinweis: Jeder MCP-Server lädt seine Tool-Schemas
// in **jede** Anfrage, nicht nur einmal je Sitzung. Ob ein Server das wert
// ist, entscheidet der Eigentümer — der Guard macht die Kosten nur sichtbar.
const mcpPath = join(ROOT, '.mcp.json');
if (existsSync(mcpPath)) {
  const server = Object.keys(JSON.parse(readFileSync(mcpPath, 'utf8')).mcpServers ?? {});
  if (server.length > (cfg.mcpServerHinweisAb ?? 4)) {
    console.log(
      `\nHinweis: ${server.length} MCP-Server in .mcp.json (${server.join(', ')}).`,
    );
    console.log(
      '  Deren Tool-Schemas liegen in jeder Anfrage im Kontext. Selten genutzte',
    );
    console.log(
      '  Server abzuschalten spart mehr als jede Kürzung an CLAUDE.md.',
    );
  }
}

if (failed) {
  console.error(
    '\nBudget überschritten. Auslagern nach docs/context/ und von CLAUDE.md',
  );
  console.error(
    'aus verlinken — das Budget nicht erhöhen, um den Zuwachs zu decken.',
  );
  process.exit(1);
}

console.log('\nBudget eingehalten.');

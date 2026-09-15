#!/usr/bin/env node
/**
 * Kontext-Budget-Wächter
 *
 * CLAUDE.md und `.claude/` werden bei jedem Session-Start und nach jeder
 * Kompaktierung erneut geladen. Sie kosten also nicht einmal, sondern in jeder
 * Sitzung erneut — und wachsen still, weil jede Ergänzung für sich harmlos
 * aussieht. Am 2026-09-08 war CLAUDE.md auf 88 KB (~25.000 Tokens) gewachsen.
 *
 * Der Guard ist eine Ratsche: Wächst der Kern über das Budget, gehört der
 * Zuwachs nach docs/ (nicht zurück in CLAUDE.md) — das Budget wird nicht
 * erhöht, um den Zuwachs zu decken.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CONFIG = join(ROOT, '.claude', 'context-budget.json');
const CONTEXT_DIR = join(ROOT, 'docs', 'context');

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));

// Schätzung, kein Tokenizer: DE-Fließtext + Markdown ≈ 3,4–3,8 Bytes/Token.
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

// settings.json / context-budget.json / README zählen mit — sie werden beim
// Start gelesen und dürfen nicht als "kostenlos" wachsen.
const claudeDir = join(ROOT, '.claude');
if (existsSync(claudeDir)) {
  for (const entry of readdirSync(claudeDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!/\.(json|md)$/.test(entry.name)) continue;
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
  `  ${totalUsed > totalMax ? '✗' : '✓'} ${'gesamt (inkl. .claude/*)'.padEnd(28)} ${fmt(totalUsed).padStart(7)} / ${fmt(totalMax)} Tokens`,
);

// Auslagerungen unter docs/context/ müssen aus CLAUDE.md erreichbar sein.
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
  }
}

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

  const statusMuster =
    /(PHASE|WEEK|CHECKLIST|STATUS|SUMMARY|RETROSPECTIVE|KICKOFF|COMPLETION|READINESS)/i;
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
      `\nHinweis: ${kandidaten.length} Statusdokument(e) ohne Verweis aus der übrigen Doku:`,
    );
    for (const k of kandidaten.slice(0, 10)) console.log(`  - ${k}`);
    if (kandidaten.length > 10) {
      console.log(`  … und ${kandidaten.length - 10} weitere`);
    }
  }
}

// Repo-Root: jede Datei dort trifft Globs und Greps jeder Session. Am
// 2026-09-12 lagen 64 Markdown-Dateien (~870 KB, ~250k Tokens) plus ein
// 66-KB-HTML-Prototyp im Root. Status-/Phase-/Runbook-Dokumente gehören nach
// .archive/root-docs/ (Read-Deny + .claudeignore), nicht zurück in den Root.
const rootCfg = cfg.root;
if (rootCfg) {
  const rootEntries = readdirSync(ROOT, { withFileTypes: true }).filter((e) =>
    e.isFile(),
  );
  const rootMd = rootEntries.filter((e) => e.name.endsWith('.md'));
  const rootMdKb =
    rootMd.reduce((s, e) => s + statSync(join(ROOT, e.name)).size, 0) / 1024;
  const htmlErlaubt = new Set(rootCfg.htmlErlaubt ?? []);
  const rootHtml = rootEntries
    .filter((e) => e.name.endsWith('.html') && !htmlErlaubt.has(e.name))
    .map((e) => e.name);
  const zuVieleMd = rootMd.length > rootCfg.maxMdDateien;
  const zuGrossMd = rootMdKb > rootCfg.maxMdKb;
  if (zuVieleMd || zuGrossMd || rootHtml.length > 0) failed = true;
  console.log('\nRepo-Root');
  console.log(
    `  ${zuVieleMd ? '✗' : '✓'} ${String(rootMd.length).padStart(4)} Markdown-Dateien (Grenze ${rootCfg.maxMdDateien})`,
  );
  console.log(
    `  ${zuGrossMd ? '✗' : '✓'} ${fmt(Math.round(rootMdKb)).padStart(4)} KB Markdown   (Grenze ${fmt(rootCfg.maxMdKb)})`,
  );
  if (rootHtml.length > 0) {
    console.error(
      `  ✗ HTML im Root außerhalb der Erlaubnisliste: ${rootHtml.join(', ')} → .archive/root-docs/`,
    );
  }
  if (zuVieleMd || zuGrossMd) {
    console.error(
      '  Neue Root-Dokumente nach .archive/root-docs/ (Alt) oder docs/ (lebend) verschieben.',
    );
  }
}

const mcpPath = join(ROOT, '.mcp.json');
if (existsSync(mcpPath)) {
  const server = Object.keys(
    JSON.parse(readFileSync(mcpPath, 'utf8')).mcpServers ?? {},
  );
  if (server.length >= (cfg.mcpServerHinweisAb ?? 1)) {
    console.log(
      `\nHinweis: ${server.length} MCP-Server in .mcp.json (${server.join(', ') || '—'}).`,
    );
    console.log(
      '  Tool-Schemas liegen in jeder Anfrage im Kontext. Website-Sessions: leer halten.',
    );
  } else {
    console.log('\n✓ .mcp.json leer (Website-Default).');
  }
}

if (failed) {
  console.error(
    '\nBudget überschritten. Auslagern / kürzen — das Budget nicht erhöhen.',
  );
  process.exit(1);
}

console.log('\nBudget eingehalten.');

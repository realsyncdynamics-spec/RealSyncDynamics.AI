#!/usr/bin/env node
/**
 * Doku-Index
 *
 * Warum: `docs/` führt über 200 Markdown-Dateien mit mehreren MB. Wer darin
 * etwas sucht, greift sonst zu `grep -r` über den ganzen Baum und zieht
 * Dutzende Treffer in den Kontext, um am Ende eine Datei zu brauchen. Ein
 * Index kostet einmal ein paar Zeilen und macht die gezielte Lektüre möglich.
 *
 * Warum generiert und nicht gepflegt: Ein handgeschriebener Index veraltet
 * still — dieselbe Fehlerklasse, die CLAUDE.md an mehreren Stellen als Befund
 * führt. Hier ist die Datei ein Erzeugnis, und `--check` haelt sie in CI aktuell.
 *
 * Aufruf: `npm run docs:index` schreibt, `npm run docs:index -- --check` prüft.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const ROOT = process.cwd();
const DOCS = join(ROOT, 'docs');
const OUT = join(DOCS, 'README.md');
const SCHWER_KB = 25; // ab hier lohnt der Hinweis, gezielt statt ganz zu lesen

const alleDateien = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return alleDateien(p);
    return e.isFile() && e.name.endsWith('.md') ? [p] : [];
  });

/** Erste H1-Überschrift, sonst der Dateiname — als Wegweiser, nicht als Inhalt. */
function titel(path) {
  const kopf = readFileSync(path, 'utf8').slice(0, 2000).split('\n');
  const h1 = kopf.find((z) => /^#\s+\S/.test(z));
  const t = (h1 ? h1.replace(/^#\s+/, '') : '').replace(/\s+/g, ' ').trim();
  return t.length > 55 ? `${t.slice(0, 52)}…` : t;
}

const dateien = alleDateien(DOCS)
  .filter((p) => p !== OUT)
  .sort();

const gruppen = new Map();
for (const p of dateien) {
  const rel = relative(DOCS, p);
  const gruppe = rel.includes('/') ? dirname(rel).split('/')[0] : '(oberste Ebene)';
  if (!gruppen.has(gruppe)) gruppen.set(gruppe, []);
  gruppen.get(gruppe).push({ rel, kb: statSync(p).size / 1024, titel: titel(p) });
}

const schwer = dateien
  .map((p) => ({ rel: relative(DOCS, p), kb: statSync(p).size / 1024 }))
  .filter((d) => d.kb >= SCHWER_KB)
  .sort((a, b) => b.kb - a.kb);

const uebersicht = [...gruppen]
  .sort()
  .map(([g, e]) => `- \`## ${g}\` — ${e.length} Dokument${e.length === 1 ? '' : 'e'}`);

const zeilen = [
  '# Doku-Index',
  '',
  '> **Erzeugt von `scripts/generate-docs-index.mjs` — nicht von Hand ändern.**',
  '> Aktualisieren mit `npm run docs:index`; CI prüft mit `--check`.',
  '',
  `${dateien.length} Dokumente unter \`docs/\`. Dieser Index existiert, damit gezielt`,
  'gelesen statt breit gesucht wird — jede unnötig geöffnete Datei kostet Kontext,',
  'der für die eigentliche Arbeit fehlt (`CLAUDE.md` §0).',
  '',
  '**Diese Datei ebenfalls nicht ganz lesen.** Nur den Abschnitt holen, der zum',
  'Thema gehört:',
  '',
  '```bash',
  "sed -n '/^## runbooks$/,/^## /p' docs/README.md   # ein Abschnitt",
  "grep -n 'stripe' docs/README.md                   # quer über alle Titel",
  '```',
  '',
  '## Abschnitte',
  '',
  ...uebersicht,
  '',
  `## Umfangreiche Dokumente (ab ${SCHWER_KB} KB)`,
  '',
  'Diese **nie ganz lesen** — mit `grep -n` den Abschnitt suchen und mit',
  '`sed -n \'a,bp\'` nur ihn holen:',
  '',
  ...schwer.map((d) => `- \`docs/${d.rel}\` — ${d.kb.toFixed(0)} KB`),
  '',
];

for (const [gruppe, eintraege] of [...gruppen].sort()) {
  zeilen.push(`## ${gruppe}`, '');
  for (const e of eintraege.sort((a, b) => a.rel.localeCompare(b.rel))) {
    zeilen.push(`- [\`${e.rel}\`](${e.rel}) — ${e.titel || '(ohne Überschrift)'}`);
  }
  zeilen.push('');
}

const inhalt = `${zeilen.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;

if (process.argv.includes('--check')) {
  let ist = '';
  try {
    ist = readFileSync(OUT, 'utf8');
  } catch {
    console.error('FEHLER: docs/README.md fehlt. `npm run docs:index` ausführen.');
    process.exit(1);
  }
  if (ist !== inhalt) {
    console.error('FEHLER: docs/README.md ist nicht aktuell. `npm run docs:index` ausführen.');
    process.exit(1);
  }
  console.log(`Doku-Index aktuell (${dateien.length} Dokumente).`);
} else {
  writeFileSync(OUT, inhalt);
  console.log(`Doku-Index geschrieben: ${dateien.length} Dokumente, ${schwer.length} davon ab ${SCHWER_KB} KB.`);
}

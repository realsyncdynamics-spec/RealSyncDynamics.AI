#!/usr/bin/env node
// Edge-Function-Syntax-Gate.
//
// Hintergrund (2026-08-02): Ein einziger unvollstaendiger `Deno.serve(`-Aufruf
// in `supabase/functions/add-auditor/index.ts` hat den kompletten
// `supabase functions deploy` blockiert — die CLI baut den Modulgraph
// alles-oder-nichts ("failed to create the graph"). Folge: 73 von 168
// Functions erreichten die Produktion nie, ueber Wochen unbemerkt, weil der
// PR-CI Edge Functions gar nicht anfasst (tsc deckt nur `src/` ab).
//
// Dieses Skript parst JEDE `supabase/functions/*/index.ts` mit dem
// TypeScript-Parser und failt bei echten Syntaxfehlern. Es ist bewusst ein
// reiner PARSE-Check, kein Typecheck: Edge Functions laufen unter Deno mit
// `jsr:`/`npm:`-Specifiern und globalem `Deno`, die der TS-Compiler ohne
// Deno-libs ohnehin nicht aufloesen koennte. Syntaxfehler — der Fall, der
// den Deploy tatsaechlich kippt — findet der Parser zuverlaessig.

import { createRequire } from 'node:module';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS_DIR = path.join(ROOT, 'supabase', 'functions');

if (!existsSync(FUNCTIONS_DIR)) {
  console.log('ℹ️  Kein supabase/functions-Verzeichnis — Check uebersprungen.');
  process.exit(0);
}

/** Alle Entrypoints einsammeln: supabase/functions/<name>/index.ts */
const entrypoints = [];
for (const name of readdirSync(FUNCTIONS_DIR).sort()) {
  // `_shared` u. a. sind Hilfsmodule ohne eigenen Entrypoint.
  if (name.startsWith('_') || name.startsWith('.')) continue;
  const dir = path.join(FUNCTIONS_DIR, name);
  if (!statSync(dir).isDirectory()) continue;
  const entry = path.join(dir, 'index.ts');
  if (existsSync(entry)) entrypoints.push({ name, file: entry });
}

const broken = [];
for (const { name, file } of entrypoints) {
  const source = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  // `parseDiagnostics` ist intern, aber die einzige Stelle, an der reine
  // Syntaxfehler ohne vollstaendiges Program auftauchen.
  const diagnostics = sf.parseDiagnostics ?? [];
  if (diagnostics.length === 0) continue;

  broken.push({
    name,
    file: path.relative(ROOT, file),
    issues: diagnostics.map((d) => {
      const { line, character } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
      return {
        line: line + 1,
        column: character + 1,
        message: ts.flattenDiagnosticMessageText(d.messageText, ' '),
      };
    }),
  });
}

console.log(`Geprueft: ${entrypoints.length} Edge-Function-Entrypoints.`);

if (broken.length === 0) {
  console.log('✅ Keine Syntaxfehler — `supabase functions deploy` kann den Modulgraph bauen.');
  process.exit(0);
}

console.error(`\n❌ ${broken.length} Edge Function(s) mit Syntaxfehler:\n`);
for (const b of broken) {
  for (const i of b.issues) {
    // GitHub-Actions-Annotation: erscheint direkt an der Zeile im PR-Diff.
    console.error(`::error file=${b.file},line=${i.line},col=${i.column}::${i.message}`);
    console.error(`   ${b.file}:${i.line}:${i.column}  ${i.message}`);
  }
}
console.error(
  '\nEin einziger Syntaxfehler blockiert den Deploy ALLER Edge Functions\n' +
  '(die Supabase-CLI baut den Modulgraph alles-oder-nichts). Bitte beheben,\n' +
  'bevor dieser PR gemergt wird.',
);
process.exit(1);

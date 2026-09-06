#!/usr/bin/env node
// Edge-Function-Referenz-Gate.
//
// Hintergrund (2026-08-30): `supabase/functions/gdpr-audit/index.ts` rief vier
// Hilfsfunktionen auf, die im Repository nirgends existierten — `runChecks`,
// `scanSubpages`, `extractFacts`, `scoreReport`. Die Datei parst sauber und
// deployt sauber; erst zur Laufzeit warf Deno `ReferenceError: runChecks is
// not defined`. Folge: der kostenlose DSGVO-Audit — der wichtigste CTA der
// Startseite — beantwortete JEDEN Aufruf mit HTTP 500, und `scan_runs` blieb
// dauerhaft leer. Gemerkt hat es niemand, weil kein Test und keine Pruefung
// eine Edge Function je AUFRUFT.
//
// Warum der bestehende Syntax-Check das nicht faengt: `check-edge-syntax`
// ist bewusst ein reiner Parse-Check. Eine nicht existierende Funktion ist
// syntaktisch einwandfrei — der Fehler liegt eine Ebene hoeher, bei der
// Aufloesung der Namen.
//
// Dieses Skript schliesst genau diese Luecke: es sammelt je Datei alle
// deklarierten und importierten Namen ein und meldet jeden AUFGERUFENEN
// Bezeichner, der sich darauf nicht zurueckfuehren laesst.
//
// Zweite Regel (2026-08-31): `.catch()` auf einem PostgREST-Builder.
// `business-metrics-cron` rief `admin.rpc('…').catch(…)` auf. Das sieht wie
// ein Promise aus, ist aber keines: Der Builder ist `await`-bar (thenable),
// besitzt aber kein `.catch()`. Der Zugriff warf `TypeError: … is not a
// function` — 96 Fehlschlaege bei 96 Laeufen pro Tag, seit dem 2026-06-11,
// unbemerkt. Dieselbe Familie wie oben: Deploy sauber, Laufzeit tot.
//
// Bewusst konservativ: Die Deklarationen werden ueber die ganze Datei
// eingesammelt, ohne Block-Scoping nachzubilden. Das ueberschaetzt den
// Sichtbarkeitsbereich und meldet damit lieber einmal zu wenig als einmal zu
// viel — ein Gate, das falsch anschlaegt, wird abgeschaltet und schuetzt dann
// gar nichts mehr.

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

// Laufzeit-Globals von Deno und der Web-Plattform. Alles hier ist zur
// Laufzeit vorhanden, ohne dass die Datei es deklarieren muesste.
const GLOBALS = new Set([
  // Deno + Web-Plattform
  'Deno', 'fetch', 'crypto', 'console', 'atob', 'btoa', 'structuredClone',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'Request', 'Response', 'Headers', 'FormData', 'Blob', 'File', 'AbortController',
  'AbortSignal', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder',
  'ReadableStream', 'WritableStream', 'TransformStream', 'EventTarget', 'Event',
  'WebSocket', 'BroadcastChannel', 'performance', 'caches', 'navigator',
  // ECMAScript
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Math',
  'JSON', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'EvalError', 'ReferenceError', 'URIError', 'AggregateError', 'Promise', 'Proxy',
  'Reflect', 'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'ArrayBuffer',
  'SharedArrayBuffer', 'DataView', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray',
  'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array',
  'Float64Array', 'BigInt64Array', 'BigUint64Array', 'Intl', 'globalThis',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
  'encodeURIComponent', 'decodeURIComponent', 'eval', 'undefined', 'NaN', 'Infinity',
  'require', 'process', 'Buffer', 'module', 'exports', '__dirname', '__filename',
]);

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

/**
 * Sammelt jeden Namen ein, den die Datei an irgendeiner Stelle bindet:
 * Importe, Deklarationen, Parameter, Destrukturierungen, catch-Variablen.
 */
function collectBoundNames(sf) {
  const bound = new Set();

  // Bindungsmuster koennen verschachtelt sein: `const { a, b: { c } } = x`.
  function bindPattern(node) {
    if (!node) return;
    if (ts.isIdentifier(node)) { bound.add(node.text); return; }
    if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
      for (const el of node.elements) {
        if (ts.isBindingElement(el)) bindPattern(el.name);
      }
    }
  }

  function walk(node) {
    // import { a, b as c } from '…'  ·  import d from '…'  ·  import * as ns
    if (ts.isImportDeclaration(node) && node.importClause) {
      const { name, namedBindings } = node.importClause;
      if (name) bound.add(name.text);
      if (namedBindings) {
        if (ts.isNamespaceImport(namedBindings)) bound.add(namedBindings.name.text);
        else for (const s of namedBindings.elements) bound.add(s.name.text);
      }
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
      bound.add(node.name.text);
    }
    if (ts.isVariableDeclaration(node)) bindPattern(node.name);
    if (ts.isParameter(node)) bindPattern(node.name);
    if (ts.isCatchClause(node) && node.variableDeclaration) bindPattern(node.variableDeclaration.name);
    // Benannte Funktionsausdruecke sind in ihrem eigenen Rumpf sichtbar.
    if ((ts.isFunctionExpression(node) || ts.isClassExpression(node)) && node.name) {
      bound.add(node.name.text);
    }
    ts.forEachChild(node, walk);
  }

  walk(sf);
  return bound;
}

/**
 * Findet aufgerufene Bezeichner — `foo(…)`, aber nicht `obj.foo(…)`, weil
 * Methodenaufrufe erst zur Laufzeit am Objekt haengen und hier nicht
 * entscheidbar sind.
 */
function collectBareCalls(sf) {
  const calls = [];
  function walk(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const { line, character } = sf.getLineAndCharacterOfPosition(node.expression.getStart(sf));
      calls.push({ name: node.expression.text, line: line + 1, column: character + 1 });
    }
    // Typpositionen ignorieren: `foo<Bar>()` ist ein Aufruf, `Bar` aber nicht.
    ts.forEachChild(node, walk);
  }
  walk(sf);
  return calls;
}

/**
 * Findet `.catch(` / `.finally(` direkt auf einem PostgREST-Builder.
 *
 * `supabase.rpc(…)`, `.from(…).select(…)` und Geschwister liefern einen
 * Builder, der `then` implementiert und deshalb `await`-bar ist — aber weder
 * `catch` noch `finally`. Wer das verwechselt, bekommt keinen abgefangenen
 * Fehler, sondern einen geworfenen TypeError an genau der Stelle, die den
 * Fehler abfangen sollte.
 *
 * Die Pruefung laeuft ueber das GERUEST der Aufrufkette, nicht ueber ihren
 * Text. Eine erste Fassung verglich den Quelltext des Empfaengers per Regex
 * und meldete prompt `fetch(…).then(async res => { await sb.update(…) })
 * .catch(…)` — dort steht `.update(` zwar im Text, aber im Rumpf eines
 * Callbacks, nicht in der Kette. Ein Gate mit Fehlalarmen wird abgeschaltet
 * und schuetzt dann gar nichts mehr, deshalb hier strukturell:
 *
 *   - Nur Methoden auf dem Geruest zaehlen, nie etwas in Argumenten.
 *   - Ein `.then()` auf dem Geruest macht aus dem Thenable eine echte
 *     Promise — danach ist `.catch()` korrekt und wird nicht gemeldet.
 */
const POSTGREST_TERMINAL = new Set([
  'rpc', 'select', 'insert', 'upsert', 'update', 'delete', 'single', 'maybeSingle',
]);

function chainSpine(node, sf) {
  // Steigt die Kette hinab und sammelt nur die Methodennamen des Geruests.
  const methoden = [];
  let cur = node;
  for (let tiefe = 0; tiefe < 64 && cur; tiefe++) {
    if (ts.isCallExpression(cur)) { cur = cur.expression; continue; }
    if (ts.isPropertyAccessExpression(cur)) {
      methoden.push(cur.name.text);
      cur = cur.expression;
      continue;
    }
    break;
  }
  return methoden;
}

function collectBuilderCatches(sf) {
  const treffer = [];
  function walk(node) {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && (node.expression.name.text === 'catch' || node.expression.name.text === 'finally')
    ) {
      const spine = chainSpine(node.expression.expression, sf);
      // `.then()` weiter unten in der Kette liefert eine echte Promise.
      const echtePromise = spine.includes('then');
      const builder = spine.some((m) => POSTGREST_TERMINAL.has(m));
      if (builder && !echtePromise) {
        const { line, character } = sf.getLineAndCharacterOfPosition(node.expression.name.getStart(sf));
        treffer.push({ name: node.expression.name.text, line: line + 1, column: character + 1 });
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);
  return treffer;
}

const broken = [];
for (const { name, file } of entrypoints) {
  const source = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  // Syntaktisch kaputte Dateien gehoeren `check:edge-syntax`; hier wuerde ein
  // unvollstaendiger AST nur Folgefehler produzieren.
  if ((sf.parseDiagnostics ?? []).length > 0) continue;

  const bound = collectBoundNames(sf);
  const unresolved = new Map();
  for (const call of collectBareCalls(sf)) {
    if (bound.has(call.name) || GLOBALS.has(call.name)) continue;
    // Je Name nur die erste Fundstelle melden — der Rest ist dieselbe Ursache.
    if (!unresolved.has(call.name)) unresolved.set(call.name, call);
  }

  for (const t of collectBuilderCatches(sf)) {
    unresolved.set(`builder-catch:${t.line}`, {
      ...t,
      grund: `.${t.name}() auf einem PostgREST-Builder — der hat kein .${t.name}()`,
    });
  }

  if (unresolved.size > 0) {
    broken.push({ name, file: path.relative(ROOT, file), calls: [...unresolved.values()] });
  }
}

console.log(`Geprueft: ${entrypoints.length} Edge-Function-Entrypoints.`);

if (broken.length === 0) {
  console.log('✅ Alle aufgerufenen Funktionen sind deklariert oder importiert.');
  process.exit(0);
}

const total = broken.reduce((n, b) => n + b.calls.length, 0);
console.error(`\n❌ ${total} nicht aufloesbare(r) Aufruf(e) in ${broken.length} Edge Function(s):\n`);
for (const b of broken) {
  for (const c of b.calls) {
    // GitHub-Actions-Annotation: erscheint direkt an der Zeile im PR-Diff.
    const grund = c.grund ?? `${c.name} ist weder deklariert noch importiert`;
    console.error(`::error file=${b.file},line=${c.line},col=${c.column}::${grund}`);
    console.error(`   ${b.file}:${c.line}:${c.column}  ${grund}`);
  }
}
console.error(
  '\nDiese Stellen werfen zur Laufzeit — der Deploy laeuft dabei fehlerfrei\n' +
  'durch, die Function stirbt erst beim ersten Request. Entweder die fehlende\n' +
  'Funktion ergaenzen, den Aufruf entfernen, oder beim PostgREST-Builder den\n' +
  'Fehler ueber das Ergebnis pruefen: `const { error } = await client.rpc(...)`.',
);
process.exit(1);

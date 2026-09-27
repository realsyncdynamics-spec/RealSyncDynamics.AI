#!/usr/bin/env node
// Ratsche gegen funktionslose Dashboard-Aktionen (Issue #1381, Phase 1).
//
// ## Was hier verteidigt wird
//
// Issue #1381 §8 setzt zehn Abnahme-Gates. Das wichtigste Ergebnis der
// Inventur war nicht, dass vieles fehlt, sondern dass man es einer Fläche
// nicht ansieht: `/app/agents` führt einen echten, abgerechneten Run aus,
// `/app/automations` sieht genauso aus und führt gar nichts aus. Beide
// zeigen Karten mit einem Button.
//
// Diese Ratsche macht den Unterschied nachprüfbar. Sie behauptet nicht, eine
// Aktion sei fertig — sie prüft, dass die Behauptung im Inventar zum Code
// passt:
//
//   - Jede genannte Route existiert wirklich in src/App.tsx.
//   - Jede genannte Datei existiert.
//   - Wer IMPLEMENTED, PARTIAL oder BROKEN sagt, muss ein Backend nennen, und
//     die Datei muss einen echten Aufruf enthalten (functions.invoke oder
//     .from()). Ein Inventar-Eintrag allein macht keine Funktion.
//   - Wer NOT_IMPLEMENTED oder CLIENT_ONLY sagt, darf kein Backend nennen.
//     Sonst ist die Einordnung falsch, nicht der Code. CLIENT_ONLY heisst:
//     tut etwas, aber nur im Browser — /build war genau dieser Fall, und die
//     Ratsche hat ihn beim ersten Lauf aufgedeckt.
//   - BROKEN ist der Fall, den die erste Inventur selbst falsch eingeordnet
//     hat: /app/automations sah nach einer reinen Attrappe aus, hat aber einen
//     vollstaendigen Server-Pfad — er ist nur an drei Stellen unterbrochen.
//     "Kein Backend" und "Backend, das nichts liefert" sind verschiedene
//     Befunde und brauchen verschiedene Worte.
//   - Wer nicht IMPLEMENTED ist, muss die Lücke benennen.
//   - Wer IMPLEMENTED sagt, darf keine Lücke offen lassen.
//
// Damit kann eine neue Dashboard-Aktion nicht mehr als fertig gelten, ohne
// dass irgendwo ein ausführender Pfad steht — genau die Forderung aus
// Issue #1381 §1.
//
// Aufruf:
//   node scripts/check-dashboard-actions.mjs            prüfen
//   node scripts/check-dashboard-actions.mjs --json     maschinenlesbar

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Projektwurzel aus der Modul-URL.
 *
 * Warum nicht einfach `new URL('..', import.meta.url).pathname`: Vitest laedt
 * diese Datei durch die Vite-Pipeline, und dann traegt `import.meta.url` ein
 * `/@fs`-Praefix (`file:///@fs/home/runner/...`). Unter reinem `node` faellt
 * das nicht auf, in CI schon — der erste Lauf dieser Ratsche ist genau daran
 * gescheitert: ENOENT auf `/@fs/.../scripts/dashboard-actions.json`.
 *
 * Exportiert, damit die Regression testbar ist, ohne Vite nachzubauen.
 */
export function projektWurzelAus(metaUrl) {
  const verzeichnis = fileURLToPath(new URL('.', metaUrl));
  return join(verzeichnis.replace(/^[/\\]@fs[/\\]/, '/'), '..');
}

const ROOT = projektWurzelAus(import.meta.url);
const INVENTAR = join(ROOT, 'scripts/dashboard-actions.json');

const ZUSTAENDE = ['IMPLEMENTED', 'PARTIAL', 'BROKEN', 'CLIENT_ONLY', 'NOT_IMPLEMENTED', 'BLOCKED'];
/** Ein Aufruf, der die Grenze zum Server überschreitet. */
const BACKEND_AUFRUF = /functions\.invoke\s*\(|\.from\s*\(\s*['"]|\/functions\/v1\//;

export function ladeInventar() {
  return JSON.parse(readFileSync(INVENTAR, 'utf8'));
}

export function pruefe(inventar = ladeInventar(), app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8')) {
  const befunde = [];
  const melde = (id, text) => befunde.push({ id, text });
  const gesehen = new Set();

  for (const a of inventar.aktionen) {
    if (gesehen.has(a.id)) melde(a.id, 'Kennung doppelt vergeben.');
    gesehen.add(a.id);

    if (!ZUSTAENDE.includes(a.status)) {
      melde(a.id, `Unbekannter Zustand "${a.status}". Erlaubt: ${ZUSTAENDE.join(', ')}.`);
    }

    // Die Route muss es wirklich geben — sonst zeigt das Inventar ins Leere.
    if (!app.includes(`path="${a.route}"`)) {
      melde(a.id, `Route ${a.route} steht nicht in src/App.tsx.`);
    }

    for (const feld of ['komponente', 'handler']) {
      if (a[feld] && !existsSync(join(ROOT, a[feld]))) {
        melde(a.id, `${feld}: ${a[feld]} existiert nicht.`);
      }
    }

    // BROKEN steht hier bewusst mit drin: Wer sagt, ein Pfad sei vorhanden
    // aber tot, muss ihn zeigen koennen. Sonst ist es NOT_IMPLEMENTED.
    const ausfuehrend = a.status === 'IMPLEMENTED' || a.status === 'PARTIAL' || a.status === 'BROKEN';

    if (ausfuehrend) {
      if (!a.backend) {
        melde(a.id, `${a.status} ohne Backend. Was ausführt, muss sagen wo.`);
      } else if (!existsSync(join(ROOT, a.backend))) {
        melde(a.id, `backend: ${a.backend} existiert nicht.`);
      } else if (!BACKEND_AUFRUF.test(readFileSync(join(ROOT, a.backend), 'utf8'))) {
        melde(a.id, `${a.backend} enthält keinen Backend-Aufruf. ${a.status} ist damit nicht belegt.`);
      }
    }

    // Wer sagt, es gebe keinen Server-Pfad, darf keinen nennen.
    for (const ohneBackend of ['NOT_IMPLEMENTED', 'CLIENT_ONLY']) {
      if (a.status === ohneBackend && a.backend) {
        melde(a.id, `${ohneBackend} nennt ein Backend. Dann stimmt die Einordnung nicht.`);
      }
    }

    if (a.status !== 'IMPLEMENTED' && !String(a.luecke ?? '').trim()) {
      melde(a.id, `${a.status} ohne benannte Lücke.`);
    }
    if (a.status === 'IMPLEMENTED' && String(a.luecke ?? '').trim()) {
      melde(a.id, 'IMPLEMENTED mit offener Lücke. Dann ist es PARTIAL.');
    }

    if (String(a.beleg ?? '').trim().length < 30) {
      melde(a.id, 'Ohne belastbaren Beleg am Code.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.seit ?? '')) {
      melde(a.id, 'Kein gültiges Datum in `seit`.');
    }
  }

  return befunde;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const inventar = ladeInventar();
  const befunde = pruefe(inventar);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ aktionen: inventar.aktionen.length, befunde }, null, 2));
    process.exit(befunde.length ? 1 : 0);
  }

  const zaehler = {};
  for (const a of inventar.aktionen) zaehler[a.status] = (zaehler[a.status] ?? 0) + 1;

  if (befunde.length === 0) {
    const zeile = Object.entries(zaehler).map(([k, v]) => `${k}: ${v}`).join(' · ');
    console.log(`✓ Inventar deckt sich mit dem Code. ${inventar.aktionen.length} Aktionen — ${zeile}`);
    process.exit(0);
  }

  console.error('\n✗ Das Inventar behauptet etwas, das der Code nicht hergibt:\n');
  for (const { id, text } of befunde) console.error(`    ${id}: ${text}`);
  console.error(`
  Eine Dashboard-Aktion gilt erst als fertig, wenn sie ausführt, das Ergebnis
  persistiert und es anzeigt (Issue #1381 §8). Das Inventar ist die Zusage
  darüber — es darf dem Code nicht voraus sein.
`);
  process.exit(1);
}

/**
 * Parität: evaluateAgentAction() im Browser vs. Edge-Kopie
 *
 * Die Funktion existiert zweimal:
 *   src/lib/enterprise-ai-os/policy-engine.ts          (Browser, Referenz)
 *   supabase/functions/enterprise-ai-os-evaluate/index.ts  (Deno, Handkopie)
 *
 * Deno kann nicht aus src/ importieren, die Kopie ist deshalb nachvollziehbar.
 * Ohne Test bindet sie aber nichts an das Original: eine einseitige Änderung
 * lässt Browser und Edge verschieden entscheiden, ohne dass etwas bricht — und
 * eine Governance-Entscheidung, die je nach Aufrufweg anders ausfällt, ist
 * kein Prüfpfad.
 *
 * Gleiches Vorgehen wie test/governance/rfc003-sql-parity.test.ts: die andere
 * Seite wird als Text gelesen und auf ihre bedeutungstragenden Bestandteile
 * geprüft. Verglichen werden die Regel-Begründungen in ihrer Reihenfolge und
 * die beiden Kategoriemengen — nicht die Formatierung, denn die Kopie benennt
 * Variablen abweichend (`c` statt `category`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../..');

const browserSrc = readFileSync(resolve(ROOT, 'src/lib/enterprise-ai-os/policy-engine.ts'), 'utf8');
const edgeSrc = readFileSync(
  resolve(ROOT, 'supabase/functions/enterprise-ai-os-evaluate/index.ts'),
  'utf8',
);

/** Schneidet den Rumpf von evaluateAgentAction heraus (bis zum return). */
function body(source: string): string {
  const start = source.indexOf('function evaluateAgentAction');
  expect(start, 'evaluateAgentAction nicht gefunden').toBeGreaterThan(-1);
  const end = source.indexOf('return { allowed, requiresApproval, auditRequired, reasons };', start);
  expect(end, 'return-Zeile von evaluateAgentAction nicht gefunden').toBeGreaterThan(start);
  return source.slice(start, end);
}

/** Alle reasons.push('…')-Texte in Reihenfolge — das ist der Regelsatz. */
function reasonTexts(source: string): string[] {
  return [...body(source).matchAll(/reasons\.push\(\s*[`'"]([^`'"]*)/g)].map((m) => m[1]);
}

/** Inhalt eines `new Set([...])`-Literals. */
function setMembers(source: string, name: string): string[] {
  const m = source.match(new RegExp(`const ${name} = new Set\\(\\[([^\\]]*)\\]`));
  expect(m, `${name} nicht gefunden`).not.toBeNull();
  return m![1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

describe('enterprise-ai-os — Parität Browser ↔ Edge', () => {
  it('beide Fassungen enthalten evaluateAgentAction', () => {
    expect(browserSrc).toContain('function evaluateAgentAction');
    expect(edgeSrc).toContain('function evaluateAgentAction');
  });

  it('PERSONAL_DATA ist in beiden identisch', () => {
    expect(setMembers(edgeSrc, 'PERSONAL_DATA')).toEqual(setMembers(browserSrc, 'PERSONAL_DATA'));
  });

  it('SENSITIVE_DATA ist in beiden identisch', () => {
    expect(setMembers(edgeSrc, 'SENSITIVE_DATA')).toEqual(setMembers(browserSrc, 'SENSITIVE_DATA'));
  });

  it('der Regelsatz stimmt in Inhalt und Reihenfolge überein', () => {
    // Reihenfolge zählt: sie bestimmt, welche Begründung zuerst im Prüfpfad
    // steht, und bei mehreren zutreffenden Regeln die Lesart des Ergebnisses.
    const edge = reasonTexts(edgeSrc);
    const browser = reasonTexts(browserSrc);
    expect(edge.length, 'unterschiedlich viele Regeln').toBe(browser.length);
    expect(edge).toEqual(browser);
  });

  it('beide geben dieselbe Ergebnisform zurück', () => {
    const shape = 'return { allowed, requiresApproval, auditRequired, reasons };';
    expect(browserSrc).toContain(shape);
    expect(edgeSrc).toContain(shape);
  });
});

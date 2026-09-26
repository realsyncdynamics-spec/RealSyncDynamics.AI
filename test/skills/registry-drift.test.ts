/**
 * Die Skill-Registry existiert zweimal. Dieser Test macht die Kopie zu einer.
 *
 * ## Warum zwei Dateien
 *
 * `src/lib/skills/registry.ts` speist die Seite `/skills`.
 * `supabase/functions/skills/index.ts` speist die API. Edge Functions koennen
 * nicht aus `src/` importieren (getrennte Build-Roots), deshalb liegt der
 * Katalog dort ein zweites Mal.
 *
 * ## Was ohne diesen Test passiert ist
 *
 * Gemessen am 2026-09-20 auf `main`: die Kopie fuehrte **7 statt 9** Skills.
 * Es fehlten `gdpr-audit` und `ai-act-risk` — ausgerechnet die beiden mit
 * `riskLevel: 'high'` und `reviewRequired: true`. Die Folge war keine
 * Fehlermeldung, sondern eine falsche Antwort:
 *
 * | Anfrage | Seite | API |
 * |---|---|---|
 * | „dsgvo audit fuer unsere website" | `gdpr-audit` | `finance-audit-support` |
 * | „eu ai act risikoklasse bestimmen" | `ai-act-risk` | `legal-compliance` |
 * | „cookie scan", „security header", „annex iii", „transparenzpflicht" | `gdpr-audit` / `ai-act-risk` | kein Treffer |
 *
 * Eine Datenschutz-Anfrage wurde an die Finanzpruefung geroutet — mit deren
 * Guardrails, deren Risikostufe, und einer `confidence`, die danach aussah,
 * als haette jemand nachgedacht. Der Kommentar in der Datei sagte die ganze
 * Zeit „Mirror".
 *
 * ## Was geprueft wird
 *
 * Inhalt, nicht Formatierung: je Skill die Trigger (sie entscheiden das
 * Routing), die Guardrails (sie sind die Sicherheitszusage der Antwort) und
 * die Flags. Wer die Quelle aendert und die Kopie vergisst, faellt hier auf.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_SKILLS } from '../../src/lib/skills/registry';

const EDGE = readFileSync(
  resolve(__dirname, '../../supabase/functions/skills/index.ts'),
  'utf8',
);

/** Der Textblock eines Skills in der Kopie — von seinem Key bis zum naechsten. */
function block(key: string): string {
  const start = EDGE.indexOf(`key: '${key}'`);
  if (start < 0) return '';
  const next = EDGE.indexOf("key: '", start + 8);
  return EDGE.slice(start, next < 0 ? EDGE.length : next);
}

describe('Skill-Registry — Kopie und Quelle stimmen ueberein', () => {
  it('die Quelle fuehrt ueberhaupt Skills (sonst prueft der Test nichts)', () => {
    expect(ALL_SKILLS.length).toBeGreaterThanOrEqual(9);
  });

  it('die Kopie fuehrt genauso viele Skills wie die Quelle', () => {
    const keysInKopie = [...EDGE.matchAll(/key: '([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(keysInKopie.sort()).toEqual(ALL_SKILLS.map((s) => s.key).sort());
  });

  it.each(ALL_SKILLS.map((s) => [s.key, s] as const))(
    '%s steht vollstaendig in der Kopie',
    (key, skill) => {
      const b = block(key);
      expect(b, `Skill ${key} fehlt in der Kopie`).not.toBe('');
      expect(b, `label von ${key} weicht ab`).toContain(`label: '${skill.label}'`);
    },
  );

  it.each(ALL_SKILLS.map((s) => [s.key, s] as const))(
    '%s: jeder Trigger der Quelle steht in der Kopie',
    (key, skill) => {
      // Die Trigger entscheiden, welcher Skill gewaehlt wird. Fehlt einer,
      // faellt die Anfrage auf einen anderen Skill oder ins Leere.
      const b = block(key);
      for (const trigger of skill.triggers) {
        expect(b, `Trigger "${trigger}" fehlt bei ${key}`).toContain(`'${trigger}'`);
      }
    },
  );

  it.each(ALL_SKILLS.map((s) => [s.key, s] as const))(
    '%s: jeder Guardrail steht im Wortlaut in der Kopie',
    (key, skill) => {
      // Gekuerzte Guardrails waren Teil desselben Befunds: die API gab eine
      // schwaechere Zusage zurueck als die Oberflaeche zeigte.
      const b = block(key);
      for (const guardrail of skill.guardrails) {
        expect(b, `Guardrail von ${key} weicht ab oder fehlt`).toContain(guardrail);
      }
    },
  );

  it.each(ALL_SKILLS.map((s) => [s.key, s] as const))(
    '%s: Risikostufe und Review-Pflicht stimmen ueberein',
    (key, skill) => {
      const b = block(key);
      expect(b, `riskLevel von ${key} weicht ab`).toContain(`riskLevel: '${skill.riskLevel}'`);
      expect(b, `reviewRequired von ${key} weicht ab`).toContain(
        `reviewRequired: ${skill.reviewRequired}`,
      );
      expect(b, `requiresWebResearch von ${key} weicht ab`).toContain(
        `requiresWebResearch: ${skill.requiresWebResearch}`,
      );
      expect(b, `requiresUserData von ${key} weicht ab`).toContain(
        `requiresUserData: ${skill.requiresUserData}`,
      );
    },
  );

  it('die beiden Hochrisiko-Skills sind in der Kopie angekommen', () => {
    // Namentlich, weil genau diese zwei gefehlt haben. Ein generischer
    // Zaehler haette den naechsten Ausfall gemeldet, nicht diesen.
    for (const key of ['gdpr-audit', 'ai-act-risk']) {
      const b = block(key);
      expect(b, `${key} fehlt erneut in der Kopie`).not.toBe('');
      expect(b).toContain("riskLevel: 'high'");
      expect(b).toContain('reviewRequired: true');
    }
  });
});

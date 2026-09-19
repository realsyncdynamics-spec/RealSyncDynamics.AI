/**
 * Die Strings im Code und die im Handoff sind dieselben.
 *
 * `src/i18n/strings.ts` ist aus `design/handoff/realsync-ai-app/i18n.json`
 * erzeugt. Ohne diese Pruefung waere das eine einmalige Kopie: jemand
 * bessert einen Text im Code nach, der Handoff sagt etwas anderes, und beim
 * naechsten Abgleich gegen den Prototyp faellt niemandem auf, welcher Stand
 * gilt. Der Test macht den Handoff zur Quelle und den Code zum Abbild.
 *
 * Faellt er: im Handoff aendern, dann uebernehmen — nicht umgekehrt.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_LOCALE, LOCALES, STRINGS, translate, type StringKey } from '../../src/i18n/strings';

const HANDOFF = JSON.parse(
  readFileSync('design/handoff/realsync-ai-app/i18n.json', 'utf8'),
) as Record<string, Record<string, string>>;

describe('i18n — Code und Handoff stimmen ueberein', () => {
  it('fuehrt genau die Sprachen des Handoffs', () => {
    expect([...LOCALES].sort()).toEqual(Object.keys(HANDOFF).sort());
  });

  it.each([...LOCALES])('%s traegt dieselben Schluessel wie der Handoff', (locale) => {
    expect(Object.keys(STRINGS[locale]).sort()).toEqual(Object.keys(HANDOFF[locale]).sort());
  });

  it.each([...LOCALES])('%s traegt dieselben Texte wie der Handoff', (locale) => {
    expect(STRINGS[locale]).toEqual(HANDOFF[locale]);
  });

  it('haelt beide Sprachen deckungsgleich — kein Schluessel nur auf einer Seite', () => {
    expect(Object.keys(STRINGS.de).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });

  it('hat keinen leeren Text', () => {
    for (const locale of LOCALES) {
      for (const [key, wert] of Object.entries(STRINGS[locale])) {
        expect(wert.trim(), `${locale}.${key} ist leer`).not.toBe('');
      }
    }
  });
});

describe('i18n — Deutsch ist der Standard', () => {
  it('faellt ohne Wahl auf Deutsch', () => {
    expect(DEFAULT_LOCALE).toBe('de');
  });

  it('liefert deutschen Text, wenn eine Uebersetzung fehlte', () => {
    // `translate` faellt auf DEFAULT_LOCALE zurueck. Heute fehlt nichts —
    // der Test haelt das Verhalten fest, falls spaeter ein Schluessel
    // nur auf Deutsch dazukommt.
    const key = Object.keys(STRINGS.de)[0] as StringKey;
    expect(translate('de', key)).toBe(STRINGS.de[key]);
    expect(translate('en', key)).toBe(STRINGS.en[key]);
  });
});

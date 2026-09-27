import { describe, expect, it } from 'vitest';
import { HANDOFF_APP } from '@/src/i18n/handoffApp';
import { HANDOFF_COPY, HANDOFF_EXTRA, HANDOFF_OVERRIDES, translate } from '@/src/i18n/handoff';

/**
 * Die App-Texte hängen hinter Landing-Copy/Extra in der Nachschlagereihenfolge
 * von `translate`. Ein gleichnamiger Schlüssel würde den App-Text still
 * überschatten (so geschehen: `scoreSource` zeigte „gdpr-audit · {domain}").
 */
describe('HANDOFF_APP — Schlüssel', () => {
  const appKeys = Object.keys(HANDOFF_APP.de);

  it('kollidiert mit keinem Landing-Schlüssel', () => {
    for (const [name, dict] of Object.entries({ HANDOFF_COPY, HANDOFF_EXTRA, HANDOFF_OVERRIDES })) {
      const other = (dict as Record<string, Record<string, string>>).de ?? {};
      const hits = appKeys.filter((k) => k in other);
      expect(hits, `${name} überschattet App-Texte`).toEqual([]);
    }
  });

  it('hat DE und EN deckungsgleich', () => {
    expect(Object.keys(HANDOFF_APP.en).sort()).toEqual([...appKeys].sort());
  });

  it('translate liefert die App-Texte', () => {
    expect(translate('de', 'draftUnsaved')).toBe('Entwurf · nicht gespeichert');
    expect(translate('en', 'draftUnsaved')).not.toBe('Entwurf · nicht gespeichert');
  });
});

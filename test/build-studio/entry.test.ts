import { describe, expect, it } from 'vitest';
import {
  CODE_ENTRY_PROMPT_MAX_CHARS,
  DEFAULT_BUILD_KIND,
  codeEntryHref,
  codeEntryState,
  parseBuildKind,
  readCodeEntryPrompt,
} from '../../src/features/build-studio/entry';

describe('Builder-02 entry', () => {
  it('preserves a complete description in navigation state instead of the URL', () => {
    const description = 'Baue ein Dashboard mit Umsatz-Chart, Nutzerrollen und Projektverwaltung.';
    const handoff = codeEntryState('  ' + description + '  ');
    expect(handoff).toEqual({ codeBuilderHandoff: { source: 'build-studio', prompt: description } });
    expect(readCodeEntryPrompt(handoff)).toBe(description);
    expect(codeEntryHref('dashboard', 'Meine App', description)).toBe('/builder/meine-app/code');
    expect(codeEntryHref('dashboard', 'Meine App', description)).not.toContain(description);
  });

  it('ignores missing, malformed or oversized handoffs without granting access', () => {
    expect(codeEntryState('  ')).toBeNull();
    expect(codeEntryState('x'.repeat(CODE_ENTRY_PROMPT_MAX_CHARS + 1))).toBeNull();
    expect(readCodeEntryPrompt(null)).toBeNull();
    expect(readCodeEntryPrompt({ codeBuilderHandoff: { source: 'unknown', prompt: 'x' } })).toBeNull();
    expect(readCodeEntryPrompt({ codeBuilderHandoff: { source: 'build-studio', prompt: 42 } })).toBeNull();
    expect(readCodeEntryPrompt({ codeBuilderHandoff: { source: 'build-studio', prompt: ' '.repeat(4) } })).toBeNull();
    expect(readCodeEntryPrompt({ codeBuilderHandoff: { source: 'build-studio', prompt: 'x'.repeat(CODE_ENTRY_PROMPT_MAX_CHARS + 1) } })).toBeNull();
    expect(readCodeEntryPrompt(codeEntryState('x'.repeat(CODE_ENTRY_PROMPT_MAX_CHARS)))).toHaveLength(CODE_ENTRY_PROMPT_MAX_CHARS);
  });

  it('keeps the website flow for a missing or unknown kind', () => {
    expect(DEFAULT_BUILD_KIND).toBe('website');
    expect(parseBuildKind(null)).toBe('website');
    expect(parseBuildKind('webshop')).toBe('website');
    expect(parseBuildKind(' Web_App ')).toBe('web_app');
    expect(parseBuildKind('landing')).toBe('landing');
  });

  it('sends app kinds to the existing code builder by slug', () => {
    expect(codeEntryHref('web_app', 'Kundenportal Müller')).toBe('/builder/kundenportal-mueller/code');
    expect(codeEntryHref('dashboard', '', 'Lager Übersicht für drei Standorte und mehr')).toBe(
      '/builder/lager-uebersicht-fuer-drei/code',
    );
    expect(codeEntryHref('saas_app', '  ', '')).toBe('/builder/app/code');
  });

  it('keeps names without slug characters apart instead of collapsing them to one app', () => {
    const tokyo = codeEntryHref('web_app', '東京');
    const japan = codeEntryHref('web_app', '日本');
    expect(japan).toMatch(/^\/builder\/app-[0-9a-f]{8}\/code$/);
    expect(tokyo).toMatch(/^\/builder\/app-[0-9a-f]{8}\/code$/);
    expect(japan).not.toBe(tokyo);
    expect(codeEntryHref('web_app', '日本')).toBe(japan);
  });

  it('refuses to route a site kind past the SiteOS flow', () => {
    expect(() => codeEntryHref('landing', 'North')).toThrow(/SiteOS/);
  });
});

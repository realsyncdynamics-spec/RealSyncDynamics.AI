import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUILD_KIND,
  codeEntryHref,
  parseBuildKind,
} from '../../src/features/build-studio/entry';

describe('Builder-02 entry', () => {
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
    expect(codeEntryHref('saas_app', '日本')).toBe('/builder/app/code');
  });

  it('refuses to route a site kind past the SiteOS flow', () => {
    expect(() => codeEntryHref('landing', 'North')).toThrow(/SiteOS/);
  });
});

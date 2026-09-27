import { describe, expect, it } from 'vitest';
import { describeAction, runtimeStatus, urlFromInput } from '../../../../src/features/governance/dashboard/BrowserRuntimePanel';

describe('urlFromInput', () => {
  it('erkennt Domains und URLs', () => {
    expect(urlFromInput('example.com')).toBe('https://example.com/');
    expect(urlFromInput('https://example.com/impressum')).toBe('https://example.com/impressum');
  });

  it('behandelt Sätze und einzelne Wörter als Aufgabe', () => {
    expect(urlFromInput('Prüfe den Cookie-Banner auf example.com')).toBeNull();
    expect(urlFromInput('impressum')).toBeNull();
    expect(urlFromInput('   ')).toBeNull();
  });
});

describe('describeAction', () => {
  it('beschreibt Plan-Schritte lesbar', () => {
    expect(describeAction({ type: 'navigate', url: 'https://example.com/' })).toBe('Öffnen: https://example.com/');
    expect(describeAction({ type: 'extract' })).toBe('Seitentext lesen');
  });
});

describe('runtimeStatus — Badges nur aus geprüften Zuständen', () => {
  it('ohne mitgliedschaftsgebundenen Mandanten ist alles inaktiv', () => {
    expect(runtimeStatus({ tenantBound: false, executorConnected: true })).toEqual({
      navigation: 'inactive', evidence: 'inactive',
    });
  });

  it('Executor offline ⇒ nur Preview, keine Evidence (die Preview schreibt keine)', () => {
    expect(runtimeStatus({ tenantBound: true, executorConnected: false })).toEqual({
      navigation: 'preview', evidence: 'inactive',
    });
  });

  it('Executor per Health-Probe erreichbar ⇒ Navigation und Evidence aktiv', () => {
    expect(runtimeStatus({ tenantBound: true, executorConnected: true })).toEqual({
      navigation: 'active', evidence: 'active',
    });
  });
});

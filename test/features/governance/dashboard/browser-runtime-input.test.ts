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

describe('runtimeStatus — Badges nur aus geprüften Server-Zuständen', () => {
  it('ohne mitgliedschaftsgebundenen Mandanten ist alles inaktiv', () => {
    expect(runtimeStatus({ tenantBound: false, executorReady: true, evidenceAvailable: true })).toEqual({
      navigation: 'inactive', evidence: 'inactive',
    });
  });

  it('Executor nicht bereit ⇒ keine Navigation, keine Evidence (es gibt keine Ersatz-Vorschau mehr)', () => {
    expect(runtimeStatus({ tenantBound: true, executorReady: false, evidenceAvailable: true })).toEqual({
      navigation: 'inactive', evidence: 'inactive',
    });
  });

  it('Evidence-Speicher nicht erreichbar ⇒ Evidence inaktiv, auch wenn der Executor bereit ist', () => {
    expect(runtimeStatus({ tenantBound: true, executorReady: true, evidenceAvailable: false })).toEqual({
      navigation: 'active', evidence: 'inactive',
    });
  });

  it('Executor bereit und Evidence erreichbar ⇒ Navigation und Evidence aktiv', () => {
    expect(runtimeStatus({ tenantBound: true, executorReady: true, evidenceAvailable: true })).toEqual({
      navigation: 'active', evidence: 'active',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { describeAction, urlFromInput } from '../../../../src/features/governance/dashboard/BrowserRuntimePanel';

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

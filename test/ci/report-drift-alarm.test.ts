import { describe, expect, it } from 'vitest';
import { markerFor, parseState, renderBody } from '../../scripts/report-drift-alarm.mjs';

/**
 * Der Melder hat genau eine Aufgabe: pro Wächter ein Issue, fortgeschrieben
 * statt vervielfacht. Beides hängt an der Marke und am Zähler — deshalb
 * werden hier ihre Grenzen festgehalten, nicht die HTTP-Aufrufe.
 */
describe('Drift-Alarm-Melder', () => {
  it('erkennt sein eigenes Issue an der Marke wieder', () => {
    const body = renderBody({
      guardKey: 'migration', guardTitle: 'Migration Drift Guard', runUrl: 'https://example/1',
      since: '2026-08-26T06:00:00.000Z', count: 1, nowIso: '2026-08-26T06:00:00.000Z',
    });
    expect(body).toContain(markerFor('migration'));
    expect(body).not.toContain(markerFor('function-acl'));
  });

  it('liest den Stand aus dem eigenen Text zurück', () => {
    const first = renderBody({
      guardKey: 'migration', guardTitle: 'Migration Drift Guard', runUrl: 'https://example/1',
      since: '2026-08-26T06:00:00.000Z', count: 1, nowIso: '2026-08-26T06:00:00.000Z',
    });
    expect(parseState(first)).toEqual({ since: '2026-08-26T06:00:00.000Z', count: 1 });
  });

  it('behält das erste Datum und zählt hoch — Runde für Runde', () => {
    let body = renderBody({
      guardKey: 'migration', guardTitle: 'Migration Drift Guard', runUrl: 'https://example/1',
      since: '2026-08-26T06:00:00.000Z', count: 1, nowIso: '2026-08-26T06:00:00.000Z',
    });
    for (const [tag, lauf] of [['27', 2], ['28', 3], ['29', 4]] as const) {
      const prev = parseState(body);
      body = renderBody({
        guardKey: 'migration', guardTitle: 'Migration Drift Guard', runUrl: `https://example/${lauf}`,
        since: prev.since!, count: prev.count + 1, nowIso: `2026-08-${tag}T06:00:00.000Z`,
      });
    }
    // Der erste rote Tag bleibt stehen — er ist der teuerste Teil der Aussage.
    expect(parseState(body)).toEqual({ since: '2026-08-26T06:00:00.000Z', count: 4 });
    expect(body).toContain('| Rote Läufe seitdem | **4** |');
    expect(body).toContain('| Betroffene Tage | ~4 |');
    expect(body).toContain('https://example/4');
  });

  it('startet bei einem leeren Vorzustand sauber bei null', () => {
    expect(parseState(undefined)).toEqual({ since: null, count: 0 });
    expect(parseState('')).toEqual({ since: null, count: 0 });
    expect(parseState('irgendein fremder Issue-Text')).toEqual({ since: null, count: 0 });
  });

  it('hält die Wächter auseinander', () => {
    const a = renderBody({
      guardKey: 'migration', guardTitle: 'A', runUrl: '', since: '2026-08-26T06:00:00.000Z',
      count: 1, nowIso: '2026-08-26T06:00:00.000Z',
    });
    const b = renderBody({
      guardKey: 'edge-function', guardTitle: 'B', runUrl: '', since: '2026-08-26T06:00:00.000Z',
      count: 1, nowIso: '2026-08-26T06:00:00.000Z',
    });
    expect(a).not.toContain(markerFor('edge-function'));
    expect(b).not.toContain(markerFor('migration'));
  });
});

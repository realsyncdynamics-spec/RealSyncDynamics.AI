/**
 * Dashboard-Aufrufer von browser-execute nach Fingerprint v2 (PR A) und
 * Domain-Freigabe (PR B), Befund N1 vom 17.11.2026.
 *
 * Ohne `target` endete jede verändernde Aktion in 400 TARGET_REQUIRED, ohne
 * `page_origin` jede Einzelaktion außer navigate in 403.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dashboardTarget, originOf } from '../../../../src/features/governance/browser/browserExecutorClient';

describe('originOf', () => {
  it.each([
    ['https://musterbetrieb.example/kontakt?x=1#a', 'https://musterbetrieb.example'],
    ['http://localhost:5173/', 'http://localhost:5173'],
    ['javascript:alert(1)', null],
    ['kein-url', null],
    [null, null],
  ])('%s ⇒ %s', (input, expected) => {
    expect(originOf(input)).toBe(expected);
  });
});

describe('dashboardTarget', () => {
  const ORIGIN = 'https://musterbetrieb.example';

  it('bindet verändernde Aktionen an den Seiten-Origin, ohne Feldwerte', () => {
    expect(dashboardTarget({ type: 'click', selector: '#senden' }, ORIGIN)).toEqual({ origin: ORIGIN, method: 'NONE' });
    expect(dashboardTarget({ type: 'type', selector: '#name', text: 'Erika' }, ORIGIN)).toEqual({ origin: ORIGIN, method: 'NONE' });
    expect(dashboardTarget({ type: 'select', selector: '#art', value: 'a' }, ORIGIN)).toEqual({ origin: ORIGIN, method: 'NONE' });
  });

  it('Lese-Aktionen und unbekannte Seite: kein target', () => {
    expect(dashboardTarget({ type: 'extract' }, ORIGIN)).toBeNull();
    expect(dashboardTarget({ type: 'navigate', url: `${ORIGIN}/` }, ORIGIN)).toBeNull();
    expect(dashboardTarget({ type: 'click', selector: '#senden' }, null)).toBeNull();
  });

  it('das Panel sendet page_origin und target mit', () => {
    const panel = readFileSync('src/features/governance/dashboard/BrowserRuntimePanel.tsx', 'utf8');
    expect(panel).toContain('pageOrigin,');
    expect(panel).toContain('target: dashboardTarget(action, pageOrigin)');
    const client = readFileSync('src/features/governance/browser/browserExecutorClient.ts', 'utf8');
    expect(client).toContain('page_origin: input.pageOrigin');
    expect(client).toContain('target: input.target');
  });
});

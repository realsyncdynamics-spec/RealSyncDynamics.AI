/**
 * Fingerprint v2 für freigabepflichtige Browser-Aktionen (PR A, Lücke G2).
 * Bindet die Freigabe an Empfänger (Origin), Methode und Formularinhalt.
 */
import { describe, expect, it } from 'vitest';
import {
  browserFingerprint,
  normalizeTarget,
  targetSummary,
  type NormalizedTarget,
} from '../../supabase/functions/_shared/browser-fingerprint.ts';

const SESSION = 'sess-0123456789abcdef';
const ACTIONS = [{ type: 'click', selector: '#senden' }];
const BASE = { origin: 'https://musterbetrieb.example', method: 'POST', values: { name: 'Erika Muster', email: 'erika@example.org' } };

async function target(t: unknown): Promise<NormalizedTarget> {
  const r = await normalizeTarget(t);
  if (!r.ok) throw new Error(r.error);
  return r.target;
}

describe('browserFingerprint v2', () => {
  it('ist stabil und unabhängig von der Reihenfolge der Formularfelder', async () => {
    const a = await browserFingerprint(SESSION, ACTIONS, await target(BASE));
    const b = await browserFingerprint(SESSION, ACTIONS, await target({ ...BASE, values: { email: 'erika@example.org', name: 'Erika Muster' } }));
    expect(a).toBe(b);
    expect(a).toMatch(/^browser:v2:[0-9a-f]{64}$/);
  });

  it.each([
    ['anderer Empfänger', { ...BASE, origin: 'https://angreifer.example' }],
    ['andere Methode', { ...BASE, method: 'GET' }],
    ['geänderter Inhalt', { ...BASE, values: { ...BASE.values, email: 'angreifer@example.net' } }],
    ['zusätzliches Feld', { ...BASE, values: { ...BASE.values, iban: 'DE00' } }],
    ['entferntes Feld', { ...BASE, values: { name: 'Erika Muster' } }],
  ])('%s ändert den Fingerprint', async (_label, changed) => {
    const a = await browserFingerprint(SESSION, ACTIONS, await target(BASE));
    const b = await browserFingerprint(SESSION, ACTIONS, await target(changed));
    expect(b).not.toBe(a);
  });

  it('andere Aktion oder Sitzung ändert den Fingerprint', async () => {
    const t = await target(BASE);
    const a = await browserFingerprint(SESSION, ACTIONS, t);
    expect(await browserFingerprint(SESSION, [{ type: 'click', selector: '#loeschen' }], t)).not.toBe(a);
    expect(await browserFingerprint('sess-anders-0000000000', ACTIONS, t)).not.toBe(a);
  });

  it('Origin wird normalisiert, Groß-/Kleinschreibung der Methode egal', async () => {
    const a = await browserFingerprint(SESSION, ACTIONS, await target(BASE));
    const b = await browserFingerprint(SESSION, ACTIONS, await target({ ...BASE, origin: 'https://MUSTERBETRIEB.example', method: 'post' }));
    expect(b).toBe(a);
  });
});

describe('normalizeTarget', () => {
  it.each([
    ['kein Objekt', 'https://x.example'],
    ['Array', []],
    ['Origin fehlt', { method: 'POST', values: {} }],
    ['kein http(s)', { origin: 'javascript:alert(1)', method: 'POST', values: {} }],
    ['file-Schema', { origin: 'file:///etc', method: 'POST', values: {} }],
    ['Origin mit Pfad', { origin: 'https://x.example/pfad', method: 'POST', values: {} }],
    ['Origin mit Query', { origin: 'https://x.example?d=1', method: 'POST', values: {} }],
    ['unbekannte Methode', { origin: 'https://x.example', method: 'TRACE', values: {} }],
    ['Wert kein String', { origin: 'https://x.example', method: 'POST', values: { a: 1 } }],
    ['Wert zu lang', { origin: 'https://x.example', method: 'POST', values: { a: 'x'.repeat(2001) } }],
    ['zu viele Felder', { origin: 'https://x.example', method: 'POST', values: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`f${i}`, ''])) }],
    ['NONE mit Werten', { origin: 'https://x.example', method: 'NONE', values: { a: 'b' } }],
  ])('lehnt ab: %s', async (_label, raw) => {
    const r = await normalizeTarget(raw);
    expect(r.ok).toBe(false);
  });

  it('akzeptiert Klick ohne Formular (method NONE, keine Werte)', async () => {
    const r = await normalizeTarget({ origin: 'https://x.example', method: 'NONE' });
    expect(r.ok).toBe(true);
  });
});

describe('targetSummary', () => {
  it('enthält keine Klartextwerte, nur Feldnamen, Längen und Hash', async () => {
    const s = targetSummary(await target(BASE));
    const json = JSON.stringify(s);
    expect(json).not.toContain('Erika');
    expect(json).not.toContain('erika@example.org');
    expect(s).toMatchObject({ origin: BASE.origin, method: 'POST', fields: [{ name: 'email', length: 17 }, { name: 'name', length: 12 }] });
  });
});

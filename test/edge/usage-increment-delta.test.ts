// usage-increment: Eingabeprüfung für delta. Vom Client gemeldeter Verbrauch
// darf nur hinzukommen; Korrekturen laufen serverseitig.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseDelta, MAX_DELTA } from '../../supabase/functions/usage-increment/delta.ts';

describe('usage-increment parseDelta', () => {
  it('nimmt fehlendes delta als 1', () => {
    expect(parseDelta(undefined)).toEqual({ ok: true, delta: 1 });
    expect(parseDelta(null)).toEqual({ ok: true, delta: 1 });
  });

  it('nimmt positive Ganzzahlen an und schneidet Nachkommastellen ab', () => {
    expect(parseDelta(5)).toEqual({ ok: true, delta: 5 });
    expect(parseDelta(2.9)).toEqual({ ok: true, delta: 2 });
    expect(parseDelta(MAX_DELTA)).toEqual({ ok: true, delta: MAX_DELTA });
  });

  it('lehnt negative Werte mit 403 ab', () => {
    for (const v of [-1, -1.5, -MAX_DELTA, -MAX_DELTA - 1]) {
      const r = parseDelta(v);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe(403);
        expect(r.code).toBe('FORBIDDEN');
      }
    }
  });

  it('lehnt 0, Bruchteile unter 1, Nicht-Zahlen und Überlauf mit 400 ab', () => {
    for (const v of [0, 0.4, -0.4, Number.NaN, Number.POSITIVE_INFINITY, '5', true, {}, MAX_DELTA + 1]) {
      const r = parseDelta(v);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
  });

  it('der Handler nutzt parseDelta statt eigener delta-Prüfung', () => {
    const src = readFileSync('supabase/functions/usage-increment/index.ts', 'utf8');
    expect(src).toContain("import { parseDelta } from './delta.ts'");
    expect(src).toContain('parseDelta(body.delta)');
    expect(src).not.toMatch(/Math\.abs\(delta\)/);
  });
});

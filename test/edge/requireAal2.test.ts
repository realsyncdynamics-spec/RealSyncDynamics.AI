import { describe, it, expect, vi } from 'vitest';
import {
  decodeAalFromJwt, isAal2, observeAal2,
} from '../../supabase/functions/_shared/requireAal2.ts';

/** Baut ein syntaktisch gültiges (nicht signiertes) JWT mit gegebenem Payload. */
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

describe('requireAal2 helper (P0d Phase 1 — OBSERVE only)', () => {
  describe('decodeAalFromJwt', () => {
    it('aal2 JWT → "aal2" erkannt', () => {
      expect(decodeAalFromJwt(makeJwt({ sub: 'u1', aal: 'aal2' }))).toBe('aal2');
    });
    it('aal1 JWT → "aal1" erkannt', () => {
      expect(decodeAalFromJwt(makeJwt({ sub: 'u1', aal: 'aal1' }))).toBe('aal1');
    });
    it('fehlender aal-Claim → null', () => {
      expect(decodeAalFromJwt(makeJwt({ sub: 'u1' }))).toBe(null);
    });
    it('"Bearer <jwt>"-Präfix wird akzeptiert', () => {
      expect(decodeAalFromJwt(`Bearer ${makeJwt({ aal: 'aal2' })}`)).toBe('aal2');
    });
    it('null / leer / Müll → null, kein Throw', () => {
      expect(decodeAalFromJwt(null)).toBe(null);
      expect(decodeAalFromJwt(undefined)).toBe(null);
      expect(decodeAalFromJwt('')).toBe(null);
      expect(decodeAalFromJwt('not-a-jwt')).toBe(null);
      expect(decodeAalFromJwt('a.b')).toBe(null); // payload kein valides JSON
    });
  });

  describe('isAal2', () => {
    it('true nur bei aal2', () => {
      expect(isAal2(makeJwt({ aal: 'aal2' }))).toBe(true);
      expect(isAal2(makeJwt({ aal: 'aal1' }))).toBe(false);
      expect(isAal2(makeJwt({}))).toBe(false);
      expect(isAal2(null)).toBe(false);
    });
  });

  describe('observeAal2 (loggt, blockt NIE)', () => {
    it('aal2 → AAL2_OK + ok:true (console.info)', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const r = observeAal2(makeJwt({ aal: 'aal2' }), 'unit-test');
      expect(r).toEqual({ aal: 'aal2', ok: true, event: 'AAL2_OK' });
      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
    it('aal1 → AAL2_REQUIRED_OBSERVED + ok:false (console.warn)', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const r = observeAal2(makeJwt({ aal: 'aal1' }), 'unit-test');
      expect(r).toEqual({ aal: 'aal1', ok: false, event: 'AAL2_REQUIRED_OBSERVED' });
      expect(spy).toHaveBeenCalledOnce();
      spy.mockRestore();
    });
    it('fehlender Claim → AAL2_REQUIRED_OBSERVED, aal:null', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const r = observeAal2(makeJwt({ sub: 'u1' }), 'unit-test');
      expect(r.ok).toBe(false);
      expect(r.event).toBe('AAL2_REQUIRED_OBSERVED');
      expect(r.aal).toBe(null);
      spy.mockRestore();
    });
    it('Müll-Token wirft nicht (Observe darf nie stören)', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => observeAal2('garbage', 'unit-test')).not.toThrow();
      spy.mockRestore();
    });
  });
});

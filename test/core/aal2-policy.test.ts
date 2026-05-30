import { describe, it, expect } from 'vitest';
import {
  PRIVILEGED_ROLES, requiresAal2, aal2Decision,
} from '../../src/core/access/aal2-policy';

describe('AAL2 enforcement policy (P0c, ADR 0006)', () => {
  describe('PRIVILEGED_ROLES', () => {
    it('= owner, admin, dpo, viewer_auditor (editor + null sind NICHT privilegiert)', () => {
      expect([...PRIVILEGED_ROLES]).toEqual(['owner', 'admin', 'dpo', 'viewer_auditor']);
    });
  });

  describe('requiresAal2', () => {
    it('privilegierte Rollen erfordern AAL2', () => {
      for (const r of ['owner', 'admin', 'dpo', 'viewer_auditor']) {
        expect(requiresAal2(r, false)).toBe(true);
      }
    });
    it('editor + ohne Rolle erfordern NICHT (kein globaler Default-Deny)', () => {
      expect(requiresAal2('editor', false)).toBe(false);
      expect(requiresAal2(null, false)).toBe(false);
      expect(requiresAal2(undefined, false)).toBe(false);
    });
    it('Public-Sector-Tenant erzwingt AAL2 für ALLE Rollen', () => {
      expect(requiresAal2('editor', true)).toBe(true);
      expect(requiresAal2('viewer_auditor', true)).toBe(true);
    });
    it('Public-Sector ohne Rolle (kein Tenant-Kontext) blockt NICHT', () => {
      expect(requiresAal2(null, true)).toBe(false);
    });
  });

  describe('aal2Decision', () => {
    // Pflichttest 4 + 6: öffentliche Seiten / Recovery / Login (keine Session) → allow
    it('ohne Session immer allow (Login-Gate greift davor, keine MFA-Verwechslung)', () => {
      expect(aal2Decision({ hasSession: false, required: true, currentLevel: 'aal1', nextLevel: 'aal2' })).toBe('allow');
      expect(aal2Decision({ hasSession: false, required: true, currentLevel: null, nextLevel: null })).toBe('allow');
    });

    // Pflichttest 3: viewer/nicht-privilegiert unverändert
    it('kein Enforce nötig → allow', () => {
      expect(aal2Decision({ hasSession: true, required: false, currentLevel: 'aal1', nextLevel: 'aal1' })).toBe('allow');
    });

    // Pflichttest 2: privileged mit AAL2 → erlaubt
    it('privileged + bereits AAL2 → allow', () => {
      expect(aal2Decision({ hasSession: true, required: true, currentLevel: 'aal2', nextLevel: 'aal2' })).toBe('allow');
    });

    // Pflichttest 1: privileged mit AAL1 → blockiert
    it('privileged + AAL1 mit vorhandenem Faktor → step-up (blockiert, Challenge)', () => {
      expect(aal2Decision({ hasSession: true, required: true, currentLevel: 'aal1', nextLevel: 'aal2' })).toBe('step-up');
    });
    it('privileged + AAL1 ohne Faktor → enroll (blockiert, MFA einrichten)', () => {
      expect(aal2Decision({ hasSession: true, required: true, currentLevel: 'aal1', nextLevel: 'aal1' })).toBe('enroll');
    });

    it('blockiert NIE mit "allow" wenn privileged + nicht AAL2 + Session', () => {
      const out = aal2Decision({ hasSession: true, required: true, currentLevel: 'aal1', nextLevel: 'aal1' });
      expect(out).not.toBe('allow');
    });
  });
});

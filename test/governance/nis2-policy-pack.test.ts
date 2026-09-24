/**
 * NIS2 Policy Pack — Schema- und Coverage-Anbindung (§ 30 BSIG / Art. 21 NIS2).
 */
import { describe, expect, it } from 'vitest';
import {
  nis2CoverageKey,
  nis2PackControlRefs,
  nis2PolicyPack,
} from '../../src/core/governance/nis2-pack';
import { computeCoverage } from '../../src/lib/policy-packs/coverage';

const EXPECTED_CODES = [
  'RM-01',
  'IR-01',
  'BC-01',
  'SC-01',
  'SDM-01',
  'EFF-01',
  'HYG-01',
  'CRY-01',
  'IAM-01',
  'MFA-01',
] as const;

describe('NIS2 policy pack', () => {
  it('hat die kanonischen Pack-Metadaten (preview)', () => {
    expect(nis2PolicyPack.pack_id).toBe('nis2');
    expect(nis2PolicyPack.pack_name).toBe('NIS2 — Risikomanagement § 30 BSIG');
    expect(nis2PolicyPack.version).toBe('0.1.0');
    expect(nis2PolicyPack.frameworks).toEqual(['NIS2']);
    expect(nis2PolicyPack.industry).toBe('all');
    expect(nis2PolicyPack.legal_basis_version).toContain('BSIG');
    expect(nis2PolicyPack.legal_basis_version).toContain('Art. 21');
    expect(nis2PolicyPack.status).toBe('preview');
    expect(nis2PolicyPack.disclaimer.length).toBeGreaterThan(10);
  });

  it('enthält genau 10 Controls mit NIS2-01..10 und fester control_code-Reihenfolge', () => {
    expect(nis2PolicyPack.controls).toHaveLength(10);
    const ids = nis2PolicyPack.controls.map((c) => c.id);
    expect(ids).toEqual([
      'NIS2-01',
      'NIS2-02',
      'NIS2-03',
      'NIS2-04',
      'NIS2-05',
      'NIS2-06',
      'NIS2-07',
      'NIS2-08',
      'NIS2-09',
      'NIS2-10',
    ]);
    expect(new Set(ids).size).toBe(10);
    expect(nis2PolicyPack.controls.map((c) => c.control_code)).toEqual([...EXPECTED_CODES]);
  });

  it('jedes Control hat Pflichtfelder, legal_ref und status_default preview', () => {
    for (const c of nis2PolicyPack.controls) {
      expect(c.framework).toBe('NIS2');
      expect(c.title.trim().length).toBeGreaterThan(0);
      expect(c.description.trim().length).toBeGreaterThan(0);
      expect(c.evidence_hint.trim().length).toBeGreaterThan(0);
      expect(c.legal_ref).toMatch(/§\s*30/);
      expect(c.legal_ref).toMatch(/Art\.\s*21/);
      expect(c.status_default).toBe('preview');
    }
  });

  it('Coverage-Keys sind NIS2::<control_code> und PackControlRef-kompatibel', () => {
    const refs = nis2PackControlRefs();
    expect(refs).toHaveLength(10);
    expect(refs.map((r) => nis2CoverageKey(r))).toEqual(
      EXPECTED_CODES.map((code) => `NIS2::${code}`),
    );
    const cov = computeCoverage(refs, []);
    expect(cov.total).toBe(10);
    expect(cov.notStarted).toBe(10);
    expect(cov.percent).toBe(0);
  });
});

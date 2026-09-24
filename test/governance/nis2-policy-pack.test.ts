/**
 * NIS2 Policy Pack — Schema-, Coverage- und Grundschutz-Anbindung.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  nis2CoverageKey,
  nis2PackControlRefs,
  nis2PolicyPack,
} from '../../src/core/governance/nis2-pack';
import { computeCoverage, frameworkLabel } from '../../src/lib/policy-packs/coverage';

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
  it('hat die kanonischen Pack-Metadaten (preview + Grundschutz-Methode)', () => {
    expect(nis2PolicyPack.pack_id).toBe('nis2');
    expect(nis2PolicyPack.pack_name).toBe('NIS2 — Risikomanagement § 30 BSIG');
    expect(nis2PolicyPack.version).toBe('0.1.0');
    expect(nis2PolicyPack.frameworks).toEqual(['NIS2']);
    expect(nis2PolicyPack.industry).toBe('all');
    expect(nis2PolicyPack.legal_basis_version).toContain('BSIG');
    expect(nis2PolicyPack.legal_basis_version).toContain('Art. 21');
    expect(nis2PolicyPack.status).toBe('preview');
    expect(nis2PolicyPack.implementation_method).toBe('BSI IT-Grundschutz');
    expect(nis2PolicyPack.grundschutz_edition).toBe('Kompendium Edition 2023');
    expect(nis2PolicyPack.disclaimer).toMatch(/BSI-Registrierung/);
    expect(nis2PolicyPack.disclaimer).toMatch(/kein Nachweis/);
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

  it('jedes Control hat >= 1 Grundschutz-Ref mit baustein/title/standard', () => {
    for (const c of nis2PolicyPack.controls) {
      expect(c.grundschutz_refs.length).toBeGreaterThanOrEqual(1);
      for (const r of c.grundschutz_refs) {
        expect(r.baustein.trim().length).toBeGreaterThan(0);
        expect(r.title.trim().length).toBeGreaterThan(0);
        expect(r.standard).toBe('BSI IT-Grundschutz-Kompendium');
      }
    }
    // SC-01: Edition-2023-Abweichung OPS.2.1 → OPS.2.3
    const sc = nis2PolicyPack.controls.find((c) => c.control_code === 'SC-01')!;
    expect(sc.grundschutz_refs.map((r) => r.baustein)).toContain('OPS.2.3');
    expect(sc.grundschutz_refs.map((r) => r.baustein)).not.toContain('OPS.2.1');
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

  it('Landing policy-packs.ts: kein BSI_GRUNDSCHUTZ; NIS2/TISAX/DORA haben next', () => {
    const landing = readFileSync(resolve('src/components/landing/policy-packs.ts'), 'utf8');
    expect(landing).not.toMatch(/BSI_GRUNDSCHUTZ|Grundschutz/);
    expect(landing).toContain("['NIS2', true]");
    expect(landing).toContain("['TISAX', true]");
    expect(landing).toContain("['DORA', true]");
    expect(frameworkLabel('BSI_GRUNDSCHUTZ')).toBe('BSI IT-Grundschutz');
  });
});

// @vitest-environment node
/**
 * Invarianten fuer Assessment-Snapshots (a)-(e) und Evidence-Regel als reine
 * Funktionen – die Schnittstelle, an der der Evaluator (naechster Schritt)
 * andockt: Sein Ergebnis darf nie in forbiddenResults() liegen.
 */
import { describe, expect, it } from 'vitest';

import type { AssessmentSnapshot } from '../../supabase/functions/_shared/registry/types.ts';
import {
  checkAssessmentInvariants, checkEvidenceBacking, evidencedSealLevel, forbiddenResults, isStale,
} from '../../supabase/functions/_shared/registry/invariants.ts';
import { assessmentInputsHash, ASSESSMENT_INPUTS_HASH_METHOD } from '../../supabase/functions/_shared/registry/inputsHash.ts';
import { canonicalJson } from '../../supabase/functions/_shared/evidence-hash.ts';
import { readJson, VALID } from './helpers.ts';

const base = (): AssessmentSnapshot => structuredClone(readJson(VALID, 'assessments/example-assessment-a.json'));

describe('forbiddenResults', () => {
  it('gueltiges Fixture: nichts verboten, keine Verstoesse', () => {
    const s = base();
    expect([...forbiddenResults(s.inputs, s.evidence_cutoff).forbidden]).toEqual([]);
    expect(checkAssessmentInvariants(s)).toEqual([]);
    expect(checkEvidenceBacking(s)).toEqual([]);
  });

  it('(a) Weitergabe unter strict_eu_sovereignty verbietet PASS, nicht FAIL', () => {
    const s = base();
    s.inputs.facts.external_inference_egress.value = true;
    const f = forbiddenResults(s.inputs, s.evidence_cutoff).forbidden;
    expect(f.has('PASS')).toBe(true);
    expect(f.has('FAIL')).toBe(false);
    s.result = 'FAIL';
    expect(checkAssessmentInvariants(s)).toEqual([]);
  });

  it('(a) gilt nur fuer strict_eu_sovereignty', () => {
    const s = base();
    s.inputs.facts.external_inference_egress.value = true;
    s.inputs.policy_profile = 'baseline';
    expect(forbiddenResults(s.inputs, s.evidence_cutoff).forbidden.has('PASS')).toBe(false);
  });

  it('(b) Frische wird gegen evidence_cutoff berechnet', () => {
    const e = { ref: 'fact:x', status: 'claimed' as const, source_count: 1, captured_at: '2026-06-01', max_age_days: 90, freshness: 'fresh' as const };
    expect(isStale(e, '2026-08-01T00:00:00Z')).toBe(false);
    expect(isStale(e, '2026-09-26T00:00:00Z')).toBe(true);
  });

  it('(d) Siegel zaehlt nur fuer die eigene SKU', () => {
    const s = base();
    expect(evidencedSealLevel(s.inputs)).toBe('SEAL-3');
    s.inputs.product_sku = 'other-product';
    expect(evidencedSealLevel(s.inputs)).toBeNull();
  });

  it('Evidence-Regel: unknown relied-on verbietet PASS und CONDITIONAL', () => {
    const s = base();
    s.inputs.evidence[2]!.status = 'unknown';
    const f = forbiddenResults(s.inputs, s.evidence_cutoff).forbidden;
    expect(f.has('PASS') && f.has('CONDITIONAL')).toBe(true);
    expect(f.has('UNKNOWN')).toBe(false);
  });
});

describe('inputs_hash', () => {
  it('nutzt die kanonische Serialisierung von governance_evidence (RFC 8785)', async () => {
    const s = base();
    expect(s.inputs_hash_method).toBe(ASSESSMENT_INPUTS_HASH_METHOD);
    expect(await assessmentInputsHash(s.inputs)).toBe(s.inputs_hash);
    // Schluesselreihenfolge aendert den Hash nicht.
    const reordered = Object.fromEntries(Object.entries(s.inputs).reverse());
    expect(canonicalJson(reordered)).toBe(canonicalJson(s.inputs));
  });
});

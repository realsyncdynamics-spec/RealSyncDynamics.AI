import { describe, it, expect } from 'vitest';
import { computeTrustOutput, trustBand, type TrustScoreInput } from '../../src/lib/provenance/trustScore';

const good: TrustScoreInput = {
  assetId: 'AST-1',
  signatureValid: true,
  custodyState: 'intact',
  metadataIntegrity: true,
  ownershipConsistency: true,
  policyConflict: false,
  evaluatedAt: '2026-07-01T10:00:00.000Z',
};

describe('computeTrustOutput', () => {
  it('gibt 100 und keine Risiken bei voller Evidenz', () => {
    const out = computeTrustOutput(good);
    expect(out.trustScore).toBe(100);
    expect(out.riskLabels).toEqual([]);
    expect(out.escalationTriggered).toBe(false);
    expect(out.evidenceComponents).toEqual({
      metadataIntegrity: true,
      ownershipConsistency: true,
      provenanceContinuity: true,
    });
  });

  it('zieht bei ungültiger Signatur 40 Punkte ab und setzt signature_gap', () => {
    const out = computeTrustOutput({ ...good, signatureValid: false });
    expect(out.trustScore).toBe(60);
    expect(out.riskLabels).toContain('signature_gap');
  });

  it('eskaliert bei manipulierter Custody-Kette', () => {
    const out = computeTrustOutput({ ...good, custodyState: 'tampered' });
    expect(out.escalationTriggered).toBe(true);
    expect(out.evidenceComponents.provenanceContinuity).toBe(false);
  });

  it('markiert disputed_ownership und eskaliert', () => {
    const out = computeTrustOutput({ ...good, ownershipConsistency: false });
    expect(out.riskLabels).toContain('disputed_ownership');
    expect(out.escalationTriggered).toBe(true);
  });

  it('setzt unverifiable_source bei unverifizierbarer Kette', () => {
    const out = computeTrustOutput({ ...good, custodyState: 'unverifiable' });
    expect(out.riskLabels).toContain('unverifiable_source');
    expect(out.trustScore).toBe(80);
  });

  it('klemmt den Score bei 0 und dedupliziert Labels', () => {
    const out = computeTrustOutput({
      ...good,
      signatureValid: false,
      custodyState: 'tampered',
      metadataIntegrity: false,
      ownershipConsistency: false,
      policyConflict: true,
    });
    expect(out.trustScore).toBe(0);
    expect(out.escalationTriggered).toBe(true);
    // keine Duplikate
    expect(new Set(out.riskLabels).size).toBe(out.riskLabels.length);
  });

  it('ist deterministisch', () => {
    expect(computeTrustOutput(good)).toEqual(computeTrustOutput({ ...good }));
  });
});

describe('trustBand', () => {
  it('teilt in high/medium/low ein', () => {
    expect(trustBand(100)).toBe('high');
    expect(trustBand(80)).toBe('high');
    expect(trustBand(79)).toBe('medium');
    expect(trustBand(50)).toBe('medium');
    expect(trustBand(49)).toBe('low');
    expect(trustBand(0)).toBe('low');
  });
});

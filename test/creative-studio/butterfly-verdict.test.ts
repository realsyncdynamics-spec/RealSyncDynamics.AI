import { describe, expect, it } from 'vitest';
import { butterflyVerdict, type ButterflyAttestation } from '../../src/features/creative-studio/digital-twin/butterflyVerdict';

const fullyVerified: ButterflyAttestation = {
  identityLevel: 'person', subjectBindingVerified: true, signerKeyTrusted: true,
  cryptographicSignatureValid: true, assetBytesMatch: true, consentCurrent: true,
  proofNotExpired: true, revoked: false, signaturePresent: true, checkedAgainstContent: true,
};

describe('Butterfly identity and provenance badge fails closed', () => {
  it('does not verify missing proof', () => {
    expect(butterflyVerdict(null).status).toBe('unverified');
  });
  it('requires independently checked person identity and media content', () => {
    expect(butterflyVerdict(fullyVerified).status).toBe('verified');
    expect(butterflyVerdict({...fullyVerified, identityLevel: 'account'}).status).toBe('unverified');
    expect(butterflyVerdict({...fullyVerified, signerKeyTrusted: false}).status).toBe('unverified');
    expect(butterflyVerdict({...fullyVerified, checkedAgainstContent: false}).status).toBe('unverified');
    expect(butterflyVerdict({...fullyVerified, signaturePresent: false}).status).toBe('unverified');
    expect(butterflyVerdict({...fullyVerified, proofNotExpired: false}).status).toBe('unverified');
  });
  it('denies revoked consent and identity attestation', () => {
    expect(butterflyVerdict({...fullyVerified, revoked: true}).status).toBe('revoked');
    expect(butterflyVerdict({...fullyVerified, consentCurrent: false}).status).toBe('revoked');
  });
  it('flags changed content or tampered signature', () => {
    expect(butterflyVerdict({...fullyVerified, assetBytesMatch: false}).status).toBe('mismatch');
    expect(butterflyVerdict({...fullyVerified, cryptographicSignatureValid: false}).status).toBe('mismatch');
  });
});

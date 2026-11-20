/**
 * RealSync Butterfly verification display contract (draft).
 *
 * The *verifier* must use an authoritative proof store, independent
 * trusted public-key registry, signature verification and content-byte hashing.
 * Do not fill this object from arbitrary browser/user input.
 * This function only renders a fail-closed status from such a verified report.
 */
export type ButterflyAttestation = {
  /** 'person' must mean independent ID/liveness and subject-to-account binding. */
  identityLevel: 'none' | 'account' | 'person';
  subjectBindingVerified: boolean;
  signerKeyTrusted: boolean;
  cryptographicSignatureValid: boolean;
  assetBytesMatch: boolean;
  consentCurrent: boolean;
  proofNotExpired: boolean;
  revoked: boolean;
  signaturePresent: boolean;
  /** Whether verification checked the actual content bytes, not only a QR URL. */
  checkedAgainstContent: boolean;
};

export type ButterflyStatus = 'unverified' | 'verified' | 'revoked' | 'mismatch';

export type ButterflyVerdict = {
  status: ButterflyStatus;
  displayText: string;
};

/** UI-only helper; not a substitute for signature, ID or revocation verification. */
export function butterflyVerdict(attestation: ButterflyAttestation | null): ButterflyVerdict {
  if (!attestation) return { status: 'unverified', displayText: 'Nicht verifiziert' };
  if (attestation.revoked || !attestation.consentCurrent) {
    return { status: 'revoked', displayText: 'Freigabe widerrufen / Nachweis ungültig' };
  }
  if (attestation.signaturePresent &&
    (!attestation.cryptographicSignatureValid ||
     (attestation.checkedAgainstContent && !attestation.assetBytesMatch))) {
    return { status: 'mismatch', displayText: 'Signatur oder Medienintegrität ungültig' };
  }
  if (
    attestation.identityLevel !== 'person' ||
    !attestation.subjectBindingVerified ||
    !attestation.signerKeyTrusted ||
    !attestation.signaturePresent ||
    !attestation.cryptographicSignatureValid ||
    !attestation.checkedAgainstContent ||
    !attestation.assetBytesMatch ||
    !attestation.consentCurrent ||
    !attestation.proofNotExpired
  ) {
    return { status: 'unverified', displayText: 'Nicht vollständig verifiziert' };
  }
  return { status: 'verified', displayText: 'Identität und Medienintegrität verifiziert' };
}

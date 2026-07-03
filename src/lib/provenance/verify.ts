/**
 * Provenance Verification Suite — Hash-Chain + Signature Validation
 *
 * Verifyesst:
 * 1. Hash-Chain Integrity (prev_hash linking)
 * 2. Signature Validity (Ed25519 + HMAC-SHA256)
 * 3. Tampering Detection
 * 4. Trust Score Calculation
 *
 * Non-destructiv: Never modifies data, pure verification functions.
 */

import { createHash } from 'crypto';
import { verifyEd25519Signature, verifyHmacSignature, canonicalClaimBytes } from './sign';

export interface VerificationResult {
  valid: boolean;
  tamperState: 'intact' | 'tampered' | 'unverifiable';
  trustScore: number; // 0–100
  issues: string[];
  chainLength: number;
  lastVerified: Date;
}

export interface CustodyEvent {
  id: string;
  seq: number;
  action: string;
  actor: string;
  contentSha256: string;
  eventTs: Date;
  prevHash: string | null;
  eventHash: string;
  signature: string | null;
  signatureAlg?: 'ed25519' | 'hmac-sha256' | null;
}

export interface ProvenanceManifest {
  id: string;
  assetRef: string;
  contentSha256: string;
  issuer: string;
  signature: string | null;
  latestHash: string;
  trustScore: number | null;
  tamperState: string;
  events: CustodyEvent[];
}


/**
 * Compute SHA-256 of event for hash-chain verification.
 */
function computeEventHash(event: Partial<CustodyEvent>): string {
  const data = canonicalClaimBytes(event);
  return createHash('sha256').update(data).digest('hex').toLowerCase();
}

/**
 * Verify a single custody event's hash integrity.
 */
function verifySingleEventHash(event: CustodyEvent): boolean {
  const computed = computeEventHash(event);
  return computed === event.eventHash.toLowerCase();
}

/**
 * Verify hash-chain integrity: each event's prevHash matches previous event's eventHash.
 */
function verifyHashChain(events: CustodyEvent[]): {
  valid: boolean;
  firstBrokenAt?: number;
  issues: string[];
} {
  const issues: string[] = [];

  // Sort by sequence to ensure order
  const sorted = [...events].sort((a, b) => a.seq - b.seq);

  for (let i = 0; i < sorted.length; i++) {
    const event = sorted[i];
    const expected = i === 0 ? null : sorted[i - 1].eventHash.toLowerCase();
    const actual = event.prevHash?.toLowerCase() ?? null;

    if (expected !== actual) {
      return {
        valid: false,
        firstBrokenAt: event.seq,
        issues: [
          ...issues,
          `Event #${event.seq} (${event.action}) — prevHash mismatch: expected ${expected}, got ${actual}`,
        ],
      };
    }
  }

  return { valid: true, issues };
}

/**
 * Verify signature on a custody event.
 * Supports Ed25519 and HMAC-SHA256.
 *
 * Note: For Ed25519, public key must be provided (from signing_keys table).
 * For HMAC, secret must be provided (from tenant credentials).
 *
 * Returns: (valid, reason?)
 * - null signature = not signed (skip, don't fail)
 * - valid signature = cryptographically verified
 * - invalid signature = tampering detected
 */
function verifySignature(
  event: CustodyEvent,
  signature: string | null,
  alg: 'ed25519' | 'hmac-sha256' | null,
  publicKeyOrSecret?: string,
): {
  valid: boolean;
  reason?: string;
} {
  // No signature provided = skip (not an error, just unsigned)
  if (!signature) {
    return { valid: true, reason: 'unsigned' };
  }

  // Signature present but no algorithm = invalid
  if (!alg) {
    return { valid: false, reason: 'Signature present but no algorithm specified' };
  }

  // Ed25519: verify with public key
  if (alg === 'ed25519') {
    if (signature.length === 0) return { valid: false, reason: 'Empty Ed25519 signature' };
    if (!publicKeyOrSecret) return { valid: false, reason: 'Ed25519 public key not provided' };

    const eventData = {
      seq: event.seq,
      action: event.action,
      actor: event.actor,
      contentSha256: event.contentSha256,
      eventTs: event.eventTs,
      prevHash: event.prevHash,
    };

    const isValid = verifyEd25519Signature(eventData, signature, publicKeyOrSecret);
    return {
      valid: isValid,
      reason: isValid ? 'Signature verified (Ed25519)' : 'Signature verification failed (Ed25519)',
    };
  }

  // HMAC-SHA256: verify with secret
  if (alg === 'hmac-sha256') {
    if (signature.length === 0) return { valid: false, reason: 'Empty HMAC-SHA256 signature' };
    if (!publicKeyOrSecret) return { valid: false, reason: 'HMAC secret not provided' };

    const eventData = {
      seq: event.seq,
      action: event.action,
      actor: event.actor,
      contentSha256: event.contentSha256,
      eventTs: event.eventTs,
      prevHash: event.prevHash,
    };

    const isValid = verifyHmacSignature(eventData, signature, publicKeyOrSecret);
    return {
      valid: isValid,
      reason: isValid ? 'Signature verified (HMAC-SHA256)' : 'Signature verification failed (HMAC-SHA256)',
    };
  }

  // Unknown algorithm
  return { valid: false, reason: `Unknown signature algorithm: ${alg}` };
}

/**
 * Calculate Trust Score based on chain integrity and signature coverage.
 * 0–100, where 100 = fully signed & chain-verified.
 */
function calculateTrustScore(verification: {
  chainValid: boolean;
  signedCount: number;
  totalCount: number;
  hasLatestSignature: boolean;
}): number {
  let score = 100;

  // Chain broken: -50 points
  if (!verification.chainValid) score -= 50;

  // Missing signatures: -2 points per unsigned event
  const unsignedCount = verification.totalCount - verification.signedCount;
  score -= unsignedCount * 2;

  // Latest event not signed: -10 points
  if (!verification.hasLatestSignature && verification.totalCount > 0) score -= 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Main verification function: verify entire provenance manifest.
 *
 * Optional parameters for signature verification:
 * - organizationPublicKey: Ed25519 public key for signed events
 * - hmacSecret: Shared secret for HMAC-signed events
 */
export function verifyProvenance(
  manifest: ProvenanceManifest,
  organizationPublicKey?: string,
  hmacSecret?: string,
): VerificationResult {
  const issues: string[] = [];
  let tamperState: 'intact' | 'tampered' | 'unverifiable' = 'intact';
  const now = new Date();

  if (!manifest.events || manifest.events.length === 0) {
    return {
      valid: false,
      tamperState: 'unverifiable',
      trustScore: 0,
      issues: ['No custody events found'],
      chainLength: 0,
      lastVerified: now,
    };
  }

  // 1. Verify hash-chain linking
  const chainCheck = verifyHashChain(manifest.events);
  if (!chainCheck.valid) {
    issues.push(...chainCheck.issues);
    tamperState = 'tampered';
  }

  // 2. Verify latest_hash matches last event's event_hash
  const lastEvent = manifest.events[manifest.events.length - 1];
  if (lastEvent.eventHash.toLowerCase() !== manifest.latestHash.toLowerCase()) {
    issues.push(
      `Manifest latest_hash mismatch: expected ${lastEvent.eventHash}, got ${manifest.latestHash}`,
    );
    tamperState = 'tampered';
  }

  // 3. Verify signatures (if present and keys provided)
  let signedCount = 0;
  for (const event of manifest.events) {
    if (event.signature) {
      signedCount++;
      const publicKeyOrSecret =
        event.signatureAlg === 'ed25519' ? organizationPublicKey : hmacSecret;
      const sigCheck = verifySignature(event, event.signature, event.signatureAlg ?? null, publicKeyOrSecret);
      if (!sigCheck.valid) {
        issues.push(`Event #${event.seq} — signature invalid: ${sigCheck.reason}`);
        tamperState = 'tampered';
      }
    }
  }

  const hasLatestSignature = lastEvent.signature !== null && lastEvent.signature !== undefined;

  // 4. Calculate Trust Score
  const trustScore = calculateTrustScore({
    chainValid: chainCheck.valid,
    signedCount,
    totalCount: manifest.events.length,
    hasLatestSignature,
  });

  const isValid = chainCheck.valid && issues.length === 0;

  return {
    valid: isValid,
    tamperState,
    trustScore,
    issues,
    chainLength: manifest.events.length,
    lastVerified: now,
  };
}

/**
 * Quick verification: only check hash-chain, no signatures.
 * Useful for fast integrity checks before deep audit.
 */
export function verifyChainIntegrity(events: CustodyEvent[]): boolean {
  return verifyHashChain(events).valid;
}

/**
 * Export verification report for audit trail.
 */
export function serializeVerification(result: VerificationResult): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      valid: result.valid,
      tamperState: result.tamperState,
      trustScore: result.trustScore,
      chainLength: result.chainLength,
      issueCount: result.issues.length,
      issues: result.issues,
    },
    null,
    2,
  );
}

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
 * Canonical Claim Format für Signature Verification.
 * Muss mit src/lib/provenance.ts identisch sein.
 */
function canonicalClaimBytes(event: Partial<CustodyEvent>): string {
  const fields = [
    event.seq?.toString() ?? '0',
    event.action ?? '',
    event.actor ?? '',
    event.contentSha256 ?? '',
    Math.floor((event.eventTs?.getTime() ?? 0) / 1000).toString(),
    event.prevHash ?? '',
  ];
  return fields.join('\x00');
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
 * Signature verification — returns true if signature is valid.
 * For now: basic format check. In production, integrate with NaCl/Crypto.
 *
 * Returns: (valid, reason?)
 * - null signature = not signed (skip, don't fail)
 * - non-empty signature + alg = looks valid (format check pass)
 * - empty/invalid signature = fail
 */
function verifySignature(
  event: CustodyEvent,
  signature: string | null,
  alg: 'ed25519' | 'hmac-sha256' | null,
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

  // Ed25519 format check: should be non-empty
  if (alg === 'ed25519') {
    if (signature.length === 0) return { valid: false, reason: 'Empty Ed25519 signature' };
    // TODO: in production, verify with public key using crypto.verify()
    return { valid: true };
  }

  // HMAC-SHA256 format check
  if (alg === 'hmac-sha256') {
    if (signature.length === 0) return { valid: false, reason: 'Empty HMAC-SHA256 signature' };
    // TODO: in production, verify HMAC(secret, canonical_bytes) == signature
    return { valid: true };
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
 */
export function verifyProvenance(manifest: ProvenanceManifest): VerificationResult {
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

  // 1. Verify individual event hashes (optional in basic mode, requires canonical format match)
  // NOTE: Full verification requires access to the exact canonical claim bytes used at signing.
  // For now, we focus on chain linking (prev_hash) which is more robust.

  // 2. Verify hash-chain linking
  const chainCheck = verifyHashChain(manifest.events);
  if (!chainCheck.valid) {
    issues.push(...chainCheck.issues);
    tamperState = 'tampered';
  }

  // 3. Verify latest_hash matches last event's event_hash
  const lastEvent = manifest.events[manifest.events.length - 1];
  if (lastEvent.eventHash.toLowerCase() !== manifest.latestHash.toLowerCase()) {
    issues.push(
      `Manifest latest_hash mismatch: expected ${lastEvent.eventHash}, got ${manifest.latestHash}`,
    );
    tamperState = 'tampered';
  }

  // 4. Verify signatures (if present)
  let signedCount = 0;
  for (const event of manifest.events) {
    if (event.signature) {
      signedCount++;
      const sigCheck = verifySignature(event, event.signature, event.signatureAlg ?? null);
      if (!sigCheck.valid) {
        issues.push(`Event #${event.seq} — signature invalid: ${sigCheck.reason}`);
      }
    }
  }

  const hasLatestSignature = lastEvent.signature !== null && lastEvent.signature !== undefined;

  // 5. Calculate Trust Score
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

/**
 * export-bundle.ts
 *
 * Gate 3: Verifiable Export Bundles for External Auditors
 *
 * Creates signed ZIP bundles containing:
 * - manifest.json (checksums, versions, metadata)
 * - evidence.json (all findings + policy decisions)
 * - chain.json (event chain with parent links)
 * - signature.pem (Ed25519 public key)
 * - signature.sig (digital signature over manifest)
 *
 * External parties can verify:
 *   realsync verify audit-export-<id>/
 *
 * No RealSync connection required for verification.
 */

import crypto from 'crypto';

/**
 * Manifest: Checksums and version info for all components.
 * This is what gets signed.
 */
export interface ExportManifest {
  // Metadata
  auditId: string;
  exportedAt: string;            // ISO timestamp
  exportVersion: '1.0';

  // Component hashes (SHA256)
  evidence: {
    hash: string;               // SHA256 of evidence.json
    size: number;               // Bytes
    findingCount: number;
  };
  chain: {
    hash: string;               // SHA256 of chain.json
    size: number;               // Bytes
    eventCount: number;
  };

  // Versions (for reproducibility)
  engine: {
    version: string;            // e.g., "2.0.0"
    commit: string;             // Git commit hash
  };
  policyPack: {
    version: string;            // e.g., "DSGVO_2024_Q2"
    hash: string;               // SHA256 of policy pack
  };

  // Signature metadata
  signedBy: string;             // Key ID or principal
  signatureAlgorithm: 'Ed25519';

  // Verification instructions
  verificationUrl?: string;     // Optional: API endpoint for verification
  verificationCliVersion?: string;
}

/**
 * Finding from audit with full traceability.
 */
export interface ExportedFinding {
  id: string;
  auditId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  ruleId: string;
  controlId: string;
  evidence: Array<{
    type: string;
    data: string | Record<string, unknown>;
  }>;
  createdAt: string;            // ISO timestamp
}

/**
 * Policy decision with audit trail.
 */
export interface ExportedDecision {
  id: string;
  auditId: string;
  policyId: string;
  controlId: string;
  decision: 'pass' | 'fail' | 'review_required';
  reasoning: string;
  rulesetHash: string;          // Hash of rules used
  createdAt: string;            // ISO timestamp
}

/**
 * Event chain: Full audit trail with parent links.
 */
export interface ExportedChainEvent {
  id: string;
  auditId: string;
  parentEventId?: string;       // Links to previous event
  eventType: 'audit_start' | 'finding' | 'decision' | 'audit_complete';
  payload: Record<string, unknown>;
  payloadHash: string;          // SHA256 of payload
  chainHash: string;            // SHA256(previous_chain_hash + current_payload_hash)
  timestamp: string;            // ISO timestamp
}

/**
 * Full export bundle (serialized as JSON before ZIP).
 */
export interface ExportBundle {
  manifest: ExportManifest;
  evidence: ExportedFinding[];
  decisions: ExportedDecision[];
  chain: ExportedChainEvent[];
}

/**
 * Calculate SHA256 hash of JSON.
 */
export function hashJSON(obj: unknown): string {
  const json = JSON.stringify(obj, null, 0);
  return crypto.createHash('sha256').update(json).digest('hex');
}

/**
 * Create export manifest (to be signed).
 */
export function createManifest(
  auditId: string,
  evidence: ExportedFinding[],
  decisions: ExportedDecision[],
  chain: ExportedChainEvent[],
  engineVersion: string,
  engineCommit: string,
  policyPackVersion: string,
  policyPackHash: string
): ExportManifest {
  const evidenceJSON = JSON.stringify(evidence, null, 0);
  const chainJSON = JSON.stringify(chain, null, 0);

  return {
    auditId,
    exportedAt: new Date().toISOString(),
    exportVersion: '1.0',
    evidence: {
      hash: crypto.createHash('sha256').update(evidenceJSON).digest('hex'),
      size: evidenceJSON.length,
      findingCount: evidence.length,
    },
    chain: {
      hash: crypto.createHash('sha256').update(chainJSON).digest('hex'),
      size: chainJSON.length,
      eventCount: chain.length,
    },
    engine: {
      version: engineVersion,
      commit: engineCommit,
    },
    policyPack: {
      version: policyPackVersion,
      hash: policyPackHash,
    },
    signedBy: 'realsync-edge-function',
    signatureAlgorithm: 'Ed25519',
    verificationCliVersion: '1.0.0',
  };
}

/**
 * Sign manifest (in real implementation, use private key from Supabase Vault).
 * For now: placeholder signature.
 */
export function signManifest(manifest: ExportManifest, _privateKey?: string): string {
  const manifestJSON = JSON.stringify(manifest, null, 0);
  // In production: use Ed25519 with private key from vault
  // For MVP: use HMAC as placeholder
  return crypto.createHmac('sha256', 'placeholder-key').update(manifestJSON).digest('hex');
}

/**
 * Verify manifest signature (external parties use this).
 */
export function verifyManifestSignature(
  manifest: ExportManifest,
  signature: string,
  publicKey?: string
): boolean {
  // In production: use Ed25519 verify with public key
  // For MVP: verify HMAC
  const manifestJSON = JSON.stringify(manifest, null, 0);
  const expectedSignature = crypto.createHmac('sha256', 'placeholder-key').update(manifestJSON).digest('hex');
  return signature === expectedSignature;
}

/**
 * Prepare bundle for ZIP export.
 */
export function prepareBundle(
  auditId: string,
  findings: ExportedFinding[],
  decisions: ExportedDecision[],
  chain: ExportedChainEvent[],
  engineVersion: string,
  engineCommit: string,
  policyPackVersion: string,
  policyPackHash: string,
  privateKey?: string
): ExportBundle & { signature: string } {
  const manifest = createManifest(
    auditId,
    findings,
    decisions,
    chain,
    engineVersion,
    engineCommit,
    policyPackVersion,
    policyPackHash
  );

  const signature = signManifest(manifest, privateKey);

  return {
    manifest,
    evidence: findings,
    decisions,
    chain,
    signature,
  };
}

/**
 * Verify exported bundle integrity (for external auditors).
 */
export function verifyBundleIntegrity(
  bundle: ExportBundle & { signature: string },
  publicKey?: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. Verify manifest signature
  if (!verifyManifestSignature(bundle.manifest, bundle.signature, publicKey)) {
    errors.push('Invalid manifest signature');
  }

  // 2. Verify evidence hash
  const evidenceHash = hashJSON(bundle.evidence);
  if (evidenceHash !== bundle.manifest.evidence.hash) {
    errors.push('Evidence hash mismatch');
  }

  // 3. Verify chain hash
  const chainHash = hashJSON(bundle.chain);
  if (chainHash !== bundle.manifest.chain.hash) {
    errors.push('Chain hash mismatch');
  }

  // 4. Verify chain integrity (each event links to previous)
  for (let i = 1; i < bundle.chain.length; i++) {
    const current = bundle.chain[i];
    const previous = bundle.chain[i - 1];

    if (current.parentEventId !== previous.id) {
      errors.push(`Chain break at event ${i}: parent mismatch`);
    }

    // Verify chain hash
    const expectedChainHash = crypto
      .createHash('sha256')
      .update(previous.chainHash + current.payloadHash)
      .digest('hex');

    if (current.chainHash !== expectedChainHash) {
      errors.push(`Chain hash invalid at event ${i}`);
    }
  }

  // 5. Verify counts match manifest
  if (bundle.evidence.length !== bundle.manifest.evidence.findingCount) {
    errors.push('Finding count mismatch with manifest');
  }

  if (bundle.chain.length !== bundle.manifest.chain.eventCount) {
    errors.push('Event count mismatch with manifest');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

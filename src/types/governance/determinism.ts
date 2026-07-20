/**
 * @file determinism.ts
 * @description Gate 1: Golden Audit Fixture — Types for determinism & reproducibility proofs.
 *
 * Proof-based compliance: External auditors verify that identical inputs produce
 * identical outputs, enabling independent verification without trusting RealSync.
 */

/**
 * Snapshot of a single audit execution with full version traceability.
 * Multiple snapshots (cycles) per fixture → determinism proof.
 */
export interface AuditDeterminismTest {
  id: string;

  // Fixture metadata
  fixtureId: string;
  fixtureDescription?: string;

  // Audit reference
  auditId: string;
  tenantId: string;

  // Input snapshot
  inputHash: string;                    // SHA256 of assets
  inputAssetCount?: number;
  inputSizeBytes?: number;

  // Findings & decisions (hashes for integrity)
  findingsCount: number;
  findingsHash: string;                 // SHA256(sorted findings)
  decisionCount: number;
  decisionHash: string;                 // SHA256(sorted decisions)

  // Execution environment
  engineVersion: string;                // e.g., "2.0.0"
  engineCommit?: string;                // Git commit hash
  engineBuildTime?: string;             // ISO timestamp
  policyPackVersion: string;            // e.g., "DSGVO_2024_Q2"
  policyPackHash: string;               // SHA256 of policy pack
  policyPackControls?: number;          // Number of controls

  // Test metadata
  testCycle: number;                    // Cycle 1-5 typically
  totalCycles?: number;                 // Expected cycles for fixture

  // Reproducibility proof
  isDeterministic?: boolean;            // Filled after all cycles
  determinismVerifiedAt?: string;       // ISO timestamp

  // Timing
  executionStartedAt: string;           // ISO timestamp
  executionEndedAt: string;             // ISO timestamp
  createdAt: string;                    // ISO timestamp
}

/**
 * Summary of all cycles for a fixture.
 * Shows: consistency of hashes, versions tested, overall determinism status.
 */
export interface DeterminismFixtureSummary {
  fixtureId: string;
  fixtureDescription?: string;
  tenantId: string;

  // Aggregate stats
  totalCycles: number;
  engineVersionsTested: string[];
  policyVersionsTested: string[];

  // Hash consistency
  distinctFindingHashes: string[];      // Should have length 1 if deterministic
  distinctDecisionHashes: string[];     // Should have length 1 if deterministic
  findingsConsistent: boolean;          // All finding hashes identical?
  decisionsConsistent: boolean;         // All decision hashes identical?

  // Timeline
  testStarted: string;                  // ISO timestamp of first cycle
  testCompleted: string;                // ISO timestamp of last cycle
  lastUpdated: string;                  // ISO timestamp
}

/**
 * Verifiable evidence that an audit is reproducible.
 * Signed manifest that external auditors can check offline.
 */
export interface DeterminismProof {
  auditId: string;
  fixtureId: string;

  // The claim
  summary: DeterminismFixtureSummary;

  // Evidence: all execution snapshots
  executionSnapshots: AuditDeterminismTest[];

  // Signatures
  signedBy: string;                     // Service role or key ID
  signature?: string;                   // Ed25519 signature over summary

  // For audit trail
  generatedAt: string;                  // ISO timestamp
  externallyVerifiedAt?: string;        // When 3rd party verified
}

/**
 * Request to execute audit with determinism tracking.
 */
export interface AuditDeterminismRequest {
  fixtureId: string;
  fixtureDescription?: string;

  // What to audit
  auditId: string;

  // Engine versions to use
  engineVersion: string;
  policyPackVersion: string;

  // Test execution
  testCycle: number;                    // Which cycle is this (1-5)?
  totalCycles: number;                  // Expected total
}

/**
 * Result of a determinism test after all cycles complete.
 */
export interface DeterminismTestResult {
  fixtureId: string;
  isDeterministic: boolean;

  // Why or why not?
  findingsHashConsistency: boolean;
  decisionHashConsistency: boolean;

  // What was tested?
  engineVersions: string[];
  policyVersions: string[];

  // Proof artifacts
  proof: DeterminismProof;

  // When
  verifiedAt: string;                   // ISO timestamp
}

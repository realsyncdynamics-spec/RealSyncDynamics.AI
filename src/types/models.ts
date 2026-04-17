/**
 * @file models.ts
 * @description First-class backend entities for provenance, licensing, trust, and registration.
 * These interfaces define the sovereign control layer data structures.
 */

// ==========================================
// Layer 1: Identity & Trust Boundary
// ==========================================
export interface TrustProfile {
  id: string;
  entityType: 'creator' | 'company' | 'institution' | 'public_sector';
  verificationState: 'unverified' | 'identity_checked' | 'kyb_cleared' | 'sovereign_verified';
  complianceLevel: 'baseline' | 'advanced' | 'institutional' | 'sovereign';
  licensingEligibility: boolean;
  workspaceId: string;
  roles: string[];
}

// ==========================================
// Layer 2: Content Reference Registration
// ==========================================
export interface ContentRegistration {
  referenceId: string; // Immutable canonical ID
  creatorId: string;
  sourceUrl: string; // YouTube, Spotify, owned domain, etc.
  metadata: {
    title: string;
    category: string;
    description: string;
    declaredRightsHolder: string;
    regionalConstraints: string[];
  };
  fingerprint: string; // Hash of URL + Metadata
  evidencePackageId: string;
  registeredAt: string; // ISO Timestamp
}

// ==========================================
// Layer 3: Provenance & Authenticity
// ==========================================
export interface ProvenanceRecord {
  recordId: string;
  contentReferenceId: string;
  c2paClaimUri: string;
  hashDigest: string;
  tamperEvidenceState: 'intact' | 'tampered' | 'unverifiable';
  chainOfCustody: Array<{
    action: 'registered' | 'updated' | 'licensed' | 'audited';
    actorId: string;
    timestamp: string;
    signature: string;
  }>;
}

// ==========================================
// Layer 4: Licensing & Rights Execution
// ==========================================
export interface LicenseRecord {
  licenseId: string;
  contentReferenceId: string;
  buyerId: string;
  catalogType: 'personal' | 'commercial' | 'subscription' | 'enterprise' | 'exclusive';
  rightsPolicy: {
    territory: string[];
    durationMonths: number | 'perpetual';
    sublicensingAllowed: boolean;
    resaleAllowed: boolean;
  };
  encryptedLicenseKey: string;
  status: 'active' | 'revoked' | 'expired';
  settlementEventId: string;
}

// ==========================================
// Layer 5: Trust Score & Risk Assessment
// ==========================================
export interface TrustOutput {
  assetId: string;
  trustScore: number; // 0-100
  riskLabels: Array<'disputed_ownership' | 'unverifiable_source' | 'policy_conflict' | 'signature_gap'>;
  evidenceComponents: {
    metadataIntegrity: boolean;
    ownershipConsistency: boolean;
    provenanceContinuity: boolean;
  };
  escalationTriggered: boolean;
  evaluatedAt: string;
}

// ==========================================
// Layer 7: Compliance & Audit
// ==========================================
export interface AuditLogEntry {
  eventId: string;
  tenantId: string;
  eventType: 'policy_change' | 'registration_change' | 'license_issuance' | 'access_attempt' | 'payout_action';
  actorId: string;
  targetResource: string;
  timestamp: string;
  evidenceSnapshot: Record<string, any>;
}

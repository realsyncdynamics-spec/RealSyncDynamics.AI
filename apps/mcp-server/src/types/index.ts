export interface ApiKeyCredential {
  id: string;
  keyHash: string;
  tenantId: string;
  scopes: string[];
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  active: boolean;
}

export interface MctAuthContext {
  keyId: string;
  tenantId: string;
  scopes: string[];
}

export interface EvidenceSnapshot {
  id: string;
  tenantId: string;
  subjectRef: string;
  label?: string;
  version: number;
  contentSha256: string;
  prevHash?: string;
  eventHash: string;
  signature?: string;
  retentionClass: string;
  retainedUntil?: Date;
  createdBy?: string;
  createdAt: Date;
  onHold?: boolean;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  action: string;
  subject: string;
  actor: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

export interface GovernanceControl {
  id: string;
  tenantId: string;
  controlId: string;
  name: string;
  description?: string;
  category: string;
  status: 'compliant' | 'non_compliant' | 'in_progress';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  lastReviewedAt?: Date;
  updatedAt: Date;
}

export interface ComplianceStatus {
  tenantId: string;
  frameworkId: string;
  score: number;
  compliantControls: number;
  totalControls: number;
  criticalIssues: number;
  lastUpdated: Date;
}

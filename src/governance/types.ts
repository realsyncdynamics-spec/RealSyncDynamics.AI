/**
 * Governance Engine – Type System
 * Core types for policy evaluation, AI Act compliance, GDPR checks.
 */

export type AIActRiskClass = 'prohibited' | 'high' | 'limited' | 'minimal';
export type ComplianceStatus = 'compliant' | 'non-compliant' | 'partial' | 'unknown';
export type GDPRBasis = 'consent' | 'contract' | 'legal' | 'vital' | 'public' | 'legitimate' | 'none';

export interface AISystem {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  riskClass: AIActRiskClass;
  hasHighImpact: boolean;
  usesRemoteProcessing?: boolean;
  usesEmotionalRecognition?: boolean;
  usesBiometric?: boolean;
  usesLargeLangModel?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyControl {
  controlId: string;
  name: string;
  description: string;
  category: 'technical' | 'organizational' | 'process';
  status: ComplianceStatus;
  evidence?: string[];
  lastVerifiedAt?: Date;
}

export interface PolicyDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  riskClass: AIActRiskClass;
  gdprBasis: GDPRBasis;
  controls: PolicyControl[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyContext {
  aiSystemId: string;
  aiSystem: AISystem;
  policyId: string;
  policy: PolicyDefinition;
  evaluatedAt: Date;
  correlationId: string;
}

export interface Finding {
  id: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  controlId?: string;
  remediationSteps?: string[];
  deadline?: Date;
}

export interface PolicyEvaluation {
  id: string;
  policyId: string;
  policyVersion: string;
  aiSystemId: string;
  compliant: boolean;
  status: ComplianceStatus;
  findings: Finding[];
  controlStatus: Map<string, ComplianceStatus>;
  explanation: string;
  riskScore: number; // 0-100
  decidedAt: Date;
  expiresAt?: Date;
  correlationId: string;
}

export interface PolicyVersion {
  id: string;
  policyId: string;
  version: string;
  policy: PolicyDefinition;
  changes: string[];
  createdBy: string;
  createdAt: Date;
}

export interface AuditEntry {
  id: string;
  policyId: string;
  aiSystemId: string;
  action: 'evaluate' | 'approve' | 'update' | 'revoke';
  actor: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  timestamp: Date;
  correlationId: string;
}

export interface SimulationDraft {
  id: string;
  name: string;
  description: string;
  riskClass: AIActRiskClass;
  gdprBasis: GDPRBasis;
  controls: Partial<PolicyControl>[];
}

export interface SimulationResult {
  draftId: string;
  simulationId: string;
  compliant: boolean;
  complianceScore: number; // 0-100
  findings: Finding[];
  recommendations: string[];
  estimatedComplianceTime?: number; // hours
  criticalGaps: string[];
}

export interface AIActRequirements {
  riskClass: AIActRiskClass;
  requiresRiskAssessment: boolean;
  requiresDataProcessingAgreement: boolean;
  requiresExplainability: boolean;
  requiresHumanOversight: boolean;
  requiresDocumentation: boolean;
  requiresAuditTrail: boolean;
  prohibitedUseCase: boolean;
  minimumControls: number;
}

export interface GDPRRequirements {
  basis: GDPRBasis;
  requiresConsent: boolean;
  requiresDataProcessingAgreement: boolean;
  requiresPrivacyImpactAssessment: boolean;
  requiresDataProtectionOfficer: boolean;
  dataRetentionMonths?: number;
  requiresRightToAccess: boolean;
  requiresRightToErasure: boolean;
  requiresRightToObjection: boolean;
}

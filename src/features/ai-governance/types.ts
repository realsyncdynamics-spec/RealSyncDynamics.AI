/**
 * AI Governance Core — TypeScript-Typen fuer AI Systems Registry,
 * Policy Engine und Evidence Vault. Spiegeln das Schema in
 * supabase/migrations/20260510_ai_governance_core.sql wider.
 *
 * Convention: Properties in camelCase, DB-Spalten in snake_case (Mapping
 * passiert beim Read/Write — fuer die Demo-Daten in dieser PR sind alle
 * Datenstrukturen in-memory, kein Mapping noetig).
 */

export type AiActClass =
  | 'minimal'
  | 'limited'
  | 'high'
  | 'prohibited'
  | 'unknown';

export type AiSystemStatus =
  | 'draft'
  | 'active'
  | 'under_review'
  | 'approved'
  | 'archived';

export interface AiSystem {
  id: string;
  name: string;
  vendor?: string;
  modelName?: string;
  department?: string;
  ownerEmail?: string;
  purpose?: string;
  dataTypes: string[];
  aiActClass: AiActClass;
  /** 0-100, hoeher = riskanter. Berechnet aus aiActClass + sensitivity. */
  riskScore: number;
  status: AiSystemStatus;
}

export interface AiPolicy {
  id: string;
  name: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ruleType:
    | 'data_transfer'
    | 'model_usage'
    | 'human_review'
    | 'logging_required'
    | 'vendor_restriction';
  action: 'allow' | 'warn' | 'block' | 'require_approval';
  enabled: boolean;
}

export interface AiEvidenceEvent {
  id: string;
  aiSystemId?: string;
  policyId?: string;
  eventType: string;
  eventSummary: string;
  riskLevel: 'info' | 'low' | 'medium' | 'high' | 'critical';
  evidence: Record<string, unknown>;
  createdAt: string;
}

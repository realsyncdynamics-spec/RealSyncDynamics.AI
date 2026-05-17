// Shared types for the Developer Remediation Agent UI.

export type RemediationStatus =
  | 'draft' | 'review_required' | 'approved' | 'rejected' | 'applied';

export type RemediationAffectedSystem =
  | 'website' | 'api' | 'edge_function' | 'ci_cd' | 'consent_layer' | 'unknown';

export type RemediationTechnology =
  | 'react' | 'vite' | 'nginx' | 'apache'
  | 'cloudflare' | 'vercel' | 'supabase' | 'unknown';

export interface RemediationStep {
  title:  string;
  detail: string;
}

export interface RemediationSnippet {
  path:     string;
  language: string;
  content:  string;
  notes:    string;
}

export interface RemediationPlan {
  id:               string;
  tenant_id:        string;
  finding_id:       string;
  evidence_id:      string | null;
  status:           RemediationStatus;
  affected_system:  RemediationAffectedSystem;
  technology:       RemediationTechnology;
  summary:          string;
  steps:            RemediationStep[];
  snippets:         RemediationSnippet[];
  confidence:       number;
  review_required:  boolean;
  created_by:       string | null;
  created_at:       string;
  updated_at:       string;
}

export interface CreateRemediationPlanArgs {
  tenant_id:    string;
  finding_id:   string;
  evidence_id?: string;
  target: {
    system:        RemediationAffectedSystem;
    technology:    RemediationTechnology;
    repository?:   string;
    finding_text:  string;
  };
}

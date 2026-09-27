/** Frontend Modernization Tool (FMT) — types aligned to fmt_* schema. */

export type FmtProjectStatus =
  | 'draft'
  | 'in_progress'
  | 'ready_to_publish'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'archived';

export type FmtWizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface FmtProject {
  id: string;
  tenant_id: string;
  created_by: string | null;
  name: string;
  status: FmtProjectStatus;
  wizard_step: FmtWizardStep;
  product_track: 'modernize_frontend';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FmtSourceSite {
  id: string;
  tenant_id: string;
  project_id: string;
  source_url: string;
  normalized_host: string | null;
  fetch_status: 'pending' | 'ok' | 'failed' | 'blocked';
  raw_meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const FMT_STEPS: { step: FmtWizardStep; key: string; label: string; hint: string }[] = [
  { step: 1, key: 'source', label: 'Reality Scan', hint: 'Bestehende Website als Quelle erfassen' },
  { step: 2, key: 'scan', label: 'Analyse', hint: 'Inhalte, Design, Formulare, Tracking, Lücken' },
  { step: 3, key: 'content', label: 'Brand Brain', hint: 'Marke, Angebote, Tonalität, Compliance' },
  { step: 4, key: 'blueprint', label: 'Frontend Blueprint', hint: 'Seiten, Komponenten, CTAs, SEO' },
  { step: 5, key: 'bots', label: 'Agent Setup', hint: 'Lead-/Support-/Buchungsbot, CRM-Übergabe' },
  { step: 6, key: 'publish', label: 'Release Governance', hint: 'Preview, Freigabe, Version, Audit' },
];

export const FMT_ENTITLEMENT_KEY = 'frontend.modernization' as const;

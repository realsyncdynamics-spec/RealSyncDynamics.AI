/**
 * Shared types for the Website Operations feature.
 * Single source of truth so the dashboard, wizard and card components
 * agree on the WebsiteProject shape (previously each file declared its own,
 * which produced structural type mismatches at the component boundaries).
 */

export type WebsiteProjectStatus = 'draft' | 'preview' | 'live' | 'archived';

export interface WebsiteProject {
  id: string;
  name: string;
  industry: string;
  status: WebsiteProjectStatus;
  compliance_score: number;
  deployment_url?: string;
  preview_url?: string;
  last_deployed_at?: string;
  created_at: string;
}

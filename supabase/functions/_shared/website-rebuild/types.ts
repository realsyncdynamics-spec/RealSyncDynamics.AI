// Gemeinsame Typen für den Website-Rebuild-Workflow.

export type StepName =
  | 'scrape'
  | 'audit'
  | 'strip_trackers'
  | 'self_host'
  | 'inject_consent'
  | 'legal_pages'
  | 'ai_ready'
  | 'package_deploy';

export const STEP_ORDER: readonly StepName[] = [
  'scrape',
  'audit',
  'strip_trackers',
  'self_host',
  'inject_consent',
  'legal_pages',
  'ai_ready',
  'package_deploy',
] as const;

export interface RebuildContext {
  rebuildId: string;
  sourceUrl: string;
  sourceDomain: string;
  customerEmail: string;
  company: string | null;
  auditId: string | null;
  tenantId: string | null;
  tier: 'managed' | 'premium' | 'enterprise';
  workflowVersion: string;
}

export interface ScrapedSite {
  html: string;
  title: string;
  cssLinks: string[];
  scriptSrcs: string[];
  imageSrcs: string[];
  iframeSrcs: string[];
  fontUrls: string[];
  inlineScripts: string[];
  meta: Record<string, string>;
  byteSize: number;
}

export interface RemediationReport {
  trackersRemoved: string[];
  iframesNeutralized: string[];
  fontsSelfHosted: string[];
  scriptsRemoved: number;
  scriptsKept: number;
  warnings: string[];
}

export interface StepResult {
  status: 'success' | 'failed' | 'skipped';
  summary: string;
  metadata: Record<string, unknown>;
  durationMs: number;
}

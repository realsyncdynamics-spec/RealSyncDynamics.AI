// Client wrapper around the `governance-remediate` Edge Function.

import { getSupabase } from '../../lib/supabase';

export type RemediationPattern =
  | 'csp_header_block'
  | 'consent_wrapper'
  | 'font_self_host'
  | 'tracker_dom_remove'
  | 'dsgvo_footer_block';

export type RemediationStatus =
  | 'suggested'
  | 'reviewed'
  | 'applied'
  | 'rejected'
  | 'superseded';

export interface RemediationSnippet {
  id: string;
  tenant_id: string;
  asset_id: string | null;
  event_id: string | null;
  pattern: RemediationPattern;
  target_lang: string;
  title: string;
  rationale: string;
  snippet: string;
  applies_to: string | null;
  regulation_refs: string[];
  status: RemediationStatus;
  applied_at: string | null;
  applied_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  asset?: { id: string; name: string; asset_type: string } | null;
}

interface Wrap<T> {
  ok: boolean;
  error?: { code: string; message: string };
  snippet?: T;
  snippets?: T[];
}

async function call<T>(body: Record<string, unknown>): Promise<Wrap<T>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('governance-remediate', { body });
  if (error) return { ok: false, error: { code: 'NETWORK', message: error.message } };
  return data as Wrap<T>;
}

export const listSnippets = (tenant_id: string, status?: RemediationStatus, asset_id?: string) =>
  call<RemediationSnippet>({ op: 'list', tenant_id, status, asset_id });

export const generateSnippet = (input: {
  tenant_id: string;
  pattern: RemediationPattern;
  params: Record<string, string>;
  asset_id?: string;
  event_id?: string;
}) => call<RemediationSnippet>({ op: 'generate', ...input });

export const markSnippetApplied = (id: string, applied_by?: string) =>
  call<RemediationSnippet>({ op: 'mark_applied', id, applied_by });

export const rejectSnippet = (id: string, reason?: string) =>
  call<RemediationSnippet>({ op: 'reject', id, reason });

export const supersedeSnippet = (id: string) =>
  call<RemediationSnippet>({ op: 'supersede', id });

export const PATTERN_LABELS: Record<RemediationPattern, string> = {
  csp_header_block: 'CSP-Header Tracker-Block',
  consent_wrapper: 'Consent-Wrapper für Script',
  font_self_host: 'Self-Host für Google Fonts',
  tracker_dom_remove: 'JS-DOM-Strip für Tracker',
  dsgvo_footer_block: 'DSGVO-konformer Footer-Block',
};

export const PATTERN_REQUIRED_PARAMS: Record<RemediationPattern, string[]> = {
  csp_header_block: ['blocked_host'],
  consent_wrapper: ['script_src'],
  font_self_host: [],
  tracker_dom_remove: ['tracker_host'],
  dsgvo_footer_block: ['company_name'],
};

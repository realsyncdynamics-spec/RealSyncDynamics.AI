// Client-Wrapper für RealSync SiteOS.
//
// Schreibpfade (Builder, Scan, Agenten) laufen über Edge Functions, weil dort
// Versionierung, Verkettung und Nachweis entstehen — RLS lässt clientseitige
// Inserts in die siteos_*-Tabellen bewusst nicht zu.
// Lesepfade gehen RLS-gesichert direkt an die Datenbank.

import { getSupabase } from '../../lib/supabase';
import type {
  AgentKey,
  RuntimeFinding,
  ScoreBreakdown,
  SiteBlueprint,
} from '../../../packages/siteos-core/src/index';

export interface SiteOverviewRow {
  slug: string;
  name: string;
  industry: string;
  blueprint_id: string;
  version: number;
  status: 'draft' | 'approved' | 'deployed' | 'archived';
  content_sha256: string;
  created_at: string;
  health: number | null;
  risk: number | null;
  compliance: number | null;
  performance: number | null;
  ai_risk: number | null;
  severity_max: string | null;
  last_scan_at: string | null;
}

export interface AgentRunRow {
  id: string;
  agent: AgentKey;
  status: 'queued' | 'awaiting_approval' | 'running' | 'completed' | 'failed' | 'cancelled';
  finding_codes: string[];
  severity_max: string | null;
  requires_approval: boolean;
  blueprint_id: string | null;
  scan_id: string | null;
  queued_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface ScanRow {
  id: string;
  url: string | null;
  scope: 'blueprint' | 'live' | 'combined';
  trigger: string;
  status: string;
  finding_count: number;
  severity_max: string | null;
  findings: RuntimeFinding[];
  observed_at: string;
}

export interface BuildEnrichment {
  name?: string;
  summary?: string;
  services?: string[];
  locality?: string | null;
}

export interface BuildResponse {
  ok: true;
  unchanged: boolean;
  blueprint_id?: string;
  slug: string;
  version: number;
  content_sha256: string;
  blueprint?: SiteBlueprint;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
  provenance_linked?: boolean;
}

export interface ScanResponse {
  ok: true;
  scan_id: string;
  blueprint_id: string | null;
  url: string;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
}

export interface PublicAiStudioScanResponse {
  ok: true;
  source_url: string;
  evidence_hash?: string;
  audit?: { scores?: Partial<ScoreBreakdown>; findings?: RuntimeFinding[] };
  scores?: Partial<ScoreBreakdown>;
  findings?: RuntimeFinding[];
  blueprint?: SiteBlueprint;
  pages?: unknown[];
  discovery?: {
    title?: string | null;
    description?: string | null;
    h1?: string | null;
    services?: string[];
    visible_text?: string;
  };
  variants?: unknown[];
}

export type SiteOsError =
  | { kind: 'forbidden' }
  | { kind: 'payment_required'; message: string }
  | { kind: 'bad_request'; message: string }
  | { kind: 'unreachable'; message: string }
  | { kind: 'error'; message: string };

export type SiteOsResult<T> =
  | { kind: 'ok'; data: T }
  | SiteOsError;

function mapError(error: unknown): SiteOsError {
  const status = (error as { context?: { status?: number } }).context?.status;
  const message = (error as { message?: string }).message ?? 'Netzwerkfehler';
  if (status === 403) return { kind: 'forbidden' };
  if (status === 402) return { kind: 'payment_required', message };
  if (status === 400) return { kind: 'bad_request', message };
  if (status === 502) return { kind: 'unreachable', message };
  return { kind: 'error', message };
}

export function errorMessage(e: SiteOsError): string {
  switch (e.kind) {
    case 'forbidden': return 'Kein Zugriff auf diesen Mandanten.';
    case 'payment_required': return 'SiteOS ist in diesem Tarif nicht enthalten.';
    case 'unreachable': return `Die Adresse war nicht erreichbar: ${e.message}`;
    default: return e.message;
  }
}

// ── Public AI Studio ─────────────────────────────────────────────────────
// Dieser Pfad ist absichtlich tenant- und login-frei. Er liefert nur Evidence,
// Audit und strukturierte Transformationsdaten; persistente SiteOS-Schreibpfade
// bleiben weiterhin hinter dem authentifizierten Builder.
export async function runPublicAiStudioScan(args: {
  url: string;
  locale?: string;
}): Promise<SiteOsResult<PublicAiStudioScanResponse>> {
  try {
    const response = await fetch('/api/v1/public/ai-studio/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: args.url, locale: args.locale ?? 'de' }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.message ?? data?.error ?? `Public AI Studio Scan fehlgeschlagen (${response.status}).`;
      if (response.status === 400) return { kind: 'bad_request', message };
      if (response.status === 502) return { kind: 'unreachable', message };
      return { kind: 'error', message };
    }
    if (!data?.ok || !data?.source_url) return { kind: 'error', message: 'Der öffentliche AI-Studio-Scan lieferte kein gültiges Ergebnis.' };
    return { kind: 'ok', data: data as PublicAiStudioScanResponse };
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : 'Public AI Studio Scan konnte nicht erreicht werden.' };
  }
}

// ── Schreibpfade ────────────────────────────────────────────────────────

export async function buildSite(args: {
  tenant_id: string;
  prompt: string;
  project_id?: string;
  locale?: string;
  enrichment?: BuildEnrichment;
}): Promise<SiteOsResult<BuildResponse>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos-builder', { body: args });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as BuildResponse };
}

export async function runScan(args: {
  tenant_id: string;
  url: string;
  blueprint_id?: string;
  trigger?: 'deploy' | 'cron' | 'manual' | 'agent';
}): Promise<SiteOsResult<ScanResponse>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos-runtime-scan', { body: args });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as ScanResponse };
}

export async function approveAgentRun(tenantId: string, runId: string): Promise<SiteOsResult<{ run_id: string }>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos-agents', {
    body: { op: 'approve', tenant_id: tenantId, run_id: runId },
  });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as { run_id: string } };
}

export async function runAgent(tenantId: string, runId?: string): Promise<SiteOsResult<{ ran: boolean; applied?: string[] }>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos-agents', {
    body: { op: 'run', tenant_id: tenantId, ...(runId ? { run_id: runId } : {}) },
  });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as { ran: boolean; applied?: string[] } };
}

// ── Lesepfade (RLS-gesichert) ───────────────────────────────────────────

export async function listSites(tenantId: string): Promise<SiteOverviewRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('siteos_site_overview', { p_tenant_id: tenantId });
  if (error) throw new Error(error.message);
  return (data ?? []) as SiteOverviewRow[];
}

export async function listAgentRuns(tenantId: string): Promise<AgentRunRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('siteos_agent_runs')
    .select('id, agent, status, finding_codes, severity_max, requires_approval, blueprint_id, scan_id, queued_at, completed_at, error_message')
    .eq('tenant_id', tenantId)
    .order('queued_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as AgentRunRow[];
}

export async function listScans(tenantId: string, limit = 20): Promise<ScanRow[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('siteos_scans')
    .select('id, url, scope, trigger, status, finding_count, severity_max, findings, observed_at')
    .eq('tenant_id', tenantId)
    .order('observed_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScanRow[];
}

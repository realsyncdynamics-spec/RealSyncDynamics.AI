// Client-Wrapper für RealSync SiteOS.
//
// Schreibpfade (Builder, Scan, Agenten) laufen über Edge Functions, weil dort
// Versionierung, Verkettung und Nachweis entstehen — RLS lässt clientseitige
// Inserts in die siteos_*-Tabellen bewusst nicht zu.
// Lesepfade gehen RLS-gesichert direkt an die Datenbank.

import { getSupabase } from '../../lib/supabase';
import type {
  AgentKey,
  PublishGateEvaluation,
  RefinementChange,
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

export type SiteOsError =
  | { kind: 'forbidden' }
  | { kind: 'payment_required'; message: string }
  | { kind: 'bad_request'; message: string }
  | { kind: 'unreachable'; message: string }
  /**
   * Der Router läuft, der angefragte Pfad ist dort aber nicht registriert —
   * der Deploy hinkt dem Repo hinterher. Eigener Fall, weil er etwas völlig
   * anderes bedeutet als „nicht gefunden": Nicht die Sache fehlt, sondern
   * die Funktion, die sie liefern würde. Als generischer Fehler angezeigt,
   * sucht der Nutzer den Fehler bei sich.
   */
  | { kind: 'not_deployed'; message: string }
  | { kind: 'not_found'; message: string }
  | { kind: 'error'; message: string };

export type SiteOsResult<T> = { kind: 'ok'; data: T } | SiteOsError;

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
    case 'not_deployed': return 'Diese Funktion ist noch nicht ausgerollt.';
    case 'not_found': return e.message;
    default: return e.message;
  }
}

/**
 * Wie `mapError`, unterscheidet aber 404-Fälle anhand des Fehlercodes im
 * Body. Nur für neue Pfade verwendet — die bestehenden bleiben unverändert,
 * damit sich ihr Verhalten nicht nebenbei ändert.
 */
async function mapErrorDetailed(error: unknown): Promise<SiteOsError> {
  const context = (error as { context?: Response }).context;
  if (context?.status !== 404) return mapError(error);

  let code: string | null = null;
  try {
    const body = await context.clone().json() as { error?: { code?: string; message?: string } };
    code = body?.error?.code ?? null;
  } catch {
    // Kein lesbarer Body — dann bleibt es beim unspezifischen Fall.
  }

  return code === 'UNKNOWN_ENDPOINT'
    ? { kind: 'not_deployed', message: 'Der Endpunkt ist im Router nicht registriert.' }
    : { kind: 'not_found', message: 'Der angefragte Gegenstand wurde nicht gefunden.' };
}

// ── Schreibpfade ────────────────────────────────────────────────────────

export async function buildSite(args: {
  tenant_id: string;
  prompt: string;
  project_id?: string;
  locale?: string;
  enrichment?: BuildEnrichment;
  /**
   * Anweisungsfolge aus der anonymen Vorschau. Wird serverseitig nachgespielt
   * (siehe `supabase/functions/siteos/handlers/builder.ts`) — der Blueprint
   * selbst wandert nie vom Browser in die Datenbank.
   */
  refinements?: string[];
}): Promise<SiteOsResult<BuildResponse>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/builder', { body: args });
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
  const { data, error } = await sb.functions.invoke('siteos/runtime-scan', { body: args });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as ScanResponse };
}

export async function approveAgentRun(tenantId: string, runId: string): Promise<SiteOsResult<{ run_id: string }>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/agents', {
    body: { op: 'approve', tenant_id: tenantId, run_id: runId },
  });
  if (error) return mapError(error);
  return { kind: 'ok', data: data as { run_id: string } };
}

export async function runAgent(tenantId: string, runId?: string): Promise<SiteOsResult<{ ran: boolean; applied?: string[] }>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/agents', {
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
    .from('siteos_runtime_scans')
    .select('id, url, scope, trigger, status, finding_count, severity_max, findings, observed_at')
    .eq('tenant_id', tenantId)
    .order('observed_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScanRow[];
}

/** Nachweiskette einer Site: alle Versionen mit Hash und Vorgänger-Hash. */
export async function listBlueprintChain(tenantId: string, slug: string): Promise<{
  id: string; version: number; content_sha256: string; prev_hash: string | null;
  status: string; origin_model: string | null; created_at: string;
}[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('siteos_blueprints')
    .select('id, version, content_sha256, prev_hash, status, origin_model, created_at')
    .eq('tenant_id', tenantId).eq('slug', slug)
    .order('version', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Publish Gate (Zielarchitektur §7) ───────────────────────────────────
//
// G2: Diese Wrapper reichen das Ergebnis unverändert durch. Es wird nichts
// nachgerechnet — `publishable` kommt vom Server oder gar nicht.

/**
 * Zustand des Backends für die Bewertung.
 *
 * `greenfield` ist nur dort zulässig, wo es beweisbar keine Vorgängerseite
 * gibt — etwa bei einer aus einem Prompt gebauten Site. Bei einer
 * Transformation gehört der tatsächlich durchgeführte Vergleich hierher;
 * fehlt er, sperrt der Server (`unknown`).
 */
export type PublishBackendInput =
  | { kind: 'greenfield' }
  | {
      kind: 'transformation';
      comparison: {
        lostFormTargets: string[];
        lostPaymentPaths: string[];
        lostBookingPaths: string[];
        lostApiEndpoints: string[];
        lostConsentCategories: string[];
      } | null;
    };

export async function evaluatePublish(args: {
  tenant_id: string;
  blueprint_id: string;
  backend: PublishBackendInput;
  base_url?: string;
}): Promise<SiteOsResult<{ ok: true; evaluation: PublishGateEvaluation }>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/publish-gate', { body: args });
  if (error) return await mapErrorDetailed(error);
  return { kind: 'ok', data: data as { ok: true; evaluation: PublishGateEvaluation } };
}

export async function approvePublish(args: {
  tenant_id: string;
  evaluation_id: string;
  reason: string;
  backend: PublishBackendInput;
  base_url?: string;
}): Promise<SiteOsResult<{ ok: true; approved_evaluation_id: string; evaluation: PublishGateEvaluation }>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/publish-approve', { body: args });
  if (error) return await mapErrorDetailed(error);
  return { kind: 'ok', data: data as { ok: true; approved_evaluation_id: string; evaluation: PublishGateEvaluation } };
}

// ── Anonymer Build (Zielarchitektur: Idee → Vorschau → Konto → Claim) ───
//
// Bauen und Verfeinern laufen serverseitig, ohne Konto. Der Blueprint liegt
// damit von Anfang an beim Server — Voraussetzung dafür, dass der Claim ihn
// **verschieben** kann, statt ihn nachzubauen.

export interface AnonBuildResponse {
  ok: true;
  session_id: string;
  expires_at: string;
  version: number;
  slug: string;
  content_sha256: string;
  blueprint: SiteBlueprint;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
}

export interface AnonRefineResponse {
  ok: true;
  unchanged: boolean;
  session_id: string;
  version: number;
  content_sha256?: string;
  blueprint: SiteBlueprint;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
  changes: RefinementChange[];
  refusals: string[];
  understood: boolean;
}

export interface ClaimResponse {
  ok: true;
  already_claimed: boolean;
  blueprint_id: string | null;
  slug: string;
  version: number;
  content_sha256: string;
  provenance_linked?: boolean;
}

export async function buildAnon(args: {
  prompt: string;
  locale?: string;
  enrichment?: BuildEnrichment;
}): Promise<SiteOsResult<AnonBuildResponse>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/build-anon', { body: args });
  if (error) return await mapErrorDetailed(error);
  return { kind: 'ok', data: data as AnonBuildResponse };
}

export async function refineAnon(args: {
  session_id: string;
  instruction: string;
}): Promise<SiteOsResult<AnonRefineResponse>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/refine-anon', { body: args });
  if (error) return await mapErrorDetailed(error);
  return { kind: 'ok', data: data as AnonRefineResponse };
}

/**
 * Übernimmt die Sitzung in einen Mandanten.
 *
 * Idempotent: Ein zweiter Aufruf liefert dieselbe `blueprint_id`, erkennbar
 * an `already_claimed`. Der Aufrufer muss das nicht abfangen — er darf es
 * aber anzeigen.
 */
export async function claimAnonBuild(args: {
  tenant_id: string;
  session_id: string;
}): Promise<SiteOsResult<ClaimResponse>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/claim', { body: args });
  if (error) return await mapErrorDetailed(error);
  return { kind: 'ok', data: data as ClaimResponse };
}

export interface AnonSessionResponse {
  ok: true;
  session_id: string;
  version: number;
  slug: string;
  content_sha256: string;
  blueprint: SiteBlueprint;
  findings: RuntimeFinding[];
  scores: ScoreBreakdown;
  expires_at: string;
  claimed: boolean;
  claimed_blueprint_id: string | null;
}

/**
 * Liest den aktuellen Stand einer anonymen Sitzung.
 *
 * Der Neuladen-Fall geht über diesen Weg und nicht über einen lokalen
 * Zwischenspeicher: Was die Vorschau zeigt, muss dasselbe sein, was der
 * Claim überträgt.
 */
export async function getAnonSession(args: { session_id: string }): Promise<SiteOsResult<AnonSessionResponse>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke('siteos/session', { body: args });
  if (error) return await mapErrorDetailed(error);
  return { kind: 'ok', data: data as AnonSessionResponse };
}

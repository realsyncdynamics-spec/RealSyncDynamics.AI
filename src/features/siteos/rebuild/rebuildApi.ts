// Client für den Rebuild-Workflow (`siteos/rebuild-*`, `siteos/publish-export`).
//
// Der Browser schickt Absichten, keine Ergebnisse: eine Adresse, eine
// gewählte Richtung, Regeln oder eine Anweisung, eine Begründung. Mandant,
// Rolle, Snapshot, Vergleich und Verbindungsstand stellt der Server fest.
// `tenant_id` geht mit, damit der Server die Mitgliedschaft prüfen kann —
// Autorität ist sie nicht.
//
// Fehler kommen mit dem deutschen Klartext des Servers zurück (nicht mit
// „Edge Function returned a non-2xx status code").

import { getSupabase } from '../../../lib/supabase';
import type {
  Assessment,
  BackendReport,
  BackendWaiver,
  DirectionBuild,
  NextStep,
  Positioning,
  PublishChecklist,
  RefinementChange,
  RevisionIntentKey,
  RuntimeFinding,
  ScoreBreakdown,
  SiteBlueprint,
  SourceSnapshot,
} from '../../../../packages/siteos-core/src/index';

export type RebuildResult<T> = { kind: 'ok'; data: T } | { kind: 'error'; status: number | null; code: string | null; message: string };

async function invoke<T>(path: string, body: Record<string, unknown>): Promise<RebuildResult<T>> {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke(path, { body });
  if (!error) return { kind: 'ok', data: data as T };
  const context = (error as { context?: Response }).context;
  const status = context?.status ?? null;
  let code: string | null = null;
  let message = '';
  try {
    const parsed = await context?.clone().json() as { error?: { code?: string; message?: string } } | undefined;
    code = parsed?.error?.code ?? null;
    message = parsed?.error?.message ?? '';
  } catch {
    // Kein lesbarer Body.
  }
  if (!message) {
    message = status === 403
      ? 'Keine Berechtigung für diese Aktion in diesem Workspace.'
      : status === 404 && code === 'UNKNOWN_ENDPOINT'
        ? 'Dieser Schritt ist noch nicht ausgerollt.'
        : (error as { message?: string }).message ?? 'Netzwerkfehler';
  }
  return { kind: 'error', status, code, message };
}

// ── DISCOVER / ASSESS / REBUILD ─────────────────────────────────────────

export interface AnalyzeResponse {
  ok: true;
  run: { id: string; engine_version: string; derived_at: string; snapshot_sha256: string; evidence_id: string; evidence_hash: string };
  snapshot: SourceSnapshot;
  positioning: Positioning;
  assessment: Assessment;
  directions: (Pick<DirectionBuild, 'plan' | 'report' | 'blueprint'> & { blueprint_sha256: string })[];
}

export function analyzeWebsite(args: { tenant_id: string; url: string }): Promise<RebuildResult<AnalyzeResponse>> {
  return invoke('siteos/rebuild-analyze', args);
}

export interface SelectResponse {
  ok: true;
  slug: string;
  version: number;
  blueprint_id: string | null;
  unchanged: boolean;
  content_sha256: string;
}

export function selectDirection(args: { tenant_id: string; run_id: string; direction: string }): Promise<RebuildResult<SelectResponse>> {
  return invoke('siteos/rebuild-select', args);
}

/** Gespeicherter Lauf (RLS: nur Mitglieder des Mandanten lesen). */
export interface StoredRun {
  id: string;
  tenant_id: string;
  source_url: string;
  resolved_url: string;
  host: string;
  status: 'analyzed' | 'selected';
  engine_version: string;
  snapshot: SourceSnapshot;
  snapshot_sha256: string;
  positioning: Positioning;
  assessment: Assessment;
  directions: { derivedAt: string; items: { plan: DirectionBuild['plan']; report: DirectionBuild['report']; blueprint_sha256: string }[] };
  evidence_id: string | null;
  selected_direction: string | null;
  site_slug: string | null;
  created_at: string;
}

export async function loadRun(tenantId: string, runId: string): Promise<StoredRun | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('siteos_rebuild_runs')
    .select('id, tenant_id, source_url, resolved_url, host, status, engine_version, snapshot, snapshot_sha256, positioning, assessment, directions, evidence_id, selected_direction, site_slug, created_at')
    .eq('tenant_id', tenantId).eq('id', runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StoredRun | null) ?? null;
}

// ── REFINE ──────────────────────────────────────────────────────────────

export interface RefineResponse {
  ok: true;
  understood: boolean;
  unchanged?: boolean;
  /** Zeile der neuen (oder unveränderten jüngsten) Version. */
  blueprint_id?: string;
  version?: number;
  content_sha256?: string;
  blueprint?: SiteBlueprint;
  intents?: RevisionIntentKey[];
  changes: RefinementChange[];
  notes: string[];
  refusals: string[];
  findings?: RuntimeFinding[];
  scores?: ScoreBreakdown;
}

export function refineRebuild(args: { tenant_id: string; slug: string; base_sha256: string; intents?: RevisionIntentKey[]; instruction?: string }): Promise<RebuildResult<RefineResponse>> {
  return invoke('siteos/rebuild-refine', args);
}

// ── PUBLISH / AUTOMATE / GOVERN ─────────────────────────────────────────

export interface StatusResponse {
  ok: true;
  blueprint_id: string;
  version: number;
  content_sha256: string;
  origin_source: string;
  /** Lauf, an den die Site gebunden ist (`origin.rebuild`) — vom Server festgestellt. */
  run_id: string | null;
  source_host: string | null;
  /** Warum es keinen Vergleich gibt (übernommene Site ohne prüfbare Bindung) — sonst `null`. */
  binding_problem: string | null;
  base_url: string | null;
  artifact: { sha256: string; total_bytes: number; files: { path: string; bytes: number; sha256: string }[] };
  backend: BackendReport | null;
  checklist: PublishChecklist;
  next_steps: NextStep[];
  evaluation: {
    id: string; status: string; publishable: boolean; blockers: string[]; warnings: string[];
    artifact_sha256: string; human_approval_required: boolean; evaluated_at: string; approved_by: string | null; current: boolean;
  } | null;
}

export function rebuildStatus(args: { tenant_id: string; slug: string; base_url?: string }): Promise<RebuildResult<StatusResponse>> {
  return invoke('siteos/rebuild-status', args);
}

export function waiveBackend(args: { tenant_id: string; run_id: string; key: string; reason?: string; revoke?: boolean }): Promise<RebuildResult<{ ok: true; waivers: BackendWaiver[]; backend: BackendReport }>> {
  return invoke('siteos/rebuild-waive', args);
}

export interface ExportResponse {
  ok: true;
  manifest: {
    format: string; slug: string; version: number; blueprint_sha256: string; artifact_sha256: string;
    evaluation_id: string; evidence_id: string; base_url: string | null; go_by: string; go_at: string;
    files: { path: string; sha256: string; bytes: number }[];
  };
  files: { path: string; content: string; sha256: string; bytes: number }[];
}

export function exportPublish(args: { tenant_id: string; blueprint_id: string; base_url?: string; confirm_go: true; confirm_preview: true }): Promise<RebuildResult<ExportResponse>> {
  return invoke('siteos/publish-export', args);
}

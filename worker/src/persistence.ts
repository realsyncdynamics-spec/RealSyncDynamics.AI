/**
 * Persistenz-Layer des Audit-Workers.
 *
 * Schreibt das Ergebnis eines Crawls in die kanonischen Tabellen:
 *   - public.scan_runs      (Lifecycle + denormalisierte Roll-ups)
 *   - public.findings       (ein Row pro Rule-Engine-Treffer)
 *   - public.audit_evidence (Screenshot-Referenz, append-only)
 *
 * Spiegelt bewusst die Deno-Edge-Adapter `_shared/scan-pipeline.ts` +
 * `_shared/findings.ts`, kann sie aber nicht direkt importieren: die nutzen
 * `.ts`-Specifier (Deno), der Worker läuft unter Node/CommonJS. Die reine
 * Mapping-/Severity-Logik liegt in ./mapping.ts und ist dort unit-getestet.
 *
 * Alle Writes laufen über den Service-Role-Client → RLS-Bypass ist gewollt
 * (Worker ist Backend), die Tabellen erlauben Mutation ohnehin nur service_role.
 */
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mapRuleFindingToRow,
  maxSeverity,
  type RuleFindingLike,
  type DbSeverity,
} from './mapping';

export interface StartedScanRun {
  scan_run_id: string;
  correlation_id: string;
}

/**
 * Legt einen scan_runs-Eintrag im Status 'running' an. Gibt scan_run_id +
 * correlation_id zurück, mit denen Findings und Evidence verknüpft werden.
 */
export async function startScanRun(
  supabase: SupabaseClient,
  input: { tenant_id: string; website_id?: string | null; detector: string; raw_payload?: Record<string, unknown> | null },
): Promise<StartedScanRun> {
  const scan_run_id = randomUUID();
  const correlation_id = randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase.from('scan_runs').insert({
    id: scan_run_id,
    tenant_id: input.tenant_id,
    website_id: input.website_id ?? null,
    detector: input.detector,
    status: 'running',
    started_at: now,
    raw_payload: input.raw_payload ?? null,
    correlation_id,
  });
  if (error) throw new Error(`scan_runs insert failed: ${error.message}`);

  return { scan_run_id, correlation_id };
}

/**
 * Schreibt alle Findings eines Crawls als Bulk-Insert. Gibt die Anzahl
 * geschriebener Rows + die höchste Severity zurück (für completeScanRun).
 */
export async function recordFindings(
  supabase: SupabaseClient,
  findings: RuleFindingLike[],
  ctx: { tenant_id: string; scan_run_id: string; correlation_id: string; website_id?: string | null; detector: string; evidence_ref?: string | null },
): Promise<{ count: number; severity_max: DbSeverity | null }> {
  if (findings.length === 0) {
    return { count: 0, severity_max: null };
  }

  const rows = findings.map((f) => mapRuleFindingToRow(f, ctx));
  const { error } = await supabase.from('findings').insert(rows);
  if (error) throw new Error(`findings insert failed: ${error.message}`);

  return { count: rows.length, severity_max: maxSeverity(findings.map((f) => f.severity)) };
}

/**
 * Schreibt eine Screenshot-Evidence-Referenz. Fehler hier sind nicht fatal
 * für den Audit (Findings stehen bereits) — wird geloggt und geschluckt.
 */
export async function recordScreenshotEvidence(
  supabase: SupabaseClient,
  input: { tenant_id: string; audit_id: string; storage_path: string; size_bytes?: number },
): Promise<void> {
  const { error } = await supabase.from('audit_evidence').insert({
    audit_id: input.audit_id,
    tenant_id: input.tenant_id,
    type: 'screenshot',
    storage_bucket: 'audit-evidence',
    storage_path: input.storage_path,
    size_bytes: input.size_bytes ?? null,
    mime_type: 'image/png',
  });
  if (error) {
    console.error('[worker] audit_evidence insert failed (non-fatal):', error.message);
  }
}

/**
 * Schließt einen scan_run terminal ab (completed) und schreibt die
 * denormalisierten Roll-ups. duration_ms aus started_at-Differenz.
 */
export async function completeScanRun(
  supabase: SupabaseClient,
  scanRunId: string,
  args: { finding_count: number; severity_max: DbSeverity | null; started_at: number },
): Promise<void> {
  const completedAt = new Date();
  const { error } = await supabase.from('scan_runs')
    .update({
      status: 'completed',
      completed_at: completedAt.toISOString(),
      duration_ms: Math.max(0, completedAt.getTime() - args.started_at),
      finding_count: args.finding_count,
      severity_max: args.severity_max,
    })
    .eq('id', scanRunId);
  if (error) throw new Error(`scan_runs complete failed: ${error.message}`);
}

/**
 * Markiert einen scan_run als failed. error_code ist Pflicht (DB-CHECK).
 */
export async function failScanRun(
  supabase: SupabaseClient,
  scanRunId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase.from('scan_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_code: errorCode,
      error_message: errorMessage.slice(0, 2000),
    })
    .eq('id', scanRunId);
  if (error) {
    // failScanRun läuft selbst im catch-Pfad — nur loggen, nicht erneut werfen.
    console.error('[worker] scan_runs fail-update failed:', error.message);
  }
}

// Monitoring-SLO Runner — Persistenz-Schicht für die Edge-Function.
//
// Lädt die aktiven monitoring_sources eines Tenants, bewertet das SLO über den
// reinen evaluateMonitoringSlos() und schreibt Verletzungen idempotent ins
// Agent-OS-Substrat (agent_observations + agent_events). Schwere Verletzungen
// werden zusätzlich als governance_alerts sichtbar (View /app/alerts).
//
// Idempotenz wie beim Deadline-Sentinel: ein (source, stage)-Fund erzeugt
// höchstens eine Observation pro Dedup-Fenster; ein Alert wird nur erzeugt,
// solange kein offener Alert mit demselben slo_key existiert.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { evaluateMonitoringSlos, isSloAlertWorthy, type SloFinding } from './monitoringSlo.ts';

const AGENT = 'monitoring-slo';
const DEDUP_WINDOW_HOURS = 23;

export interface MonitoringSloTenantResult {
  monitoring_slos_evaluated: number;
  monitoring_slos_breached: number;
  errors: string[];
}

export async function runMonitoringSloForTenant(
  admin: SupabaseClient,
  tenantId: string,
  now: Date,
): Promise<MonitoringSloTenantResult> {
  const errors: string[] = [];

  // 1. Quellen unter SLO laden (aktiv oder im Fehlerzustand).
  const srcRes = await admin
    .from('monitoring_sources')
    .select('id,name,status,next_scan_at,scan_frequency,last_error')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'error'])
    .limit(2000);
  if (srcRes.error) {
    return { monitoring_slos_evaluated: 0, monitoring_slos_breached: 0, errors: [`sources: ${srcRes.error.message}`] };
  }

  const { evaluated, findings } = evaluateMonitoringSlos({ sources: srcRes.data ?? [], now });
  if (findings.length === 0) {
    return { monitoring_slos_evaluated: evaluated, monitoring_slos_breached: 0, errors };
  }

  // 2. Bereits geflaggte Funde ermitteln (Dedup).
  const sinceIso = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 3_600_000).toISOString();
  const seenObsKeys = new Set<string>();
  const openAlertKeys = new Set<string>();

  const obsRes = await admin.from('agent_observations')
    .select('data')
    .eq('tenant_id', tenantId)
    .eq('agent', AGENT)
    .gte('created_at', sinceIso)
    .limit(2000);
  if (obsRes.error) errors.push(`obs_dedup: ${obsRes.error.message}`);
  for (const row of obsRes.data ?? []) {
    const key = (row as { data?: { dedupe_key?: string } }).data?.dedupe_key;
    if (key) seenObsKeys.add(key);
  }

  const alertRes = await admin.from('governance_alerts')
    .select('metadata')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .limit(2000);
  if (alertRes.error) errors.push(`alert_dedup: ${alertRes.error.message}`);
  for (const row of alertRes.data ?? []) {
    const key = (row as { metadata?: { slo_key?: string } }).metadata?.slo_key;
    if (key) openAlertKeys.add(key);
  }

  // 3. Neue Funde persistieren.
  let breached = 0;
  for (const f of findings) {
    if (seenObsKeys.has(f.dedupeKey)) continue;
    try {
      const obsId = await persistObservation(admin, tenantId, f);
      breached += 1;
      seenObsKeys.add(f.dedupeKey);
      if (obsId) await persistEvent(admin, tenantId, obsId, f);
      if (isSloAlertWorthy(f.severity) && !openAlertKeys.has(f.dedupeKey)) {
        await persistAlert(admin, tenantId, f);
        openAlertKeys.add(f.dedupeKey);
      }
    } catch (e) {
      errors.push(`persist ${f.dedupeKey}: ${(e as Error)?.message ?? String(e)}`);
    }
  }

  return { monitoring_slos_evaluated: evaluated, monitoring_slos_breached: breached, errors };
}

async function persistObservation(admin: SupabaseClient, tenantId: string, f: SloFinding): Promise<string | null> {
  const { data, error } = await admin.from('agent_observations').insert({
    tenant_id: tenantId,
    agent: AGENT,
    category: 'health',
    severity: f.severity,
    title: f.title,
    detail: f.detail,
    data: { source_id: f.sourceId, stage: f.stage, dedupe_key: f.dedupeKey },
  }).select('id').single();
  if (error) throw new Error(error.message);
  return (data as { id?: string } | null)?.id ?? null;
}

async function persistEvent(admin: SupabaseClient, tenantId: string, obsId: string, f: SloFinding): Promise<void> {
  const { error } = await admin.from('agent_events').insert({
    tenant_id: tenantId,
    event_type: 'observation.created',
    subject_type: 'observation',
    subject_id: obsId,
    agent: AGENT,
    payload: { dedupe_key: f.dedupeKey, stage: f.stage, severity: f.severity, source_id: f.sourceId },
  });
  if (error) throw new Error(error.message);
}

async function persistAlert(admin: SupabaseClient, tenantId: string, f: SloFinding): Promise<void> {
  const { error } = await admin.from('governance_alerts').insert({
    tenant_id: tenantId,
    severity: f.severity,
    category: 'scan',
    title: f.title,
    message: f.detail,
    status: 'open',
    metadata: { slo_key: f.dedupeKey, source: AGENT, source_id: f.sourceId, stage: f.stage },
  });
  if (error) throw new Error(error.message);
}

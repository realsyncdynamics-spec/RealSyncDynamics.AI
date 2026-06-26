// Deadline-Sentinel Runner — Persistenz-Schicht für die Edge-Function.
//
// Lädt offene Pflichten eines Tenants, bewertet sie über den reinen
// evaluateDeadlines() und schreibt neue Funde idempotent ins Agent-OS-
// Substrat (agent_observations + agent_events). Schwerwiegende Funde werden
// zusätzlich als governance_alerts sichtbar gemacht (View /app/alerts).
//
// Idempotenz: ein (subject, stage)-Fund erzeugt höchstens eine Observation
// pro Dedup-Fenster; ein Alert wird nur erzeugt, solange kein offener Alert
// mit demselben sentinel_key existiert.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { evaluateDeadlines, isAlertWorthy, type SentinelFinding } from './deadlineSentinel.ts';

const AGENT = 'deadline-sentinel';
const DEDUP_WINDOW_HOURS = 23; // < tägliche Kadenz → max. ein Trail-Eintrag/Tag

export interface SentinelTenantResult {
  decision_overdue_flagged: number;
  alerts_created: number;
  errors: string[];
}

export async function runDeadlineSentinelForTenant(
  admin: SupabaseClient,
  tenantId: string,
  now: Date,
): Promise<SentinelTenantResult> {
  const errors: string[] = [];

  // 1. Offene Pflichten laden (minimale Spalten).
  const [incRes, dpiaRes, dsrRes] = await Promise.all([
    admin.from('incidents')
      .select('id,title,severity,status,notification_deadline_at')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("resolved","reported_to_authority")'),
    admin.from('dpias')
      .select('id,title,status,review_due_at')
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'in_review']),
    admin.from('dsr_requests')
      .select('id,request_type,status,deadline_at,completed_at')
      .eq('tenant_id', tenantId)
      .is('completed_at', null),
  ]);
  if (incRes.error) errors.push(`incidents: ${incRes.error.message}`);
  if (dpiaRes.error) errors.push(`dpias: ${dpiaRes.error.message}`);
  if (dsrRes.error) errors.push(`dsr: ${dsrRes.error.message}`);

  const findings = evaluateDeadlines({
    incidents: incRes.data ?? [],
    dpias: dpiaRes.data ?? [],
    dsrs: dsrRes.data ?? [],
    now,
  });
  if (findings.length === 0) return { decision_overdue_flagged: 0, alerts_created: 0, errors };

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
    const key = (row as { metadata?: { sentinel_key?: string } }).metadata?.sentinel_key;
    if (key) openAlertKeys.add(key);
  }

  // 3. Neue Funde persistieren.
  let flagged = 0;
  let alertsCreated = 0;
  for (const f of findings) {
    if (seenObsKeys.has(f.dedupeKey)) continue;
    try {
      const obsId = await persistObservation(admin, tenantId, f);
      flagged += 1;
      seenObsKeys.add(f.dedupeKey);
      if (obsId) await persistEvent(admin, tenantId, obsId, f);
      if (isAlertWorthy(f.severity) && !openAlertKeys.has(f.dedupeKey)) {
        await persistAlert(admin, tenantId, f);
        openAlertKeys.add(f.dedupeKey);
        alertsCreated += 1;
      }
    } catch (e) {
      errors.push(`persist ${f.dedupeKey}: ${(e as Error)?.message ?? String(e)}`);
    }
  }

  return { decision_overdue_flagged: flagged, alerts_created: alertsCreated, errors };
}

async function persistObservation(admin: SupabaseClient, tenantId: string, f: SentinelFinding): Promise<string | null> {
  const { data, error } = await admin.from('agent_observations').insert({
    tenant_id: tenantId,
    agent: AGENT,
    category: 'compliance',
    severity: f.severity,
    title: f.title,
    detail: f.detail,
    data: {
      subject_type: f.subjectType,
      subject_id: f.subjectId,
      stage: f.stage,
      dedupe_key: f.dedupeKey,
      deadline: f.deadline,
      hours_remaining: f.hoursRemaining,
    },
  }).select('id').single();
  if (error) throw new Error(error.message);
  return (data as { id?: string } | null)?.id ?? null;
}

async function persistEvent(admin: SupabaseClient, tenantId: string, obsId: string, f: SentinelFinding): Promise<void> {
  const { error } = await admin.from('agent_events').insert({
    tenant_id: tenantId,
    event_type: 'observation.created',
    subject_type: 'observation',
    subject_id: obsId,
    agent: AGENT,
    payload: { dedupe_key: f.dedupeKey, stage: f.stage, severity: f.severity, subject_type: f.subjectType, subject_id: f.subjectId },
  });
  if (error) throw new Error(error.message);
}

async function persistAlert(admin: SupabaseClient, tenantId: string, f: SentinelFinding): Promise<void> {
  const { error } = await admin.from('governance_alerts').insert({
    tenant_id: tenantId,
    severity: f.severity,
    category: 'compliance',
    title: f.title,
    message: f.detail,
    status: 'open',
    risk_id: f.subjectType === 'incident' ? f.subjectId : null,
    metadata: { sentinel_key: f.dedupeKey, source: AGENT, subject_type: f.subjectType, subject_id: f.subjectId, stage: f.stage },
  });
  if (error) throw new Error(error.message);
}

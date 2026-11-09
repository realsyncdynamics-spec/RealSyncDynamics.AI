/**
 * Governance Compliance Score Calculator (Cron Job, stündlich)
 *
 * Berechnet je Tenant eine Selbsteinschätzung über ISO 27001, ISO 42001,
 * EU AI Act, DSGVO und NIS2 aus den im Mandanten erfassten Daten und
 * schreibt sie als Systembericht nach `audit_reports`.
 *
 * - Keine Ersatzwerte: Rahmenwerke ohne Daten bleiben ohne Wert, Tenants
 *   ganz ohne Daten bekommen keinen Bericht (siehe ./scoring.ts).
 * - Idempotent: höchstens ein Systembericht pro Tenant und UTC-Tag
 *   (`report_scope = SYSTEM_SCOPE`); weitere Läufe am selben Tag
 *   aktualisieren ihn.
 * - Systemberichte haben `created_by = null` (kein menschlicher Autor;
 *   Migration 20261109060000).
 *
 * 2026-11-09: Neu geschrieben. Die alte Fassung filterte auf die nicht
 * existierende Spalte `tenants.is_active`, las `data_processing_records`
 * (gibt es nicht), schrieb sechs nicht existierende Spalten und setzte
 * bei fehlenden Daten feste Werte (AI Act 50, NIS2 100) ein.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireCronKey } from '../_shared/cronKey.ts';
import {
  calculateScores,
  coveredFrameworks,
  describeScores,
  type TenantScoreInput,
} from './scoring.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const SYSTEM_SCOPE = 'system:governance-score-daily';

Deno.serve(async (req: Request) => {
  // Cron-Endpunkt: rechnet die Compliance-Scores ALLER Tenants neu. Die
  // Praefix-Pruefung liess jeden Aufrufer durch, der das Plattform-Gate
  // passiert hatte — also jeden eingeloggten Nutzer (Befund F-04,
  // AUDIT/18_FINDINGS.md). Jetzt nur noch der Cron-Aufrufer selbst:
  // dedizierter Cron-Key statt service_role-Bearer (seit 2026-11-01,
  // verify_jwt = false; pg_cron sendet Vault `cron_governance_score_key`).
  const denied = await requireCronKey(req, 'CRON_GOVERNANCE_SCORE_KEY', 'cron_governance_score_key');
  if (denied) return denied;

  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id');

  if (tenantsError || !tenants) {
    console.error('governance-score-calculator: tenants', tenantsError?.message);
    return json({ error: 'tenants_unavailable' }, 500);
  }

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  let written = 0;
  let skippedNoData = 0;
  const failed: string[] = [];

  for (const tenant of tenants) {
    try {
      const input = await loadTenantInput(tenant.id);
      const scores = calculateScores(input);
      if (scores.overall === null) {
        skippedNoData++;
        continue;
      }

      const row = {
        tenant_id: tenant.id,
        title: `Governance-Score (automatisch) ${dayStart.toISOString().slice(0, 10)}`,
        description: describeScores(scores),
        audit_date: new Date().toISOString(),
        status: 'completed',
        created_by: null,
        frameworks_covered: coveredFrameworks(scores),
        compliance_score: scores.overall,
        report_scope: SYSTEM_SCOPE,
        updated_at: new Date().toISOString(),
      };

      const { data: existing, error: findError } = await supabase
        .from('audit_reports')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('report_scope', SYSTEM_SCOPE)
        .is('created_by', null)
        .gte('audit_date', dayStart.toISOString())
        .order('audit_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (findError) throw new Error(`find: ${findError.message}`);

      const { error: writeError } = existing
        ? await supabase.from('audit_reports').update(row).eq('id', existing.id)
        : await supabase.from('audit_reports').insert(row);
      if (writeError) throw new Error(`write: ${writeError.message}`);

      written++;
    } catch (err) {
      console.error(`governance-score-calculator: tenant ${tenant.id}`, String(err));
      failed.push(tenant.id);
    }
  }

  const summary = {
    success: failed.length === 0,
    tenants: tenants.length,
    reportsWritten: written,
    skippedNoData,
    failed: failed.length,
    timestamp: new Date().toISOString(),
  };
  console.log('governance-score-calculator', JSON.stringify(summary));
  return json(summary, failed.length === 0 ? 200 : 500);
});

async function loadTenantInput(tenantId: string): Promise<TenantScoreInput> {
  const [iso27001, iso42001, aiAct, dpias, nis2] = await Promise.all([
    supabase.from('iso27001_implementations').select('status').eq('tenant_id', tenantId),
    supabase.from('iso42001_implementations').select('status').eq('tenant_id', tenantId),
    supabase.from('ai_act_assessments').select('approval_status').eq('tenant_id', tenantId),
    supabase.from('dpias').select('status').eq('tenant_id', tenantId),
    supabase.from('nis2_incident_deadlines').select('is_compliant_with_deadline, compliance_checked_at').eq('tenant_id', tenantId),
  ]);

  for (const [name, res] of [
    ['iso27001_implementations', iso27001],
    ['iso42001_implementations', iso42001],
    ['ai_act_assessments', aiAct],
    ['dpias', dpias],
    ['nis2_incident_deadlines', nis2],
  ] as const) {
    if (res.error) throw new Error(`${name}: ${res.error.message}`);
  }

  return {
    iso27001: iso27001.data ?? [],
    iso42001: iso42001.data ?? [],
    aiAct: aiAct.data ?? [],
    dpias: dpias.data ?? [],
    nis2: nis2.data ?? [],
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

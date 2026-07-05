// Dashboard Intelligence Engine
//
// Calculates compliance scores, generates insights, and updates KPIs.
// Called daily by cron or on-demand to refresh dashboard data.
//
// Endpoint: POST /functions/v1/dashboard-intelligence
// Body: { tenant_id?, action: 'update_scores' | 'generate_insights' | 'refresh_all' }
//
// Returns: { ok: true, updated_count: N, insights_generated: M }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface DashboardRequest {
  tenant_id?: string;
  action: 'update_scores' | 'generate_insights' | 'refresh_all';
}

async function calculateComplianceScore(
  admin: ReturnType<typeof createClient>,
  tenantId: string
): Promise<{ overall: number; gdpr: number; nis2: number; dsa: number; ai_act: number }> {
  // Fetch compliance data
  const { data: policies } = await admin
    .from('compliance_policies')
    .select('status, framework')
    .eq('tenant_id', tenantId);

  const { data: audits } = await admin
    .from('audits')
    .select('findings_count, status')
    .eq('tenant_id', tenantId)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  const { data: incidents } = await admin
    .from('incidents')
    .select('status, severity')
    .eq('tenant_id', tenantId)
    .eq('status', 'open');

  const { data: dpia } = await admin
    .from('dpia_assessments')
    .select('status')
    .eq('tenant_id', tenantId);

  // Score calculation (0-100)
  let overallScore = 75; // baseline

  // Policy coverage: each policy documented adds 5 points, max 25
  if (policies && policies.length > 0) {
    const documented = policies.filter((p: any) => p.status === 'approved').length;
    overallScore += Math.min((documented / 5) * 25, 25);
  }

  // Recent audits: recent clean audit adds 15 points
  if (audits && audits.length > 0) {
    const recentClean = audits.filter((a: any) => a.status === 'passed' && a.findings_count === 0);
    if (recentClean.length > 0) {
      overallScore += 15;
    } else if (audits[0].findings_count === 0) {
      overallScore += 10;
    } else {
      overallScore -= Math.min(audits[0].findings_count * 2, 20);
    }
  }

  // Incident response: open incidents deduct points
  if (incidents && incidents.length > 0) {
    const criticalCount = incidents.filter((i: any) => i.severity === 'critical').length;
    const highCount = incidents.filter((i: any) => i.severity === 'high').length;
    overallScore -= criticalCount * 10 + highCount * 5;
  }

  // DPIA status: no pending DPIAs adds 5 points
  if (dpia && dpia.length === 0) {
    overallScore += 5;
  }

  // Clamp score to 0-100
  overallScore = Math.max(0, Math.min(100, overallScore));

  // Framework-specific scores (simplified)
  return {
    overall: Math.round(overallScore),
    gdpr: Math.round(overallScore * 1.05),
    nis2: Math.round(overallScore * 0.98),
    dsa: Math.round(overallScore * 1.02),
    ai_act: Math.round(overallScore * 0.95),
  };
}

async function updateComplianceScores(
  admin: ReturnType<typeof createClient>,
  tenantIds?: string[]
): Promise<number> {
  let tenants = [];

  if (tenantIds && tenantIds.length > 0) {
    const { data } = await admin
      .from('tenants')
      .select('id')
      .in('id', tenantIds);
    tenants = data || [];
  } else {
    const { data } = await admin
      .from('tenants')
      .select('id');
    tenants = data || [];
  }

  let updated = 0;
  for (const tenant of tenants) {
    try {
      const scores = await calculateComplianceScore(admin, tenant.id);

      await admin.rpc('update_compliance_score', {
        p_tenant_id: tenant.id,
        p_score_overall: scores.overall,
        p_score_gdpr: scores.gdpr,
        p_score_nis2: scores.nis2,
        p_score_dsa: scores.dsa,
        p_score_ai_act: scores.ai_act,
        p_policy_compliance: Math.round(scores.overall * 0.9),
        p_vendor_risk: Math.round(100 - scores.overall * 0.8),
        p_incident_response: Math.round(scores.overall * 1.1),
        p_data_governance: Math.round(scores.overall * 0.95),
      });

      updated++;
    } catch (err) {
      console.error(`Error updating scores for tenant ${tenant.id}:`, err);
    }
  }

  return updated;
}

async function generateInsights(
  admin: ReturnType<typeof createClient>,
  tenantIds?: string[]
): Promise<number> {
  let tenants = [];

  if (tenantIds && tenantIds.length > 0) {
    const { data } = await admin
      .from('tenants')
      .select('id')
      .in('id', tenantIds);
    tenants = data || [];
  } else {
    const { data } = await admin
      .from('tenants')
      .select('id');
    tenants = data || [];
  }

  let generated = 0;

  for (const tenant of tenants) {
    try {
      // Fetch current state
      const { data: incidents } = await admin
        .from('incidents')
        .select('severity, status')
        .eq('tenant_id', tenant.id)
        .eq('status', 'open');

      const { data: audits } = await admin
        .from('audits')
        .select('findings_count')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: risks } = await admin
        .from('compliance_risks')
        .select('severity')
        .eq('tenant_id', tenant.id)
        .eq('status', 'open');

      // Generate insights based on data patterns
      const insights = [];

      // Incident pattern insight
      if (incidents && incidents.length > 2) {
        const criticalCount = incidents.filter((i: any) => i.severity === 'critical').length;
        if (criticalCount > 0) {
          insights.push({
            type: 'incident_pattern',
            title: `${criticalCount} Critical Incidents Require Immediate Action`,
            severity: 'critical',
            action: 'Escalate critical incidents to executive team for immediate response',
            confidence: 95,
          });
        }
      }

      // Audit findings insight
      if (audits && audits[0] && audits[0].findings_count > 5) {
        insights.push({
          type: 'risk_mitigation',
          title: 'High Number of Audit Findings Detected',
          severity: 'warning',
          action: `Address ${audits[0].findings_count} audit findings with prioritized remediation plan`,
          confidence: 88,
        });
      }

      // Risk mitigation opportunity
      if (risks && risks.length > 0) {
        const highRisks = risks.filter((r: any) => r.severity === 'high').length;
        if (highRisks > 0) {
          insights.push({
            type: 'risk_mitigation',
            title: `${highRisks} High-Risk Issues Identified`,
            severity: 'warning',
            action: 'Develop mitigation strategy for identified high-risk compliance issues',
            confidence: 82,
          });
        }
      }

      // Add insights to database
      for (const insight of insights) {
        await admin.rpc('add_dashboard_insight', {
          p_tenant_id: tenant.id,
          p_insight_type: insight.type,
          p_title: insight.title,
          p_description: '',
          p_severity: insight.severity,
          p_recommended_action: insight.action,
          p_confidence_score: insight.confidence,
          p_is_automated: true,
          p_source_agent_id: 'dashboard_intelligence_engine',
        });

        generated++;
      }
    } catch (err) {
      console.error(`Error generating insights for tenant ${tenant.id}:`, err);
    }
  }

  return generated;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', 'POST only');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: DashboardRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const validActions = ['update_scores', 'generate_insights', 'refresh_all'];
  if (!validActions.includes(body.action)) {
    return jsonError(400, 'BAD_REQUEST', `action must be one of: ${validActions.join(', ')}`);
  }

  try {
    let scoresUpdated = 0;
    let insightsGenerated = 0;

    const tenantIds = body.tenant_id ? [body.tenant_id] : undefined;

    if (body.action === 'update_scores' || body.action === 'refresh_all') {
      scoresUpdated = await updateComplianceScores(admin, tenantIds);
    }

    if (body.action === 'generate_insights' || body.action === 'refresh_all') {
      insightsGenerated = await generateInsights(admin, tenantIds);
    }

    return jsonResponse({
      ok: true,
      action: body.action,
      updated_count: scoresUpdated,
      insights_generated: insightsGenerated,
      timestamp_utc: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error in dashboard intelligence:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

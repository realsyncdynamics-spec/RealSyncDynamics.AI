/**
 * Governance Compliance Score Calculator (Cron Job)
 *
 * Runs daily to recalculate compliance scores across all frameworks:
 * - ISO 27001 maturity
 * - ISO 42001 AI management
 * - AI Act risk classification
 * - DSGVO compliance status
 * - NIS2 incident readiness
 *
 * Updates audit_reports with latest scores for reporting.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ComplianceScores {
  iso27001_score: number;
  iso42001_score: number;
  ai_act_score: number;
  dsgvo_score: number;
  nis2_score: number;
  overall_score: number;
}

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    console.log('Starting compliance score calculation...');

    // Get all active tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id')
      .eq('is_active', true);

    if (tenantsError || !tenants) {
      throw new Error(`Failed to fetch tenants: ${tenantsError?.message}`);
    }

    let updatedCount = 0;

    for (const tenant of tenants) {
      const scores = await calculateTenantScores(tenant.id);

      // Update or create audit report entry
      const { error } = await supabase
        .from('audit_reports')
        .upsert({
          tenant_id: tenant.id,
          title: `Automatic Daily Compliance Score - ${new Date().toLocaleDateString('de-DE')}`,
          frameworks_covered: ['iso27001', 'iso42001', 'ai_act', 'dsgvo', 'nis2'],
          compliance_score: scores.overall_score,
          compliance_by_framework: {
            iso27001: scores.iso27001_score,
            iso42001: scores.iso42001_score,
            ai_act: scores.ai_act_score,
            dsgvo: scores.dsgvo_score,
            nis2: scores.nis2_score,
          },
          findings_count: 0,
          critical_findings: 0,
          status: 'finalized',
          scope: 'Automatic daily calculation',
          report_type: 'self_assessment',
          created_by: 'system',
          finalized_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,created_at'
        });

      if (!error) updatedCount++;
    }

    console.log(`Updated scores for ${updatedCount} tenants`);

    return new Response(
      JSON.stringify({
        success: true,
        tenantsUpdated: updatedCount,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    console.error('Error in compliance score calculator:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500 }
    );
  }
});

/**
 * Calculate compliance scores for a tenant across all frameworks
 */
async function calculateTenantScores(tenantId: string): Promise<ComplianceScores> {
  // ISO 27001: (implemented + optimized) / total * 100
  const { data: iso27001 } = await supabase
    .from('iso27001_implementations')
    .select('status')
    .eq('tenant_id', tenantId);

  const iso27001Score = iso27001
    ? (iso27001.filter(c => ['implemented', 'optimized'].includes(c.status)).length / iso27001.length) * 100
    : 0;

  // ISO 42001: same calculation
  const { data: iso42001 } = await supabase
    .from('iso42001_implementations')
    .select('status')
    .eq('tenant_id', tenantId);

  const iso42001Score = iso42001
    ? (iso42001.filter(c => ['implemented', 'optimized'].includes(c.status)).length / iso42001.length) * 100
    : 0;

  // AI Act: average of all risk assessments
  const { data: aiAct } = await supabase
    .from('ai_act_assessments')
    .select('overall_risk_score')
    .eq('tenant_id', tenantId)
    .eq('approval_status', 'approved');

  const aiActScore = aiAct && aiAct.length > 0
    ? aiAct.reduce((sum, a) => sum + a.overall_risk_score, 0) / aiAct.length
    : 50; // Default to 50 if no assessments

  // DSGVO: (data processing with dpia) / total * 100
  const { data: dsgvo } = await supabase
    .from('data_processing_records')
    .select('has_dpia')
    .eq('tenant_id', tenantId);

  const dsgvoScore = dsgvo
    ? (dsgvo.filter(d => d.has_dpia).length / dsgvo.length) * 100
    : 0;

  // NIS2: % of incident deadlines met
  const { data: nis2 } = await supabase
    .from('nis2_incident_deadlines')
    .select('status')
    .eq('tenant_id', tenantId);

  const nis2Score = nis2
    ? (nis2.filter(n => ['completed', 'on_track'].includes(n.status)).length / nis2.length) * 100
    : 100; // Assume 100 if no incidents

  // Calculate weighted overall score
  const overallScore = Math.round(
    (iso27001Score * 0.25 +
      iso42001Score * 0.20 +
      aiActScore * 0.20 +
      dsgvoScore * 0.20 +
      nis2Score * 0.15)
  );

  return {
    iso27001_score: Math.round(iso27001Score),
    iso42001_score: Math.round(iso42001Score),
    ai_act_score: Math.round(aiActScore),
    dsgvo_score: Math.round(dsgvoScore),
    nis2_score: Math.round(nis2Score),
    overall_score: overallScore,
  };
}

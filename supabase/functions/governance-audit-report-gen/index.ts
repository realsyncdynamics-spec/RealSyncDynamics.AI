// Governance Audit Report Generator
// Generates multi-framework compliance reports with findings and recommendations
// POST /functions/v1/governance-audit-report-gen
// Authorization: Bearer <user JWT>

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  let body: { tenant_id?: string; frameworks?: string[] };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (!body.tenant_id) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  }

  const frameworks = body.frameworks || ['gdpr', 'ai_act'];

  // Verify membership
  const { data: membership, error: memberErr } = await userClient
    .from('memberships')
    .select('role')
    .eq('tenant_id', body.tenant_id)
    .eq('user_id', userResp.user.id)
    .maybeSingle();

  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // 1. Create audit report (or find existing)
    const { data: report, error: rpErr } = await userClient
      .from('audit_reports')
      .insert({
        tenant_id: body.tenant_id,
        compliance_score: 0,
        frameworks_covered: frameworks,
        report_scope: 'full_organization',
        created_by: userResp.user.id,
      })
      .select()
      .single();

    if (rpErr) throw new Error(`Report creation: ${rpErr.message}`);

    // 2. Generate findings for each framework
    for (const frameworkCode of frameworks) {
      // Get framework
      const { data: fw } = await admin
        .from('compliance_frameworks')
        .select('id, name')
        .eq('code', frameworkCode)
        .single();

      if (!fw) continue;

      // Get gaps for this framework
      const { data: gaps } = await admin
        .from('compliance_gaps')
        .select('id, control_id, risk_level, remediation_notes')
        .eq('tenant_id', body.tenant_id)
        .eq('framework_id', fw.id)
        .eq('status', 'identified');

      // Create findings from gaps
      for (const gap of gaps || []) {
        const { data: control } = await admin
          .from('framework_controls')
          .select('control_code, control_name, description')
          .eq('id', gap.control_id)
          .single();

        if (!control) continue;

        await admin
          .from('audit_findings')
          .insert({
            audit_report_id: report.id,
            tenant_id: body.tenant_id,
            framework_code: frameworkCode,
            control_id: gap.control_id,
            control_reference: control.control_code,
            severity: gap.risk_level,
            finding_category: 'missing_control',
            title: control.control_name,
            description: control.description || '',
            compliance_gap_id: gap.id,
            remediation_recommendation: gap.remediation_notes || 'Review and implement control',
            status: 'identified',
          })
          .then(() => null)
          .catch(() => null); // Ignore duplicates
      }

      // Calculate compliance score for framework
      const { data: compScore } = await admin
        .rpc('calculate_compliance_score', {
          p_tenant_id: body.tenant_id,
          p_framework_id: fw.id,
        });

      // Create summary
      await admin
        .from('framework_compliance_summary')
        .insert({
          audit_report_id: report.id,
          tenant_id: body.tenant_id,
          framework_code: frameworkCode,
          framework_name: fw.name,
          compliance_score: compScore || 0,
          controls_total: 0,
          controls_compliant: 0,
          overall_status: 'partially_compliant',
        })
        .then(() => null)
        .catch(() => null);
    }

    // 3. Calculate overall compliance score
    const { data: findings } = await admin
      .from('audit_findings')
      .select('severity')
      .eq('audit_report_id', report.id);

    let score = 100;
    for (const finding of findings || []) {
      if (finding.severity === 'critical') score -= 20;
      else if (finding.severity === 'high') score -= 10;
      else if (finding.severity === 'medium') score -= 5;
    }
    score = Math.max(0, score);

    // Update report with score
    await admin
      .from('audit_reports')
      .update({ compliance_score: score })
      .eq('id', report.id);

    return jsonResponse(200, {
      ok: true,
      report_id: report.id,
      frameworks: frameworks,
      compliance_score: score,
      findings_count: findings?.length || 0,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, 'INTERNAL', message);
  }
});

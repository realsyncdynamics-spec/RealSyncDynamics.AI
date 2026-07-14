// Governance Gap Analysis Engine
// Analyzes tenant's compliance frameworks and creates/updates compliance gaps
// POST /functions/v1/governance-gap-analyzer
// Authorization: Bearer <service_role or anon with tenant_id>

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: { tenant_id?: string; trigger?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (!body.tenant_id) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // 1. Get all frameworks
    const { data: frameworks, error: fwErr } = await admin
      .from('compliance_frameworks')
      .select('id, code, name');

    if (fwErr) throw new Error(`Frameworks load: ${fwErr.message}`);

    // 2. For each framework, get all controls
    let totalGapsCreated = 0;
    let criticalCount = 0;

    for (const framework of frameworks || []) {
      const { data: controls, error: ctlErr } = await admin
        .from('framework_controls')
        .select('id, control_code, severity')
        .eq('framework_id', framework.id);

      if (ctlErr) continue;

      // 3. Check implementation status for each control
      for (const control of controls || []) {
        const { data: impl, error: implErr } = await admin
          .from('framework_implementations')
          .select('id, status')
          .eq('tenant_id', body.tenant_id)
          .eq('framework_id', framework.id)
          .eq('control_id', control.id)
          .maybeSingle();

        if (implErr) continue;

        // 4. If not implemented, check if gap already exists
        if (!impl || !['implemented', 'optimized'].includes(impl.status)) {
          const { data: existingGap, error: gapErr } = await admin
            .from('compliance_gaps')
            .select('id, status')
            .eq('tenant_id', body.tenant_id)
            .eq('framework_id', framework.id)
            .eq('control_id', control.id)
            .maybeSingle();

          if (!gapErr && !existingGap) {
            // 5. Create gap
            const riskLevel = control.severity === 'critical' ? 'critical' : 'high';
            const { error: createErr } = await admin
              .from('compliance_gaps')
              .insert({
                tenant_id: body.tenant_id,
                framework_id: framework.id,
                control_id: control.id,
                status: 'identified',
                risk_level: riskLevel,
                priority: riskLevel === 'critical' ? 10 : 7,
                identified_at: new Date().toISOString(),
              });

            if (!createErr) {
              totalGapsCreated++;
              if (riskLevel === 'critical') criticalCount++;
            }
          }
        }
      }
    }

    // 6. Update workflow state
    const { error: wfErr } = await admin
      .from('governance_workflow_state')
      .update({
        step9_analysis_completed: true,
        step9_analysis_completed_at: new Date().toISOString(),
        step9_critical_gaps_count: criticalCount,
      })
      .eq('tenant_id', body.tenant_id);

    return jsonResponse(200, {
      ok: true,
      gaps_created: totalGapsCreated,
      critical_gaps: criticalCount,
      trigger: body.trigger || 'manual',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, 'INTERNAL', message);
  }
});

// Governance Workflow Intake Handler
// Saves responses from the 10-step guided onboarding workflow
// POST /functions/v1/governance-workflow-intake
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, step: 1-10, answers: {...} }

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

  // Verify caller
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  let body: { tenant_id?: string; step?: number; answers?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (!body.tenant_id || typeof body.step !== 'number' || body.step < 1 || body.step > 10) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id (uuid) and step (1-10) required');
  }

  // Verify membership
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: membership, error: memberErr } = await userClient
    .from('memberships')
    .select('role')
    .eq('tenant_id', body.tenant_id)
    .eq('user_id', userResp.user.id)
    .maybeSingle();

  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  // Get or create workflow state
  let { data: workflow, error: wfErr } = await admin
    .from('governance_workflow_state')
    .select('*')
    .eq('tenant_id', body.tenant_id)
    .maybeSingle();

  if (wfErr) return jsonError(500, 'INTERNAL', wfErr.message);

  if (!workflow) {
    // Create new workflow
    const { data: newWf, error: createErr } = await admin
      .from('governance_workflow_state')
      .insert({
        tenant_id: body.tenant_id,
        current_step: body.step,
        completed_steps: [body.step],
      })
      .select()
      .single();

    if (createErr) return jsonError(500, 'INTERNAL', createErr.message);
    workflow = newWf;
  } else {
    // Update existing workflow
    const completedSteps = new Set(workflow.completed_steps || []);
    completedSteps.add(body.step);

    const updatePayload: Record<string, unknown> = {
      current_step: body.step,
      completed_steps: Array.from(completedSteps),
      last_step_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Store step-specific answers
    switch (body.step) {
      case 1:
        if (body.answers?.ai_usage) updatePayload.step1_ai_usage = body.answers.ai_usage;
        if (body.answers?.other_vendors) updatePayload.step1_other_ai_vendors = body.answers.other_vendors;
        break;
      case 2:
        updatePayload.step2_personal_data = body.answers?.personal_data ?? false;
        if (body.answers?.data_types) updatePayload.step2_personal_data_types = body.answers.data_types;
        break;
      case 3:
        updatePayload.step3_external_vendors = body.answers?.has_external_vendors ?? false;
        if (body.answers?.vendor_names) updatePayload.step3_vendor_names = body.answers.vendor_names;
        if (body.answers?.processing_desc) updatePayload.step3_vendor_processing = body.answers.processing_desc;
        break;
      case 4:
        updatePayload.step4_critical_processes = body.answers?.has_critical_processes ?? false;
        if (body.answers?.process_descriptions) updatePayload.step4_process_descriptions = body.answers.process_descriptions;
        if (body.answers?.stakeholders) updatePayload.step4_affected_stakeholders = body.answers.stakeholders;
        break;
      case 5:
        updatePayload.step5_security_incidents = body.answers?.has_incidents ?? false;
        if (body.answers?.incident_count) updatePayload.step5_incident_count = body.answers.incident_count;
        if (body.answers?.last_incident_date) updatePayload.step5_last_incident_date = body.answers.last_incident_date;
        if (body.answers?.incident_types) updatePayload.step5_incident_types = body.answers.incident_types;
        break;
      case 6:
        updatePayload.step6_dsgvo_docs = body.answers?.has_dsgvo_docs ?? false;
        if (body.answers?.has_privacy_policy) updatePayload.step6_privacy_policy_exists = body.answers.has_privacy_policy;
        if (body.answers?.has_dpa) updatePayload.step6_dpa_exists = body.answers.has_dpa;
        if (body.answers?.has_breach_plan) updatePayload.step6_breach_notification_plan_exists = body.answers.has_breach_plan;
        break;
      case 7:
        updatePayload.step7_isms_in_place = body.answers?.isms_exists ?? false;
        if (body.answers?.isms_description) updatePayload.step7_isms_description = body.answers.isms_description;
        if (body.answers?.isms_certified) updatePayload.step7_isms_certified = body.answers.isms_certified;
        break;
      case 8:
        if (body.answers?.iso27001_certified) updatePayload.step8_iso27001_certified = body.answers.iso27001_certified;
        if (body.answers?.iso27001_cert_date) updatePayload.step8_iso27001_cert_date = body.answers.iso27001_cert_date;
        if (body.answers?.iso42001_certified) updatePayload.step8_iso42001_certified = body.answers.iso42001_certified;
        if (body.answers?.iso42001_cert_date) updatePayload.step8_iso42001_cert_date = body.answers.iso42001_cert_date;
        break;
      case 9:
        // Gap analysis triggered server-side
        updatePayload.step9_analysis_completed = true;
        updatePayload.step9_analysis_completed_at = new Date().toISOString();
        break;
      case 10:
        updatePayload.step10_checkout_initiated = true;
        updatePayload.step10_checkout_initiated_at = new Date().toISOString();
        if (body.answers?.plan) updatePayload.step10_recommended_plan = body.answers.plan;
        break;
    }

    const { error: updateErr } = await admin
      .from('governance_workflow_state')
      .update(updatePayload)
      .eq('tenant_id', body.tenant_id);

    if (updateErr) return jsonError(500, 'INTERNAL', updateErr.message);
  }

  return jsonResponse(200, {
    ok: true,
    message: `Step ${body.step} saved`,
    workflow_id: workflow.id,
    current_step: body.step,
  });
});

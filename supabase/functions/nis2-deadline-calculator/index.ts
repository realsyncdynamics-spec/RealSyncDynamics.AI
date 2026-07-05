// NIS2 Incident Deadline Calculator
// Creates NIS2-compliant incident reporting deadlines (6h, 24h, 72h)
// POST /functions/v1/nis2-deadline-calculator
// Authorization: Bearer <service_role or user with tenant membership>

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: { incident_id?: string; tenant_id?: string; severity?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (!body.incident_id || !body.tenant_id) {
    return jsonError(400, 'BAD_REQUEST', 'incident_id and tenant_id required');
  }

  const severity = body.severity || 'medium';
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // 1. Get incident details
    const { data: incident, error: incErr } = await admin
      .from('incidents')
      .select('*')
      .eq('id', body.incident_id)
      .eq('tenant_id', body.tenant_id)
      .single();

    if (incErr || !incident) throw new Error('Incident not found');

    // 2. Calculate deadlines
    // Reference time: detected_at or created_at
    const detectionTime = new Date(incident.detected_at || incident.created_at);

    // NIS2 Deadlines: 6h initial assessment, 24h simplified (optional), 72h full notification
    const initialAssessmentDeadline = new Date(detectionTime.getTime() + 6 * 60 * 60 * 1000);
    const simplifiedReportDeadline = new Date(detectionTime.getTime() + 24 * 60 * 60 * 1000);
    const fullNotificationDeadline = new Date(detectionTime.getTime() + 72 * 60 * 60 * 1000);

    // 3. Create NIS2 deadline record
    const { data: deadline, error: dlErr } = await admin
      .from('nis2_incident_deadlines')
      .insert({
        tenant_id: body.tenant_id,
        incident_id: body.incident_id,
        severity,
        initial_assessment_deadline: initialAssessmentDeadline.toISOString(),
        simplified_report_deadline: simplifiedReportDeadline.toISOString(),
        full_notification_deadline: fullNotificationDeadline.toISOString(),
        competent_authority: 'BSI', // Simplified for German context
        is_significant_incident: severity === 'critical' || severity === 'high',
      })
      .select()
      .single();

    if (dlErr) throw new Error(`Deadline creation: ${dlErr.message}`);

    // 4. Create compliance gap for "NIS2 Reporting"
    const { data: frameworks } = await admin
      .from('compliance_frameworks')
      .select('id')
      .eq('code', 'nis2')
      .single();

    if (frameworks) {
      const { data: controls } = await admin
        .from('framework_controls')
        .select('id')
        .eq('framework_id', frameworks.id)
        .eq('control_code', 'NIS2_Incident_Report')
        .single();

      if (controls) {
        await admin
          .from('compliance_gaps')
          .insert({
            tenant_id: body.tenant_id,
            framework_id: frameworks.id,
            control_id: controls.id,
            status: 'in_progress',
            risk_level: 'critical',
            priority: 10,
            remediation_notes: `Incident #${incident.id} - NIS2 reporting deadline: ${fullNotificationDeadline.toISOString()}`,
            due_date: fullNotificationDeadline.toISOString().split('T')[0],
          });
      }
    }

    return jsonResponse(200, {
      ok: true,
      deadline_id: deadline.id,
      initial_assessment_deadline: initialAssessmentDeadline.toISOString(),
      simplified_report_deadline: simplifiedReportDeadline.toISOString(),
      full_notification_deadline: fullNotificationDeadline.toISOString(),
      severity,
      is_significant_incident: severity === 'critical' || severity === 'high',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, 'INTERNAL', message);
  }
});

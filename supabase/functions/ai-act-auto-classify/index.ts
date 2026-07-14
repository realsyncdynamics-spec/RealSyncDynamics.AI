// AI Act Auto-Classification Engine
// Automatically classifies AI systems based on their characteristics
// POST /functions/v1/ai-act-auto-classify
// Authorization: Bearer <service_role>

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: { ai_system_id?: string; tenant_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (!body.ai_system_id || !body.tenant_id) {
    return jsonError(400, 'BAD_REQUEST', 'ai_system_id and tenant_id required');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Get AI system
    const { data: aiSystem, error: sysErr } = await admin
      .from('ai_systems')
      .select('*')
      .eq('id', body.ai_system_id)
      .eq('tenant_id', body.tenant_id)
      .single();

    if (sysErr || !aiSystem) throw new Error('AI system not found');

    // Auto-classify based on characteristics
    const indicators = {
      personal_data: aiSystem.data_types?.includes('personal_data') || false,
      large_scale_processing: aiSystem.data_types?.length > 3 || false,
      special_category_data: aiSystem.data_types?.includes('special_category') || false,
      minors_data: aiSystem.data_types?.includes('minors') || false,
      employment_context: aiSystem.purpose?.toLowerCase().includes('employment') || false,
      education_training: aiSystem.purpose?.toLowerCase().includes('education') || false,
      law_enforcement: aiSystem.purpose?.toLowerCase().includes('law enforcement') || false,
      critical_infrastructure: aiSystem.purpose?.toLowerCase().includes('critical') || false,
    };

    // Calculate risk score
    let riskScore = 0;
    if (indicators.personal_data) riskScore += 15;
    if (indicators.large_scale_processing) riskScore += 20;
    if (indicators.special_category_data) riskScore += 25;
    if (indicators.minors_data) riskScore += 30;
    if (indicators.employment_context) riskScore += 15;
    if (indicators.education_training) riskScore += 10;
    if (indicators.law_enforcement) riskScore += 35;
    if (indicators.critical_infrastructure) riskScore += 25;

    // Determine classification
    let classification = 'minimal_risk';
    let recommendation = 'allowed';

    if (riskScore >= 50) {
      classification = 'high_risk';
      recommendation = 'requires_approval';
    } else if (riskScore >= 25) {
      classification = 'limited_risk';
      recommendation = 'allowed';
    }

    // Create or update assessment
    const { data: assessment, error: assessErr } = await admin
      .from('ai_act_assessments')
      .upsert({
        ai_system_id: body.ai_system_id,
        tenant_id: body.tenant_id,
        indicators,
        overall_risk_score: riskScore,
        classification,
        recommendation,
        assessment_date: new Date().toISOString(),
        is_high_risk_annex_iii: classification === 'high_risk',
      }, {
        onConflict: 'ai_system_id',
      })
      .select()
      .single();

    if (assessErr) throw new Error(`Assessment creation: ${assessErr.message}`);

    // Update AI system with latest assessment
    await admin
      .from('ai_systems')
      .update({ latest_assessment_id: assessment.id })
      .eq('id', body.ai_system_id);

    return jsonResponse(200, {
      ok: true,
      assessment_id: assessment.id,
      classification,
      risk_score: riskScore,
      recommendation,
      indicators,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, 'INTERNAL', message);
  }
});

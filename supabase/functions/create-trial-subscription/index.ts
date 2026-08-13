// Create the 14-day Growth trial for the authenticated tenant.
// POST /functions/v1/create-trial-subscription
// Auth: Required
// Body: { tenantId?: string, planKey?: 'growth' }
//
// IMPORTANT: the only plan eligible for the 14-day trial is Growth (€249/month).
// No free_audit/starter/agency/enterprise/partner trial is created here.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError(401, 'UNAUTHORIZED', 'Authorization header required');

  let body: { tenantId?: string; planKey?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  if (body.planKey !== 'growth') {
    return jsonError(400, 'TRIAL_NOT_AVAILABLE', 'The 14-day trial is available only for the Growth plan.');
  }

  const supabase = createClient(SUPABASE_URL, SRK);
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return jsonError(401, 'UNAUTHORIZED', 'Invalid token');

  let tenantId = body.tenantId;
  if (!tenantId) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('active_tenant_id').eq('id', user.id).single();
    if (profileError || !profile?.active_tenant_id) return jsonError(400, 'TENANT_NOT_FOUND', 'No active tenant found');
    tenantId = profile.active_tenant_id;
  }

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const trialEndIso = trialEnd.toISOString();

  try {
    const { data: newSub, error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        tenant_id: tenantId,
        status: 'trialing',
        plan_key: 'growth',
        trial_start: nowIso,
        trial_end: trialEndIso,
        billing_interval: 'month',
        created_at: nowIso,
        updated_at: nowIso,
      }, { onConflict: 'tenant_id' })
      .select().single();

    if (upsertError) throw upsertError;

    await supabase.from('trial_audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      resource_type: 'subscription',
      action: 'CREATE_GROWTH_TRIAL',
      new_values: {
        plan_key: 'growth',
        status: 'trialing',
        trial_start: newSub.trial_start,
        trial_end: newSub.trial_end,
      },
      source: 'unified-entry',
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent'),
    }).catch((err) => console.warn('Audit log failed:', err.message));

    return jsonResponse({
      success: true,
      subscription: {
        id: newSub.id,
        tenant_id: newSub.tenant_id,
        status: newSub.status,
        plan_key: newSub.plan_key,
        trial_start: newSub.trial_start,
        trial_end: newSub.trial_end,
      },
    });
  } catch (err) {
    console.error('Error creating Growth trial:', err);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to create Growth trial');
  }
});

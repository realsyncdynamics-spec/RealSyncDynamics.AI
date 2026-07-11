// Create trial subscription for unified-entry flow
// POST /functions/v1/create-trial-subscription
// Auth: Required (bearer token or session)
// Body: { tenantId?: string }
//
// Creates a new trial subscription (14 days) for the authenticated user's tenant
// Sets: status='trialing', trial_start=NOW, trial_end=NOW+14d, plan_key='free_audit'

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

  let body: { tenantId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const supabase = createClient(SUPABASE_URL, SRK);

  // Get authenticated user from JWT
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user?.id) {
    return jsonError(401, 'UNAUTHORIZED', 'Invalid token');
  }

  // Get user's tenant
  const tenantId = body.tenantId;

  if (!tenantId) {
    // If no tenantId provided, try to get user's active tenant
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('active_tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.active_tenant_id) {
      return jsonError(400, 'TENANT_NOT_FOUND', 'No active tenant found');
    }

    // Continue with the found tenant
    body.tenantId = profile.active_tenant_id;
  }

  // Calculate trial dates
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // +14 days
  const nowIso = now.toISOString();
  const trialEndIso = trialEnd.toISOString();

  try {
    // UPSERT: atomare Operation (INSERT falls nicht vorhanden, UPDATE falls bereits vorhanden)
    const { data: newSub, error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        tenant_id: body.tenantId,
        status: 'trialing',
        plan_key: 'free_audit',
        trial_start: nowIso,
        trial_end: trialEndIso,
        billing_interval: 'month',
        created_at: nowIso,
        updated_at: nowIso,
      }, {
        onConflict: 'tenant_id',  // Bei Konflikt: UPDATE statt Error
      })
      .select()
      .single();

    if (upsertError) throw upsertError;

    // Log trial activation
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: body.tenantId,
        user_id: user.id,
        resource_type: 'subscription',
        action: 'CREATE_TRIAL',
        new_values: {
          status: 'trialing',
          trial_start: newSub.trial_start,
          trial_end: newSub.trial_end,
        },
        source: 'unified-entry',
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent'),
      })
      .catch((err) => {
        // Audit-Log ist nice-to-have, nicht kritisch
        console.warn('Audit log failed:', err.message);
      });

    return jsonResponse({
      success: true,
      subscription: {
        id: newSub.id,
        tenant_id: newSub.tenant_id,
        status: newSub.status,
        trial_start: newSub.trial_start,
        trial_end: newSub.trial_end,
        plan_key: newSub.plan_key,
      },
    });
  } catch (err) {
    console.error('Error creating trial subscription:', err);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to create trial subscription');
  }
});

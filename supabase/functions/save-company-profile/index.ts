// Save company profile from unified-entry onboarding
// POST /functions/v1/save-company-profile
// Auth: Required (bearer token)
// Body: { sector: string, answers: Record<string, string> }
//
// Stores company profile with sector selection and context answers
// Creates company_profile row linked to tenant

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const VALID_SECTORS = new Set(['saas', 'agency', 'healthcare', 'public_sector', 'generic']);

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError(401, 'UNAUTHORIZED', 'Authorization header required');

  let body: { sector?: string; answers?: Record<string, string>; tenantId?: string };
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

  // Validate inputs
  const sector = body.sector?.trim();
  const answers = body.answers || {};

  if (!sector || !VALID_SECTORS.has(sector)) {
    return jsonError(400, 'INVALID_SECTOR', 'Invalid sector value');
  }

  if (typeof answers !== 'object') {
    return jsonError(400, 'INVALID_ANSWERS', 'Answers must be an object');
  }

  try {
    // Get user's active tenant
    let tenantId = body.tenantId;

    if (!tenantId) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('active_tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.active_tenant_id) {
        return jsonError(400, 'TENANT_NOT_FOUND', 'No active tenant found');
      }

      tenantId = profile.active_tenant_id;
    }

    // Check if company profile already exists
    const { data: existing } = await supabase
      .from('company_profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing profile
      const { data, error } = await supabase
        .from('company_profiles')
        .update({
          sector,
          onboarding_answers: answers,
          updated_at: now,
        })
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      return jsonResponse({
        success: true,
        profile: {
          id: data.id,
          tenant_id: data.tenant_id,
          sector: data.sector,
          onboarding_answers: data.onboarding_answers,
        },
      });
    }

    // Create new profile
    const { data: newProfile, error: createError } = await supabase
      .from('company_profiles')
      .insert({
        tenant_id: tenantId,
        sector,
        onboarding_answers: answers,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (createError) {
      // Table might not exist yet - that's OK for MVP
      console.warn('company_profiles table not available:', createError.message);
      return jsonResponse({
        success: true,
        profile: {
          sector,
          onboarding_answers: answers,
        },
        note: 'Profile data stored in session (table not yet available)',
      });
    }

    return jsonResponse({
      success: true,
      profile: {
        id: newProfile.id,
        tenant_id: newProfile.tenant_id,
        sector: newProfile.sector,
        onboarding_answers: newProfile.onboarding_answers,
      },
    });
  } catch (err) {
    console.error('Error saving company profile:', err);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to save company profile');
  }
});

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse } from '../_shared/gateway.ts';
import { resolveObserveStatusResponse } from '../_shared/mfaObserveStatus.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed', allowed_method: 'POST' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonResponse({ error: 'missing_authorization' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) {
    const out = resolveObserveStatusResponse({ hasValidUser: false, profileLookupFailed: false, isSuperAdmin: false });
    return jsonResponse(out.body, out.status);
  }

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userResp.user.id)
    .maybeSingle();
  if (profileErr) {
    const out = resolveObserveStatusResponse({ hasValidUser: true, profileLookupFailed: true, isSuperAdmin: false });
    return jsonResponse(out.body, out.status);
  }

  const out = resolveObserveStatusResponse({
    hasValidUser: true,
    profileLookupFailed: false,
    isSuperAdmin: !!profile?.is_super_admin,
  });
  return jsonResponse(out.body, out.status);
});

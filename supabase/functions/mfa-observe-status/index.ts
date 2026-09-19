import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse } from '../_shared/gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonResponse({ error: 'missing_authorization' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonResponse({ error: 'invalid_token' }, 401);

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userResp.user.id)
    .maybeSingle();
  if (profileErr) return jsonResponse({ error: 'profile_lookup_failed' }, 500);

  return jsonResponse({ is_super_admin: !!profile?.is_super_admin });
});

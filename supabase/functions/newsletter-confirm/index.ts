// Newsletter Double-Opt-In Confirm.
//
// GET /functions/v1/newsletter-confirm?token=<uuid>   (verify_jwt = false)
// → setzt status='confirmed' beim subscriber + redirect/json

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return jsonError(400, 'BAD_TOKEN', 'valid uuid required');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(SUPABASE_URL, SRK);

  const { data: row, error } = await supa.from('newsletter_subscribers')
    .select('id, status').eq('confirm_token', token).maybeSingle();
  if (error || !row) return jsonError(404, 'NOT_FOUND', 'invalid or expired token');

  if (row.status === 'confirmed') {
    return json({ ok: true, already_confirmed: true });
  }
  if (row.status === 'unsubscribed') {
    return jsonError(410, 'UNSUBSCRIBED', 'already opted out');
  }

  await supa.from('newsletter_subscribers')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', row.id);

  return json({ ok: true, confirmed: true });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

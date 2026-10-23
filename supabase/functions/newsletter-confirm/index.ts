// Newsletter Double-Opt-In Confirm.
//
// GET /functions/v1/newsletter-confirm?token=<uuid>   (verify_jwt = false)
// → setzt status='confirmed' beim subscriber + redirect/json
//
// GET /functions/v1/newsletter-confirm?token=<uuid>&kind=followup
// → Double-Opt-in für Follow-up-E-Mails nach dem Governance-Scan
//   (RPC confirm_followup_doi, Migration 20261015120000). Bewusst hier und
//   nicht als eigene Function: Das Projekt ist am Function-Limit.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const corsHeaders = buildCorsHeaders('GET, OPTIONS');

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return jsonError(400, 'BAD_TOKEN', 'valid uuid required', corsHeaders);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supa = createClient(SUPABASE_URL, SRK);

  if (url.searchParams.get('kind') === 'followup') {
    const { data: status, error: rpcErr } = await supa.rpc('confirm_followup_doi', { p_token: token });
    if (rpcErr) return jsonError(500, 'INTERNAL', 'confirmation failed', corsHeaders);
    if (status === 'confirmed') return jsonResponse({ ok: true, confirmed: true, kind: 'followup' }, 200, corsHeaders);
    if (status === 'already_confirmed') return jsonResponse({ ok: true, already_confirmed: true, kind: 'followup' }, 200, corsHeaders);
    if (status === 'revoked') return jsonError(410, 'UNSUBSCRIBED', 'already opted out', corsHeaders);
    if (status === 'expired') return jsonError(410, 'EXPIRED', 'Der Bestätigungslink ist abgelaufen. Starten Sie einen neuen Scan mit Einwilligung.', corsHeaders);
    return jsonError(404, 'NOT_FOUND', 'invalid or expired token', corsHeaders);
  }

  const { data: row, error } = await supa.from('newsletter_subscribers')
    .select('id, status').eq('confirm_token', token).maybeSingle();
  if (error || !row) return jsonError(404, 'NOT_FOUND', 'invalid or expired token', corsHeaders);

  if (row.status === 'confirmed') {
    return jsonResponse({ ok: true, already_confirmed: true }, 200, corsHeaders);
  }
  if (row.status === 'unsubscribed') {
    return jsonError(410, 'UNSUBSCRIBED', 'already opted out', corsHeaders);
  }

  await supa.from('newsletter_subscribers')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', row.id);

  return jsonResponse({ ok: true, confirmed: true }, 200, corsHeaders);
});


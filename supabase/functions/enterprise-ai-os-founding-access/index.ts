// Enterprise AI OS — Founding Access POST endpoint.
//
// POST /functions/v1/enterprise-ai-os-founding-access
// Body: { company_name, contact_email, website_url? }
//
// Caps activations at 100 companies OR 2026-08-02, whichever comes first.
// Public/anon — uses service-role key internally to insert with RLS bypass.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

const FOUNDING_ACCESS_LIMIT = 100;
const FOUNDING_ACCESS_FREE_UNTIL = '2026-08-02';
const HARD_LIMIT_ISO = `${FOUNDING_ACCESS_FREE_UNTIL}T23:59:59.999Z`;

function calculateExpiry(start = new Date()): Date {
  const expires = new Date(start);
  expires.setDate(expires.getDate() + 14);
  const hardLimit = new Date(HARD_LIMIT_ISO);
  return expires > hardLimit ? hardLimit : expires;
}

function isAvailable(count: number, now = new Date()): boolean {
  return count < FOUNDING_ACCESS_LIMIT && now <= new Date(HARD_LIMIT_ISO);
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  let body: { company_name?: string; contact_email?: string; website_url?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }

  if (!body.company_name || !body.contact_email) {
    return jsonResponse({ error: 'company_name and contact_email are required' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return jsonResponse({ error: 'Supabase env vars missing on the function' }, 500);
  }

  const sb = createClient(url, serviceKey);

  const { count, error: countError } = await sb
    .from('enterprise_founders_access')
    .select('*', { count: 'exact', head: true });

  if (countError) return jsonResponse({ error: countError.message }, 500);

  const currentCount = count ?? 0;
  if (!isAvailable(currentCount)) {
    return jsonResponse({
      error: 'Founding Access is no longer available.',
      limit: FOUNDING_ACCESS_LIMIT,
      free_until: FOUNDING_ACCESS_FREE_UNTIL,
    }, 403);
  }

  const expiry = calculateExpiry();

  const { data, error } = await sb
    .from('enterprise_founders_access')
    .insert({
      company_name: body.company_name,
      contact_email: body.contact_email,
      website_url: body.website_url || null,
      access_expires_at: expiry.toISOString(),
      max_free_until: FOUNDING_ACCESS_FREE_UNTIL,
      feedback_required: true,
    })
    .select()
    .single();

  if (error) return jsonResponse({ error: error.message }, 500);

  return jsonResponse({
    ok: true,
    access: data,
    remaining_slots: FOUNDING_ACCESS_LIMIT - currentCount - 1,
  }, 200);
});

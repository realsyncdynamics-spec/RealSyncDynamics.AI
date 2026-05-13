// Enterprise AI OS — Founding Access POST endpoint.
//
// POST /functions/v1/enterprise-ai-os-founding-access
// Body: { company_name, contact_email, website_url? }
//
// Caps activations at 100 companies OR 2026-08-02, whichever comes first.
// Public/anon — uses service-role key internally to insert with RLS bypass.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const FOUNDING_ACCESS_LIMIT = 100;
const FOUNDING_ACCESS_FREE_UNTIL = '2026-08-02';
const HARD_LIMIT_ISO = `${FOUNDING_ACCESS_FREE_UNTIL}T23:59:59.999Z`;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function calculateExpiry(start = new Date()): Date {
  const expires = new Date(start);
  expires.setDate(expires.getDate() + 14);
  const hardLimit = new Date(HARD_LIMIT_ISO);
  return expires > hardLimit ? hardLimit : expires;
}

function isAvailable(count: number, now = new Date()): boolean {
  return count < FOUNDING_ACCESS_LIMIT && now <= new Date(HARD_LIMIT_ISO);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  let body: { company_name?: string; contact_email?: string; website_url?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  if (!body.company_name || !body.contact_email) {
    return json(400, { error: 'company_name and contact_email are required' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return json(500, { error: 'Supabase env vars missing on the function' });
  }

  const sb = createClient(url, serviceKey);

  const { count, error: countError } = await sb
    .from('enterprise_founders_access')
    .select('*', { count: 'exact', head: true });

  if (countError) return json(500, { error: countError.message });

  const currentCount = count ?? 0;
  if (!isAvailable(currentCount)) {
    return json(403, {
      error: 'Founding Access is no longer available.',
      limit: FOUNDING_ACCESS_LIMIT,
      free_until: FOUNDING_ACCESS_FREE_UNTIL,
    });
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

  if (error) return json(500, { error: error.message });

  return json(200, {
    ok: true,
    access: data,
    remaining_slots: FOUNDING_ACCESS_LIMIT - currentCount - 1,
  });
});

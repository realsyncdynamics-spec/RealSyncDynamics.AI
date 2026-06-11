// Beta-Programm — Bewerbung für 5 Founding Beta Plätze (12 Monate Enterprise).
//
// POST /functions/v1/beta-program-apply
// Body: {
//   company_name, contact_name, contact_email,
//   industry?, website_count?, current_stack?, pain_points?, motivation?
// }
//
// Cap bei 5 aktiven Bewerbungen (pending+approved+active zählen).
// Public/anon — Service-Role intern. Verbleibende Slots werden im Response
// zurückgegeben, damit die Landing einen Live-Counter anzeigen kann.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const BETA_PROGRAM_LIMIT = 5;
const BETA_PROGRAM_DURATION_DAYS = 365;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function calculateExpiry(start = new Date()): Date {
  return new Date(start.getTime() + BETA_PROGRAM_DURATION_DAYS * 24 * 60 * 60 * 1000);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  const company_name = hasText(body.company_name) ? body.company_name.trim() : '';
  const contact_name = hasText(body.contact_name) ? body.contact_name.trim() : '';
  const contact_email = hasText(body.contact_email) ? body.contact_email.trim() : '';

  if (!company_name || !contact_name || !contact_email) {
    return json(400, {
      error: 'company_name, contact_name and contact_email are required',
    });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return json(500, { error: 'Supabase env vars missing on the function' });
  }

  const sb = createClient(url, serviceKey);

  // Cap: pending + approved + active belegen Plätze; rejected nicht.
  const { count, error: countError } = await sb
    .from('beta_program_applications')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'approved', 'active']);

  if (countError) return json(500, { error: countError.message });

  const currentCount = count ?? 0;
  if (currentCount >= BETA_PROGRAM_LIMIT) {
    return json(403, {
      error: 'Beta-Programm ist voll. Alle 5 Plätze sind aktuell vergeben.',
      limit: BETA_PROGRAM_LIMIT,
      remaining_slots: 0,
    });
  }

  const website_count_raw = body.website_count;
  let website_count: number | null = null;
  if (typeof website_count_raw === 'number' && Number.isFinite(website_count_raw)) {
    website_count = Math.max(0, Math.floor(website_count_raw));
  } else if (typeof website_count_raw === 'string' && website_count_raw.trim() !== '') {
    const parsed = Number.parseInt(website_count_raw, 10);
    if (Number.isFinite(parsed)) website_count = Math.max(0, parsed);
  }

  const { data, error } = await sb
    .from('beta_program_applications')
    .insert({
      company_name,
      contact_name,
      contact_email,
      industry: hasText(body.industry) ? body.industry.trim() : null,
      website_count,
      current_stack: hasText(body.current_stack) ? body.current_stack.trim() : null,
      pain_points: hasText(body.pain_points) ? body.pain_points.trim() : null,
      motivation: hasText(body.motivation) ? body.motivation.trim() : null,
      status: 'pending',
      access_expires_at: calculateExpiry().toISOString(),
    })
    .select()
    .single();

  if (error) return json(500, { error: error.message });

  return json(200, {
    ok: true,
    application: data,
    remaining_slots: Math.max(BETA_PROGRAM_LIMIT - currentCount - 1, 0),
    limit: BETA_PROGRAM_LIMIT,
    duration_days: BETA_PROGRAM_DURATION_DAYS,
  });
});

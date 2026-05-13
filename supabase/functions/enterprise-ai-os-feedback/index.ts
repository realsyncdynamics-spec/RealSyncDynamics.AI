// Enterprise AI OS — Feedback POST endpoint.
//
// POST /functions/v1/enterprise-ai-os-feedback
// Body: { type, severity?, title, description, module?, screenshot_url?,
//         company_name?, contact_email?, founder_access_id? }
//
// Public/anon — uses service-role key internally to insert into the
// enterprise_feedback_reports table.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_TYPES = new Set([
  'bug', 'improvement', 'feature_request', 'security_issue', 'ux_feedback',
]);
const VALID_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
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

  const title = typeof body.title === 'string' ? body.title : '';
  const description = typeof body.description === 'string' ? body.description : '';
  const type = typeof body.type === 'string' ? body.type : '';

  if (!title || !description || !type) {
    return json(400, { error: 'title, description and type are required' });
  }
  if (!VALID_TYPES.has(type)) {
    return json(400, { error: `type must be one of ${[...VALID_TYPES].join(', ')}` });
  }

  const severity = typeof body.severity === 'string' ? body.severity : 'medium';
  if (!VALID_SEVERITIES.has(severity)) {
    return json(400, { error: `severity must be one of ${[...VALID_SEVERITIES].join(', ')}` });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return json(500, { error: 'Supabase env vars missing on the function' });
  }

  const sb = createClient(url, serviceKey);

  const { data, error } = await sb
    .from('enterprise_feedback_reports')
    .insert({
      type,
      severity,
      title,
      description,
      founder_access_id: typeof body.founder_access_id === 'string' ? body.founder_access_id : null,
      company_name: typeof body.company_name === 'string' ? body.company_name : null,
      contact_email: typeof body.contact_email === 'string' ? body.contact_email : null,
      screenshot_url: typeof body.screenshot_url === 'string' && body.screenshot_url ? body.screenshot_url : null,
      module: typeof body.module === 'string' && body.module ? body.module : null,
    })
    .select()
    .single();

  if (error) return json(500, { error: error.message });

  return json(200, { ok: true, feedback: data });
});

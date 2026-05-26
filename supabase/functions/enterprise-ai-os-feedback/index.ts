// Enterprise AI OS — Feedback POST endpoint mit strukturierter Triage.
//
// POST /functions/v1/enterprise-ai-os-feedback
// Body: {
//   type, severity?, title, description,
//   module?, location?, expected_behavior?, actual_behavior?, steps_to_reproduce?,
//   screenshot_url?, page_url?, user_agent?, viewport?,
//   company_name?, contact_email?, founder_access_id?
// }
//
// Public/anon — uses service-role key internally. Berechnet `priority`,
// `triage_score` und `tags` deterministisch (Heuristik gespiegelt aus
// src/lib/enterprise-ai-os/feedback-triage.ts — Deno-Edge-Functions können
// nicht aus src/ importieren).

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

const SEVERITY_BASE: Record<string, number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};

const COMPLIANCE_KEYWORDS = ['ai act', 'aiact', 'dsgvo', 'gdpr', 'governance', 'evidence'];

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pickString(body: Record<string, unknown>, key: string): string | null {
  const v = body[key];
  return hasText(v) ? v : null;
}

function priorityFromScore(score: number): 'p0' | 'p1' | 'p2' | 'p3' {
  if (score >= 90) return 'p0';
  if (score >= 65) return 'p1';
  if (score >= 40) return 'p2';
  return 'p3';
}

interface TriageInput {
  type: string;
  severity: string;
  module: string | null;
  location: string | null;
  steps_to_reproduce: string | null;
  screenshot_url: string | null;
  page_url: string | null;
}

function computeTriage(input: TriageInput): {
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  triage_score: number;
  tags: string[];
} {
  let score = SEVERITY_BASE[input.severity] ?? 50;
  const tags: string[] = [];

  if (input.type === 'security_issue') {
    score += 15;
    tags.push('security');
  }

  if (input.type === 'bug' && hasText(input.steps_to_reproduce)) {
    score += 10;
    tags.push('reproducible');
  }

  if (input.type === 'bug' && !hasText(input.screenshot_url)) {
    tags.push('needs-screenshot');
  }

  if (hasText(input.screenshot_url)) {
    score += 5;
  }

  const haystack = [input.module, input.location, input.page_url]
    .filter(hasText)
    .map((v) => (v as string).toLowerCase().replace(/[-_/]+/g, ' '))
    .join(' ');
  if (COMPLIANCE_KEYWORDS.some((kw) => haystack.includes(kw))) {
    score += 10;
    tags.push('compliance');
  }

  if (input.type === 'feature_request') tags.push('product-input');
  if (input.type === 'ux_feedback') tags.push('ux');

  const clamped = Math.max(0, Math.min(100, score));
  return { priority: priorityFromScore(clamped), triage_score: clamped, tags };
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  const title = pickString(body, 'title') ?? '';
  const description = pickString(body, 'description') ?? '';
  const type = pickString(body, 'type') ?? '';

  if (!title || !description || !type) {
    return json(400, { error: 'title, description and type are required' });
  }
  if (!VALID_TYPES.has(type)) {
    return json(400, { error: `type must be one of ${[...VALID_TYPES].join(', ')}` });
  }

  const severity = pickString(body, 'severity') ?? 'medium';
  if (!VALID_SEVERITIES.has(severity)) {
    return json(400, { error: `severity must be one of ${[...VALID_SEVERITIES].join(', ')}` });
  }

  const module_ = pickString(body, 'module');
  const location = pickString(body, 'location');
  const expected_behavior = pickString(body, 'expected_behavior');
  const actual_behavior = pickString(body, 'actual_behavior');
  const steps_to_reproduce = pickString(body, 'steps_to_reproduce');
  const screenshot_url = pickString(body, 'screenshot_url');
  const page_url = pickString(body, 'page_url');
  const user_agent = pickString(body, 'user_agent');
  const viewport = pickString(body, 'viewport');

  const triage = computeTriage({
    type,
    severity,
    module: module_,
    location,
    steps_to_reproduce,
    screenshot_url,
    page_url,
  });

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
      founder_access_id: pickString(body, 'founder_access_id'),
      company_name: pickString(body, 'company_name'),
      contact_email: pickString(body, 'contact_email'),
      screenshot_url,
      module: module_,
      location,
      expected_behavior,
      actual_behavior,
      steps_to_reproduce,
      page_url,
      user_agent,
      viewport,
      priority: triage.priority,
      triage_score: triage.triage_score,
      tags: triage.tags,
    })
    .select()
    .single();

  if (error) return json(500, { error: error.message });

  return json(200, { ok: true, feedback: data, triage });
});

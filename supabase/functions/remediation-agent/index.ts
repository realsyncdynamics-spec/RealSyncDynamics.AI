// Developer Remediation Agent — Edge Function.
//
// POST /functions/v1/remediation-agent
// Authorization: Bearer <user JWT>
// Body: { op, tenant_id, ... }
//
// Ops:
//   - create_remediation_plan   { tenant_id, finding_id, evidence_id?,
//                                  target: { system, technology,
//                                            repository?, finding_text } }
//   - generate_fix_snippet      { tenant_id, plan_id }
//   - prepare_github_issue      { tenant_id, plan_id }
//   - prepare_pr_comment        { tenant_id, plan_id, hunk_context? }
//
// Strict review-bounded agent. Every output surfaces with
// `review_required: true`. The function:
//   - validates auth via Bearer JWT,
//   - confirms tenant membership,
//   - reads finding/evidence ONLY tenant-scoped,
//   - calls ai-gateway with model_profile = 'strict-json',
//   - validates the JSON shape against an explicit schema sketch,
//   - persists to remediation_plans + remediation_agent_events,
//   - never calls GitHub / Git / deployment APIs.
//
// Conforms to ACS v1.0 + CPS v1.0 (trust_level: prepare).
// Agent contract: src/runtime/agents/developerRemediationAgent.contract.ts

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const ALLOWED_OPS = new Set([
  'create_remediation_plan',
  'generate_fix_snippet',
  'prepare_github_issue',
  'prepare_pr_comment',
]);

const AFFECTED_SYSTEMS = new Set([
  'website', 'api', 'edge_function', 'ci_cd', 'consent_layer', 'unknown',
]);
const TECHNOLOGIES = new Set([
  'react', 'vite', 'nginx', 'apache', 'cloudflare', 'vercel', 'supabase', 'unknown',
]);

interface SupabaseAdminClient {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): {
        eq(col2: string, val2: unknown): {
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
    insert(row: Record<string, unknown>): {
      select(columns?: string): Promise<{ data: unknown; error: unknown }>;
    };
    update(row: Record<string, unknown>): {
      eq(col: string, val: unknown): Promise<{ error: unknown }>;
    };
  };
}

// ── HTTP entrypoint ────────────────────────────────────────────────

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST')    return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const op = String(body.op ?? '');
  if (!ALLOWED_OPS.has(op)) {
    return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`);
  }

  // Auth — Bearer required.
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth:   { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  }
  const userId = userResp.user.id;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const tenant_id = String(body.tenant_id ?? '');
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  // Tenant membership check.
  const { data: mem } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenant_id).eq('user_id', userId).maybeSingle();
  if (!mem) return jsonError(403, 'FORBIDDEN', 'no membership in this tenant');

  try {
    switch (op) {
      case 'create_remediation_plan':
        return await handleCreatePlan(admin, tenant_id, userId, body);
      case 'generate_fix_snippet':
        return await handleGenerateSnippet(admin, tenant_id, userId, body);
      case 'prepare_github_issue':
        return await handlePrepareIssue(admin, tenant_id, userId, body);
      case 'prepare_pr_comment':
        return await handlePrepareComment(admin, tenant_id, userId, body);
      default:
        return jsonError(400, 'BAD_REQUEST', `unhandled op: ${op}`);
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

// ── op: create_remediation_plan ────────────────────────────────────

interface PlanPayload {
  summary:    string;
  steps:      Array<{ title: string; detail: string }>;
  snippets:   Array<{ path: string; language: string; content: string; notes: string }>;
  confidence: number;
}

// deno-lint-ignore no-explicit-any
async function handleCreatePlan(admin: SupabaseAdminClient, tenant_id: string, userId: string, body: Record<string, unknown>): Promise<Response> {
  const finding_id  = String(body.finding_id ?? '');
  const evidence_id = body.evidence_id ? String(body.evidence_id) : null;
  if (!finding_id) return jsonError(400, 'BAD_REQUEST', 'finding_id required');

  const target = (body.target ?? {}) as Record<string, unknown>;
  const system     = String(target.system     ?? 'unknown');
  const technology = String(target.technology ?? 'unknown');
  if (!AFFECTED_SYSTEMS.has(system))  return jsonError(400, 'BAD_REQUEST', `invalid system: ${system}`);
  if (!TECHNOLOGIES.has(technology))  return jsonError(400, 'BAD_REQUEST', `invalid technology: ${technology}`);

  const findingText = typeof target.finding_text === 'string' ? target.finding_text : '';

  // Call ai-gateway for structured plan output.
  const plan = await aiGenerate<PlanPayload>({
    feature:    'remediation_agent_plan',
    task_type:  'remediation_plan',
    system:     CREATE_PLAN_SYSTEM_PROMPT,
    user_input: `Affected system: ${system}\nTechnology: ${technology}\n\nFinding:\n${findingText}`,
    validator:  validatePlanPayload,
  });

  // Persist plan.
  const { data: row, error: insErr } = await admin
    .from('remediation_plans')
    .insert({
      tenant_id,
      finding_id,
      evidence_id,
      status:          'review_required',
      affected_system: system,
      technology,
      summary:         plan.summary,
      steps:           plan.steps,
      snippets:        plan.snippets,
      confidence:      Math.max(0, Math.min(1, plan.confidence)),
      review_required: true,
      created_by:      userId,
    })
    .select('*')
    .single();
  if (insErr) return jsonError(500, 'DB_INSERT_FAILED', insErr.message);

  await emitEvent(admin, tenant_id, row.id, userId, 'remediation.plan.created', { plan });
  await emitEvent(admin, tenant_id, row.id, userId, 'remediation.review_required', {
    reviewer_roles: ['owner', 'admin', 'developer', 'technical_owner'],
  });

  return jsonResponse({
    ok: true,
    event_type: 'remediation.plan.created',
    review_required: true,
    plan: {
      id:               row.id,
      summary:          row.summary,
      steps:            row.steps,
      snippets:         row.snippets,
      confidence:       Number(row.confidence),
      status:           row.status,
      affected_system:  row.affected_system,
      technology:       row.technology,
      created_at:       row.created_at,
    },
  });
}

const CREATE_PLAN_SYSTEM_PROMPT = `Du bist der Developer Remediation Agent für DSGVO-/AI-Act-Compliance.

Aufgabe: Erzeuge einen kompakten, umsetzbaren Maßnahmenplan zu dem genannten Befund.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON. Kein Markdown-Wrapper.
- Schema: {
    "summary": string (1-2 Sätze),
    "steps": [ { "title": string, "detail": string } ] (3-6 Einträge),
    "snippets": [ { "path": string, "language": string, "content": string, "notes": string } ] (0-3 Einträge),
    "confidence": number (0.0 - 1.0)
  }
- snippets[].content: maximal 30 Zeilen, produktionsreif, kein Beispiel-Output.
- snippets[].notes: 1-2 Sätze, warum das den Befund behebt.
- Keine Rechtsberatung, keine "Beratung", nur technische Umsetzung.
- Du DARFST NICHT vorschlagen: mergen, deployen, Secrets ändern.`;

function validatePlanPayload(raw: unknown): PlanPayload {
  if (!raw || typeof raw !== 'object') throw new Error('plan must be an object');
  const r = raw as Record<string, unknown>;
  const summary = String(r.summary ?? '').trim();
  if (!summary) throw new Error('plan.summary missing');

  const stepsRaw = Array.isArray(r.steps) ? r.steps : [];
  const steps = stepsRaw.map((s, i) => {
    const o = s as Record<string, unknown>;
    return { title: String(o.title ?? `Schritt ${i + 1}`), detail: String(o.detail ?? '') };
  });

  const snippetsRaw = Array.isArray(r.snippets) ? r.snippets : [];
  const snippets = snippetsRaw.map((s) => {
    const o = s as Record<string, unknown>;
    return {
      path:     String(o.path     ?? ''),
      language: String(o.language ?? 'text'),
      content:  String(o.content  ?? ''),
      notes:    String(o.notes    ?? ''),
    };
  });

  const conf = Number(r.confidence);
  const confidence = Number.isFinite(conf) ? conf : 0.5;

  return { summary, steps, snippets, confidence };
}

// ── op: generate_fix_snippet ───────────────────────────────────────

interface SnippetPayload {
  path:     string;
  language: string;
  content:  string;
  notes:    string;
}

// deno-lint-ignore no-explicit-any
async function handleGenerateSnippet(admin: SupabaseAdminClient, tenant_id: string, userId: string, body: Record<string, unknown>): Promise<Response> {
  const plan_id = String(body.plan_id ?? '');
  if (!plan_id) return jsonError(400, 'BAD_REQUEST', 'plan_id required');

  const { data: plan } = await admin.from('remediation_plans')
    .select('*').eq('id', plan_id).eq('tenant_id', tenant_id).maybeSingle();
  if (!plan) return jsonError(404, 'NOT_FOUND', 'plan not found');

  const snippet = await aiGenerate<SnippetPayload>({
    feature:    'remediation_agent_snippet',
    task_type:  'fix_snippet',
    system:     SNIPPET_SYSTEM_PROMPT,
    user_input: `Plan-Zusammenfassung: ${plan.summary}\nTechnologie: ${plan.technology}\nSystem: ${plan.affected_system}\n\nErzeuge EINEN zusätzlichen, granularen Snippet zur Konkretisierung.`,
    validator:  validateSnippetPayload,
  });

  const next = [...(plan.snippets ?? []), snippet];
  const { error: updErr } = await admin.from('remediation_plans')
    .update({ snippets: next })
    .eq('id', plan_id).eq('tenant_id', tenant_id);
  if (updErr) return jsonError(500, 'DB_UPDATE_FAILED', updErr.message);

  await emitEvent(admin, tenant_id, plan_id, userId, 'fix.snippet.generated', { snippet });

  return jsonResponse({
    ok: true,
    event_type: 'fix.snippet.generated',
    review_required: true,
    snippet,
  });
}

const SNIPPET_SYSTEM_PROMPT = `Du bist der Developer Remediation Agent.

Aufgabe: Erzeuge EINEN kopierfähigen Code-/Config-Snippet zum gegebenen Remediation-Plan.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON.
- Schema: { "path": string, "language": string, "content": string, "notes": string }
- content: max 30 Zeilen, produktionsreif.
- notes: 1-2 Sätze.
- Keine Auto-Apply-Logik, keine destructive Operationen, keine Secret-Reads/Writes.`;

function validateSnippetPayload(raw: unknown): SnippetPayload {
  if (!raw || typeof raw !== 'object') throw new Error('snippet must be an object');
  const r = raw as Record<string, unknown>;
  return {
    path:     String(r.path     ?? ''),
    language: String(r.language ?? 'text'),
    content:  String(r.content  ?? ''),
    notes:    String(r.notes    ?? ''),
  };
}

// ── op: prepare_github_issue ───────────────────────────────────────

interface IssuePayload {
  title: string;
  body:  string;
  labels: string[];
}

// deno-lint-ignore no-explicit-any
async function handlePrepareIssue(admin: SupabaseAdminClient, tenant_id: string, userId: string, body: Record<string, unknown>): Promise<Response> {
  const plan_id = String(body.plan_id ?? '');
  if (!plan_id) return jsonError(400, 'BAD_REQUEST', 'plan_id required');

  const { data: plan } = await admin.from('remediation_plans')
    .select('*').eq('id', plan_id).eq('tenant_id', tenant_id).maybeSingle();
  if (!plan) return jsonError(404, 'NOT_FOUND', 'plan not found');

  const issue = await aiGenerate<IssuePayload>({
    feature:    'remediation_agent_issue',
    task_type:  'github_issue',
    system:     ISSUE_SYSTEM_PROMPT,
    user_input: `Plan: ${plan.summary}\nSchritte: ${JSON.stringify(plan.steps)}`,
    validator:  validateIssuePayload,
  });

  await emitEvent(admin, tenant_id, plan_id, userId, 'github.issue.prepared', { issue });

  return jsonResponse({
    ok: true,
    event_type: 'github.issue.prepared',
    review_required: true,
    issue,
    note: 'This is a draft payload. The agent does NOT call the GitHub API.',
  });
}

const ISSUE_SYSTEM_PROMPT = `Du bist der Developer Remediation Agent.

Aufgabe: Erzeuge einen GitHub-Issue-Entwurf zu dem Remediation-Plan.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON.
- Schema: { "title": string (max 80 Zeichen), "body": markdown string, "labels": string[] }
- body: Markdown mit Abschnitten "Befund", "Vorgeschlagene Schritte", "Review erforderlich".
- Hinweis im body: "Dieser Issue ist ein VORSCHLAG. Vor dem Erstellen MUSS ein Reviewer freigeben."
- labels: zwischen 1 und 4, lowercase mit Bindestrich.`;

function validateIssuePayload(raw: unknown): IssuePayload {
  if (!raw || typeof raw !== 'object') throw new Error('issue must be an object');
  const r = raw as Record<string, unknown>;
  const labels = Array.isArray(r.labels) ? r.labels.map((l) => String(l)) : [];
  return {
    title:  String(r.title ?? '').slice(0, 80),
    body:   String(r.body  ?? ''),
    labels: labels.slice(0, 8),
  };
}

// ── op: prepare_pr_comment ─────────────────────────────────────────

interface PrCommentPayload {
  body: string;
}

// deno-lint-ignore no-explicit-any
async function handlePrepareComment(admin: SupabaseAdminClient, tenant_id: string, userId: string, body: Record<string, unknown>): Promise<Response> {
  const plan_id = String(body.plan_id ?? '');
  if (!plan_id) return jsonError(400, 'BAD_REQUEST', 'plan_id required');

  const hunk_context = typeof body.hunk_context === 'string' ? body.hunk_context : '';

  const { data: plan } = await admin.from('remediation_plans')
    .select('*').eq('id', plan_id).eq('tenant_id', tenant_id).maybeSingle();
  if (!plan) return jsonError(404, 'NOT_FOUND', 'plan not found');

  const comment = await aiGenerate<PrCommentPayload>({
    feature:    'remediation_agent_pr_comment',
    task_type:  'pr_comment',
    system:     COMMENT_SYSTEM_PROMPT,
    user_input: `Plan: ${plan.summary}\nHunk-Kontext:\n${hunk_context || '(none)'}`,
    validator:  validateCommentPayload,
  });

  await emitEvent(admin, tenant_id, plan_id, userId, 'pull_request.comment.created', { comment });

  return jsonResponse({
    ok: true,
    event_type: 'pull_request.comment.created',
    review_required: true,
    comment,
    note: 'Draft comment text only. The agent does NOT post to GitHub.',
  });
}

const COMMENT_SYSTEM_PROMPT = `Du bist der Developer Remediation Agent.

Aufgabe: Schreibe einen knappen, sachlichen Pull-Request-Kommentar zum gegebenen Hunk.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON.
- Schema: { "body": string }
- body: 2-5 Sätze, höflich, technisch konkret, keine Rechtsberatung.
- Schließe mit "Review erforderlich vor Apply."`;

function validateCommentPayload(raw: unknown): PrCommentPayload {
  if (!raw || typeof raw !== 'object') throw new Error('comment must be an object');
  const r = raw as Record<string, unknown>;
  return { body: String(r.body ?? '') };
}

// ── AI Gateway call helper ─────────────────────────────────────────

interface AiCallArgs<T> {
  feature:    string;
  task_type:  string;
  system:     string;
  user_input: string;
  validator:  (raw: unknown) => T;
}

async function aiGenerate<T>(args: AiCallArgs<T>): Promise<T> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
    method: 'POST',
    headers: {
      'content-type':  'application/json',
      'authorization': `Bearer ${ANON}`,
      'apikey':         ANON,
    },
    body: JSON.stringify({
      op:            'extract_json',
      feature:        args.feature,
      task_type:      args.task_type,
      model_profile: 'strict-json',
      input: {
        system: args.system,
        user:   args.user_input,
      },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`ai-gateway ${resp.status}: ${txt.slice(0, 200)}`);
  }

  const json = await resp.json() as { ok?: boolean; output?: unknown; error?: { message: string } };
  if (!json.ok) throw new Error(json.error?.message ?? 'ai-gateway returned not-ok');
  if (json.output === undefined) throw new Error('ai-gateway returned no output');

  // The gateway may return either a parsed object (extract_json) or a
  // string. Be defensive about both.
  let parsed: unknown = json.output;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); }
    catch { throw new Error('ai-gateway output is not valid JSON'); }
  }

  return args.validator(parsed);
}

// ── Event helper ───────────────────────────────────────────────────

async function emitEvent(
  admin: SupabaseAdminClient,
  tenant_id: string,
  remediation_plan_id: string | null,
  userId: string,
  event_type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await admin.from('remediation_agent_events').insert({
    tenant_id,
    remediation_plan_id,
    event_type,
    payload,
    created_by: userId,
  });
}

// ── Response helpers ───────────────────────────────────────────────

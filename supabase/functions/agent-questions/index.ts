/**
 * agent-questions — M3 Adapter für Agenten.
 *
 * Läuft ausschließlich mit dem JWT des Aufrufers (kein service_role):
 * RLS von agent_questions / agent_decisions entscheidet über Mandantenzugriff.
 *
 *   GET                         → offene Fragen (RLS-gefiltert)
 *   GET ?question_id=…          → Rückmeldung: Status, Entscheidung, Audit (M4)
 *   GET ?precedents=…           → frühere Entscheidungen als Hinweis, keine Freigabe (M7)
 *   POST { action: 'ask', … }   → Frage anlegen (Status immer 'open')
 *   POST { action: 'propose', question_id, proposal }
 *                               → max. 3 begründete Optionen als agent_decisions
 *                                 (Status 'proposed'), über decision_id verknüpft.
 *
 * Kein Auto-Approve: Dieser Endpunkt kann keine Entscheidung freigeben.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import { requiredApprovalLevel, toAgentDecisionInsert, validateProposal, type DecisionProposal } from '../_shared/decision-proposal.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3']);

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: u, error: uErr } = await db.auth.getUser();
  if (uErr || !u?.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  if (req.method === 'GET') {
    // Rückmeldung an Agenten (M4): Status einer eigenen Frage inkl. Entscheidung und Audit.
    // Präzedenzfälle (M7): frühere Entscheidungen als Hinweis — ausdrücklich keine Freigabe.
    const precedentsQ = new URL(req.url).searchParams.get('precedents');
    if (precedentsQ !== null) {
      if (precedentsQ.trim().length < 3 || precedentsQ.length > 500) return jsonError(400, 'BAD_REQUEST', 'precedents: 3–500 Zeichen');
      const { data, error } = await db.rpc('search_agent_knowledge', {
        p_query: precedentsQ, p_kinds: ['decision'], p_limit: 10, p_match_any: true,
      });
      if (error) return jsonError(500, 'SEARCH_FAILED', 'Präzedenzsuche fehlgeschlagen');
      return jsonResponse({ precedents: data ?? [], precedent_only: true, not_an_approval: true });
    }
    const questionId = new URL(req.url).searchParams.get('question_id');
    if (questionId) {
      const { data: q, error: qe } = await db.from('agent_questions')
        .select('id,status,resolution_note,resolved_at,decision_id').eq('id', questionId).maybeSingle();
      if (qe || !q) return jsonError(404, 'NOT_FOUND', 'Frage nicht gefunden oder kein Zugriff');
      let decision = null;
      let approvals: unknown[] = [];
      if (q.decision_id) {
        decision = (await db.from('agent_decisions').select('id,status,recommendation,approved_at')
          .eq('id', q.decision_id).maybeSingle()).data;
        approvals = (await db.from('agent_decision_approvals')
          .select('action,chosen_option,chosen_label,approval_level,note,created_at')
          .eq('decision_id', q.decision_id).order('created_at')).data ?? [];
      }
      return jsonResponse({ question: q, decision, approvals });
    }
    const { data, error } = await db.from('agent_questions')
      .select('id,tenant_id,agent_ref,task_ref,milestone,project,question,priority,status,decision_id,is_demo,created_at')
      .eq('status', 'open').order('created_at').limit(200);
    if (error) return jsonError(400, 'QUERY_FAILED', error.message);
    return jsonResponse({ questions: data });
  }
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'GET or POST');

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_JSON', 'invalid json'); }

  if (body.action === 'ask') {
    const priority = String(body.priority ?? 'P2');
    if (!PRIORITIES.has(priority)) return jsonError(400, 'BAD_PRIORITY', 'P0–P3');
    if (typeof body.tenant_id !== 'string' || typeof body.agent_ref !== 'string' || typeof body.question !== 'string') {
      return jsonError(400, 'BAD_REQUEST', 'tenant_id, agent_ref, question erforderlich');
    }
    const { data, error } = await db.from('agent_questions').insert({
      tenant_id: body.tenant_id, agent_ref: body.agent_ref, question: body.question,
      context: typeof body.context === 'string' ? body.context : null,
      task_ref: typeof body.task_ref === 'string' ? body.task_ref : null,
      milestone: typeof body.milestone === 'string' ? body.milestone : null,
      project: typeof body.project === 'string' ? body.project : null,
      priority, dedupe_key: typeof body.dedupe_key === 'string' ? body.dedupe_key : '',
      is_demo: body.is_demo === true,
    }).select('id,status,dedupe_key').single();
    if (error) return jsonError(403, 'INSERT_DENIED', error.message);
    return jsonResponse({ question: data }, 201);
  }

  if (body.action === 'propose') {
    const proposal = body.proposal as DecisionProposal;
    const v = validateProposal(proposal);
    if (!v.ok) return jsonError(400, 'BAD_PROPOSAL', v.error);
    const { data: q, error: qErr } = await db.from('agent_questions')
      .select('id,tenant_id,agent_ref,question,context,status,decision_id').eq('id', String(body.question_id)).maybeSingle();
    if (qErr || !q) return jsonError(404, 'NOT_FOUND', 'Frage nicht gefunden oder kein Zugriff');
    if (q.status !== 'open') return jsonError(409, 'NOT_OPEN', 'Frage ist nicht offen');
    const insert = toAgentDecisionInsert({
      tenantId: q.tenant_id, question: q.question, context: q.context, proposedBy: q.agent_ref, proposal,
    });
    const { data: dec, error: dErr } = await db.from('agent_decisions').insert(insert).select('id,status').single();
    if (dErr) return jsonError(403, 'DECISION_DENIED', dErr.message);
    const { error: lErr } = await db.from('agent_questions').update({ decision_id: dec.id }).eq('id', q.id);
    if (lErr) return jsonError(403, 'LINK_DENIED', lErr.message);
    return jsonResponse({
      decision: dec,
      required_approval: requiredApprovalLevel(`${q.question} ${q.context ?? ''}`, insert.reversibility),
      note: 'Vorschlag ist keine Freigabe.',
    }, 201);
  }
  return jsonError(400, 'UNKNOWN_ACTION', "action: 'ask' | 'propose'");
});

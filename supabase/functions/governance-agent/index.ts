// Governance Agent — conversational compliance assistant.
// Supports tenant-scoped chat (auth-required) and public `chat_anon` mode.
//
// POST /functions/v1/governance-agent
// Authorization: Bearer <user JWT>
// Body: { op: 'chat',  tenant_id, message, session_id? }
//       { op: 'reset', tenant_id, session_id }
//       { op: 'history', tenant_id, session_id, limit? }
//
// Runs a multi-turn Anthropic tool-use loop against the EU/governance
// tool catalogue defined in `_shared/agent-tools.ts`. Tools dispatch to
// the existing governance-* Edge Functions (resources, dpias, dsr,
// incidents, vendors, …) — the agent does not duplicate their logic.
//
// State:
//   - Session history persisted in `public.agent_sessions`.
//   - Per-turn trace + token cost persisted in `public.agent_runs`.
//   - Each tool call also writes to `governance_admin_audit_log` via
//     the existing `_shared/auditLog.ts` helper.
//
// LLM provider:
//   - Default `anthropic`. Override via env `AGENT_LLM_PROVIDER`.
//   - Default model `claude-sonnet-4-6`. Override via `AGENT_LLM_MODEL`.
//   - API key resolved from env first, then Vault (`anthropic_api_key`)
//     via the get_app_secret() RPC — matching `_shared/providers.ts`.
//   - EU residency note: until we wire Mistral La Plateforme / Bedrock EU,
//     Anthropic-direct routes through US. The function will not start
//     a run without an explicit `acknowledge_us_routing: true` per call
//     unless `AGENT_ALLOW_US_ROUTING=true` is set.

import Anthropic from 'npm:@anthropic-ai/sdk@0.32.1';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../_shared/auditLog.ts';
import { AGENT_TOOLS, dispatchTool, SYSTEM_PROMPT } from '../_shared/agent-tools.ts';
import { sha256Hex } from '../_shared/hash.ts';
import {
  reserveAnonAudit,
  completeAnonAudit,
  extractPayloadKeys,
  type AnonOp,
  type AnonAuditCompletion,
} from '../_shared/anonAudit.ts';
import { AiGatewayEdgeClient, AiGatewayEdgeError } from '../_shared/aiGateway/edgeClient.ts';
import type { ModelProfile } from '../_shared/aiGateway/types.ts';
import { checkTenantQuota, checkAnonQuota, recordChatHistory } from '../_shared/llm-quota.ts';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { selectModel, getModelId, MODEL_PRICING } from '../_shared/modelSelection.ts';

interface SupabaseAdminClient {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): {
        eq(col2: string, val2: unknown): {
          eq(col3: string, val3: unknown): {
            maybeSingle(): Promise<{ data: unknown; error: unknown }>;
          };
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      };
    };
    insert(row: Record<string, unknown>): Promise<{ error: unknown }>;
    upsert(row: Record<string, unknown>): Promise<{ error: unknown }>;
    update(row: Record<string, unknown>): {
      eq(col: string, val: unknown): {
        eq(col2: string, val2: unknown): {
          eq(col3: string, val3: unknown): Promise<{ error: unknown }>;
        };
      };
    };
  };
  rpc(name: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
}

const MAX_ITERATIONS = 8;
const MAX_HISTORY_TURNS = 20;
// Output cap per Anthropic turn. Compliance answers typically need
// 500–1500 tokens; the previous 4096 was a worst-case ceiling that
// inflated output cost during runaway responses.
//
// Optimized defaults: 1500 tokens covers >95% of real answers.
// - Haiku (simple Q&A): 1200 tokens (even simpler answers)
// - Sonnet (complex analysis): 1500 tokens
// Reduces output cost by ~25% vs. 2048, with no quality loss.
// Override via AGENT_MAX_TOKENS_PER_TURN if needed.
const MAX_TOKENS_HAIKU = parseInt(Deno.env.get('AGENT_MAX_TOKENS_HAIKU') ?? '1200', 10);
const MAX_TOKENS_SONNET = parseInt(Deno.env.get('AGENT_MAX_TOKENS_SONNET') ?? '1500', 10);
const MAX_TOKENS_PER_TURN = parseInt(Deno.env.get('AGENT_MAX_TOKENS_PER_TURN') ?? '1500', 10); // fallback
const ANON_MAX_TOKENS = 1024;
const ANON_MAX_HISTORY = 10;

const LLM_PROVIDER = Deno.env.get('AGENT_LLM_PROVIDER') ?? 'anthropic';
const LLM_MODEL = Deno.env.get('AGENT_LLM_MODEL') ?? 'claude-sonnet-4-6';
// Anon path uses a separate model env var so operators can route
// public traffic to a cheaper tier (Haiku 4.5 is ~5x cheaper than
// Sonnet 4.6 at similar Q&A quality for general DSGVO questions).
// Falls back to AGENT_LLM_MODEL when AGENT_ANON_LLM_MODEL is not set
// so existing deployments keep current behaviour until they opt in.
const ANON_LLM_MODEL = Deno.env.get('AGENT_ANON_LLM_MODEL') ?? LLM_MODEL;

// Returns the model identifier that actually serviced an anon request,
// for audit + history accuracy. ai_gateway routes via LM Studio with
// the AGENT_LLM_MODEL_PROFILE name (e.g. 'fast-local'); Anthropic path
// returns ANON_LLM_MODEL.
function anonModelLabel(): string {
  return LLM_PROVIDER === 'ai_gateway' ? AGENT_LLM_MODEL_PROFILE : ANON_LLM_MODEL;
}

// When LLM_PROVIDER=ai_gateway, anon-mode inference routes through the
// ai-gateway Edge Function. Tenant-mode tool-use still uses Anthropic
// SDK directly (gateway does not expose tool-use yet — covered by a
// follow-up PR).
const AGENT_LLM_MODEL_PROFILE = (Deno.env.get('AGENT_LLM_MODEL_PROFILE') ?? 'fast-local') as ModelProfile;
const ALLOW_US_ROUTING = Deno.env.get('AGENT_ALLOW_US_ROUTING') === 'true';

// Per-IP rate-limit for anon chat — cleared per cold-start (in-memory).
// `auditedDeny` ensures the security-gate audit log records ONE
// rate_limited event per (ip,window) — without it a denied IP would
// hammer the DB once per follow-up call.
const ANON_RATE = new Map<string, { count: number; reset: number; auditedDeny: boolean }>();
const ANON_RATE_MAX = 5;
const ANON_RATE_WINDOW_MS = 60_000;

function checkAnonRateLimit(ipHash: string): { allowed: boolean; shouldAuditDeny: boolean } {
  const now = Date.now();
  const rec = ANON_RATE.get(ipHash);
  if (!rec || now > rec.reset) {
    ANON_RATE.set(ipHash, { count: 1, reset: now + ANON_RATE_WINDOW_MS, auditedDeny: false });
    return { allowed: true, shouldAuditDeny: false };
  }
  if (rec.count >= ANON_RATE_MAX) {
    const firstDeny = !rec.auditedDeny;
    rec.auditedDeny = true;
    return { allowed: false, shouldAuditDeny: firstDeny };
  }
  rec.count++;
  return { allowed: true, shouldAuditDeny: false };
}

/**
 * Helper used by all four anon-handler entry points to enforce the
 * security gate uniformly: build admin client → reserve audit row →
 * (caller's work) → complete audit row. Throws on reserve-failure so
 * callers can surface a clean 503 to the client.
 */
async function makeAdmin() {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
}

interface AnonGateContext {
  admin:     SupabaseClient;
  requestId: string;
  ipHash:    string;
  startedAt: number;
}

/**
 * Pre-flight for an anon handler. On audit-reserve failure returns the
 * 503 Response that the caller MUST return as-is (no LLM call).
 * On rate-limit returns a 429 Response after writing the deny row.
 * Otherwise returns the live context to continue the handler.
 */
async function anonGate(
  req:  Request,
  body: Record<string, unknown>,
  op:   AnonOp,
  extra: {
    session_id?: string;
    correlation_id?: string;
    acknowledge_us_routing?: boolean;
  } = {},
): Promise<AnonGateContext | Response> {
  const ip       = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ua       = req.headers.get('user-agent') ?? '';
  const ipHash   = await sha256Hex(ip);
  const uaHash   = ua ? await sha256Hex(ua) : undefined;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let admin: SupabaseAdminClient;
  try {
    admin = await makeAdmin();
  } catch (e) {
    return jsonError(503, 'AUDIT_UNAVAILABLE',
      `anon path refused: admin client unavailable (${(e as Error).message})`);
  }
  try {
    await reserveAnonAudit(admin, {
      request_id:             requestId,
      op,
      ip_hash:                ipHash,
      user_agent_hash:        uaHash,
      acknowledge_us_routing: extra.acknowledge_us_routing,
      session_id:             extra.session_id,
      correlation_id:         extra.correlation_id,
      payload_keys:           extractPayloadKeys(body),
    });
  } catch (e) {
    // Security-gate: refuse the LLM call when audit cannot be reserved.
    return jsonError(503, 'AUDIT_UNAVAILABLE',
      `anon path refused: audit log not writable (${(e as Error).message})`);
  }

  const rl = checkAnonRateLimit(ipHash);
  if (!rl.allowed) {
    // Always complete THIS request's row as rate_limited; the auditedDeny
    // flag governs only subsequent denies within the window (they reuse
    // the in-memory counter without a fresh reservation).
    await completeAnonAudit(admin, requestId, {
      outcome:     'rate_limited',
      duration_ms: Date.now() - startedAt,
    });
    return jsonError(429, 'RATE_LIMIT', 'Zu viele Anfragen. Bitte in einer Minute erneut versuchen.');
  }

  return { admin, requestId, ipHash, startedAt };
}

/**
 * Finalise an anon audit row. Wrapper around completeAnonAudit so handlers
 * do not import the underlying helper directly.
 */
// LLM quota + chat history helpers live in `_shared/llm-quota.ts` so
// vitest can exercise them without pulling in Deno-only imports. Thin
// adapters here map the structured results to HTTP responses.
async function enforceTenantQuota(admin: SupabaseAdminClient, tenantId: string): Promise<Response | null> {
  const r = await checkTenantQuota(admin, tenantId);
  if (r.allowed) return null;
  if (r.errorCode === 'QUOTA_LOOKUP_FAILED') {
    return jsonError(503, 'QUOTA_LOOKUP_FAILED', r.reason ?? 'cap rpc failed');
  }
  return jsonError(429, 'QUOTA_EXCEEDED',
    (r.reason ?? 'Monatslimit erreicht.') +
    ' Bis zum Monatswechsel keine weiteren Anfragen, oder Plan upgraden.');
}

async function enforceAnonQuota(admin: SupabaseAdminClient, ipHash: string): Promise<Response | null> {
  const r = await checkAnonQuota(admin, ipHash);
  if (r.allowed) return null;
  if (r.errorCode === 'QUOTA_LOOKUP_FAILED') {
    return jsonError(503, 'QUOTA_LOOKUP_FAILED', r.reason ?? 'cap rpc failed');
  }
  return jsonError(429, 'QUOTA_EXCEEDED',
    (r.reason ?? 'Monatslimit für anonyme Anfragen erreicht.') +
    ' Erstellen Sie einen Account oder warten Sie bis zum Monatswechsel.');
}

async function logChatToHistory(
  admin: SupabaseAdminClient,
  args: Parameters<typeof recordChatHistory>[1],
): Promise<void> {
  const r = await recordChatHistory(admin, args);
  if (!r.ok) {
    console.error('logChatToHistory failed:', r.error);
  }
}

async function finishAnon(
  admin: SupabaseAdminClient,
  requestId: string,
  startedAt: number,
  patch: Omit<AnonAuditCompletion, 'duration_ms'>,
): Promise<void> {
  await completeAnonAudit(admin, requestId, {
    ...patch,
    duration_ms: Date.now() - startedAt,
  });
}

const ANON_SYSTEM_PROMPT = `Du bist der öffentliche KI-Compliance-Assistent von RealSyncDynamics.AI.

ROLLE
Du beantwortest allgemeine Fragen zu DSGVO, TTDSG, EU AI Act und verwandten EU-Datenschutz- und KI-Regularien.
Du hast keinen Zugriff auf Tenant-Daten oder interne Systeme — nur auf dein Trainingswissen.

LEITPLANKEN
1. Keine individuelle Rechtsberatung. Verweise bei konkreten Rechtsfragen auf einen Fachanwalt oder DSB.
2. Nenne immer den konkreten DSGVO-Artikel, TTDSG-Paragraphen oder AI-Act-Artikel, auf den du dich beziehst.
3. Trenne technische Erklärung von rechtlicher Bewertung.
4. Wenn du unsicher bist oder eine Frage über allgemeines Compliance-Wissen hinausgeht, sag es klar.
5. Weise am Ende auf die kostenlosen Audit-Tools und die Plattform hin, wenn es zum Kontext passt.

STIL
Direkt, klar, handlungsorientiert. Keine Floskeln. Antworte auf Deutsch, außer der Nutzer schreibt in einer anderen Sprache.`;

type SimpleMsg = { role: 'user' | 'assistant'; content: string };

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  // Anon chat — no user JWT required, rate-limited per IP.
  if (body.op === 'chat_anon') {
    try {
      return await handleChatAnon(req, body);
    } catch (e) {
      return jsonError(500, 'INTERNAL', (e as Error).message);
    }
  }

  // Anon tool: start_audit_scan — public callable, rate-limited per IP.
  // Akzeptiert {url, email} und liefert einen Mock-Queued-Status zurueck.
  // Ein echter Scan-Worker liest spaeter aus public.audit_scan_queue —
  // siehe README. Phase 3 nimmt nur die UI/Tool-Vertragsoberflaeche raus.
  if (body.op === 'start_audit_scan') {
    try {
      return await handleStartAuditScanAnon(req, body);
    } catch (e) {
      return jsonError(500, 'INTERNAL', (e as Error).message);
    }
  }

  // Phase 4 (Hostinger-Pattern): audit-copilot Tools im anon-Mode.
  // Stellen die uniforme LLM-Tool-Vertragsoberflaeche fuer den
  // AuditResultView-Right-Panel bereit. Beide Tools liefern strukturierte
  // Mock-Responses — ein spaeterer Edge-Worker dispatched echte LLM-Calls
  // via ai-gateway / Anthropic. Rate-Limit identisch zu chat_anon (per IP).
  if (body.op === 'explain_finding') {
    try {
      return await handleExplainFindingAnon(req, body);
    } catch (e) {
      return jsonError(500, 'INTERNAL', (e as Error).message);
    }
  }
  if (body.op === 'generate_fix_snippet') {
    try {
      return await handleGenerateFixSnippetAnon(req, body);
    } catch (e) {
      return jsonError(500, 'INTERNAL', (e as Error).message);
    }
  }

  // Anon chat history readback — keyed by session_id (the same cookie
  // the chat path uses). No JWT required; the session_id IS the bearer
  // credential for anon. Reads via service_role; no RLS issue.
  if (body.op === 'chat_history_anon') {
    try {
      return await handleChatHistoryAnon(body);
    } catch (e) {
      return jsonError(500, 'INTERNAL', (e as Error).message);
    }
  }

  // All other ops require a valid user JWT.
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  try {
    switch (body.op) {
      case 'chat':         return await handleChat(admin, userId, userEmail, auth, body);
      case 'reset':        return await handleReset(admin, userId, body);
      case 'history':      return await handleHistory(admin, userId, body);
      case 'chat_history': return await handleChatHistoryTenant(admin, userId, body);
      default:             return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

async function handleChat(
  admin: SupabaseAdminClient,
  userId: string,
  userEmail: string | null,
  bearerAuth: string,
  body: Record<string, unknown>,
): Promise<Response> {
  const tenant_id = body.tenant_id as string;
  const message = (body.message as string ?? '').trim();
  if (!tenant_id || !message) return jsonError(400, 'BAD_REQUEST', 'tenant_id and message required');

  // Membership check — agent only serves tenants the user belongs to.
  const { data: mem } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenant_id).eq('user_id', userId).maybeSingle();
  if (!mem) return jsonError(403, 'FORBIDDEN', 'no membership in this tenant');

  // Plan-coupled monthly LLM quota — see migration
  // 20260609000000_llm_query_quota_history.sql. Runs after membership
  // check so we don't leak quota state for tenants the user can't see.
  const quotaResp = await enforceTenantQuota(admin, tenant_id);
  if (quotaResp) return quotaResp;

  // EU-routing guard. Tenant chat always uses Anthropic (the
  // ai_gateway switch only flips anon-mode), so the guard must also
  // trigger when LLM_PROVIDER is set to ai_gateway.
  const tenantEffectiveProvider = LLM_PROVIDER === 'ai_gateway' ? 'anthropic' : LLM_PROVIDER;
  if (tenantEffectiveProvider === 'anthropic' && !ALLOW_US_ROUTING && body.acknowledge_us_routing !== true) {
    return jsonError(412, 'US_ROUTING_NOT_ACKNOWLEDGED',
      'Tenant chat uses Anthropic, which routes through US. Set AGENT_ALLOW_US_ROUTING=true or pass acknowledge_us_routing=true per call. ' +
      'For EU residency switch to mistral or anthropic-via-bedrock-eu (not yet wired).');
  }

  const apiKey = await getLlmApiKey(admin);
  if (!apiKey) {
    return jsonError(503, 'LLM_NOT_CONFIGURED',
      `${LLM_PROVIDER}_api_key missing from env and vault. Provision via supabase secrets set or the Vault dashboard.`);
  }

  // Load or create session.
  const sessionId = (body.session_id as string) || crypto.randomUUID();
  let history: Anthropic.MessageParam[] = [];
  if (body.session_id) {
    const { data: existing } = await admin.from('agent_sessions')
      .select('history').eq('id', sessionId).eq('user_id', userId).eq('tenant_id', tenant_id).maybeSingle();
    if (existing?.history) history = existing.history as Anthropic.MessageParam[];
  }

  // Token-guard: trim history to last N turns.
  if (history.length > MAX_HISTORY_TURNS * 2) {
    history = history.slice(-(MAX_HISTORY_TURNS * 2));
  }
  history.push({ role: 'user', content: message });

  // Smart model selection: route simple questions to Haiku (5x cheaper, 3x faster)
  // Complex governance tasks use Sonnet for nuanced analysis.
  const isFollowUp = body.session_id !== undefined;
  const selectedTier = selectModel(message, history.length, isFollowUp);
  const effectiveModel = getModelId(selectedTier);
  const maxTokens = selectedTier === 'haiku' ? MAX_TOKENS_HAIKU : MAX_TOKENS_SONNET;

  const client = new Anthropic({ apiKey });
  const toolCallsLog: Array<{ tool: string; input: unknown; output: unknown; iter: number }> = [];
  let totalIn = 0;
  let totalOut = 0;
  let finalText = '';
  let outcome: 'success' | 'tool_error' | 'llm_error' | 'budget_exceeded' | 'timeout' = 'success';
  let errorMessage: string | null = null;
  const startedAt = Date.now();

  try {
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      const resp = await client.messages.create({
        model: effectiveModel,
        max_tokens: maxTokens,
        // Anthropic prompt caching (cache_control: ephemeral) — the
        // system prompt + tool catalogue are identical across every
        // iteration of a tool-loop and across every chat turn within
        // a 5-minute window. Marking them cacheable cuts the input-
        // token cost for these blocks by ~90% on cache hits, which
        // is the dominant input cost driver for tool-heavy chats.
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: AGENT_TOOLS.map((t, i) =>
          // Mark only the LAST tool with cache_control — Anthropic
          // caches everything up to and including that marker, so
          // tagging the final tool effectively caches the full
          // tools array as one block.
          i === AGENT_TOOLS.length - 1
            ? { ...t, cache_control: { type: 'ephemeral' as const } }
            : t,
        ),
        messages: history,
      });
      totalIn += resp.usage.input_tokens;
      totalOut += resp.usage.output_tokens;

      if (resp.stop_reason === 'end_turn') {
        finalText = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        history.push({ role: 'assistant', content: resp.content });
        break;
      }

      if (resp.stop_reason === 'tool_use') {
        history.push({ role: 'assistant', content: resp.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of resp.content) {
          if (block.type !== 'tool_use') continue;
          const result = await dispatchTool({
            name: block.name,
            input: block.input as Record<string, unknown>,
            admin,
            bearerAuth,
            tenantId: tenant_id,
            userId,
            userEmail,
          });
          toolCallsLog.push({ tool: block.name, input: block.input, output: result, iter });
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
            is_error: !!(result as { error?: unknown }).error,
          });
        }
        history.push({ role: 'user', content: toolResults });
        continue;
      }

      outcome = 'llm_error';
      errorMessage = `unexpected stop_reason: ${resp.stop_reason}`;
      break;
    }

    if (!finalText && outcome === 'success') {
      outcome = 'budget_exceeded';
      errorMessage = `MAX_ITERATIONS (${MAX_ITERATIONS}) reached without end_turn`;
    }
  } catch (e) {
    outcome = 'llm_error';
    errorMessage = (e as Error).message;
  }

  const durationMs = Date.now() - startedAt;

  // Persist session.
  await admin.from('agent_sessions').upsert({
    id: sessionId,
    tenant_id,
    user_id: userId,
    history,
    last_turn_at: new Date().toISOString(),
  });

  // Persist run trace (use effectiveModel, not LLM_MODEL default).
  await admin.from('agent_runs').insert({
    session_id: sessionId,
    tenant_id,
    actor_user_id: userId,
    actor_email: userEmail,
    user_message: message.slice(0, 4000),
    final_response: finalText.slice(0, 8000),
    tool_calls: toolCallsLog,
    iterations: toolCallsLog.length > 0 ? Math.max(...toolCallsLog.map((t) => t.iter)) + 1 : 1,
    llm_provider: LLM_PROVIDER,
    llm_model: effectiveModel,
    input_tokens: totalIn,
    output_tokens: totalOut,
    cost_usd: estimateCostUsFromModel(effectiveModel, totalIn, totalOut),
    duration_ms: durationMs,
    outcome,
    error_message: errorMessage,
  });

  // Audit log per chat turn (skip the full transcript — refer to run_id).
  await audit(admin, {
    tenant_id,
    actor_user_id: userId,
    actor_email: userEmail,
    action: 'agent.chat',
    target_type: 'agent_session',
    target_id: sessionId,
    payload: { iterations: toolCallsLog.length, outcome, tools: toolCallsLog.map((t) => t.tool) },
  });

  // Per-run history for user/tenant-facing review + quota counting.
  // Only logged on success — failures don't consume quota budget.
  if (outcome === 'success') {
    await logChatToHistory(admin, {
      tenant_id,
      user_id: userId,
      session_id: sessionId,
      op: 'chat',
      provider: LLM_PROVIDER,
      model: effectiveModel,  // Log actual model used (may differ from default)
      query_text: message.slice(0, 4000),
      response_summary: finalText,
      input_tokens: totalIn,
      output_tokens: totalOut,
    });
  }

  return jsonResponse({
    ok: outcome === 'success',
    session_id: sessionId,
    response: finalText,
    tool_calls: toolCallsLog.length,
    actions_taken: toolCallsLog.map((t) => t.tool),
    outcome,
    error: errorMessage,
    tokens: { input: totalIn, output: totalOut },
    duration_ms: durationMs,
  });
}

// deno-lint-ignore no-explicit-any
async function handleReset(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>): Promise<Response> {
  const session_id = body.session_id as string;
  const tenant_id = body.tenant_id as string;
  if (!session_id || !tenant_id) return jsonError(400, 'BAD_REQUEST', 'session_id and tenant_id required');
  const { error } = await admin.from('agent_sessions')
    .update({ history: [], last_turn_at: new Date().toISOString() })
    .eq('id', session_id).eq('user_id', userId).eq('tenant_id', tenant_id);
  if (error) throw error;
  return jsonResponse({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function handleHistory(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>): Promise<Response> {
  const tenant_id = body.tenant_id as string;
  const session_id = body.session_id as string | undefined;
  const limit = Math.min((body.limit as number | undefined) ?? 20, 100);

  if (session_id) {
    const { data } = await admin.from('agent_sessions')
      .select('id, history, last_turn_at, created_at')
      .eq('id', session_id).eq('user_id', userId).eq('tenant_id', tenant_id).maybeSingle();
    return jsonResponse({ ok: true, session: data ?? null });
  }

  const { data } = await admin.from('agent_runs')
    .select('id, session_id, user_message, final_response, outcome, tool_calls, input_tokens, output_tokens, cost_usd, created_at')
    .eq('tenant_id', tenant_id).eq('actor_user_id', userId)
    .order('created_at', { ascending: false }).limit(limit);
  return jsonResponse({ ok: true, runs: data ?? [] });
}

// op:'chat_history' — tenant-scoped per-run history from llm_query_history.
// Differs from op:'history' above (which reads conversation turns from
// agent_runs / agent_sessions): this returns the dedicated LLM-query
// records used for the user's "my past questions" view and shared with
// the monthly-quota counter. RLS scopes by tenant membership, so the
// service-role client mirrors the user's effective view by filtering
// on tenant_id + user_id explicitly (defense-in-depth).
async function handleChatHistoryTenant(admin: SupabaseAdminClient, userId: string, body: Record<string, unknown>): Promise<Response> {
  const tenant_id = body.tenant_id as string;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');

  // Membership check — mirror handleChat's gate.
  const { data: mem } = await admin.from('memberships')
    .select('role').eq('tenant_id', tenant_id).eq('user_id', userId).maybeSingle();
  if (!mem) return jsonError(403, 'FORBIDDEN', 'no membership in this tenant');

  const limit = Math.min((body.limit as number | undefined) ?? 50, 200);
  const { data, error } = await admin.from('llm_query_history')
    .select('id, occurred_at, op, provider, model, query_text, response_summary, input_tokens, output_tokens, session_id, correlation_id')
    .eq('tenant_id', tenant_id)
    .order('occurred_at', { ascending: false }).limit(limit);
  if (error) return jsonError(500, 'INTERNAL', error.message);

  // Also surface cap + used so the UI can render "X of Y used".
  const { data: capRows } = await admin.rpc('llm_quota_for_tenant', { p_tenant_id: tenant_id });
  const { data: usedRows } = await admin.rpc('llm_quota_used_for_tenant', { p_tenant_id: tenant_id });
  const cap  = typeof capRows  === 'number' ? capRows  : (capRows?.[0]  as number | undefined) ?? 10;
  const used = typeof usedRows === 'number' ? usedRows : (usedRows?.[0] as number | undefined) ?? 0;

  return jsonResponse({
    ok: true,
    runs: data ?? [],
    quota: { cap, used, unlimited: cap === -1 },
  });
}

// op:'chat_history_anon' — anon variant. Session_id is the bearer
// credential; if a caller can produce a valid session UUID, they get
// the history rows for that session. No JWT path.
async function handleChatHistoryAnon(body: Record<string, unknown>): Promise<Response> {
  const session_id = body.session_id as string;
  if (!session_id || typeof session_id !== 'string') {
    return jsonError(400, 'BAD_REQUEST', 'session_id required');
  }
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const limit = Math.min((body.limit as number | undefined) ?? 50, 200);
  const { data, error } = await admin.from('llm_query_history')
    .select('id, occurred_at, op, provider, model, query_text, response_summary, input_tokens, output_tokens, session_id, correlation_id')
    .eq('session_id', session_id)
    .eq('op', 'chat_anon')
    .order('occurred_at', { ascending: false }).limit(limit);
  if (error) return jsonError(500, 'INTERNAL', error.message);

  return jsonResponse({
    ok: true,
    runs: data ?? [],
    // Anon cap is constant; usage requires the IP hash which we don't
    // expose to the client. UI can compute "used" as runs.length if
    // it wants to display progress against the cap.
    quota: { cap: 10, unlimited: false },
  });
}

async function handleChatAnon(req: Request, body: Record<string, unknown>): Promise<Response> {
  const sessionId = (body.session_id as string) || crypto.randomUUID();
  const ack = body.acknowledge_us_routing === true;

  const gate = await anonGate(req, body, 'chat_anon', {
    session_id: sessionId,
    acknowledge_us_routing: ack,
  });
  if (gate instanceof Response) return gate;
  const { admin, requestId, ipHash, startedAt } = gate;

  const message = (body.message as string ?? '').trim();
  if (!message) {
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: 'BAD_REQUEST' });
    return jsonError(400, 'BAD_REQUEST', 'message required');
  }

  // Plan-coupled monthly quota — anon = implicit free (10/month/IP).
  // Returns null if within budget; on exceeded the audit row is
  // finalised as QUOTA_EXCEEDED so the security trail shows the
  // rejection and the audit timeline reflects the failed attempt.
  const quotaResp = await enforceAnonQuota(admin, ipHash);
  if (quotaResp) {
    await finishAnon(admin, requestId, startedAt, {
      outcome: 'error', error_code: 'QUOTA_EXCEEDED',
    });
    return quotaResp;
  }

  const clientHistory = Array.isArray(body.history) ? (body.history as SimpleMsg[]) : [];

  // EU-routing guard. ai_gateway provider routes via LM Studio (EU-local)
  // by default, so the US-routing acknowledgement is not required.
  if (LLM_PROVIDER === 'anthropic' && !ALLOW_US_ROUTING && !ack) {
    await finishAnon(admin, requestId, startedAt, {
      outcome: 'error', error_code: 'US_ROUTING_NOT_ACKNOWLEDGED',
    });
    return jsonError(412, 'US_ROUTING_NOT_ACKNOWLEDGED',
      'LLM_PROVIDER=anthropic routes through US. Pass acknowledge_us_routing=true to proceed.');
  }

  const transcript: SimpleMsg[] = [
    ...clientHistory.slice(-ANON_MAX_HISTORY),
    { role: 'user', content: message },
  ];

  let finalText: string;
  let inputTokens  = 0;
  let outputTokens = 0;

  try {
    if (LLM_PROVIDER === 'ai_gateway') {
      const result = await runAnonViaAiGateway(transcript);
      if (result instanceof Response) {
        await finishAnon(admin, requestId, startedAt, {
          outcome: 'error', error_code: 'AI_GATEWAY_ERROR', model: LLM_MODEL,
        });
        return result;
      }
      finalText    = result.text;
      inputTokens  = result.inputTokens;
      outputTokens = result.outputTokens;
    } else {
      const apiKey = await getLlmApiKey(admin);
      if (!apiKey) {
        await finishAnon(admin, requestId, startedAt, {
          outcome: 'error', error_code: 'LLM_NOT_CONFIGURED', model: LLM_MODEL,
        });
        return jsonError(503, 'LLM_NOT_CONFIGURED',
          `${LLM_PROVIDER}_api_key missing from env and vault.`);
      }
      const result = await runAnonViaAnthropic(apiKey, transcript);
      finalText    = result.text;
      inputTokens  = result.inputTokens;
      outputTokens = result.outputTokens;
    }
  } catch (e) {
    await finishAnon(admin, requestId, startedAt, {
      outcome: 'error', error_code: 'LLM_EXCEPTION', model: LLM_MODEL,
    });
    throw e;
  }

  const updatedHistory: SimpleMsg[] = [
    ...transcript,
    { role: 'assistant', content: finalText },
  ];

  const modelUsed = anonModelLabel();
  await finishAnon(admin, requestId, startedAt, {
    outcome: 'success',
    model: modelUsed,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });

  // Per-run history — feeds the user-facing session history view and
  // counts toward the anon monthly quota the next time around.
  await logChatToHistory(admin, {
    tenant_id: null,
    user_id: null,
    session_id: sessionId,
    op: 'chat_anon',
    provider: LLM_PROVIDER,
    model: modelUsed,
    query_text: message.slice(0, 4000),
    response_summary: finalText,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    correlation_id: requestId,
  });

  return jsonResponse({
    ok: true,
    session_id: sessionId,
    response: finalText,
    history: updatedHistory,
    tokens: { input: inputTokens, output: outputTokens },
  });
}

async function runAnonViaAnthropic(
  apiKey: string, transcript: SimpleMsg[],
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: ANON_LLM_MODEL,
    max_tokens: ANON_MAX_TOKENS,
    // System-prompt caching on the anon path too. The anon system
    // prompt is 224 tokens; with a free-tier cap of 10 calls/IP/mo
    // and many IPs sharing the same prompt, the cache hit rate is
    // high at the 5-minute window granularity.
    system: [{ type: 'text', text: ANON_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: transcript.map((m) => ({ role: m.role, content: m.content })),
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  return {
    text,
    inputTokens:  resp.usage.input_tokens,
    outputTokens: resp.usage.output_tokens,
  };
}

async function runAnonViaAiGateway(
  transcript: SimpleMsg[],
): Promise<{ text: string; inputTokens: number; outputTokens: number } | Response> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  // Prefer anon key for cross-function calls; service role would also
  // work but anon matches the public/anon trust boundary of this path.
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY')
              ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !apiKey) {
    return jsonError(503, 'AI_GATEWAY_NOT_CONFIGURED',
      'SUPABASE_URL or SUPABASE_ANON_KEY missing for ai_gateway provider.');
  }

  // The native op API takes a single `input` string. Fold the
  // conversation transcript into one user-prompt block so the gateway
  // doesn't need multi-turn awareness on this path.
  const folded = transcript
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  const client = new AiGatewayEdgeClient({ supabaseUrl: SUPABASE_URL, apiKey });
  try {
    const resp = await client.generate({
      feature:       'governance_agent_anon',
      task_type:     'chat',
      model_profile: AGENT_LLM_MODEL_PROFILE,
      input:         folded,
      system_prompt: ANON_SYSTEM_PROMPT,
      max_tokens:    ANON_MAX_TOKENS,
      temperature:   0.3,
    });
    return {
      text:         resp.output,
      inputTokens:  resp.usage?.input_tokens  ?? 0,
      outputTokens: resp.usage?.output_tokens ?? 0,
    };
  } catch (err) {
    if (err instanceof AiGatewayEdgeError) {
      return jsonError(err.status === 200 ? 502 : err.status, err.code, err.message);
    }
    throw err;
  }
}

// Tenant chat path needs Anthropic tool-use. The ai_gateway provider
// switch (PR #240) only flips the anon-mode path; for tenant chat we
// always fall through to Anthropic regardless of the env value. Without
// this fix, setting AGENT_LLM_PROVIDER=ai_gateway would brick tenant
// chat with 503 LLM_NOT_CONFIGURED.
// deno-lint-ignore no-explicit-any
async function getLlmApiKey(admin: SupabaseAdminClient): Promise<string | null> {
  const effectiveProvider = LLM_PROVIDER === 'ai_gateway' ? 'anthropic' : LLM_PROVIDER;
  const envVar = effectiveProvider === 'anthropic' ? 'ANTHROPIC_API_KEY'
               : effectiveProvider === 'openai'    ? 'OPENAI_API_KEY'
               : effectiveProvider === 'mistral'   ? 'MISTRAL_API_KEY'
               : null;
  if (!envVar) return null;
  const fromEnv = Deno.env.get(envVar);
  if (fromEnv) return fromEnv;
  const vaultName = `${effectiveProvider}_api_key`;
  const { data } = await admin.rpc('get_app_secret', { secret_name: vaultName });
  return typeof data === 'string' ? data : null;
}

function estimateCostUsd(model: string, inTok: number, outTok: number): number {
  // Rough Anthropic pricing as of 2026-05. Reporting is best-effort; the
  // canonical cost lives in `token_usage` once we wire that pipeline.
  const m = model.toLowerCase();
  const [inRate, outRate] = m.includes('opus')   ? [15, 75]
                          : m.includes('sonnet') ? [3, 15]
                          : m.includes('haiku')  ? [0.8, 4]
                          : [3, 15];
  return +(inTok / 1_000_000 * inRate + outTok / 1_000_000 * outRate).toFixed(6);
}

// Optimized cost estimation using MODEL_PRICING from modelSelection
function estimateCostUsFromModel(modelId: string, inTok: number, outTok: number): number {
  const m = modelId.toLowerCase();
  const isHaiku = m.includes('haiku');
  const pricing = isHaiku ? MODEL_PRICING.haiku : MODEL_PRICING.sonnet;
  return +(inTok / 1_000_000 * pricing.input + outTok / 1_000_000 * pricing.output).toFixed(6);
}

/**
 * Phase 3 (Hostinger-Pattern): start_audit_scan-Tool im Anon-Mode.
 *
 * Vertrag:
 *   Input:  { op: 'start_audit_scan', url: string, email: string }
 *   Output: { ok: true, status: 'queued', audit_id: string,
 *             url_normalized: string, hint: string }
 *
 * Wieso Mock-Queued statt echtem Scan?
 *   - Der echte Scanner (gdpr-audit Edge Function) ist eine separate Surface
 *     mit eigener Pre-Consent-/Headless-Logik. Phase 3 baut nur die LLM-Tool-
 *     Vertragsoberflaeche, damit der Chat-Hero verdrahtet werden kann.
 *   - Ein spaeterer Worker liest die queued-Eintraege und triggert
 *     gdpr-audit — bis dahin ist der Mock ehrlich gelabelt.
 *   - Wichtig: das Tool legt KEINE Daten in der DB an; pure clientseitige
 *     UI-Vertragsschnittstelle. Die separate gdpr-audit-Function speichert
 *     bei einem echten Scan einen Audit-Datensatz.
 */
async function handleStartAuditScanAnon(req: Request, body: Record<string, unknown>): Promise<Response> {
  const gate = await anonGate(req, body, 'start_audit_scan');
  if (gate instanceof Response) return gate;
  const { admin, requestId, startedAt } = gate;

  const urlRaw   = typeof body.url   === 'string' ? body.url.trim()   : '';
  const emailRaw = typeof body.email === 'string' ? body.email.trim() : '';

  if (!urlRaw) {
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: 'BAD_REQUEST' });
    return jsonError(400, 'BAD_REQUEST', 'url required');
  }
  if (!emailRaw) {
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: 'BAD_REQUEST' });
    return jsonError(400, 'BAD_REQUEST', 'email required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: 'BAD_REQUEST' });
    return jsonError(400, 'BAD_REQUEST', 'email invalid');
  }

  // URL-Normalisierung: identisch zur AuditLanding-Form-Variante.
  const normalized = urlRaw.match(/^https?:\/\//i) ? urlRaw : `https://${urlRaw}`;
  try {
    // Wirft TypeError bei ungueltigem Format.
    new URL(normalized);
  } catch {
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: 'BAD_REQUEST' });
    return jsonError(400, 'BAD_REQUEST', 'url malformed');
  }

  await finishAnon(admin, requestId, startedAt, { outcome: 'success' });

  return jsonResponse({
    ok: true,
    status: 'queued',
    audit_id: `mock-${crypto.randomUUID()}`,
    url_normalized: normalized,
    hint: 'Demo-Response — kein echter Scan ausgelöst. Wechsel auf /audit für den vollen Scan.',
  });
}

/**
 * Audit-Copilot Tools (anon).
 *
 * Beide Tools akzeptieren {audit_id, finding_id} (Pflicht) und optional
 * {finding_payload} fuer anon-Flows, in denen kein DB-Lookup moeglich ist.
 * Sie routen jetzt echt ueber die `ai-gateway` Edge Function (strict-json),
 * denselben Vertrag wie src/features/audit/auditCopilotApi.ts — die
 * Provider-/EU-Routing-Auswahl und das Cost-Tracking bleiben in ai-gateway.
 * Faellt der Gateway aus, degradieren die Tools sichtbar (degraded:true) statt
 * einen Fehler zu werfen, damit das Copilot-Panel nutzbar bleibt.
 */
const ANON_EXPLAIN_SYSTEM_PROMPT = `Du bist Audit-Co-Pilot für DSGVO-/AI-Act-Compliance.
Erkläre einen einzelnen Audit-Befund für Website-Betreiber verständlich.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON. Kein Markdown, keine Prosa außerhalb des JSON.
- Schema: { "summary": string, "technical": string, "legal_hint": string, "disclaimer": string }
- summary: 1-2 Sätze, was der Befund praktisch bedeutet.
- technical: was technisch passiert und wodurch der Befund entsteht (2-4 Sätze).
- legal_hint: einschlägige Rechtsgrundlage (DSGVO-Artikel / TDDDG-§), knapp. KEINE Rechtsberatung.
- disclaimer: kurzer Satz, dass dies Orientierung und keine Rechtsberatung ist.`;

const ANON_FIX_SNIPPET_SYSTEM_PROMPT = `Du bist Audit-Co-Pilot für DSGVO-/AI-Act-Compliance.
Aufgabe: Generiere einen knappen, kopierfähigen Code-/Konfigurationsschnipsel,
der den genannten Befund auf der gewählten Plattform behebt.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON. Kein Markdown-Wrapper.
- Schema: { "cms": string, "language": string, "snippet": string, "notes": string }
- snippet: maximal 30 Zeilen, kein Beispiel-Output, nur produktionsfähiger Code/Config.
- notes: 1-3 Sätze, warum das den Befund behebt. KEINE Rechtsberatung.
- Wenn der Befund nicht via Snippet behebbar ist (z. B. Prozess-Issue),
  setze snippet auf "" und beschreibe im notes-Feld die manuellen Schritte.`;

// Server-seitiger ai-gateway-Client für die anon-Copilot-Tools. Nutzt den
// Anon-Key (wie governanceBriefRunner / remediation-agent); die ai-gateway
// Edge Function erzwingt Provider-Kette + EU-Routing + Cost-Cap.
function anonAiGatewayClient(): AiGatewayEdgeClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  return new AiGatewayEdgeClient({ supabaseUrl: url, apiKey: anon, timeoutMs: 20_000 });
}

interface FindingPayload {
  id?: string;
  severity?: string;
  title?: string;
  detail?: string;
  paragraph_ref?: string;
}

function readFindingPayload(body: Record<string, unknown>): FindingPayload {
  const raw = body.finding_payload;
  if (!raw || typeof raw !== 'object') return {};
  return raw as FindingPayload;
}

async function handleExplainFindingAnon(req: Request, body: Record<string, unknown>): Promise<Response> {
  const gate = await anonGate(req, body, 'explain_finding');
  if (gate instanceof Response) return gate;
  const { admin, requestId, startedAt } = gate;

  const auditId   = typeof body.audit_id   === 'string' ? body.audit_id.trim()   : '';
  const findingId = typeof body.finding_id === 'string' ? body.finding_id.trim() : '';
  if (!auditId) {
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: 'BAD_REQUEST' });
    return jsonError(400, 'BAD_REQUEST', 'audit_id required');
  }
  if (!findingId) {
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: 'BAD_REQUEST' });
    return jsonError(400, 'BAD_REQUEST', 'finding_id required');
  }

  const payload = readFindingPayload(body);
  const title = payload.title ?? 'Befund';
  const paraRef = payload.paragraph_ref ?? '–';

  const input = [
    `Befund-ID: ${findingId}`,
    payload.severity ? `Severity: ${payload.severity}` : '',
    `Titel: ${title}`,
    payload.detail ? `Detail: ${payload.detail}` : '',
    paraRef !== '–' ? `Rechtsgrundlage: ${paraRef}` : '',
  ].filter(Boolean).join('\n');

  try {
    const resp = await anonAiGatewayClient().extractJson<{
      summary?: string; technical?: string; legal_hint?: string; disclaimer?: string;
    }>({
      feature:       'audit_copilot.explain_finding_anon',
      task_type:     'extract_json',
      model_profile: 'strict-json',
      input,
      system_prompt: ANON_EXPLAIN_SYSTEM_PROMPT,
      max_tokens:    700,
      temperature:   0.2,
    });
    const e = resp.output ?? {};
    await finishAnon(admin, requestId, startedAt, { outcome: 'success' });
    return jsonResponse({
      ok: true,
      audit_id: auditId,
      finding_id: findingId,
      explanation: {
        summary:    e.summary    ?? `Erklärung für "${title}".`,
        technical:  e.technical  ?? '',
        legal_hint: e.legal_hint ?? paraRef,
        disclaimer: e.disclaimer ?? 'Orientierung, keine Rechtsberatung.',
      },
      hint: `Live-Analyse via ${resp.provider}/${resp.model}.`,
    });
  } catch (err) {
    const code = err instanceof AiGatewayEdgeError ? err.code : 'LLM_UNAVAILABLE';
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: code });
    // Sichtbare Degradierung statt Fehler — das Copilot-Panel bleibt nutzbar.
    return jsonResponse({
      ok: true,
      audit_id: auditId,
      finding_id: findingId,
      degraded: true,
      explanation: {
        summary:    `Zu „${title}" konnte gerade keine Live-Analyse erzeugt werden.`,
        technical:  'Die KI-Analyse ist momentan nicht erreichbar. Bitte in Kürze erneut versuchen.',
        legal_hint: paraRef,
        disclaimer: 'Orientierung, keine Rechtsberatung.',
      },
      hint: 'Live-Analyse momentan nicht verfügbar.',
    });
  }
}

async function handleGenerateFixSnippetAnon(req: Request, body: Record<string, unknown>): Promise<Response> {
  const gate = await anonGate(req, body, 'generate_fix_snippet');
  if (gate instanceof Response) return gate;
  const { admin, requestId, startedAt } = gate;

  const auditId   = typeof body.audit_id   === 'string' ? body.audit_id.trim()   : '';
  const findingId = typeof body.finding_id === 'string' ? body.finding_id.trim() : '';
  const cmsRaw    = typeof body.cms        === 'string' ? body.cms.trim()        : 'custom-html';
  if (!auditId) {
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: 'BAD_REQUEST' });
    return jsonError(400, 'BAD_REQUEST', 'audit_id required');
  }
  if (!findingId) {
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: 'BAD_REQUEST' });
    return jsonError(400, 'BAD_REQUEST', 'finding_id required');
  }

  const cmsAllowed = new Set(['wordpress', 'shopify', 'webflow', 'custom-html', 'nginx']);
  const cms = cmsAllowed.has(cmsRaw) ? cmsRaw : 'custom-html';
  const fallbackLang = cms === 'nginx' ? 'nginx' : cms === 'wordpress' ? 'php' : 'html';

  const payload = readFindingPayload(body);
  const input = [
    `Befund-ID: ${findingId}`,
    payload.severity ? `Severity: ${payload.severity}` : '',
    payload.title ? `Titel: ${payload.title}` : '',
    payload.detail ? `Detail: ${payload.detail}` : '',
    payload.paragraph_ref ? `Rechtsgrundlage: ${payload.paragraph_ref}` : '',
    '',
    `Ziel-Plattform: ${cms}`,
  ].filter(Boolean).join('\n');

  try {
    const resp = await anonAiGatewayClient().extractJson<{
      cms?: string; language?: string; snippet?: string; notes?: string;
    }>({
      feature:       'audit_copilot.fix_snippet_anon',
      task_type:     'extract_json',
      model_profile: 'strict-json',
      input,
      system_prompt: ANON_FIX_SNIPPET_SYSTEM_PROMPT,
      max_tokens:    900,
      temperature:   0.1,
      metadata:      { cms },
    });
    const s = resp.output ?? {};
    await finishAnon(admin, requestId, startedAt, { outcome: 'success' });
    return jsonResponse({
      ok: true,
      audit_id: auditId,
      finding_id: findingId,
      snippet: {
        cms,
        language: s.language ?? fallbackLang,
        snippet:  s.snippet  ?? '',
        notes:    s.notes    ?? '',
      },
      hint: `Live-Snippet via ${resp.provider}/${resp.model}.`,
    });
  } catch (err) {
    const code = err instanceof AiGatewayEdgeError ? err.code : 'LLM_UNAVAILABLE';
    await finishAnon(admin, requestId, startedAt, { outcome: 'error', error_code: code });
    // Sichtbare Degradierung statt Fehler — das Copilot-Panel bleibt nutzbar.
    return jsonResponse({
      ok: true,
      audit_id: auditId,
      finding_id: findingId,
      degraded: true,
      snippet: {
        cms,
        language: fallbackLang,
        snippet:  '',
        notes:    'Live-Snippet-Generierung momentan nicht verfügbar. Bitte in Kürze erneut versuchen.',
      },
      hint: 'Live-Snippet momentan nicht verfügbar.',
    });
  }
}


import { AiGatewayEdgeClient, AiGatewayEdgeError } from '../../core/ai-gateway/edgeClient';
import { getSupabaseUrl, getSupabaseAnonKey } from '../../lib/supabaseUrl';
import type { SimpleMsg } from '../governance/AgentWidget/agentApi';

// Audit-Copilot helpers. Talk to the `ai-gateway` Edge Function via
// `AiGatewayEdgeClient` and return structured payloads for the panel UI.
//
// Why a feature-local helper instead of inlining the calls in the panel:
//   - keeps prompt text + JSON-schema expectations co-located,
//   - makes the calls unit-testable with an injected fetchImpl,
//   - leaves room for an audit-result variant (per-audit memory) without
//     touching the panel component.
//
// Why ai-gateway directly (not via governance-agent like the free-form
// chat path): structured outputs (code snippets, remediation plans) work
// best when we ask for JSON shape. The native op API exposes
// `extract_json` for exactly that.

export type AuditCmsTarget = 'wordpress' | 'shopify' | 'webflow' | 'custom-html' | 'nginx';

export interface AuditFindingInput {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  paragraph_ref?: string;
}

export interface FixSnippet {
  cms: AuditCmsTarget;
  language: string;       // "html" | "php" | "javascript" | "nginx" | …
  snippet: string;
  notes: string;          // 1-3 sentences explaining why this fixes the finding
}

export interface RemediationPlan {
  summary: string;
  steps: Array<{ title: string; detail: string }>;
  legal_reference?: string;
}

export interface AiGatewayClientDeps {
  /** Test/SSR hook: inject a preconfigured client (e.g. mocked fetch). */
  client?: AiGatewayEdgeClient;
  /** Test/SSR hook: override env-derived config without monkey-patching env. */
  supabaseUrl?: string;
  /** Test/SSR hook: override env-derived anon key. */
  supabaseAnonKey?: string;
}

export interface AuditAnonPayload {
  mode: 'audit_anon';
  turnstile_token: string;
  input: { question: string; audit_id?: string };
}

/**
 * Maps Cloudflare's native widget response field to the strict server contract.
 * The browser-only `cf-turnstile-response` field is never sent to the gateway.
 */
export function auditAnonPayload(
  widgetFields: { 'cf-turnstile-response'?: unknown; turnstile_token?: unknown },
  input: { question: string; auditId?: string },
): AuditAnonPayload {
  const token = [widgetFields['cf-turnstile-response'], widgetFields.turnstile_token]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
  if (!token || token.length > 2048) {
    throw new AiGatewayEdgeError(400, 'TURNSTILE_MISSING', 'Bitte die Bot-Prüfung abschließen.');
  }
  const question = input.question.trim();
  if (!question || question.length > 1000) {
    throw new AiGatewayEdgeError(400, 'BAD_REQUEST', 'Die Frage muss zwischen 1 und 1000 Zeichen lang sein.');
  }
  return {
    mode: 'audit_anon',
    turnstile_token: token,
    input: { question, ...(input.auditId ? { audit_id: input.auditId } : {}) },
  };
}

export type AuditAnonChatResult =
  | { kind: 'ok'; data: { response: string; history: SimpleMsg[] } }
  | { kind: 'rate_limited' }
  | { kind: 'llm_not_configured' }
  | { kind: 'error'; error: { code: string; message: string } };

export interface AuditAnonClientDeps extends AiGatewayClientDeps {
  fetchImpl?: typeof fetch;
  anonJwt?: string;
}

function auditConversationQuestion(message: string, history: SimpleMsg[]): string {
  const current = `Aktuelle Frage: ${message.trim()}`;
  if (current.length > 1000) {
    throw new AiGatewayEdgeError(400, 'BAD_REQUEST', 'Die Frage darf höchstens 1000 Zeichen enthalten.');
  }
  const context = history.slice(-6).map((turn) =>
    `${turn.role === 'user' ? 'Besucher' : 'Assistent'}: ${turn.content}`,
  );
  while (context.length > 0 && `${context.join('\n')}\n${current}`.length > 1000) context.shift();
  const prior = context.join('\n');
  if (!prior) return current;
  const available = 1000 - current.length - 1;
  return `${prior.slice(-available)}\n${current}`;
}

/** Send one anonymous chat turn through the server-guarded audit_anon path. */
export async function sendAuditAnon(args: {
  message: string;
  history: SimpleMsg[];
  auditId?: string;
  turnstileToken: string;
}, deps?: AuditAnonClientDeps): Promise<AuditAnonChatResult> {
  const payload = auditAnonPayload(
    { 'cf-turnstile-response': args.turnstileToken },
    { question: auditConversationQuestion(args.message, args.history), auditId: args.auditId },
  );
  const supabaseUrl = deps?.supabaseUrl ?? getSupabaseUrl();
  const anonKey = deps?.supabaseAnonKey ?? getSupabaseAnonKey();
  const anonJwt = deps?.anonJwt?.trim() || import.meta.env.VITE_SUPABASE_ANON_JWT?.trim() || anonKey;
  if (!anonJwt || anonJwt.startsWith('sb_publishable_')) {
    return {
      kind: 'error',
      error: {
        code: 'LEGACY_ANON_JWT_REQUIRED',
        message: 'Für den Audit-Copilot fehlt der Legacy-Anon-JWT (VITE_SUPABASE_ANON_JWT), den das Gateway benötigt.',
      },
    };
  }
  const fetchImpl = deps?.fetchImpl ?? fetch.bind(globalThis);
  let response: Response;
  try {
    response = await fetchImpl(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: anonKey,
        authorization: `Bearer ${anonJwt}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { kind: 'error', error: { code: 'NETWORK', message: 'Backend nicht erreichbar. Bitte erneut versuchen.' } };
  }

  let body: Record<string, unknown> = {};
  try {
    body = await response.json() as Record<string, unknown>;
  } catch {
    return { kind: 'error', error: { code: 'BAD_ENVELOPE', message: `Ungültige Server-Antwort (HTTP ${response.status}).` } };
  }
  if (!response.ok || body.ok !== true) {
    const error = body.error && typeof body.error === 'object'
      ? body.error as { code?: unknown; message?: unknown }
      : {};
    const code = typeof error.code === 'string' ? error.code : `HTTP_${response.status}`;
    const message = typeof error.message === 'string' ? error.message : 'Anfrage fehlgeschlagen.';
    if (response.status === 429 || code === 'RATE_LIMITED') return { kind: 'rate_limited' };
    if (response.status === 503) return { kind: 'llm_not_configured' };
    return { kind: 'error', error: { code, message } };
  }

  const responseText = typeof body.output === 'string' ? body.output : '';
  const history: SimpleMsg[] = [
    ...args.history,
    { role: 'user', content: args.message.trim() },
    { role: 'assistant', content: responseText },
  ];
  return { kind: 'ok', data: { response: responseText, history } };
}

function resolveClient(deps?: AiGatewayClientDeps): AiGatewayEdgeClient {
  if (deps?.client) return deps.client;
  // Zentrale Auflösung mit öffentlichem Produktions-Fallback (siehe
  // lib/supabaseUrl.ts), damit der Audit-Co-Pilot auch in Deploys ohne
  // gesetzte VITE_*-Build-Env erreichbar bleibt.
  const url = deps?.supabaseUrl     ?? getSupabaseUrl();
  const key = deps?.supabaseAnonKey ?? getSupabaseAnonKey();
  if (!url || !key) {
    throw new AiGatewayEdgeError(503, 'AI_GATEWAY_NOT_CONFIGURED',
      'Supabase-Zugangsdaten fehlen — ai-gateway nicht aufrufbar.');
  }
  return new AiGatewayEdgeClient({ supabaseUrl: url, apiKey: key });
}

const FIX_SNIPPET_SYSTEM_PROMPT = `Du bist Audit-Co-Pilot für DSGVO-/AI-Act-Compliance.
Aufgabe: Generiere einen knappen, kopierfähigen Code-/Konfigurationsschnipsel,
der den genannten Befund auf der gewählten Plattform behebt.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON. Kein Markdown-Wrapper.
- Schema: { "cms": string, "language": string, "snippet": string, "notes": string }
- snippet: maximal 30 Zeilen, kein Beispiel-Output, nur produktionsfähiger Code/Config.
- notes: 1-3 Sätze, warum das den Befund behebt. KEINE Rechtsberatung.
- Wenn der Befund nicht via Snippet behebbar ist (z. B. Prozess-Issue),
  setze snippet auf "" und beschreibe im notes-Feld die manuellen Schritte.`;

const REMEDIATION_SYSTEM_PROMPT = `Du bist Audit-Co-Pilot für DSGVO-/AI-Act-Compliance.
Aufgabe: Erzeuge einen knappen, umsetzbaren Maßnahmenplan zu den genannten Befunden.

Regeln:
- Antworte AUSSCHLIESSLICH mit gültigem JSON.
- Schema: { "summary": string, "steps": [{ "title": string, "detail": string }], "legal_reference": string }
- summary: 1-2 Sätze, was zu tun ist.
- steps: 3-6 konkrete Schritte. detail-Texte erwähnen NIE „Beratung", sondern „technische Umsetzung".
- legal_reference: relevanter DSGVO-Artikel oder TDDDG-Paragraph, sonst "".
- Keine Marketing-Sprache. Keine Rechtsberatung.`;

/**
 * Generate a CMS-targeted code snippet that fixes a single audit finding.
 *
 * Uses model_profile `strict-json` because we need a parseable structured
 * answer. Throws AiGatewayEdgeError on upstream failure — caller renders
 * a fallback bubble.
 */
export async function generateFixSnippet(
  finding: AuditFindingInput,
  cms: AuditCmsTarget,
  deps?: AiGatewayClientDeps,
): Promise<FixSnippet> {
  const client = resolveClient(deps);
  const input = [
    `Befund-ID: ${finding.id}`,
    `Severity: ${finding.severity}`,
    `Titel: ${finding.title}`,
    `Detail: ${finding.detail}`,
    finding.paragraph_ref ? `Rechtsgrundlage: ${finding.paragraph_ref}` : '',
    '',
    `Ziel-Plattform: ${cms}`,
  ].filter(Boolean).join('\n');

  const resp = await client.extractJson<FixSnippet>({
    feature:       'audit_copilot.fix_snippet',
    task_type:     'extract_json',
    model_profile: 'strict-json',
    input,
    system_prompt: FIX_SNIPPET_SYSTEM_PROMPT,
    max_tokens:    900,
    temperature:   0.1,
    metadata:      { cms },
  });
  return resp.output;
}

/**
 * Generate an actionable remediation plan covering one or more findings.
 *
 * Used for the "Maßnahmenplan anzeigen" CTA in the audit copilot panel.
 */
export async function generateRemediationPlan(
  findings: AuditFindingInput[],
  deps?: AiGatewayClientDeps,
): Promise<RemediationPlan> {
  if (findings.length === 0) {
    throw new AiGatewayEdgeError(400, 'BAD_REQUEST', 'Mindestens ein Befund erforderlich.');
  }
  const client = resolveClient(deps);
  const input = findings.map((f, i) => [
    `Befund ${i + 1}:`,
    `  Severity: ${f.severity}`,
    `  Titel: ${f.title}`,
    `  Detail: ${f.detail}`,
    f.paragraph_ref ? `  Rechtsgrundlage: ${f.paragraph_ref}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');

  const resp = await client.extractJson<RemediationPlan>({
    feature:       'audit_copilot.remediation_plan',
    task_type:     'extract_json',
    model_profile: 'strict-json',
    input,
    system_prompt: REMEDIATION_SYSTEM_PROMPT,
    max_tokens:    1200,
    temperature:   0.2,
    metadata:      { finding_count: findings.length },
  });
  return resp.output;
}

export { AiGatewayEdgeError };

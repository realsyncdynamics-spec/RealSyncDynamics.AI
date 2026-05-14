import { AiGatewayEdgeClient, AiGatewayEdgeError } from '../../core/ai-gateway/edgeClient';

// Quick-chat helper for the floating AssistentChip on public pages.
//
// Why a separate helper instead of the existing governance-agent path:
//   - the chip's chat is anon + intentionally lightweight, no
//     audit-site context, no email collection,
//   - calls flow through ai-gateway directly via AiGatewayEdgeClient
//     so we get the EU-local default profile (fast-local) and don't
//     consume the governance-agent's chat_anon budget,
//   - public-facing surface → needs an extra abuse-guard layer on top
//     of the server-side rate-limit (defense in depth).

// ── Anti-abuse limits ────────────────────────────────────────────
// All numbers chosen to bite well before the governance-agent's own
// 5/min IP-rate-limit triggers, so a misbehaving client sees a
// structured client-side rejection (no network call) instead of a 429.

export const QUICK_CHAT_LIMITS = {
  /** Max characters per single user message. */
  maxMessageLength:    2000,
  /** Max user turns kept in the rolling conversation. */
  maxTurns:            10,
  /** Max number of send() calls in a sliding 60s window per session. */
  rateLimitPerMinute:  5,
  /** History snippets folded into the prompt (most recent). */
  historyContextTurns: 6,
} as const;

const PII_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // Email — broad. False-positives are OK; we just refuse the send.
  { name: 'email',        re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/i },
  // International phone — 7+ digits with optional separators.
  { name: 'phone',        re: /(?:\+?\d[\s\-./]?){7,}\d/ },
  // Credit-card-like 13-19 digit run.
  { name: 'card_number',  re: /\b(?:\d[\s-]?){13,19}\b/ },
  // German IBAN (DE + 20 digits).
  { name: 'iban_de',      re: /\bDE\d{2}[\s]?(?:\d[\s]?){18}\b/i },
];

export interface QuickChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type QuickChatResult =
  | { kind: 'ok';            reply: string; history: QuickChatMessage[] }
  | { kind: 'rate_limited';  retryAfterMs: number }
  | { kind: 'too_long' }
  | { kind: 'pii_blocked';   pattern: string }
  | { kind: 'turn_cap' }
  | { kind: 'error';         code: string; message: string };

export interface QuickChatDeps {
  client?: AiGatewayEdgeClient;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Test/SSR hook: override `Date.now()` for deterministic rate-limit tests. */
  now?: () => number;
}

const SYSTEM_PROMPT = `Du bist „Assistent" — ein knapper, hilfsbereiter Auskunftsservice für
Besucher von RealSyncDynamicsAI. Antworte in DEUTSCH, höflich und direkt.

Regeln:
- 2-4 Sätze. Keine Marketing-Sprache.
- Bei Fragen zu DSGVO / AI-Act / Cookie-Compliance: erklären, NICHT beraten;
  bei konkreten Audit-Wünschen auf den Audit-Flow auf der Seite verweisen.
- Wenn jemand Rechtsberatung anfragt: ablehnen und stattdessen auf einen
  Anwalt oder den TLfDI (Aufsichtsbehörde) verweisen.
- Keine Garantien, keine Bußgeld-Versprechen.
- Wenn du eine Antwort nicht sicher weißt: ehrlich sagen, statt zu halluzinieren.`;

// In-module-scope session state. Reset on page reload (the chip mounts
// once per page; the helper is imported per-call but the array is
// module-scoped). A test passes `now` so the sliding window is
// deterministic.
const sendTimestamps: number[] = [];

/**
 * Test/SSR hook to clear the session's rate-limit and PII state. NEVER
 * call from production code.
 */
export function __resetQuickChatStateForTests(): void {
  sendTimestamps.length = 0;
}

export interface SendQuickChatArgs {
  message: string;
  history: QuickChatMessage[];
}

function resolveClient(deps?: QuickChatDeps): AiGatewayEdgeClient {
  if (deps?.client) return deps.client;
  const url = deps?.supabaseUrl     ?? (import.meta.env.VITE_SUPABASE_URL      as string | undefined);
  const key = deps?.supabaseAnonKey ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);
  if (!url || !key) {
    throw new AiGatewayEdgeError(503, 'AI_GATEWAY_NOT_CONFIGURED',
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen.');
  }
  return new AiGatewayEdgeClient({ supabaseUrl: url, apiKey: key });
}

function checkRateLimit(now: number): { allowed: boolean; retryAfterMs: number } {
  const windowMs = 60_000;
  // Drop timestamps older than 60 s.
  while (sendTimestamps.length > 0 && sendTimestamps[0]! < now - windowMs) {
    sendTimestamps.shift();
  }
  if (sendTimestamps.length >= QUICK_CHAT_LIMITS.rateLimitPerMinute) {
    const oldest = sendTimestamps[0]!;
    return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
  }
  return { allowed: true, retryAfterMs: 0 };
}

function findPiiPattern(text: string): string | null {
  for (const p of PII_PATTERNS) {
    if (p.re.test(text)) return p.name;
  }
  return null;
}

/**
 * Send a quick-chat message and return a structured result.
 *
 * Guards (client-side, BEFORE network call):
 *   - message length cap
 *   - turn cap on history
 *   - rate-limit sliding window
 *   - PII pattern block
 *
 * On gateway error, returns `{ kind: 'error' }` with the upstream code
 * and message so the modal can render a useful bubble instead of
 * crashing.
 */
export async function sendQuickChat(
  args: SendQuickChatArgs,
  deps?: QuickChatDeps,
): Promise<QuickChatResult> {
  const now = (deps?.now ?? Date.now)();

  if (args.message.length > QUICK_CHAT_LIMITS.maxMessageLength) {
    return { kind: 'too_long' };
  }
  if (args.history.filter((m) => m.role === 'user').length >= QUICK_CHAT_LIMITS.maxTurns) {
    return { kind: 'turn_cap' };
  }
  const piiHit = findPiiPattern(args.message);
  if (piiHit) {
    return { kind: 'pii_blocked', pattern: piiHit };
  }
  const rate = checkRateLimit(now);
  if (!rate.allowed) {
    return { kind: 'rate_limited', retryAfterMs: rate.retryAfterMs };
  }

  // Record the send attempt BEFORE issuing the network call so a
  // failed call still counts against the budget (mirrors server
  // behaviour and prevents abusive retry loops).
  sendTimestamps.push(now);

  const client = resolveClient(deps);
  const folded = [...args.history, { role: 'user' as const, content: args.message }]
    .slice(-QUICK_CHAT_LIMITS.historyContextTurns * 2)
    .map((m) => `${m.role === 'user' ? 'Besucher' : 'Assistent'}: ${m.content}`)
    .join('\n\n');

  try {
    const resp = await client.generate({
      feature:       'assistant_chip_quick_chat',
      task_type:     'chat',
      model_profile: 'fast-local',
      input:         folded,
      system_prompt: SYSTEM_PROMPT,
      max_tokens:    512,
      temperature:   0.4,
    });
    const reply = resp.output.trim() || '(Keine Antwort generiert.)';
    return {
      kind: 'ok',
      reply,
      history: [
        ...args.history,
        { role: 'user',      content: args.message },
        { role: 'assistant', content: reply },
      ],
    };
  } catch (err) {
    if (err instanceof AiGatewayEdgeError) {
      return { kind: 'error', code: err.code, message: err.message };
    }
    return { kind: 'error', code: 'NETWORK', message: err instanceof Error ? err.message : 'unknown' };
  }
}

export { AiGatewayEdgeError };

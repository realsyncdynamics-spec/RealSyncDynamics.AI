/**
 * @file gateway.ts
 * @description Browser-seitiger Einstieg in die AI-Gateway-Edge-Function.
 *
 * Warum diese Datei ueber die Edge-Function laeuft und nicht selbst Modelle
 * ruft: Der Browser spricht nie direkt mit privilegierten Ressourcen
 * (CLAUDE.md §2). Provider-Zugangsdaten liegen ausschliesslich in
 * `supabase/functions/ai-gateway` (Deno.env), niemals in `VITE_*`.
 *
 * Vorher lieferte diese Datei fuer `openai` und `claude` fest verdrahtete
 * Platzhaltertexte mit `success: true` zurueck — also erfundene Antworten,
 * die in der Oberflaeche wie echte Modellausgaben aussahen. Fuer ein
 * Governance-Produkt ist das ein Befund, kein Provisorium: Es gibt keinen
 * Zustand, in dem eine erfundene Compliance-Auskunft akzeptabel ist.
 * Seitdem gilt: entweder eine echte Modellantwort oder ein ehrlicher Fehler.
 */
import { AiGatewayEdgeClient, AiGatewayEdgeError, type EdgeClientAuth } from './edgeClient';
import { getSupabaseUrl, getSupabaseAnonKey } from '../../lib/supabaseUrl';
import { edgeFunctionUrl, fnFetchInit } from '../../lib/fn-proxy';
import { getSupabase } from '../../lib/supabase';
import type { ModelProfile } from './types';

export type ModelProvider = 'gemini' | 'openai' | 'claude';
export type GatewayAuthMode = 'user' | 'anon' | 'legacy';

export interface GatewayRequest {
  prompt: string;
  provider: ModelProvider;
  /** Seitenkontext (z. B. markierter Text). */
  context?: string;
  /** Persona/Rollen-Override (z. B. Kodee VPS Sidekick). */
  systemPrompt?: string;
  /** Analytics-Name des aufrufenden Features, landet im Gateway-Trace. */
  feature?: string;
  /** Optionaler Mandantenbezug fuer die Gateway-Telemetrie. */
  tenantId?: string | null;
  /** Auth mode for ai-gateway calls. Defaults to user JWT. */
  authMode?: GatewayAuthMode;
  timeoutMs?: number;
  maxTokens?: number;
  /** Client-only: stop consuming the stream. Never sent to the Edge Function. */
  signal?: AbortSignal;
}

export interface GatewayResult {
  success: boolean;
  /** Der Provider, der tatsaechlich geantwortet hat — nicht der angefragte. */
  provider?: string;
  model?: string;
  modelOutput?: string;
  tokensUsed?: number;
  /** Preserves legacy error rendering shape (`<CODE>: <message>`). */
  error?: string;
  errorCode?: string;
  status?: number;
  retryAfter?: number;
}

/**
 * Zuordnung der UI-Providerwahl auf ein Modellprofil des Gateways.
 *
 * `null` heisst: Das Gateway kann diesen Provider heute nicht bedienen.
 * Stand `src/core/ai-gateway/config.ts` faehrt kein Profil auf Anthropic,
 * und Google/Gemini ist dort ueberhaupt kein Provider. Diese beiden Faelle
 * werden deshalb ehrlich abgelehnt statt still auf ein anderes Modell
 * umgebogen — sonst stuende in der Oberflaeche „Claude" ueber einer
 * Antwort, die ein anderes Modell erzeugt hat.
 */
const PROFILE_BY_PROVIDER: Record<ModelProvider, ModelProfile | null> = {
  openai: 'cloud-fallback',
  claude: null,
  gemini: null,
};

const UNAVAILABLE_HINT =
  'Ueber das EU-Gateway ist derzeit nur OpenAI erreichbar — bitte diesen Provider waehlen.';

/**
 * Test-Hook nach dem Vorbild von `features/assistant/assistantQuickChatApi`:
 * erlaubt das Einsetzen eines Doubles, damit die Zuordnungs- und
 * Fehlerlogik ohne Netzwerk pruefbar ist. In Produktionscode nicht setzen.
 */
export interface GatewayDeps {
  client?: Pick<AiGatewayEdgeClient, 'generate'> & Partial<Pick<AiGatewayEdgeClient, 'stream'>>;
  resolveUserAccessToken?: () => Promise<string | null | undefined>;
}

function formatError(code: string, message: string): string {
  return `${code}: ${message}`;
}

function gatewayFailure(args: {
  status?: number;
  errorCode: string;
  message: string;
  retryAfter?: number;
}): GatewayResult {
  return {
    success: false,
    status: args.status,
    errorCode: args.errorCode,
    retryAfter: args.retryAfter,
    error: formatError(args.errorCode, args.message),
  };
}

function sanitizeTenantId(tenantId?: string | null): string | null {
  if (typeof tenantId !== 'string') return null;
  const trimmed = tenantId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveUserAccessToken(deps?: GatewayDeps): Promise<string | null> {
  if (deps?.resolveUserAccessToken) {
    const token = await deps.resolveUserAccessToken();
    return typeof token === 'string' && token.trim() ? token : null;
  }
  const { data: { session } } = await getSupabase().auth.getSession();
  return session?.access_token?.trim() ? session.access_token : null;
}

async function resolveClientAuth(
  authMode: GatewayAuthMode,
  tenantId: string | null,
  deps?: GatewayDeps,
): Promise<{ auth: EdgeClientAuth; tenantId: string | null } | GatewayResult> {
  if (authMode === 'user') {
    if (!tenantId) {
      return gatewayFailure({
        status: 400,
        errorCode: 'BAD_REQUEST',
        message: 'tenant_id is required',
      });
    }

    const accessToken = await resolveUserAccessToken(deps);
    if (!accessToken) {
      return gatewayFailure({
        status: 401,
        errorCode: 'UNAUTHORIZED',
        message: 'Kein gültiger Login gefunden. Bitte erneut anmelden.',
      });
    }

    return {
      auth: { mode: 'user', accessToken },
      tenantId,
    };
  }

  if (authMode === 'anon') {
    return {
      auth: { mode: 'anon' },
      tenantId,
    };
  }

  return {
    auth: { mode: 'legacy' },
    tenantId,
  };
}

/**
 * `authMode` defaults to `user` so Kodee and Builder use session JWT auth.
 * Other callers can opt into `anon` or `legacy` explicitly.
 */
function resolveAuthMode(req: GatewayRequest): GatewayAuthMode {
  return req.authMode ?? 'user';
}

export async function processAIGatewayRequest(
  req: GatewayRequest,
  deps?: GatewayDeps,
): Promise<GatewayResult> {
  const profile = PROFILE_BY_PROVIDER[req.provider];
  if (!profile) {
    return gatewayFailure({
      status: 400,
      errorCode: 'BAD_REQUEST',
      message: `Provider „${req.provider}" ist im AI-Gateway nicht konfiguriert. ${UNAVAILABLE_HINT}`,
    });
  }

  const input = req.context
    ? `Hier ist der Inhalt einer Webseite:\n"""\n${req.context}\n"""\n\nFrage/Aufgabe des Nutzers:\n${req.prompt}`
    : req.prompt;

  if (import.meta.env.DEV) {
    console.debug(`[AI-Gateway] Routing Anfrage an Profil: ${profile}`);
  }

  try {
    const authMode = resolveAuthMode(req);
    const auth = await resolveClientAuth(authMode, sanitizeTenantId(req.tenantId), deps);
    if ('success' in auth) return auth;

    const client = deps?.client ?? new AiGatewayEdgeClient({
      supabaseUrl: getSupabaseUrl(),
      apiKey: getSupabaseAnonKey(),
      auth: auth.auth,
      endpoint: edgeFunctionUrl('ai-gateway'),
      fetchImpl: (input, init) => fetch(input, fnFetchInit(String(input), init)),
    });

    const resp = await client.generate({
      tenant_id: auth.tenantId,
      feature: req.feature ?? 'ai_gateway_chat',
      task_type: 'chat',
      model_profile: profile,
      input,
      system_prompt: req.systemPrompt,
      timeout_ms: req.timeoutMs,
      max_tokens: req.maxTokens,
    });

    const usage = resp.usage;
    return {
      success: true,
      provider: resp.provider,
      model: resp.model,
      modelOutput: resp.output,
      tokensUsed:
        usage?.total_tokens ?? (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    };
  } catch (error: unknown) {
    if (error instanceof AiGatewayEdgeError) {
      return gatewayFailure({
        status: error.status,
        errorCode: error.code,
        message: error.message,
        retryAfter: error.retryAfter,
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    return gatewayFailure({
      status: 500,
      errorCode: 'GATEWAY_ERROR',
      message: message || 'Gateway Error',
    });
  }
}

/**
 * Token stream over the same Edge Function (`op: 'stream'`).
 * Deltas are provider tokens. Keys never enter the browser.
 */
export async function processAIGatewayStream(
  req: GatewayRequest,
  onDelta: (full: string) => void,
  deps?: GatewayDeps,
): Promise<GatewayResult> {
  const profile = PROFILE_BY_PROVIDER[req.provider];
  if (!profile) {
    return gatewayFailure({
      status: 400,
      errorCode: 'BAD_REQUEST',
      message: `Provider „${req.provider}" ist im AI-Gateway nicht konfiguriert. ${UNAVAILABLE_HINT}`,
    });
  }

  const input = req.context
    ? `Hier ist der Inhalt einer Webseite:\n"""\n${req.context}\n"""\n\nFrage/Aufgabe des Nutzers:\n${req.prompt}`
    : req.prompt;

  try {
    const authMode = resolveAuthMode(req);
    const auth = await resolveClientAuth(authMode, sanitizeTenantId(req.tenantId), deps);
    if ('success' in auth) return auth;

    const client = deps?.client ?? new AiGatewayEdgeClient({
      supabaseUrl: getSupabaseUrl(),
      apiKey: getSupabaseAnonKey(),
      auth: auth.auth,
      timeoutMs: req.timeoutMs ?? 90_000,
      endpoint: edgeFunctionUrl('ai-gateway'),
      fetchImpl: (input, init) => fetch(input, fnFetchInit(String(input), init)),
    });
    if (typeof client.stream !== 'function') {
      const fallback = await processAIGatewayRequest(req, deps);
      if (fallback.success && fallback.modelOutput) onDelta(fallback.modelOutput);
      return fallback;
    }

    let text = '';
    let provider: string | undefined;
    let model: string | undefined;
    let tokensUsed: number | undefined;
    for await (const chunk of client.stream({
      tenant_id: auth.tenantId,
      feature: req.feature ?? 'ai_gateway_chat',
      task_type: 'chat',
      model_profile: profile,
      input,
      system_prompt: req.systemPrompt,
      timeout_ms: req.timeoutMs ?? 90_000,
      max_tokens: req.maxTokens ?? 4096,
    })) {
      if (req.signal?.aborted) {
        return gatewayFailure({
          status: 499,
          errorCode: 'ABORTED',
          message: 'Abgebrochen. Es wurde nichts geschrieben.',
        });
      }
      if (chunk.event === 'delta' && chunk.text) {
        text += chunk.text;
        onDelta(text);
      }
      if (chunk.event === 'done') {
        provider = chunk.provider;
        model = chunk.model;
        tokensUsed = chunk.usage?.total_tokens
          ?? (chunk.usage?.input_tokens ?? 0) + (chunk.usage?.output_tokens ?? 0);
      }
    }
    if (!text.trim()) {
      return gatewayFailure({
        status: 502,
        errorCode: 'UPSTREAM_BAD_OUTPUT',
        message: 'Gateway ohne Ausgabe',
      });
    }
    return { success: true, provider, model, modelOutput: text, tokensUsed };
  } catch (error: unknown) {
    if (error instanceof AiGatewayEdgeError) {
      return gatewayFailure({
        status: error.status,
        errorCode: error.code,
        message: error.message,
        retryAfter: error.retryAfter,
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    return gatewayFailure({
      status: 500,
      errorCode: 'GATEWAY_ERROR',
      message: message || 'Gateway Error',
    });
  }
}

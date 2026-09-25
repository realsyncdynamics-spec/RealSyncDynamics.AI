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
import { AiGatewayEdgeClient, AiGatewayEdgeError } from './edgeClient';
import { getSupabaseUrl, getSupabaseAnonKey } from '../../lib/supabaseUrl';
import { edgeFunctionUrl, fnFetchInit } from '../../lib/fn-proxy';
import { getSupabase } from '../../lib/supabase';
import type { ModelProfile } from './types';

export type ModelProvider = 'gemini' | 'openai' | 'claude';

export interface GatewayRequest {
  prompt: string;
  provider: ModelProvider;
  /** Seitenkontext (z. B. markierter Text). */
  context?: string;
  /** Persona/Rollen-Override (z. B. Kodee VPS Sidekick). */
  systemPrompt?: string;
  /** Analytics-Name des aufrufenden Features, landet im Gateway-Trace. */
  feature?: string;
  /**
   * Aktiver Workspace. Pflicht (Vertrag RSD Backend): Der Server prueft die
   * Mitgliedschaft. Fehlt er, geht keine Anfrage raus (BAD_REQUEST).
   */
  tenantId?: string | null;
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
  error?: string;
  /** Maschinenlesbarer Fehlercode des Gateways (z. B. UNAUTHORIZED, FORBIDDEN, RATE_LIMITED). */
  errorCode?: string;
  /** HTTP-Status des Fehlers, falls vom Gateway. */
  status?: number;
  /**
   * Sekunden bis zum naechsten Versuch: bevorzugt `error.retry_after_ms`
   * (aufgerundet), sonst `Retry-After`. Nur wenn der Gateway etwas sendet.
   */
  retryAfter?: number;
  /** 429: Geltungsbereich des Limits aus `error.scope` (z. B. user/tenant). */
  errorScope?: string;
}

/**
 * Aktuelles Nutzer-JWT. `getSession()` erneuert ein abgelaufenes Token
 * selbst; ohne Sitzung `null` — dann sendet der Client nichts (UNAUTHORIZED).
 */
async function currentAccessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Client im Nutzer-Modus (Vertrag #1591): Sitzungs-JWT als Bearer, Anon-Key
 * nur als `apikey`. Ohne Sitzung wird nichts gesendet — kein Rueckfall auf anon.
 */
function userClient(timeoutMs?: number): AiGatewayEdgeClient {
  return new AiGatewayEdgeClient({
    supabaseUrl: getSupabaseUrl(),
    apiKey: getSupabaseAnonKey(),
    authToken: currentAccessToken,
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    endpoint: edgeFunctionUrl('ai-gateway'),
    fetchImpl: (input, init) => fetch(input, fnFetchInit(String(input), init)),
  });
}

function failureFrom(error: unknown): GatewayResult {
  if (error instanceof AiGatewayEdgeError) {
    return {
      success: false,
      error: `${error.code}: ${error.message}`,
      errorCode: error.code,
      status: error.status,
      ...(error.retryAfter !== undefined ? { retryAfter: error.retryAfter } : {}),
      ...(error.scope !== undefined ? { errorScope: error.scope } : {}),
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, error: message || 'Gateway Error' };
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
}

export async function processAIGatewayRequest(
  req: GatewayRequest,
  deps?: GatewayDeps,
): Promise<GatewayResult> {
  const profile = PROFILE_BY_PROVIDER[req.provider];
  if (!profile) {
    return {
      success: false,
      error: `Provider „${req.provider}" ist im AI-Gateway nicht konfiguriert. ${UNAVAILABLE_HINT}`,
    };
  }

  const input = req.context
    ? `Hier ist der Inhalt einer Webseite:\n"""\n${req.context}\n"""\n\nFrage/Aufgabe des Nutzers:\n${req.prompt}`
    : req.prompt;

  if (import.meta.env.DEV) {
    console.debug(`[AI-Gateway] Routing Anfrage an Profil: ${profile}`);
  }

  try {
    const client = deps?.client ?? userClient();

    const resp = await client.generate({
      tenant_id: req.tenantId ?? null,
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
    return failureFrom(error);
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
    return {
      success: false,
      error: `Provider „${req.provider}" ist im AI-Gateway nicht konfiguriert. ${UNAVAILABLE_HINT}`,
    };
  }

  const input = req.context
    ? `Hier ist der Inhalt einer Webseite:\n"""\n${req.context}\n"""\n\nFrage/Aufgabe des Nutzers:\n${req.prompt}`
    : req.prompt;

  try {
    const client = deps?.client ?? userClient(req.timeoutMs ?? 90_000);
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
      tenant_id: req.tenantId ?? null,
      feature: req.feature ?? 'ai_gateway_chat',
      task_type: 'chat',
      model_profile: profile,
      input,
      system_prompt: req.systemPrompt,
      timeout_ms: req.timeoutMs ?? 90_000,
      max_tokens: req.maxTokens ?? 4096,
    })) {
      if (req.signal?.aborted) {
        return { success: false, error: 'Abgebrochen. Es wurde nichts geschrieben.' };
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
      return { success: false, error: 'Gateway ohne Ausgabe' };
    }
    return { success: true, provider, model, modelOutput: text, tokensUsed };
  } catch (error: unknown) {
    return failureFrom(error);
  }
}

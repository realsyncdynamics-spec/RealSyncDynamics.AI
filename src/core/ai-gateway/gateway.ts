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
  /** Optionaler Mandantenbezug fuer die Gateway-Telemetrie. */
  tenantId?: string | null;
}

export interface GatewayResult {
  success: boolean;
  /** Der Provider, der tatsaechlich geantwortet hat — nicht der angefragte. */
  provider?: string;
  model?: string;
  modelOutput?: string;
  tokensUsed?: number;
  error?: string;
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
  client?: Pick<AiGatewayEdgeClient, 'generate'>;
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
    const client = deps?.client ?? new AiGatewayEdgeClient({
      supabaseUrl: getSupabaseUrl(),
      apiKey: getSupabaseAnonKey(),
    });

    const resp = await client.generate({
      tenant_id: req.tenantId ?? null,
      feature: req.feature ?? 'ai_gateway_chat',
      task_type: 'chat',
      model_profile: profile,
      input,
      system_prompt: req.systemPrompt,
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
      return { success: false, error: `${error.code}: ${error.message}` };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message || 'Gateway Error' };
  }
}

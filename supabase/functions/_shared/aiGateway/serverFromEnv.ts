import { ServerAiGateway } from './router.ts';
import { OllamaAdapter } from './ollamaAdapter.ts';

/**
 * Gemeinsamer Gateway-Bau für `ai-gateway` und `governance-router`.
 *
 * Lokaler Provider (der „primäre"/EU-lokale Slot) ist per `AI_LOCAL_PROVIDER`
 * wählbar:
 *   - `lm_studio` (Default) → LM_STUDIO_BASE_URL, bisheriges Verhalten
 *   - `ollama`              → OLLAMA_BASE_URL, Ollama-Adapter (CLAUDE.md §2:
 *                             „Ollama (EU-lokal, Fallback)")
 * Default bleibt `lm_studio` → ohne bewusstes Umschalten byte-identisch.
 *
 * Cloud-Adapter nur, wenn `allowCloudFallback` wahr ist UND ein Key vorliegt.
 * Ohne lokalen Host:
 *   - requireLmStudio=true  → Fehler (bisheriges ai-gateway-Verhalten)
 *   - requireLmStudio=false → Dummy-URL, der Transport scheitert und die Kette
 *     fällt auf Anthropic/OpenAI (Scale+ ohne lokalen Host).
 */

export type GatewayBuildOk = { ok: true; gateway: ServerAiGateway };
export type GatewayBuildErr = {
  ok: false;
  status: 503;
  code: 'LM_STUDIO_NOT_CONFIGURED' | 'LOCAL_NOT_CONFIGURED' | 'NO_PROVIDER';
  message: string;
};
export type GatewayBuild = GatewayBuildOk | GatewayBuildErr;

export type LocalProvider = 'lm_studio' | 'ollama';

/** Gewählter lokaler Inferenz-Provider aus der Umgebung. Default `lm_studio`. */
export function resolveLocalProvider(): LocalProvider {
  return (Deno.env.get('AI_LOCAL_PROVIDER') ?? 'lm_studio').trim().toLowerCase() === 'ollama'
    ? 'ollama'
    : 'lm_studio';
}

/**
 * Art.-50-Offenlegungslabel des lokalen Inferenz-Providers. Muss den real
 * bedienenden Provider nennen — sonst behauptet die Offenlegung einen falschen
 * Verarbeiter (EU-KI-VO Art. 50).
 */
export function localInferenceLabel(provider: LocalProvider = resolveLocalProvider()): string {
  return provider === 'ollama'
    ? 'EU-lokale Inferenz (Ollama)'
    : 'EU-lokale Inferenz (LM Studio)';
}

const ANTHROPIC_FALLBACK_MODEL =
  Deno.env.get('AI_GATEWAY_ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';
const OPENAI_FALLBACK_MODEL =
  Deno.env.get('AI_GATEWAY_OPENAI_MODEL') ?? 'gpt-4.1-mini';
const OPENAI_EMBEDDING_MODEL =
  Deno.env.get('AI_GATEWAY_OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';

// Ollama-Modelle: der Router nutzt EINEN lokalen Adapter für alle lokalen
// Profile, daher genau ein Chat- + ein Embedding-Modell (keine fast/quality-
// Trennung im lokalen Slot). Beide per Env überschreibbar.
const OLLAMA_MODEL = Deno.env.get('OLLAMA_MODEL') ?? 'llama3.1:8b';
const OLLAMA_EMBED_MODEL = Deno.env.get('OLLAMA_EMBED_MODEL') ?? 'nomic-embed-text';

export async function createServerGatewayFromEnv(opts: {
  allowCloudFallback: boolean;
  requireLmStudio?: boolean;
}): Promise<GatewayBuild> {
  const requireLocal = opts.requireLmStudio ?? true;
  const localProvider = resolveLocalProvider();
  const localBaseUrl = localProvider === 'ollama'
    ? (Deno.env.get('OLLAMA_BASE_URL') ?? Deno.env.get('OLLAMA_URL'))
    : Deno.env.get('LM_STUDIO_BASE_URL');

  if (!localBaseUrl && requireLocal) {
    return {
      ok: false,
      status: 503,
      code: localProvider === 'ollama' ? 'LOCAL_NOT_CONFIGURED' : 'LM_STUDIO_NOT_CONFIGURED',
      message: localProvider === 'ollama'
        ? 'OLLAMA_BASE_URL/OLLAMA_URL not set'
        : 'LM_STUDIO_BASE_URL not set',
    };
  }

  let anthropicKey: string | null = null;
  let openaiKey: string | null = null;
  if (opts.allowCloudFallback) {
    [anthropicKey, openaiKey] = await Promise.all([
      (async () =>
        Deno.env.get('ANTHROPIC_API_KEY')
        ?? (await readVaultSecret('ANTHROPIC_API_KEY'))
        ?? (await readVaultSecret('anthropic_api_key')))(),
      (async () =>
        Deno.env.get('OPENAI_API_KEY')
        ?? (await readVaultSecret('OPENAI_API_KEY'))
        ?? (await readVaultSecret('openai_api_key')))(),
    ]);
  }

  if (!localBaseUrl && !anthropicKey && !openaiKey) {
    return {
      ok: false,
      status: 503,
      code: 'NO_PROVIDER',
      message: 'neither a local provider nor a cloud fallback is configured',
    };
  }

  // Ollama als lokalen Slot injizieren, wenn gewählt UND konfiguriert. Sonst
  // baut ServerAiGateway den Default-LM-Studio-Adapter aus lmStudioBaseUrl.
  const localAdapter = localProvider === 'ollama' && localBaseUrl
    ? new OllamaAdapter({
        baseUrl: localBaseUrl,
        model: OLLAMA_MODEL,
        embeddingModel: OLLAMA_EMBED_MODEL,
        authToken: Deno.env.get('OLLAMA_AUTH_TOKEN') ?? undefined,
        authMode: parseOllamaAuthMode(Deno.env.get('OLLAMA_AUTH_MODE')),
      })
    : undefined;

  return {
    ok: true,
    gateway: new ServerAiGateway({
      lmStudio: localAdapter,
      lmStudioBaseUrl: localBaseUrl ?? 'http://127.0.0.1:1',
      lmStudioApiKey: Deno.env.get('LM_STUDIO_API_KEY') ?? 'lm-studio',
      anthropicConfig: anthropicKey
        ? { apiKey: anthropicKey, model: ANTHROPIC_FALLBACK_MODEL }
        : undefined,
      openaiConfig: openaiKey
        ? {
            apiKey: openaiKey,
            model: OPENAI_FALLBACK_MODEL,
            embeddingModel: OPENAI_EMBEDDING_MODEL,
          }
        : undefined,
    }),
  };
}

async function readVaultSecret(name: string): Promise<string | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srk) return null;
  try {
    const { createClient } = await import('jsr:@supabase/supabase-js@2');
    const admin = createClient(url, srk, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc('get_app_secret', { secret_name: name });
    if (error) return null;
    return typeof data === 'string' && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}


function parseOllamaAuthMode(value: string | undefined): 'basic' | 'bearer' | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'basic' || normalized === 'bearer') return normalized;
  return undefined;
}

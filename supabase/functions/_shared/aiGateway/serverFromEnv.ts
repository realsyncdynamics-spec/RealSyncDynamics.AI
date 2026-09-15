import { ServerAiGateway } from './router.ts';

/**
 * Gemeinsamer Gateway-Bau für `ai-gateway` und `governance-router`.
 *
 * Cloud-Adapter nur, wenn `allowCloudFallback` wahr ist UND ein Key
 * vorliegt. Ohne LM Studio:
 *   - requireLmStudio=true  → Fehler (bisheriges ai-gateway-Verhalten)
 *   - requireLmStudio=false → Dummy-URL, der Transport scheitert und die
 *     Kette fällt auf Anthropic/OpenAI (Scale+ ohne lokalen Host).
 */

export type GatewayBuildOk = { ok: true; gateway: ServerAiGateway };
export type GatewayBuildErr = {
  ok: false;
  status: 503;
  code: 'LM_STUDIO_NOT_CONFIGURED' | 'NO_PROVIDER';
  message: string;
};
export type GatewayBuild = GatewayBuildOk | GatewayBuildErr;

const ANTHROPIC_FALLBACK_MODEL =
  Deno.env.get('AI_GATEWAY_ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';
const OPENAI_FALLBACK_MODEL =
  Deno.env.get('AI_GATEWAY_OPENAI_MODEL') ?? 'gpt-4.1-mini';
const OPENAI_EMBEDDING_MODEL =
  Deno.env.get('AI_GATEWAY_OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';

export async function createServerGatewayFromEnv(opts: {
  allowCloudFallback: boolean;
  requireLmStudio?: boolean;
}): Promise<GatewayBuild> {
  const requireLmStudio = opts.requireLmStudio ?? true;
  const baseUrl = Deno.env.get('LM_STUDIO_BASE_URL');

  if (!baseUrl && requireLmStudio) {
    return {
      ok: false,
      status: 503,
      code: 'LM_STUDIO_NOT_CONFIGURED',
      message: 'LM_STUDIO_BASE_URL not set',
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

  if (!baseUrl && !anthropicKey && !openaiKey) {
    return {
      ok: false,
      status: 503,
      code: 'NO_PROVIDER',
      message: 'neither LM Studio nor a cloud fallback is configured',
    };
  }

  return {
    ok: true,
    gateway: new ServerAiGateway({
      lmStudioBaseUrl: baseUrl ?? 'http://127.0.0.1:1',
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

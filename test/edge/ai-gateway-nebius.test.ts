import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NEBIUS_DEFAULT_BASE_URL,
  NebiusAdapter,
  normalizeNebiusBaseUrl,
} from '../../supabase/functions/_shared/aiGateway/nebiusAdapter';
import { resolveResidencyAndRegion } from '../../supabase/functions/_shared/aiGateway/callEvidence';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function mockFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const baseRequest = {
  feature: 'test',
  task_type: 'chat' as const,
  model_profile: 'fast-local' as const,
  input: 'Hallo',
};

describe('Nebius adapter (Gateway v2)', () => {
  it('normalisiert die Basis-URL ohne /v1 und ohne Slash', () => {
    expect(normalizeNebiusBaseUrl(undefined)).toBe(NEBIUS_DEFAULT_BASE_URL);
    expect(normalizeNebiusBaseUrl('https://api.tokenfactory.eu-south1.nebius.com/v1/'))
      .toBe('https://api.tokenfactory.eu-south1.nebius.com');
    expect(NEBIUS_DEFAULT_BASE_URL).toBe('https://api.tokenfactory.eu-south1.nebius.com');
  });

  it('ruft /v1/chat/completions mit Bearer-Key auf und meldet provider=nebius', async () => {
    const { impl, calls } = mockFetch(200, {
      model: 'm',
      choices: [{ message: { content: 'Antwort' } }],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    });
    const adapter = new NebiusAdapter({ apiKey: 'k', model: 'm', fetchImpl: impl });
    const res = await adapter.generate(baseRequest);
    expect(res.provider).toBe('nebius');
    expect(res.output).toBe('Antwort');
    expect(calls[0].url).toBe(`${NEBIUS_DEFAULT_BASE_URL}/v1/chat/completions`);
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer k');
    expect(JSON.parse(String(calls[0].init.body)).model).toBe('m');
  });

  it('benennt Fehler als Nebius, nicht OpenAI', async () => {
    const { impl } = mockFetch(500, {});
    const adapter = new NebiusAdapter({ apiKey: 'k', fetchImpl: impl });
    await expect(adapter.generate(baseRequest)).rejects.toThrow('Nebius HTTP 500');
  });

  it('health meldet fehlenden Key', async () => {
    const adapter = new NebiusAdapter({ apiKey: '' });
    expect((await adapter.health()).ok).toBe(false);
  });

  it('Evidence führt Nebius als cloud, nie als eu_local', () => {
    expect(resolveResidencyAndRegion('nebius', undefined, undefined, 'eu'))
      .toEqual({ residency: 'cloud', providerRegion: 'cloud' });
  });
});

describe('Nebius-Verdrahtung', () => {
  const env = read('supabase/functions/_shared/aiGateway/serverFromEnv.ts');
  const index = read('supabase/functions/ai-gateway/index.ts');

  it('liest NEBIUS_API_KEY aus Edge-Secret oder Vault, fail-closed 503', () => {
    expect(env).toContain("Deno.env.get('NEBIUS_API_KEY')");
    expect(env).toContain("readVaultSecret('NEBIUS_API_KEY')");
    expect(env).toContain("code: 'NEBIUS_NOT_CONFIGURED'");
  });

  it('schaltet nur über AI_GATEWAY_PROVIDER, nicht über AI_LOCAL_PROVIDER', () => {
    expect(index).toContain("parsePrimaryProvider(Deno.env.get('AI_GATEWAY_PROVIDER'))");
    expect(index).toContain('primaryProvider: PRIMARY_PROVIDER');
    expect(index).toContain('allowCloudFallback: false');
  });
});

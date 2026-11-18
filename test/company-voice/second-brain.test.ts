import { describe, expect, it, vi } from 'vitest';
import { handleCompanyVoiceRequest } from '../../src/lib/company-voice/endpoint';
import { loadCompanyFacts, resolveAiAccess, resolveStagingCompanyUrl } from '../../src/lib/company-voice/second-brain';
import type { CompanyVoiceEnv } from '../../src/lib/company-voice/types';

const staging: CompanyVoiceEnv = {
  SECOND_BRAIN_READ_ENABLED: 'true',
  SECOND_BRAIN_STAGING_URL: 'https://realsync-second-brain-staging.vercel.app/secret/bucket',
  SECOND_BRAIN_AI_ENABLED: 'true',
};

describe('Second-Brain-Lesen', () => {
  it('lässt Production- und Nicht-Staging-URLs nicht zu', () => {
    expect(resolveStagingCompanyUrl({})).toBeNull();
    expect(resolveStagingCompanyUrl({
      SECOND_BRAIN_READ_ENABLED: 'true',
      SECOND_BRAIN_STAGING_URL: 'https://realsync-second-brain.vercel.app',
    })).toBeNull();
    expect(resolveStagingCompanyUrl({
      SECOND_BRAIN_READ_ENABLED: 'true',
      SECOND_BRAIN_STAGING_URL: 'https://realsyncdynamics.ai',
    })).toBeNull();
    expect(resolveStagingCompanyUrl({
      SECOND_BRAIN_READ_ENABLED: 'true',
      SECOND_BRAIN_STAGING_URL: 'http://staging.example.com',
    })).toBeNull();
  });

  it('liest nur GET /api/public/company und fällt ohne Erreichbarkeit auf kuratierte Fakten zurück', async () => {
    const url = resolveStagingCompanyUrl(staging);
    expect(url?.href).toBe('https://realsync-second-brain-staging.vercel.app/api/public/company');
    expect(resolveAiAccess(staging, url)).toBe('staging-flag-ignored');
    expect(resolveAiAccess(staging, null)).toBe('refused-not-staging');
    expect(resolveAiAccess({}, url)).toBe('disabled');

    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input));
      expect(init?.method).toBe('GET');
      expect(init?.redirect).toBe('error');
      return new Response(JSON.stringify({
        module: 'time-manager',
        facts: [{ id: 'timeManager.publicNote', text: 'Time Manager: nur diese freigegebene Zeile.' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    });

    const loaded = await loadCompanyFacts(staging, { fetchImpl });
    expect(calls).toEqual(['https://realsync-second-brain-staging.vercel.app/api/public/company']);
    expect(loaded.source).toBe('second-brain-staging');
    expect(loaded.ai).toBe('disabled');
    expect(loaded.facts.some((fact) => fact.text.includes('freigegebene Zeile'))).toBe(true);

    const down = await loadCompanyFacts(staging, {
      fetchImpl: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    expect(down.source).toBe('curated');
    expect(down.ai).toBe('disabled');
    expect(down.facts.some((fact) => fact.id === 'timeManager.publicNote')).toBe(false);
  });

  it('bricht langsame Antworten ab', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const loaded = await loadCompanyFacts(staging, { fetchImpl, timeoutMs: 20 });
    expect(loaded.source).toBe('curated');
  });
});

describe('Endpunkt', () => {
  it('erlaubt nur GET und begrenzt die Rate', async () => {
    const store = new Map<string, number[]>();
    const post = await handleCompanyVoiceRequest(new Request('https://realsyncdynamics.ai/api/company-voice', { method: 'POST' }), {}, { store });
    expect(post.status).toBe(405);

    const env: CompanyVoiceEnv = {};
    for (let index = 0; index < 20; index += 1) {
      const ok = await handleCompanyVoiceRequest(new Request('https://realsyncdynamics.ai/api/company-voice'), env, {
        store,
        now: () => 1_000,
      });
      expect(ok.status).toBe(200);
      const body = await ok.json();
      expect(body.ai).toBe('disabled');
      expect(body.source).toBe('curated');
    }
    const limited = await handleCompanyVoiceRequest(new Request('https://realsyncdynamics.ai/api/company-voice'), env, {
      store,
      now: () => 1_000,
    });
    expect(limited.status).toBe(429);
  });
});

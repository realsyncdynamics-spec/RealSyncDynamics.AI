import { describe, expect, it, vi } from 'vitest';
import {
  assertProviderMediaUrl,
  estimatedProviderUsd,
  parseImageRequest,
  parseVideoRequest,
  parseVideoRequestId,
} from '../../supabase/functions/_shared/xaiImagine/contract';
import {
  XaiImagineProviderError,
  XaiImagineTransport,
} from '../../supabase/functions/_shared/xaiImagine/client';
import {
  generateImageWithBudget,
  ImagineBudgetConfigurationError,
  pollVideoWithBudget,
  startVideoWithBudget,
} from '../../supabase/functions/_shared/xaiImagine/guarded';

function mockFetch(body: unknown, status = 200) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  }));
}

function transport(fake: ReturnType<typeof mockFetch>) {
  return new XaiImagineTransport({ enabled: true, apiKey: 'local-test-secret', fetchImpl: fake as unknown as typeof fetch });
}

function fakeBudget() {
  return {
    reserve: vi.fn(async (_usd: number): Promise<string | null> => 'reservation-1'),
    settleMeasured: vi.fn(async () => undefined),
    settleUnknown: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  };
}

describe('xAI Imagine: strict request contracts', () => {
  it('sanitizes image generation fields and pins one URL image', () => {
    expect(parseImageRequest({ prompt: '  landscape ', api_key: 'attacker', n: 1 })).toEqual({
      model: 'grok-imagine-image-2.0',
      prompt: 'landscape',
      n: 1, aspect_ratio: 'auto', resolution: '1k', quality: 'low', response_format: 'url',
    });
    expect(() => parseImageRequest({ prompt: 'X', n: 10 })).toThrow();
    expect(() => parseImageRequest({ prompt: 'X', model: 'fake-model' })).toThrow();
    expect(() => parseImageRequest({ prompt: 'X', response_format: 'b64_json', quality: 'ultra' })).toThrow();
    expect(() => parseImageRequest({ prompt: ' ' })).toThrow();
  });

  it('caps video duration, resolution, and models', () => {
    expect(parseVideoRequest({ prompt: 'scene' })).toEqual({
      model: 'grok-imagine-video-1.5-lite', prompt: 'scene',
      duration: 5, aspect_ratio: '16:9', resolution: '480p',
    });
    expect(() => parseVideoRequest({ prompt: 'a', duration: 15 })).toThrow();
    expect(() => parseVideoRequest({ prompt: 'a', resolution: '1080p' })).toThrow();
    expect(() => parseVideoRequest({ prompt: 'a', model: 'grok-legacy' })).toThrow();
    expect(estimatedProviderUsd(parseVideoRequest({ prompt: 'a', duration: 8, resolution: '720p' }))).toBe(0.24);
    expect(estimatedProviderUsd(parseImageRequest({ prompt: 'a', quality: 'medium', resolution: '2k' }))).toBe(0.08);
  });

  it('blocks path injection and unexpected provider asset hosts', () => {
    expect(() => parseVideoRequestId('../etc/passwd')).toThrow();
    expect(() => parseVideoRequestId('abc?foo=1')).toThrow();
    expect(parseVideoRequestId('d97415a1-5796-b7ec-379f-4e6819e08fdf')).toContain('-');
    expect(() => assertProviderMediaUrl('https://evil.com/media.mp4', 'video')).toThrow();
    expect(() => assertProviderMediaUrl('http://vidgen.x.ai/a.mp4', 'video')).toThrow();
    expect(assertProviderMediaUrl('https://imgen.x.ai/safe.jpeg', 'image')).toContain('imgen.x.ai');
  });
});

describe('xAI Imagine: server transport', () => {
  it('cannot be constructed without explicit enablement and secret', () => {
    expect(() => new XaiImagineTransport({ enabled: false, apiKey: 'secret' })).toThrow(/disabled/);
    expect(() => new XaiImagineTransport({ enabled: true, apiKey: '' })).toThrow(/configured/);
  });

  it('sends only allowlisted fields and keeps the secret outside JSON', async () => {
    const fetcher = mockFetch({
      data: [{ url: 'https://imgen.x.ai/image.jpeg', mime_type: 'image/jpeg' }],
      usage: { cost_in_usd_ticks: 400000000 },
    });
    const output = await transport(fetcher).generateImage({ prompt: 'hello', n: 1, tenant_id: 'forged' });
    expect(output).toEqual({ url: 'https://imgen.x.ai/image.jpeg', mimeType: 'image/jpeg', costUsd: 0.04 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.x.ai/v1/images/generations');
    expect(JSON.parse(String(init.body))).not.toHaveProperty('tenant_id');
    expect(String(init.body)).not.toContain('local-test-secret');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer local-test-secret');
  });

  it('does not call provider for invalid requests', async () => {
    const fetcher = mockFetch({});
    await expect(transport(fetcher).startVideo({ prompt: 'a', duration: 30 })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('supports video start and async polling, rejects malicious IDs', async () => {
    const requestId = 'd97415a1-5796-b7ec-379f-4e6819e08fdf';
    const start = mockFetch({ request_id: requestId });
    expect(await transport(start).startVideo({ prompt: 'a' })).toEqual({ requestId });
    expect(start.mock.calls[0]?.[0]).toBe('https://api.x.ai/v1/videos/generations');
    const pending = mockFetch({ status: 'pending' });
    expect(await transport(pending).getVideoStatus(requestId)).toEqual({ status: 'pending', costUsd: null });
    const done = mockFetch({ status: 'done', video: { url: 'https://vidgen.x.ai/a.mp4', duration: 5 }, usage: { cost_in_usd_ticks: 1000000000 } });
    expect(await transport(done).getVideoStatus(requestId)).toEqual({
      status: 'done', url: 'https://vidgen.x.ai/a.mp4', duration: 5, costUsd: 0.1,
    });
    const bad = mockFetch({});
    await expect(transport(bad).getVideoStatus('https://evil.com/')).rejects.toThrow();
    expect(bad).not.toHaveBeenCalled();
  });

  it('does not expose upstream response bodies', async () => {
    const fetcher = mockFetch({ error: 'private provider detail' }, 429);
    await expect(transport(fetcher).generateImage({ prompt: 'a' })).rejects.toMatchObject({
      code: 'XAI_IMAGINE_UPSTREAM', status: 429,
    } satisfies Partial<XaiImagineProviderError>);
    try {
      await transport(fetcher).generateImage({ prompt: 'a' });
    } catch (err) {
      expect(String((err as Error).message)).not.toContain('private provider detail');
    }
  });
});

describe('xAI Imagine: paid-call guard integration', () => {
  it('reserves before image generation, measures the API cost afterwards', async () => {
    const events: string[] = [];
    const budget = fakeBudget();
    budget.reserve.mockImplementation(async () => { events.push('reserve'); return 'r'; });
    budget.settleMeasured.mockImplementation(async () => { events.push('settle'); });
    const image = { url: 'https://imgen.x.ai/a.jpeg', mimeType: 'image/jpeg', costUsd: 0.04 };
    const client = { generateImage: vi.fn(async () => { events.push('provider'); return image; }) };
    expect(await generateImageWithBudget({ input: { prompt: 'a' }, quotedMaxUsd: 0.08, budget, transport: client })).toEqual(image);
    expect(events).toEqual(['reserve', 'provider', 'settle']);
    expect(budget.settleMeasured).toHaveBeenCalledWith('r', 0.04, { provider: 'xai', operation: 'image' });
  });

  it('rejects missing or inadequate budget before paid calls', async () => {
    const budget = fakeBudget();
    budget.reserve.mockResolvedValue(null);
    const client = { generateImage: vi.fn() };
    await expect(generateImageWithBudget({ input: { prompt: 'a' }, quotedMaxUsd: 0.08, budget, transport: client })).rejects.toBeInstanceOf(ImagineBudgetConfigurationError);
    expect(client.generateImage).not.toHaveBeenCalled();
    await expect(generateImageWithBudget({ input: { prompt: 'a' }, quotedMaxUsd: 0.04, budget, transport: client })).rejects.toBeInstanceOf(ImagineBudgetConfigurationError);
  });

  it('settles unknown if the provider request fails', async () => {
    const budget = fakeBudget();
    const client = { generateImage: vi.fn(async () => { throw new Error('provider down'); }) };
    await expect(generateImageWithBudget({ input: { prompt: 'a' }, quotedMaxUsd: 0.08, budget, transport: client })).rejects.toThrow('provider down');
    expect(budget.settleUnknown).toHaveBeenCalledTimes(1);
  });

  it('must persist an async video job before returning its request ID', async () => {
    const budget = fakeBudget();
    const stored = vi.fn(async () => undefined);
    const receipt = await startVideoWithBudget({
      input: { prompt: 'a', duration: 5 },
      quotedMaxUsd: 0.2,
      transport: { startVideo: vi.fn(async () => ({ requestId: 'my-request-1234' })) },
      budget, persistJob: stored,
    });
    expect(stored).toHaveBeenCalledWith(receipt);
    const poll = await pollVideoWithBudget({
      job: receipt,
      transport: { getVideoStatus: vi.fn(async () => ({ status: 'done' as const, url: 'https://vidgen.x.ai/a.mp4', duration: 5, costUsd: 0.1 })) },
      budget,
    });
    expect(poll.status).toBe('done');
    expect(budget.settleMeasured).toHaveBeenCalledWith(receipt.reservationId, 0.1, { provider: 'xai', operation: 'video' });
  });
});

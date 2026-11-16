import { describe, expect, it, vi } from 'vitest';
import { CreativeProviderError, requestXaiImage } from '../../supabase/functions/_shared/creativeXaiImageProvider';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlC9XwAAAAASUVORK5CYII=';

describe('creative xAI image provider', () => {
  it('does not call provider without a server-side key', async () => {
    const fetcher = vi.fn();
    await expect(requestXaiImage({ prompt: 'Product photograph' }, '', fetcher))
      .rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends validated parameters and accepts a PNG response', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      data: [{ b64_json: PNG_BASE64 }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const image = await requestXaiImage({ prompt: 'Product photograph' }, 'test-secret', fetcher);
    expect(image.mimeType).toBe('image/png');
    expect(image.bytes.length).toBeGreaterThan(8);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.x.ai/v1/images/generations');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'grok-imagine-image-quality', n: 1, resolution: '1k',
    });
  });

  it('rejects provider errors without leaking their bodies', async () => {
    const fetcher = vi.fn(async () => new Response('secret provider details', { status: 401 }));
    await expect(requestXaiImage({ prompt: 'Product photograph' }, 'test-secret', fetcher))
      .rejects.toEqual(new CreativeProviderError('UNAVAILABLE'));
  });

  it('rejects malformed or non-image responses', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      data: [{ b64_json: btoa('not an image') }],
    }), { status: 200 }));
    await expect(requestXaiImage({ prompt: 'Product photograph' }, 'test-secret', fetcher))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('rejects oversized declared payloads', async () => {
    const fetcher = vi.fn(async () => new Response('{}', {
      status: 200, headers: { 'content-length': String(30 * 1024 * 1024) },
    }));
    await expect(requestXaiImage({ prompt: 'Product photograph' }, 'test-secret', fetcher))
      .rejects.toMatchObject({ code: 'TOO_LARGE' });
  });
});

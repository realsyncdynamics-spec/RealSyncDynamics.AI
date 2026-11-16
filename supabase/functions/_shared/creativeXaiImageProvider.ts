import {
  buildImageGenerationPayload,
  IMAGE_GENERATION_ENDPOINT,
  type ImageCreateInput,
} from './creativeImageContract.ts';

export interface GeneratedImage {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export class CreativeProviderError extends Error {
  constructor(readonly code: 'UNAVAILABLE' | 'INVALID_RESPONSE' | 'TOO_LARGE') {
    super(code);
    this.name = 'CreativeProviderError';
  }
}

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

/**
 * Low-level xAI provider adapter, NOT an authenticated API route.
 * Only invoke after a durable, atomic usage reservation and server-side
 * tenant authorization. Never expose the provider response to a browser.
 */
export async function requestXaiImage(
  input: ImageCreateInput,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<GeneratedImage> {
  if (!apiKey.trim()) throw new CreativeProviderError('UNAVAILABLE');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let response: Response;
  try {
    response = await fetcher(IMAGE_GENERATION_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildImageGenerationPayload(input)),
      signal: controller.signal,
    });
  } catch {
    throw new CreativeProviderError('UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new CreativeProviderError('UNAVAILABLE');
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES * 1.5) {
    throw new CreativeProviderError('TOO_LARGE');
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CreativeProviderError('INVALID_RESPONSE');
  }
  const record = body as { data?: Array<{ b64_json?: unknown }> } | null;
  const encoded = record?.data?.[0]?.b64_json;
  if (typeof encoded !== 'string' || encoded.length > MAX_IMAGE_BYTES * 1.5 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new CreativeProviderError('INVALID_RESPONSE');
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  } catch {
    throw new CreativeProviderError('INVALID_RESPONSE');
  }
  if (bytes.length > MAX_IMAGE_BYTES) throw new CreativeProviderError('TOO_LARGE');
  // Identify by magic bytes; never trust provider-supplied MIME type.
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n);
  const isWebp = bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!isJpeg && !isPng && !isWebp) throw new CreativeProviderError('INVALID_RESPONSE');
  return { bytes, mimeType: isJpeg ? 'image/jpeg' : isPng ? 'image/png' : 'image/webp' };
}

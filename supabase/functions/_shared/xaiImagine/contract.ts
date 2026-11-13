/**
 * xAI Imagine request contracts — pure TypeScript, no network or browser keys.
 *
 * RealSync deliberately supports a conservative subset of the upstream API:
 * one image, text-to-video, <= 8s and <= 720p. Expanding this requires a
 * reviewed cost/entitlement decision, not silent acceptance of client options.
 */
export const IMAGE_MODEL = 'grok-imagine-image-2.0' as const;
export const VIDEO_MODELS = ['grok-imagine-video-1.5-lite', 'grok-imagine-video-1.5'] as const;
export const IMAGE_ASPECTS = ['auto', '1:1', '16:9', '9:16', '4:3', '3:4'] as const;
export const VIDEO_ASPECTS = ['1:1', '16:9', '9:16'] as const;
export const VIDEO_RESOLUTIONS = ['480p', '720p'] as const;

export type ImageAspect = (typeof IMAGE_ASPECTS)[number];
export type VideoAspect = (typeof VIDEO_ASPECTS)[number];
export type VideoModel = (typeof VIDEO_MODELS)[number];
export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];

export interface ImageRequest {
  model: typeof IMAGE_MODEL;
  prompt: string;
  n: 1;
  aspect_ratio: ImageAspect;
  resolution: '1k' | '2k';
  quality: 'low' | 'medium';
  response_format: 'url';
}

export interface VideoRequest {
  model: VideoModel;
  prompt: string;
  duration: number;
  aspect_ratio: VideoAspect;
  resolution: VideoResolution;
}

export class ImagineValidationError extends Error {
  readonly code = 'IMAGINE_BAD_REQUEST';
  constructor(message: string) { super(message); this.name = 'ImagineValidationError'; }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ImagineValidationError('expected a JSON object');
  }
  return value as Record<string, unknown>;
}

function allowed<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !choices.includes(value as T)) {
    throw new ImagineValidationError('unsupported model or media option');
  }
  return value as T;
}

function prompt(value: unknown): string {
  if (typeof value !== 'string') throw new ImagineValidationError('prompt must be text');
  const clean = value.trim();
  if (!clean || clean.length > 4_000) throw new ImagineValidationError('prompt must contain 1–4000 characters');
  return clean;
}

/** Rebuild a request from an allowlist: never forward arbitrary browser fields. */
export function parseImageRequest(value: unknown): ImageRequest {
  const raw = object(value);
  const model = allowed(raw.model, [IMAGE_MODEL], IMAGE_MODEL);
  const resolution = allowed(raw.resolution, ['1k', '2k'] as const, '1k');
  const quality = allowed(raw.quality, ['low', 'medium'] as const, 'low');
  const aspect_ratio = allowed(raw.aspect_ratio, IMAGE_ASPECTS, 'auto');
  if (raw.n !== undefined && raw.n !== 1) throw new ImagineValidationError('only one image per request');
  return { model, prompt: prompt(raw.prompt), n: 1, resolution, quality, aspect_ratio, response_format: 'url' };
}

export function parseVideoRequest(value: unknown): VideoRequest {
  const raw = object(value);
  const model = allowed(raw.model, VIDEO_MODELS, VIDEO_MODELS[0]);
  const aspect_ratio = allowed(raw.aspect_ratio, VIDEO_ASPECTS, '16:9');
  const resolution = allowed(raw.resolution, VIDEO_RESOLUTIONS, '480p');
  const duration = raw.duration === undefined ? 5 : raw.duration;
  if (!Number.isInteger(duration) || typeof duration !== 'number' || duration < 1 || duration > 8) {
    throw new ImagineValidationError('video duration must be an integer from 1 to 8 seconds');
  }
  return { model, prompt: prompt(raw.prompt), duration, aspect_ratio, resolution };
}

/** No path segments, query strings, or URL injection in the provider polling URL. */
export function parseVideoRequestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value)) {
    throw new ImagineValidationError('invalid provider request ID');
  }
  return value;
}

/**
 * Untrusted remote URLs are only returned to a caller; this module never
 * fetches the generated asset. Restrict presentation to xAI's known media CDN.
 */
export function assertProviderMediaUrl(value: unknown, type: 'image' | 'video'): string {
  if (typeof value !== 'string' || value.length > 2_048) throw new ImagineValidationError('invalid media URL');
  let url: URL;
  try { url = new URL(value); } catch { throw new ImagineValidationError('invalid media URL'); }
  const host = type === 'image' ? 'imgen.x.ai' : 'vidgen.x.ai';
  if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || url.port) {
    throw new ImagineValidationError('unexpected media host');
  }
  return url.href;
}

/**
 * Budget-planning ESTIMATE ONLY, never a customer price or authorization.
 * API charges may change. Check the current provider pricing and reserve in
 * the existing atomic ledger before calling this provider.
 * Prices verified 2026-11-13: docs.x.ai/developers/pricing.
 */
export function estimatedProviderUsd(input: ImageRequest | VideoRequest): number {
  if (input.model === IMAGE_MODEL) {
    return input.quality === 'medium'
      ? (input.resolution === '2k' ? 0.08 : 0.06)
      : (input.resolution === '2k' ? 0.06 : 0.04);
  }
  const lite = input.model === 'grok-imagine-video-1.5-lite';
  const perSecond = lite
    ? (input.resolution === '720p' ? 0.03 : 0.02)
    : (input.resolution === '720p' ? 0.14 : 0.08);
  return Number((perSecond * input.duration).toFixed(6));
}

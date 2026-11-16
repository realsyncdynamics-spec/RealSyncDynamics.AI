/**
 * xAI Imagine image request contract (not a public API endpoint).
 * Pure, side-effect-free module. No provider requests, billing or storage writes.
 * Official reference: https://docs.x.ai/developers/model-capabilities/images/generation
 * Do not wire this to a paid provider until atomic budget reservation, tenant
 * authorization, audit persistence and storage policies are reviewed.
 */
export const IMAGE_MODEL = 'grok-imagine-image-2.0' as const;
export const IMAGE_GENERATION_ENDPOINT = 'https://api.x.ai/v1/images/generations' as const;

export type ImageRatio =
  | 'auto' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
  | '3:2' | '2:3' | '2:1' | '1:2' | '21:9';
export type ImageResolution = '1k' | '2k';
export type ImageQuality = 'low' | 'medium';

export interface ImageCreateInput {
  prompt: string;
  aspect_ratio?: ImageRatio;
  resolution?: ImageResolution;
  quality?: ImageQuality;
}

const RATIOS: readonly string[] = [
  'auto', '1:1', '16:9', '9:16', '4:3', '3:4',
  '3:2', '2:3', '2:1', '1:2', '21:9',
];

export class CreativeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreativeInputError';
  }
}

/** Never accept tenant, user, cost or provider credentials from this input. */
export function validateImageCreateInput(value: unknown): ImageCreateInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CreativeInputError('invalid image request');
  }
  const obj = value as Record<string, unknown>;
  const allowed = new Set(['prompt', 'aspect_ratio', 'resolution', 'quality']);
  if (Object.keys(obj).some((key) => !allowed.has(key))) {
    throw new CreativeInputError('unsupported image parameter');
  }
  if (typeof obj.prompt !== 'string' || obj.prompt.trim().length < 3 ||
      obj.prompt.length > 4000) {
    throw new CreativeInputError('prompt must contain 3–4000 characters');
  }
  if (obj.aspect_ratio !== undefined &&
      (typeof obj.aspect_ratio !== 'string' || !RATIOS.includes(obj.aspect_ratio))) {
    throw new CreativeInputError('unsupported aspect ratio');
  }
  if (obj.resolution !== undefined &&
      obj.resolution !== '1k' && obj.resolution !== '2k') {
    throw new CreativeInputError('unsupported resolution');
  }
  if (obj.quality !== undefined &&
      obj.quality !== 'low' && obj.quality !== 'medium') {
    throw new CreativeInputError('unsupported quality');
  }
  return {
    prompt: obj.prompt.trim(),
    aspect_ratio: (obj.aspect_ratio ?? '1:1') as ImageRatio,
    resolution: (obj.resolution ?? '1k') as ImageResolution,
    quality: (obj.quality ?? 'low') as ImageQuality,
  };
}

export function buildImageGenerationPayload(input: ImageCreateInput) {
  const safe = validateImageCreateInput(input);
  return {
    model: IMAGE_MODEL,
    prompt: safe.prompt,
    aspect_ratio: safe.aspect_ratio,
    resolution: safe.resolution,
    quality: safe.quality,
    n: 1 as const,
    response_format: 'b64_json' as const,
  };
}

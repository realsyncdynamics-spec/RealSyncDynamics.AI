/**
 * xAI Imagine image request contract (not a public API endpoint).
 * Pure, side-effect-free module. No provider requests, billing or storage writes.
 * Official reference: https://docs.x.ai/developers/model-capabilities/images/generation
 * Do not wire this to a paid provider until atomic budget reservation, tenant
 * authorization, audit persistence and storage policies are reviewed.
 */
export const IMAGE_MODEL = 'grok-imagine-image-quality' as const;
export const IMAGE_GENERATION_ENDPOINT = 'https://api.x.ai/v1/images/generations' as const;

export type ImageRatio =
  | 'auto' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
  | '3:2' | '2:3' | '2:1' | '1:2' | '19.5:9' | '9:19.5' | '20:9' | '9:20';
export type ImageResolution = '1k' | '2k';

export interface ImageCreateInput {
  prompt: string;
  aspect_ratio?: ImageRatio;
  resolution?: ImageResolution;
}

const RATIOS: readonly string[] = [
  'auto', '1:1', '16:9', '9:16', '4:3', '3:4',
  '3:2', '2:3', '2:1', '1:2', '19.5:9', '9:19.5', '20:9', '9:20',
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
  const allowed = new Set(['prompt', 'aspect_ratio', 'resolution']);
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
  return {
    prompt: obj.prompt.trim(),
    aspect_ratio: (obj.aspect_ratio ?? '1:1') as ImageRatio,
    resolution: (obj.resolution ?? '1k') as ImageResolution,
  };
}

export function buildImageGenerationPayload(input: ImageCreateInput) {
  const safe = validateImageCreateInput(input);
  return {
    model: IMAGE_MODEL,
    prompt: safe.prompt,
    aspect_ratio: safe.aspect_ratio,
    resolution: safe.resolution,
    n: 1 as const,
    response_format: 'b64_json' as const,
  };
}

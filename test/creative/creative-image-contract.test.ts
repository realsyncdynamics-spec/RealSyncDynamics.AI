import { describe, expect, it } from 'vitest';
import {
  buildImageGenerationPayload,
  CreativeInputError,
  validateImageCreateInput,
} from '../../supabase/functions/_shared/creativeImageContract';

describe('creative image contract', () => {
  it('uses explicit low-cost defaults and one image', () => {
    expect(buildImageGenerationPayload({ prompt: 'A modern product photo' })).toEqual({
      model: 'grok-imagine-image-quality',
      prompt: 'A modern product photo',
      aspect_ratio: '1:1',
      resolution: '1k',
      n: 1,
      response_format: 'b64_json',
    });
  });

  it('rejects caller-controlled tenant, pricing and secrets', () => {
    for (const key of ['tenant_id', 'user_id', 'price', 'api_key', 'n']) {
      expect(() => validateImageCreateInput({
        prompt: 'Product photograph', [key]: 'untrusted',
      })).toThrow(CreativeInputError);
    }
  });

  it('rejects invalid prompts and options', () => {
    expect(() => validateImageCreateInput({ prompt: '  ' })).toThrow();
    expect(() => validateImageCreateInput({ prompt: 'Valid prompt', resolution: '8k' })).toThrow();
    expect(() => validateImageCreateInput({ prompt: 'Valid prompt', quality: 'medium' })).toThrow();
    expect(() => validateImageCreateInput({ prompt: 'Valid prompt', aspect_ratio: '7:3' })).toThrow();
  });

  it('accepts supported explicit image settings', () => {
    expect(buildImageGenerationPayload({
      prompt: '  Wide cinematic landscape  ',
      aspect_ratio: '16:9',
      resolution: '2k',
    })).toMatchObject({
      prompt: 'Wide cinematic landscape',
      aspect_ratio: '16:9',
      resolution: '2k',
    });
  });
});

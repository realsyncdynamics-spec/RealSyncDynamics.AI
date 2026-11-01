import { describe, expect, it } from 'vitest';
import { isAnthropicPromptCacheEnabled } from '../../supabase/functions/_shared/anthropicPromptCache';

describe('Anthropic prompt cache rollout flag', () => {
  it.each([undefined, null, '', 'false', '0', 'yes', 'disabled', 'unexpected'])(
    'is disabled for %s', (value) => {
      expect(isAnthropicPromptCacheEnabled(value)).toBe(false);
    },
  );

  it.each(['true', 'TRUE', ' true ', '1'])(
    'is enabled explicitly for %s', (value) => {
      expect(isAnthropicPromptCacheEnabled(value)).toBe(true);
    },
  );
});

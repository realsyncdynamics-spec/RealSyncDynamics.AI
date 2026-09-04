import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../../../src/core/ai-gateway/registry';
import type { AiProviderAdapter, ProviderId } from '../../../src/core/ai-gateway/types';

// Minimal stub adapter — the registry only cares about `id`; it never calls
// generate/embed itself.
function stub(id: ProviderId): AiProviderAdapter {
  const notUsed = () => Promise.reject(new Error('not used in registry tests'));
  return {
    id,
    health: () => Promise.resolve({ ok: true }),
    generate: notUsed as unknown as AiProviderAdapter['generate'],
    extractJson: notUsed as unknown as AiProviderAdapter['extractJson'],
    embed: notUsed as unknown as AiProviderAdapter['embed'],
  };
}

function reg() {
  return new ProviderRegistry();
}

describe('ProviderRegistry', () => {
  it('registers providers and preserves registration order', () => {
    const r = reg()
      .register({ adapter: stub('ollama') } as never)
      .register({ adapter: stub('anthropic') } as never)
      .register({ adapter: stub('openai') } as never);
    expect(r.all().map((p) => p.descriptor.id)).toEqual(['ollama', 'anthropic', 'openai']);
    expect(r.has('openai')).toBe(true);
    expect(r.has('mock')).toBe(false);
  });

  it('applies default descriptor facts by provider id', () => {
    const r = reg().register({ adapter: stub('ollama') } as never);
    const d = r.get('ollama')!.descriptor;
    expect(d.kind).toBe('local');
    expect(d.locality).toBe('eu');
    expect(d.capabilities).toContain('embed');
  });

  it('re-registering an id replaces without duplicating order', () => {
    const r = reg()
      .register({ adapter: stub('google') } as never)
      .register({ adapter: stub('google') } as never);
    expect(r.all()).toHaveLength(1);
  });

  it('filters candidates by capability', () => {
    const r = reg()
      .register({ adapter: stub('anthropic') } as never) // no embed capability
      .register({ adapter: stub('openai') } as never); // has embed
    const embedders = r.candidatesFor('embed').map((p) => p.descriptor.id);
    expect(embedders).toContain('openai');
    expect(embedders).not.toContain('anthropic');
  });

  it('restricts to EU/on-prem providers when euOnly is set', () => {
    const r = reg()
      .register({ adapter: stub('ollama') } as never) // eu
      .register({ adapter: stub('lm_studio') } as never) // on_prem
      .register({ adapter: stub('openai') } as never); // non_eu
    const ids = r.candidatesFor('chat', { euOnly: true }).map((p) => p.descriptor.id);
    expect(ids).toEqual(['ollama', 'lm_studio']);
    expect(ids).not.toContain('openai');
  });

  it('honours a descriptor override (e.g. self-hosted OpenAI marked EU)', () => {
    const r = new ProviderRegistry({
      descriptors: {
        openai: {
          id: 'openai',
          kind: 'cloud',
          locality: 'eu',
          capabilities: ['chat'],
          models: [],
        },
      },
    }).register({ adapter: stub('openai') } as never);
    expect(r.get('openai')!.descriptor.locality).toBe('eu');
    expect(r.candidatesFor('chat', { euOnly: true }).map((p) => p.descriptor.id)).toContain('openai');
  });
});

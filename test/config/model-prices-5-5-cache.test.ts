/**
 * Einkaufspreise Claude 5.5 und Mythos-5.1-Cache-Read
 * (Befunde C1–C3, C6 aus dem Prompt-Caching-Nachtrag, 01.11.2026).
 *
 * Beleg: Anthropic-Doku „Prompt-Caching", Preistabelle und Fußnoten
 * (Opus 5.5 / Sonnet 5.5: Cache-Read 0,05 × Input; Fable 5.1 / Mythos 5.1:
 * 0,025 × Input). Die erwarteten Beträge sind unten von Hand vorgerechnet und
 * bewusst NICHT aus dem Code abgeleitet.
 *
 * Beispiel-Usage aus derselben Doku (Abschnitt 1-Stunden-Cache):
 *   input_tokens 2048, cache_read_input_tokens 1800,
 *   cache_creation_input_tokens 248, output_tokens 503
 */
import { describe, expect, it } from 'vitest';

import { priceFor } from '../../shared/model-prices';
import {
  fromAnthropicUsage,
  providerCostUsd,
} from '../../supabase/functions/_shared/providerCost.ts';

const DOC_USAGE = fromAnthropicUsage({
  input_tokens: 2048,
  cache_read_input_tokens: 1800,
  cache_creation_input_tokens: 248,
  output_tokens: 503,
});

// Cache-Miss derselben Anfrage: die 1800 gelesenen Tokens werden stattdessen
// geschrieben. Das ist der Fall, gegen den eine Reservierung rechnen muss.
const MISS_USAGE = fromAnthropicUsage({
  input_tokens: 2048,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 2048,
  output_tokens: 503,
});

describe('claude-opus-5-5', () => {
  it('führt die belegten Raten', () => {
    expect(priceFor('anthropic', 'claude-opus-5-5')).toMatchObject({
      inputPerMillionUsd: 4.0,
      outputPerMillionUsd: 20.0,
      cacheReadPerMillionUsd: 0.2,
      source: 'anthropic-prompt-caching-doc-2026-11-01',
    });
  });

  it('rechnet alle vier Preisarten', () => {
    // 2048×4 + 248×5 + 1800×0,20 + 503×20 = 8192 + 1240 + 360 + 10060 = 19852 → $0,019852
    expect(providerCostUsd('anthropic', 'claude-opus-5-5', DOC_USAGE)).toBeCloseTo(0.019852, 10);
  });

  it('Cache-Miss kostet mehr als Treffer (Reservierung rechnet mit Miss)', () => {
    // 2048×4 + 2048×5 + 503×20 = 8192 + 10240 + 10060 = 28492 → $0,028492
    const miss = providerCostUsd('anthropic', 'claude-opus-5-5', MISS_USAGE)!;
    expect(miss).toBeCloseTo(0.028492, 10);
    expect(miss).toBeGreaterThanOrEqual(providerCostUsd('anthropic', 'claude-opus-5-5', DOC_USAGE)!);
  });
});

describe('claude-sonnet-5-5', () => {
  it('führt die belegten Raten', () => {
    expect(priceFor('anthropic', 'claude-sonnet-5-5')).toMatchObject({
      inputPerMillionUsd: 2.0,
      outputPerMillionUsd: 10.0,
      cacheReadPerMillionUsd: 0.1,
      source: 'anthropic-prompt-caching-doc-2026-11-01',
    });
  });

  it('rechnet alle vier Preisarten', () => {
    // 2048×2 + 248×2,50 + 1800×0,10 + 503×10 = 4096 + 620 + 180 + 5030 = 9926 → $0,009926
    expect(providerCostUsd('anthropic', 'claude-sonnet-5-5', DOC_USAGE)).toBeCloseTo(0.009926, 10);
  });

  it('Cache-Miss kostet mehr als Treffer', () => {
    // 2048×2 + 2048×2,50 + 503×10 = 4096 + 5120 + 5030 = 14246 → $0,014246
    const miss = providerCostUsd('anthropic', 'claude-sonnet-5-5', MISS_USAGE)!;
    expect(miss).toBeCloseTo(0.014246, 10);
    expect(miss).toBeGreaterThanOrEqual(providerCostUsd('anthropic', 'claude-sonnet-5-5', DOC_USAGE)!);
  });
});

describe('claude-mythos-5-1', () => {
  it('liest Cache zu $0,25 statt zum 0,10-Default ($1,00)', () => {
    expect(priceFor('anthropic', 'claude-mythos-5-1')?.cacheReadPerMillionUsd).toBe(0.25);
  });

  it('rechnet alle vier Preisarten', () => {
    // 2048×10 + 248×12,50 + 1800×0,25 + 503×50 = 20480 + 3100 + 450 + 25150 = 49180 → $0,04918
    expect(providerCostUsd('anthropic', 'claude-mythos-5-1', DOC_USAGE)).toBeCloseTo(0.04918, 10);
  });
});

describe('bewusst nicht bepreist', () => {
  it('claude-haiku-5-5 bleibt null (Preisstufen nicht abbildbar)', () => {
    expect(priceFor('anthropic', 'claude-haiku-5-5')).toBeNull();
    expect(providerCostUsd('anthropic', 'claude-haiku-5-5', DOC_USAGE)).toBeNull();
  });

  it('unbekannte Modell-ID bleibt null', () => {
    expect(priceFor('anthropic', 'claude-opus-5-6')).toBeNull();
    expect(providerCostUsd('anthropic', 'claude-opus-5-6', DOC_USAGE)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CACHE_READ_MULTIPLIER,
  CACHE_WRITE_MULTIPLIER,
  MODEL_PRICES,
  cacheReadPerMillionUsd,
  cacheWritePerMillionUsd,
  costUsd,
  priceFor,
} from '../../shared/model-prices';

import { buildGenerated } from '../../scripts/sync-model-prices.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = join(ROOT, 'shared', 'model-prices.ts');
const TARGET = join(ROOT, 'supabase', 'functions', '_shared', 'modelPrices.generated.ts');

describe('Einkaufspreis-SSoT: Deno-Zwilling', () => {
  it('ist byte-identisch aus shared/model-prices.ts erzeugt', () => {
    const expected = buildGenerated(readFileSync(SOURCE, 'utf8'));
    const actual = readFileSync(TARGET, 'utf8');
    expect(actual).toBe(expected);
  });

  it('die Quelle bleibt importfrei und ohne Plattform-Globals', () => {
    // Der Zwilling wird in Deno gebündelt. Ein Import hierher bräche erst im
    // Deploy — deshalb fällt er hier auf. buildGenerated wirft in dem Fall.
    expect(() => buildGenerated(readFileSync(SOURCE, 'utf8'))).not.toThrow();
  });
});

describe('Einkaufspreis-SSoT: Tabelle', () => {
  it('führt jedes Modell genau einmal je Anbieter', () => {
    const keys = MODEL_PRICES.map((p) => `${p.provider}/${p.modelId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('trägt nur Modell-IDs ohne angehängtes Datums-Suffix', () => {
    // Anthropic veröffentlicht IDs vollständig. Eine Basis-ID mit angehängtem
    // Datum ist keine echte ID — genau daran ist getModelId gescheitert.
    const fabricated = /^claude-(opus|sonnet|haiku|fable|mythos)-\d+-\d+-\d{8}$/;
    for (const p of MODEL_PRICES) {
      expect(p.modelId, p.modelId).not.toMatch(fabricated);
    }
  });

  it('hat für jede Zeile positive Preise und eine Belegstelle', () => {
    for (const p of MODEL_PRICES) {
      expect(p.inputPerMillionUsd, p.modelId).toBeGreaterThan(0);
      expect(p.outputPerMillionUsd, p.modelId).toBeGreaterThan(0);
      expect(p.source, p.modelId).toMatch(/\S/);
    }
  });

  it('pinnt die Raten, die heute im Repo gebraucht werden', () => {
    // Die beiden Modelle, die `ai_tools` in Produktion referenziert, plus das
    // Modell, dessen Preis in MODEL_PRICING 20 % zu niedrig stand.
    expect(priceFor('anthropic', 'claude-sonnet-4-6')).toMatchObject({
      inputPerMillionUsd: 3.0,
      outputPerMillionUsd: 15.0,
    });
    expect(priceFor('anthropic', 'claude-opus-4-7')).toMatchObject({
      inputPerMillionUsd: 5.0,
      outputPerMillionUsd: 25.0,
    });
    expect(priceFor('anthropic', 'claude-haiku-4-5')).toMatchObject({
      inputPerMillionUsd: 1.0,
      outputPerMillionUsd: 5.0,
    });
  });
});

describe('priceFor', () => {
  it('findet unabhängig von Groß-/Kleinschreibung und Rand-Leerzeichen', () => {
    expect(priceFor('Anthropic', '  claude-opus-5 ')?.modelId).toBe('claude-opus-5');
  });

  it('gibt null zurück statt auf ein ähnliches Modell zu raten', () => {
    // Der Defekt, den diese SSoT ablöst: estimateCostUsFromModel hat jedes
    // unbekannte Modell zu Sonnet-Preisen abgerechnet.
    expect(priceFor('anthropic', 'claude-opus-4-1-20250805')).toBeNull();
    expect(priceFor('anthropic', 'gibt-es-nicht')).toBeNull();
    expect(priceFor('openai', 'claude-opus-5')).toBeNull();
  });
});

describe('priceFor: datierte Snapshot-IDs', () => {
  it('bepreist einen Snapshot wie seine Basis-ID', () => {
    // claude-haiku-4-5-20251001 steht in serverFromEnv.ts und ai-act-classify —
    // ohne Kanonisierung bekäme dieser Aufrufpfad keinen Preis (Codex-Befund
    // auf #1503).
    expect(priceFor('anthropic', 'claude-haiku-4-5-20251001')).toBe(priceFor('anthropic', 'claude-haiku-4-5'));
    expect(priceFor('Anthropic', ' CLAUDE-OPUS-5-20260101 ')?.modelId).toBe('claude-opus-5');
  });

  it('kanonisiert nur, wenn die Basis-ID wirklich geführt ist', () => {
    expect(priceFor('anthropic', 'claude-opus-4-1-20250805')).toBeNull();
    expect(priceFor('anthropic', 'claude-sonnet-4-20250514')).toBeNull();
  });

  it('trennt genau ein achtstelliges Datum ab, sonst nichts', () => {
    expect(priceFor('anthropic', 'claude-haiku-4-5-2025')).toBeNull();
    expect(priceFor('anthropic', 'claude-haiku-4-5-20251001-20251001')).toBeNull();
    expect(priceFor('anthropic', 'claude-haiku-4-5x20251001')).toBeNull();
  });
});

describe('Cache-Preise', () => {
  it('leitet aus dem Input-Preis ab, wo der Anbieter nichts ausweist', () => {
    const sonnet = priceFor('anthropic', 'claude-sonnet-4-6')!;
    expect(cacheWritePerMillionUsd(sonnet)).toBeCloseTo(3.0 * CACHE_WRITE_MULTIPLIER, 10);
    expect(cacheReadPerMillionUsd(sonnet)).toBeCloseTo(3.0 * CACHE_READ_MULTIPLIER, 10);
  });

  it('lässt einen ausgewiesenen Wert nicht vom Multiplikator überschreiben', () => {
    // Fable 5.1 liest Cache zu $0,25 — der 0,10-Default ergäbe 1,00.
    const fable = priceFor('anthropic', 'claude-fable-5-1')!;
    expect(cacheReadPerMillionUsd(fable)).toBe(0.25);
    expect(cacheReadPerMillionUsd(fable)).not.toBeCloseTo(10.0 * CACHE_READ_MULTIPLIER, 10);
  });
});

describe('costUsd', () => {
  it('rechnet Input und Output je 1M Tokens ab', () => {
    const sonnet = priceFor('anthropic', 'claude-sonnet-4-6')!;
    // 1M Input à $3 + 1M Output à $15
    expect(costUsd(sonnet, { input: 1_000_000, output: 1_000_000 })).toBeCloseTo(18.0, 10);
  });

  it('verrechnet Cache-Writes und Cache-Reads getrennt statt gar nicht', () => {
    // Der heutige Adapter addiert Cache-Writes auf input_tokens (also 1,0×
    // statt 1,25×) und verwirft Cache-Reads vollständig (also $0 statt 0,1×).
    const sonnet = priceFor('anthropic', 'claude-sonnet-4-6')!;
    const withCache = costUsd(sonnet, {
      input: 0,
      output: 0,
      cacheWrite: 1_000_000,
      cacheRead: 1_000_000,
    });
    expect(withCache).toBeCloseTo(3.0 * 1.25 + 3.0 * 0.1, 10);
    expect(withCache).toBeGreaterThan(0);
  });

  it('behandelt fehlende Cache-Angaben als null Tokens, nicht als Fehler', () => {
    const haiku = priceFor('anthropic', 'claude-haiku-4-5')!;
    expect(costUsd(haiku, { input: 1_000_000, output: 0 })).toBeCloseTo(1.0, 10);
  });
});

describe('Generation 5.5 / Fable 5.2', () => {
  it('pinnt die Grundsätze und die ausgewiesenen Cache-Preise', () => {
    expect(priceFor('anthropic', 'claude-opus-5-5')).toMatchObject({
      inputPerMillionUsd: 4.0, outputPerMillionUsd: 20.0,
      cacheWritePerMillionUsd: 5.0, cacheReadPerMillionUsd: 0.2,
    });
    expect(priceFor('anthropic', 'claude-sonnet-5-5')).toMatchObject({
      inputPerMillionUsd: 2.0, outputPerMillionUsd: 10.0,
      cacheWritePerMillionUsd: 2.5, cacheReadPerMillionUsd: 0.1,
    });
    expect(priceFor('anthropic', 'claude-haiku-5-5')).toMatchObject({
      inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.5,
      cacheWritePerMillionUsd: 0.125, cacheReadPerMillionUsd: 0.01,
    });
    expect(priceFor('anthropic', 'claude-fable-5-2')).toMatchObject({
      inputPerMillionUsd: 8.0, outputPerMillionUsd: 40.0,
      cacheWritePerMillionUsd: 10.0, cacheReadPerMillionUsd: 0.2,
    });
  });
});

describe('costUsd: Long-Context-Stufe (Haiku 5.5)', () => {
  const haiku = () => priceFor('anthropic', 'claude-haiku-5-5')!;

  it('rechnet bis einschließlich 100.000 Prompt-Tokens zum Grundsatz', () => {
    // 100k Input à $0,10 + 1M Output à $0,50
    expect(costUsd(haiku(), { input: 100_000, output: 1_000_000 })).toBeCloseTo(0.01 + 0.5, 10);
  });

  it('rechnet den ganzen Request zum Long-Context-Satz, sobald die Schwelle überschritten ist', () => {
    expect(costUsd(haiku(), { input: 100_001, output: 0 })).toBeCloseTo((100_001 / 1_000_000) * 0.5, 10);
  });

  it('zählt Cache-Reads und Cache-Writes zur Prompt-Länge', () => {
    // 1 nicht gecachter Token + 100.000 Cache-Reads = 100.001 → Long-Context.
    expect(costUsd(haiku(), { input: 1, output: 0, cacheRead: 100_000 }))
      .toBeCloseTo(0.5 / 1_000_000 + 0.1 * 0.05, 10);
  });

  it('lässt Modelle ohne zweite Stufe unverändert', () => {
    const sonnet = priceFor('anthropic', 'claude-sonnet-4-6')!;
    expect(costUsd(sonnet, { input: 1_000_000, output: 1_000_000 })).toBeCloseTo(18.0, 10);
  });
});

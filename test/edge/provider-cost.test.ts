/**
 * Einkaufspreis-SSoT, Schritt C: beide Buchungspfade rechnen über denselben
 * Kern (supabase/functions/_shared/providerCost.ts) und über alle vier
 * Tokenarten.
 *
 * Die Szenarien unten sind die beiden Pfade, die vorher falsch gebucht haben:
 * der governance-agent (Haiku 20 % zu billig, Cache-Tokens gar nicht) und
 * runAiTool (Cache-Writes zum vollen statt 1,25-fachen Input-Preis,
 * Cache-Reads zu $0). Die alten Beträge stehen jeweils zum Vergleich daneben.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  NO_USAGE,
  addUsage,
  fromAnthropicUsage,
  fromInclusiveCacheUsage,
  providerCostUsd,
} from '../../supabase/functions/_shared/providerCost.ts';

const perMillion = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;

describe('Anthropic-Usage → vier Preisarten', () => {
  it('zählt Cache-Tokens neben input_tokens, nicht darin', () => {
    expect(fromAnthropicUsage({
      input_tokens: 300,
      output_tokens: 200,
      cache_creation_input_tokens: 4000,
      cache_read_input_tokens: 0,
    })).toEqual({ input: 300, output: 200, cacheWrite: 4000, cacheRead: 0 });
  });

  it('behandelt fehlende, null und ungültige Werte als 0', () => {
    expect(fromAnthropicUsage({ input_tokens: 10, cache_read_input_tokens: null }))
      .toEqual({ input: 10, output: 0, cacheWrite: 0, cacheRead: 0 });
    expect(fromAnthropicUsage({ input_tokens: -5, output_tokens: Number.NaN }))
      .toEqual(NO_USAGE);
  });
});

describe('OpenAI/Gemini-Usage → vier Preisarten', () => {
  it('zieht gelesene Cache-Tokens von den Prompt-Tokens ab, statt sie zu addieren', () => {
    expect(fromInclusiveCacheUsage({ promptTokens: 1000, outputTokens: 50, cachedTokens: 600 }))
      .toEqual({ input: 400, output: 50, cacheWrite: 0, cacheRead: 600 });
  });

  it('lässt nie mehr Cache-Tokens zu, als Prompt-Tokens da sind', () => {
    expect(fromInclusiveCacheUsage({ promptTokens: 100, cachedTokens: 500 }))
      .toEqual({ input: 0, output: 0, cacheWrite: 0, cacheRead: 100 });
  });
});

describe('providerCostUsd', () => {
  it('gibt null für ein Modell ohne SSoT-Preis — der Aufrufer entscheidet sichtbar', () => {
    const usage = { input: 1000, output: 1000, cacheWrite: 0, cacheRead: 0 };
    expect(providerCostUsd('anthropic', 'gibt-es-nicht', usage)).toBeNull();
    expect(providerCostUsd('google', 'gemini-2.5-pro', usage)).toBeNull();
  });

  it('bepreist die IDs, die getModelId auf main heute sendet, statt NULL zu buchen', () => {
    // Beide datiert; die Sonnet-ID existiert nicht einmal (#1501). Die Kosten
    // hängen trotzdem an der Basis-ID und bleiben damit stabil, egal ob #1501
    // vor oder nach diesem PR landet.
    const usage = { input: 1_000_000, output: 0, cacheWrite: 0, cacheRead: 0 };
    expect(providerCostUsd('anthropic', 'claude-haiku-4-5-20251001', usage)).toBeCloseTo(1.0, 10);
    expect(providerCostUsd('anthropic', 'claude-sonnet-4-6-20250514', usage)).toBeCloseTo(3.0, 10);
  });
});

describe('Szenario governance-agent: Tool-Schleife mit gecachtem System-Prompt', () => {
  // Zwei Requests derselben Schleife: der erste schreibt System-Prompt und
  // Tool-Katalog in den Cache, der zweite liest sie.
  const first = fromAnthropicUsage({
    input_tokens: 300, output_tokens: 200,
    cache_creation_input_tokens: 4000, cache_read_input_tokens: 0,
  });
  const second = fromAnthropicUsage({
    input_tokens: 350, output_tokens: 150,
    cache_creation_input_tokens: 0, cache_read_input_tokens: 4000,
  });
  const usage = addUsage(addUsage(NO_USAGE, first), second);

  it('summiert alle vier Arten über die Schleife', () => {
    expect(usage).toEqual({ input: 650, output: 350, cacheWrite: 4000, cacheRead: 4000 });
  });

  it('bucht Haiku zu $1/$5 und beide Cache-Arten mit', () => {
    const neu = providerCostUsd('anthropic', 'claude-haiku-4-5', usage)!;
    const erwartet =
      perMillion(650, 1.0) +          // Input
      perMillion(350, 5.0) +          // Output
      perMillion(4000, 1.0 * 1.25) +  // Cache-Write
      perMillion(4000, 1.0 * 0.10);   // Cache-Read
    expect(neu).toBeCloseTo(erwartet, 12);
    expect(neu).toBeCloseTo(0.0078, 12);

    // Vorher: estimateCostUsFromModel mit MODEL_PRICING.haiku ($0,80/$4,00)
    // und nur input_tokens — ein Viertel des tatsächlichen Betrags.
    const alt = perMillion(650, 0.8) + perMillion(350, 4.0);
    expect(alt).toBeCloseTo(0.00192, 12);
    expect(neu / alt).toBeGreaterThan(4);
  });
});

describe('Szenario runAiTool: Sonnet-Tool, System-Prompt erstmals gecacht', () => {
  it('bucht den Cache-Write zum 1,25-fachen statt zum vollen Input-Preis', () => {
    const usage = fromAnthropicUsage({
      input_tokens: 1200, output_tokens: 400,
      cache_creation_input_tokens: 2000, cache_read_input_tokens: 0,
    });
    const neu = providerCostUsd('anthropic', 'claude-sonnet-4-6', usage)!;
    expect(neu).toBeCloseTo(perMillion(1200, 3) + perMillion(400, 15) + perMillion(2000, 3.75), 12);

    // Vorher: providers.ts addierte den Cache-Write auf inputTokens, ai.ts
    // rechnete das zum vollen Input-Preis aus ai_tools.
    const alt = perMillion(1200 + 2000, 3) + perMillion(400, 15);
    expect(neu - alt).toBeCloseTo(perMillion(2000, 0.75), 12);
  });

  it('bucht Cache-Reads zum 0,1-fachen statt zu $0', () => {
    const usage = fromAnthropicUsage({
      input_tokens: 1200, output_tokens: 400,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 2000,
    });
    const neu = providerCostUsd('anthropic', 'claude-sonnet-4-6', usage)!;
    const alt = perMillion(1200, 3) + perMillion(400, 15);
    expect(neu - alt).toBeCloseTo(perMillion(2000, 0.3), 12);
  });
});

describe('ein Entscheidungskern, zwei Aufrufer', () => {
  const agent = readFileSync('supabase/functions/governance-agent/index.ts', 'utf8');
  const ai = readFileSync('supabase/functions/_shared/ai.ts', 'utf8');
  const selection = readFileSync('supabase/functions/_shared/modelSelection.ts', 'utf8');

  it('beide Buchungspfade rechnen über providerCost.ts', () => {
    expect(agent).toContain("from '../_shared/providerCost.ts'");
    expect(ai).toContain("from './providerCost.ts'");
  });

  it('die alten Preisquellen sind weg', () => {
    expect(agent).not.toMatch(/MODEL_PRICING|estimateCostUsd|estimateCostUsFromModel/);
    // Auf die Definitionen prüfen, nicht auf das Wort: der Kommentar in
    // modelSelection.ts erklärt, was dort früher stand.
    expect(selection).not.toMatch(/\bconst MODEL_PRICING\b/);
    expect(selection).not.toMatch(/\bfunction estimateSavings\b/);
  });

  it('runAiTool liest ai_tools.cost_* nicht mehr (Schritt D)', () => {
    // Weder im ToolRow-Typ noch als Rückfall. Taucht eine der Spalten wieder
    // auf, rechnet irgendwo wieder eine zweite Preisquelle.
    expect(ai).not.toContain('cost_input_per_million_usd');
    expect(ai).not.toContain('cost_output_per_million_usd');
  });

  it('ohne SSoT-Preis läuft ein Cloud-Tool nicht, statt zu raten', () => {
    expect(ai).toContain("'MODEL_PRICE_MISSING'");
    // Die Schätzung — und damit der Wurf — steht vor Reservierung und
    // Providercall.
    const estimate = ai.indexOf('estimatedUsd = toolCostUsd(');
    expect(estimate).toBeGreaterThan(-1);
    expect(estimate).toBeLessThan(ai.indexOf('reserveLlmBudget(admin'));
    expect(estimate).toBeLessThan(ai.indexOf('await callProvider('));
  });

  it('ein fehlender Preis landet als Fehlerlauf in ai_tool_runs', () => {
    // Der Wurf steht vor dem try um callProvider; ohne eigenen Insert sähe
    // man ein Tool ohne Preis nur im Log.
    const estimate = ai.indexOf('estimatedUsd = toolCostUsd(');
    const reserve = ai.indexOf('reserveLlmBudget(admin');
    const between = ai.slice(estimate, reserve);
    expect(between).toContain("e.code === 'MODEL_PRICE_MISSING'");
    expect(between).toContain(".from('ai_tool_runs').insert(");
    expect(between).toContain("status: 'error'");
  });

  it('ein abgelehnter Fehler-Insert in ai_tool_runs fällt im Log auf', () => {
    // Supabase wirft dabei nicht; ohne Prüfung fehlte der Lauf still.
    const inserts = ai.split(".from('ai_tool_runs').insert(").length - 1;
    const checked = ai.match(/const \{ error: insertError \} = await admin\.from\('ai_tool_runs'\)\.insert\(/g) ?? [];
    expect(checked.length).toBe(2);
    expect(ai.match(/logRunInsertError\(insertError,/g) ?? []).toHaveLength(2);
    expect(ai).toContain("scope: 'ai_tool_runs_insert_failed'");
    // Erfolgszeile + zwei Fehlerzeilen — kommt ein Insert dazu, hier entscheiden.
    expect(inserts).toBe(3);
  });

  it('die Antwort an den Client nennt weder Anbieter noch Modell', () => {
    // bot-chat gibt message und details unverändert an anonyme Widget-Nutzer.
    const fn = ai.slice(ai.indexOf('function toolCostUsd('), ai.indexOf('async function resolveResidency('));
    const thrown = fn.slice(fn.indexOf('throw new AiInvokeError('));
    expect(thrown).not.toMatch(/\$\{provider\}|\$\{modelId\}|model_id:/);
  });
});

// Providerkosten eines Laufs — der eine Entscheidungskern für beide Pfade,
// die heute Geld verbuchen:
//
//   runAiTool (_shared/ai.ts)    → ai_tool_runs.cost_usd, Kontingent, Kosten-Cap, Ledger
//   governance-agent/index.ts    → agent_runs.cost_usd
//
// Preise kommen ausschließlich aus der Einkaufspreis-SSoT
// (shared/model-prices.ts, hier als generierter Deno-Zwilling). Bis Schritt C
// rechnete jeder Pfad mit eigenen Zahlen und eigener Formel; beide verbuchten
// Cache-Writes höchstens zum vollen Input-Preis und Cache-Reads gar nicht.
//
// Bewusst importfrei bis auf den Zwilling: ai.ts und governance-agent ziehen
// npm-/jsr-Importe und lassen sich in Vitest nicht laden, dieser Kern schon.

import { costUsd, priceFor } from './modelPrices.generated.ts';

/**
 * Verbrauch eines Laufs, auf die vier Preisarten abgebildet.
 *
 * Die vier Felder schließen einander aus: `input` sind nur die NICHT
 * gecachten Input-Tokens. Wer einen Anbieter anbindet, bildet dessen Usage
 * genau darauf ab — die Anbieter zählen Cache-Tokens nicht gleich.
 */
export interface TokenUsage {
  /** Nicht gecachte Input-Tokens (voller Input-Preis). */
  input: number;
  output: number;
  /** In den Prompt-Cache geschriebene Input-Tokens. */
  cacheWrite: number;
  /** Aus dem Prompt-Cache gelesene Input-Tokens. */
  cacheRead: number;
}

export const NO_USAGE: Readonly<TokenUsage> = Object.freeze({
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
});

/** Anthropic-Usage, wie Messages-API und SDK sie liefern. */
export interface AnthropicUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/**
 * Anthropic zählt Cache-Tokens NEBEN `input_tokens`, nicht darin: beide
 * Cache-Arten sind in `input_tokens` bereits ausgeschlossen. Sie werden also
 * daneben gezählt, nicht davon abgezogen.
 */
export function fromAnthropicUsage(u: AnthropicUsage): TokenUsage {
  return {
    input: nonNegative(u.input_tokens),
    output: nonNegative(u.output_tokens),
    cacheWrite: nonNegative(u.cache_creation_input_tokens),
    cacheRead: nonNegative(u.cache_read_input_tokens),
  };
}

/**
 * OpenAI und Gemini zählen gelesene Cache-Tokens IN den Prompt-Tokens mit
 * (`prompt_tokens_details.cached_tokens` bzw. `cachedContentTokenCount` sind
 * eine Teilmenge). Also abziehen, nicht addieren. Einen separat berechneten
 * Cache-Write kennen beide nicht.
 *
 * Heute ohne Preiswirkung — die SSoT führt nur Anthropic —, aber die Abbildung
 * muss stimmen, bevor dort eine Zeile hinzukommt.
 */
export function fromInclusiveCacheUsage(u: {
  promptTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
}): TokenUsage {
  const prompt = nonNegative(u.promptTokens);
  const cached = Math.min(nonNegative(u.cachedTokens), prompt);
  return {
    input: prompt - cached,
    output: nonNegative(u.outputTokens),
    cacheWrite: 0,
    cacheRead: cached,
  };
}

/** Summe zweier Verbräuche — für Tool-Schleifen mit mehreren Requests. */
export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheRead: a.cacheRead + b.cacheRead,
  };
}

/**
 * Kosten in USD aus der Einkaufspreis-SSoT — oder `null`, wenn für
 * (Anbieter, Modell) kein Preis geführt ist.
 *
 * Kein Raten: was bei `null` passiert, entscheidet der Aufrufer, und zwar
 * sichtbar. agent_runs.cost_usd darf NULL sein und bekommt NULL; runAiTool
 * muss eine Zahl verbuchen und fällt auf den Preis zurück, den das Tool
 * selbst konfiguriert.
 */
export function providerCostUsd(
  provider: string,
  modelId: string,
  usage: TokenUsage,
): number | null {
  const price = priceFor(provider, modelId);
  return price ? costUsd(price, usage) : null;
}

function nonNegative(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  AUTOMATISCH GENERIERT — NICHT BEARBEITEN                             ║
// ║                                                                       ║
// ║  Quelle:    shared/model-prices.ts                                    ║
// ║  Generator: scripts/sync-model-prices.mjs (npm run sync:model-prices) ║
// ║                                                                       ║
// ║  Änderungen ausschließlich in shared/model-prices.ts vornehmen und    ║
// ║  danach `npm run sync:model-prices` ausführen. Der Drift-Test in      ║
// ║  test/config/model-prices-ssot.test.ts schlägt sonst fehl.            ║
// ╚═══════════════════════════════════════════════════════════════════════╝

/**
 * Einkaufspreise der LLM-Provider — Single Source of Truth.
 *
 * ACHTUNG, zwei verschiedene Dinge:
 *
 *   shared/pricing.ts        VERKAUFSpreise  — was ein Kunde uns zahlt
 *                                              (Starter €79 … Enterprise+ €1.999)
 *   shared/model-prices.ts   EINKAUFSpreise  — was ein Providertoken uns kostet
 *
 * Diese Datei ist ausschließlich das Zweite. Sie berührt weder Pläne noch
 * Entitlements noch Kontingente.
 *
 * ── Warum es diese Datei gibt ────────────────────────────────────────────
 *
 * Bis 2026-09 lagen Providerpreise an vier Stellen gleichzeitig:
 *
 *   1. `ai_tools.cost_input_per_million_usd` / `cost_output_per_million_usd`
 *      (Datenbank, fünf Zeilen für zwei Modelle — drei redundante Paare)
 *   2. `_shared/modelSelection.ts` → `MODEL_PRICING`
 *   3. `governance-agent/index.ts` → `estimateCostUsd`
 *   4. `governance-agent/index.ts` → `estimateCostUsFromModel`
 *
 * Keine kannte die anderen, und drei von vier trugen falsche Zahlen. Ein
 * Preis gehört zu `(provider, model_id)` — nicht zu einem Tool, nicht zu
 * einer Komplexitätsstufe und nicht zu einer Schätzfunktion.
 *
 * ── Portabilität ─────────────────────────────────────────────────────────
 *
 * Diese Datei darf KEINE Imports und KEINE plattformspezifischen Globals
 * enthalten. Sie läuft unverändert in Browser, Node und Deno. Der Deno-
 * Zwilling `supabase/functions/_shared/modelPrices.generated.ts` wird per
 * `npm run sync:model-prices` erzeugt, weil `supabase functions deploy` nur
 * den Inhalt von `supabase/functions/` bündelt und ein Import nach
 * `../../shared/` erst im Deploy bricht. `npm run check:model-prices`
 * erzwingt, dass beide byte-identisch bleiben.
 *
 * Änderungen also ausschließlich hier, danach `npm run sync:model-prices`.
 */

/** Anbieter, für die Preise hinterlegt sind. */
export type ModelProvider = 'anthropic';

export interface ModelPrice {
  provider: ModelProvider;
  /** Modell-ID exakt so, wie der Anbieter sie veröffentlicht. */
  modelId: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  /**
   * Explizite Cache-Preise, wo der Anbieter sie getrennt ausweist.
   *
   * `null` heißt „nicht separat veröffentlicht" — dann gelten die
   * Multiplikatoren unten. Es heißt NICHT „kostenlos".
   */
  cacheWritePerMillionUsd: number | null;
  cacheReadPerMillionUsd: number | null;
  /** Belegstelle. Ohne sie ist in sechs Monaten nicht mehr nachvollziehbar, woher eine Zahl kam. */
  source: string;
}

/**
 * Cache-Multiplikatoren, wenn ein Modell keine eigenen Cache-Preise ausweist.
 *
 * Sie sind ein Default, kein Naturgesetz: Fable 5.1 liest Cache zu
 * $0,25/1M — weniger als 0,10 × $10,00. Deshalb dürfen sie einen expliziten
 * Wert niemals überschreiben.
 */
export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER  = 0.10;

/**
 * Stand: Anthropic-Erstanbieter-Raten, USD je 1 Mio. Tokens.
 *
 * Bedrock und Vertex rechnen abweichend ab — deshalb ist `provider` Teil des
 * Schlüssels und nicht nur `modelId`.
 *
 * Bewusst NICHT enthalten sind ältere Modelle (etwa `claude-opus-4-1-20250805`
 * oder `claude-3-5-sonnet-20241022`), die an einzelnen Stellen im Repo noch
 * als Modell-ID auftauchen. Für sie liegt keine belegte aktuelle Rate vor, und
 * eine geschätzte Zahl hier wäre schlimmer als gar keine: `priceFor` gibt für
 * sie `null` zurück, und der Aufrufer muss das als Fehler behandeln statt
 * einen Nachbarpreis zu raten. Genau dieses stille Raten war der Defekt in
 * `estimateCostUsFromModel`.
 */
export const MODEL_PRICES: ModelPrice[] = [
  {
    provider: 'anthropic',
    modelId: 'claude-fable-5-1',
    inputPerMillionUsd: 10.00,
    outputPerMillionUsd: 50.00,
    cacheWritePerMillionUsd: null,
    // Ausdrücklich ausgewiesen und niedriger als der 0,10-Default (der 1,00 ergäbe).
    cacheReadPerMillionUsd: 0.25,
    source: 'anthropic-pricing-2026-06-24',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-fable-5',
    inputPerMillionUsd: 10.00,
    outputPerMillionUsd: 50.00,
    cacheWritePerMillionUsd: null,
    cacheReadPerMillionUsd: null,
    source: 'anthropic-pricing-2026-06-24',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-mythos-5-1',
    inputPerMillionUsd: 10.00,
    outputPerMillionUsd: 50.00,
    cacheWritePerMillionUsd: null,
    // Ob Mythos 5.1 die $0,25 von Fable 5.1 teilt, ist nicht belegt — deshalb Default.
    cacheReadPerMillionUsd: null,
    source: 'anthropic-pricing-2026-06-24',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-opus-5',
    inputPerMillionUsd: 5.00,
    outputPerMillionUsd: 25.00,
    cacheWritePerMillionUsd: null,
    cacheReadPerMillionUsd: null,
    source: 'anthropic-pricing-2026-06-24',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-opus-4-8',
    inputPerMillionUsd: 5.00,
    outputPerMillionUsd: 25.00,
    cacheWritePerMillionUsd: null,
    cacheReadPerMillionUsd: null,
    source: 'anthropic-pricing-2026-06-24',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-opus-4-7',
    inputPerMillionUsd: 5.00,
    outputPerMillionUsd: 25.00,
    cacheWritePerMillionUsd: null,
    cacheReadPerMillionUsd: null,
    source: 'anthropic-pricing-2026-06-24',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    inputPerMillionUsd: 5.00,
    outputPerMillionUsd: 25.00,
    cacheWritePerMillionUsd: null,
    cacheReadPerMillionUsd: null,
    source: 'anthropic-pricing-2026-06-24',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-5',
    inputPerMillionUsd: 2.00,
    outputPerMillionUsd: 10.00,
    cacheWritePerMillionUsd: null,
    cacheReadPerMillionUsd: null,
    source: 'anthropic-pricing-2026-06-24',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    inputPerMillionUsd: 3.00,
    outputPerMillionUsd: 15.00,
    cacheWritePerMillionUsd: null,
    cacheReadPerMillionUsd: null,
    source: 'anthropic-pricing-2026-06-24',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5',
    inputPerMillionUsd: 1.00,
    outputPerMillionUsd: 5.00,
    cacheWritePerMillionUsd: null,
    cacheReadPerMillionUsd: null,
    source: 'anthropic-pricing-2026-06-24',
  },
];

/**
 * Preis für `(provider, modelId)` — oder `null`, wenn die Kombination nicht
 * hinterlegt ist.
 *
 * KEIN Fallback auf ein ähnliches Modell. Ein unbekanntes Modell ist ein
 * Fehler, kein Sonnet. Der Aufrufer schreibt dann lieber keine Kostenzeile
 * als eine erfundene: eine fehlende Zahl ist reparierbar, eine falsche wandert
 * unbemerkt in Kontingent und Ledger.
 */
export function priceFor(provider: string, modelId: string): ModelPrice | null {
  const p = provider.trim().toLowerCase();
  const m = modelId.trim().toLowerCase();
  return MODEL_PRICES.find((e) => e.provider === p && e.modelId === m) ?? null;
}

/** Cache-Schreibpreis je 1M Tokens — explizit, sonst abgeleitet. */
export function cacheWritePerMillionUsd(price: ModelPrice): number {
  return price.cacheWritePerMillionUsd ?? price.inputPerMillionUsd * CACHE_WRITE_MULTIPLIER;
}

/** Cache-Lesepreis je 1M Tokens — explizit, sonst abgeleitet. */
export function cacheReadPerMillionUsd(price: ModelPrice): number {
  return price.cacheReadPerMillionUsd ?? price.inputPerMillionUsd * CACHE_READ_MULTIPLIER;
}

/**
 * Kosten eines Laufs in USD.
 *
 * Alle vier Tokenarten getrennt — genau deshalb, weil der heutige Adapter
 * Cache-Writes zum vollen Input-Preis verbucht und Cache-Reads gar nicht:
 * `anthropicAdapter.ts` addiert `cache_creation_input_tokens` auf
 * `input_tokens` und lässt `cache_read_input_tokens` ungenutzt liegen.
 *
 * Diese Funktion hat in PR A noch keinen Aufrufer. Sie steht hier, damit die
 * Formel an einer Stelle definiert ist, bevor die Aufrufer umgestellt werden.
 */
export function costUsd(
  price: ModelPrice,
  tokens: {
    input: number;
    output: number;
    cacheWrite?: number;
    cacheRead?: number;
  },
): number {
  const perMillion = (count: number, rate: number) => (count / 1_000_000) * rate;
  return (
    perMillion(tokens.input, price.inputPerMillionUsd) +
    perMillion(tokens.output, price.outputPerMillionUsd) +
    perMillion(tokens.cacheWrite ?? 0, cacheWritePerMillionUsd(price)) +
    perMillion(tokens.cacheRead ?? 0, cacheReadPerMillionUsd(price))
  );
}

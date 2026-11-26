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
  /**
   * Zweite Preisstufe für lange Prompts, wo der Anbieter eine ausweist
   * (Haiku 5.5: oberhalb von 100.000 Prompt-Tokens gilt der Long-Context-Satz).
   *
   * Prompt-Länge = alle Input-Tokens des Requests, also nicht gecachter Input
   * plus Cache-Writes plus Cache-Reads. Jeder Request wird einzeln bepreist.
   * Fehlt das Feld, gilt für jede Prompt-Länge der Grundsatz oben.
   */
  longContext?: LongContextTier;
}

/** Preisstufe oberhalb einer Prompt-Länge. Gleiche Bedeutung der Felder wie in `ModelPrice`. */
export interface LongContextTier {
  /** Gilt, wenn die Prompt-Länge diesen Wert ÜBERSCHREITET. */
  aboveInputTokens: number;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cacheWritePerMillionUsd: number | null;
  cacheReadPerMillionUsd: number | null;
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
  // ── Generation 5.5 / Fable 5.2 ──────────────────────────────────────────
  // Cache-Preise ausdrücklich, weil die Lese-Multiplikatoren hier vom 0,10-
  // Default abweichen (Opus/Sonnet 5.5: 0,05×, Fable 5.2: $0,20 fest).
  // Cache-Write = 5-Minuten-Cache, den die Adapter heute verwenden.
  {
    provider: 'anthropic',
    modelId: 'claude-fable-5-2',
    inputPerMillionUsd: 8.00,
    outputPerMillionUsd: 40.00,
    cacheWritePerMillionUsd: 10.00,
    cacheReadPerMillionUsd: 0.20,
    source: 'anthropic-pricing-2026-11-25',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-opus-5-5',
    inputPerMillionUsd: 4.00,
    outputPerMillionUsd: 20.00,
    cacheWritePerMillionUsd: 5.00,
    cacheReadPerMillionUsd: 0.20,
    source: 'anthropic-pricing-2026-11-25',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-5-5',
    inputPerMillionUsd: 2.00,
    outputPerMillionUsd: 10.00,
    cacheWritePerMillionUsd: 2.50,
    cacheReadPerMillionUsd: 0.10,
    source: 'anthropic-pricing-2026-11-25',
  },
  {
    provider: 'anthropic',
    modelId: 'claude-haiku-5-5',
    // Grundsatz gilt für Prompts bis einschließlich 100.000 Tokens.
    inputPerMillionUsd: 0.10,
    outputPerMillionUsd: 0.50,
    cacheWritePerMillionUsd: 0.125,
    cacheReadPerMillionUsd: 0.01,
    source: 'anthropic-pricing-2026-11-25',
    longContext: {
      aboveInputTokens: 100_000,
      inputPerMillionUsd: 0.50,
      outputPerMillionUsd: 2.50,
      cacheWritePerMillionUsd: 0.625,
      cacheReadPerMillionUsd: 0.05,
    },
  },
  // ── Ältere Generationen ─────────────────────────────────────────────────
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

/** Datums-Suffix einer Snapshot-ID, etwa `-20251001`. */
const SNAPSHOT_SUFFIX = /-\d{8}$/;

/**
 * Preis für `(provider, modelId)` — oder `null`, wenn die Kombination nicht
 * hinterlegt ist.
 *
 * KEIN Fallback auf ein ähnliches Modell. Ein unbekanntes Modell ist ein
 * Fehler, kein Sonnet. Der Aufrufer schreibt dann lieber keine Kostenzeile
 * als eine erfundene: eine fehlende Zahl ist reparierbar, eine falsche wandert
 * unbemerkt in Kontingent und Ledger.
 *
 * Eine datierte Snapshot-ID (`claude-haiku-4-5-20251001`) ist kein anderes
 * Modell, sondern ein fester Stand desselben — sie kostet, was die Basis-ID
 * kostet. Deshalb: exakter Treffer zuerst, sonst das Datums-Suffix abtrennen
 * und die Basis-ID suchen. Nur diese eine Stufe, und nur wenn die Basis-ID
 * wirklich geführt ist — `claude-opus-4-1-20250805` bleibt `null`, weil es
 * keine Zeile `claude-opus-4-1` gibt.
 *
 * Das ist keine Prüfung, ob die ID existiert: eine erfundene ID mit
 * angehängtem Datum bekommt hier den Preis ihrer Basis. Ob Anthropic sie
 * annimmt, entscheidet der Request, nicht die Preistabelle.
 */
export function priceFor(provider: string, modelId: string): ModelPrice | null {
  const p = provider.trim().toLowerCase();
  const m = modelId.trim().toLowerCase();
  const exact = MODEL_PRICES.find((e) => e.provider === p && e.modelId === m);
  if (exact) return exact;
  const base = m.replace(SNAPSHOT_SUFFIX, '');
  if (base === m) return null;
  return MODEL_PRICES.find((e) => e.provider === p && e.modelId === base) ?? null;
}

/** Die vier Sätze einer Preisstufe — Grundsatz (`ModelPrice`) oder `LongContextTier`. */
type RateSet = Pick<
  ModelPrice,
  'inputPerMillionUsd' | 'outputPerMillionUsd' | 'cacheWritePerMillionUsd' | 'cacheReadPerMillionUsd'
>;

/** Cache-Schreibpreis je 1M Tokens — explizit, sonst abgeleitet. */
export function cacheWritePerMillionUsd(price: RateSet): number {
  return price.cacheWritePerMillionUsd ?? price.inputPerMillionUsd * CACHE_WRITE_MULTIPLIER;
}

/** Cache-Lesepreis je 1M Tokens — explizit, sonst abgeleitet. */
export function cacheReadPerMillionUsd(price: RateSet): number {
  return price.cacheReadPerMillionUsd ?? price.inputPerMillionUsd * CACHE_READ_MULTIPLIER;
}

/**
 * Preisstufe für einen Request mit `promptTokens` Input-Tokens insgesamt
 * (nicht gecacht + Cache-Write + Cache-Read). Ohne `longContext` immer der
 * Grundsatz; mit `longContext` der Long-Context-Satz, sobald die Prompt-Länge
 * die Schwelle überschreitet.
 */
export function rateFor(price: ModelPrice, promptTokens: number): RateSet {
  const tier = price.longContext;
  if (tier && promptTokens > tier.aboveInputTokens) return tier;
  return price;
}

/**
 * Kosten eines Laufs in USD.
 *
 * Alle vier Tokenarten getrennt. Bis Schritt C verbuchten beide Kostenpfade
 * Cache-Writes höchstens zum vollen Input-Preis und Cache-Reads gar nicht.
 *
 * `input` meint hier die NICHT gecachten Input-Tokens — bei Anthropic genau
 * `usage.input_tokens`, das Cache-Writes und Cache-Reads bereits ausschließt.
 * Aufrufer gehen über `supabase/functions/_shared/providerCost.ts`, nicht
 * direkt hierher: dort wird die Anbieter-Usage auf diese vier Arten abgebildet.
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
  const cacheWrite = tokens.cacheWrite ?? 0;
  const cacheRead = tokens.cacheRead ?? 0;
  // Ein Request ist genau einer Stufe zugeordnet — keine Aufteilung an der Schwelle.
  const rate = rateFor(price, tokens.input + cacheWrite + cacheRead);
  return (
    perMillion(tokens.input, rate.inputPerMillionUsd) +
    perMillion(tokens.output, rate.outputPerMillionUsd) +
    perMillion(cacheWrite, cacheWritePerMillionUsd(rate)) +
    perMillion(cacheRead, cacheReadPerMillionUsd(rate))
  );
}

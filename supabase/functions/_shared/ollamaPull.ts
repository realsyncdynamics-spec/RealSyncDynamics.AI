// Auto-Pull-Guard fuer Ollama-Modelle.
//
// Problem: Wenn ai_tools.ollama_model_id auf ein Modell zeigt, das der VPS
// noch nicht gepullt hat (Drift nach Migrationswechsel), antwortet Ollama mit
// HTTP 404 und der User-Call schlaegt unvermittelt fehl. Manueller `ollama pull`
// auf dem VPS ist ein Race-Risiko bei jedem Modellwechsel.
//
// Loesung: Vor jedem Chat-Call ein /api/tags-Probe; wenn das verlangte Modell
// fehlt, im Hintergrund einen Pull triggern und mit MODEL_PROVISIONING (503)
// zurueckgeben. Beim naechsten Aufruf ist das Modell da.
//
// Dependencies sind injizierbar (fetch + clock + state) damit Tests den Cache
// und in-flight-Tracker explizit zuruecksetzen koennen, ohne globalen State.

export type FetchLike = typeof fetch;

export interface OllamaPullGuardState {
  /** Cached set of model names that the Ollama instance reported via /api/tags. */
  tagsCache: { fetchedAt: number; models: Set<string> } | null;
  /** Model names for which a background pull is currently in-flight (dedup). */
  inFlightPulls: Set<string>;
}

export function createOllamaPullGuardState(): OllamaPullGuardState {
  return { tagsCache: null, inFlightPulls: new Set() };
}

/** Module-level state for production use (one cache per Edge-Function worker). */
const defaultState: OllamaPullGuardState = createOllamaPullGuardState();

export interface EnsureModelOptions {
  baseUrl: string;
  headers: Record<string, string>;
  model: string;
  fetchImpl?: FetchLike;
  now?: () => number;
  state?: OllamaPullGuardState;
  /** Cache-Lebensdauer in ms. Default: 60s. */
  cacheTtlMs?: number;
  /** Background-Pull-Trigger ueberschreibbar (Tests). */
  triggerPull?: (model: string, baseUrl: string, headers: Record<string, string>) => void;
}

export type EnsureModelResult =
  | { status: 'present' }
  | { status: 'unchecked' }              // /api/tags fehlgeschlagen → fall-open
  | { status: 'provisioning'; model: string };

/**
 * Stellt sicher dass `model` auf der Ollama-Instanz gepullt ist.
 *
 * - `'present'`     → Modell ist da, Caller darf Chat-Call ausloesen.
 * - `'unchecked'`   → /api/tags-Probe selbst hat versagt (Netzwerkfehler oder
 *                    HTTP != 200). Fall-open: wir vertrauen dem Chat-Call,
 *                    sonst wuerde ein Tags-API-Bug den ganzen eu_local-Pfad
 *                    blockieren.
 * - `'provisioning'` → Modell fehlt; ein Background-Pull wurde getriggert
 *                    (deduped). Caller soll ProviderError MODEL_PROVISIONING
 *                    werfen — 503 + Retry-Hinweis.
 */
export async function ensureOllamaModel(opts: EnsureModelOptions): Promise<EnsureModelResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const now = opts.now ?? Date.now;
  const state = opts.state ?? defaultState;
  const ttl = opts.cacheTtlMs ?? 60_000;
  const triggerPull = opts.triggerPull ?? defaultTriggerPull;

  const models = await fetchTags({ baseUrl: opts.baseUrl, headers: opts.headers, fetchImpl, now, state, ttl });
  if (models === null) return { status: 'unchecked' };
  if (models.has(opts.model)) return { status: 'present' };

  triggerPull(opts.model, opts.baseUrl, { ...opts.headers, 'Content-Type': 'application/json' });
  // Beim naechsten Call moechten wir das frisch gepullte Modell sehen, also
  // den Cache jetzt invalidieren — er wird beim naechsten ensureOllamaModel
  // neu befuellt.
  state.tagsCache = null;
  return { status: 'provisioning', model: opts.model };
}

async function fetchTags(p: {
  baseUrl: string;
  headers: Record<string, string>;
  fetchImpl: FetchLike;
  now: () => number;
  state: OllamaPullGuardState;
  ttl: number;
}): Promise<Set<string> | null> {
  const t = p.now();
  if (p.state.tagsCache && t - p.state.tagsCache.fetchedAt < p.ttl) {
    return p.state.tagsCache.models;
  }
  let resp: Response;
  try {
    resp = await p.fetchImpl(`${p.baseUrl.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      headers: p.headers,
    });
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  let data: { models?: Array<{ name?: string; model?: string }> };
  try {
    data = await resp.json();
  } catch {
    return null;
  }
  const models = new Set<string>(
    (data.models ?? [])
      .map((m) => m.name ?? m.model ?? '')
      .filter((s): s is string => s.length > 0),
  );
  p.state.tagsCache = { fetchedAt: t, models };
  return models;
}

/**
 * Fire-and-forget POST /api/pull. Deduplicated per process: zwei parallele
 * Requests fuer dasselbe Modell loesen nur einen Pull aus.
 *
 * Ollama selbst deduped Pulls server-seitig auch, aber wir vermeiden hier
 * zusaetzlich unnoetige Netzwerk-Calls.
 */
function defaultTriggerPull(model: string, baseUrl: string, headers: Record<string, string>): void {
  if (defaultState.inFlightPulls.has(model)) return;
  defaultState.inFlightPulls.add(model);
  globalThis.fetch(`${baseUrl.replace(/\/$/, '')}/api/pull`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: model, stream: false }),
  })
    .then(() => console.log(`[ollama-pull-guard] pull complete: ${model}`))
    .catch((e) => console.error(`[ollama-pull-guard] pull failed for ${model}:`, (e as Error).message))
    .finally(() => defaultState.inFlightPulls.delete(model));
}

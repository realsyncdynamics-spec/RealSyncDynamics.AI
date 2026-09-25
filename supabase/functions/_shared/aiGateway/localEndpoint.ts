import type { AiGatewayResponse, AiProviderAdapter } from './types.ts';

// Erkennung lokaler Inferenz-Endpunkte, die aus der gehosteten Supabase-
// Edge-Runtime grundsätzlich nicht erreichbar sind (localhost, Loopback,
// RFC1918, Link-Local, host.docker.internal, *.local).
//
// Hintergrund (Brief-Cron, 45/45 × HTTP 500): ai-gateway verlangt eine
// lokale Base-URL (LM_STUDIO_BASE_URL bzw. OLLAMA_BASE_URL). Zeigt sie auf
// einen Entwicklerrechner, scheitert in der Cloud jeder Aufruf erst am
// Health-Probe und fällt dann in die Cloud-Kette — oder, ohne Cloud-Key,
// endet er in einem unklaren Fehler. Diese Prüfung macht den Zustand
// explizit: lokaler Slot aus, klare Meldung, Cloud-Kette falls konfiguriert.
//
// Keine Deno-/jsr-Importe (vitest-importierbar).

const PRIVATE_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
];

/** true, wenn der Host nur lokal / im privaten Netz auflösbar ist. */
export function isLocalOnlyHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === 'host.docker.internal' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.includes(':')) {
    // IPv6-Literal: Loopback, unspecified, Link-Local, Unique-Local (fc00::/7).
    return h === '::1' || h === '::' || /^fe[89ab][0-9a-f]:/.test(h) || /^f[cd][0-9a-f]{2}:/.test(h);
  }
  return PRIVATE_V4.some((rx) => rx.test(h));
}

/** true, wenn SUPABASE_URL auf das gehostete Supabase zeigt (nicht lokal). */
export function isHostedSupabase(supabaseUrl: string | undefined): boolean {
  if (!supabaseUrl) return false;
  try {
    const host = new URL(supabaseUrl).hostname.toLowerCase();
    return host.endsWith('.supabase.co') || host.endsWith('.supabase.in');
  } catch {
    return false;
  }
}

export type LocalEndpointCheck =
  | { ok: true }
  | { ok: false; reason: 'invalid_url' | 'local_only_host'; host: string | null };

/**
 * Prüft eine lokale Provider-Base-URL gegen die Laufzeitumgebung.
 * Nur in der gehosteten Edge-Runtime wird ein lokaler Host verworfen —
 * `supabase functions serve` darf weiter auf localhost/LM Studio zeigen.
 */
export function checkLocalEndpoint(baseUrl: string, supabaseUrl: string | undefined): LocalEndpointCheck {
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return { ok: false, reason: 'invalid_url', host: null };
  }
  if (isHostedSupabase(supabaseUrl) && isLocalOnlyHost(host)) {
    return { ok: false, reason: 'local_only_host', host };
  }
  return { ok: true };
}

/** Fehlertext, den der deaktivierte lokale Slot wirft. Enthält bewusst
 *  „connection refused", damit der Router ihn als Transportfehler wertet
 *  und in die Cloud-Kette weiterreicht. */
export const LOCAL_UNREACHABLE_MESSAGE =
  'local provider unreachable from hosted edge runtime (loopback/private base URL) — connection refused';


export type LocalSlotDecision =
  | { action: 'use' }
  | { action: 'disable'; reason: string }
  | { action: 'fail'; reason: string; status: 503; code: 'LOCAL_PROVIDER_UNREACHABLE'; message: string };

/**
 * Entscheidet über den lokalen Provider-Slot (rein, testbar):
 *   use     → Base-URL ist aus dieser Laufzeit erreichbar (oder nicht gehostet)
 *   disable → lokal-only im gehosteten Supabase, Cloud-Kette vorhanden/erlaubt
 *   fail    → lokal-only und KEINE Cloud-Kette (nicht konfiguriert oder für
 *             diesen Pfad nicht erlaubt) → 503 statt unklarem 500 pro Aufruf.
 * Meldungen nennen nur den Variablennamen, nie den Wert.
 */
export function decideLocalSlot(input: {
  envName: string;
  baseUrl: string | undefined;
  supabaseUrl: string | undefined;
  hasCloud: boolean;
}): LocalSlotDecision {
  if (!input.baseUrl) return { action: 'use' };
  const check = checkLocalEndpoint(input.baseUrl, input.supabaseUrl);
  if (check.ok) return { action: 'use' };
  if (input.hasCloud) return { action: 'disable', reason: check.reason };
  return {
    action: 'fail',
    reason: check.reason,
    status: 503,
    code: 'LOCAL_PROVIDER_UNREACHABLE',
    message: check.reason === 'invalid_url'
      ? `${input.envName} is not a valid URL and no cloud fallback is configured or allowed for this path`
      : `${input.envName} points to a local-only host that the hosted edge runtime cannot reach, and no cloud fallback is configured or allowed for this path`,
  };
}

/**
 * Platzhalter für einen lokalen Slot, der aus der gehosteten Edge-Runtime
 * nicht erreichbar ist. Wirft sofort einen Fehler, den der Router als
 * Transportfehler wertet (→ Cloud-Kette, falls vorhanden), statt pro Aufruf
 * einen Netzwerk-Probe gegen localhost zu schicken.
 */
export class UnreachableLocalAdapter implements AiProviderAdapter {
  readonly id: 'lm_studio' | 'ollama';
  constructor(provider: 'lm_studio' | 'ollama') {
    this.id = provider;
  }
  health() {
    return Promise.resolve({ ok: false, error: LOCAL_UNREACHABLE_MESSAGE });
  }
  generate(): Promise<AiGatewayResponse<string>> {
    return Promise.reject(new Error(LOCAL_UNREACHABLE_MESSAGE));
  }
  extractJson<T>(): Promise<AiGatewayResponse<T>> {
    return Promise.reject(new Error(LOCAL_UNREACHABLE_MESSAGE));
  }
  embed(): Promise<AiGatewayResponse<number[]>> {
    return Promise.reject(new Error(LOCAL_UNREACHABLE_MESSAGE));
  }
}

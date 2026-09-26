// Konfiguration für interne Aufrufer des ai-gateway (Service-Pfad).
//
// Interne Edge Functions ohne Nutzerkontext (Cron, Webhooks, öffentliche
// anon-Pfade mit eigener Drosselung) authentisieren sich am Gateway mit
// `x-internal-key` = Edge-Secret AI_GATEWAY_INTERNAL_KEY und nennen sich
// über `x-internal-caller`. `apikey`/Bearer bleiben der Anon-Key, nur damit
// die Plattform-JWT-Prüfung (verify_jwt = true) passiert — autorisiert wird
// ausschließlich über den internen Key. Den service_role-Key NIE als Bearer
// an den Gateway schicken.
//
// Keine Deno-/jsr-Importe: `env` wird injiziert (vitest-importierbar).

import type { EdgeClientConfig } from './edgeClient.ts';

export type InternalGatewayConfig =
  | { ok: true; config: Pick<EdgeClientConfig, 'supabaseUrl' | 'apiKey' | 'internalKey' | 'internalCaller'> }
  | { ok: false; missing: string[] };

export function internalGatewayConfig(
  caller: string,
  env: (name: string) => string | undefined,
): InternalGatewayConfig {
  const supabaseUrl = env('SUPABASE_URL');
  const apiKey = env('SUPABASE_ANON_KEY');
  const internalKey = env('AI_GATEWAY_INTERNAL_KEY');
  const missing = [
    !supabaseUrl ? 'SUPABASE_URL' : null,
    !apiKey ? 'SUPABASE_ANON_KEY' : null,
    !internalKey ? 'AI_GATEWAY_INTERNAL_KEY' : null,
  ].filter((x): x is string => x !== null);
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    config: { supabaseUrl: supabaseUrl!, apiKey: apiKey!, internalKey: internalKey!, internalCaller: caller },
  };
}

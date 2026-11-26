// public-platform-stats — Ersatz für das anonyme RPC public.platform_stats().
//
// GET /functions/v1/public-platform-stats
// verify_jwt = false. Ruft dieselbe Funktion public.platform_stats() mit
// service_role auf (Körper: Migration 20260623000000). Dafür muss
// service_role EXECUTE haben — siehe
// sql/companion-service-role-grants-for-replacements.sql (nicht in v2).
// 60-Sekunden-Speicher-Cache, IP-Rate-Limit über vorhandenes bot_rate_hit.
// Keine einzelnen Domain-/E-Mail-/Firmenwerte.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError, methodNotAllowed } from '../_shared/gateway.ts';
import {
  PUBLIC_STATS_RATE, enforceAnonIpLimit, rateLimitedResponse,
} from '../_shared/public-anon-limit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RATE_LIMIT_SECRET = Deno.env.get('BOT_RATE_LIMIT_SALT') || SERVICE_ROLE;
const CACHE_TTL_MS = 60_000;

type PlatformStatsRow = {
  domains_scanned: number;
  audits_total: number;
  open_risks: number;
  evidence_pct: number;
  last_scan_at: string | null;
};

let cache: { at: number; row: PlatformStatsRow } | null = null;

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'GET') return methodNotAllowed();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const limited = await enforceAnonIpLimit(
    admin, req, 'public:platform-stats:ip', PUBLIC_STATS_RATE, RATE_LIMIT_SECRET,
  );
  if (!limited.allowed) return rateLimitedResponse(jsonError, limited);

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return jsonResponse({ ok: true, ...cache.row });
  }

  const { data, error } = await admin.rpc('platform_stats').single();
  if (error || !data) return jsonError(500, 'INTERNAL', error?.message ?? 'platform_stats empty');

  const row = data as PlatformStatsRow;
  cache = { at: Date.now(), row };
  return jsonResponse({ ok: true, ...row });
});

// tenant-branding-get — öffentlicher, gehärteter Ersatz für das anonyme
// RPC public.get_tenant_branding_by_domain(text).
//
// GET /functions/v1/tenant-branding-get?domain=<host>
// verify_jwt = false. Nur ?domain=; tenant_id wird abgelehnt.
// Interner Aufruf der RPC mit service_role. Die Antwort enthält keine
// tenant_id, keine internen IDs, keine Support-Kontakte und kein custom_css.
// IP-Rate-Limit über public-anon-limit.ts / bot_rate_hit, 60-Sekunden-Cache
// je Domain.
//
// Frist für den späteren REVOKE der RPC: 27. November 2026, 18:00 Uhr
// (Europe/Berlin). Dieses Function-Deploy ist Voraussetzung, nicht der REVOKE.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError, methodNotAllowed } from "../_shared/gateway.ts";
import {
  PUBLIC_BRANDING_RATE, enforceAnonIpLimit, rateLimitedResponse,
} from "../_shared/public-anon-limit.ts";
import { resolvePublicDomain, sanitizePublicBranding } from "../_shared/public-branding.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RATE_LIMIT_SECRET = Deno.env.get("BOT_RATE_LIMIT_SALT") || SERVICE_ROLE;
const CACHE_TTL_MS = 60_000;
const cors = buildCorsHeaders("GET, OPTIONS");

type CacheEntry = { at: number; body: unknown; status: number };
const cache = new Map<string, CacheEntry>();

Deno.serve(async (req) => {
  const preflight = handleOptions(req, cors);
  if (preflight) return preflight;
  if (req.method !== "GET") return methodNotAllowed(cors);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const limited = await enforceAnonIpLimit(
    admin, req, "public:tenant-branding-get:ip", PUBLIC_BRANDING_RATE, RATE_LIMIT_SECRET,
  );
  if (!limited.allowed) return rateLimitedResponse(jsonError, limited);

  const resolved = resolvePublicDomain(new URL(req.url));
  if (!resolved.ok) {
    return jsonError(resolved.status, resolved.code, resolved.message, cors);
  }

  const hit = cache.get(resolved.domain);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return jsonResponse(hit.body, hit.status, withCache(cors, hit.status === 200));
  }

  const { data, error } = await admin.rpc("get_tenant_branding_by_domain", {
    p_domain: resolved.domain,
  });
  if (error) {
    return jsonError(500, "INTERNAL", "branding lookup failed", cors);
  }

  const branding = sanitizePublicBranding(data);
  if (!branding) {
    const body = { ok: false, error: { code: "NOT_FOUND", message: "tenant branding not found" } };
    cache.set(resolved.domain, { at: Date.now(), body, status: 404 });
    return jsonResponse(body, 404, withCache(cors, false));
  }

  const body = { ok: true, branding };
  cache.set(resolved.domain, { at: Date.now(), body, status: 200 });
  return jsonResponse(body, 200, withCache(cors, true));
});

function withCache(headers: Record<string, string>, ok: boolean): Record<string, string> {
  return {
    ...headers,
    "Cache-Control": ok ? "public, max-age=60" : "no-store",
  };
}

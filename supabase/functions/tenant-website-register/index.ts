// tenant-website-register — trägt eine Domain in die Tenant-Registry ein.
//
// ## Warum es diese Function gibt
//
// `public.websites` hat für `authenticated` **nur** eine SELECT-Policy
// (`websites_tenant_read`); Schreibzugriff läuft ausschließlich über
// service_role. Der Client hat trotzdem direkt eingefügt
// (`scansApi.ts::addWebsiteForTenant`) — das konnte nie gelingen, RLS lehnte
// jede Zeile ab. Eine der drei Aufrufstellen verschluckte den Fehler sogar
// mit dem Kommentar „RLS oder Duplikat".
//
// ## Warum keine INSERT-Policy für `authenticated`
//
// `plan_tier` und `status` sind kaufmännisch bedeutsam — `plan_tier` bestimmt
// das gebuchte Paket, `status` den Lebenszyklus bis `live`. Mit einer
// RLS-INSERT-Policy dürfte der Browser beide Werte selbst wählen und sich
// `managed` bzw. `live` setzen, ohne dass je ein Zahlvorgang stattfand.
// Deshalb schreibt der Server — und erzwingt `plan_tier='audit'`,
// `status='lead'`. Die Werte kommen nie aus dem Body.
//
// Body:
//   { domain: string }
// Header:
//   Authorization: Bearer <supabase-jwt>
//   X-Tenant-Id: <tenant uuid>   (Member-Check vor dem Schreiben)
//
// Response:
//   { ok: true, website: { id, tenant_id, domain, plan_tier, status, created_at },
//     created: boolean }
//
// `created:false` heißt: die Domain war für diesen Tenant schon registriert,
// die bestehende Zeile wird zurückgegeben. Ein erneutes Hinzufügen derselben
// Domain ist damit kein Fehler — `unique (tenant_id, domain)` macht das
// eindeutig, und das UI braucht keinen Sonderfall.
//
// Auth-Muster identisch zu `tenant-audit`: Bearer-Token → getUser() →
// memberships-Abgleich gegen X-Tenant-Id. Der Tenant aus dem Header wird
// nie ungeprüft übernommen.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Spiegel von `normaliseDomain` in src/features/governance/scans/scansApi.ts.
 * Deno erreicht `src/` nicht, deshalb die Kopie. Gebunden durch
 * test/governance/domain-normalise-parity.test.ts — läuft eine Seite weg,
 * widersprechen sich Client und Server darüber, was dieselbe Domain ist,
 * und `unique (tenant_id, domain)` greift ins Leere.
 */
function normaliseDomain(raw: string): string | null {
  const s = (raw ?? '').trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.\-]/g, '');
  if (!s) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(s)) {
    return null;
  }
  return s;
}

const SELECT_COLS = 'id, tenant_id, domain, plan_tier, status, created_at';

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'Bearer token required');
  }
  if (!authHeader.slice(7)) return jsonError(401, 'UNAUTHORIZED', 'empty Bearer token');

  const tenantId = req.headers.get('x-tenant-id') ?? '';
  if (!tenantId || !UUID_RE.test(tenantId)) {
    return jsonError(400, 'INVALID_TENANT', 'X-Tenant-Id header must be a valid UUID');
  }

  let body: { domain?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const raw = (body.domain ?? '').trim();
  if (!raw)            return jsonError(400, 'INVALID_DOMAIN', 'domain required');
  if (raw.length > 253) return jsonError(400, 'INVALID_DOMAIN', 'domain too long');
  const domain = normaliseDomain(raw);
  if (!domain) return jsonError(400, 'INVALID_DOMAIN', 'valid domain required');

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Membership-Check gegen den Header-Tenant. Ohne diesen Schritt wäre die
  // Function mit ihrem Service-Role-Key ein Cross-Tenant-Schreibzugriff für
  // jeden angemeldeten Nutzer.
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  });
  const { data: userResult, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResult?.user) {
    return jsonError(401, 'UNAUTHORIZED', `invalid jwt: ${userErr?.message ?? 'no user'}`);
  }
  const userId = userResult.user.id;

  const { data: membership, error: memErr } = await admin
    .from('memberships').select('role')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (memErr)     return jsonError(500, 'INTERNAL', memErr.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');

  // Bereits registriert? Dann die bestehende Zeile zurückgeben statt zu
  // scheitern — Hinzufügen derselben Domain ist eine Wiederholung, kein Fehler.
  const { data: existing, error: readErr } = await admin
    .from('websites').select(SELECT_COLS)
    .eq('tenant_id', tenantId).eq('domain', domain).maybeSingle();
  if (readErr) return jsonError(500, 'INTERNAL', readErr.message);
  if (existing) return jsonResponse({ ok: true, website: existing, created: false });

  // plan_tier und status werden hier gesetzt, nicht übernommen — siehe Kopf.
  const { data: created, error: insErr } = await admin
    .from('websites')
    .insert({ tenant_id: tenantId, domain, plan_tier: 'audit', status: 'lead' })
    .select(SELECT_COLS)
    .single();

  if (insErr) {
    // Wettlauf zweier paralleler Registrierungen: der Unique-Index hat
    // gewonnen. Die Zeile existiert jetzt — nachlesen statt 500 melden.
    if (insErr.code === '23505') {
      const { data: raced } = await admin
        .from('websites').select(SELECT_COLS)
        .eq('tenant_id', tenantId).eq('domain', domain).maybeSingle();
      if (raced) return jsonResponse({ ok: true, website: raced, created: false });
    }
    return jsonError(500, 'INSERT_FAILED', insErr.message);
  }

  return jsonResponse({ ok: true, website: created, created: true });
});

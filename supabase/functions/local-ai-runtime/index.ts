// Local AI Runtime — Tenant-Meldung eines geräte-lokalen Runtime-Profils.
//
// POST /functions/v1/local-ai-runtime
// Authorization: Bearer <user JWT>
// Body: { action: 'register_profile', tenant_hint?, profile_name, role, model, test_result?, enabled }
//
// Was hier NICHT passiert: keine Runtime-URL, keine Inferenz, keine
// Automatisierung. Gespeichert werden nur Rolle, Modell und das gemeldete
// Testergebnis, damit der Mandant sieht, welche lokale KI geprüft wurde.
//
// Auth:
//   - JWT-Prüfung via requireUser (auth.getUser)
//   - Mandant nur aus memberships des Nutzers; tenant_hint wählt nur aus
//   - service_role-Schreibzugriff erst nach bestätigter Mitgliedschaft

import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { requireUser } from '../_shared/auth.ts';
import { resolveTenant, validateRegisterBody } from './validate.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only', corsHeaders);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { user, userClient, admin } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid JSON body', corsHeaders);
  }

  const parsed = validateRegisterBody(body);
  if (!parsed.ok) return jsonError(400, parsed.code, parsed.message, corsHeaders);
  const input = parsed.value;

  // User-scoped Client: RLS begrenzt auf die eigenen Mitgliedschaften.
  const { data: memberships, error: membershipErr } = await userClient
    .from('memberships')
    .select('tenant_id')
    .eq('user_id', user.id);
  if (membershipErr) return jsonError(500, 'INTERNAL', 'membership lookup failed', corsHeaders);

  const tenantIds = (memberships ?? [])
    .map((m: { tenant_id: unknown }) => m.tenant_id)
    .filter((id: unknown): id is string => typeof id === 'string');
  const tenant = resolveTenant(tenantIds, input.tenantHint);
  if (!tenant.ok) return jsonError(tenant.status, tenant.code, tenant.message, corsHeaders);

  const registeredAt = new Date().toISOString();
  const { error: upsertErr } = await admin
    .from('local_ai_runtime_profiles')
    .upsert(
      {
        tenant_id: tenant.tenantId,
        user_id: user.id,
        profile_name: input.profileName,
        role: input.role,
        model: input.model,
        test_overall: input.testOverall,
        test_ran_at: input.testRanAt,
        test_checks: input.checks,
        enabled: input.enabled,
        registered_at: registeredAt,
      },
      { onConflict: 'tenant_id,user_id' },
    );
  if (upsertErr) return jsonError(500, 'INTERNAL', 'profile could not be stored', corsHeaders);

  return jsonResponse({ ok: true, registered_at: registeredAt, enabled: input.enabled }, 200, corsHeaders);
});

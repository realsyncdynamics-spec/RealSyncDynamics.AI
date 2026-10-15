// Offene Beta: kostenloser Growth-Umfang bis 31.01.2027 für den Mandanten
// des angemeldeten Nutzers (WP-3, docs/claude/BETA_V5_WORKPLAN.md).
// POST /functions/v1/beta-enroll
// Auth: Required (verify_jwt = Plattform-Default, kein config.toml-Eintrag)
// Body: { tenantId?: string, source?: string }
//
// ── Warum es diese Function gibt ──────────────────────────────────────────
//
// Landing und Checkout versprechen „alle Funktionen kostenlos testen“. Ohne
// diese Function sagt das nur das Frontend; der Mandant bliebe auf der freien
// Stufe. Hier wird das Versprechen zur Runtime — über den bestehenden
// Entitlement-Pfad, ohne Stripe:
//
//   subscriptions: plan_key='growth', status='trialing',
//                  trial_end = trial_ends_at = current_period_end = BETA_ENDS_AT,
//                  source='beta'
//
// `tenant_entitlements_resolve()` liest `trial_end`: Nach dem Beta-Ende fällt
// der Mandant ohne Job auf seine freie Stufe zurück. Daten bleiben erhalten.
//
// ── Regeln ────────────────────────────────────────────────────────────────
//
// 1. Mandant nur aus dem authentifizierten Principal: `memberships` des
//    Nutzers. Ein `tenantId` im Body wird nur als Auswahl unter den eigenen
//    Mitgliedschaften akzeptiert, nie ungeprüft (Service-Role umgeht RLS).
// 2. Nur owner/admin: die Beta ändert den Plan des ganzen Mandanten.
// 3. Idempotent: ein zweiter Aufruf liefert `alreadyEnrolled`.
// 4. Nie über ein Stripe-Abo oder ein laufendes, nicht-freies Abo schreiben
//    (`UNIQUE (tenant_id)` — ein Upsert würde es ersetzen). Siehe logic.ts.
// 5. Vorheriger Zustand steht in `beta_enrollments` (Rückweg nach der Beta).
//
// Die Mandantenauflösung steht hier ausgeschrieben statt in `_shared/` —
// gleicher Grund wie in create-trial-subscription: `_shared/*` löst
// `deploy_all` aus.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import {
  BETA_ENDS_AT,
  BETA_PLAN_KEY,
  BETA_SOURCE,
  betaOpen,
  decideEnrollment,
  sanitizeSource,
} from './logic.ts';

const ENROLL_ROLES = new Set(['owner', 'admin']);

/** Erste Adresse aus `X-Forwarded-For`, sonst null (`ip_address` ist `inet`). */
function clientIp(req: Request): string | null {
  const raw = req.headers.get('x-forwarded-for');
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const now = new Date();
  if (!betaOpen(Deno.env.get('BETA_PHASE'), now)) {
    return jsonError(410, 'BETA_CLOSED', 'Die offene Beta ist beendet.');
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError(401, 'UNAUTHORIZED', 'Authorization header required');

  let body: { tenantId?: unknown; source?: unknown } = {};
  try {
    const text = await req.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const supabase = createClient(SUPABASE_URL, SRK);
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return jsonError(401, 'UNAUTHORIZED', 'Invalid token');

  // Mandant aus dem Principal: eigene Mitgliedschaften, nie ein fremder Mandant.
  const { data: memberships, error: memberError } = await supabase
    .from('memberships').select('tenant_id, role').eq('user_id', user.id).limit(20);
  if (memberError) return jsonError(500, 'INTERNAL_ERROR', 'Failed to resolve tenant');
  if (!memberships || memberships.length === 0) {
    // Frisch registriert, Arbeitsbereich noch nicht angelegt — der Client
    // versucht es nach dem Onboarding erneut.
    return jsonError(400, 'TENANT_NOT_FOUND', 'No tenant found for this user');
  }

  const requested = typeof body.tenantId === 'string' ? body.tenantId : null;
  let membership: { tenant_id: string; role: string } | undefined;
  if (requested) {
    membership = memberships.find((m) => m.tenant_id === requested);
    if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  } else if (memberships.length > 1) {
    return jsonError(400, 'TENANT_AMBIGUOUS', 'Multiple tenants — tenantId required');
  } else {
    membership = memberships[0];
  }
  if (!ENROLL_ROLES.has(membership.role)) {
    return jsonError(403, 'FORBIDDEN', 'Only owner or admin can join the beta for this tenant');
  }
  const tenantId = membership.tenant_id;
  const source = sanitizeSource(body.source);

  try {
    const { data: current, error: readErr } = await supabase
      .from('subscriptions')
      .select('id, status, plan_key, source, stripe_subscription_id, trial_end, trial_ends_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (readErr) throw readErr;

    const decision = decideEnrollment(current, now);

    if (decision.kind === 'skip') {
      // Kein Fehler für den Client: ein zahlender Mandant behält sein Abo.
      return jsonResponse({ ok: true, enrolled: false, reason: decision.reason });
    }
    if (decision.kind === 'already') {
      return jsonResponse({
        ok: true,
        enrolled: true,
        alreadyEnrolled: true,
        planKey: current?.plan_key ?? BETA_PLAN_KEY,
        endsAt: current?.trial_end ?? BETA_ENDS_AT,
      });
    }

    const nowIso = now.toISOString();

    // Zuerst der Nachweis mit Vorzustand (Rückweg nach der Beta). Bei einem
    // Wiederholungsaufruf nach Teilfehler bleibt der erste Vorzustand stehen.
    const { error: enrollErr } = await supabase.from('beta_enrollments').upsert({
      tenant_id: tenantId,
      enrolled_by: user.id,
      plan_key: BETA_PLAN_KEY,
      ends_at: BETA_ENDS_AT,
      source,
      previous_plan_key: current?.plan_key ?? null,
      previous_status: current?.status ?? null,
    }, { onConflict: 'tenant_id', ignoreDuplicates: true });
    if (enrollErr) throw enrollErr;

    const { data: sub, error: upsertErr } = await supabase
      .from('subscriptions')
      .upsert({
        tenant_id: tenantId,
        plan_key: BETA_PLAN_KEY,
        status: 'trialing',
        billing_interval: 'month',
        trial_start: nowIso,
        trial_end: BETA_ENDS_AT,
        trial_ends_at: BETA_ENDS_AT,
        current_period_end: BETA_ENDS_AT,
        source: BETA_SOURCE,
        updated_at: nowIso,
      }, { onConflict: 'tenant_id' })
      .select('id, plan_key, status, trial_end')
      .single();
    if (upsertErr) throw upsertErr;

    const { error: auditErr } = await supabase.from('trial_audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      resource_type: 'subscription',
      action: 'BETA_ENROLL',
      old_values: current
        ? { plan_key: current.plan_key, status: current.status, trial_end: current.trial_end }
        : null,
      new_values: { plan_key: sub.plan_key, status: sub.status, trial_end: sub.trial_end },
      source: BETA_SOURCE,
      ip_address: clientIp(req),
      user_agent: req.headers.get('user-agent'),
    });
    if (auditErr) console.warn('Audit log failed:', auditErr.message);

    return jsonResponse({
      ok: true,
      enrolled: true,
      alreadyEnrolled: false,
      planKey: sub.plan_key,
      endsAt: sub.trial_end,
    });
  } catch (err) {
    console.error('beta-enroll failed:', err);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to join the beta');
  }
});

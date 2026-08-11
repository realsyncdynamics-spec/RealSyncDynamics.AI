// pilot-activate — Übergang vom anonymen Free Audit in die Governance Runtime.
//
// POST /functions/v1/pilot-activate
// Auth: erforderlich (JWT). Bewusst KEIN Eintrag in supabase/config.toml —
//       damit bleibt `verify_jwt` auf dem sicheren Default.
//
// Body: { audit_id: string; domain: string; analytics_consent?: boolean }
//
// Zweck
//   Ein Free Audit entsteht anonym (`gdpr-audit`, verify_jwt=false) und gehört
//   niemandem. Diese Funktion ordnet ihn genau einmal einem Tenant zu, startet
//   den 14-Tage-Pilot, registriert die Domain in `websites` und meldet sie beim
//   Monitoring-Scheduler (`monitoring_sources`) an.
//
// Aufbau
//   Diese Datei ist nur die HTTP-Schale. Die Ablauflogik steht in
//   `_shared/pilot-activation.ts` hinter dem Port `PilotStore` — dadurch ist sie
//   ohne Deno und ohne Datenbank testbar. Hier wird ausschließlich der
//   Service-Role-Client an diesen Port gebunden.
//
// Sicherheitsrelevanz
//   `audit_id` und `domain` kommen aus dem Browser und sind reine
//   NACHSCHLAGE-Werte, keine Autorisierung. Identität und Tenant werden
//   ausschließlich aus dem verifizierten JWT abgeleitet. Ein client-gelieferter
//   `tenant_id` wird nirgends akzeptiert.
//
// EU-AI-Act-/DSGVO-Bezug
//   Art. 12 EU AI Act (Aufzeichnungspflichten): Jede Aktivierung schreibt
//   Start-, Erfolgs- bzw. Fehlerereignisse in den Prüfpfad.
//   DSGVO Art. 5 Abs. 1 lit. b (Zweckbindung): `claimed_at` hält den Zeitpunkt
//   fest, ab dem der Scan einem Verantwortlichen zugeordnet ist.
//   DSGVO Art. 6 Abs. 1 lit. a: Die optionale Analyse-Einwilligung wird nur bei
//   ausdrücklichem `true` und mit Versionsstand protokolliert.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';
import { resolveTenantForUser, userBelongsToTenant } from '../_shared/tenant.ts';
import { CONSENT_TYPE, CONSENT_VERSION } from '../_shared/pilot.ts';
import {
  runPilotActivation,
  type PilotStore,
  type PilotAuditEvent,
} from '../_shared/pilot-activation.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SRK) {
    console.error(JSON.stringify({ level: 'error', scope: 'pilot_activate_misconfigured' }));
    return jsonError(500, 'PILOT_ACTIVATION_FAILED', 'service not configured');
  }

  // Korrelations-ID für den Prüfpfad. Kein Nutzerinput, kein Geheimnis.
  const requestId = crypto.randomUUID();

  // ── Authentifizierung ───────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'Authorization header required');
  }

  const admin = createClient(SUPABASE_URL, SRK);
  const { data: userData, error: userErr } = await admin.auth.getUser(
    authHeader.slice('Bearer '.length),
  );
  const user = userData?.user;
  if (userErr || !user?.id) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid session');
  }

  let body: { audit_id?: unknown; domain?: unknown; analytics_consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'INVALID_INPUT', 'invalid json');
  }

  // ── Port-Implementierung: Service-Role-Client ───────────────────────────
  const store: PilotStore = {
    async loadAudit(auditId) {
      const { data, error } = await admin
        .from('gdpr_audits')
        .select('id, domain, created_at, user_id, tenant_id, claimed_at')
        .eq('id', auditId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },

    resolveTenant: (userId) => resolveTenantForUser(admin, userId),

    isMember: (userId, tenantId) => userBelongsToTenant(admin, userId, tenantId),

    async claimAudit(auditId, userId, tenantId, claimedAt) {
      // Race-sicher: die beiden IS-NULL-Bedingungen sind Teil des UPDATE.
      // Genau ein nebenläufiger Aufruf trifft eine Zeile, alle anderen null.
      const { data, error } = await admin
        .from('gdpr_audits')
        .update({ user_id: userId, tenant_id: tenantId, claimed_at: claimedAt })
        .eq('id', auditId)
        .is('user_id', null)
        .is('tenant_id', null)
        .select('id');
      if (error) throw new Error(error.message);
      return Array.isArray(data) && data.length > 0;
    },

    async readAuditOwner(auditId) {
      const { data, error } = await admin
        .from('gdpr_audits')
        .select('tenant_id, user_id')
        .eq('id', auditId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },

    async upsertWebsite(tenantId, domain, auditId) {
      const { error } = await admin
        .from('websites')
        .upsert({
          tenant_id: tenantId,
          domain,
          plan_tier: 'audit',
          status: 'audit_done',
          latest_audit_id: auditId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,domain' });
      if (error) throw new Error(error.message);
    },

    async loadSubscription(tenantId) {
      const { data, error } = await admin
        .from('subscriptions')
        .select('id, tenant_id, plan_key, status, trial_start, trial_end')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },

    async createTrial(tenantId, planKey, preserveTrialWindow) {
      // Kanonischer Trial-Pfad: `create-trial-subscription`. Kein zweites
      // Trial-System. Der eigene JWT wird weitergereicht; der Tenant kommt
      // serverseitig aufgelöst mit, nicht aus dem Browser.
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/create-trial-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ tenantId, planKey, preserveTrialWindow }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        console.error(JSON.stringify({
          level: 'error', scope: 'pilot_activate_trial',
          request_id: requestId, status: resp.status, detail: detail.slice(0, 500),
        }));
        throw new Error(`trial creation failed: ${resp.status}`);
      }
    },

    async enrollMonitoring(tenantId, url, name) {
      // Race-sicher über Advisory-Lock in der RPC (Migration 20260811120000):
      // `monitoring_sources` hat keinen Unique-Constraint, ein
      // SELECT-dann-INSERT wäre hier nicht sicher.
      const { error } = await admin.rpc('pilot_enroll_monitoring_source', {
        p_tenant_id: tenantId,
        p_url: url,
        p_name: name,
      });
      if (error) throw new Error(error.message);
    },

    async recordConsent(userId, auditId) {
      const { error } = await admin.from('user_consents').insert({
        user_id: userId,
        scan_result_id: auditId,
        consent_type: CONSENT_TYPE,
        consent_version: CONSENT_VERSION,
        granted: true,
      });
      if (error) throw new Error(error.message);
    },

    async logEvent(event: PilotAuditEvent) {
      await audit(admin, {
        tenant_id: event.tenant_id,
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: event.action,
        target_type: event.target_type,
        target_id: event.target_id,
        payload: event.payload,
      });
    },
  };

  try {
    const result = await runPilotActivation(
      store,
      { userId: user.id, email: user.email ?? null },
      {
        auditId: typeof body.audit_id === 'string' ? body.audit_id : '',
        domain: typeof body.domain === 'string' ? body.domain : '',
        analyticsConsent: body.analytics_consent === true,
      },
      requestId,
    );

    if (!result.ok) {
      return jsonError(result.status, result.code, result.message);
    }

    return jsonResponse({
      ok: true,
      request_id: requestId,
      tenant_id: result.tenantId,
      audit_id: result.auditId,
      domain: result.domain,
      idempotent_replay: result.idempotentReplay,
      monitoring_enrolled: result.monitoringEnrolled,
      subscription: result.subscription
        ? {
            plan_key: result.subscription.plan_key,
            status: result.subscription.status,
            trial_start: result.subscription.trial_start ?? null,
            trial_end: result.subscription.trial_end ?? null,
            action: result.subscriptionAction,
          }
        : null,
    });
  } catch (err) {
    // Niemals Stacktrace, SQL oder Secrets nach außen geben.
    console.error(JSON.stringify({
      level: 'error', scope: 'pilot_activate_unhandled',
      request_id: requestId, error: (err as Error)?.message ?? String(err),
    }));
    return jsonError(500, 'PILOT_ACTIVATION_FAILED', 'pilot activation failed');
  }
});

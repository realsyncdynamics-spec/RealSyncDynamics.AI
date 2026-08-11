// Create trial subscription for unified-entry flow
// POST /functions/v1/create-trial-subscription
// Auth: Required (bearer token or session)
// Body: { tenantId?: string; planKey?: string; preserveTrialWindow?: boolean }
//
// Creates a 14-day trial subscription for the authenticated user's tenant.
// Sets: status='trialing', trial_start=NOW, trial_end=NOW+14d.
//
// planKey ist optional und defaultet auf 'free_audit' — bestehende Aufrufer
// bleiben damit unverändert. `pilot-activate` übergibt explizit 'starter',
// weil tenant_entitlements() das Produkt über
// products.default_for_plan_key = subscriptions.plan_key auflöst und erst der
// Starter-Plan die Governance Runtime freischaltet.
//
// preserveTrialWindow=true lässt ein bereits gesetztes trial_start/trial_end
// unangetastet. Ohne das würde eine wiederholte Aktivierung das Pilot-Ende nach
// hinten schieben — der Pilot muss idempotent sein.
//
// Sicherheitsrelevanz
//   `tenantId` kommt aus dem Request-Body. Früher wurde er ungeprüft
//   übernommen: ein beliebiger authentifizierter User konnte damit die
//   Subscription eines fremden Tenants überschreiben. Es wird jetzt gegen
//   `memberships` verifiziert (Tenant-Isolation, DSGVO Art. 32).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { resolveTenantForUser, userBelongsToTenant } from '../_shared/tenant.ts';

/** Plan-Keys aus shared/pricing.ts. Alles andere wird abgewiesen. */
const ALLOWED_PLAN_KEYS = new Set([
  'free_audit',
  'starter', 'starter_yearly',
  'growth', 'growth_yearly',
  'agency', 'agency_yearly',
  'enterprise', 'enterprise_yearly',
  'partner', 'partner_yearly',
]);

/** Nur valide IP-Literale dürfen in die INET-Spalte `ip_address`. */
function parseClientIp(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(',')[0]?.trim();
  if (!first) return null;
  const m = first.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) return m.slice(1).every((o) => Number(o) <= 255) ? first : null;
  if (/^[0-9a-fA-F:]+$/.test(first) && first.includes(':')) return first;
  return null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError(401, 'UNAUTHORIZED', 'Authorization header required');

  let body: { tenantId?: string; planKey?: string; preserveTrialWindow?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const supabase = createClient(SUPABASE_URL, SRK);

  // Get authenticated user from JWT
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user?.id) {
    return jsonError(401, 'UNAUTHORIZED', 'Invalid token');
  }

  const planKey = typeof body.planKey === 'string' ? body.planKey : 'free_audit';
  if (!ALLOWED_PLAN_KEYS.has(planKey)) {
    return jsonError(400, 'BAD_REQUEST', 'unknown plan key');
  }

  // Tenant bestimmen. Ohne expliziten `tenantId` über die kanonische
  // memberships-Auflösung — die frühere Variante las `profiles.active_tenant_id`,
  // eine Spalte, die in keiner Migration existiert und diesen Pfad damit
  // immer scheitern ließ.
  let tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  if (!tenantId) {
    const resolved = await resolveTenantForUser(supabase, user.id);
    if (!resolved) {
      return jsonError(400, 'TENANT_NOT_FOUND', 'No active tenant found');
    }
    tenantId = resolved;
  } else if (!(await userBelongsToTenant(supabase, user.id, tenantId))) {
    // Ein vom Client gelieferter Tenant wird niemals ungeprüft übernommen.
    return jsonError(403, 'TENANT_ACCESS_DENIED', 'no access to this workspace');
  }

  // Calculate trial dates
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // +14 days
  const nowIso = now.toISOString();
  const trialEndIso = trialEnd.toISOString();

  try {
    // Bestehendes Trial-Fenster ermitteln, damit eine wiederholte Aktivierung
    // es nicht verschiebt.
    let trialStartValue = nowIso;
    let trialEndValue = trialEndIso;

    if (body.preserveTrialWindow === true) {
      const { data: existing } = await supabase
        .from('subscriptions')
        .select('trial_start, trial_end')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (existing?.trial_start) trialStartValue = existing.trial_start;
      if (existing?.trial_end) trialEndValue = existing.trial_end;
    }

    // UPSERT: atomare Operation (INSERT falls nicht vorhanden, UPDATE falls bereits vorhanden)
    const { data: newSub, error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        tenant_id: tenantId,
        status: 'trialing',
        plan_key: planKey,
        trial_start: trialStartValue,
        trial_end: trialEndValue,
        billing_interval: 'month',
        updated_at: nowIso,
      }, {
        onConflict: 'tenant_id',  // Bei Konflikt: UPDATE statt Error
      })
      .select()
      .single();

    if (upsertError) throw upsertError;

    // Log trial activation
    await supabase
      .from('trial_audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        resource_type: 'subscription',
        action: 'CREATE_TRIAL',
        new_values: {
          status: 'trialing',
          plan_key: planKey,
          trial_start: newSub.trial_start,
          trial_end: newSub.trial_end,
        },
        source: 'unified-entry',
        // `ip_address` ist INET — der frühere Fallback-String 'unknown' löste
        // dort einen 22P02-Fehler aus. Lieber NULL als ein ungültiges Literal.
        ip_address: parseClientIp(req.headers.get('x-forwarded-for')),
        user_agent: req.headers.get('user-agent'),
      })
      .catch((err) => {
        // Audit-Log ist nice-to-have, nicht kritisch
        console.warn('Audit log failed:', err.message);
      });

    return jsonResponse({
      ok: true,
      success: true,
      subscription: {
        id: newSub.id,
        tenant_id: newSub.tenant_id,
        status: newSub.status,
        trial_start: newSub.trial_start,
        trial_end: newSub.trial_end,
        plan_key: newSub.plan_key,
      },
    });
  } catch (err) {
    console.error('Error creating trial subscription:', err);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to create trial subscription');
  }
});

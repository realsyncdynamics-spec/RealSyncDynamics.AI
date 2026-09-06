// Create the 14-day Growth trial for the authenticated tenant.
// POST /functions/v1/create-trial-subscription
// Auth: Required
// Body: { tenantId?: string, planKey?: 'growth' }
//
// IMPORTANT: the only plan eligible for the 14-day trial is Growth (€249/month).
// No free_audit/starter/agency/enterprise/partner trial is created here.
//
// ── Drei Befunde vom 2026-08-19, vor dem ersten Deploy behoben ────────────
//
// 1. **Der Mandant wurde über `profiles.active_tenant_id` gesucht — die Spalte
//    gibt es nicht.** Am Live-Schema geprüft: `profiles` führt sie nicht, und
//    `active_tenant_id` kommt im ganzen Schema nicht vor. Die einzige
//    Zuordnung Nutzer→Mandant ist `memberships`. Ohne diesen Fix hätte jeder
//    Aufruf ohne `tenantId` mit `TENANT_NOT_FOUND` geendet.
//
// 2. **`tenantId` aus dem Body wurde ungeprüft übernommen.** Die Function
//    arbeitet mit dem Service-Role-Schlüssel und umgeht damit RLS. Ein
//    angemeldeter Nutzer hätte einen Growth-Testzeitraum in einen **fremden**
//    Mandanten schreiben können. Das ist ein Bruch der Mandantentrennung
//    (CLAUDE.md §4), nicht nur ein Schönheitsfehler.
//
// 3. **Der Upsert hätte ein bestehendes Abo überschrieben.** `subscriptions`
//    trägt `UNIQUE (tenant_id)` — „genau ein Abo pro Tenant". Ein Upsert auf
//    diesen Schlüssel ersetzt eine laufende, bezahlte Subscription durch einen
//    14-Tage-Testzeitraum. Ein zweiter Aufruf der Onboarding-Seite hätte
//    gereicht.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

/**
 * Zustände, die ein bestehendes Abo als „läuft" ausweisen. Wer hier steht,
 * bekommt keinen Testzeitraum darübergelegt.
 */
const LIVE_SUBSCRIPTION_STATES = new Set(['active', 'trialing', 'past_due']);

/**
 * Erste Adresse aus `X-Forwarded-For`, sonst null.
 *
 * `trial_audit_logs.ip_address` ist vom Typ `inet`. Der frühere Stand schrieb
 * bei fehlendem Header den Text `'unknown'` — Postgres lehnt das ab, der
 * Insert scheiterte, und weil der Fehler abgefangen wurde, fehlte der Eintrag
 * im Prüfpfad stillschweigend. Ein Prüfpfad, der bei Kleinigkeiten Einträge
 * verliert, ist keiner.
 */
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

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError(401, 'UNAUTHORIZED', 'Authorization header required');

  let body: { tenantId?: string; planKey?: string };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  if (body.planKey !== 'growth') {
    return jsonError(400, 'TRIAL_NOT_AVAILABLE', 'The 14-day trial is available only for the Growth plan.');
  }

  const supabase = createClient(SUPABASE_URL, SRK);
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return jsonError(401, 'UNAUTHORIZED', 'Invalid token');

  // Mandant auflösen — und in jedem Fall gegen `memberships` prüfen.
  //
  // Die Auflösung steht hier ausgeschrieben statt in `_shared/`: Eine Änderung
  // an `supabase/functions/_shared/*` schaltet `deploy.yml` auf `deploy_all`
  // und deployt alle 177 Verzeichnisse. Eine geteilte Hilfsfunktion wäre die
  // schönere Form und der teurere Deploy; die Verdopplung ist hier die
  // bewusste Wahl.
  let tenantId = body.tenantId;
  if (tenantId) {
    const { data: member } = await supabase
      .from('memberships').select('user_id')
      .eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
    if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  } else {
    const { data: memberships, error: memberError } = await supabase
      .from('memberships').select('tenant_id').eq('user_id', user.id).limit(2);
    if (memberError) return jsonError(500, 'INTERNAL_ERROR', 'Failed to resolve tenant');
    if (!memberships || memberships.length === 0) {
      return jsonError(400, 'TENANT_NOT_FOUND', 'No tenant found for this user');
    }
    // Bei mehreren Mandanten ist die Wahl nicht zu erraten — und ein Abo im
    // falschen Arbeitsbereich ist teurer als eine Rückfrage.
    if (memberships.length > 1) {
      return jsonError(400, 'TENANT_AMBIGUOUS', 'Multiple tenants — tenantId required');
    }
    tenantId = memberships[0].tenant_id as string;
  }

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const trialEndIso = trialEnd.toISOString();

  try {
    // Kein Testzeitraum über ein laufendes Abo. `UNIQUE (tenant_id)` heisst,
    // dass ein Upsert die bestehende Zeile ersetzt — bei einer bezahlten
    // Subscription wäre das ein Downgrade ohne Auftrag.
    const { data: current } = await supabase
      .from('subscriptions')
      .select('id, status, plan_key, trial_start, trial_end')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (current && LIVE_SUBSCRIPTION_STATES.has(current.status)) {
      // Ein bereits laufender Growth-Test ist kein Fehler, sondern derselbe
      // Zustand: Die Onboarding-Seite darf zweimal abgeschickt werden.
      const alreadyTrialing = current.status === 'trialing' && current.plan_key === 'growth';
      if (alreadyTrialing) {
        return jsonResponse({
          success: true,
          alreadyExisted: true,
          subscription: {
            id: current.id,
            tenant_id: tenantId,
            status: current.status,
            plan_key: current.plan_key,
            trial_start: current.trial_start,
            trial_end: current.trial_end,
          },
        });
      }
      return jsonError(
        409,
        'SUBSCRIPTION_EXISTS',
        `Tenant already has a ${current.status} ${current.plan_key} subscription.`,
      );
    }

    const { data: newSub, error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        tenant_id: tenantId,
        status: 'trialing',
        plan_key: 'growth',
        trial_start: nowIso,
        trial_end: trialEndIso,
        billing_interval: 'month',
        created_at: nowIso,
        updated_at: nowIso,
      }, { onConflict: 'tenant_id' })
      .select().single();

    if (upsertError) throw upsertError;

    // `.insert(...)` liefert einen PostgREST-Builder, kein Promise: `.catch()`
    // gibt es dort nicht, der Zugriff warf `TypeError` — und zwar bevor der
    // Insert abgeschickt wurde. Der Pruefpfad wurde also nicht nur nicht
    // geschrieben, der ganze Request starb daran, nachdem das Abo bereits
    // angelegt war. Fehler gehoert ueber das Ergebnis geprueft.
    const { error: auditErr } = await supabase.from('trial_audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      resource_type: 'subscription',
      action: 'CREATE_GROWTH_TRIAL',
      new_values: {
        plan_key: 'growth',
        status: 'trialing',
        trial_start: newSub.trial_start,
        trial_end: newSub.trial_end,
      },
      source: 'unified-entry',
      ip_address: clientIp(req),
      user_agent: req.headers.get('user-agent'),
    });
    if (auditErr) console.warn('Audit log failed:', auditErr.message);

    return jsonResponse({
      success: true,
      alreadyExisted: false,
      subscription: {
        id: newSub.id,
        tenant_id: newSub.tenant_id,
        status: newSub.status,
        plan_key: newSub.plan_key,
        trial_start: newSub.trial_start,
        trial_end: newSub.trial_end,
      },
    });
  } catch (err) {
    console.error('Error creating Growth trial:', err);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to create Growth trial');
  }
});

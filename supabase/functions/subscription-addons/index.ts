// subscription-addons — Add-ons eines laufenden Abos anzeigen, buchen, kündigen (AP6).
//
// POST /functions/v1/subscription-addons
// Authorization: Bearer <user JWT>
// Body: { tenant_id: uuid, action: 'list' | 'add' | 'remove', addon_id?: string, quantity?: number }
//
// Ein Add-on wird zu einer Position (subscription item) des bestehenden
// Stripe-Abos. Drei Dinge entstehen dabei — und genau drei, sonst ist die
// Buchung nicht vollständig (implementierungsplan-paketmodell.md AP6.3):
//
//   1. die Stripe-Position            stripe.subscriptionItems.create()
//   2. die Zeile                       public.subscription_addons
//   3. das wirksame Entitlement        public.entitlement_grants
//                                      (source = 'addon_subscription')
//
// Der Grant verweist auf das Add-on-Produkt (`plan_addons.product_id`); dessen
// `product_entitlements` gewähren die Rechte. `tenant_entitlements()` addiert
// Kontingente daraus auf den Plan. Es gibt keine zweite Rechte-Definition.
//
// Der Webhook (`stripe-webhook`, syncAddonItems) hält 2 und 3 mit Stripe
// synchron — diese Function schreibt beide sofort, damit der Kunde nicht auf
// die Zustellung warten muss. Beide Wege sind über die Item-ID idempotent.
//
// Ehrlichkeit vor Vollständigkeit: Trägt `plan_addons.stripe_price_id` keine
// echte Price (AP5 steht aus), meldet `list` das Add-on als `not_purchasable`
// und `add` weist mit ADDON_NOT_PURCHASABLE ab. Kein Knopf greift ins Leere.
//
// Sicherheit: Nutzer über JWT, Mitgliedschaft über `memberships`; `list` für
// jedes Mitglied, `add`/`remove` nur owner/admin (Geldfluss). tenant_id aus
// dem Body wird nie ohne diese Prüfung an den Admin-Client gegeben.

import Stripe from 'npm:stripe@16.12.0';
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import {
  ADDONS,
  addonById,
  addonOfferStatus,
  addonPricePreview,
  bookedAddonsMonthlyEur,
  graceDaysRemaining,
  resolvePlan,
  subscriptionGrantsPaidAccess,
  type AddOn,
  type AddOnId,
  type AddonOffer,
  type BookedAddon,
} from '../_shared/pricing.generated.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type Action = 'list' | 'add' | 'remove';

interface SubscriptionRow {
  id: string;
  plan_key: string;
  status: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
}

interface PlanAddonRow {
  addon_id: string;
  stripe_price_id: string | null;
  product_id: string | null;
  active: boolean;
}

interface BookedRow {
  id: string;
  addon_key: string;
  stripe_item_id: string | null;
  quantity: number;
}

interface EntitlementRow { key: string; kind: string; value: number }

// Vault-first, env-fallback — siehe stripe-checkout/index.ts.
async function getSecret(admin: SupabaseClient, envVar: string, vaultName: string): Promise<string | null> {
  const { data, error } = await admin.rpc('get_app_secret', { secret_name: vaultName });
  if (!error && typeof data === 'string' && data.length > 0) return data;
  return Deno.env.get(envVar) ?? null;
}

const isLiveStripePrice = (id: string | null | undefined): id is string =>
  typeof id === 'string' && id.startsWith('price_');

function isAction(value: unknown): value is Action {
  return value === 'list' || value === 'add' || value === 'remove';
}

function isAddonId(value: unknown): value is AddOnId {
  return typeof value === 'string' && ADDONS.some((a) => a.id === value);
}

/** Alles, was die Oberfläche für „Mein Plan" braucht — in einer Antwort. */
async function buildListing(admin: SupabaseClient, tenantId: string) {
  const [subRes, addonRes, bookedRes, entRes] = await Promise.all([
    admin.from('subscriptions')
      .select('id, plan_key, status, stripe_subscription_id, stripe_customer_id, current_period_end, past_due_since')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('plan_addons').select('addon_id, stripe_price_id, product_id, active'),
    admin.from('subscription_addons')
      .select('id, addon_key, stripe_item_id, quantity')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    admin.rpc('tenant_entitlements', { p_tenant_id: tenantId }),
  ]);
  if (subRes.error) throw new Error(subRes.error.message);
  if (addonRes.error) throw new Error(addonRes.error.message);
  if (bookedRes.error) throw new Error(bookedRes.error.message);
  if (entRes.error) throw new Error(entRes.error.message);

  const subscription = (subRes.data ?? null) as SubscriptionRow | null;
  const planAddons = new Map<string, PlanAddonRow>();
  for (const row of (addonRes.data ?? []) as PlanAddonRow[]) planAddons.set(row.addon_id, row);
  const bookedRows = (bookedRes.data ?? []) as BookedRow[];
  const entitlements = (entRes.data ?? []) as EntitlementRow[];

  const now = new Date();
  const paidAccess = subscriptionGrantsPaidAccess(subscription?.status, subscription?.past_due_since, now);
  // Ohne wirksames Abo gilt der Free-Plan — dieselbe Regel wie im Auflöser.
  const plan = (paidAccess ? resolvePlan(subscription?.plan_key) : null) ?? resolvePlan('free_audit')!;

  const held: Record<string, number> = {};
  for (const e of entitlements) held[e.key] = Number(e.value);

  const booked: BookedAddon[] = bookedRows
    .filter((r) => isAddonId(r.addon_key))
    .map((r) => ({ id: r.addon_key as AddOnId, quantity: Math.max(1, Number(r.quantity) || 1) }));

  const addons = ADDONS.map((addon) => {
    const row = planAddons.get(addon.id);
    const purchasable = !!row && row.active !== false && isLiveStripePrice(row.stripe_price_id) && !!row.product_id;
    const offer: AddonOffer = addonOfferStatus({ addon, plan, held, booked, purchasable });
    const gebucht = bookedRows.find((r) => r.addon_key === addon.id);
    const vorschau = addonPricePreview(plan, booked, addon, 1);
    return {
      id: addon.id,
      name: addon.name,
      description: addon.description,
      price_eur: addon.priceEur,
      price_note: addon.priceNote,
      bullets: addon.bullets,
      per_unit: addon.perUnit,
      grants: addon.grants,
      status: offer.status,
      missing: offer.missing,
      quantity: gebucht ? Math.max(1, Number(gebucht.quantity) || 1) : 0,
      stripe_item_id: gebucht?.stripe_item_id ?? null,
      preview: {
        current_monthly_eur: vorschau.currentMonthlyEur,
        delta_monthly_eur: vorschau.deltaMonthlyEur,
        new_monthly_eur: vorschau.newMonthlyEur,
        // Stripe stellt die Position anteilig ab sofort in Rechnung; der volle
        // Betrag steht ab dem nächsten Abrechnungsdatum auf der Rechnung.
        effective_from: now.toISOString(),
        full_amount_from: subscription?.current_period_end ?? null,
      },
    };
  });

  const planEur = plan.price.monthlyEur;
  const addonsEur = bookedAddonsMonthlyEur(booked);

  return {
    plan: { id: plan.id, plan_key: plan.planKey, name: plan.name, monthly_eur: planEur, availability: plan.availability },
    subscription: subscription
      ? {
          status: subscription.status,
          paid_access: paidAccess,
          current_period_end: subscription.current_period_end,
          past_due_since: subscription.past_due_since,
          grace_days_remaining: graceDaysRemaining(subscription.status, subscription.past_due_since, now),
          has_stripe_subscription: !!subscription.stripe_subscription_id,
        }
      : null,
    entitlements,
    addons,
    totals: { plan_eur: planEur, addons_eur: addonsEur, monthly_eur: planEur + addonsEur },
    _internal: { subscription, planAddons, bookedRows },
  };
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  let body: { tenant_id?: unknown; action?: unknown; addon_id?: unknown; quantity?: unknown };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const tenantId = typeof body.tenant_id === 'string' ? body.tenant_id : '';
  if (!tenantId) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  const action: Action = isAction(body.action) ? body.action : 'list';

  // Mitgliedschaft über den Nutzer-Client (RLS) — kein tenant_id aus dem Body
  // erreicht den Admin-Client, bevor sie bestätigt ist.
  const { data: membership, error: memberErr } = await userClient
    .from('memberships').select('role')
    .eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  if (memberErr) return jsonError(500, 'INTERNAL', memberErr.message);
  if (!membership) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  const role = String(membership.role ?? '');
  if (action !== 'list' && role !== 'owner' && role !== 'admin') {
    return jsonError(403, 'FORBIDDEN', 'only owner/admin may change add-ons');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let listing: Awaited<ReturnType<typeof buildListing>>;
  try {
    listing = await buildListing(admin, tenantId);
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }

  const antwort = (l: typeof listing) => {
    const { _internal: _ignored, ...rest } = l;
    return jsonResponse({ ok: true, ...rest });
  };

  if (action === 'list') return antwort(listing);

  // ── add / remove: ab hier fließt Geld ─────────────────────────────────────

  if (!isAddonId(body.addon_id)) return jsonError(400, 'UNKNOWN_ADDON', `unbekanntes addon_id: ${String(body.addon_id ?? '')}`);
  const addon: AddOn = addonById(body.addon_id)!;
  const { subscription, planAddons, bookedRows } = listing._internal;

  if (!subscription?.stripe_subscription_id) {
    return jsonError(400, 'NO_SUBSCRIPTION',
      'Add-ons setzen ein laufendes Abo voraus. Bitte zuerst einen Plan über /pricing buchen.');
  }
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return jsonError(400, 'SUBSCRIPTION_NOT_ACTIVE',
      `Das Abo ist im Zustand „${subscription.status}". Bitte zuerst die Zahlung klären, dann lassen sich Add-ons ändern.`);
  }

  const stripeSecret = await getSecret(admin, 'STRIPE_SECRET_KEY', 'stripe_secret_key');
  if (!stripeSecret) return jsonError(500, 'STRIPE_NOT_CONFIGURED', 'stripe secret key not configured (neither env nor vault)');
  const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' });

  const eintrag = listing.addons.find((a) => a.id === addon.id)!;
  const planAddon = planAddons.get(addon.id);

  if (action === 'add') {
    // Idempotent: Was gebucht ist, wird nicht noch einmal gebucht.
    if (eintrag.status === 'booked') return antwort(listing);
    if (eintrag.status === 'not_for_plan') {
      return jsonError(400, 'ADDON_NOT_FOR_PLAN', `${addon.name} ist für den Plan ${listing.plan.name} nicht buchbar.`);
    }
    if (eintrag.status === 'included') {
      return jsonError(400, 'ADDON_ALREADY_INCLUDED', `${addon.name} ist in Ihrem Umfang bereits enthalten.`);
    }
    if (eintrag.status === 'missing_dependency') {
      return jsonError(400, 'ADDON_DEPENDENCY_MISSING',
        `${addon.name} setzt voraus: ${eintrag.missing.join(', ')}.`, undefined, { missing: eintrag.missing });
    }
    if (eintrag.status !== 'bookable' || !planAddon || !isLiveStripePrice(planAddon.stripe_price_id) || !planAddon.product_id) {
      return jsonError(400, 'ADDON_NOT_PURCHASABLE',
        `${addon.name} ist noch nicht buchbar — es fehlt der Stripe-Price (plan_addons.stripe_price_id).`);
    }

    const menge = addon.perUnit && typeof body.quantity === 'number' && Number.isInteger(body.quantity) && body.quantity >= 1
      ? Math.min(body.quantity, 100)
      : 1;

    let item: Stripe.SubscriptionItem;
    try {
      item = await stripe.subscriptionItems.create({
        subscription: subscription.stripe_subscription_id,
        price: planAddon.stripe_price_id,
        quantity: menge,
        proration_behavior: 'create_prorations',
        metadata: { tenant_id: tenantId, addon_id: addon.id },
      });
    } catch (e) {
      return jsonError(502, 'STRIPE_ERROR', `stripe subscription item failed: ${(e as Error).message}`);
    }

    const jetzt = new Date().toISOString();
    const { error: rowErr } = await admin.from('subscription_addons').upsert({
      subscription_id: subscription.id,
      tenant_id: tenantId,
      addon_key: addon.id,
      stripe_item_id: item.id,
      stripe_price_id: planAddon.stripe_price_id,
      quantity: menge,
      status: 'active',
      removed_at: null,
      updated_at: jetzt,
    }, { onConflict: 'stripe_item_id' });
    if (rowErr) return jsonError(500, 'INTERNAL', `subscription_addons: ${rowErr.message}`);

    const { error: grantErr } = await admin.from('entitlement_grants').upsert({
      tenant_id: tenantId,
      product_id: planAddon.product_id,
      plan_key: subscription.plan_key,
      source: 'addon_subscription',
      purchase_reference: item.id,
      stripe_subscription_item_id: item.id,
      stripe_subscription_id: subscription.stripe_subscription_id,
      stripe_customer_id: subscription.stripe_customer_id,
      addon_id: addon.id,
      quantity: menge,
      status: 'active',
      revoked_at: null,
      revoked_reason: null,
      expires_at: null,
      granted_at: jetzt,
      updated_at: jetzt,
    }, { onConflict: 'source,purchase_reference' });
    if (grantErr) return jsonError(500, 'INTERNAL', `entitlement_grants: ${grantErr.message}`);

    try {
      return antwort(await buildListing(admin, tenantId));
    } catch (e) {
      return jsonError(500, 'INTERNAL', (e as Error).message);
    }
  }

  // action === 'remove'
  const gebucht = bookedRows.find((r) => r.addon_key === addon.id);
  if (!gebucht) return antwort(listing); // nichts zu kündigen — idempotent
  if (gebucht.stripe_item_id) {
    try {
      await stripe.subscriptionItems.del(gebucht.stripe_item_id, { proration_behavior: 'create_prorations' });
    } catch (e) {
      // Eine bereits gelöschte Position ist kein Fehler — alles andere schon.
      const msg = (e as Error).message ?? '';
      if (!/No such subscription_item|resource_missing/i.test(msg)) {
        return jsonError(502, 'STRIPE_ERROR', `stripe subscription item delete failed: ${msg}`);
      }
    }
  }
  const jetzt = new Date().toISOString();
  const { error: rowErr } = await admin.from('subscription_addons')
    .update({ status: 'removed', removed_at: jetzt, updated_at: jetzt })
    .eq('id', gebucht.id);
  if (rowErr) return jsonError(500, 'INTERNAL', `subscription_addons: ${rowErr.message}`);
  if (gebucht.stripe_item_id) {
    const { error: grantErr } = await admin.from('entitlement_grants')
      .update({ status: 'revoked', revoked_at: jetzt, revoked_reason: 'addon_removed', updated_at: jetzt })
      .eq('source', 'addon_subscription')
      .eq('purchase_reference', gebucht.stripe_item_id);
    if (grantErr) return jsonError(500, 'INTERNAL', `entitlement_grants: ${grantErr.message}`);
  }

  try {
    return antwort(await buildListing(admin, tenantId));
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

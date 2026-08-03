#!/usr/bin/env tsx
/**
 * Gleicht den Stripe-Katalog mit der Pricing-SSoT ab.
 *
 * Quelle ist `shared/pricing.ts`. Das Skript vergleicht Produkte und Preise
 * des Stripe-Kontos gegen den Katalog und meldet bzw. behebt Abweichungen.
 *
 * ── Verwendung ────────────────────────────────────────────────────────────
 *   STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/sync-stripe-catalog.ts
 *   STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/sync-stripe-catalog.ts --apply
 *
 * Ohne `--apply` wird NICHTS geschrieben — es erscheint nur der Diff.
 * Erst gegen den Testmodus laufen lassen, dann gegen Live.
 *
 * ── Was das Skript tut ────────────────────────────────────────────────────
 *   1. Setzt `metadata.plan_key` auf jedem Preis, der zu einem Plan gehört.
 *      Das ist der Wert, den `stripe-webhook` zuerst ausliest, um einer
 *      Subscription den richtigen Plan zuzuordnen.
 *   2. Benennt Produkte um, deren Name oder `metadata.plan_key` nicht mehr
 *      zum Katalog passt (insbesondere „Scale" → „Partner").
 *   3. Legt fehlende Preise an — für Monats- und Jahresvarianten.
 *
 * ── Was das Skript bewusst NICHT tut ──────────────────────────────────────
 *   - Beträge bestehender Preise ändern. Stripe-Preise sind unveränderlich;
 *     ein abweichender Betrag wird gemeldet, aber nicht angefasst. Die
 *     Korrektur ist ein neuer Preis plus Migration der Abos — das ist eine
 *     Geschäftsentscheidung, keine Synchronisierung.
 *   - Produkte oder Preise deaktivieren oder löschen. Laufende Abos hängen
 *     daran.
 *   - Bestehende Subscriptions umstellen.
 *
 * Das Skript ist idempotent: ein zweiter Lauf gegen einen synchronen
 * Katalog schreibt nichts und meldet „synchron".
 */

import { ORDERED_PLANS, allPlanKeys, planByKey, priceForPlanKey, type Plan, type PlanKey } from '../shared/pricing';

const STRIPE_API = 'https://api.stripe.com/v1';

const APPLY = process.argv.includes('--apply');
const SECRET = process.env.STRIPE_SECRET_KEY;

interface StripeProduct {
  id: string;
  name: string;
  active: boolean;
  metadata: Record<string, string>;
}

interface StripePrice {
  id: string;
  product: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  recurring: { interval: 'day' | 'week' | 'month' | 'year' } | null;
  metadata: Record<string, string>;
}

interface StripeList<T> { data: T[]; has_more: boolean }

/** Änderung, die das Skript vornehmen würde. */
interface Change {
  kind: 'product-update' | 'price-metadata' | 'price-create';
  target: string;
  detail: string;
  run: () => Promise<void>;
}

// ── Stripe-REST-Zugriff (ohne SDK-Abhängigkeit) ──────────────────────────

function encodeForm(payload: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) params.append(key, String(value));
  }
  return params.toString();
}

async function stripeRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  payload?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = method === 'GET' && payload
    ? `${STRIPE_API}${path}?${encodeForm(payload)}`
    : `${STRIPE_API}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Verhindert Doppelanlage, falls ein Lauf mitten im Schreiben abbricht.
      ...(method === 'POST' ? { 'Idempotency-Key': `rsd-catalog-${path}-${encodeForm(payload ?? {})}` } : {}),
    },
    body: method === 'POST' ? encodeForm(payload ?? {}) : undefined,
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Stripe ${method} ${path} → ${response.status}: ${body?.error?.message ?? 'unbekannter Fehler'}`);
  }
  return body as T;
}

/** Holt alle Seiten einer Stripe-Liste. */
async function listAll<T extends { id: string }>(path: string): Promise<T[]> {
  const items: T[] = [];
  let startingAfter: string | undefined;
  do {
    const page = await stripeRequest<StripeList<T>>('GET', path, {
      limit: 100,
      starting_after: startingAfter,
    });
    items.push(...page.data);
    startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
  } while (startingAfter);
  return items;
}

// ── Abgleich ──────────────────────────────────────────────────────────────

/** Stripe rechnet in der kleinsten Währungseinheit — Euro → Cent. */
const toCents = (eur: number): number => Math.round(eur * 100);

/** Erwarteter Produktname je Plan. */
const productNameFor = (plan: Plan): string => `RealSync Dynamics — ${plan.name}`;

/**
 * Findet das Stripe-Produkt eines Plans. Bevorzugt `metadata.plan_key`
 * (auch über den Legacy-Alias), sonst über einen Preis, der bereits auf den
 * Plan zeigt, sonst über den Produktnamen.
 */
function findProductForPlan(
  plan: Plan,
  products: StripeProduct[],
  prices: StripePrice[],
): StripeProduct | undefined {
  const byMetadata = products.find((p) => planByKey(p.metadata?.plan_key)?.id === plan.id);
  if (byMetadata) return byMetadata;

  const priceForPlan = prices.find((price) => planByKey(price.metadata?.plan_key)?.id === plan.id);
  if (priceForPlan) {
    const byPrice = products.find((p) => p.id === priceForPlan.product);
    if (byPrice) return byPrice;
  }

  // Namensbasiert, tolerant gegenüber Schreibweisen wie „RealSync Dynamics Enterprise".
  const needle = plan.name.toLowerCase();
  return products.find((p) => p.name.toLowerCase().includes(needle));
}

function planKeysWithInterval(): Array<{ key: PlanKey; plan: Plan; interval: 'month' | 'year'; amountEur: number }> {
  const entries: Array<{ key: PlanKey; plan: Plan; interval: 'month' | 'year'; amountEur: number }> = [];
  for (const key of allPlanKeys()) {
    const plan = planByKey(key)!;
    // Free Audit wird nie abgerechnet und braucht keinen Stripe-Preis.
    if (plan.price.monthlyEur === 0) continue;
    const amountEur = priceForPlanKey(key);
    if (amountEur === null) continue;
    entries.push({ key, plan, interval: key === plan.yearlyPlanKey ? 'year' : 'month', amountEur });
  }
  return entries;
}

async function main(): Promise<void> {
  if (!SECRET) {
    console.error('✗ STRIPE_SECRET_KEY fehlt.');
    console.error('  STRIPE_SECRET_KEY=sk_test_… npx tsx scripts/sync-stripe-catalog.ts');
    process.exit(2);
  }

  const mode = SECRET.startsWith('sk_live_') ? 'LIVE' : 'TEST';
  console.log(`Stripe-Katalog-Abgleich — Modus: ${mode}${APPLY ? ' — SCHREIBEND (--apply)' : ' — nur Diff'}`);
  if (mode === 'LIVE' && APPLY) {
    console.log('⚠  Schreibzugriff auf das Live-Konto. Beträge bestehender Preise werden nicht verändert.\n');
  }

  const [products, prices] = await Promise.all([
    listAll<StripeProduct>('/products'),
    listAll<StripePrice>('/prices'),
  ]);

  const changes: Change[] = [];
  const warnings: string[] = [];

  for (const plan of ORDERED_PLANS) {
    if (plan.price.monthlyEur === 0) continue;

    const product = findProductForPlan(plan, products, prices);
    if (!product) {
      warnings.push(`Kein Stripe-Produkt für Plan „${plan.name}" gefunden — bitte manuell anlegen und erneut laufen lassen.`);
      continue;
    }

    // 1. Produktname und plan_key des Produkts
    const expectedName = productNameFor(plan);
    const nameOk = product.name.toLowerCase().includes(plan.name.toLowerCase());
    const metaOk = product.metadata?.plan_key === plan.planKey;
    if (!nameOk || !metaOk) {
      const payload: Record<string, string> = {};
      if (!nameOk) payload.name = expectedName;
      if (!metaOk) payload['metadata[plan_key]'] = plan.planKey;
      changes.push({
        kind: 'product-update',
        target: product.id,
        detail: [
          !nameOk ? `name "${product.name}" → "${expectedName}"` : null,
          !metaOk ? `metadata.plan_key "${product.metadata?.plan_key ?? '—'}" → "${plan.planKey}"` : null,
        ].filter(Boolean).join(', '),
        run: async () => { await stripeRequest('POST', `/products/${product.id}`, payload); },
      });
    }

    // 2. Preise je Intervall
    for (const entry of planKeysWithInterval().filter((e) => e.plan.id === plan.id)) {
      const expectedCents = toCents(entry.amountEur);
      const productPrices = prices.filter(
        (price) => price.product === product.id
          && price.active
          && price.recurring?.interval === entry.interval
          && price.currency === 'eur',
      );

      const exact = productPrices.find((price) => price.unit_amount === expectedCents);

      if (!exact) {
        const mismatched = productPrices.find((price) => price.unit_amount !== expectedCents);
        if (mismatched) {
          warnings.push(
            `Plan „${plan.name}" (${entry.interval}): Stripe führt ${(mismatched.unit_amount ?? 0) / 100} €, ` +
            `die SSoT ${entry.amountEur} € (${mismatched.id}). Stripe-Preise sind unveränderlich — ` +
            'ein neuer Preis plus Migration der Abos ist eine Geschäftsentscheidung und wird hier nicht automatisiert.',
          );
        }
        changes.push({
          kind: 'price-create',
          target: `${plan.name} / ${entry.interval}`,
          detail: `neuer Preis ${entry.amountEur} € (${entry.key})`,
          run: async () => {
            await stripeRequest('POST', '/prices', {
              product: product.id,
              currency: 'eur',
              unit_amount: expectedCents,
              'recurring[interval]': entry.interval,
              nickname: entry.interval === 'year' ? `${plan.name} (Jährlich)` : plan.name,
              'metadata[plan_key]': entry.key,
              'metadata[app]': 'realsyncdynamicsai',
            });
          },
        });
        continue;
      }

      if (exact.metadata?.plan_key !== entry.key) {
        changes.push({
          kind: 'price-metadata',
          target: exact.id,
          detail: `metadata.plan_key "${exact.metadata?.plan_key ?? '—'}" → "${entry.key}"`,
          run: async () => {
            await stripeRequest('POST', `/prices/${exact.id}`, { 'metadata[plan_key]': entry.key });
          },
        });
      }
    }
  }

  // ── Ausgabe ─────────────────────────────────────────────────────────────

  if (warnings.length > 0) {
    console.log('Hinweise:');
    for (const warning of warnings) console.log(`  ⚠  ${warning}`);
    console.log('');
  }

  if (changes.length === 0) {
    console.log('✓ Stripe ist synchron mit shared/pricing.ts — nichts zu tun.');
    return;
  }

  console.log(`${changes.length} Abweichung(en):`);
  for (const change of changes) {
    console.log(`  [${change.kind}] ${change.target}: ${change.detail}`);
  }
  console.log('');

  if (!APPLY) {
    console.log('Nichts geschrieben. Mit --apply ausführen, um die Änderungen vorzunehmen.');
    return;
  }

  for (const change of changes) {
    await change.run();
    console.log(`  ✓ ${change.target}`);
  }
  console.log(`\n✓ ${changes.length} Änderung(en) angewendet.`);
}

main().catch((error) => {
  console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

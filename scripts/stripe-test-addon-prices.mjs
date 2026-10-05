#!/usr/bin/env node
/**
 * Legt Stripe-Testpreise für Add-ons an. Verweigert Live-Keys.
 *
 *   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-test-addon-prices.mjs
 *
 * Schreibt nichts in die Datenbank. Gibt das SQL aus, das der Betreiber
 * auf der Test-Datenbank ausführt.
 */
const secret = process.env.STRIPE_SECRET_KEY ?? '';
if (!secret.startsWith('sk_test_')) {
  console.error('Abbruch: STRIPE_SECRET_KEY muss mit sk_test_ beginnen.');
  process.exit(1);
}

const addons = [
  { id: 'additional_domain', name: 'Weitere Domain', eur: 19 },
];

const res = await fetch('https://api.stripe.com/v1/prices', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    currency: 'eur',
    unit_amount: String(addons[0].eur * 100),
    'recurring[interval]': 'month',
    nickname: addons[0].name,
    'product_data[name]': addons[0].name,
  }),
});
const body = await res.json();
if (!res.ok) {
  console.error(body.error?.message ?? body);
  process.exit(1);
}
const id = addons[0].id;
console.log(`STRIPE_PRICE_ADDON_${id.toUpperCase()}=${body.id}`);
console.log('');
console.log(`update public.plan_addons set stripe_price_id = '${body.id}', active = true, updated_at = now() where addon_id = '${id}';`);

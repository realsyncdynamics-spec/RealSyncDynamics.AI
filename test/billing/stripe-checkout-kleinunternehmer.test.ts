// @vitest-environment node
/**
 * stripe-checkout — Kleinunternehmer nach § 19 UStG.
 *
 * Dominik Steiner ist Kleinunternehmer (bestätigt am 25.09.2026). Im Checkout
 * und auf Rechnungen darf keine Umsatzsteuer berechnet oder ausgewiesen
 * werden. Dieser Test führt den echten Handler aus
 * `supabase/functions/stripe-checkout/index.ts` mit gemocktem Stripe-SDK und
 * gemocktem Supabase-Client aus und prüft die Parameter, die tatsächlich an
 * `stripe.checkout.sessions.create` gehen:
 *
 *   - kein `automatic_tax` (Stripe Tax) und kein `tax_id_collection`,
 *   - die Price-ID stammt weiterhin aus `public.products`
 *     (`default_for_plan_key`), nicht aus dem Request und nicht aus Code,
 *   - Rechnungsadresse bleibt Pflicht, `customer_update` bleibt erhalten,
 *   - Einmalkäufe (`mode: 'payment'`) tragen den § 19-Hinweis im
 *     Rechnungs-Footer.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const HINWEIS = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.';

const mocks = vi.hoisted(() => {
  const state = {
    products: [] as Array<{ stripe_price_id: string; name: string; default_for_plan_key: string }>,
    existingCustomerId: null as string | null,
    queries: [] as Array<{ table: string; eq: Array<[string, unknown]> }>,
  };
  const sessionsCreate = vi.fn(async (params: Record<string, unknown>) => ({
    id: 'cs_test_mock',
    url: 'https://checkout.stripe.com/c/pay/cs_test_mock',
    params,
  }));
  const customersCreate = vi.fn(async () => ({ id: 'cus_new_mock' }));

  function queryBuilder(table: string) {
    const q = { table, eq: [] as Array<[string, unknown]> };
    state.queries.push(q);
    const result = () => {
      if (table === 'memberships') return { data: { role: 'owner' }, error: null };
      if (table === 'subscriptions') {
        return {
          data: state.existingCustomerId ? { stripe_customer_id: state.existingCustomerId } : null,
          error: null,
        };
      }
      if (table === 'products') {
        const planKey = q.eq.find(([col]) => col === 'default_for_plan_key')?.[1];
        return {
          data: state.products
            .filter((p) => p.default_for_plan_key === planKey)
            .map(({ stripe_price_id, name }) => ({ stripe_price_id, name })),
          error: null,
        };
      }
      return { data: null, error: null };
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => { q.eq.push([col, val]); return builder; },
      limit: () => builder,
      maybeSingle: async () => result(),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  }

  const createClient = vi.fn(() => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1', email: 'owner@example.com' } }, error: null }),
    },
    rpc: async () => ({ data: 'sk_test_mock_not_a_real_key', error: null }),
    from: (table: string) => queryBuilder(table),
  }));

  class StripeMock {
    customers = { create: customersCreate };
    checkout = { sessions: { create: sessionsCreate } };
  }

  return { state, sessionsCreate, customersCreate, createClient, StripeMock };
});

vi.mock('npm:stripe@16.12.0', () => ({ default: mocks.StripeMock }));
vi.mock('jsr:@supabase/supabase-js@2', () => ({ createClient: mocks.createClient }));

let handler: (req: Request) => Promise<Response>;

beforeAll(async () => {
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-mock',
    SUPABASE_SERVICE_ROLE_KEY: 'service-mock',
    PUBLIC_SITE_URL: 'https://realsyncdynamicsai.de',
  };
  vi.stubGlobal('Deno', {
    env: { get: (k: string) => env[k] },
    serve: (h: (req: Request) => Promise<Response>) => { handler = h; },
  });
  // Pfad bewusst als Variable: `tsc --noEmit` (npm run lint) soll die
  // Deno-Datei mit `npm:`/`jsr:`-Specifiern nicht in sein Programm ziehen —
  // `supabase/functions` ist dort ausgeschlossen. Vitest löst den Import zur
  // Laufzeit auf und wendet die Mocks oben an.
  const entry = '../../supabase/functions/stripe-checkout/index.ts';
  await import(/* @vite-ignore */ entry);
  expect(typeof handler).toBe('function');
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mocks.sessionsCreate.mockClear();
  mocks.customersCreate.mockClear();
  mocks.state.queries.length = 0;
  mocks.state.existingCustomerId = null;
  mocks.state.products = [
    // Platzhalter vor der echten Price — die Positivliste muss ihn überspringen.
    { stripe_price_id: 'STRIPE_PRICE_PLACEHOLDER_XXX', name: 'Starter (alt)', default_for_plan_key: 'starter' },
    { stripe_price_id: 'price_from_products_starter', name: 'Starter', default_for_plan_key: 'starter' },
    { stripe_price_id: 'price_from_products_launch', name: 'Governance Launch', default_for_plan_key: 'governance_launch' },
  ];
});

function checkoutRequest(body: Record<string, unknown>): Request {
  return new Request('https://example.supabase.co/functions/v1/stripe-checkout', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer user-jwt',
      'Content-Type': 'application/json',
      Origin: 'https://realsyncdynamicsai.de',
    },
    body: JSON.stringify(body),
  });
}

async function createSession(body: Record<string, unknown>) {
  const res = await handler(checkoutRequest(body));
  const json = await res.json();
  return { res, json };
}

describe('stripe-checkout ohne Umsatzsteuer (§ 19 UStG)', () => {
  it('Abo-Checkout: kein automatic_tax, kein tax_id_collection, Price aus public.products', async () => {
    const { res, json } = await createSession({ tenant_id: 'tenant-1', plan_key: 'starter' });
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    expect(mocks.sessionsCreate).toHaveBeenCalledTimes(1);
    const params = mocks.sessionsCreate.mock.calls[0][0] as Record<string, any>;

    expect(params.mode).toBe('subscription');
    expect(params).not.toHaveProperty('automatic_tax');
    expect(params).not.toHaveProperty('tax_id_collection');
    expect(JSON.stringify(params)).not.toMatch(/tax_rates|automatic_tax|tax_id_collection/);

    // Price-ID kommt aus public.products (default_for_plan_key = starter).
    expect(params.line_items).toEqual([{ price: 'price_from_products_starter', quantity: 1 }]);
    const productQuery = mocks.state.queries.find((q) => q.table === 'products');
    expect(productQuery?.eq).toContainEqual(['default_for_plan_key', 'starter']);

    // Rechnungsadresse bleibt Pflicht; Name/Adresse landen am Customer.
    expect(params.billing_address_collection).toBe('required');
    expect(params.customer_update).toEqual({ address: 'auto', name: 'auto' });
    expect(params.customer).toBe('cus_new_mock');

    // Im Abo-Modus gibt es keine invoice_creation (Stripe lehnt sie dort ab).
    expect(params).not.toHaveProperty('invoice_creation');
    expect(params.subscription_data?.metadata).toMatchObject({ tenant_id: 'tenant-1', plan_key: 'starter' });
  });

  it('Einmalkauf: kein automatic_tax, § 19-Hinweis im Rechnungs-Footer, Price aus public.products', async () => {
    const { res } = await createSession({ tenant_id: 'tenant-1', plan_key: 'governance_launch' });
    expect(res.status).toBe(200);

    const params = mocks.sessionsCreate.mock.calls[0][0] as Record<string, any>;
    expect(params.mode).toBe('payment');
    expect(params).not.toHaveProperty('automatic_tax');
    expect(params).not.toHaveProperty('tax_id_collection');
    expect(params).not.toHaveProperty('subscription_data');
    expect(params.line_items).toEqual([{ price: 'price_from_products_launch', quantity: 1 }]);
    expect(params.invoice_creation).toEqual({
      enabled: true,
      invoice_data: { footer: HINWEIS },
    });
  });

  it('bestehender Stripe-Customer wird wiederverwendet — customer_update bleibt zulässig', async () => {
    mocks.state.existingCustomerId = 'cus_existing_mock';
    await createSession({ tenant_id: 'tenant-1', plan_key: 'starter' });
    expect(mocks.customersCreate).not.toHaveBeenCalled();
    const params = mocks.sessionsCreate.mock.calls[0][0] as Record<string, any>;
    // Stripe: customer_update "Can only be provided when `customer` is provided."
    expect(params.customer).toBe('cus_existing_mock');
    expect(params.customer_update).toEqual({ address: 'auto', name: 'auto' });
  });

  it('ohne echte price_… in public.products ruft der Handler Stripe gar nicht erst auf', async () => {
    mocks.state.products = [
      { stripe_price_id: 'STRIPE_PRICE_PLACEHOLDER_XXX', name: 'Starter', default_for_plan_key: 'starter' },
    ];
    const { res, json } = await createSession({ tenant_id: 'tenant-1', plan_key: 'starter' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(json)).toContain('PRICE_NOT_CONFIGURED');
    expect(mocks.sessionsCreate).not.toHaveBeenCalled();
  });
});

describe('Quelltext-Wächter § 19 UStG', () => {
  const checkout = readFileSync('supabase/functions/stripe-checkout/index.ts', 'utf8');
  const invoiceEmail = readFileSync('supabase/functions/invoice-email/index.ts', 'utf8');

  it('stripe-checkout setzt weder automatic_tax noch tax_id_collection noch Tax Rates', () => {
    expect(checkout).not.toMatch(/automatic_tax\s*:/);
    expect(checkout).not.toMatch(/tax_id_collection\s*:/);
    expect(checkout).not.toMatch(/(default_)?tax_rates\s*:/);
  });

  it('stripe-checkout trägt den § 19-Hinweis wörtlich', () => {
    expect(checkout).toContain(`'${HINWEIS}'`);
  });

  it('invoice-email nennt den § 19-Hinweis in der Rechnungs-Mail', () => {
    expect(invoiceEmail).toContain(HINWEIS);
  });
});

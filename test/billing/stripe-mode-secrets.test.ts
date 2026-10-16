import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiKeyForVerifiedWebhookEvent,
  getStripeMode,
  isWebhookSignatureModeCompatible,
  keyModeOf,
  liveWebhookSigningCandidate,
  planKeyForTestPrice,
  resolveStripeSecretKey,
  resolveStripeWebhookSecret,
  testPriceIdFor,
  type SecretReader,
} from '../../supabase/functions/_shared/stripe-mode';

// Pure unit tests, no Stripe API calls, no Supabase calls, no real credentials.
// Deno.env is read at function call time. Stub it before each test.
describe('Stripe beta mode — key separation', () => {
  let vars: Record<string, string>;

  beforeEach(() => {
    vars = {};
    vi.stubGlobal('Deno', {
      env: {
        get: (key: string) => vars[key],
        toObject: () => ({ ...vars }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const read = (values: Record<string, string>): SecretReader =>
    async (envName, vaultName) => values[vaultName] ?? values[envName] ?? null;

  it('defaults to test mode when STRIPE_MODE is absent or unknown', () => {
    expect(getStripeMode()).toBe('test');
    vars.STRIPE_MODE = 'LIVE';
    expect(getStripeMode()).toBe('test');
    vars.STRIPE_MODE = 'live';
    expect(getStripeMode()).toBe('live');
  });

  it('never uses a live legacy key when the beta mode is test', async () => {
    const result = await resolveStripeSecretKey(read({
      stripe_secret_key: 'sk_live_fake_unit_test',
    }));
    expect(result).toMatchObject({
      ok: false,
      mode: 'test',
      code: 'STRIPE_LIVE_KEY_BLOCKED',
    });
  });

  it('uses the dedicated test secret even when a live legacy key exists', async () => {
    const result = await resolveStripeSecretKey(read({
      stripe_secret_key_test: 'sk_test_fake_unit_test',
      stripe_secret_key: 'sk_live_fake_unit_test',
    }));
    expect(result).toMatchObject({
      ok: true,
      mode: 'test',
      source: 'test_var',
      secretKey: 'sk_test_fake_unit_test',
    });
  });

  it('blocks a wrongly typed test secret instead of falling back to live', async () => {
    const result = await resolveStripeSecretKey(read({
      stripe_secret_key_test: 'sk_live_fake_misconfigured',
      stripe_secret_key: 'sk_test_fake_legacy',
    }));
    expect(result).toMatchObject({
      ok: false,
      mode: 'test',
      code: 'STRIPE_KEY_MODE_MISMATCH',
    });
  });

  it('requires an explicit live mode for live credentials', async () => {
    vars.STRIPE_MODE = 'live';
    const wrong = await resolveStripeSecretKey(read({
      stripe_secret_key: 'sk_test_fake_unit_test',
    }));
    expect(wrong).toMatchObject({ ok: false, code: 'STRIPE_KEY_MODE_MISMATCH' });
    const correct = await resolveStripeSecretKey(read({
      stripe_secret_key: 'sk_live_fake_unit_test',
    }));
    expect(correct).toMatchObject({ ok: true, mode: 'live', source: 'legacy_var' });
  });

  it('never falls back to the legacy webhook secret for a dedicated test key', async () => {
    const secret = await resolveStripeWebhookSecret(read({
      stripe_webhook_secret: 'whsec_live_fake_unit_test',
    }), 'test', 'test_var');
    expect(secret).toBeNull();
  });

  it('uses the dedicated test webhook secret without taking the live secret', async () => {
    const secret = await resolveStripeWebhookSecret(read({
      stripe_webhook_secret_test: 'whsec_test_fake_unit_test',
      stripe_webhook_secret: 'whsec_live_fake_unit_test',
    }), 'test', 'test_var');
    expect(secret).toBe('whsec_test_fake_unit_test');
  });

  it('binds a verified live event to a live key even without test credentials', () => {
    expect(apiKeyForVerifiedWebhookEvent(
      'live', 'sk_live_unit_test', null,
    )).toBe('sk_live_unit_test');
    expect(apiKeyForVerifiedWebhookEvent(
      'live', null, 'sk_test_unit_test',
    )).toBeNull();
  });

  it('never lets a test-signed event use the live API key', () => {
    expect(apiKeyForVerifiedWebhookEvent(
      'test', 'sk_live_unit_test', null,
    )).toBeNull();
    expect(apiKeyForVerifiedWebhookEvent(
      'test', 'sk_live_unit_test', 'sk_test_unit_test',
    )).toBe('sk_test_unit_test');
  });

  it('requires the event livemode flag to match its signing secret mode', () => {
    expect(isWebhookSignatureModeCompatible(true, 'live')).toBe(true);
    expect(isWebhookSignatureModeCompatible(false, 'test')).toBe(true);
    expect(isWebhookSignatureModeCompatible(true, 'test')).toBe(false);
    expect(isWebhookSignatureModeCompatible(false, 'live')).toBe(false);
  });

  it('accepts old test-only signing-credential pairing without duplicate candidates', () => {
    expect(liveWebhookSigningCandidate(
      'whsec_test_legacy', 'whsec_test_legacy', null,
    )).toBeNull();
    expect(liveWebhookSigningCandidate(
      'whsec_test_legacy', 'whsec_test_legacy', 'sk_test_legacy',
    )).toBeNull();
  });

  it('preserves live signing candidate for active or missing live API key', () => {
    expect(liveWebhookSigningCandidate(
      'whsec_live', 'whsec_test', 'sk_live_key',
    )).toBe('whsec_live');
    expect(liveWebhookSigningCandidate(
      'whsec_live', null, null,
    )).toBe('whsec_live');
    // When a live API key exists, equal signing secrets stay ambiguous
    // and are refused by the webhook handler rather than silently resolved.
    expect(liveWebhookSigningCandidate(
      'whsec_shared', 'whsec_shared', 'sk_live_key',
    )).toBe('whsec_shared');
  });

  it('resolves only configured test price IDs and cannot synthesize live prices', () => {
    expect(testPriceIdFor('starter')).toBeNull();
    vars.STRIPE_TEST_PRICE_STARTER = 'price_fake_test_starter';
    expect(testPriceIdFor('starter')).toBe('price_fake_test_starter');
    expect(planKeyForTestPrice('price_fake_test_starter')).toBe('starter');
    vars.STRIPE_TEST_PRICE_GROWTH = 'not_a_price';
    expect(testPriceIdFor('growth')).toBeNull();
    expect(keyModeOf('sk_live_fake')).toBe('live');
    expect(keyModeOf('sk_test_fake')).toBe('test');
  });
});

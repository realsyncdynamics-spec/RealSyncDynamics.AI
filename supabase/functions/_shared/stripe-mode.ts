// Stripe Test-/Live-Schalter für alle Checkout-nahen Edge Functions.
//
// Beta-Phase: Solange nicht belegt ist, dass gekaufte Pakete im Dashboard
// tatsächlich freischalten, laufen ALLE Zahlungen gegen Stripe-Testmodus
// (Sandbox). Der Schalter ist fail-closed:
//
//   STRIPE_MODE   'live' → Live-Betrieb (nur bei exakt diesem Wert)
//                 alles andere / nicht gesetzt → 'test'
//
// Schlüsselauflösung (Vault-first, Env-Fallback — wie bisher je Function):
//   test: stripe_secret_key_test / STRIPE_SECRET_KEY_TEST
//         → sonst Alt-Name stripe_secret_key / STRIPE_SECRET_KEY, aber NUR
//           wenn dieser ein sk_test_/rk_test_-Key ist.
//         Ein sk_live_/rk_live_-Key wird im Testmodus NIE benutzt
//         (Fehler STRIPE_LIVE_KEY_BLOCKED).
//   live: stripe_secret_key / STRIPE_SECRET_KEY (unverändert), muss
//         sk_live_/rk_live_ sein.
//
// Webhook-Secret:
//   test: stripe_webhook_secret_test / STRIPE_WEBHOOK_SECRET_TEST
//         → Alt-Name STRIPE_WEBHOOK_SECRET nur, wenn auch der Secret Key aus
//           dem Alt-Namen kam (dann ist das Alt-Paar nachweislich ein Test-Paar).
//   live: stripe_webhook_secret / STRIPE_WEBHOOK_SECRET.
//
// Test-Price-IDs (keine Migration nötig): Im Testmodus wird die Price-ID NICHT
// aus public.products gelesen (dort stehen Live-IDs), sondern aus
//   STRIPE_TEST_PRICE_<PLAN_KEY in GROSS>   z. B. STRIPE_TEST_PRICE_STARTER
// Fehlt sie, wird der Checkout mit PRICE_NOT_CONFIGURED abgewiesen — es gibt
// keinen Rückfall auf Live-Preise.

export type StripeMode = 'test' | 'live';

export const STRIPE_TEST_PRICE_PREFIX = 'STRIPE_TEST_PRICE_';

/** Liest STRIPE_MODE. Nur der exakte Wert 'live' schaltet Live frei. */
export function getStripeMode(): StripeMode {
  const raw = (Deno.env.get('STRIPE_MODE') ?? '').trim().toLowerCase();
  return raw === 'live' ? 'live' : 'test';
}

/** Modus eines Secret Keys anhand des Präfixes. */
export function keyModeOf(key: string | null | undefined): StripeMode | 'unknown' {
  if (!key) return 'unknown';
  if (key.startsWith('sk_test_') || key.startsWith('rk_test_')) return 'test';
  if (key.startsWith('sk_live_') || key.startsWith('rk_live_')) return 'live';
  return 'unknown';
}

/** Signatur der in jeder Function vorhandenen Vault-first-Leser. */
export type SecretReader = (envVar: string, vaultName: string) => Promise<string | null>;

export type StripeKeyResolution =
  | { ok: true; mode: StripeMode; secretKey: string; source: 'test_var' | 'legacy_var' }
  | { ok: false; mode: StripeMode; code: StripeKeyErrorCode; message: string };

export type StripeKeyErrorCode =
  | 'STRIPE_NOT_CONFIGURED'
  | 'STRIPE_LIVE_KEY_BLOCKED'
  | 'STRIPE_KEY_MODE_MISMATCH';

/**
 * Secret Key passend zu STRIPE_MODE auflösen. Gibt niemals einen Live-Key
 * zurück, solange STRIPE_MODE != 'live'.
 */
export async function resolveStripeSecretKey(read: SecretReader): Promise<StripeKeyResolution> {
  const mode = getStripeMode();

  if (mode === 'test') {
    const testKey = await read('STRIPE_SECRET_KEY_TEST', 'stripe_secret_key_test');
    if (testKey) {
      if (keyModeOf(testKey) !== 'test') {
        return {
          ok: false, mode, code: 'STRIPE_KEY_MODE_MISMATCH',
          message: 'STRIPE_SECRET_KEY_TEST ist kein sk_test_/rk_test_-Key — Testmodus verweigert.',
        };
      }
      return { ok: true, mode, secretKey: testKey, source: 'test_var' };
    }
    const legacy = await read('STRIPE_SECRET_KEY', 'stripe_secret_key');
    if (!legacy) {
      return {
        ok: false, mode, code: 'STRIPE_NOT_CONFIGURED',
        message: 'Stripe-Testmodus aktiv, aber STRIPE_SECRET_KEY_TEST ist nicht gesetzt.',
      };
    }
    const legacyMode = keyModeOf(legacy);
    if (legacyMode === 'test') return { ok: true, mode, secretKey: legacy, source: 'legacy_var' };
    return {
      ok: false, mode, code: legacyMode === 'live' ? 'STRIPE_LIVE_KEY_BLOCKED' : 'STRIPE_KEY_MODE_MISMATCH',
      message: legacyMode === 'live'
        ? 'Beta-Testmodus: Live-Key (sk_live_) wird nicht verwendet. Bitte STRIPE_SECRET_KEY_TEST (sk_test_…) setzen.'
        : 'Beta-Testmodus: STRIPE_SECRET_KEY ist kein Test-Key. Bitte STRIPE_SECRET_KEY_TEST (sk_test_…) setzen.',
    };
  }

  const liveKey = await read('STRIPE_SECRET_KEY', 'stripe_secret_key');
  if (!liveKey) {
    return {
      ok: false, mode, code: 'STRIPE_NOT_CONFIGURED',
      message: 'stripe secret key not configured (neither env nor vault)',
    };
  }
  if (keyModeOf(liveKey) !== 'live') {
    return {
      ok: false, mode, code: 'STRIPE_KEY_MODE_MISMATCH',
      message: 'STRIPE_MODE=live, aber STRIPE_SECRET_KEY ist kein sk_live_/rk_live_-Key.',
    };
  }
  return { ok: true, mode, secretKey: liveKey, source: 'legacy_var' };
}

/** HTTP-Status für einen Schlüssel-Fehler: fehlend = 500, bewusst gesperrt = 503. */
export function stripeKeyErrorStatus(code: StripeKeyErrorCode): number {
  return code === 'STRIPE_NOT_CONFIGURED' ? 500 : 503;
}

/**
 * Webhook-Signing-Secret passend zum aufgelösten Key. `keySource` stammt aus
 * resolveStripeSecretKey() — nur ein Alt-Paar, dessen Key nachweislich ein
 * Test-Key ist, darf im Testmodus das Alt-Webhook-Secret verwenden.
 */
export async function resolveStripeWebhookSecret(
  read: SecretReader,
  mode: StripeMode,
  keySource: 'test_var' | 'legacy_var',
): Promise<string | null> {
  if (mode === 'test') {
    const testSecret = await read('STRIPE_WEBHOOK_SECRET_TEST', 'stripe_webhook_secret_test');
    if (testSecret) return testSecret;
    if (keySource === 'legacy_var') return await read('STRIPE_WEBHOOK_SECRET', 'stripe_webhook_secret');
    return null;
  }
  return await read('STRIPE_WEBHOOK_SECRET', 'stripe_webhook_secret');
}

/** Env-Name der Test-Price-ID eines Plan-Keys, z. B. STRIPE_TEST_PRICE_GOVERNANCE_LAUNCH. */
export function testPriceEnvName(planKey: string): string {
  return STRIPE_TEST_PRICE_PREFIX + planKey.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

/** Test-Price-ID für einen Plan-Key oder null (nur echte `price_…`-IDs). */
export function testPriceIdFor(planKey: string): string | null {
  const id = (Deno.env.get(testPriceEnvName(planKey)) ?? '').trim();
  return id.startsWith('price_') ? id : null;
}

/**
 * Rückwärtssuche Test-Price-ID → Plan-Key (für Webhook/Verify, falls die
 * Test-Price kein metadata.plan_key trägt). Liefert den Plan-Key in
 * Kleinschreibung, z. B. 'starter' — Aufrufer normalisieren über die SSoT.
 */
export function planKeyForTestPrice(priceId: string | null | undefined): string | null {
  if (!priceId || getStripeMode() !== 'test') return null;
  let entries: Record<string, string>;
  try { entries = Deno.env.toObject(); } catch { return null; }
  for (const [name, value] of Object.entries(entries)) {
    if (name.startsWith(STRIPE_TEST_PRICE_PREFIX) && value.trim() === priceId) {
      return name.slice(STRIPE_TEST_PRICE_PREFIX.length).toLowerCase();
    }
  }
  return null;
}

/** Felder, die Checkout-Antworten und Session-Metadaten beobachtbar machen. */
export function stripeModeResponseFields(mode: StripeMode): { stripe_mode: StripeMode; beta_test: boolean } {
  return { stripe_mode: mode, beta_test: mode === 'test' };
}

/** Stripe-Metadaten (nur Strings erlaubt). */
export function stripeModeMetadata(mode: StripeMode): Record<string, string> {
  return mode === 'test' ? { beta_test: 'true', stripe_mode: 'test' } : { stripe_mode: 'live' };
}

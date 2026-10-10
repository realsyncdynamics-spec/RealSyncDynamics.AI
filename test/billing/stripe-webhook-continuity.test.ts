import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Source contract for the Deno.serve entrypoint. The runtime's signature
// verifier cannot be imported into the Node Vitest runner directly.
const webhook = readFileSync(
  resolve(process.cwd(), 'supabase/functions/stripe-webhook/index.ts'),
  'utf8',
);

describe('Stripe webhook continuity during Beta', () => {
  it('reads the live signing secret independently of missing test credentials', () => {
    expect(webhook).toContain("const liveSigningSecret = await getSecret('STRIPE_WEBHOOK_SECRET'");
    expect(webhook).toContain("const testKeyRes = runtimeMode === 'test' ? await resolveStripeSecretKey(getSecret) : null");
    expect(webhook).not.toContain("if (!keyRes.ok) {");
  });

  it('authenticates the signing secret before selecting a mode-specific API key', () => {
    expect(webhook).toContain('liveWebhookSigningCandidate(liveSigningSecret, testSigningSecret, liveApiKey)');
    expect(webhook).toContain("if (liveCandidate) signingCandidates.push({ mode: 'live', secret: liveCandidate });");
    expect(webhook).toContain('constructEventAsync(raw, sig, candidate.secret)');
    expect(webhook).toContain('isWebhookSignatureModeCompatible(event.livemode, verifiedMode)');
    expect(webhook).toContain('apiKeyForVerifiedWebhookEvent(verifiedMode, liveApiKey, testApiKey)');
    expect(webhook.indexOf('constructEventAsync(raw, sig, candidate.secret)')).toBeLessThan(
      webhook.indexOf('const eventApiKey = apiKeyForVerifiedWebhookEvent('),
    );
  });

  it('never acknowledges as successful when a verified event lacks its required key', () => {
    expect(webhook).toContain("if (!eventApiKey) {");
    expect(webhook).toContain("live event received but no sk_live_ key configured");
    expect(webhook).toMatch(/if \(!eventApiKey\) \{[\s\S]*?status: 503/);
  });

  it('blocks ambiguous test/live signing secrets', () => {
    expect(webhook).toContain('testSigningSecret === liveSigningSecret');
    expect(webhook).toContain("test/live webhook signing secrets must be distinct");
  });
});

// Shopify webhook helpers — HMAC verification on raw body + bulk
// registration on install. Topics are minimal: only what's needed to
// re-scan or de-register a shop.

import { shopifyGraphQL } from './shopify-client.ts';

export interface WebhookSpec { topic: string; address: string; }

export const STANDARD_WEBHOOK_TOPICS = [
  'APP_UNINSTALLED',
  'SHOP_UPDATE',
  'THEMES_UPDATE',
] as const;

/**
 * Verify the X-Shopify-Hmac-Sha256 header on the RAW request body.
 * Returns boolean — never throws. The caller MUST pass the raw bytes
 * exactly as received; do NOT JSON.parse first.
 */
export async function verifyShopifyWebhookHmac(
  rawBody: string,
  hmacHeader: string,
  secret: string,
): Promise<boolean> {
  if (!hmacHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const computed = b64encode(sig);
  return constantTimeStringEquals(computed, hmacHeader);
}

export async function registerShopifyWebhooks(args: {
  shopDomain: string;
  accessToken: string;
  callbackUrl: string;
}): Promise<Array<{ topic: string; ok: boolean; webhookId?: string; error?: string }>> {
  const results: Array<{ topic: string; ok: boolean; webhookId?: string; error?: string }> = [];

  for (const topic of STANDARD_WEBHOOK_TOPICS) {
    const mutation = `mutation WebhookCreate($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
        webhookSubscription { id }
        userErrors { field message }
      }
    }`;
    try {
      const resp = await shopifyGraphQL<{
        webhookSubscriptionCreate: {
          webhookSubscription: { id: string } | null;
          userErrors: Array<{ field: string[]; message: string }>;
        };
      }>({
        shopDomain: args.shopDomain,
        accessToken: args.accessToken,
        query: mutation,
        variables: {
          topic,
          subscription: { callbackUrl: args.callbackUrl, format: 'JSON' },
        },
      });
      const data = resp.data?.webhookSubscriptionCreate;
      if (resp.errors?.length || data?.userErrors?.length) {
        results.push({
          topic,
          ok: false,
          error: (resp.errors?.[0]?.message ?? data?.userErrors?.[0]?.message ?? 'unknown'),
        });
      } else {
        results.push({ topic, ok: true, webhookId: data?.webhookSubscription?.id });
      }
    } catch (e) {
      results.push({ topic, ok: false, error: (e as Error).message });
    }
  }

  return results;
}

function b64encode(u8: Uint8Array): string {
  let bin = '';
  for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin);
}

function constantTimeStringEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

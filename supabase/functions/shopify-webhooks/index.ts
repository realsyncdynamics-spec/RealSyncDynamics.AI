// POST /functions/v1/shopify-webhooks
//
// Topics (registered in callback):
//   APP_UNINSTALLED   → status='uninstalled', uninstalled_at=NOW(), drop scopes
//   THEMES_UPDATE     → queue a new scan_run
//   SHOP_UPDATE       → noop for MVP, logged in shopify_webhooks events table
//
// HMAC verification is non-optional. The raw body MUST be read once
// and reused; do not JSON.parse first.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { verifyShopifyWebhookHmac } from '../_shared/shopify-webhooks.ts';
import { normalizeShopDomain } from '../_shared/shopify-oauth.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  const secret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET') ?? Deno.env.get('SHOPIFY_API_SECRET') ?? '';
  if (!secret) return new Response('webhook secret not configured', { status: 503 });

  const rawBody = await req.text();
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256') ?? '';
  const ok = await verifyShopifyWebhookHmac(rawBody, hmacHeader, secret);
  if (!ok) return new Response('hmac fail', { status: 401 });

  const topic = (req.headers.get('x-shopify-topic') ?? '').toLowerCase();
  const shopDomain = normalizeShopDomain(req.headers.get('x-shopify-shop-domain') ?? '');
  if (!topic || !shopDomain) return new Response('missing headers', { status: 400 });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const { data: shopRow } = await admin.from('shopify_shops')
    .select('id').eq('shop_domain', shopDomain).maybeSingle();
  if (!shopRow) return new Response('unknown shop', { status: 404 });

  switch (topic) {
    case 'app/uninstalled':
      await admin.from('shopify_shops').update({
        status: 'uninstalled',
        uninstalled_at: new Date().toISOString(),
        // Keep encrypted token for audit history but mark shop uninstalled.
      }).eq('id', shopRow.id);
      await admin.from('shopify_webhooks').update({ status: 'removed' }).eq('shop_id', shopRow.id);
      break;

    case 'themes/update':
      await admin.from('shopify_scan_runs').insert({ shop_id: shopRow.id, status: 'queued' });
      break;

    case 'shop/update':
    default:
      // Log but no action
      break;
  }

  return new Response('ok', { status: 200 });
});

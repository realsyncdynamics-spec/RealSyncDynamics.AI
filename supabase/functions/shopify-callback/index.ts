// GET /functions/v1/shopify-callback?shop=&code=&state=&hmac=...
//
// 1) verify HMAC over query
// 2) compare state to httpOnly cookie
// 3) exchange code -> access_token
// 4) encrypt token + upsert shopify_shops
// 5) register webhooks
// 6) queue initial scan (insert shopify_scan_runs status=queued)
// 7) 302 to /shopify/success?shop=...

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  encryptToken, exchangeCodeForToken, normalizeShopDomain, validateScopes, verifyShopifyHmac,
} from '../_shared/shopify-oauth.ts';
import { registerShopifyWebhooks } from '../_shared/shopify-webhooks.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const shop = normalizeShopDomain(url.searchParams.get('shop') ?? '');
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';

  if (!shop || !code || !state) return text(400, 'missing required params');

  const apiKey    = Deno.env.get('SHOPIFY_API_KEY');
  const apiSecret = Deno.env.get('SHOPIFY_API_SECRET');
  const appUrl    = Deno.env.get('SHOPIFY_APP_URL');
  const scopesEnv = Deno.env.get('SHOPIFY_SCOPES') ?? 'read_themes,read_content';
  if (!apiKey || !apiSecret || !appUrl) return text(503, 'shopify integration not configured (env)');

  // 1) HMAC
  const hmacOk = await verifyShopifyHmac(url.searchParams, apiSecret);
  if (!hmacOk) return text(401, 'hmac verification failed');

  // 2) State cookie
  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookieState = pickCookie(cookieHeader, 'rsd_shopify_state');
  if (!cookieState || cookieState !== state) return text(401, 'state mismatch');

  // 3) Token exchange
  let token: { access_token: string; scope: string };
  try { token = await exchangeCodeForToken({ shop, code, apiKey, apiSecret }); }
  catch (e) { return text(502, `token exchange failed: ${(e as Error).message}`); }

  let allowedScopes: string[];
  try { allowedScopes = validateScopes(scopesEnv); }
  catch (e) { return text(500, `invalid scope config: ${(e as Error).message}`); }
  // Defensive: refuse if Shopify granted a scope outside our allow-list.
  for (const granted of token.scope.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!allowedScopes.includes(granted)) {
      return text(403, `granted scope not allowed: ${granted}`);
    }
  }

  // 4) Encrypt + upsert
  const encrypted = await encryptToken(token.access_token);
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const { data: shopRow, error: upErr } = await admin.from('shopify_shops').upsert({
    shop_domain: shop,
    access_token_encrypted: encrypted,
    scopes: token.scope.split(',').map((s) => s.trim()).filter(Boolean),
    api_version: Deno.env.get('SHOPIFY_API_VERSION') ?? '2026-01',
    status: 'installed',
    installed_at: new Date().toISOString(),
    uninstalled_at: null,
  }, { onConflict: 'shop_domain' }).select('*').single();
  if (upErr) return text(500, `db upsert failed: ${upErr.message}`);

  // 5) Webhooks (best-effort)
  const callbackUrl = `${appUrl.replace(/\/$/, '')}/functions/v1/shopify-webhooks`;
  const reg = await registerShopifyWebhooks({ shopDomain: shop, accessToken: token.access_token, callbackUrl });
  for (const r of reg) {
    await admin.from('shopify_webhooks').insert({
      shop_id: shopRow.id,
      topic: r.topic,
      webhook_id: r.webhookId ?? null,
      status: r.ok ? 'registered' : 'failed',
    });
  }

  // 6) Queue initial scan
  await admin.from('shopify_scan_runs').insert({
    shop_id: shopRow.id,
    status: 'queued',
  });

  // 7) Redirect to success page on the public app domain
  const redirect = `${appUrl.replace(/\/$/, '')}/shopify/success?shop=${encodeURIComponent(shop)}`;
  const headers = new Headers({ location: redirect });
  // Clear OAuth cookies
  headers.append('set-cookie', `rsd_shopify_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append('set-cookie', `rsd_shopify_shop=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 302, headers });
});

function pickCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

function text(status: number, msg: string): Response {
  return new Response(msg, { status, headers: { 'content-type': 'text/plain' } });
}

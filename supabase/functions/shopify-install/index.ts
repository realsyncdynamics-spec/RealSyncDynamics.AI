// GET /functions/v1/shopify-install?shop=<store>.myshopify.com
//
// Validates the shop domain, mints an OAuth state, sets a short-lived
// httpOnly cookie (10min), and redirects to Shopify's OAuth authorize
// URL. No DB write at this stage — that happens after callback.

import { buildShopifyInstallUrl, newState, normalizeShopDomain, validateScopes } from '../_shared/shopify-oauth.ts';

Deno.serve((req) => {
  const url = new URL(req.url);
  const shop = normalizeShopDomain(url.searchParams.get('shop') ?? '');
  if (!shop) return text(400, 'invalid shop parameter (expected <store>.myshopify.com)');

  const apiKey      = Deno.env.get('SHOPIFY_API_KEY');
  const scopesEnv   = Deno.env.get('SHOPIFY_SCOPES') ?? 'read_themes,read_content';
  const appUrl      = Deno.env.get('SHOPIFY_APP_URL');
  if (!apiKey || !appUrl) return text(503, 'shopify integration not configured (env)');

  let scopes: string;
  try { scopes = validateScopes(scopesEnv).join(','); }
  catch (e) { return text(500, `invalid scope config: ${(e as Error).message}`); }

  const state = newState();
  const redirectUri = `${appUrl.replace(/\/$/, '')}/functions/v1/shopify-callback`;
  const installUrl  = buildShopifyInstallUrl({ shop, apiKey, scopes, redirectUri, state });

  const headers = new Headers({ location: installUrl });
  // httpOnly + Secure cookie tied to state — verified in callback.
  // 10-minute TTL is enough for the OAuth round-trip.
  headers.append(
    'set-cookie',
    `rsd_shopify_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );
  headers.append(
    'set-cookie',
    `rsd_shopify_shop=${shop}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );
  return new Response(null, { status: 302, headers });
});

function text(status: number, msg: string): Response {
  return new Response(msg, { status, headers: { 'content-type': 'text/plain' } });
}

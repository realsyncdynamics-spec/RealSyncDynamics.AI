# Turnstile for the anonymous audit copilot

The anonymous `ai-gateway` path validates Turnstile server-side before rate limiting, logging, or provider work. The existing verifier in `supabase/functions/_shared/aiGateway/turnstile.ts` remains the source of truth; this integration extends it without replacing it.

## Required configuration

| Variable | Where to set it | Purpose |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | Supabase Edge Function secrets | Private server-side Siteverify credential; never expose it in Vite or the browser. |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Pages build environment | Public widget key consumed by the audit-copilot UI at build time. |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Optional Supabase Edge Function secret | Additional comma-separated exact hostnames or one-label wildcards. |

The defaults allow `realsyncdynamicsai.de`, `www.realsyncdynamicsai.de`, and the Pages production hostname `realsyncdynamics-ai.pages.dev`. To allow branch preview hosts as well, set `TURNSTILE_ALLOWED_HOSTNAMES=*.realsyncdynamics-ai.pages.dev`; this adds the wildcard to the defaults. The server-side wildcard matches one DNS label (for example, `feature-123.realsyncdynamics-ai.pages.dev`), not nested or unrelated `pages.dev` sites. Cloudflare's widget hostname field does not accept `*`; add the exact root hostname `realsyncdynamics-ai.pages.dev` in the widget's Hostname Management, which Cloudflare documents as authorizing its subdomains too.

Use your existing Cloudflare Turnstile widget's site key and secret key. No key value is checked into this repository. A missing `VITE_TURNSTILE_SITE_KEY` leaves the widget unavailable and the protected anonymous request fails closed; a missing Edge secret returns `TURNSTILE_UNCONFIGURED`.

The `ai-gateway` platform `verify_jwt = true` prefilter requires a legacy anon JWT in the `Authorization` bearer header. A `sb_publishable_...` key is valid in `apikey`, but is not a JWT. If `VITE_SUPABASE_ANON_KEY` contains the legacy JWT, it is used in both headers; if the app uses a publishable key, also set `VITE_SUPABASE_ANON_JWT` to the project's legacy anon JWT for the bearer header. Both are public project keys, never service-role credentials.

The browser calls `https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/ai-gateway` directly, using the project's configured Supabase URL. It does not route through `api.realsyncdynamics.ai` or any Cloudflare Worker custom-domain route; the Edge Function performs server-to-server Siteverify.

## CSP

Cloudflare's [Turnstile CSP guidance](https://developers.cloudflare.com/turnstile/reference/content-security-policy/) recommends a nonce-based CSP, or—when a nonce approach is unavailable—allowing `https://challenges.cloudflare.com` in `script-src` and `frame-src`. `public/_headers` uses the documented host allowlist. `connect-src 'self'` is already present. The browser loads `api.js` and the widget iframe; Siteverify itself is a server-to-server request from the Supabase Edge Function and is not controlled by the Pages CSP.

## Siteverify retry behavior

Siteverify receives `secret`, `response`, optional `remoteip`, and an internally generated UUID `idempotency_key`. If the first attempt times out or encounters a network error, the verifier retries once with the exact same payload and key. It does not retry an explicit HTTP failure or invalid JSON response. The token is accepted from either `turnstile_token` or the native `cf-turnstile-response` widget field and is sent to Siteverify only as `response`.

## Deploy checklist

1. Set `TURNSTILE_SECRET_KEY` in the Supabase project's Edge Function secrets.
2. Set `VITE_TURNSTILE_SITE_KEY` in Cloudflare Pages and trigger a new build.
3. Optionally set `TURNSTILE_ALLOWED_HOSTNAMES` as above for preview deployments.
4. Confirm the Cloudflare widget configuration includes `realsyncdynamics-ai.pages.dev`; Cloudflare's hostname setting then covers its preview subdomains.
5. Verify the widget renders, its `data-action` is `audit_copilot`, and an anonymous `mode: audit_anon` request succeeds only after Siteverify accepts the token.

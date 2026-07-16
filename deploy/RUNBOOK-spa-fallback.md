# Runbook — SPA Fallback / Unknown-Route 404

**Linked issue:** #269
**Last external probe:** 2026-05-16 00:46 UTC
**Owner:** infra / on-call

---

## TL;DR

The original ticket assumed the production edge is Hostinger / Nginx / Traefik.
External probes show it is actually **GitHub Pages behind Fastly**. The
repo's nginx template (`deploy/nginx/realsyncdynamicsai.de.conf`) is *not*
the live edge.

The SPA shell **does** render for unknown routes — `/integrations/shopify`
returns the same 67 788-byte body as `/index.html` (etag `6a075759-108cc`).
The only thing that's wrong is the **HTTP status code**: GitHub Pages
serves `404.html` with status `404`, not `200`. React Router boots and
renders the right page; CDN / SEO / uptime monitors flag a 4xx.

## External probe results (raw)

```
GET /                          HTTP/2 200   server: GitHub.com   via: 1.1 varnish
GET /integrations/shopify      HTTP/2 404   server: GitHub.com   (body = SPA shell, etag 6a075759-108cc)
GET /audit                     HTTP/2 301 → /audit/        HTTP/2 200   (pre-rendered)
GET /pricing                   HTTP/2 301 → /pricing/      HTTP/2 200   (pre-rendered)
GET /dashboard/business        HTTP/2 404   (body = SPA shell)
GET /404.html                  HTTP/2 200   etag 6a075759-108cc   content-length 67788
GET /index.html                HTTP/2 200   etag 6a075759-108cc   content-length 67788
GET /assets/index-DXxT4C4Y.js  HTTP/2 200   content-type: application/javascript

POST $SB/functions/v1/stripe-webhook      (no sig)    → HTTP 400  "missing signature"
POST $SB/functions/v1/governance-agent    (no ack)    → HTTP 401  UNAUTHORIZED_NO_AUTH_HEADER
POST $SB/functions/v1/gdpr-audit          (test)      → HTTP 400  INVALID_EMAIL  (test payload not minimal-valid; not a server bug)
```

Headers `server: GitHub.com`, `via: 1.1 varnish`, `x-fastly-request-id`,
`x-served-by: cache-chi-*`, and the literal `CNAME` file at
`https://realsyncdynamicsai.de/CNAME` containing `realsyncdynamicsai.de`
confirm GitHub Pages + Fastly is the edge.

## Probable root cause (ranked)

1. **Hosting is GitHub Pages, not the VPS in `deploy/nginx/`** — the repo
   ships an nginx template that is currently unused. The CNAME at the
   apex points at the GitHub-Pages origin, and Fastly fronts it.
2. **GitHub Pages cannot return 200 for unknown paths.** It serves
   `404.html` (which our `npm run build` copies from `index.html`) but
   always with HTTP 404. There is no `try_files` equivalent.
3. **`/integrations/shopify` and `/dashboard/business` are not in
   `public/sitemap.xml`**, so `scripts/prerender.mjs` does not emit
   `dist/integrations/shopify/index.html` or `dist/dashboard/business/index.html`.
   Pre-rendered routes (`/audit/`, `/pricing/`) come back as 200 because
   they exist as actual files; the others fall through to `404.html`.

## Remediation options

Pick **one** of the following. They are listed in order of "lowest blast
radius first".

### Option A — Add affected routes to sitemap + prerender (fastest, no infra change)

Patch `public/sitemap.xml` to include `/integrations/shopify` and
`/dashboard/business` at `priority >= 0.6`, then re-deploy with
`npm run build:full` (which runs `vite build && npm run prerender`).
`scripts/prerender.mjs` writes `dist/integrations/shopify/index.html`,
which GitHub Pages then serves with status 200.

**Pros:** No edge / DNS / hosting change. Works today.
**Cons:** Manual — every new SPA route needs a sitemap entry. Doesn't fix
the structural problem.

**Caveat for `/dashboard/business`:** the page is now auth-gated
(PR #268). Pre-rendering will serve the **login screen** as static HTML.
That is still a 200 + SPA shell + correct CSR rehydration, but if
auth-gated pages should not be indexed at all, set `priority` low and add
`noIndex` (already done in the React component) — *or* skip Option A for
that route and rely on Option B.

### Option B — Switch the apex to a host with native SPA fallback

Two pre-configured candidates already exist in the repo:

- **Vercel** — `_wrangler.toml / cloudflare-pages config` already contains:
  ```json
  { "source": "/(.*)", "destination": "/index.html" }
  ```
  Hooking the GitHub repo to Vercel and pointing the apex `A`/`AAAA` (or
  `CNAME`) at Vercel makes every unknown path 200.
- **Hostinger VPS + nginx** — `deploy/nginx/realsyncdynamicsai.de.conf`
  already has the right `try_files` block at lines 55–59. Moving DNS to
  the VPS IP and running:
  ```bash
  sudo ln -sf /etc/nginx/sites-available/realsyncdynamicsai.de.conf \
              /etc/nginx/sites-enabled/realsyncdynamicsai.de.conf
  sudo nginx -t && sudo systemctl reload nginx
  ```
  achieves the same on the VPS path.

**Pros:** Structurally correct. No per-route maintenance.
**Cons:** DNS change. Need to migrate any GitHub-Pages-specific config
(CNAME file, Fastly cert handoff).

### Option C — Cloudflare in front of GitHub Pages with status rewrite

Put Cloudflare in front, add a Page Rule / Worker that rewrites 404
responses on `/integrations/*` and `/dashboard/*` to status 200 while
keeping the 404.html body.

**Pros:** No re-host.
**Cons:** Adds another vendor; Workers cost; gotchas with Fastly already
fronting GH Pages.

### Recommendation

- **Now (this incident):** Option A for `/integrations/shopify` (the one
  route blocking Phase-2 validation).
- **Within the next sprint:** Option B (Vercel) — `_wrangler.toml / cloudflare-pages config` is
  already there, this is two DNS records.

## Diagnosis steps (if symptoms re-appear)

Run these from outside the VPS:

```bash
DOMAIN="https://realsyncdynamicsai.de"

# 1. Which edge is serving?
curl -sI "$DOMAIN/" | grep -iE "^(server|via|x-served-by|x-fastly|cf-ray)"
# → GitHub.com + varnish + x-served-by:cache-*  → GitHub Pages + Fastly
# → cloudflare + cf-ray                          → Cloudflare
# → nginx                                        → VPS nginx

# 2. Is /CNAME present?  (GitHub Pages signature)
curl -s "$DOMAIN/CNAME"

# 3. Compare unknown-route body to /404.html and /index.html
curl -sI "$DOMAIN/integrations/shopify" | grep -iE "etag|content-length"
curl -sI "$DOMAIN/404.html"             | grep -iE "etag|content-length"
curl -sI "$DOMAIN/index.html"           | grep -iE "etag|content-length"
# Identical etag + length = SPA shell IS served, only the status code is wrong.

# 4. Which pre-rendered routes exist in the deployed bundle?
#    (If you have shell access to dist/)
find dist -name index.html -mindepth 2 | sort
```

### If the edge IS nginx (deploy/nginx/ scenario)

```bash
# Show the active server block for the apex
sudo nginx -T 2>&1 | awk '/server_name realsyncdynamicsai.de/,/^}/'

# Confirm SPA fallback is hit for unknown paths
sudo tail -f /var/log/nginx/access.log &
curl -sI https://realsyncdynamicsai.de/integrations/shopify
# Expect log line: "GET /integrations/shopify" 200 ... and try_files cascade.
```

### If the edge IS Traefik

```bash
# Inspect the live config
docker exec traefik traefik show config | grep -A20 "realsyncdynamicsai"
# Confirm the SPA router has the errors-middleware or replacePathRegex.
```

## Reload commands

| Edge | Reload |
|---|---|
| GitHub Pages | `git push` triggers Pages build automatically. No manual reload. |
| Nginx (VPS)  | `sudo nginx -t && sudo systemctl reload nginx` |
| Traefik (docker) | `docker exec traefik kill -HUP 1` *(or)* `docker restart traefik` |
| Vercel | `git push` triggers deploy. No manual reload. |

## Rollback

| Edge | Rollback |
|---|---|
| GitHub Pages | `git revert <commit>` of the sitemap/prerender change, force-push not needed. |
| Nginx (VPS)  | `sudo cp /etc/nginx/sites-available/realsyncdynamicsai.de.conf.bak /etc/nginx/sites-available/realsyncdynamicsai.de.conf && sudo nginx -t && sudo systemctl reload nginx` (always copy to `.bak` before editing) |
| Vercel | Re-point DNS apex back to the prior origin (GitHub Pages `185.199.108.153` etc.). TTL = 5 min recommended during cut-over. |

## Acceptance validation (run after remediation)

Paste raw output of all of these into the issue when closing #269.

```bash
DOMAIN="https://realsyncdynamicsai.de"
SB="https://ebljyceifhnlzhjfyxup.supabase.co"

echo "=== SPA routes (expect HTTP 200, content-type text/html) ==="
for p in /integrations/shopify /audit /pricing /dashboard/business; do
  printf "%-35s " "$p"
  curl -sI -o /dev/null -w "HTTP %{http_code}  CT=%{content_type}\n" -L "$DOMAIN$p"
done

echo ""
echo "=== Static asset (expect 200, application/javascript) ==="
ASSET=$(curl -s "$DOMAIN/" | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
printf "%-35s " "$ASSET"
curl -sI -o /dev/null -w "HTTP %{http_code}  CT=%{content_type}\n" "$DOMAIN$ASSET"

echo ""
echo "=== Backend (must remain untouched) ==="
printf "stripe-webhook (no sig)            "
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$SB/functions/v1/stripe-webhook" \
  -H "Content-Type: application/json" -d '{}'
printf "governance-agent (no ack)          "
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST "$SB/functions/v1/governance-agent" \
  -H "Content-Type: application/json" -d '{}'
```

Expected after fix:

| Check | Expected |
|---|---|
| `GET /integrations/shopify` | HTTP 200, `text/html` |
| `GET /audit` | HTTP 200, `text/html` |
| `GET /pricing` | HTTP 200, `text/html` |
| `GET /dashboard/business` | HTTP 200, `text/html` |
| `GET /assets/index-*.js` | HTTP 200, `application/javascript` |
| `POST stripe-webhook` (no sig) | HTTP 400 |
| `POST governance-agent` (no ack) | HTTP 401 |

The `gdpr-audit` acceptance check in the original issue used a test
payload that the function rejects with `INVALID_EMAIL`. That is a
documentation/test-payload issue, not a server-side problem, and should
be resolved separately (correct test payload, or relax the criterion to
"function reachable and returns 2xx/4xx, not 5xx").

## Constraints (do not violate)

- ✅ Frontend SPA routes resolve to `index.html` content with HTTP 200
- ✅ `/assets/*` served directly with long-cache, never rewritten
- ❌ `/_kodee/*` proxy (see `deploy/nginx/snippets/kodee-ollama.conf`) must
  not be rewritten to `index.html`
- ❌ Supabase function URLs (`*.supabase.co/functions/v1/*`) untouched
- ❌ Stripe webhook signature behaviour untouched
- ❌ No React app code changes
- ❌ No Supabase function changes
- ❌ No Stripe / webhook config changes

# Production Runtime — Source of Truth

**Last verified:** 2026-05-16
**Verification method:** `curl -sI https://realsyncdynamicsai.de/` returned `server: GitHub.com` and `x-served-by: cache-chi-klot8100052-CHI` (Fastly = GitHub Pages CDN).
**Authoritative ADR:** [`docs/adr/0001-stay-on-supabase-gh-pages-for-v1.md`](../adr/0001-stay-on-supabase-gh-pages-for-v1.md)

---

## TL;DR — Where things actually live

| Surface | Pipeline | Target | Custom domain |
|---|---|---|---|
| **Frontend SPA** (the React app) | `.github/workflows/deploy-pages.yml` | **GitHub Pages** at `realsyncdynamics-spec.github.io/RealSyncDynamics.AI/` | `realsyncdynamicsai.de` (via Traefik 301-redirect on the VPS) |
| **Supabase migrations + Edge Functions** | `.github/workflows/deploy.yml` | Supabase project `ebljyceifhnlzhjfyxup` (Frankfurt) | `*.supabase.co/functions/v1/*` |
| **Kodee VPS subdomains** (chat, ollama, n8n) | manual via `docker compose up -d` on VPS | Hostinger VPS `srv1622293` at `187.77.89.1` | `chat.realsyncdynamicsai.de`, `ollama.realsyncdynamicsai.de`, `n8n.realsyncdynamicsai.de` |
| **Tracker pattern DB refresh** | `.github/workflows/tracker-db-update.yml` (cron) | Supabase via `deploy.yml` | n/a |

**The canonical user-facing host is `realsyncdynamicsai.de` — but it serves from GitHub Pages, not from the VPS.**

---

## How a request to `realsyncdynamicsai.de` actually flows

```
                          ┌──────────────────────────────────────┐
   Browser → DNS A/AAAA   │  Hostinger VPS  187.77.89.1          │
                          │  (kodee-stack docker-compose)         │
                          │                                       │
                          │  ┌─────────────────────────────────┐  │
                          │  │       Traefik (TLS, routing)    │  │
                          │  │                                 │  │
   request                │  │  Host(realsyncdynamicsai.de)    │  │
   ───────────────────────┼──┼──→ middleware kodee-apex-redirect │  │
                          │  │      => 301 PERMANENT to        │  │
                          │  │      realsyncdynamics-spec      │  │
                          │  │      .github.io/                │  │
                          │  │      RealSyncDynamics.AI/$path  │  │
                          │  │                                 │  │
                          │  │  Host(chat.realsyncdynamicsai)  │  │
                          │  │   → kodee-chat container        │  │
                          │  │  Host(ollama.realsyncdynamicsai)│  │
                          │  │   → kodee-ollama container      │  │
                          │  │  Host(n8n.realsyncdynamicsai)   │  │
                          │  │   → kodee-n8n container         │  │
                          │  └─────────────────────────────────┘  │
                          └──────────────────────────────────────┘
                                         │ 301
                                         ▼
                          ┌──────────────────────────────────────┐
                          │  GitHub Pages (Fastly CDN edge)      │
                          │                                       │
                          │  realsyncdynamics-spec.github.io/    │
                          │   RealSyncDynamics.AI/$path           │
                          │                                       │
                          │  serves: dist/ artifact from the      │
                          │   latest run of                       │
                          │   .github/workflows/deploy-pages.yml  │
                          └──────────────────────────────────────┘
                                         │
                                         ▼
                          ┌──────────────────────────────────────┐
                          │  Browser hydrates the SPA             │
                          │  └─→ in-app calls go to                │
                          │       https://ebljyceifhnlzhjfyxup    │
                          │       .supabase.co/functions/v1/*     │
                          └──────────────────────────────────────┘
```

The VPS is essentially a **TLS-terminating apex-redirector + Kodee-subdomain host**. The frontend SPA itself is never served from the VPS in production today.

---

## Production source-of-truth: the canonical pipelines

### Frontend → GitHub Pages

- **Workflow:** `.github/workflows/deploy-pages.yml`
- **Trigger:** push to `main` on `src/**`, `public/**`, `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, plus manual `workflow_dispatch`.
- **Build:** `vite build` with `VITE_BASE=/` (custom domain).
- **Prerender:** Playwright Chromium renders every sitemap route with `priority >= 0.6` into `dist/<route>/index.html` (script: `scripts/prerender.mjs`). SPA-fallback fills `dist/<other-route>/index.html` with a copy of the shell so direct GETs do not 404.
- **Publish:** GitHub Pages deploy action — `dist/` becomes the served artifact at `realsyncdynamics-spec.github.io/RealSyncDynamics.AI/`.
- **Secrets used:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (both baked into the bundle).

### Backend → Supabase

- **Workflow:** `.github/workflows/deploy.yml`
- **Trigger:** push to `main` on `supabase/migrations/**`, `supabase/functions/**`, `supabase/config.toml`, plus manual.
- **Job 1 (`db-push`):** repairs known-stale migration states, then `supabase db push --linked --include-all`.
- **Job 2 (`functions-deploy`):** deploys every Edge Function listed in `supabase/config.toml` with `verify_jwt = false`, plus the rest with default `verify_jwt = true`.
- **Smoke:** post-deploy `curl` against `gdpr-audit` and `cookie-scan` to confirm `verify_jwt` config landed (400 = good, 401 = config didn't apply → fail).
- **Secrets used:** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`.

### Supabase project details

- **Project ref:** `ebljyceifhnlzhjfyxup` (referenced in `deploy-frontend.yml` comments)
- **Region:** Frankfurt (`eu-central-1`)
- **Edge Functions count:** 68 (as of 2026-05-16)
- **Migration count:** 97
- **Local config name:** `realsyncdynamics-ai` (in `supabase/config.toml` — used by `supabase start` for local dev, NOT linked to the remote ref)

---

## Ambiguous artifacts

These exist in the repository but their production status is unclear. Keep them, but treat their existence as a debug signal, not a confirmed deployment path.

### `deploy-frontend.yml` — **STATUS: AMBIGUOUS**

This workflow ships `dist/` to `/var/www/realsyncdynamicsai.de/dist` on the VPS via SSH+rsync, with the comment claiming the path is "bind-mounted into the kodee-frontend nginx container."

**However:** the docker-compose at `deploy/ollama-traefik/docker-compose.yml` defines `kodee-ollama`, `kodee-chat`, `kodee-apex` (the redirect router), `kodee-n8n` — there is **no `kodee-frontend` container**. And Traefik's `kodee-apex` middleware 301-redirects every Host(realsyncdynamicsai.de) request to GitHub Pages **before** any static-file backend is consulted.

So either:
1. The shipped `dist/` is dead weight on the VPS and the workflow burns CI minutes for no production effect, OR
2. There is a separate compose file or systemd-managed nginx on the VPS (not in git) that serves these files for some unknown surface.

**Action required from operator:** confirm one of the two. If (1), delete the workflow + `deploy/nginx/realsyncdynamicsai.de.conf`. If (2), commit the missing service definition so the topology is reproducible from the repository.

### `deploy/nginx/realsyncdynamicsai.de.conf` — **STATUS: AMBIGUOUS**

A standalone nginx vhost config that points at `/var/www/realsyncdynamicsai.de/dist`. This **predates** the Traefik+Docker setup — likely from a pre-Traefik era when nginx-on-host served the frontend directly. Same operator-confirm question as above: is anything on the VPS using this config today, or is it reference material?

### `vercel.json` — **DELETED IN THIS PR**

Vite + dist + framework=vite scaffold with a SPA rewrite rule. No `.vercel/` folder, no Vercel project linked, no commits referencing `vercel` in the build pipeline. Pure leftover from an early scaffold; deleting it removes a footgun (someone connecting a Vercel project would deploy a duplicate frontend at a third URL).

---

## Environment variables — what comes from where

### Build-time (baked into the SPA bundle)

| Variable | Defined in | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | GitHub Actions secret | `src/lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | GitHub Actions secret | `src/lib/supabase.ts` |
| `VITE_STRIPE_PRICE_STARTER` | optional, GitHub Actions secret | `src/config/pricing.ts` |
| `VITE_STRIPE_PRICE_GROWTH` | optional, GitHub Actions secret | `src/config/pricing.ts` |
| `VITE_STRIPE_PRICE_AGENCY` | optional, GitHub Actions secret | `src/config/pricing.ts` |
| `VITE_STRIPE_AUDIT_PRO_LINK` | optional, GitHub Actions secret | `src/features/audit/...` |
| `VITE_SENTRY_DSN` | optional | `src/lib/sentry.ts` |
| `VITE_GOOGLE_ADS_*`, `VITE_LINKEDIN_*` | optional | marketing-analytics |
| `VITE_BASE` | `/` for custom-domain Pages, repo-path otherwise | `vite.config.ts` |

### Runtime (Supabase Vault or function env)

| Variable | Used by |
|---|---|
| `OPENAI_API_KEY` | `ai-gateway`, `ai-act-classify`, `governance-agent` |
| `ANTHROPIC_API_KEY` | same |
| `LM_STUDIO_BASE_URL` / `LM_STUDIO_API_KEY` | `ai-gateway` (EU-local LLM path) |
| `STRIPE_SECRET_KEY` | `stripe-checkout`, `stripe-portal`, `stripe-webhook` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` |
| `RESEND_API_KEY` / `POSTMARK_API_TOKEN` | email-sending functions |
| `AI_GATEWAY_IP_HASH_SALT` | `ai-gateway`, `ai-act-classify` (rate-limit) |
| `AGENT_LLM_PROVIDER` / `AGENT_LLM_MODEL` | `governance-agent` |

These are read either via Supabase Vault (`get_app_secret` RPC) or as plain function env vars. The codebase prefers Vault — env is the dev-mode fallback.

---

## Rollback strategy

### Frontend rollback

GitHub Pages deploys are immutable artifacts. To roll back:

```bash
gh run list --workflow=deploy-pages.yml --limit 5
gh run rerun <previous-good-run-id>
```

Or via UI: Actions → Deploy to GitHub Pages → pick the previous good run → "Re-run all jobs."

There is no "blue/green" — Pages serves the latest published artifact. Rollback time = build time + Pages CDN propagation (~2 min total).

### Backend rollback

Supabase migrations are forward-only. Rolling back a migration requires a **new migration that reverses it** — never a `git revert` on the migration file (which would leave production schema-drift).

Edge Functions are atomically replaced per-function on each deploy. To roll back a single function:

```bash
git checkout <previous-good-sha> -- supabase/functions/<function>/
git commit -m "revert(functions): pin <function> to <sha>"
git push
```

The next `deploy.yml` run redeploys that function from the older code while leaving everything else current.

### VPS rollback (Kodee subdomains, Traefik config)

```bash
ssh deploy@187.77.89.1
cd /var/www/kodee-stack
git pull
docker compose down
docker compose up -d
```

There is no automated rollback for the VPS layer — changes here are operator-managed.

---

## Smoke tests after every deploy

| Surface | Smoke command |
|---|---|
| Frontend | `curl -sI -L https://realsyncdynamicsai.de/` → expect `HTTP/2 200` + `server: GitHub.com` |
| Production readiness | `npm run check:production` — fetches 7 critical surfaces |
| Supabase Edge | `deploy.yml` runs gdpr-audit + cookie-scan smoke automatically; for a manual re-check: `curl -X POST -d '{"url":"x"}' https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/gdpr-audit -H content-type:application/json` → expect 400 (NOT 401) |
| Trust + Pilot Readiness | `curl -sI https://realsyncdynamicsai.de/trust` and `/pilot-readiness` → expect 200 |

---

## Migration-trigger thresholds (per ADR 0001)

The current GitHub-Pages-+-Supabase architecture is the documented v1 choice. ADR 0001 lists triggers for moving to a Fastify+Coolify monorepo:

| Trigger | Threshold |
|---|---|
| Paying customers | ≥ 50 |
| Edge-Function timeouts | ≥ 5 % of audit runs |
| Real-browser audit becomes a sales blocker | qualitative |
| Multi-region requirement (DE + IE) | hard customer ask |
| Real-time alerts as Enterprise must-have | hard customer ask |

**Until any trigger fires, this document is the source of truth.** When a trigger does fire, the next iteration of this document SHOULD reference the activation event and link to ADR 0002.

# Infrastructure & Runtime System Check — 2026-05-28

**Verification method:** black-box probes (DNS via local resolver + Cloudflare DoH, HTTP
header probes of every public host, inspection of the live production JS bundle) plus
authenticated reads of Supabase (project status, active API keys, auth logs, security
advisors) and GitHub (open PRs). **No VPS shell access** was available, so anything about
container state, volumes, OpenClaw/SQLite, host port conflicts, or the live Traefik router
table is **inferred from repo config**, not directly observed.

This document records the *measured* live state on 2026-05-28 ~23:10 UTC. Where it
contradicts [`production-runtime.md`](./production-runtime.md), the measurements here are
newer — see "Corrections to prior docs" at the bottom.

---

## TL;DR

| Surface | State | Note |
|---|---|---|
| Frontend `realsyncdynamicsai.de` | ✅ healthy | Served **directly by GitHub Pages** (`server: GitHub.com`), HTTP 200, no VPS hop |
| Supabase `ebljyceifhnlzhjfyxup` | ✅ healthy | `ACTIVE_HEALTHY`, eu-central-1, PG17; bundle key matches an active publishable key |
| **Login (Google OAuth)** | 🟢 recovered | Was failing with `invalid_client`; an Auth config reload ~22:11 fixed it; prod login succeeded 22:14 |
| **Kodee subdomains** (`ollama/chat/n8n`) | 🔴 down | DNS → `187.77.89.1` (the documented VPS) but host is **unreachable** (timeout :80/:443) |
| **Second host** `194.163.130.123` | 🟠 stale? | Answers `nginx 404` (:80) / `503` (:443) — referenced by `ollama-traefik` compose; likely a competing/legacy deployment |

---

## 1. Frontend / DNS topology

```
realsyncdynamicsai.de   A → 185.199.108–111.153   (GitHub Pages)
                        HTTPS → 200, server: GitHub.com, via Fastly   ← NO redirect hop
www.realsyncdynamicsai.de  CNAME → realsyncdynamics-spec.github.io → 301 → apex
public/CNAME = realsyncdynamicsai.de   ·   pipeline deploy-pages.yml (VITE_BASE=/)
```

**Key correction:** a plain `curl -sI https://realsyncdynamicsai.de/` returns **HTTP 200
from GitHub.com directly** — *not* a `301` from a VPS Traefik redirect. The apex A-record
now points straight at the GitHub Pages anycast IPs. The "apex → VPS → `kodee-apex`
Traefik 301 → github.io" flow described in `production-runtime.md` and the
`deploy-pages.yml` header is **no longer how production works**; the `kodee-apex` router in
`deploy/ollama-traefik/docker-compose.yml` is effectively dead code.

## 2. Supabase / Auth

- Project **RealSyncDynamicsLive** (`ebljyceifhnlzhjfyxup`), region **eu-central-1**,
  status **ACTIVE_HEALTHY**, Postgres 17.6. ✅ (correct DSGVO region)
- Production bundle bakes in the URL + `sb_publishable_BqKKWFM8…`. Cross-checked against
  the live key list: that publishable key is **active, not disabled**. The legacy anon JWT
  is also active. → **No stale/mismatched key in the bundle.**
- `src/lib/supabase.ts` is a correct singleton (`detectSessionInUrl`, `autoRefreshToken`).

## 3. Login outage — root cause + resolution

The auth logs are unambiguous:

```
20:53–20:57 UTC  /callback (referer http://localhost:3000)
   ERROR  oauth2: "invalid_client" "The provided client secret is invalid."
   → 500: Unable to exchange external code            ← wrong Google OAuth client secret
~22:09–22:12     "reloading api with new configuration" (×N)   ← Auth provider reconfigured
22:14:02 UTC     /callback (referer https://realsyncdynamicsai.de)
   auth_event login  realsyncdynamics@gmail.com  provider=google  → 302   ✅
22:14:06/07      /user → 200, 200                    ← session valid, login succeeded
```

- **Root cause:** an invalid **Google OAuth client secret** configured in Supabase Auth.
- The `invalid_client` failures originated from **`localhost:3000`** (dev debugging).
- After the ~22:11 config reload, the **production** Google login succeeded at 22:14.
- **Conclusion:** the acute outage appears resolved ~1 h before this check. **Verify** the
  fix is stable and that the **dev/localhost Google client** + the **Auth redirect-URL
  allowlist** were also corrected.

**Latent bug:** `src/lib/auth-redirect.ts` hardcodes `APEX_DOMAIN =
'https://RealSyncDynamicsAI.de'` (mixed case). Magic-link `emailRedirectTo` uses it, and
Supabase's redirect allowlist can match case-sensitively → magic links may break.
**PR #463 (draft) fixes this to lowercase.** Related open auth PRs: **#416** (defensive
OAuth `validation_failed` handling), **#461** (use `getSupabase()` singleton).

## 4. VPS layer — two distinct hosts, both unhealthy for their stated role

The repo references **two different VPS IPs**, and they disagree:

| IP | Referenced in | Live probe |
|---|---|---|
| `187.77.89.1` | `production-runtime.md` (VPS `srv1622293`, rollback ssh) | **Timeout** on :80 and :443 — host unreachable |
| `194.163.130.123` | `deploy/ollama-traefik/docker-compose.yml` comment (Z. 25) | **Up:** `nginx/1.18.0` → 404 (:80), **503** (:443) |

The Kodee subdomains (`ollama/chat/n8n`) resolve (authoritatively, via Cloudflare DoH) to
**`187.77.89.1`** — i.e. DNS matches the *documented* VPS, but that host does not answer.
Meanwhile `194.163.130.123` answers but with a bare `nginx 404` / Traefik-style `503`
(no healthy route/backend). This is the classic "competing/stale deployment" situation:
**the intended kodee-stack host is down, and a second host is serving leftovers.**

> Cannot be resolved from this environment (no SSH). See the runbook below.

## 5. Supabase security advisors

- 🔴 **ERROR** — `security_definer_view`: `public.ai_evidence_retention_status` runs with
  creator rights (bypasses RLS). → switch to `SECURITY INVOKER`.
- 🟡 **WARN** — leaked-password protection disabled; `pg_trgm` / `vector` / `pg_net` in
  `public` schema; many `SECURITY DEFINER` functions executable by `anon`/`authenticated`
  via REST (`is_tenant_member`, `tenant_entitlements`, `admin_customers_list`,
  `admin_system_health`, `affiliate_validate`, …).
- ℹ️ **INFO** — ~12 tables have RLS enabled but **no policy** (`ai_systems`, `ai_policies`,
  `enterprise_*`, …) → effectively service-role-only. Likely intentional; **confirm**.

*(These are reported, not changed — schema changes need explicit sign-off.)*

## 6. GitHub state

- 20 open PRs. Three are auth-related (#463, #416, #461 — see §3).
- Migration timestamp collisions being chased (#438 ready, #441 draft for
  `20260610000000`). A parallel session is pushing ~35 migrations → **coordinate to avoid
  further collisions / drift.**
- `#402` (openclaw Hostinger one-shot setup) and `#335` (infrastructure restructure) touch
  exactly the VPS/DNS area in §4.

---

## VPS investigation runbook (operator, needs SSH)

The two items in §4 are the only **live-critical** problems and both require shell access.

```bash
# 1) Is the intended kodee-stack host alive at all?
ping -c3 187.77.89.1
ssh deploy@187.77.89.1            # if this hangs, the host/firewall is the problem

# On 187.77.89.1 (the documented VPS):
docker ps -a                      # are kodee-ollama / kodee-chat / kodee-n8n running?
docker compose -f /var/www/kodee-stack/docker-compose.yml ps   # adjust path
ss -tlnp | grep -E ':(80|443|11434|5678|8080)'   # who listens?
docker logs --tail=100 traefik    # why no route / cert?

# 2) What is 194.163.130.123 and why does it answer 503?
ssh root@194.163.130.123
docker ps -a ; ss -tlnp | grep -E ':(80|443)'
nginx -t ; systemctl status nginx # is host-nginx the 404/:80?
# 503 on :443 = a reverse proxy with no healthy upstream. Identify it and decide:
#   keep (and point subdomains here) OR decommission (stale parallel deployment).

# 3) Decide the canonical VPS IP and make repo + DNS agree:
#    - production-runtime.md says 187.77.89.1
#    - ollama-traefik/docker-compose.yml comment says 194.163.130.123
#    Pick one, update the other, then verify:
curl -sI --resolve ollama.realsyncdynamicsai.de:443:<IP> https://ollama.realsyncdynamicsai.de/
```

**Do NOT** run `docker compose up`, `restart`, `prune`, `rm`, or rotate secrets until the
two-host question is answered — you could promote the stale deployment by accident.

---

## Corrections to prior docs

`production-runtime.md` (last verified 2026-05-16) is partially superseded by the live
measurements here:

1. The apex **no longer flows through a VPS Traefik 301** — it resolves directly to GitHub
   Pages and returns 200 from `GitHub.com`. The "How a request flows" diagram (VPS →
   `kodee-apex` → 301 → Pages) is stale.
2. The Kodee-subdomain host (`187.77.89.1`) is currently **unreachable**, and a second host
   (`194.163.130.123`) answers in its place — the IP references across the repo conflict.

A banner pointing here has been added to `production-runtime.md` and the `deploy-pages.yml`
header. The routing config itself was left untouched (behavioral change → needs sign-off).

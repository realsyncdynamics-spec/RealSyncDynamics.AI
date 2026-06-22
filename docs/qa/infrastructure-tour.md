# Infrastructure-Tour — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Quellen: `_headers`, `_redirects`, `wrangler.toml`, `vercel.json`, `index.html`, `public/robots.txt`, `public/sitemap.xml`, `.github/workflows/*`, `deploy/*`, `supabase/config.toml`, `scripts/vps-backup.sh`.

## Deployment-Topologie

| Komponente | Befund | Status |
|---|---|---|
| **Primary Frontend** | **GitHub Pages** (`deploy-pages.yml` = „Primary production frontend pipeline"), `public/CNAME` → `realsyncdynamicsai.de`, Fastly-CDN | VERIFIED |
| Vercel | `vercel.json` vorhanden (Rewrites + Security-Header) — alternativer/sekundärer Target | PARTIAL |
| Cloudflare Pages | `_redirects` + `wrangler.toml` (minimal) vorhanden, aber **nicht die aktive Pipeline** | NOT_VERIFIABLE_FROM_REPO |
| VPS (Hostinger EU) | Backend-Subdomains `chat.`/`ollama.`/`n8n.`; optionaler rsync-Fallback fürs Frontend (non-blocking) | VERIFIED |
| Supabase | Auth + Postgres (RLS) + 87 Edge Functions + Storage; Region in `index.html` als Frankfurt dokumentiert | VERIFIED (Region: doc-level) |

> **Korrektur zur Aufgabenannahme:** Die Aufgabe nennt „Cloudflare Pages". Tatsächlich ist die **aktive** Production-Pipeline **GitHub Pages** (`deploy-pages.yml`). Cloudflare- und Vercel-Configs existieren parallel als Fallback/Option.

## SPA-Fallback

| Host | Mechanismus | Status |
|---|---|---|
| GitHub Pages | `index.html` Deep-Link-Restore-Script + 404-Pattern | VERIFIED |
| Vercel | `rewrites: /(.*) → /index.html` | VERIFIED |
| Cloudflare | `_redirects: /*  /index.html  200` | VERIFIED |
| nginx (VPS) | `try_files … /index.html` | VERIFIED |

## Security-Header

**`public/_headers`:**
```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

| Header | Status | Anmerkung |
|---|---|---|
| HSTS (preload) | VERIFIED | 1 Jahr, includeSubDomains |
| X-Frame-Options / frame-ancestors | VERIFIED | SAMEORIGIN + CSP `frame-ancestors 'self'` |
| X-Content-Type-Options | VERIFIED | nosniff |
| **CSP** | **PARTIAL / RISK** | CSP via `index.html`-Meta; nutzt **`unsafe-inline`** (Script+Style). nginx-Variante etwas strenger (`script-src 'self' https://js.stripe.com 'unsafe-inline'`). |

> **CSP-Header werden über `_headers` NICHT gesetzt** — nur per HTML-Meta. Auf GitHub Pages sind `_headers` ohnehin wirkungslos (das ist ein Cloudflare-Pages-Format). **RISK:** Auf GitHub Pages greifen die `_headers`-Security-Header möglicherweise gar nicht. Header-Durchsetzung am tatsächlichen Production-Host verifizieren.

## robots.txt / sitemap

| Datei | Status | Inhalt |
|---|---|---|
| `public/robots.txt` | VERIFIED | blockt `/admin/`, `/settings/`, `/dashboard`; erlaubt AI-Crawler (GPTBot, ClaudeBot, PerplexityBot, Google-Extended). **`/os/`-Prototyp nicht explizit ausgeschlossen — prüfen.** |
| `public/sitemap.xml` | VERIFIED | ~621 URLs, priority 0.4–1.0 |

## CI/CD (`.github/workflows/`, 15 Workflows)

| Workflow | Zweck |
|---|---|
| `ci.yml` | Typecheck (`tsc`), Unit-Tests, Build; Migrations als append-only erzwungen |
| `e2e.yml` | Playwright-Smoke (Frontend-Pfade) |
| `deploy-pages.yml` | **Primary**: Build + GitHub-Pages-Publish |
| `deploy.yml` | Migrations push + Edge-Functions deploy |
| `deploy-frontend.yml` | optionaler rsync zum VPS |
| `vps-backup.yml` | täglicher VPS-Backup-Cron |
| `migration-drift.yml`, `edge-function-drift.yml` | Drift-Erkennung |
| `cta-enforcement.yml` | verbotene CTA-Phrasen — **Scope nur `src/pages` + `src/components`** (Lücke, s. Button-Report) |
| `pre-deploy-check.yml`, `backend-services-ci.yml`, `enable-leaked-password-protection.yml`, `ssh-setup.yml`, `tracker-db-update.yml` | weitere Ops |

> **Befund:** `ci.yml` ruft `tsc` — der aktuelle Stand hat **16 TS-Fehler** (s. `final-platform-audit-report.md`). Build (`vite build`) ist davon unberührt (esbuild typecheckt nicht), CI-`tsc` sollte aber rot sein.

## VPS-Stack (`deploy/ollama-traefik/`)
- **Traefik** (TLS via Let's Encrypt, BasicAuth-Middleware), **Ollama** (`gemma3:4b`, Telemetrie aus, EU-lokal), **Open WebUI** (`chat.`), **n8n** (geplante Workflows). EU-souveräne lokale Inferenz.

## Backup / Restore
- `scripts/vps-backup.sh`: tägliches `tar.gz` nach `/var/backups/realsyncdynamicsai/`, **7 Tage Retention**, umfasst Web-Root + nginx + deploy.
- **MISSING:** Postgres-PITR/DB-Backup-Strategie (Supabase-managed, nicht im Repo verifizierbar); **kein dokumentierter Restore-Drill**; keine Cross-Region-Replikation. → `missing-features-report.md` P2.

## Statusübersicht

| Aspekt | Status |
|---|---|
| Custom Domain / DNS / SSL | VERIFIED (CNAME + Let's Encrypt/Fastly) |
| Build Command / Output Dir | VERIFIED (`vite build` → `dist/`) |
| SPA-Fallback | VERIFIED |
| Security-Header-Setzung am Host | RISK (`_headers`-Format ≠ GitHub Pages) |
| CSP ohne unsafe-inline | RISK (unsafe-inline aktiv) |
| robots/sitemap | VERIFIED |
| Edge Functions / Supabase | VERIFIED |
| DB-Backup/PITR/Restore-Drill | MISSING / NOT_VERIFIABLE_FROM_REPO |
| CI/CD | VERIFIED (mit `tsc`-Rotstand-Befund) |

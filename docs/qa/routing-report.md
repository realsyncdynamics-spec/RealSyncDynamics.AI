# Routing-Report — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · `e2e/routing.spec.ts` gegen Production-Build (:4173).

## E2E-Ergebnis

| Testgruppe | Tests | Ergebnis |
|---|---|---|
| Öffentliche Routen rendern (kein 404-Fallback) | 19 | ✅ alle grün |
| 404-Verhalten (Unsinns-Pfad → NotFound) | 1 | ✅ grün |
| SPA-Deep-Link + Reload (kein Server-404) | 1 | ✅ grün |
| Pricing → Checkout-Navigation | 1 | ✅ grün |

Geprüfte Routen u. a.: `/`, `/pricing`, `/audit`, `/tools`, `/about`, `/ai-act`, `/evidence`, `/monitoring`, `/agents`, `/legal/privacy`, `/impressum`, `/legal/terms`, `/legal/avv`, `/contact-sales`, `/partners`, `/integrations/shopify`, `/checkout/starter`, `/checkout/success`, `/checkout/cancelled`.

## SPA-Fallback / Deep-Links

| Host | Fallback-Mechanismus | Status |
|---|---|---|
| GitHub Pages (Primary) | `public/404.html`-Pattern + Deep-Link-Restore-Script in `index.html` | VERIFIED (Config) |
| Vercel | `vercel.json` → `rewrites: [{ source:"/(.*)", destination:"/index.html" }]` | VERIFIED (Config) |
| Cloudflare Pages | `_redirects`: `/*  /index.html  200` (liegt in `dist/`) | ⚠️ **LIVE-PROBE: GREIFT NICHT** — siehe R4 |
| nginx (VPS-Fallback) | `try_files $uri $uri/ /index.html` | VERIFIED (Config) |

Direkter Aufruf + Reload auf `/pricing` liefert im **Vite-Preview-Server** 200 + clientseitiges Render — kein Server-404.

**Live-Probe (2026-06-22) gegen Cloudflare-Pages-Deployments** (prod `realsyncdynamics-ai.pages.dev`, Hash- und Branch-Alias):

| URL | Root `/` | Deep-Link `/pricing`, `/audit` |
|---|---|---|
| `realsyncdynamics-ai.pages.dev` | **200** | **404** |
| `bcf8bb96.realsyncdynamics-ai.pages.dev` | 200 | **404** |
| `claude-gallant-brown-o7ci7m.…pages.dev` | 200 | **404** |

Trotz korrektem `dist/_redirects` (`/*  /index.html  200`) liefern Deep-Links auf Cloudflare **HTTP 404** und servieren das `dist/404.html` (GitHub-Pages-Shim: `window.location.replace('/?_path=…')`). Ein JS-fähiger Browser landet danach via Client-Redirect doch in der App — **aber** der HTTP-Status ist 404 (schlecht für SEO/Crawler/Prerender) und der saubere `_redirects`-200-Rewrite greift **nicht**. Der `_redirects`-Catch-all wird durch die Anwesenheit von `404.html` ausgehebelt. Siehe **R4**.

## Auth- / Tenant-Verhalten

- `/login`, `/signin`, `/signup`, `/register` → Redirect `/welcome` (zentrale Auth-Einstiegsseite).
- `/app/*` ist in `GovernanceBrowserShell` gewrappt; Auth-Durchsetzung auf Komponenten-Ebene (`AuthGate`), sensible Aktionen zusätzlich `RequireAal2` (Billing, Team, Evidence-Export).
- **Nicht im unauthentifizierten E2E prüfbar:** der tatsächliche Auth-Redirect von `/app/*` (benötigt Supabase-Session). Manuell/mit Test-Login zu verifizieren — siehe Workflow-Matrix „Admin Funnel".

## Befunde

| # | Befund | Schwere | Empfehlung |
|---|---|---|---|
| R1 | **Duplizierte Route `/app/agents`** in `src/App.tsx` (zwei Definitionen). Die zweite ist toter Code. | NIEDRIG (P3) | Eine Definition entfernen, Zielkomponente final festlegen (`GovernanceAgentsCenterView` vs. `AgentsOverviewPage`). |
| R2 | 318 eindeutige Pfade, viele Aliase. | INFO | Konsistenz-Tests für Preis/Claim über Shared-Shells beibehalten. |
| R3 | `/os/*`-Prototyp ist öffentlich erreichbar (Mockdata). | NIEDRIG | Hinter Feature-Flag / `noindex` legen (robots deckt `/os` aktuell nicht explizit ab — prüfen). |
| R4 | **Cloudflare-Pages SPA-Deep-Links liefern HTTP 404** (prod + preview), trotz korrektem `dist/_redirects`. `dist/404.html` (GitHub-Pages-Shim) hebelt den `_redirects`-200-Rewrite aus. Browser landen via JS-Redirect dennoch in der App, aber Status = 404. | MITTEL (P2) | Host-Strategie klären (siehe `infrastructure-tour.md`): Falls Cloudflare Pages kanonisch wird → `404.html` aus dem CF-Build entfernen ODER `_routes.json` ergänzen, damit `_redirects` greift. Falls GitHub Pages kanonisch → CF-Befund akzeptieren/CF deaktivieren. **Nicht durch diesen PR verursacht.** |
| R5 | **Custom-Domain `realsyncdynamicsai.de` liefert HTTP 500** auf allen Pfaden (Edge = Cloudflare, `cf-cache-status: DYNAMIC`). | **HOCH (P1) — Produktions-Health** | Live-Domain errort. Origin/Worker/Pages-Function-Konfiguration prüfen. **Nicht durch diesen PR verursacht** (PR-Branch ist nicht auf die Prod-Domain deployt). Vor jedem Merge/Go-Live verifizieren. |

## 404-Verhalten
`path="*"` → `NotFoundPage` als letzte Route. E2E bestätigt: Unsinns-Pfad rendert NotFound-Marker; gültige Pfade nicht.

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
| Cloudflare Pages | `_redirects`: `/*  /index.html  200` (404.html im CF-Build entfernt) | ✅ **FIX VERIFIED** — Deep-Links = 200 (siehe R4) |
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
| R4 | **Cloudflare-Pages SPA-Deep-Links liefern HTTP 404** (prod + preview), trotz korrektem `dist/_redirects`. `dist/404.html` (GitHub-Pages-Shim) hebelt den `_redirects`-200-Rewrite aus. Browser landen via JS-Redirect dennoch in der App, aber Status = 404. | MITTEL (P2) — **✅ BEHOBEN & VERIFIZIERT** | **FIX (PR #668):** host-aware Post-Build `scripts/cf-pages-cleanup.mjs` (npm-`postbuild`) entfernt `dist/404.html` **nur** im Cloudflare-Build (`CF_PAGES=1`), sodass `_redirects` `/*  /index.html  200` greift. GitHub Pages behält `404.html`. **Live-Probe gegen CF-Build `c5341f39` (commit f5a73ed):** `/pricing` → **200**, `/audit` → **200**, Body = echte App-Shell (`<title>RealSyncDynamics.AI…`, `id="root"`). Vorher 404. |
| R5 | **Custom-Domain `realsyncdynamicsai.de` liefert HTTP 500** (`/`, `/health`; `/index.html` → 308). Edge = Cloudflare (`cf-ray`, NEL, `cf-cache-status: DYNAMIC`), **leerer Body** = Worker-Exception-Signatur. **Wichtig: Das Pages-Deployment selbst ist gesund** — `realsyncdynamics-ai.pages.dev` liefert Root **200**. Es ist also **nur das Custom-Domain-Routing** defekt, nicht der Build. **Root-Cause-Lead:** einziger Worker im CF-Account `realsyncdynamics` ist ein **Platzhalter-Stub** (`return new Response("Hello world")`); Apex ist vermutlich auf diesen Stub/fehlerhaften Worker geroutet statt auf das gesunde Pages-Projekt. `www.` → 301. | **HOCH (P1) — Produktions-Health** | **Nicht aus dem Repo behebbar** — CF-Dashboard/DNS/Custom-Domain-Routing. Apex-Domain als Custom-Domain an das gesunde Pages-Projekt `realsyncdynamics-ai` hängen **oder** den Stub-Worker `realsyncdynamics` durch die echte App ersetzen/dessen Route entfernen. **Nicht durch diesen PR verursacht.** Prod-Infra wurde **nicht** verändert (nur read-only untersucht). **Mess-Caveat:** Probe lief über das TLS-interceptende Egress-Gateway der Sandbox (Cert-Issuer `O=Anthropic, Egress Gateway SDS Issuing CA`); echte Cloudflare-Header + reale Response-Bodies bestätigen jedoch, dass die 500/200-Antworten vom echten Upstream stammen. Finale Bestätigung idealerweise von einem externen Netz.<br>**Eingrenzung (read-only):** (a) **keine** Pages-Functions im Repo (`functions/` fehlt, kein `_worker.js`) → 500 ist **kein** Pages-Function-Fehler; (b) **Asymmetrie**: dieselbe Prod-Deployment liefert `pages.dev`=200, Apex=500, und `Apex /index.html`→308→`/` (Pages-Clean-URL-Redirect) → Requests erreichen die Pages-Ebene, aber `/` 500t **nur am Apex-Hostnamen**. ⇒ Fehler liegt in der **Custom-Domain-Anbindung / einer Worker-Route auf dem Apex**, nicht im Build/Content. **Dashboard-Checks (durch Betreiber):** CF → Workers&Pages → Worker `realsyncdynamics` → *Triggers/Routes* (Apex-Route entfernen) **und** Pages-Projekt `realsyncdynamics-ai` → *Custom domains* (`realsyncdynamicsai.de` als aktive Custom-Domain anhängen). DNS-/Route-/Custom-Domain-APIs sind über die hier verfügbaren MCP-Tools **nicht** einsehbar. |

## 404-Verhalten
`path="*"` → `NotFoundPage` als letzte Route. E2E bestätigt: Unsinns-Pfad rendert NotFound-Marker; gültige Pfade nicht.

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
| GitHub Pages (Primary) | `public/404.html`-Pattern + Deep-Link-Restore-Script in `index.html` | VERIFIED |
| Vercel | `vercel.json` → `rewrites: [{ source:"/(.*)", destination:"/index.html" }]` | VERIFIED |
| Cloudflare-Format | `_redirects`: `/*  /index.html  200` | VERIFIED (Config vorhanden) |
| nginx (VPS-Fallback) | `try_files $uri $uri/ /index.html` | VERIFIED |

Direkter Aufruf + Reload auf `/pricing` liefert im Preview-Server 200 + clientseitiges Render — kein Server-404. **In Production hängt das korrekte Verhalten vom tatsächlichen Host ab** (GitHub Pages: über `404.html`-Restore; siehe `infrastructure-tour.md`).

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

## 404-Verhalten
`path="*"` → `NotFoundPage` als letzte Route. E2E bestätigt: Unsinns-Pfad rendert NotFound-Marker; gültige Pfade nicht.

# TARGET PLATFORM OS — Ist vs Soll

Stand: 2026-08-28. Ergänzt `docs/ARCHITECTURE_CURRENT.md`, ersetzt es nicht.

## Satz

RealSyncDynamics.AI ist die Plattform, auf der Unternehmen KI-Anwendungen,
Websites, Agents und Automationen **bauen, betreiben und gouvernieren**.

CREATE → DEPLOY → OPERATE → GOVERN → PROVE

Experience: **AI Governance + AI Application OS**.
Pricing-SSoT bleibt `PRODUCT_POSITIONING = AI Governance Runtime`.

## Ist

- Vite/React SPA, Domain realsyncdynamicsai.de
- Supabase EU, Auth Magic Link, RLS, Edge Functions
- `shared/pricing.ts` einzige Preis-/Limit-Quelle
- Plans: free 0 · starter 79 · growth 249 · agency 699 (legacy) · enterprise 1249 · partner 1999 (legacy)
- SiteOS: Brief → Blueprint → Hash → Prüfung → Score
- Evidence Vault mit Hash-Chain
- Bots: website / WhatsApp / Voice als Module + Add-ons

## Soll in diesem Branch

| Ebene | Inhalt | Stand |
|---|---|---|
| CREATE | Landing, Web App, Design | Copy + SiteOS-Hook |
| OPERATE | Chat, WA, Voice, Workflows | Aus/Test/Live + fail-closed Gate |
| GOVERN | Policy, Risk, Evidence, Audit | existiert |
| WORKSTORE | Governante Packs | Stub `support-agent` |

Infrastruktur-Soll: Cloudflare Edge + Supabase EU.
Workers for Platforms = ADR 0011, kein Code.

## Pricing-Logik (SSoT unverändert)

- Starter 79 €: Keil. 1 Domain, Web-Chat, Nachweis.
- Growth 249 €: Betrieb. Kanäle, Drift, 3 Domains.
- WhatsApp auf Starter = Add-on 99 €. Ab Growth im Plan, Meta extra.
- Voice = Add-on + Minuten.
- Weitere Domain = Bookable Module 19 €.
- Agency/Partner legacy. Nicht still reaktivieren.

Teurer wird es bei WhatsApp live, Telefon, zweiter Domain, Verbrauch, mehreren Mandanten.

## Einstieg

Scan (`/audit`) → `/start` (Q&A) → Checkout oder `/app/channels`.
Dashboard-Kanäle: Aus | Test | Live. Live fail-closed.

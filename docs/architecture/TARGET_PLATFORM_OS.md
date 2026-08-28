# TARGET PLATFORM OS — Ist vs Soll

Stand: 2026-08-28. Ergänzt `docs/ARCHITECTURE_CURRENT.md`, ersetzt es nicht.

## Satz

RealSyncDynamics.AI ist die Plattform, auf der Unternehmen KI-Anwendungen,
Websites, Agents und Automationen **bauen, betreiben und gouvernieren**.

CREATE → DEPLOY → OPERATE → GOVERN → PROVE

Positionierung der Experience-Ebene: **AI Governance + AI Application OS**.
Die Pricing-SSoT bleibt `PRODUCT_POSITIONING = AI Governance Runtime`.

## Ist (nicht anfassen)

- Vite/React SPA, Domain realsyncdynamicsai.de
- Supabase EU, Auth Magic Link, RLS, Edge Functions
- `shared/pricing.ts` als einzige Preis-/Limit-Quelle
- Plans: free 0 · starter 79 · growth 249 · agency 699 (legacy) · enterprise 1249 · partner 1999 (legacy)
- SiteOS (`packages/siteos-core`): Brief → Blueprint → Hash → Prüfung → Score
- Evidence Vault mit Hash-Chain
- Bots: website / WhatsApp / Voice als Module + Add-ons

## Soll

Vier Ebenen über der bestehenden Control Plane:

| Ebene | Inhalt | Status in diesem PR |
|---|---|---|
| CREATE | Landing, Web App, Design/Image | Copy + SiteOS-Hook |
| OPERATE | Chat, WA, Voice, Workflows | Schalter-Modell spezifiziert |
| GOVERN | Policy, Risk, Evidence, Audit | existiert |
| WORKSTORE | Governante Packs, kein ZIP-Template | Stub |

Infrastruktur-Soll: Cloudflare Edge (Workers, R2, WAF) + Supabase EU.
Workers for Platforms = ADR, kein Code in diesem Stand.

## Pricing-Logik (unverändert in der SSoT)

- Starter 79 €: Keil. 1 Domain, Web-Chat, Nachweis.
- Growth 249 €: Betrieb. Kanäle, Drift, 3 Domains.
- WhatsApp auf Starter = Add-on 99 €. Ab Growth im Plan, Meta extra.
- Voice = Add-on + Minuten.
- Weitere Domain = Bookable Module 19 €.
- Agency/Partner bleiben legacy. Nicht still reaktivieren.

## Einstieg

Scan (`/audit`) → `/start` (Q&A) → Checkout/Dashboard.
Dashboard-Kanäle: Aus | Test | Live. Live fail-closed (Checkliste + Art. 50).

## Was Claude Code als Nächstes baut

Siehe `docs/product/CLAUDE_CODE_CONTINUE.md`.

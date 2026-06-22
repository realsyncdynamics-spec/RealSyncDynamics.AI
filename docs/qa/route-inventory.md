# Route-Inventory — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Quelle: `src/App.tsx` (statischer Scan) · Branch `claude/gallant-brown-o7ci7m`

## Kennzahlen

| Metrik | Wert |
|---|---|
| `<Route>`-Elemente in `src/App.tsx` | **321** |
| Eindeutige `path="…"`-Werte | **318** |
| Router | `react-router-dom` 7, ein `<BrowserRouter>` |
| Catch-all / 404 | `path="*"` → `NotFoundPage` (letzte Route) |
| Lazy-Loading | aktiv für auth-gegatete Features (`React.lazy`) |
| Globale Wrapper | `<ScrollToTop>`, `<CookieConsent>`, `<AssistentChip>`, `useTrackPageview()` |

## Route-Cluster (Auswahl, gruppiert)

### Öffentlich / Marketing (kein Auth-Gate)
- Einstieg: `/` (`PublicWorkspacePreview`), `/preview`, `/landing`, `/realsync-landing`
- Pricing/Checkout: `/pricing`, `/checkout/:planKey`, `/checkout/success`, `/checkout/cancelled`
- Governance-Content (öffentlich, edukativ): `/governance-browser`, `/runtime`, `/monitoring`, `/agents`, `/evidence`, `/ai-act`, `/docs`
- Gratis-Tools (kein Account): `/audit`, `/audit/share/:token`, `/audit/result/:auditId`, `/cookie-scanner`, `/avv-generator`, `/vvt-wizard`, `/ai-act-klassifikator`, `/tom-generator`, `/dsfa-wizard`, `/datenschutz-generator`, `/datenpanne-meldung`, `/bussgeld-rechner`, `/tools` (+ `/tools/*`-Aliase)
- Branchen-Landings: `/fuer-saas`, `/fuer-agenturen`, `/fuer-praxen`, `/kanzleien`, `/arztpraxen`, `/healthtech`, `/legal-tech`, `/fintech`, `/oeffentliche-verwaltung`, `/versicherungen`, `/ecommerce`, `/hr-software`, `/bildung`, `/steuerberater` (+ Aliase)
- Competitor-Doorways: `/onetrust-alternative`, `/usercentrics-alternative`, `/dataguard-alternative`, `/borlabs-alternative`, `/cookiebot-alternative`, `/proliance-alternative`, `/iubenda-alternative`
- SEO-Doorways: `/bait-compliance`, `/marisk-audit`, `/eu-ai-act-check`, `/cookie-compliance`, `/continuous-compliance`, `/ai-act-readiness`, `/dsgvo-tool-vergleich`, …
- Trust/Brand: `/about`, `/manifest`, `/press`, `/security`, `/trust`, `/pilot-readiness`, `/status`, `/limits`, `/changelog`, `/roadmap`, `/faq`
- Lead/Kontakt: `/contact-sales` (einzige sanktionierte Kontakt-CTA-Zielseite), `/case-studies`, `/ressourcen`, `/blog`
- Partner/Integration: `/partners`, `/integrations/shopify`, `/shopify/success`, `/shopify/error`, `/integrations`, `/developers`, `/api`, `/api-docs`
- Legal: `/legal/privacy` (+`/datenschutz`), `/impressum`, `/legal/terms` (+`/agb`), `/legal/avv`, `/legal/compliance-matrix`, `/legal/methodology`, `/legal/sub-processors`
- Auth-Entry-Redirects: `/login`, `/signin`, `/signup`, `/register` → Redirect `/welcome`

### Authentifizierte App (`GovernanceBrowserShell`-Wrapper, Auth auf Komponenten-Ebene)
`/app`, `/app/home`, `/app/company`, `/app/websites`, `/app/ai-systems`(+`/agents`), `/app/risks`, `/app/compliance`, `/app/risk-inventory`, `/app/evidence`(+`/auditor` mit `RequireAal2`), `/app/audit`, `/app/monitoring`(+`/sources`), `/app/alerts`, `/app/dpia`, `/app/dsr`, `/app/incidents`, `/app/remediation`(+`/:planId`), `/app/keys`, `/app/vvt`, `/app/webhooks`, `/app/connectors`, `/app/mappings`, `/app/onboarding`, `/app/approvals`, `/app/admin-log`, `/app/policies/templates`, `/app/vendors`, `/app/costs`, `/app/scans`(+`/:scanId`), `/app/analytics`, `/app/events/:eventId`, `/app/assets/:assetId`, `/app/automations`, `/app/workflows`, `/app/documents`, `/app/billing`(`RequireAal2`), `/app/team`(`RequireAal2`), `/app/settings`(+`/team`, `/integrations/telegram`), `/app/reports`, `/app/agents/*` (automation/support/susi/screenshot)

### Legacy-Redirects (`/governance/* → /app/*`, `/dashboard → /app`)
~25 Kompatibilitäts-Redirects (`replace`), z. B. `/governance/keys → /app/keys`, `/governance/dpias → /app/dpia`, `/governance/risk-inventory → /app/risk-inventory`.

### Operations & Finance (auth-gegated, special purpose)
`/operations`, `/operations/inventory|items|stock-movements|suppliers|locations|barcodes|reports`; `/finance`, `/finance/tax-evidence|documents|year/:year|exports|reminders|reviews`.

### Enterprise-OS-Prototyp `/os/*` (Phase 1–4, **Mockdata, kein Backend**)
`/os`, `/os/login`, `/os/signup`, `/os/pricing`, `/os/audit`, `/os/ai-act`, `/os/agencies`, `/os/checkout`, `/os/app` + `/os/app/*` (websites/risks/compliance/evidence/monitoring/…). **Nicht auf dem produktiven Nutzerpfad** — reines UI-Prototyping mit `src/enterprise-os/mock/data.ts`.

## Auffälligkeiten
1. **Duplizierte Route** `/app/agents` (zwei `<Route>`-Definitionen, `src/App.tsx` ~Z. 515 & 519) — die zweite ist toter Code (React Router nimmt die erste). Siehe `routing-report.md`.
2. **Hohe Doorway-Dichte**: Sehr viele SEO-/Branchen-/Competitor-Aliase. Wartungs- und Konsistenzrisiko (Preise, Claims), aber funktional sauber via gemeinsame Landing-Shells.
3. **`/os/*`-Prototyp** rendert Mockdata-Preise und eine verbotene CTA (`Vertrieb kontaktieren`, siehe Button-Report). Klar als Prototyp markieren oder hinter Flag legen.

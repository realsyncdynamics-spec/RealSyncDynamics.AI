# 100-Punkte-Plan zum Ziel

> **Ziel:** RealSyncDynamics.AI von „Kern steht, Audit-MVP läuft" zu einer **marktreifen, umsatztragenden EU-souveränen Compliance-Infrastruktur** führen — mit nachweisbarer Auto-Remediation, kontinuierlichem Monitoring, gerichtsfester Evidence und skalierbarem Agency/Enterprise-Geschäft.
>
> Geerdet auf dem aktuellen Stand (`ROADMAP.md`, `supabase/functions/`, `src/`). Jeder Punkt ist ein abschließbares Ergebnis (Definition of Done implizit: getestet, RLS-sicher, geloggt in `ai_tool_runs`/`workflow_runs`).
>
> Legende: ✅ erledigt · 🟡 teilweise · ⬜ offen

---

## A — Runtime & Kern härten (1–10)

1. ⬜ Event-Schema `governanceEvents.ts` mit Versionierung (`v1`) einfrieren und Schema-Drift-Test in CI ergänzen.
2. ⬜ Evidence-Hashing (`evidence.ts`) gegen Golden-Testvektoren absichern (kanonisches JSON ↔ SHA-256 deterministisch).
3. ⬜ Agent-Contracts (`core/runtime/types.ts`) als Single Source of Truth dokumentieren + Breaking-Change-Lint.
4. ⬜ Remediation-Layer (`remediation.ts`) vom Skelett zu typisierten, idempotenten Aktionen ausbauen.
5. ⬜ Einheitliches Error-/Result-Pattern für alle Edge Functions (`_shared/result.ts`).
6. ⬜ Strukturiertes Logging + Korrelations-ID über alle Functions (Sentry-Breadcrumbs).
7. ⬜ Rate-Limiting & Idempotency-Keys für öffentliche Functions (`cookie-scan`, `gdpr-audit`, `sales-lead`).
8. ⬜ Edge-Function-Drift-Check (`check:edge-functions`) verpflichtend in CI-Gate.
9. ⬜ `check:production` als Pflicht-Gate vor jedem Release grün halten.
10. ⬜ Migrations-Hygiene: Duplikate bereinigen, Namens-/Timestamp-Konvention erzwingen (Lint-Skript).

## B — Audit-Engine & Scanner (11–22)

11. ✅ `cookie-scan` (server-side fetch, Free-Tool).
12. ✅ `gdpr-audit` (Lead-Magnet, vollständiger Audit).
13. ✅ Rule Engine (`_shared/rules/evaluator.ts` + `gdpr.json` + `ai-act.json`).
14. ✅ Tracker-Registry (`tracker-registry.json`).
15. ⬜ **Playwright-Scanner-Microservice** (`deploy/playwright-scanner/`) deployen (echtes Headless-Browsing).
16. 🟡 `cookie-scan-deep` produktiv schalten (nutzt Playwright statt fetch).
17. ⬜ **Consent-Timing-Analyse**: Welche Requests/Tracker laden VOR Consent? (Kern-Differenzierer).
18. ⬜ Security-Header-Analyse (CSP, HSTS, X-Frame-Options) in Score aufnehmen.
19. ⬜ Tracker-Registry laufend pflegen (Fingerprints für Top-200-Tools, automatisierte Updates).
20. ⬜ Compliance-Score-Algorithmus dokumentieren & versionieren (nachvollziehbare Gewichtung).
21. ⬜ Scanner-Genauigkeit gegen kuratiertes Test-Set messen (Precision/Recall-Dashboard).
22. ⬜ Multi-Page-/Sitemap-Crawl statt nur Startseite (konfigurierbare Tiefe).

## C — Reporting & Lead-Funnel (23–30)

23. ✅ `audit-report-pdf` (druckoptimierter HTML-Report).
24. 🟡 `audit-report-email` — Report automatisch nach Scan zustellen (End-to-End verifizieren).
25. ✅ `audit-drip-cron` / `audit-monitor-cron` / `audit-recheck-weekly` (Drip & Re-Scan).
26. ⬜ Free-Audit-Landing als viraler SEO-Funnel optimieren (Core Web Vitals, Schema.org).
27. ⬜ Public Compliance-Score-Badge („Geprüft von RealSync") als Embed/Backlink-Hebel.
28. ⬜ Report-Sharing per Token-Link (read-only, ablaufend) ausbauen.
29. ⬜ Conversion-Tracking Free → Starter (`track-pageview`, `marketing-event`) instrumentieren.
30. ⬜ A/B-Tests für Audit-CTA & Pricing-Page (Feature-Flag-gesteuert).

## D — Auto-Remediation (31–40)

31. ✅ Google-Fonts-Self-Hosting (`_shared/website-rebuild/self-host.ts`).
32. ✅ Tracker-Removal (`strip-trackers.ts`).
33. ✅ Consent-SDK-Injection (`inject-consent.ts`).
34. ⬜ **RealSync CMP**: Cookie-Banner mit Opt-In-Logik + „Alle ablehnen"-Button.
35. ⬜ Script-Blocking-Standard (`type="text/plain" data-consent="…"`) als Default-Pattern.
36. ⬜ Formular-Absicherung (Consent-Checkbox + Datenschutzhinweis automatisch).
37. ⬜ CSP-Templates generieren und injizieren.
38. ⬜ `rebuild-website` / `checkout-website-rebuild`: 8-Step-Pipeline End-to-End härten.
39. ⬜ Vorher/Nachher-Diff jeder Remediation als signiertes Evidence-Artefakt speichern.
40. ⬜ Rollback-Mechanismus für jede Auto-Fix-Aktion (sichere Reversibilität).

## E — Continuous Monitoring (41–48)

41. ✅ `governance-monitoring-scheduler` + Monitoring-Cron.
42. ✅ AlertsView / MonitoringSourcesView / RiskCenterView (Governance-OS-Frontend).
43. ⬜ **Drift Detection**: „Marketing hat Hotjar eingebaut" automatisch erkennen.
44. ⬜ Webhook-Notifications bei neuen Trackern (`governance-webhooks`) end-to-end.
45. ⬜ Compliance-Delta (Vorher/Nachher) pro Scan-Lauf visualisieren.
46. ⬜ Konfigurierbare Scan-Frequenz pro Plan (täglich/Stunden für Enterprise).
47. ⬜ Eskalations-Routing: Alert → E-Mail/Telegram/Slack/Webhook (`telegram-*`).
48. ⬜ SLA-/Uptime-Monitoring des Scanners selbst (Self-Health, `health`).

## F — Evidence Vault & Nachweisbarkeit (49–56)

49. ✅ `evidence-export` / `evidence-vault-export` Grundlage.
50. ⬜ HAR-Files + Screenshots pro Scan archivieren (Supabase Storage EU).
51. ⬜ Consent-Logs (DSGVO Art. 7: Nachweis der Einwilligung) speichern & exportieren.
52. ⬜ Audit-Trail-PDF mit Zeitstempel + kryptografischer Signatur.
53. ⬜ Evidence-Chain (Hash-Verkettung) mit pin'd `search_path` absichern (Migration vorhanden — verifizieren).
54. ⬜ Konfigurierbare Retention-Policy pro Mandant/Anwendungsfall.
55. ⬜ Manipulationsnachweis: unabhängige Verifizierbarkeit der Evidence-Hashes (Tool/Doku).
56. ⬜ Klarer Disclaimer: „technische Unterstützung, keine Rechtsberatung" überall konsistent.

## G — AI Act & Governance-OS (57–66)

57. ✅ `ai-act-classify` / `ai-act-risk-inventory` (Risk-Level-Klassifizierung).
58. ✅ Governance-OS-Komponenten + Views (RiskCenter, DPIAs, Incidents, Approvals).
59. ⬜ AI-Tool-Inventar pro Mandant erfassen & pflegen.
60. ⬜ Risk-Level-Assessment (minimal/limited/high-risk/banned) als geführter Flow.
61. ⬜ Disclosure-Check für Chatbots (EU AI Act Art. 52 Transparenzpflicht).
62. ⬜ DPIA-Generator (`governance-dpias`) mit Template + Freigabe-Workflow.
63. ⬜ Incident-Management mit Meldepflicht-Timer (72h, DSGVO Art. 33).
64. ⬜ DSB-Dashboard (Datenschutzbeauftragter-Ansicht) mit Mandanten-Übersicht.
65. ⬜ Governance-Analytics-Aggregator → Management-Reports (`governance-analytics-export`).
66. ⬜ `governance-remediate` mit Audit-Engine-Findings verdrahten (Closed-Loop).

## H — CMS-Integrationen (67–74)

67. ✅ Shopify-Grundlage (`shopify-install`, `shopify-scan`, `shopify-webhooks`, `shopify-callback`).
68. ⬜ Shopify-App-Store-Submission + Cookie-Banner via Script-Tags-API.
69. ⬜ Checkout-Compliance (DSGVO-konforme Checkout-Felder) für Shopify.
70. ⬜ **WordPress-Plugin**: Grundstruktur + Auto-Scan bei Aktivierung.
71. ⬜ WordPress-Dashboard-Widget mit Compliance-Score + One-Click-Fix.
72. ⬜ WordPress Re-Scan-Cron (wöchentlich) + Plugin-Verzeichnis-Submission.
73. ⬜ Webflow/Framer: Embed-Code-Injection (Custom Code) als leichter Connector.
74. ⬜ Connector-SDK (`connectors/`) vereinheitlichen (eine Schnittstelle, mehrere CMS).

## I — Multi-Tenant & Agency/Enterprise-Suite (75–82)

75. ✅ Tenant-Layer (`tenant-audit`, `tenant-invite`, `tenant-members`).
76. ⬜ Alle Tabellen-RLS gegen Cross-Tenant-Leaks auditieren (negative Tests je Tabelle).
77. ⬜ White-Label (eigenes Logo/Domain/Farben) für Agency-Suite.
78. ⬜ Mehrere Kundendomains pro Agency-Account verwalten.
79. ⬜ Öffentliche **Compliance-API** + API-Keys (`governance-keys`) mit Scopes & Quotas.
80. ⬜ Rollen-/Rechte-Modell (Owner/Admin/Member/DSB/ReadOnly) finalisieren.
81. ⬜ Bulk-/Prioritäts-Scans für Agencies (Queue-Priorisierung).
82. ⬜ Mandanten-Onboarding-Flow (`enterprise-ai-os-discovery-intake`, `kodee-onboard`) glätten.

## J — Billing & Monetarisierung (83–88)

83. ✅ Stripe-Stack (`stripe-checkout`, `stripe-portal`, `stripe-webhook`, `stripe-meter-sync`).
84. ✅ Stripe-Tax + Pricing-Tier-Alignment (Migrationen vorhanden).
85. ⬜ `src/config/pricing.ts` als Single Source of Truth mit Live-Price-IDs verifizieren.
86. ⬜ Usage-Based-Billing (`usage-increment` + Meter-Sync) für API/Scan-Volumen.
87. ⬜ Self-Service-Upgrade/Downgrade + Proration im Kundenportal testen.
88. ⬜ Dunning/Failed-Payment-Flow + MRR/Churn-Dashboard (`business-metrics-cron`).

## K — Security, DSGVO & Trust (89–94)

89. ✅ MFA (`mfa-admin-reset`, `mfa-recovery-redeem`, P0a-Security-Migration).
90. ✅ DSGVO-Betroffenenrechte (`gdpr-export`, `gdpr-delete`).
91. ⬜ Service-Role-Keys-Audit: ausschließlich in Edge Functions, nie im Client (Scan + CI-Gate).
92. ⬜ Penetrationstest + Dependency-/Secret-Scanning in CI.
93. ⬜ Sub-Processor-Liste + Benachrichtigung (`sub-processor-notify`) + AVV/DPA-Vorlagen.
94. ⬜ Trust-Center-Seite (Hosting-EU, Verschlüsselung, Zertifikate, Status).

## L — GTM, Growth & Content (95–98)

95. ✅ Nischen-Landing-Pages (Agenturen, Arztpraxen, Kanzleien, ChatGPT, Shopify, WordPress).
96. ⬜ SEO-Content-Engine: Compliance-Guides je Nische → Free-Audit-Funnel.
97. ⬜ Partner-/Reseller-Programm (Kanzleien, DSB, Webagenturen) — `docs/partner-kanzlei-outreach.md` operationalisieren.
98. ⬜ Newsletter- & Outbound-Funnel (`newsletter-*`, `welcome-email`, `sales-lead`) messbar machen.

## M — Ops, Deployment & Launch (99–100)

99. ⬜ VPS-Stack (Traefik + Ollama + n8n, `deploy/`) inkl. Playwright-Scanner produktiv & überwacht; Release-Pipeline (`release:merge`/`release:publish`) automatisiert.
100. ⬜ **Public Launch**: End-to-End-Abnahme (E2E grün, Lasttest `qa:load`, Security-Review), Pricing live, Monitoring/Alerting scharf → GA-Freigabe.

---

### Nächste 5 Schritte (Empfehlung)

1. **#15/#16/#17** — Playwright-Scanner + Consent-Timing live (der eigentliche Differenzierer).
2. **#34** — RealSync CMP, weil sie Audit + Remediation zum Produkt verbindet.
3. **#43** — Drift Detection, der wiederkehrende SaaS-Wert.
4. **#76/#91** — RLS- & Service-Key-Audit vor jeder Skalierung (Sicherheits-Grundlage).
5. **#85/#86** — Billing scharf stellen (Umsatz tragfähig machen).

*Erstellt: Juni 2026 · Grundlage: ROADMAP.md + aktueller Code-Stand · RealSyncDynamics.AI*

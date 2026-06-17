# 100-Punkte-Plan zum Ziel — Governance OS für Europa

> **Das große Ziel:** RealSyncDynamics.AI von einer Sammlung guter Compliance- und KI-Funktionen zu **einem klaren, nutzbaren und verkaufbaren Governance Operating System** machen — mit echten Kunden, echter Nutzung und **kontinuierlicher Governance statt Einmal-Audits**.
>
> **Nicht** mehr: noch mehr Features, noch mehr Agenten, noch mehr Container, noch mehr Landingpages.
> **Sondern:** *eine* Plattform, *ein* Dashboard, *ein* Billing, *ein* Agent, *ein* Workflow-System — und die ersten **5–10 echten Pilotkunden**.

## Mission

RealSyncDynamics.AI betreibt DSGVO, EU AI Act, Evidence, Monitoring und Automatisierung als **kontinuierlichen Unternehmensprozess** — nicht als Scanner, Cookie-Tool, Datenschutzgenerator oder Chatbot, sondern als **Governance OS**.

## Die wichtigste Kennzahl

> Nicht: „Wie viele Features haben wir?"
> Sondern: **„Wie viele Unternehmen nutzen RealSyncDynamics.AI aktiv?"**

**Hauptziel jetzt:** 5–10 echte Pilotkunden — kostenloser Enterprise-Zugang, 12 Monate, echtes Feedback, echte Uploads, echte Nutzung. Diese 5 bringen mehr Erkenntnis als 50 weitere Features.

> Legende: ✅ erledigt · 🟡 teilweise · ⬜ offen · Status geerdet auf `ROADMAP.md` + aktuellem Code-Stand.

---

## Block 0 — Nordstern: Pilotkunden & aktive Nutzung (1–8)

1. ⬜ Pilot-Definition festschreiben: „aktiver Kunde" = Mandant mit laufendem Monitoring + ≥1 Skill-Nutzung/Woche.
2. ⬜ Ziel-Liste 15–20 Wunsch-Pilotkunden (Agentur, DSB, Kanzlei, Arztpraxis, Mittelstand) priorisieren.
3. ⬜ Pilot-Angebot paketieren: kostenloser Enterprise-Zugang, 12 Monate, klare Gegenleistung (Feedback + Uploads + Nutzung).
4. ⬜ Pilot-Onboarding-Flow (1 geführter Pfad: Account → erster Scan → erster Skill → erstes Monitoring).
5. ⬜ Aktivierungs-Metrik live: Dashboard „Wie viele Mandanten sind diese Woche aktiv?" (`business-metrics-cron`).
6. ⬜ Feedback-Schleife: In-App-Feedback (`enterprise-ai-os-feedback`) + 14-tägiges Pilot-Review-Ritual.
7. ⬜ Pilot-Erfolgskriterien je Kunde definieren (welches Governance-Problem lösen wir messbar?).
8. ⬜ Referenz-/Case-Study-Vereinbarung mit Piloten (für spätere Vermarktung).

## Block A — Phase 1: Konsolidieren — *eine* Plattform (9–22)

9. ⬜ Produkt-Narrativ vereinheitlichen: überall „Governance OS", nirgends „Scanner/Cookie-Tool/Generator".
10. ⬜ **Eine** Landingpage: Nischen-Seiten (Agenturen, Arztpraxen, Kanzleien, Shopify, WordPress, ChatGPT) zu einer Story mit Segment-Sektionen zusammenführen statt parallel pflegen.
11. ⬜ Plan-/Tier-Namen vereinheitlichen (Single Source of Truth `src/config/pricing.ts`, keine Abweichungen in Doku/UI).
12. ⬜ **Ein** Dashboard: Governance-OS-Views (Risk, Alerts, Monitoring, DPIAs, Incidents, Approvals) unter einer kohärenten Navigation bündeln.
13. ⬜ App-Struktur entwirren: `src/enterprise-os` vs. `src/features` vs. `src/lib/enterprise-ai-os` — eine klare Schichtung, dokumentiert.
14. ⬜ `governance-os-complete.html` (66 KB Prototyp) entweder in die SPA überführen oder archivieren — keine doppelte Wahrheit.
15. ⬜ Edge-Functions-Landschaft (90+) inventarisieren: aktiv / experimentell / tot — Liste mit Owner & Status.
16. ⬜ Tote/experimentelle Functions deprecaten (klar markieren, aus Routing nehmen) statt löschen-und-hoffen.
17. ⬜ Doppelte Migrations (mehrere `20260624000000_*`) bereinigen, Timestamp-Konvention erzwingen.
18. ⬜ Browser-Extensions (`extension`, `extension-ai-monitor`, `extension-governance`) konsolidieren auf eine.
19. ⬜ Connector-Wildwuchs (`connectors/`, `services/`, `worker/`) auf ein einheitliches Schnittstellen-Muster bringen.
20. ⬜ Doku-Konsolidierung: `ROADMAP.md`, `docs/PRODUCT_FOCUS.md`, dieser Plan → eine konsistente Quelle, Widersprüche raus.
21. ⬜ Terminologie-Lint: „Prüfpfad"/„Herkunftsnachweis" durchgängig erzwingen (CI-Check).
22. ⬜ Design-System-Konsistenz: App = Hard-Edge Industrial, Landing = Trust-Light — keine Vermischung.

## Block B — Phase 1: Aufräumen — PR-Backlog & Schulden (23–32)

23. ⬜ Offene PRs sichten, triagieren (mergen / schließen / neu aufsetzen) — Backlog auf <10 bringen.
24. ⬜ CI-Gate verbindlich: build + Migration-Validation + `check:production` müssen grün sein vor Merge.
25. ⬜ Edge-Function-Drift-Check (`check:edge-functions`) als Pflicht-Gate.
26. ⬜ Flaky/duplizierte Tests (z. B. doppelte `testIgnore`, siehe Hotfix #621) stabilisieren.
27. ⬜ Dependency- & Secret-Scanning in CI aktivieren.
28. ⬜ Dead Code & ungenutzte Routen entfernen (öffentliche Routen unverändert lassen).
29. ⬜ Einheitliches Error-/Result-Pattern (`_shared/result.ts`) über alle Functions.
30. ⬜ Strukturiertes Logging + Korrelations-ID + Sentry-Breadcrumbs überall.
31. ⬜ Rate-Limiting & Idempotency-Keys für öffentliche Endpunkte.
32. ⬜ Release-Pipeline (`release:merge`/`release:publish`) als einziger Weg nach Prod dokumentieren.

## Block C — Phase 1: *Ein* Agent, *ein* Billing, *ein* Workflow (33–42)

33. ⬜ Agenten-Landschaft (`agent-os-runner`, `governance-agent`, `remediation-agent`, `kodee*`, `enterprise-ai-os-*`) auf **ein** Agent-Konzept mit Skills reduzieren.
34. ⬜ Agent-Contracts (`core/runtime/types.ts`) als verbindliche Schnittstelle für alle Skills.
35. ⬜ **Ein** Workflow-System: `automation-*` + `workflow-*` + n8n auf ein klares Modell vereinheitlichen.
36. ⬜ Jeder externe Call geloggt in `ai_tool_runs` / `workflow_runs` (Lückenlosigkeit verifizieren).
37. ⬜ **Ein** Billing: Stripe-Stack (`stripe-checkout/portal/webhook/meter-sync`) als einzige Quelle, Live-Price-IDs verifiziert.
38. ⬜ Pilot-/Enterprise-Free-Tier sauber im Billing abbilden (12 Monate, kein Zahlungsdruck, klares Ablauf-Handling).
39. ⬜ Usage-Based-Metering (`usage-increment`) an reale Nutzung (Skills/Scans/Monitoring) koppeln.
40. ⬜ Self-Service Upgrade/Downgrade + Proration im Kundenportal testen.
41. ⬜ Multi-Tenancy-Audit: alle Tabellen RLS-geschützt, negative Cross-Tenant-Tests je Tabelle.
42. ⬜ Rollen-Modell finalisieren (Owner/Admin/Member/DSB/ReadOnly) — passend für Agentur + Mandant + DSB.

## Block D — Phase 2: Automation Skills — *Wählen · Aktivieren · Nutzen* (43–54)

43. 🟡 Skill-Framework (`supabase/functions/skills`, `automation-skills-runs`) als einheitliche Skill-Runtime festigen.
44. ⬜ Skill-Katalog-UI: Skills wählen → aktivieren → nutzen, **ohne Beratung**, self-service.
45. ⬜ **DSGVO-Audit-Skill** (auf bestehender `gdpr-audit`/Rule-Engine) als erster First-Class-Skill.
46. ⬜ **AI-Act-Skill** (auf `ai-act-classify`/`ai-act-risk-inventory`) — Risk-Level + Disclosure-Check.
47. ⬜ **Evidence-Skill** — Nachweise erzeugen, hashen, archivieren (auf `evidence-*`).
48. ⬜ **Screenshot-Skill** — Screenshot-Upload → Governance-Auswertung.
49. ⬜ **Meeting-Skill** — Meeting/Transkript → Governance-relevante Findings & Aufgaben.
50. ⬜ **Lead-Risk-Skill** — Risiko-Einschätzung für Leads/Vendoren.
51. ⬜ Skill-Telemetrie: jede Aktivierung/Nutzung gemessen (Aktivierungs-KPI füttern).
52. ⬜ Skill-Ergebnisse einheitlich als Evidence-Artefakte ablegen (verkettbar, exportierbar).
53. ⬜ Skill-Berechtigungen pro Plan/Mandant (welcher Tier darf welche Skills).
54. ⬜ Skill-SDK/Doku, damit neue Skills nach einem Muster entstehen (kein Wildwuchs mehr).

## Block E — Phase 3: Kontinuierliches Monitoring — 24/7 Governance Runtime (55–66)

55. ✅ Monitoring-Scheduler + Cron (`governance-monitoring-scheduler`).
56. ✅ Alerts-/Monitoring-/Risk-Views im Governance-OS-Frontend.
57. ⬜ Runtime-Objekte definieren: **Websites · KI-Systeme · Vendoren · Datenflüsse · Dokumente** als überwachbare Entitäten.
58. ⬜ **Playwright-Scanner-Microservice** (`deploy/playwright-scanner/`) produktiv — echtes Headless-Browsing.
59. ⬜ **Consent-Timing-Analyse** live (Requests/Tracker VOR Consent) — Kern-Differenzierer.
60. ⬜ **Drift Detection**: neue Tracker/Tools automatisch erkennen („Marketing hat Hotjar eingebaut").
61. ⬜ Compliance-Delta (Vorher/Nachher) je Lauf, pro überwachter Entität.
62. ⬜ Konfigurierbare Scan-Frequenz pro Plan (Enterprise: täglich/stündlich).
63. ⬜ Eskalations-Routing: Alert → E-Mail/Telegram/Slack/Webhook (`telegram-*`, `governance-webhooks`).
64. ⬜ Vendoren-/Datenfluss-Monitoring (über Website hinaus) als eigene Runtime-Quelle.
65. ⬜ Dokument-Monitoring (Änderungen an Verträgen/AVV/Policies erkennen).
66. ⬜ Selbst-Überwachung der Runtime (Health, Uptime, Scanner-SLA via `health`).

## Block F — Phase 4: Governance Knowledge Cloud + RAG (67–78)

67. ⬜ Knowledge-Base-Architektur: kuratierte Rechtsquellen + Embeddings + RAG (EU-lokal, Ollama gemma3:4b als Souveränitäts-Option).
68. ⬜ Quellen aufnehmen & pflegen: **DSGVO**.
69. ⬜ **EU AI Act**.
70. ⬜ **NIS2**.
71. ⬜ **DSA · Data Act**.
72. ⬜ **C2PA · SCC**.
73. ⬜ **EDPB · BfDI** (Leitlinien/Entscheidungen).
74. ⬜ **Dokument-Upload** → Analyse gegen Knowledge Base.
75. ⬜ **Screenshot-Upload** → Auswertung (verzahnt mit Screenshot-Skill).
76. ⬜ **Meeting-Analyse** → Governance-Findings (verzahnt mit Meeting-Skill).
77. ⬜ **Governance-Chat** mit Quellen-Zitaten (RAG, keine Halluzination, Herkunftsnachweis pro Antwort).
78. ⬜ Versionierung der Wissensquellen (Stand/Datum nachweisbar) + Quellen-Disclaimer „keine Rechtsberatung".

## Block G — Phase 5: Europäische Governance-Plattform & GTM (79–88)

79. ⬜ Zielsegmente schärfen: Agenturen · DSB · Kanzleien · Arztpraxen · Mittelstand · Enterprise.
80. ⬜ **White-Label/Multi-Tenant** für Agenturen (eigenes Branding, mehrere Kundendomains).
81. ⬜ **DSB-Dashboard** (Datenschutzbeauftragter-Ansicht über mehrere Mandanten).
82. ⬜ Öffentliche **Governance-API** + API-Keys (`governance-keys`) mit Scopes/Quotas für Partner.
83. ⬜ Partner-/Reseller-Programm (Kanzleien, DSB) operationalisieren (`docs/partner-kanzlei-outreach.md`).
84. ⬜ Pilot-Outreach starten: 15–20 Erstkontakte → 5–10 unterschriebene Piloten.
85. ⬜ SEO/Content auf *eine* Story ausrichten (Governance OS), Free-Audit als Einstieg in den Funnel.
86. ⬜ Trust-Center-Seite (EU-Hosting, Verschlüsselung, Sub-Processor-Liste, Status).
87. ⬜ Onboarding-Material & Demo-Skript für Piloten (reproduzierbar, kein 1:1-Consulting nötig).
88. ⬜ Erste Case Studies aus Pilotnutzung veröffentlichen (Referenz für Vertrieb).

## Block H — Querschnitt: Trust, Security & EU-Souveränität (89–95)

89. ✅ MFA + DSGVO-Betroffenenrechte (`mfa-*`, `gdpr-export`, `gdpr-delete`).
90. ⬜ Service-Role-Keys-Audit: ausschließlich in Edge Functions, nie im Client (CI-Gate).
91. ⬜ Penetrationstest vor Pilot-Go-Live.
92. ⬜ EU-Datenresidenz durchgängig nachweisen (DB, Storage, KI-Inferenz-Optionen).
93. ⬜ Sub-Processor-Liste + Benachrichtigung (`sub-processor-notify`) + AVV/DPA-Vorlagen für Piloten.
94. ⬜ Evidence-Chain (Hash-Verkettung, pin'd `search_path`) verifizieren — Manipulationsnachweis.
95. ⬜ Konsistenter Disclaimer „technische Unterstützung, keine Rechtsberatung" überall.

## Block I — Mess- & Steuerungslogik (96–100)

96. ⬜ Nord-Stern-Dashboard: aktive Mandanten/Woche als zentrale, sichtbare Zahl.
97. ⬜ Sekundär-KPIs: Skill-Nutzung, überwachte Entitäten, Time-to-First-Value je Pilot.
98. ⬜ Scope-Disziplin: vor jedem neuen Feature die Frage „bringt das einen Piloten zur aktiven Nutzung?".
99. ⬜ Quartals-Review gegen diesen Plan (Status ✅/🟡/⬜ aktualisieren, Ballast streichen).
100. ⬜ **Meilenstein-Definition „erreicht":** 5–10 Pilotkunden nutzen das Governance OS wöchentlich aktiv und liefern verwertbares Feedback.

---

### Was bewusst NICHT passiert

- ❌ Noch mehr Features bauen, bevor die Plattform konsolidiert ist.
- ❌ Noch mehr Agenten / Container / Landingpages parallel.
- ❌ „KI baut Websites" oder „100 % rechtssicher" versprechen.
- ❌ Erfolg an Feature-Anzahl messen statt an aktiver Nutzung.

### Empfohlene erste 5 Schritte

1. **#23 + #15/#16** — PR-Backlog & Edge-Function-Inventar: erst aufräumen, dann bauen.
2. **#10 + #12** — Eine Landingpage, ein Dashboard: eine kohärente Produkt-Oberfläche.
3. **#43–#46** — Skill-Runtime + erste 2 First-Class-Skills (DSGVO-Audit, AI-Act) als „Wählen·Aktivieren·Nutzen".
4. **#58/#59/#60** — 24/7-Runtime mit Playwright + Consent-Timing + Drift: der wiederkehrende Wert.
5. **#1–#4 + #84** — Pilot-Angebot schnüren und Outreach starten → die ersten 5–10 Kunden.

*Aktualisiert: Juni 2026 · Ausrichtung: Governance OS für Europa · RealSyncDynamics.AI*

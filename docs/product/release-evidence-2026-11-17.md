# RealSync Dynamics & AI — Evidence-first Produkt- und Release-Matrix
**Stichtag:** 17.11.2026 · **Umfang:** GitHub `realsyncdynamics-spec` + Supabase `RealSyncDynamicsLive` (eu-central-1). **Keine generelle Produktionsfreigabe.**

> Ergänzt die historische [Reality Matrix](reality-matrix.md) (22.08.2026), die [Capability Matrix](capability-matrix.md) (23.08.2026) und die [Implementierungs-Registry](../../src/product/implementation-status.ts). Messdaten aus unterschiedlichen Stichtagen dürfen nicht vermischt werden.

## 1. Nachweisregeln — keine Prozentzahlen aus Codebestand

Eine Funktion gilt nur dann als **kundenseitig freigegeben**, wenn folgende voneinander unabhängige Signale dokumentiert sind:
1. **CODE:** konkreter Pfad/Commit und kontrollierter Aufruf; README/PR allein genügt nicht.
2. **DEPLOY:** aktuelle Zielumgebung, Konfiguration, Funktion/Route tatsächlich erreichbar. Supabase `ACTIVE` bestätigt nur Bereitstellung.
3. **EXECUTE:** nachvollziehbare erfolgreiche Ausführung inkl. Fehlerpfad (nicht nur HTTP 200 oder Datenbankzeile).
4. **E2E:** repräsentativer Kundenablauf mit Anmeldung, Mandantentrennung, Entitlement, Speicherung, Resultat und Wiederaufruf.
5. **SELLABLE:** Pricing-/Stripe-Abgleich, signierte Webhooks, Leistungsauslieferung, Kündigung/Refund, Datenschutz und Support getestet.

`src/product/implementation-status.ts` verwendet `live` bislang im Sinn von *erreichbar* (`IMPLEMENTATION_MEASURED_AT = 2026-10-18`). **Das ist kein Synonym für E2E oder SELLABLE.** Prozentuale Produktreife ist ohne einheitliche Abnahmetests **nicht seriös berechenbar**. UI, technische Laufzeit und Marketingfreigabe getrennt kennzeichnen.

## 2. Read-only Live-Nachweise (17.11.2026)

| Evidenz | Aktueller Befund | Bedeutung / Grenze |
|---|---:|---|
| Supabase-Projekte | 2 `ACTIVE_HEALTHY` (Live + Second-Brain-Staging) | keine End-to-End-Abnahme |
| Edge Functions in RealSyncDynamicsLive | 200 `ACTIVE` | Deploy-Register, kein Erfolgsnachweis |
| `gdpr_audits` | 213 gesamt | Audit-Laufzeit erzeugt Datensätze |
| HTML-Abrufe mit HTTP-2xx und HTML-Inhalt | 193 | Scan-Backend arbeitet |
| Abruffehler | 20 | Fehlerpfade sichtbar |
| Scans mit Score | 213 | Score vorhanden; Rechtsrichtigkeit unbewiesen |
| `agent_runs` | 9 | Laufaktivität, kein Erfolgsnachweis |
| `siteos_agent_runs` | 30 | Agentenaktivität, kein Kundendeploy |
| `siteos_blueprints` | 14, alle `draft` | Entwürfe, nicht veröffentlicht |
| `siteos_rebuild_runs` | 0 | kein gespeicherter Rebuild-Lauf |
| `app_builder_projects` | 0 | kein gespeichertes Kundenprojekt |
| `tenant_voice_agents`, `voice_sessions`, `voice_number_bindings`, `voice_executions` | jeweils 0 | Live-Telefonie nicht bestätigt |
| `audit_jobs`, `audit_reports` | jeweils 0 | separater Audit-Pfad; nicht mit `gdpr_audits` verwechseln |
| `stripe_invoices` | 1, `open` | kein Beweis einer erfolgreich bezahlten Bestellung |

Diese Zahlen sind ein **Snapshot**, kein Monitoring und keine vollständige Erhebung externer Provider.

## 3. Vertriebs- und Dashboard-Matrix

| Angebot / Kundeneinstieg | Nachweisstand | Kundenoberfläche / Dashboard-Ziel | CTA vor E2E-Abnahme | Noch fehlender Beweis |
|---|---|---|---|---|
| Kostenloser DSGVO-Scan | **EXECUTE teilweise** (193 HTML-Abrufe) | `/audit` → Ergebnis → `/welcome` → Mandanten-Dashboard `/app/dashboard` | „Scan starten“ mit transparenter Fehlerbehandlung | Konsistenter Ergebnisbericht, PDF, Claim nach Login, RLS, Fehler-/Wiederaufnahme |
| Governance OS | **CODE + DEPLOY**, Nutzungsbestand einzelner Module uneinheitlich | `/app/dashboard` als einziges Kunden-Command-Center; Detailmodule zu Risk/Evidence/Policies | Produktstatus und Funktionsumfang transparent erläutern; keine öffentliche Demo-/Sales-CTA, keine pauschale Compliance-Garantie | Tenant-E2E, echte Datenquellen, Evidence-/Audit-Export, passende Entitlements |
| Evidence Vault | Code/Funktionen, kein geprüfter Export-E2E | Unter `/app/evidence`, kein zweites OS | Preview innerhalb Governance | unveränderbare Nachweiskette, Export, Zugriffstest |
| KI-Risikoklassifikator | Code/Deploy | öffentliche Einordnung, geschütztes Inventar unter `/app` | Klassifikator anbieten; Persistenz explizit Preview | Speicherung und Wiederaufruf im richtigen Tenant |
| Voice-Agent / Telefonbot | **CODE + DEPLOY**, null Voice-Provisionierungen/Sessions | Vorschlag: Voice-Produktbereich im selben Kunden-Workspace, eigene Konfiguration/Anrufhistorie; Operator-Ansicht separat | Verfügbarkeit und Preview-Status erklären; **kein Sofortkauf und keine Zusage einsatzbereiter Telefonie** | Providerwahl, Nummer, eingehender Anruf, Tools, Handoff, Kostenlimit, Datenschutz, Stripe → Entitlement → Provision |
| Website-/Landingpage-Designer (SiteOS) | **CODE + Entwürfe**, kein realer Publish-E2E | `/build` → SiteOS-Editor; Kunden-Projektübersicht im gleichen Account | „Preview erstellen“ | Speichern/Wiederöffnen/Preview, Freigabe, Domain, Deploy und Rollback |
| Code-App-Builder | **CODE**, `app_builder_projects=0` | `/builder/:slug/code` (bestehende Engine), `/build` als gemeinsame Eingabe | Preview/Anfrage | Prompt-Übergabe, Persistenz, Testbuild, tatsächliche Veröffentlichung |
| 3D-Designer | lokaler Editor im separaten Repository | SiteOS als vorgesehener Einstieg; 3D-Canvas als Modul, **kein** dritter Builder | Prototyp | Integration, 3D-Export, Kundenhosting und Content-Sicherheit |
| Cloud Code Optimizer | Scan-Adapter nutzt `gdpr-audit` | Vorschlag: Analyse/Remediation im Governance-Workspace | Website-Analyse, **nicht** „Code automatisch verbessert“ | Repo-Import, Diff, isolierte Änderung, Tests, Rollback |
| Creative Studio Bild/Video | Drafts #2269/#2271, keine geprüfte Kundengenerierung | geschützter Creative-Workspace nach Freigabe | „In Entwicklung“ | Budgetreservierung, Job-Persistenz, Tenant-Storage, Provider-Verträge, Moderation, Kosten und Output |
| Agent OS / Grok App Builder | Code bzw. Entwurf; Kunden-E2E offen | Agent-/Projektverwaltung als interne/Preview-Module | keine öffentliche Self-Service-Zusage | Auth, Scope, ausführbare Aktionen, Audit-Trail, Freigaben, Deploy |
| Stripe / Abrechnung | Checkout-Funktionen aktiv; 1 offene gespiegelte Rechnung | `/app/billing` bleibt **ein** Billing-Bereich für alle freigegebenen Produkte | nicht freigegebene SKU nicht in Checkout aufnehmen | signierter Testkauf, Entitlement, Rechnung, Storno/Kündigung, Idempotenz |

**Produktarchitektur:** ein Auth- und Tenant-System, ein Billing-/Entitlement-System, ein kundenbezogenes Haupt-Dashboard, darunter getrennte Modulbereiche. Interne Operations-/Freigabeansichten sind vom Kundenbereich und dessen RLS-Rechten zu trennen. Keine neuen Tabellen/Backends nur für optische Produkttrennung erzeugen.

## 4. Verbindlicher Onboarding-E2E (in Test/Staging)

`/audit` → Scan → Ergebnis/Fehlermeldung → `/welcome` → verifizierte Identität → **explizite Tenant-Wahl** → sicherer Audit-Claim → `/app/dashboard` → nächster Schritt → ggf. Preis → Checkout → signierter Webhook → Entitlement → Modulzugriff → persistierter Kundenerfolg → Rechnung/Support/Kündigung.

**Negativtests:** anonyme/unbestätigte Identität, fremde Audit-ID, zwei Tenants, E-Mail-Abweichung, abgebrochener Checkout, falsche Preis-ID, doppeltes Webhook-Event, abgelaufenes Abo, fremder Export, Fehler des KI-Providers, Reload nach OAuth. Fehlversuche dürfen weder fremden Zugriff noch eine Erfolgsmeldung erzeugen. Siehe #1865, #923, #1980.

## 5. Release-Blocker und Reihenfolge

**P0: Deploy-Kapazität und Sicherheit** — bestätigter HTTP-402-Blocker mit 200 ACTIVE Edge Functions und vier nicht verfügbaren Slugs (`platform-intelligence-orchestrator`, `workspace-approvals`, `workspace-events`, `workspace-execute`); Tracking #2281. Der alte Shared-Deploy-Workflow versucht bei `_shared`-Änderungen alle Functions erneut auszurollen; gezielter Planner plus aktiver Live-Slot-Check in #2279. Telegram-Webhook verarbeitet bei fehlender Secret-ENV nicht authentifizierte Updates (konfigurationsabhängiger Fail-open-Codepfad); Fix #2280. Audit-Claim für Mehrfachmitgliedschaften wird in #2276 repariert. Alle drei PRs haben CI-Checks, aber sind bis zu individuellen Release-Gates und Freigaben nicht produktiv. **P0: Security/Isolation** — Supabase Security Advisor meldete am 17.11.2026: 30 `anon`- und 64 `authenticated`-Berechtigungen für `SECURITY DEFINER`-RPCs, 4 mutable Search-Paths und 39 Tabellen mit RLS ohne Policy; getrennt nach tatsächlicher API-Exponierung, absichtlichen Triggerrechten und möglicher Ausnutzbarkeit untersuchen. Nicht pauschal `REVOKE`, sondern Call-Site-Analyse und Stagingtests. Issue #2273; vorhandene Drafts #2224, #2225, #2238.

**Korrektur einer historischen Audit-Aussage:** `AUDIT/18_FINDINGS.md` F-04 beschreibt `governance-risk-score` als unsicher. **Aktuelles `main` und deployte Function Version 56** enthalten `requireUser()`, `requireTenantMembership()`, `verify_jwt=true`. Dieser Einzelfall ist auf Code-/Deploy-Ebene gehärtet; negative E2E-Tests und andere F-04/F-05-Funktionen bleiben separat zu prüfen.

**P0: Monetarisierung** — keine Voice-SKU in den Sofortkauf, solange Voice-Billing-/Provider-E2E nicht grün ist (#1980). Vor Veröffentlichung von Governance-Checkout signierte E2E-Abnahme (#923/#1039). Ein `ACTIVE`-Webhook ist keine ausgelieferte Leistung.

**P1: Funnel & Claim** — Scan → Ergebnis → Login → Tenant → Report/Export messen (#1865). **P1: Builder** — Persistenz/Preview/Deploy und echte Domainpublikation prüfen. **P2: Voice-Pilot** — nur nach Sicherheits-/Billing-Gate. **P2: Creative** — isolierte Preview, kein bezahlter Provideraufruf ohne Budget/Quota/Storage.

**Marketing:** PR #2269 bleibt Draft bis Claims-, CI- und E2E-Freigabe. Voice PR #2270 und Creative PR #2271 sind getrennte Preview-Arbeiten; keine unkontrollierten Merges in heiße Landing-/Pricing-Dateien. Keine erfundenen Nutzerzahlen, automatischen Fehlerbehebungen oder „100 % EU“ ohne vollständige Hosting-/Subprozessor-Nachweise.

## 6. Bereinigung und GitHub

- [x] #2272 (F-20): 13 verwaiste `.sql.bak` im Repository-Root nach grüner CI/Playwright/CodeQL/Merge Hygiene mit Squash-Merge `cc7e744` entfernt. Datenbank und Migrationen unberührt.
- [ ] #2274: 37 Repositories nach Zweck, Deployment, Domain, Geheimnissen, Referenzen, offener Arbeit und Kundenbezug prüfen; **vier leere Repos nur nach Abhängigkeitsprüfung löschen**, sonst archivieren.
- [ ] Projektboards/PRs konsolidieren, nicht blind schließen; `RealSyncDynamics.AI` bleibt Produkt-Codebasis.
- [ ] `implementation-status.ts` und Public-Claims nach E2E-Ergebnissen aktualisieren, nicht nach README oder Repository-Anzahl.

**Status dieses Dokuments:** Evidenz-Snapshot und Abnahmeplanung. Keine Konfigurations- oder Produktionsänderung und kein Nachweis eines neuen Kundendeploys.

# RealSyncDynamics.AI — Produkt-Tiefenaudit & 1-Mio-€-Bewertungsplan

> Stand: 2026-06-19 · Branch `claude/realsync-audit-valuation-15erb1`
> Methodik: Audit am echten Codebestand (674 Frontend-Dateien, 90+ Edge Functions, 159 Migrations, 158 Testdateien, 97 Pages, 200+ Routen). Alle Aussagen mit `Datei:Zeile` belegt. Keine Marketingfloskeln — Ziel ist Wahrheit.

---

## 1. Executive Summary

RealSyncDynamics.AI ist **kein Vaporware-Mockup**, sondern ein technisch substanzielles, real funktionierendes Multi-Tenant-SaaS mit echtem Backend — gebaut von einem Einzelunternehmer (Dominik Steiner, Gewerbe angemeldet 13.05.2026, `Impressum.tsx:61-73`). Die kritische Erkenntnis: **Das Backend ist deutlich reifer als das Schaufenster.** Auth, RLS/Tenant-Isolation, echte Scanner, echte LLM-Inferenz, DSGVO-Export/Delete und eine kryptographische Evidence-Chain existieren und arbeiten. Die meisten Governance-Module (`/app/dpia`, `/app/dsr`, `/app/incidents`, `/app/vendors`, `/app/scans`, `/app/connectors`, `/app/keys`, `/app/webhooks`, `/app/compliance`) sind echte CRUD-Views auf realen Tabellen.

Demgegenüber stehen **vertrauensgefährdende Lücken**, die heute einen Verkauf blockieren: die Startseite ist ein statisches Mockup mit toten Tiles, drei zentrale Dashboard-Views zeigen eingeloggten Nutzern **erfundene Demo-Daten** statt echter (Compliance-Risiko in einem Compliance-Tool), das versprochene „signierte PDF" ist in Wahrheit HTML, und der 14-Tage-Trial wird im regulären Checkout nicht gewährt.

**Reifegrad: 60/100 — MVP an der Schwelle zur verkaufsfähigen Beta.** Aktueller Unternehmenswert (pre-revenue, 0 Kunden, Solo): **realistisch 80.000–150.000 €**. Der Weg zur 1-Mio-€-Bewertung führt **nicht über mehr Features**, sondern über ~35–50 zahlende Kunden / ~100 k € ARR bei 10× SaaS-Multiple.

---

## 2. Aktueller Realitätsstand

| Dimension | Befund |
|---|---|
| Rechtsform | Einzelunternehmen, ~1 Monat alt (`Impressum.tsx:67-73`). Kleinunternehmer §19 UStG. |
| Team | Solo-Founder. Kein erkennbares Team. |
| Umsatz / Kunden | 0 zahlende Kunden erkennbar. Pre-Revenue. |
| Codebasis | Groß & sauber: Multi-Tenant-RLS, 90+ Edge Functions, 158 Tests, E2E (Playwright). |
| Backend | Überwiegend **echt** (Auth, Scanner, LLM, GDPR, Evidence-Chain). |
| Frontend Public | Startseite statisches Mockup; Free-Audit-Funnel echt & stark. |
| Frontend App | ~13 Gold-Standard-CRUD-Views; 3 Hybrid-Views mit Fake-Daten; 2 reine Demo-Shells. |
| Checkout | Code real für Starter/Growth/Agency; abhängig von Stripe-Live-Konfiguration. |

---

## 3. Was ist bereits stark? (mit Beleg)

1. **Echte Multi-Tenant-Architektur.** 176 `ENABLE ROW LEVEL SECURITY`-Statements, sauberer Helper `is_tenant_member()` (`20260430180000_tenant_rls_and_webhook_events.sql:26`), RLS-Rekursionsfalle erkannt & gefixt (`20260516400000_fix_memberships_rls_recursion.sql`).
2. **Echte Auth.** Supabase Magic-Link (`Welcome.tsx:152`) + OAuth Google/Microsoft/LinkedIn/GitHub (`OAuthProviderButtons.tsx:151`), Auto-Tenant-Trigger beim Signup (`20260501000000_auto_tenant_on_signup.sql:11-45`), MFA/AAL2 native (`RequireAal2.tsx`).
3. **Echter Free-Audit-Funnel (stärkster Asset).** `/audit` ruft `gdpr-audit` Edge Function: server-seitiger Fetch, ~25 Heuristik-Checks, Rule-Engine, Subpage-Scan, Score 0–100, Persistenz in `gdpr_audits` + `sales_leads`, Rate-Limit (`gdpr-audit/index.ts:94,107,544`).
4. **Echte LLM-Inferenz** über Anthropic/Google/OpenAI/Ollama mit Vault-Secrets und Logging in `ai_tool_runs` (`_shared/providers.ts`, `_shared/ai.ts:207`).
5. **Echte Gold-Standard-Governance-Module** mit voller CRUD: DPIAs, DSR, Incidents, Vendors, Approvals, Keys, Connectors, Webhooks, AI-Act-Risk-Inventory, Scans, Compliance-Report, Cost-Tracking, Websites — alle mit echten `supabase.from()`/`functions.invoke('governance-*')` und korrekten Empty-States.
6. **Echte DSGVO-Betroffenenrechte:** `gdpr-export` (7 Tabellen → JSON-Bundle), `gdpr-delete` (Anonymisierung + `auth.admin.deleteUser`, Sole-Owner-Guard) (`gdpr-export/index.ts:72`, `gdpr-delete/index.ts:97`).
7. **Kryptographische Evidence-Chain:** `evidence-vault-export` mit HMAC-SHA256-signierter Hash-Chain (`evidence-vault-export/index.ts:148`).
8. **Echte Legals:** vollständiges Impressum mit realer Identität, TLfDI als Aufsicht, korrektes §356(5)-BGB-Consent-Gate im Checkout (`CheckoutPage.tsx:394-433`).
9. **Solide mobile Optimierung** (Tailwind-Breakpoints durchgängig, dedizierte `MobileBottomNavigation`, iOS-Zoom-Schutz).

---

## 4. Was ist kritisch kaputt oder fehlt?

| # | Prio | Befund | Beleg |
|---|---|---|---|
| K1 | **P0** | **3 Hybrid-Views zeigen eingeloggten Nutzern erfundene Demo-Daten** statt echter. In einem Governance-/Compliance-Tool ist fabriziertes Risiko-/Monitoring-Reporting ein Vertrauens- und Haftungs-Risiko. | `RiskCenterView.tsx:970` (`useState(RISKS)`), `AiSystemRegistryView.tsx:299`, `MonitoringRuntimeView.tsx:605` (`'18'`,`'4'`,`'vor 3 Min.'`) |
| K2 | **P0** | **Versprochenes „signiertes PDF" existiert nicht** — `audit-report-pdf` liefert HTML, nicht PDF. Welcome/Marketing sichern explizit PDF zu. | `audit-report-pdf/index.ts:161`, `Welcome.tsx:511,537` |
| K3 | **P0** | **Startseite ist Conversion-Sackgasse:** statisches Mockup, 9 nicht-klickbare Tiles (`cursor-default`), Primär-CTA „Dashboard öffnen" → `/app`-Fake-Demo statt in den funktionierenden `/audit`-Funnel. | `PublicWorkspacePreview.tsx:131,214` |
| K4 | **P0** | **Checkout zahlungsfähig nur bei korrekter Stripe-Live-Konfiguration** (Secret-Key, Webhook-Endpoint registriert, `customer.subscription.*` abonniert). Sonst zahlt Kunde → keine Freischaltung. Aus Repo nicht verifizierbar. | `stripe-checkout/index.ts:52,100-104`; Live-Price-IDs geseedet `20260624000000_stripe_live_price_ids.sql:12-25` |
| K5 | P1 | **14-Tage-Trial nicht im regulären Checkout** — nur bei `?pilot=true`. CTA „14 Tage Agency testen" führt aber zu sofortiger Abbuchung. | `stripe-checkout/index.ts:124-127`, `checkout.ts:34`, `pricing.ts:136` |
| K6 | P1 | **`checkout.session.completed` zieht keine Subscription nach** — Freischaltung hängt allein an `customer.subscription.created`, kein Fallback. | `stripe-webhook/index.ts:108-114` |
| K7 | P1 | **2 reine Demo-Agent-Views** ohne API (`governance_agents`-Tabelle fehlt). | `AgentRegistryView.tsx:27`, `AgentsCenterView.tsx:29` |
| K8 | P1 | **2 verwaiste Cron-Jobs** — Drift-Monitoring & Stale-Run-Cleanup laufen nie automatisch (auskommentiert). | `20260509020000_monitoring_tables.sql:149-160`, `20260505000000:59-63` |
| K9 | P1 | **`<SEOHead/>` wird im Route-Tree nicht gerendert** → Unterseiten teilen Default-Meta (Duplicate-Meta), nur durch Prerender teilweise gerettet. | `App.tsx:8` (nur Import, kein Render), `scripts/prerender.mjs` |
| K10 | P2 | **Zwei parallele Entitlement-Systeme** (bronze/silver/gold vs starter/growth/agency); BillingView zeigt nicht-existente Quota-Keys → immer „–". | `20260430200000` vs `20260618000000`; `BillingView.tsx:172-176` |
| K11 | P2 | `ai-gateway` loggt **nicht** in `ai_tool_runs`/`workflow_runs` — verstößt gegen CLAUDE.md-Logging-Regel. | `_shared/aiGateway/anthropicAdapter.ts:65` |
| K12 | P2 | `cookie-scan-deep` braucht deployten Playwright-Microservice; ohne ihn 502/503. | `cookie-scan-deep/index.ts:384`, `deploy/playwright-scanner/` |

---

## 5. Route-by-Route-Prüfung (User Journey)

| Schritt | Route / Datei | Funktioniert | Problem | Priorität | Fix |
|---|---|---|---|---|---|
| Besucher → Homepage | `/` `PublicWorkspacePreview.tsx` | teilweise | Statisches Mockup, tote Tiles, CTA in Fake-Demo | P0 | Primär-CTA → `/audit`; Tiles verlinken |
| Scan starten | `/audit` `AuditChatHero.tsx`→`gdpr-audit` | **ja, echt** | Engine-Version-Inkonsistenz (Frontend `2026.05.0` vs Edge `2026.05.1`) | P3 | Version zentralisieren |
| Report sehen/teilen | `/audit/result/:id`, `/audit/share/:token` | **ja, echt** | „12 Checks" vs „29 Checks"-Textwidersprüche | P3 | Texte angleichen |
| Registrieren | `/welcome` (`/login`,`/signup` redirecten) | **ja, echt** | ENV-abhängig (ohne Supabase-URL „Auth nicht konfiguriert") | — | Ops |
| Ins Dashboard | `/app` `GovernanceBrowserShell` | teilweise | Kein Auth-Guard auf `/app`; Anon sieht Mock + Demo-Banner | P1 | Onboarding-Flow Magic-Link → echter Tenant |
| Org/Website anlegen | `/app/websites` `GovernanceDashboardView` | **ja, echt** (Score 95) | — | — | — |
| Audit/Monitoring starten | `/app/scans` `ScansListView` | **ja, echt** (95) | — | — | — |
| Findings/Risiken | `/app/risks` `RiskCenterView` | **fake** (40) | Demo-Risiken, Buttons ohne Persistenz | **P0** | `useState([])` + echte Query |
| Evidence | `/app/evidence` `EvidenceVaultView` | teilweise (35) | nur Timeline live; Rest Fake; Export-Buttons tot | P1 | echte Snapshots + Export-Handler |
| Report exportieren | `/app/compliance` `ComplianceReportView` | **ja, echt** (90) | — | — | — |
| Upgrade/Checkout | `/checkout/:planKey` `CheckoutPage.tsx` | teilweise | Stripe-Live-Konfig + Trial-Mismatch | P0/P1 | K4/K5 |
| Nach Zahlung Zugriff | `stripe-webhook` → `subscriptions` | **ja, echt** | kein checkout.session-Fallback | P1 | K6 |

---

## 6. Frontend-Prüfung (Bewertung 0–100 je Bereich)

**Public/Landing: 52/100** — Technische Substanz dahinter 9/10, Homepage als Conversion-Instrument 3/10. Free-Audit-Funnel ist exzellent, verkauft das Produkt aber besser als die Startseite selbst.

**App / Governance Browser:**

| Bereich | Score | Datenquelle |
|---|---|---|
| Websites (`/app/websites`) | 95 | echt, voll CRUD |
| Scans (`/app/scans`,`/:id`) | 95/90 | echt, triggert `tenant-audit` |
| DPIA / DSR / Incidents / Vendors | 95 | echt, voll CRUD + Edge-Fn |
| Approvals / Keys / Connectors / Webhooks | 95 | echt, voll CRUD |
| AI-Act-Risk-Inventory | 95 | echt |
| Compliance / Reports | 90 | echter Snapshot + SHA-256 |
| Cost-Tracking | 90 | echt (`token_usage_monthly`) |
| Remediation Plans | 85 | echt + `remediation-agent` |
| Dashboard (`/app`) | 70 | echte Counts + hartkodierte Module-Fallbacks |
| Team (`/app/team`) | 70 | Team/Rollen echt; SSO/Domains Stub |
| **Risks** (`/app/risks`) | **40** | **Demo-Default + tote Buttons** |
| **AI-Systems** (`/app/ai-systems`) | **40** | **Demo-Default, handleSave persistiert nicht** |
| **Monitoring** (`/app/monitoring`) | **30** | **fabrizierte Zahlen** |
| **Evidence** (`/app/evidence`) | **35** | **überwiegend Demo, Export tot** |
| **Agents** (`/app/agents`, `/ai-systems/agents`) | **15** | **reine Demo-Shells** |

> **API-Schicht ist durchgehend echt:** Kein einziges `*Api.ts` importiert Demo-Daten. Das Problem liegt **rein in der View-Schicht** — die Backend-Anbindung existiert bereits, wird in den 5 schwachen Views aber ignoriert oder durch Hardcoding überschrieben.

---

## 7. Backend-Prüfung

| Funktion | Datei | Status | Risiko | Fix |
|---|---|---|---|---|
| Auth (Magic-Link/OAuth/MFA) | `Welcome.tsx`, `RequireAal2.tsx` | **echt** | niedrig | — |
| Tenant-Isolation / RLS | 176× RLS, `is_tenant_member()` | **echt** | niedrig | — |
| ai-invoke / Provider | `_shared/providers.ts` | **echt** | niedrig | — |
| ai-gateway | `_shared/aiGateway/` | **echt** | mittel | Logging ergänzen (K11) |
| governance-agent | `governance-agent/index.ts` | teilweise | mittel | 3 Anon-Ops sind Mock (`:940,993,1032`) |
| cookie-scan / gdpr-audit / shopify-scan | jeweils `index.ts` | **echt** | niedrig | — |
| governance-ingest / risk-score / remediate | jeweils `index.ts` | **echt** | niedrig | — |
| gdpr-export / gdpr-delete | jeweils `index.ts` | **echt** | niedrig/mittel | — |
| audit-report-pdf | `index.ts:161` | **HTML, kein PDF** | **P0** | Playwright HTML→PDF + Signatur |
| evidence-vault-export | `index.ts:148` | **echt** (HMAC-Chain) | niedrig | — |
| Cron-Jobs | diverse | echt, außer 2 verwaist | P1 | K8 |
| Stripe (checkout/webhook/portal) | siehe §8 | echt | mittel | K4/K5/K6 |

---

## 8. Checkout-/Trial-Prüfung — *Kann ein Kunde heute zahlen?*

**Ja — für Starter/Growth/Agency, sofern Stripe live konfiguriert ist.** Der Code-Pfad ist real und DB-gestützt, kein Mock.

| Funktion | Status | Bemerkung |
|---|---|---|
| Checkout-Session (subscription) | **echt** | `stripe-checkout/index.ts:145` |
| Live-Price-Auflösung | **echt** | starter/growth/agency geseedet (`20260624000000`); scale/enterprise bewusst über Sales |
| Webhook subscription-sync | **echt** | `stripe-webhook/index.ts:130` |
| Feature-Gating (DB) | **echt** | `planAccess.ts:160-177`, `useModuleAccess` |
| `mode: payment` (Einmalkauf) | fehlt in stripe-checkout | läuft über `checkout-website-rebuild` |
| 14-Tage-Trial | **teilweise** | nur `?pilot=true` (K5) |
| checkout.session→entitlement | teilweise | kein Fallback (K6) |
| Billing-Portal (Cancel/Up-/Downgrade) | **echt** | `stripe-portal/index.ts:84`, Portal-Config im Dashboard nötig |

**Voraussetzung (Ops, nicht Code):** Stripe-Webhook-Endpoint registriert + `STRIPE_WEBHOOK_SECRET` gesetzt + `customer.subscription.*`/`invoice.*`/`checkout.session.completed` abonniert. Ohne das: Zahlung ohne Freischaltung.

---

## 9. Governance-OS-Reifegrad

Skala: 0–20 Idee · 21–40 Mockup · 41–60 MVP · 61–75 verkaufsfähige Beta · 76–90 echtes SaaS · 91–100 skalierbares Governance OS.

**Einordnung: 60/100 — MVP an der oberen Schwelle zur verkaufsfähigen Beta.**

Begründung: Die Mehrzahl der Governance-Module ist auf SaaS-Produktniveau (echte CRUD, Backend, RLS). Aber drei vertrauenskritische Views mit Fake-Daten, das nicht eingelöste PDF-Versprechen und die Conversion-Sackgasse der Startseite drücken den **wahrgenommenen** Reifegrad eines Käufers/Investors deutlich unter den **technischen**. Es ist **kein** reines Compliance-Tool mehr und mehr als ein Scanner — die OS-Ambition (Browser-Shell, Module, Evidence, Agents) ist sichtbar, aber noch nicht durchgängig echt.

---

## 10. Unternehmenswert heute (pre-revenue, 0 Kunden, Solo)

| Werttreiber | Einschätzung |
|---|---|
| Codewert (Wiederbeschaffung) | ~12–18 Personenmonate Senior-Arbeit → **100–180 k €** Bruttoaufwand, pre-revenue stark diskontiert |
| Produktwert | Funktionierender Kern in echtem Markt; ohne Traction abgewertet |
| Domain/Brand | minimal (neu, RealSyncDynamicsAI.de) |
| Technischer IP-Wert | überdurchschnittlich (Multi-Tenant-RLS, Evidence-Chain, Rule-Engine) |
| Marktposition | DACH-DSGVO/AI-Act: realer Markt, starke Wettbewerber (OneTrust, Usercentrics, Cookiebot, Iubenda, DataGuard) |
| Kundenfähigkeit | **eingeschränkt** durch K1–K4 |
| Umsatzfähigkeit | gegeben, sobald Stripe live + Trust-Fixes |
| Investor Readiness | **niedrig** (0 Umsatz, Solo, kein Team, keine Traction-Metriken) |

**Bewertung heute:**
- **Konservativ: 30.000–60.000 €** (reiner Asset-/Acqui-Hire-Wert, Investoren-Sicht pre-revenue)
- **Realistisch: 80.000–150.000 €** (starke, funktionierende Codebasis + verteidigbare Nische, nur Go-to-Market fehlt)
- **Optimistisch: 200.000–300.000 €** (strategischer Käufer zahlt für EU-souveränen Vorsprung + Feature-Breite)

---

## 11. Unternehmenswert nach Fixes (P0/P1 erledigt, weiterhin pre-revenue)

Nach Behebung von K1–K9 (echte Daten in allen Views, echtes PDF, Funnel-Fix, Stripe live verifiziert, Trial eingelöst) ist das Produkt eine **de-risked verkaufsfähige Beta**:

- **Realistisch: 150.000–250.000 €.** Der große Sprung kommt aber **erst mit Umsatz** — pre-revenue bleibt jede Bewertung asset-/potenzialgetrieben und damit gedeckelt.

---

## 12. Weg zur 1-Million-Euro-Bewertung

**Grundgleichung:** Bewertung = ARR × Multiple. Für €1 Mio bei **10× ARR** (realistisch für früh-SaaS in heißer Compliance-Nische; konservativ 5–8×, optimistisch 12–15×):

> **Ziel-ARR ≈ 100.000 € → MRR ≈ 8.333 €.**
> Konservativ abgesichert (bei 5–8× Multiple): **125.000–200.000 € ARR** anpeilen.

**Notwendige Kundenzahl (Beispiel-Mixe für ~8.300 € MRR):**

| Szenario | Mix | MRR | ARR |
|---|---|---|---|
| Growth-fokussiert | 34 × Growth (249 €) | 8.466 € | ~101 k € |
| Gemischt | 20 Starter + 15 Growth + 4 Agency | 8.111 € | ~97 k € |
| Agency-Hebel | 6 Agency (699) + 10 Growth + 12 Starter | 7.611 € | ~91 k € |

→ **~35–50 zahlende Kunden** genügen für die €1-Mio-Schwelle. Agenturen sind der schnellste Hebel (1 Agency-Kunde = 5–15 End-Domains).

**Preislogik-Empfehlung:** Free Audit (Lead) → Growth 249 € als beworbenes Hauptprodukt (höchster Deckungsbeitrag self-serve) → Agency 699 € als Multiplikator-Kanal → Scale/Enterprise via Sales. Starter 79 € nur als Einstiegsanker, nicht als Fokus.

**Meilensteine:**
1. **Produkt nutzbar** — K1–K3 fixen (echte Daten, echtes PDF, Funnel). *Voraussetzung für jeden Verkauf.*
2. **Checkout vollständig** — Stripe live verifizieren, Trial einlösen, Webhook-Fallback (K4–K6).
3. **Erste zahlende Kunden** — 5–10 Design-Partner aus dem Free-Audit-Funnel + Agentur-Outreach.
4. **Wiederkehrender Umsatz** — 35–50 Kunden, Churn < 5 %/Monat, MRR ~8,3 k €.
5. **Proof** — echte Reports, Evidence-Exporte, aktives Monitoring, 2–3 referenzierbare Case Studies + Retention-Daten als Investoren-Beleg.

---

## 13. 30-Tage-Umsetzungsplan (P0 — ohne das kein Verkauf)

| Tag | Aufgabe | Datei/Funktion |
|---|---|---|
| 1–3 | **Fake-Daten töten:** `useState(RISKS/AI_SYSTEMS)` → `useState([])`, echte Empty-States (Vorbild `GovernanceDashboardView`) | `RiskCenterView.tsx:970`, `AiSystemRegistryView.tsx:299`, `MonitoringRuntimeView.tsx:605`, `EvidenceVaultView.tsx:103` |
| 4–7 | **Echtes signiertes PDF** via Playwright-HTML→PDF + Signatur | `audit-report-pdf/index.ts` |
| 8–12 | **Homepage-Funnel:** Primär-CTA → `/audit`, Tiles verlinken, Trust-Elemente/Preis-Anker ergänzen | `PublicWorkspacePreview.tsx` |
| 13–16 | **Stripe live verifizieren** (Endpoint, Secret, Events) + `checkout.session.completed`-Fallback-Sync | Stripe-Dashboard + `stripe-webhook/index.ts:108` |
| 17–18 | **Trial einlösen:** `trial_period_days=14` default ODER CTA-Hrefs `?pilot=true` | `stripe-checkout/index.ts:124`, `pricing.ts` |
| 19–22 | **Persistenz-Stubs schließen** (Risk-Modal, AiSystem-handleSave, Evidence-Export) | jeweilige Views |
| 23–26 | **SEOHead route-weit rendern** + Meta pro Route | `App.tsx`, `SEOHead.tsx` |
| 27–30 | **2 verwaiste Crons aktivieren** + Smoke-Test des Full-Funnels (Scan→Signup→App→Checkout) | Monitoring/Sweeper-Migrations |

---

## 14. 90-Tage-Umsetzungsplan (P1/P2 — Beta-Kunden & Skalierung)

- **Agent-Layer real machen:** `governance_agents`-Tabelle + API, `AgentRegistryView`/`AgentsCenterView` anbinden; Anon-Copilot-Ops verdrahten (`governance-agent:940,993,1032`).
- **Entitlement-Dual-System konsolidieren** (bronze/silver/gold → starter/growth/agency), BillingView-Quota-Keys fixen (K10).
- **`ai-gateway`-Logging** in `ai_tool_runs` (K11), `cookie-scan-deep` Playwright-Service deployen (K12).
- **Go-to-Market:** Free-Audit als Lead-Engine schärfen, Agentur-Outreach (`/agenturen`), 5–10 Design-Partner onboarden, erste Case Studies.
- **Trust/Proof:** Evidence-Vault vollständig live, Monitoring-Drift-Alerts real, Status-/Trust-Seite mit echten Uptime-Daten.
- **Investoren-Data-Room:** Traction-Metriken (Scans, Signups, MRR, Retention), saubere Architektur-Doku.

---

## 15. Konkrete Code-Fix-Liste (Prioritäten)

| Prio | Aufgabe | Warum wichtig | Aufwand | Werthebel | Datei/Funktion |
|---|---|---|---|---|---|
| **P0** | Fake-Daten in 4 Views entfernen | Vertrauen/Haftung in Compliance-Tool | M | hoch | `RiskCenterView`, `AiSystemRegistryView`, `MonitoringRuntimeView`, `EvidenceVaultView` |
| **P0** | Echtes signiertes PDF | Bezahlte, zugesicherte Leistung | M | hoch | `audit-report-pdf/index.ts` |
| **P0** | Homepage-CTA → `/audit`, Tiles verlinken | Conversion-Sackgasse | S | hoch | `PublicWorkspacePreview.tsx` |
| **P0** | Stripe live verifizieren + Webhook-Fallback | sonst Zahlung ohne Freischaltung | S | kritisch | Stripe-Dashboard, `stripe-webhook:108` |
| **P1** | 14-Tage-Trial einlösen | Marketing-Versprechen ↔ Realität | S | mittel | `stripe-checkout:124`, `pricing.ts` |
| **P1** | Persistenz-Stubs schließen | „Buttons tun nichts" | M | mittel | diverse Views |
| **P1** | Agent-Tabelle + API | 2 reine Demo-Shells | L | mittel | neu `governance_agents` |
| **P1** | SEOHead route-weit | organische Sichtbarkeit | S | mittel | `App.tsx` |
| **P1** | 2 Crons aktivieren | Monitoring/Cleanup laufen nie | S | mittel | Monitoring/Sweeper-Migrations |
| **P2** | Entitlement-Konsolidierung | Quota-Verwirrung | M | niedrig | `20260430200000`/`20260618000000` |
| **P2** | ai-gateway Logging | CLAUDE.md-Compliance | S | niedrig | `aiGateway/anthropicAdapter.ts` |

---

## 16. Finale Bewertung 0–100

| Dimension | Score |
|---|---|
| Backend-Substanz | 82 |
| App/Governance-Module (gewichtet) | 68 |
| Public/Landing-Funnel | 52 |
| Checkout/Billing | 70 |
| Trust/Reife (Fake-Daten, PDF) | 45 |
| Investor Readiness (pre-revenue) | 25 |
| **Gesamt (Produkt + Geschäft)** | **57/100** |

**Kernbotschaft:** Die Technik ist 1-Mio-tauglich gebaut — das Geschäft ist es noch nicht. Der Engpass ist nicht Code-Quantität, sondern **Vertrauen + Traction**: erfundene Daten raus, Versprechen einlösen, Funnel öffnen, Stripe live, dann ~35–50 zahlende Kunden gewinnen. Erst Umsatz hebt die Bewertung über den asset-getriebenen Deckel von ~150–250 k € hinaus zur 1-Mio-€-Schwelle.

# RealSyncDynamics.AI — Phase C.6 Multi-Role Audit
**Datum:** 2026-06-24  
**Methode:** Codeanalyse (statisch) + Live-Datenbankabfragen (Supabase MCP)  
**Branch:** `claude/realsync-dynamics-audit-j5pkcl`  
**DB-Projekt:** `RealSyncDynamicsLive` (eu-central-1, Postgres 17, Status: ACTIVE_HEALTHY)  
**Basis-Report:** `docs/audit-report-2026-06-17.md`  
**Delta seit 2026-06-17:** +2 DSGVO-Audits, +2 Sales-Leads, 0 neue Subscriptions, kein einziger der 4 Go-Bedingungen erfüllt.

> **Methodik:** Alle Befunde basieren auf verifizierten Code-Pfaden oder Live-DB-Abfragen.  
> Browser-Klick-Tests, Mobile-Rendering und E-Mail-Delivery sind als «nicht im Browser getestet» markiert.  
> Keine Annahmen. Kein Loben. Nur Beweisen.

---

## Audit-Team: Sechs Rollen, ein Befund

| Rolle | Scope | Score (0–10) |
|-------|-------|-------------|
| 1. Testkäufer (Mystery Shopper) | User Journey: Landing → Audit → Checkout → Dashboard | 2 / 10 |
| 2. Senior QA Engineer | Feature-Vollständigkeit, Error Handling, Konsistenz | 4 / 10 |
| 3. DSGVO-Auditor | Consent, Privacy Policy, Formulare, Tracking | 7 / 10 |
| 4. Product Analyst | Feature-Reife, Market Fit, Roadmap-Abdeckung | 3 / 10 |
| 5. Conversion Optimizer | Funnel, CTAs, Drop-off, Post-Audit-Flow | 1 / 10 |
| 6. Technical Due Diligence | Code-Qualität, Sicherheit, Skalierbarkeit, Schulden | 6 / 10 |

---

## 1. Executive Summary

RealSyncDynamics.AI präsentiert sich als «Governance OS Browser» für DSGVO, EU AI Act, Monitoring und Evidence — EU-souverän, multi-tenant, mit einer technisch soliden Infrastruktur.

**Die Geschäftslage nach Live-DB (2026-06-24):**

```
gdpr_audits:         94  (+ 2 seit 17.06.)
sales_leads:         98  (+ 2 seit 17.06.)
subscriptions:        0  (unverändert)
tenants:              4  (unverändert, vermutlich Test-Accounts)
webhook_events:       n/a (kein checkout.session.completed je verarbeitet)
newsletter_confirmed: 0  (unverändert)
```

Das Produkt generiert Leads. Es konvertiert keine. Nach 7 Tagen wurden keiner der vier im Voraudit identifizierten Go-Bedingungen adressiert.

**Kernaussage:** Der Checkout-Code ist technisch lauffähig. Die Conversion-Pipeline ist vollständig inaktiv. Das Dashboard zeigt Demo-Daten. Sicherheits-Versprechen (AAL2) sind nicht eingelöst.

**Production Readiness Score: 38 / 100** (identisch 17.06.; kein Fortschritt messbar).  
**Empfehlung: NO-GO.**

---

## 2. Kritische Fehler

### K-1: 0 Zahlende Kunden — Konversionsstrecke funktional, aber nie genutzt

**Beweis (DB, 2026-06-24):**
```sql
SELECT COUNT(*) FROM subscriptions WHERE status IN ('active','trialing'); → 0
SELECT COUNT(*) FROM gdpr_audits; → 94
SELECT COUNT(*) FROM sales_leads; → 98
```
98 Leads erzeugt, 94 Scans durchgeführt — kein einziger Checkout abgeschlossen. Die Stripe-Price-IDs für Starter/Growth/Agency sind in der DB (`price_1TfsV8...`, `price_1TfsV4...`, `price_1TfsV9...`). Der Checkout-Code ist korrekt. Ursache ist nicht der Code — es ist das Fehlen von allem, was nach dem Audit passiert.

---

### K-2: E-Mail-Drip-Sequenz nicht aktiv — alle Leads verfallen unbearbeitet

**Beweis:**
```sql
SELECT COUNT(*) FROM newsletter_subscribers WHERE status = 'confirmed'; → 0
```
`audit-drip-cron` und `audit-report-email` existieren als Edge Functions. Ob zugehörige `pg_cron`-Jobs konfiguriert sind, konnte nicht bestätigt werden. 98 Leads erhalten kein automatisches Follow-up. Das Lead-Magnet-Modell (Audit → E-Mail-Sequenz → Upgrade) ist de facto deaktiviert.

---

### K-3: Scale-Tier (€1.999/Monat) hat keinen realen Stripe-Preis

**Beweis (DB):**
```
internal_default_scale → Scale (default) → scale
```
`stripe-checkout/index.ts:83`: `products.find(p => !p.stripe_price_id.startsWith('internal_default_'))` → `undefined` → `400 PRICE_NOT_CONFIGURED`.  
Scale-CTA auf Pricing-Page verlinkt auf `/contact-sales` (als Workaround korrekt dokumentiert im Code-Kommentar), aber jeder direkte Versuch `/checkout/scale` schlägt fehl.

---

### K-4: AAL2 ist «observe-only» — Security-Versprechen nicht eingelöst

**Beweis:**
```typescript
// supabase/functions/stripe-portal/index.ts:43
// P0d Phase 1 — OBSERVE ONLY: AAL2-Status protokollieren, NICHT blocken.
observeAal2(auth, 'stripe-portal');
```
```typescript
// src/core/access/mfa.ts (observeAal2-Funktion)
// Schreibt console.info — blockiert nicht.
```
Das Produkt vermarktet sich als Compliance- und Security-Werkzeug. Das Billing-Portal und der Evidence Vault sind in der Dokumentation als «AAL2-gesichert» beschrieben. Technisch ist das nicht korrekt: Ein Angreifer mit gültigem AAL1-JWT kann das Billing-Portal öffnen.

---

## 3. Hohe Priorität

### H-1: Agent Registry zeigt statische Demo-Daten im Live-Dashboard

**Beweis:**
```typescript
// src/features/governance/agents/AgentRegistryView.tsx:4,27
import { DEMO_AGENTS } from './demoAgents';
const agents: GovernanceAgent[] = DEMO_AGENTS;
// demoAgents.ts:29: lastRunAt: '2026-05-20T06:14:00.000Z'
```
Heute (24.06.) ist das Datum 35 Tage alt — für jeden eingeloggten Nutzer sofort erkennbar als Fake.

---

### H-2: DSGVO Control Pack zeigt Demo-Signale auf dem Haupt-Dashboard

**Beweis:**
```typescript
// src/features/workspace/WorkspaceHome.tsx:22
import { DEMO_CONTROL_SIGNALS } from '../governance/dsgvo-control-pack/dsgvoControlPackDemo';
```
Die Compliance-Signals auf `/app` sind hartcodierte Demodaten, keine echten Tenant-Abfragen.

---

### H-3: VvtView (Art.-30-DSGVO-Verarbeitungsverzeichnis) läuft mit `demo_data: true`

**Beweis:**
```typescript
// src/features/governance/vvt/RuntimeVvtView.tsx:58
demo_data: true,
```
Das Verarbeitungsverzeichnis ist ein gesetzlich erforderliches Dokument. Mit Demo-Daten ist es für Kunden wertlos und rechtlich nicht nutzbar.

---

### H-4: Veraltete Tier-Einträge (Bronze/Silver/Gold) in der Produkt-Tabelle

**Beweis (DB):**
```
price_1TSM39... → RealSync Bronze → bronze
price_1TSM3C... → RealSync Silver → silver  
price_1TSM3F... → RealSync Gold → gold
internal_default_bronze/silver/gold → default_for_plan_key: null
internal_default_enterprise_public → enterprise_public (kein Frontend-Match)
```
Alte Tier-Namen aus einer früheren Pricing-Iteration sind nicht bereinigt. 9 von 16 Produktzeilen in der DB sind entweder veraltet, sentinel-only oder ohne Frontend-Match.

---

### H-5: Impressum — USt-ID fehlt in Production

**Beweis:** `src/features/legal/Impressum.tsx` liest `VITE_BUSINESS_VAT_ID`. Wenn leer: «noch nicht vergeben». DEV-Banner supprimiert in PROD. Für B2B-Kunden und Auditoren wirkt das unprofessionell. Als Kleinunternehmer nach §19 UStG ist die Formulierung rechtlich korrekt, aber es fehlt ein expliziter «§19 UStG — Kleinunternehmerregelung»-Hinweis im Impressum-Text.

---

## 4. Mittlere Priorität

### M-1: `RemediationPlaceholder` in `/app/remediation` ist eine Dead End Route

**Beweis:** `src/components/governance-os/RemediationPlaceholder.tsx` wird an `/app/remediation` geroutet. Eingeloggte Nutzer navigieren in eine Sackgasse.

---

### M-2: CORS auf `*` in `stripe-checkout` Edge Function

**Beweis:**
```typescript
// stripe-checkout/index.ts:29
'Access-Control-Allow-Origin': '*',
```
JWT-Verifizierung begrenzt das Risiko. Dennoch: Jede Domain kann OPTIONS/POST anfragen. Für ein Compliance-Produkt ist Wildcard-CORS ein schwaches Signal.

---

### M-3: Stripe-Webhook — Idempotency-Row wird bei Handler-Fehler gelöscht (Retry-Loop-Risiko)

**Beweis:**
```typescript
// stripe-webhook/index.ts:118-121
await admin.from('webhook_events').delete().eq('id', event.id);
return new Response(`handler failed: ...`, { status: 500 });
```
Stripe wiederholt bei 500. Bei systematischen Handler-Fehlern entsteht eine Endlosschleife ohne Circuit-Breaker.

---

### M-4: `stripeDiagnostics.ts` — Debugging-Artefakt im Production-Build

**Beweis:** `src/features/billing/stripeDiagnostics.ts` ist im Bundle. Ob Tree-Shaking es entfernt, ist nicht verifiziert.

---

### M-5: Checkout-Fehlermeldung ist technischer Jargon

**Beweis:**
```typescript
// CheckoutPage.tsx:111
setCheckoutErr(result.error?.message ?? 'Unbekannter Fehler beim Checkout');
```
Wenn die Edge Function `PRICE_NOT_CONFIGURED` zurückgibt (z. B. Scale-Plan), sieht der Endkunde englischen technischen Text.

---

### M-6: RLS-Tabellen ohne Policies (Supabase Advisor: INFO)

**Beweis (Security Advisor):**
```
public.ai_evidence_retention — RLS enabled, no policies
public.enterprise_agent_policies — RLS enabled, no policies
public.enterprise_ai_audit_events — RLS enabled, no policies
public.enterprise_founders_access — RLS enabled, no policies
public.enterprise_feedback_reports — RLS enabled, no policies
+ mehrere runtime_events_* Partitionen
```
Tabellen mit RLS aktiviert aber ohne Policies sind de facto für alle authentifizierten Nutzer gesperrt — aber auch für Service-Role-Keys, wenn nicht korrekt konfiguriert. Bei Enterprise-Features sind das potenzielle Silent Failures.

---

### M-7: Materialized Views — Supabase Advisor WARN

**Beweis:**
```
mv_cost_per_agent, mv_cost_per_tenant, mv_cost_per_feature,
mv_tenant_risk_cost_quadrant, mv_tenant_risk_score,
mv_compliance_signals_open — alle WARN
```
Materialized Views haben entweder keine SECURITY DEFINER, keine Index-Strategie oder laufen ohne Refresh-Schedule. Bei 0 Tenants ist das latentes Problem, das bei Skalierung sichtbar wird.

---

## 5. Niedrige Priorität

### N-1: 30+ Nischen-Landingpages und Competitor-Doorways ohne verifizierten Content

7 Competitor-Doorways (`/onetrust-alternative`, `/usercentrics-alternative` etc.) und 15+ Branchen-Pages sind geroutet. Content-Qualität und SEO-Effektivität nicht geprüft (kein Browser-Test).

### N-2: `internal_default_enterprise_public` — verwaiste Produktzeile

DB-Eintrag mit `default_for_plan_key: 'enterprise_public'` — kein Match im Frontend-Pricing-Config (`TierId`). Keine Runtime-Auswirkung, aber Verwirrungspotenzial in DB-Queries.

### N-3: Changelog/Roadmap-Seiten ungeprüft

`/changelog` und `/roadmap` sind öffentliche Routen. Ob Content vorhanden und aktuell ist, wurde nicht getestet.

---

## 6. UX-Probleme

**UX-1: 50+ Routen ohne klare Discovery-Hierarchie**  
Das Produkt hat >50 öffentliche Routen: SEO-Doorways, freie Tools, Dashboard-Bereiche, Legal-Seiten. Ein Erstbesucher kann nicht erkennen, was die primäre Funktion ist. Die Navigation ist für SEO-Crawling optimiert, nicht für Erstbesucher-Conversion.

**UX-2: Kein Upgrade-CTA im Audit-Ergebnis**  
Nach einem Audit-Scan (`/audit/result/:id`) gibt es keinen inline sichtbaren Upgrade-Pfad mit konkretem Nutzenversprechen. Höchster Intent-Moment im Funnel — ohne CTA.

**UX-3: Demo-Agent-Daten veralten täglich sichtbar**  
`DEMO_AGENTS` hat `lastRunAt: '2026-05-20'` — heute 35 Tage alt, für jeden eingeloggten Nutzer sofort erkennbar.

**UX-4: Login-Gate vor Checkout ohne Motivation**  
Der Checkout erfordert Account + Tenant-Erstellung. Ohne Wertversprechen nach der Registrierung bricht die Mehrzahl der Nutzer hier ab.

**UX-5: Scale-Plan-CTA («Enterprise anfragen») verwirrt**  
Scale (€1.999/Monat) und Enterprise («individuell ab €1.500») zeigen denselben CTA-Text. Ein Nutzer, der Scale kaufen will, wird auf `/contact-sales?tier=scale` geschickt — ohne Unterschied zum Enterprise-Pfad erkennbar.

---

## 7. DSGVO-Probleme

| Punkt | Status | Priorität |
|-------|--------|-----------|
| Datenschutzerklärung (Art. 13/14) | ✅ Vollständig, alle Pflichtabschnitte | — |
| Impressum (§5 TMG) | ⚠️ USt-ID «noch nicht vergeben» | Mittel |
| Cookie Consent (TTDSG §25) | ✅ Korrekt umgesetzt, Buttons equal-width | — |
| Analytics-Tracking vor Consent | ✅ Gating via `applyConsent()` in `pixels.ts` | — |
| Newsletter DOI (§7 UWG) | ✅ Double-Opt-In via Resend | — |
| Drittlandtransfer (Art. 46) | ✅ SCCs + EU-US DPF dokumentiert | — |
| Verarbeitungsverzeichnis Art. 30 | ❌ `demo_data: true` in VvtView | Hoch |
| AAL2 für privilegierte Bereiche | ❌ Observe-only, nicht enforced | Kritisch |
| RLS ohne Policies (ai_evidence_retention, enterprise_*) | ⚠️ Supabase Advisor INFO | Mittel |
| AI-Tool-Logging (Art. 6 + DSGVO-AI-Act) | ✅ `ai_tool_runs` + `workflow_runs` korrekt | — |

**Gesamtbewertung DSGVO: 7 / 10** — Eigener Betrieb gut aufgestellt. VvtView-Demo und AAL2 sind die verbleibenden Lücken.

---

## 8. Funnel-Probleme

```
Besucher → Audit (/audit)          ✅ funktioniert (94 Scans)
        ↓
Scan → Report                       ✅ funktioniert
        ↓
Report → Upgrade-CTA                ❌ kein Inline-CTA im Ergebnis
        ↓
Upgrade → E-Mail-Capture            ✅ E-Mail wird beim Scan erfasst
        ↓
E-Mail → Drip-Sequenz               ❌ 0 bestätigte Abonnenten, Drip unklar
        ↓
Drip → Trial / Checkout             ❌ kein Drip = kein Trigger
        ↓
Checkout → Stripe                   ⚠️ Code OK, nie genutzt (0 Checkouts)
        ↓
Stripe → Dashboard                  ❌ Dashboard zeigt Demo-Daten
        ↓
Dashboard → Monitoring              ⚠️ technisch vorhanden, Demo-Daten
```

**Abbruchpunkte (nach Schwere):**
1. **Report → Upgrade-CTA**: Fehlender Inline-CTA nach Scan (höchster Intent-Moment)
2. **E-Mail → Drip**: Kein automatisches Follow-up (0 Conversions)
3. **Dashboard nach Login**: Demo-Daten erzeugen sofortigen Vertrauensverlust

---

## 9. Stripe-Probleme

| Element | Status | Details |
|---------|--------|---------|
| Starter-Price `price_1TfsV8...` | ✅ Echt | €79/Monat, korrekt |
| Growth-Price `price_1TfsV4...` | ✅ Echt | €249/Monat, korrekt |
| Agency-Price `price_1TfsV9...` | ✅ Echt | €699/Monat, korrekt |
| Scale-Price | ❌ Sentinel | `internal_default_scale` → checkout bricht |
| Enterprise | ✅ By Design | → /contact-sales |
| Trial (14 Tage) | ⚠️ Code OK | `pilot=true` param nötig, nicht als Standard-Flow surfaced |
| Success URL | ✅ | `{base}/checkout/success?session_id=...&plan_key=...` |
| Cancel URL | ✅ | `{base}/pricing?checkout=cancelled` |
| Webhook `checkout.session.completed` | ❌ Nie ausgelöst | 0 Checkouts in DB |
| Customer Portal | ⚠️ Code OK | AAL2 observe-only |
| CORS in `stripe-checkout` | ⚠️ | Wildcard `*` |
| Alte Tier-Prices (Bronze/Silver/Gold) | ⚠️ | DB-Einträge ohne Frontend-Match |

**Kritische Frage:** Hat die Stripe-Webhook-URL im Stripe-Dashboard die korrekte Supabase-Edge-Function-URL? Die 4 verarbeiteten Webhook-Events sind ausschließlich `v2.core.event_destination.ping` (Verbindungstest). Es wurde kein einziger Payment-Event verarbeitet.

---

## 10. Dashboard-Probleme

| Dashboard-Bereich | Datenquelle | Status |
|-------------------|-------------|--------|
| WorkspaceHome (`/app`) — Compliance-Score | Real DB (Counts) | ✅ |
| WorkspaceHome — DSGVO Control Pack | `DEMO_CONTROL_SIGNALS` | ❌ Demo |
| Agent Registry (`/app/ai-systems`) | `DEMO_AGENTS` (TypeScript Array) | ❌ Demo |
| VvT Verarbeitungsverzeichnis | `demo_data: true` | ❌ Demo |
| Incidents, DPIAs, DSR, Approvals, Vendors | Real DB | ✅ |
| Evidence Vault (`/app/evidence`) | Real DB, AAL2 gate | ⚠️ AAL2 observe-only |
| Remediation (`/app/remediation`) | Placeholder | ❌ Kein Feature |
| Governance Events, Assets, Policies | Real DB | ✅ |

**3 von 8 geprüften Dashboard-Bereichen zeigen Demo-Daten** — in denjenigen, die für einen Erstbesucher nach Login am prominentesten sichtbar sind.

---

## 11. Evidence-Probleme

**Produktversprechen:**
- Hash-Chain mit Ed25519-Signaturen pro Tenant
- RFC-3161-Timestamps
- Immutable Evidence Records
- Regulator-Export-Packs
- «AAL2-gesichert»

**Tatsächliche Funktion (aus Code):**
- `AuditorConsoleView.tsx` ist vollständig implementiert (kein Placeholder)
- `auditorConsoleApi.ts` hat `verifyHashChain()`, `fetchTenantQuadrant()`, `fetchRacpo()`, `fetchSubjectExport()`, `buildExportBundle()`
- AAL2-Gate: **OBSERVE-ONLY** — nicht enforced
- Pilot W2+ Gate in Doku erwähnt, aber kein expliziter Plan-Tier-Check im gezeigten Code
- Bei 0 Subscriptions: kein Mandant hat Zugang getestet

**Fazit:** Die Evidence-Infrastruktur ist im Code korrekt entworfen. Die Sicherheitsversprechen (AAL2) sind nicht eingelöst. Bei 0 Kunden ist «nicht getestet» der Ist-Zustand.

---

## 12. Conversion-Probleme

**Warum sollte ein Besucher kaufen?**
- Kostenloser Scan liefert sofortigen Wert (DSGVO-Score + Befunde)
- EU-Hosting, DSGVO-compliant
- Bekannte Konkurrenten explizit adressiert (Competitor-Doorways)
- Preis im DACH-Sweet-Spot (€79 < Cookiebot Premium €110)

**Warum sollte er NICHT kaufen?**
- Kein Social Proof, keine Testimonials, keine Case Studies nachgewiesen
- Nach dem Scan: kein direkter «Jetzt upgraden und X Probleme lösen»-CTA
- Nach dem Login: sofortiger Vertrauensverlust durch Demo-Daten
- E-Mail-Follow-up kommt nicht an (0 bestätigte Subs)
- Trial (14 Tage) ist versteckt — nur via `?pilot=true` Parameter aktivierbar
- Scale-Tier «nicht kaufbar» — erzeugt Misstrauen gegenüber allen anderen Tiers

**Fehlende Conversion-Elemente:**
1. Inline-Upgrade-CTA im Audit-Ergebnis («Wir würden 8 Ihrer 12 Findings mit Growth-Plan automatisch beheben»)
2. E-Mail-Drip (dringend)
3. Trial standardmäßig im Checkout-Flow
4. Mindestens 2 Testimonials auf der Pricing-Page
5. Demo-Workspace mit korrekten Beispieldaten statt veraltenden Demo-Agenten

---

## 13. Fehlende Features (für zahlenden Launch)

| # | Feature | Aufwand | Blockiert |
|---|---------|---------|-----------|
| 1 | **E-Mail-Drip aktivieren** (Cron + Resend) | 1–2 h | Gesamten Lead-Follow-up |
| 2 | **Upgrade-CTA im Audit-Ergebnis** | 3–5 h | Höchsten Intent-Moment |
| 3 | **Demo-Daten aus Dashboard entfernen** (Agents, Control Pack) | 2–4 h | Nutzer-Vertrauen nach Login |
| 4 | **VvtView `demo_data: false`** | 30 min | Rechtlich nutzbarres VvT |
| 5 | **Scale-Preis in Stripe anlegen + DB eintragen** | 30 min + Stripe-Dashboard | Scale-Checkout |
| 6 | **AAL2 von observe → enforce** | 4–8 h | Security-Versprechen |
| 7 | **Onboarding-Flow nach Login** | 1 Tag | Post-Registration-Abbruch |
| 8 | **Trial standardmäßig im Checkout** | 2 h | Kaufhürde senken |
| 9 | **Remediation-Placeholder ersetzen oder Route deaktivieren** | 1 h | Dead-End-Route |
| 10 | **Webhook End-to-End testen** | 2 h | Zahlungsverarbeitung verifizieren |

---

## 14. Produkt-Roadmap (IST vs. SOLL)

### IST-Zustand (2026-06-24)
```
✅ Freier Lead-Magnet-Audit funktioniert (94 Scans)
✅ Checkout-Code für Starter/Growth/Agency technisch korrekt
✅ Reale Stripe-Price-IDs in DB vorhanden
✅ DSGVO-Compliance des eigenen Produkts gut umgesetzt
✅ Umfangreiche öffentliche Tool-Suite (50+ Routen, 12 freie Tools)
✅ Supabase-Infrastruktur stabil (eu-central-1, ACTIVE_HEALTHY)
✅ WorkspaceHome: echte DB-Counts (keine Demo-Zahlen)
❌ 0 zahlende Kunden, 0 € MRR
❌ E-Mail-Follow-up inaktiv (0 bestätigte Newsletter-Subs)
❌ Agent Registry zeigt Demo-Daten (35 Tage alt)
❌ VvtView demo_data: true
❌ DSGVO Control Pack Demo-Signale auf Haupt-Dashboard
❌ AAL2 nicht enforced
❌ Scale-Checkout blockiert
❌ 0 Go-Bedingungen aus Voraudit (17.06.) erfüllt
```

### Produkt-Vision (aus Codebase / CLAUDE.md)
«EU-souveräne SaaS-Plattform für Creator und Agenturen. Provenienz (C2PA), AI-Workflows, VPS-Operations — Multi-Tenant.» Das Produkt ist architektonisch konsequent auf diese Vision ausgerichtet. Die Lücke ist nicht die Vision — es ist der Schritt von «lauffähigem Code» zu «bezahlendem Kunden».

### SOLL-Zustand (Launch-ready)
```
[ ] Mindestens 1 erfolgreich abgeschlossener End-to-End-Checkout
[ ] Audit-Drip-E-Mail nachweislich aktiv (Resend-Logs)
[ ] Dashboard ohne Demo-Daten für eingeloggte Nutzer
[ ] AAL2 enforced für Evidence Vault und Billing Portal
[ ] MRR > 0 €
```

---

## 15. Konkrete Umsetzungsschritte

### Sofort (< 2 Stunden Gesamtaufwand)
1. **Scale-Preis anlegen:** Stripe-Dashboard → neuen Preis für Scale (€1.999/Monat) anlegen → UUID notieren
   ```sql
   UPDATE public.products 
   SET stripe_price_id = 'price_DEIN_REAL_SCALE_PREIS'
   WHERE default_for_plan_key = 'scale';
   ```
2. **E-Mail-Test:** Einen eigenen Scan auf `/audit` durchführen → prüfen, ob eine Drip-E-Mail ankommt
3. **Cron-Status prüfen:** Supabase Dashboard → Database → Extensions → `pg_cron` → prüfen ob `audit-drip-cron` als Job registriert ist
4. **VvtView:** `demo_data: true` → `false` in `src/features/governance/vvt/RuntimeVvtView.tsx:58`

### Kurzfristig (1–2 Arbeitstage)
5. **Agent Registry:** `AgentRegistryView.tsx:27` — `DEMO_AGENTS` durch DB-Query auf `governance_agents` ersetzen
6. **DSGVO Control Pack:** `WorkspaceHome.tsx` — `DEMO_CONTROL_SIGNALS` durch echte Tenant-Abfrage ersetzen
7. **Upgrade-CTA im Audit-Ergebnis** (`AuditResultPage.tsx`) — «Mit Growth-Plan würden wir X Ihrer Y Findings automatisch beheben» + Button → `/checkout/growth`
8. **AAL2 enforce:** `observeAal2()` → `requireAal2()` in `stripe-portal/index.ts` und `evidence-export/`

### Mittelfristig (1–2 Wochen)
9. **End-to-End-Checkout** manuell mit echter Kreditkarte testen (Starter/Growth/Agency)
10. **Pilot-Trial standardmäßig aktivieren** — `pilot=true` als Default in `CheckoutPage.tsx`
11. **Onboarding-Flow** nach erstem Login implementieren
12. **Social Proof** — 2 Testimonials auf `/pricing`
13. **Alte DB-Zeilen bereinigen:** Bronze/Silver/Gold + `enterprise_public` aus `public.products`
14. **Remediation:** Route deaktivieren oder Funktion implementieren
15. **CORS einschränken:** `stripe-checkout` auf `SITE_URL` statt `*`

---

## 16. Top 10 Maßnahmen nach ROI

| Rang | Maßnahme | Aufwand | Erwarteter Impact |
|------|----------|---------|------------------|
| **1** | E-Mail-Drip nach Audit aktivieren | 1–2 h | Follow-up für 98 bestehende Leads; direktester Weg zu erster Conversion |
| **2** | Upgrade-CTA im Audit-Ergebnis | 3–5 h | Höchster Intent-Moment im gesamten Funnel |
| **3** | Demo-Daten aus Dashboard entfernen (Agents + Control Pack) | 2–4 h | Verhindert Vertrauensverlust bei jedem eingeloggten Nutzer |
| **4** | End-to-End-Checkout manuell testen (1× echte Kreditkarte) | 2 h | Bestätigt oder widerlegt, ob Starter/Growth/Agency wirklich kaufbar sind |
| **5** | Scale-Preis in Stripe + DB eintragen | 30 min | Öffnet 4. Tier; Signal an alle Pricing-Page-Besucher, dass alle Preise real sind |
| **6** | Trial als Standard-Flow im Checkout | 2 h | Senkt Kaufhürde massiv; «14 Tage kostenlos» ist stärkster Conversion-Trigger |
| **7** | AAL2 von observe auf enforce | 4–8 h | Einlösen des Sicherheits-Versprechens; Pflicht vor B2B-Enterprise-Sales |
| **8** | VvtView `demo_data: false` | 30 min | Art.-30-DSGVO-Pflichtdokument nutzbar machen |
| **9** | Onboarding-Guide nach Login | 1 Tag | Reduziert Post-Signup-Abbruch |
| **10** | Alte DB-Zeilen bereinigen (Bronze/Silver/Gold) | 30 min | Reduziert Verwirrung; schnelle Hygiene |

---

## 17. Production Readiness Score

| Bereich | Punkte | Max | Begründung |
|---------|--------|-----|-----------|
| Technische Infrastruktur | 12 | 15 | Supabase stabil, Edge Functions deployt, Stripe-Prices vorhanden |
| Checkout-Funnel | 5 | 15 | Code korrekt, aber 0 Checkouts, Scale-Tier defekt, Trial versteckt |
| E-Mail & Lead-Follow-up | 1 | 10 | 0 bestätigte Abonnenten, Drip-Status unklar |
| Dashboard-Qualität | 3 | 15 | Demo-Daten an 3 von 8 geprüften Stellen |
| DSGVO / Legal-Compliance | 8 | 10 | Gut; VvT-Demo und AAL2 als Lücken |
| Conversion-Optimierung | 2 | 10 | Kein Drip, kein Inline-CTA, kein Trial-Standard |
| Sicherheit | 4 | 10 | AAL2 observe-only, CORS auf *, solide Grundabsicherung |
| Produktreife | 3 | 15 | Ambitionierte Roadmap, mehrere Demo-Placeholder im Live-Produkt |
| **Gesamt** | **38** | **100** | |

**Score identisch mit Voraudit (17.06.): Kein messbarer Fortschritt in 7 Tagen.**

---

## 18. Go / No-Go Empfehlung

### NO-GO

**Das Produkt darf nicht in bezahlter Werbung oder aktivem Sales skaliert werden.**

**Begründung:**
- **0 € MRR** bei 98 Leads und funktionierendem Checkout-Code — das Problem ist die Conversion-Strecke, nicht der Checkout-Code selbst
- **Demo-Daten im Live-Dashboard** — jeder eingeloggte Nutzer erkennt sofort, dass das Produkt nicht «echt» ist
- **0 E-Mail-Follow-up** — der einzige Mechanismus, der Leads zu Kunden macht, ist inaktiv
- **Sicherheitsversprechen nicht eingelöst** — AAL2 observe-only in einem Compliance-Produkt ist ein Glaubwürdigkeitsproblem

**Go-Bedingungen** (gleich wie 17.06. — keine wurde erfüllt):

- [ ] **Checkout bestätigt:** Mindestens 1 erfolgreicher End-to-End-Checkout mit echter Kreditkarte (Starter, Growth oder Agency)
- [ ] **E-Mail aktiv:** `audit-drip-cron` nachweislich aktiv — Resend-Logs zeigen gesendete Follow-up-E-Mails nach Audit
- [ ] **Demo-Daten entfernt:** `DEMO_AGENTS` und `DEMO_CONTROL_SIGNALS` durch echte DB-Abfragen ersetzt
- [ ] **AAL2 enforced:** `requireAal2()` statt `observeAal2()` für Evidence Vault und Billing Portal

**Zeitaufwand für alle 4 Bedingungen: 1–2 Arbeitstage.**

Das Produkt ist technisch näher an Launch-Ready als der Score zeigt. Die Blocker sind klein und klar definiert. Es fehlt die Ausführung, nicht die Architektur.

---

## Anhang: Delta 2026-06-17 → 2026-06-24

| Metrik | 17.06. | 24.06. | Delta |
|--------|--------|--------|-------|
| `gdpr_audits` | 92 | 94 | +2 |
| `sales_leads` | 96 | 98 | +2 |
| `subscriptions` (active/trialing) | 0 | 0 | ±0 |
| `newsletter_confirmed` | 0 | 0 | ±0 |
| Go-Bedingungen erfüllt | 0/4 | 0/4 | ±0 |
| Production Readiness Score | 38/100 | 38/100 | ±0 |

**Fazit:** 7 Tage vergangen. 2 Leads gewonnen. Nichts repariert. Kein Umsatz.

---

*Bericht erstellt: 2026-06-24 · Phase C.6 Multi-Role Audit · Methode: Code-Analyse + Live-DB-Abfragen (Supabase MCP) · Auditor: Claude (Sonnet 4.6)*

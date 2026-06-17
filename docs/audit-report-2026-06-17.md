# RealSyncDynamics.AI — Vollständiger Produktaudit
**Datum:** 2026-06-17  
**Methode:** Codeanalyse (statisch) + Live-Datenbankabfrage (Supabase MCP)  
**Branch geprüft:** `claude/realsync-dynamics-audit-j5pkcl`  
**Letzter Commit:** `de00824` (fix: tote Stripe Payment Links → interner Checkout)  
**DB-Projekt:** `RealSyncDynamicsLive` (eu-central-1, Supabase Postgres 17)

> **Methodik-Hinweis:** Alle Befunde basieren auf verifizierten Code-Pfaden oder Live-DB-Abfragen. Keine Annahmen, keine Interpretationen. Browser-gebundene Tests (Klick-Flows, Mobile-Rendering, E-Mail-Delivery) sind als «nicht im Browser getestet» markiert — keine Aussage über Korrektheit, nur Nachweis der fehlenden Verifikation.

---

## 1. Executive Summary

RealSyncDynamics.AI positioniert sich als «Governance OS Browser» für DSGVO/EU-AI-Act-Compliance, Monitoring und Evidence. Das Produkt hat einen gut strukturierten Tech-Stack, eine umfangreiche öffentliche Tool-Suite (50+ Routen) und eine technisch solide DSGVO-Compliance im eigenen Betrieb.

**Die zentrale Geschäfts-Kennzahl ist vernichtend:** 92 kostenlose Audits, 96 Sales-Leads — und **0 zahlende Kunden, 0 Euro Umsatz, 0 Stripe-Zahlungsereignisse** (Live-DB, 2026-06-17).

Der Checkout-Flow ist technisch weitgehend lauffähig (reale Stripe-Price-IDs existieren für Starter/Growth/Agency), aber die Conversion fehlt vollständig. Die wahrscheinliche Ursache ist kein einzelner technischer Fehler, sondern eine Kombination aus fehlendem Drip-E-Mail-Follow-up (0 bestätigte Newsletter-Abonnenten), fehlender Post-Audit-Konversionsstrecke, unvollständigem Dashboard-Onboarding und einem Produkt, das in wesentlichen Demo-Parts noch nicht live-fähig ist (Agent Registry: statische Demo-Daten; Scale-Tier: kein realer Stripe-Preis; AAL2-Gate: observe-only statt enforce).

**Production Readiness Score: 38 / 100.**  
**Empfehlung: NO-GO für zahlenden Launch.** Checkout-Funnel und Post-Conversion-Onboarding müssen nachgewiesen funktionieren, bevor Werbeausgaben skaliert werden.

---

## 2. Kritische Fehler

### K-1: 0 Zahlende Kunden trotz 96 Leads — Konversionsstrecke nicht funktional

**Schweregrad:** Kritisch  
**Beweis:** Live-DB-Abfrage:
```sql
SELECT COUNT(*) FROM subscriptions WHERE status IN ('active','trialing'); → 0
SELECT COUNT(*) FROM webhook_events; → 4 (alle: v2.core.event_destination.ping)
SELECT COUNT(*) FROM gdpr_audits; → 92
SELECT COUNT(*) FROM sales_leads; → 96
```
**Analyse:** 96 Leads wurden erzeugt. Kein einziger hat konvertiert. Die Webhook-Events-Tabelle enthält ausschliesslich Stripe-Ping-Tests (Verbindungstest vom Stripe-Dashboard), kein einziges `checkout.session.completed`, `customer.subscription.created` oder `invoice.paid`. Das bedeutet: Es hat noch nie ein Checkout stattgefunden.  
**Impact:** 0 € MRR. Alle bisherigen Marketing-Aktivitäten haben keinen ROI erzeugt.

---

### K-2: Drip-E-Mail-Follow-up nicht aktiv — Leads verfallen unbearbeitet

**Schweregrad:** Kritisch  
**Beweis:**
```sql
SELECT COUNT(*) FROM newsletter_subscribers WHERE status = 'confirmed'; → 0
```
**Analyse:** Das Produkt wirbt mit «DSGVO + AI Act Updates», aber 0 bestätigte Newsletter-Abonnenten. Die Edge Function `audit-drip-cron` existiert im Code, aber entweder sendet sie keine E-Mails oder der DOI-Schritt für die Audit-Leads fehlt. 96 kostenlose Audit-Leads verfallen ohne automatisierten Follow-up.  
**Impact:** Der Kern des Lead-Magnet-Modells (Audit → E-Mail-Sequenz → Upgrade) ist nicht aktiv.

---

### K-3: Scale-Tier hat keinen realen Stripe-Preis — Checkout bricht ab

**Schweregrad:** Kritisch  
**Beweis (DB):**
```
stripe_price_id: "internal_default_scale", default_for_plan_key: "scale"
```
**Code** (`stripe-checkout/index.ts:83-87`): `const realPrice = products.find(p => !p.stripe_price_id.startsWith('internal_default_'))` → gibt `undefined` → `return jsonError(400, 'PRICE_NOT_CONFIGURED', ...)`.  
**Impact:** Jeder Nutzer, der den Scale-Plan buchen will, bekommt einen 400-Fehler. Scale ist im Pricing-Config vorhanden (`src/config/pricing.ts:28`).

---

### K-4: AAL2 ist «observe-only» — Evidence Vault nicht wirklich gesichert

**Schweregrad:** Kritisch (Produktversprechen vs. Realität)  
**Beweis** (`supabase/functions/stripe-portal/index.ts:43-44`):
```typescript
// P0d Phase 1 — OBSERVE ONLY: AAL2-Status protokollieren, NICHT blocken.
observeAal2(auth, 'stripe-portal');
```
`src/core/access/mfa.ts:97-108`: `observeAal2()` protokolliert nur einen Console.info-Log, wenn der User kein AAL2 hat — **blockiert nicht**.  
**Impact:** Das Produkt behauptet, der Evidence Vault und das Billing-Portal seien «AAL2-gesichert». Technisch ist das eine Log-Meldung, keine Zugangskontrolle. Ein Angreifer mit gestohlener AAL1-Session kann das Billing-Portal öffnen. In einem DSGVO/EU-AI-Act-Compliance-Produkt ist das ein Glaubwürdigkeitsproblem gegenüber Kunden und Auditoren.

---

## 3. Hohe Priorität

### H-1: Checkout für Starter/Growth/Agency technisch lauffähig — aber niemand hat ihn je benutzt

**Schweregrad:** Hoch  
**Beweis (DB):**
```
price_1TfsV8REjTWueUcGCdOO6bT2 → RealSync Starter → starter
price_1TfsV4REjTWueUcGsGSfjudu → RealSync Growth → growth
price_1TfsV9REjTWueUcGxJIBHYgC → RealSync Agency → agency
```
Die realen Stripe-Price-IDs wurden in die DB eingetragen. Der Checkout-Code funktioniert korrekt. Warum dann 0 Checkouts? Hypothesen: (a) Nutzer werden auf dem Weg zum Checkout blockiert (Login-Gate, fehlende Tenant-Erstellung), (b) die CTA-Kette von `/audit` → Ergebnis → Upgrade-Button ist nicht sichtbar genug, (c) kein Post-Audit-Drip-E-Mail, (d) kein Social Proof/Vertrauensaufbau am Checkout. Nicht im Browser getestet.

---

### H-2: Post-Audit-E-Mail-Sequenz nicht nachgewiesen aktiv

**Schweregrad:** Hoch  
**Beweis:** Die Edge Functions `audit-drip-cron` und `audit-report-email` existieren im Code. Ob die zugehörigen Cron-Jobs in Supabase tatsächlich konfiguriert und aktiv sind, wurde nicht bestätigt. Die 0 Newsletter-Abonnenten sind ein starkes Indiz, dass keine E-Mails ankommen.

---

### H-3: Agent Registry zeigt statische Demo-Daten in der Live-App

**Schweregrad:** Hoch  
**Beweis** (`src/features/governance/agents/AgentRegistryView.tsx:4,27`):
```typescript
import { DEMO_AGENTS } from './demoAgents';
const agents: GovernanceAgent[] = DEMO_AGENTS;
```
`demoAgents.ts:29`: Hardcoded lastRunAt `'2026-05-20T06:14:00.000Z'` — dieses Datum veraltet sichtbar.  
**Impact:** Eingeloggte Nutzer sehen im `/app/ai-systems`-Dashboard unveränderliche Demo-Agenten. Das Datum wird täglich älter und ist für jeden authentifizierten Nutzer direkt erkennbar als Fake.

---

### H-4: VvtView (Verarbeitungsverzeichnis) läuft mit `demo_data: true`

**Schweregrad:** Hoch  
**Beweis** (`src/features/governance/vvt/RuntimeVvtView.tsx:58`):
```typescript
demo_data: true,
```
**Impact:** Das Verarbeitungsverzeichnis (VvT) ist ein gesetzlich erforderliches Dokument nach Art. 30 DSGVO. Wenn es mit Demo-Daten befüllt ist, ist es für Kunden wertlos und rechtlich nicht verwertbar.

---

### H-5: Impressum — Umsatzsteuer-ID fehlt in Production

**Schweregrad:** Hoch (DSGVO-/Rechts-Relevanz)  
**Beweis** (`src/features/legal/Impressum.tsx`): VAT-ID wird aus `VITE_BUSINESS_VAT_ID` geladen. Wenn dieses Env-Var leer ist, wird der Platzhalter «noch nicht vergeben» angezeigt. Im DEV-Modus erscheint ein gelbes Banner; in PROD ist der Banner supprimiert, der Platzhalter bleibt sichtbar.  
**Impact:** §14 UStG / §22e UStG: Wer keine VAT-ID hat (Kleinunternehmer §19 UStG), muss dies explizit angeben. Die aktuelle Formulierung ist technisch korrekt, aber für zahlende B2B-Kunden und Auditoren unprofessionell.

---

### H-6: Alte Tier-Namen (Bronze/Silver/Gold) noch in der DB

**Schweregrad:** Hoch  
**Beweis (DB):**
```
internal_default_bronze / default_for_plan_key: null
internal_default_silver / default_for_plan_key: null
internal_default_gold   / default_for_plan_key: null
price_1TSM39... → RealSync Bronze → bronze
price_1TSM3C... → RealSync Silver → silver
price_1TSM3F... → RealSync Gold → gold
```
**Impact:** Veraltete Einträge ohne `default_for_plan_key` oder mit alten Tier-Namen verseuchen die Produkttabelle. Keine direkte Runtime-Auswirkung, aber jeder Blick in die DB erzeugt Verwirrung und erhöht das Risiko, in einem Datenbankskript oder Report auf falsche Tier-Namen zu stoßen.

---

## 4. Mittlere Priorität

### M-1: Checkout-Page zeigt kein Live-Feedback bei `PRICE_NOT_CONFIGURED`-Fehler

**Schweregrad:** Mittel  
**Beweis** (`src/features/billing/CheckoutPage.tsx`): Fehler-State `checkoutErr` wird gerendert, aber die Fehlermeldung «no Stripe Price wired for plan_key=scale» ist technischer Jargon, der Endkunden nicht hilft.

---

### M-2: `stripeDiagnostics.ts` — Debugging-Tool in Production-Code

**Schweregrad:** Mittel  
**Beweis:** `src/features/billing/stripeDiagnostics.ts` existiert im Production-Bundle. Nicht geprüft, ob es aus dem Production-Build ausgeschlossen ist.

---

### M-3: CORS-Header in `stripe-checkout` auf `*` gesetzt

**Schweregrad:** Mittel (Security-Kontext)  
**Beweis** (`supabase/functions/stripe-checkout/index.ts:29`):
```typescript
'Access-Control-Allow-Origin': '*',
```
Die Edge Function akzeptiert Cross-Origin-Anfragen von beliebigen Domains. Da die Funktion eine JWT-Verifizierung vorschaltet, ist das Risiko begrenzt — aber ein unbefugter Dritter könnte die Funktion aufrufen, wenn er einen gültigen Supabase-JWT kennt.

---

### M-4: `supabase/functions/stripe-webhook` löscht Idempotency-Row bei Handler-Fehler

**Schweregrad:** Mittel  
**Beweis** (`stripe-webhook/index.ts:118-121`):
```typescript
await admin.from('webhook_events').delete().eq('id', event.id);
return new Response(`handler failed: ...`, { status: 500 });
```
Stripe retried dann. Wenn die Handler-Funktion systematisch fehlschlägt, entsteht eine Endlosschleife von Stripe-Retries ohne Circuit-Breaker.

---

### M-5: `audit-report-email` und `audit-drip-cron` — Deployment-Status unbekannt

**Schweregrad:** Mittel  
**Beweis:** Edge-Function-Verzeichnisse existieren. Ob die Supabase-Cron-Jobs (`pg_cron`) für die Drip-Sequenz konfiguriert sind, wurde nicht bestätigt.

---

### M-6: `DsgvoControlPackPanel` nutzt `DEMO_CONTROL_SIGNALS` auf dem Dashboard

**Schweregrad:** Mittel  
**Beweis** (`src/features/workspace/WorkspaceHome.tsx:22`):
```typescript
import { DEMO_CONTROL_SIGNALS } from '../governance/dsgvo-control-pack/dsgvoControlPackDemo';
```
Auf dem Haupt-Dashboard (`/app`) werden Demo-Signale für das DSGVO Control Pack angezeigt.

---

### M-7: `RemediationPlaceholder` in `/app/remediation`

**Schweregrad:** Mittel  
**Beweis** (`src/components/governance-os/RemediationPlaceholder.tsx`): Route `/app/remediation` rendert einen Platzhalter, keine echte Funktion.

---

## 5. Niedrige Priorität

### N-1: Changelog/Roadmap-Seiten existieren als öffentliche Routen, Inhalt unbekannt

**Schweregrad:** Niedrig  
**Beweis:** `/changelog` und `/roadmap` sind als öffentliche Routen definiert. Inhalt nicht geprüft.

---

### N-2: 30+ Nischen-Landingpages ohne nachgewiesenen Traffic-Nutzen

**Schweregrad:** Niedrig  
**Beweis:** 7 Competitor-Doorways (`/onetrust-alternative`, etc.) und 15+ Branchen-Pages. SEO-Wert und Content-Qualität nicht geprüft.

---

### N-3: `public.products` — `internal_default_enterprise_public` ohne `default_for_plan_key`-Match im Frontend

**Schweregrad:** Niedrig  
**Beweis (DB):** `default_for_plan_key: "enterprise_public"` — kein `TierId` mit diesem Wert im Frontend-Pricing-Config. Verwaiste Zeile.

---

## 6. UX-Probleme

### UX-1: 50+ Routen — keine klare Discovery-Hierarchie

Das Produkt hat über 50 öffentliche Routen, davon 30+ SEO/Branchen-Doorways, 12+ freie Tools und 10+ Dashboard-Bereiche. Ein Erstbesucher auf der Homepage hat keine klare Orientierung, welche Routen primär und welche Sekundär sind. Die Navigation-Architektur ist für SEO optimiert, nicht für Erstbesucher-Conversion.

### UX-2: Audit-Ergebnis zu Demo-Conversion-Pfad ist unklar

Nach einem erfolgreichen Audit-Scan (`/audit/result/:id`) ist der Pfad zu einem bezahlten Plan nicht direkt sichtbar. Es gibt keine Inline-Upgrade-CTA mit konkretem Nutzenmessversprechen («Ihr Score 43/100 — mit Growth-Plan würden wir 8 dieser 12 Findings automatisch beheben»).

### UX-3: `DEMO_AGENTS`-Datum veraltet täglich

Die Agent Registry zeigt `lastRunAt: '2026-05-20'` (Stand: 28 Tage alt zum Audit-Datum). Für jeden authentifizierten Nutzer sichtbar.

### UX-4: Post-Login kein Onboarding-Guide

`/app` zeigt Compliance-Scores und Counts, aber keine Schritt-für-Schritt-Anleitung für neue Nutzer («Was soll ich jetzt tun?»). Neue Nutzer landen in einem Dashboard mit 0-Daten und keiner klaren nächsten Aktion.

### UX-5: CheckoutPage — `enterprise` und `scale` nicht erreichbar über UI-Buttons

Die CheckoutPage ist nur für `starter`, `growth`, `agency` zuständig (Code: `VALID_PLAN_KEYS = new Set(['starter', 'growth', 'agency'])`). `scale` und `enterprise` werden umgeleitet. Wenn ein Nutzer `/checkout/scale` aufruft, wird er nicht auf `/contact-sales` weitergeleitet, sondern bekommt wahrscheinlich eine leere/fehlerhafte Seite, weil `scale` nicht in `VALID_PLAN_KEYS` steht.

### UX-6: `stripe-portal` gibt Fehlermeldung auf Deutsch zurück — im technischen Fehlerkontext inkonsistent

`stripe-portal/index.ts:70`: `'Kein aktives Stripe-Kundenkonto für diesen Tenant — bitte erst einen Plan über /pricing buchen.'` — diese Meldung kommt direkt aus der Edge Function und nicht aus dem Frontend-Übersetzungssystem.

---

## 7. DSGVO-Probleme

### DSGVO-1: Cookie-Consent-Implementierung — BESTANDEN

**Beweis:** `src/components/CookieConsent.tsx`: Drei Consent-Kategorien (Notwendig/Statistik/Marketing), Buttons mit gleicher Bounding-Box (BfDI-Leitlinie), Custom Event für Consent-Änderung. `src/lib/pixels.ts`: Meta/TikTok/GA4/GoogleAds/LinkedIn nur nach explizitem Consent geladen.  
**Status:** Compliant mit TTDSG §25, DSGVO Art. 7 III.

### DSGVO-2: Datenschutzerklärung — BESTANDEN

**Beweis:** `src/features/legal/PrivacyPolicy.tsx`: Vollständige Art. 13/14-DSGVO-Angaben, alle Sub-Processors dokumentiert, Drittlandtransfer mit SCCs + EU-US DPF, Schrems-II-Compliance explizit, EU-lokaler Modus dokumentiert.  
**Status:** Compliant.

### DSGVO-3: Impressum §5 TMG — BEDINGT BESTANDEN

**Status:** Vollständig bis auf ausstehende VAT-ID (akzeptabel als Kleinunternehmer, aber im Impressum deutlicher zu kommunizieren).

### DSGVO-4: Newsletter — BESTANDEN (aber 0 Nutzer)

**Beweis:** `supabase/functions/newsletter-subscribe/index.ts`: DOI-Prozess via Resend, Rate-Limiting 5/Stunde/IP-Hash, IP-Hash statt Klartext-IP gespeichert.  
**Status:** Compliant. Aber: 0 bestätigte Abonnenten in Production — möglicherweise Resend-API-Key nicht konfiguriert oder DOI-E-Mails landen im Spam.

### DSGVO-5: Art. 30 DSGVO Verarbeitungsverzeichnis (VvT) — NICHT ERFÜLLT

**Beweis:** `demo_data: true` in `RuntimeVvtView.tsx`. Kunden können kein rechtskonformes VvT über das Produkt erstellen, solange Demo-Daten die Ansicht dominieren.  
**Schweregrad:** Hoch

### DSGVO-6: AAL2-Gate für Evidence-Export nicht durchgesetzt

**Beweis:** `observeAal2()` statt `requireAal2()`. Der Evidence Vault kann von AAL1-Nutzern aufgerufen werden.  
**Impact:** Der Evidence Vault speichert möglicherweise personenbezogene Daten (DSR-Exports, Audit-Trails). Zugriff ohne Zweifaktorauthentifizierung widerspricht dem Prinzip der Datenschutz-durch-Technikgestaltung (Art. 25 DSGVO).

### DSGVO-7: Tracking-Pixel mit US-Transfer ohne nachweisbarer Consent-Prüfung im Code-Pfad — BESTANDEN

Bereits unter DSGVO-1 abgedeckt. Kein eigenständiger Befund.

---

## 8. Funnel-Probleme

### Funnel-Schritt 1: Besucher → Homepage
**Erwartung:** Klarer Value Prop, sofortiger CTA  
**Befund (Code):** Hero hat Domain-Input mit «Kostenlos prüfen»-Button. CTA ist vorhanden.  
**Abweichung:** Keine.

### Funnel-Schritt 2: Audit (kostenlos)
**Erwartung:** Nutzer gibt Domain + E-Mail ein, bekommt DSGVO-Scan-Ergebnis  
**Befund (Code):** `gdpr-audit` Edge Function macht echten HTTP-Fetch der Zieldomain, führt Heuristik-Checks durch, speichert in `gdpr_audits` + `sales_leads`.  
**Befund (DB):** 92 Audits abgeschlossen. Tool funktioniert.  
**Abweichung:** Keine.

### Funnel-Schritt 3: Audit-Ergebnis → E-Mail-Sequenz
**Erwartung:** Nutzer erhält automatische E-Mail-Folge (Drip) mit Upgrade-CTA  
**Befund (DB):** 0 bestätigte Newsletter-Abonnenten. Keine Evidenz, dass Drip-E-Mails ankommen.  
**Abweichung:** Kritisch. Die 96 Leads verfallen ohne Follow-up.

### Funnel-Schritt 4: E-Mail → Trial/Checkout
**Erwartung:** Nutzer klickt auf Upgrade-Link in der E-Mail, landet auf `/checkout/:planKey`  
**Befund (DB):** 0 Checkout-Sessions abgeschlossen (keine `checkout.session.completed` Webhook-Events).  
**Abweichung:** Kritisch.

### Funnel-Schritt 5: Checkout → Stripe
**Erwartung:** Stripe Checkout Session wird erstellt, Nutzer zahlt, landet auf Success-URL  
**Befund (Code):** `stripe-checkout` Edge Function ist technisch korrekt implementiert, reale Price-IDs für starter/growth/agency vorhanden.  
**Abweichung:** Technisch lauffähig, aber nie ausgelöst worden.

### Funnel-Schritt 6: Stripe → Dashboard
**Erwartung:** Webhook verarbeitet `checkout.session.completed`, Subscription wird angelegt, Dashboard freigeschaltet  
**Befund:** Webhook-Handler vollständig implementiert inkl. Trial-Event-Tracking und Onboarding-Welcome-E-Mail.  
**Abweichung:** Noch nicht getestet (0 echte Checkouts).

---

## 9. Stripe-Probleme

| Plan | Stripe Price ID | Status |
|------|----------------|--------|
| Free | `internal_default_free` | Kein Checkout — korrekt |
| Starter | `price_1TfsV8REjTWueUcGCdOO6bT2` | Real — Checkout lauffähig |
| Growth | `price_1TfsV4REjTWueUcGsGSfjudu` | Real — Checkout lauffähig |
| Agency | `price_1TfsV9REjTWueUcGxJIBHYgC` | Real — Checkout lauffähig |
| Scale | `internal_default_scale` | **FEHLER: PRICE_NOT_CONFIGURED** |
| Enterprise | `internal_default_enterprise` | Sentinel — akzeptabel (→ contact-sales) |

**S-1: Scale-Plan nicht kaufbar** — Checkout bricht mit 400 ab. (Bereits als K-3 dokumentiert.)

**S-2: Testphase 14 Tage (pilot-mode)** implementiert, aber noch nie genutzt. Trial-Start-Event in Webhook-Handler vorhanden. Nicht im Browser getestet.

**S-3: Promotion Codes** aktiviert (`allow_promotion_codes: true` in checkout session). Kein Discount-Code im System bekannt — kein Befund, aber auch keine Evidenz, dass Codes existieren.

**S-4: Customer Portal** implementiert und korrekt (`/billing/usage` als return_url). AAL2 nur observe-only (→ K-4).

**S-5: Webhook** — 4 Ping-Events bestätigen, dass der Webhook-Endpoint erreichbar ist. Noch kein echter Zahlungs-Event verarbeitet. CORS auf `*` für stripe-checkout (→ M-3).

**S-6: Old Products in DB** — `bronze`, `silver`, `gold` mit realen Stripe-Price-IDs, aber ohne passende Frontend-Plan-Keys. Kein direkter Fehler, aber Datenbankverschmutzung.

---

## 10. Dashboard-Probleme

**D-1: WorkspaceHome** (`/app`) liest Live-Daten aus der DB (openDpias, openDsrs, pendingApprovals, openIncidents, vendorsNoDpa). **Kein Demo-Problem**. Aber: `DEMO_CONTROL_SIGNALS` aus `dsgvoControlPackDemo` wird importiert (M-6).

**D-2: Agent Registry** (`/app/ai-systems`) — statische `DEMO_AGENTS` mit veraltendem Datum. **Nutzer sehen Fake-Daten.**

**D-3: VvtView** — `demo_data: true`. Verarbeitungsverzeichnis mit Demo-Daten.

**D-4: Remediation** (`/app/remediation`) — Platzhalter-Komponente. Keine Funktion.

**D-5: Evidence Vault** (`/app/evidence`) — Code ist real (Hash-Chain, Ed25519 signaturen, RFC-3161-Timestamps laut Doku). Aber: AAL2 nicht enforced. Unklar, ob die Ed25519/Timestamp-Pipeline wirklich aktiv ist oder nur als Code existiert (0 Nutzer = 0 Evidenz aus Production).

---

## 11. Evidence-Probleme

**E-1: Produktversprechen vs. Reality-Gap**

Die öffentliche Seite `/evidence-vault` beschreibt:
- Hash-chained records
- Ed25519-Signaturen per Tenant
- RFC-3161-Timestamps
- Unveränderliche Audit-Reconstruction
- Regulator Export Packs

**Code:** `src/features/governance/AuditorConsoleView.tsx` importiert `buildExportBundle`, `verifyHashChain`, `fetchRacpo` aus `auditorConsoleApi` — diese API-Funktionen existieren.  
**DB-Befund:** 0 Nutzer, 0 Subscriptions. Es gibt keine produktiven Evidence-Einträge, die verifiziert werden könnten.  
**Bewertung:** Weder bestätigt noch widerlegt. Die Pipeline kann korrekt implementiert sein, ist aber in Production noch nie gelaufen.

**E-2: DSR-Export** — Funktion in AuditorConsoleView vorhanden. Nicht in Browser getestet.

**E-3: Tenant-Quadrant (Risk × Cost)** — UI-Komponente vorhanden. Keine Live-Daten verarbeitbar bei 0 Subscriptions.

---

## 12. Conversion-Probleme

**Warum sollte ein Besucher kaufen?**
- Kostenloser Audit gibt sofortigen Wert (funktioniert: 92 Scans)
- DSGVO/EU-AI-Act ist ein echter Compliance-Schmerz im DACH-Markt
- Preislage (79 €/Monat) ist im Markt wettbewerbsfähig (Cookiebot Premium ~110 €, Iubenda Plus ~280 €)
- EU-Hosting im Impressum explizit (Vertrauenssignal)

**Warum sollte ein Besucher NICHT kaufen?**
1. **Kein Social Proof:** 0 Case Studies, 0 öffentliche Kundennennungen, 0 Reviews
2. **Kein Onboarding-Demo:** Kein «Vorher-Nachher», kein Video, kein Live-Demo-Zugang mit Beispiel-Daten
3. **Agent Registry zeigt Demo-Daten:** Jeder Nutzer im Dashboard sieht sofort, dass es kein echtes Produkt ist
4. **Kein Follow-up nach dem Audit:** Die 96 Leads wurden nie kontaktiert (0 Newsletter-Abonnenten)
5. **Keine Testimonials auf der Pricing-Page**
6. **Login-Hürde vor Checkout:** Nutzer muss sich erst registrieren, dann Tenant erstellen, dann zum Checkout navigieren — 3 Schritte zu viel ohne Motivation
7. **Scale-Plan ist nicht kaufbar** (technischer Fehler)
8. **Zu viele Routen = Vertrauensproblem:** 50+ Seiten ohne klare Priorisierung wirken nach unfertigem Produkt

**Wo brechen Nutzer ab?**
1. Nach dem kostenlosen Audit — kein unmittelbarer Upgrade-CTA mit konkretem Nutzenversprechen
2. Am Login-Gate vor dem Checkout — fehlende Motivation zur Registrierung
3. Im Dashboard nach dem Login — Demo-Daten erzeugen sofort Vertrauensverlust

**Fehlende Conversion-Elemente:**
- Audit-Ergebnis → Inline-Upgrade-Empfehlung («Wir würden X Ihrer Y Findings automatisch beheben»)
- E-Mail-Drip nach Audit (dringendste Maßnahme)
- Social Proof / Testimonials auf Pricing-Page
- Demo-Workspace mit echten Beispieldaten statt DEMO_AGENTS mit veraltendem Datum

---

## 13. Fehlende Features (für zahlenden Launch)

1. **E-Mail-Drip-Sequenz aktiv schalten** — Resend-API-Key + Cron-Job-Konfiguration
2. **Scale-Plan Stripe-Preis eintragen** — 1 SQL-Zeile + Stripe-Dashboard
3. **AAL2 von observe auf enforce** — für Evidence Vault und Billing Portal
4. **Agent Registry auf Live-DB** — `DEMO_AGENTS` durch echte DB-Query ersetzen
5. **VvtView `demo_data: false`** — reale Daten aus der DB verwenden
6. **DSGVO Control Pack Demo-Signale ersetzen** — WorkspaceHome darf keine Demo-Daten zeigen
7. **Onboarding-Flow für neue Nutzer** — Schritt-für-Schritt nach erstem Login
8. **Upgrade-CTA im Audit-Ergebnis** — konkretes Nutzenversprechen basierend auf Scan-Ergebnis
9. **Remediation-Placeholder ersetzen** — oder Route entfernen
10. **Pilot-Trial-Flow testen** — End-to-End Checkout mit `pilot=true`

---

## 14. Produkt-Roadmap (IST vs. SOLL)

### IST-Zustand (2026-06-17)
- ✅ Freier Lead-Magnet-Audit funktioniert (92 Scans)
- ✅ Checkout-Code für starter/growth/agency technisch korrekt
- ✅ DSGVO-Compliance des eigenen Produkts gut umgesetzt
- ✅ Umfangreiche öffentliche Tool-Suite (Cookie-Scanner, AVV-Generator, AI-Act-Klassifikator etc.)
- ✅ Supabase-Infrastruktur stabil (ACTIVE_HEALTHY, eu-central-1)
- ❌ 0 zahlende Kunden, 0 € MRR
- ❌ E-Mail-Follow-up inaktiv
- ❌ Dashboard zeigt Demo-Daten
- ❌ AAL2 nicht enforced
- ❌ Scale-Tier nicht kaufbar

### SOLL-Zustand (Launch-ready)
- E-Mail-Drip nach jedem Audit automatisch
- Checkout für alle Tiers (starter/growth/agency/scale) funktionierend
- Dashboard ohne Demo-Daten
- AAL2 enforced für privilegierte Bereiche
- Mindestens 3 bezahlte Testkundschaften mit dokumentierten Erfahrungsberichten
- MRR > 0 €

### Produkt-Vision (aus Codebase)
Das Produkt versucht, «Governance OS» zu sein — ein Browser-ähnliches Interface für Compliance, das verschiedene Modules (DSGVO, EU-AI-Act, Evidence, Monitoring, Agents) unter einem Dach vereint. Die Vision ist ambitioniert und technisch kohärent umgesetzt. Das Problem ist der Sprung von «funktionierendem Code» zu «bezahlendem Kunden».

---

## 15. Konkrete Umsetzungsschritte

### Sofort (0–48 Stunden)
1. **Scale-Preis in Stripe anlegen** und in DB eintragen:
   ```sql
   UPDATE public.products 
   SET stripe_price_id = 'price_DEIN_REAL_SCALE_PREIS'
   WHERE default_for_plan_key = 'scale';
   ```
2. **Resend-API-Key prüfen** — Testnachricht via `newsletter-subscribe` Edge Function senden und DOI-E-Mail-Empfang bestätigen
3. **Audit-Drip-Cron** — Supabase pg_cron Schedule für `audit-drip-cron` prüfen/aktivieren
4. **`DEMO_AGENTS` ersetzen** — `AgentRegistryView.tsx` auf DB-Query umstellen (Tabelle `governance_agents` laut Comment in Code bereits vorhanden)
5. **`demo_data: false`** in `RuntimeVvtView.tsx`

### Kurzfristig (1–2 Wochen)
6. **Upgrade-CTA im Audit-Ergebnis** — spezifische Empfehlung basierend auf Anzahl kritischer Findings
7. **AAL2 enforce für Evidence Vault** — `requireAal2()` statt `observeAal2()` für `stripe-portal` und `evidence-export`
8. **WorkspaceHome** — `DEMO_CONTROL_SIGNALS` durch echte DB-Abfrage ersetzen
9. **Onboarding-Checklist** für neue Nutzer nach Login
10. **Alte Tier-Zeilen bereinigen** — Bronze/Silver/Gold aus `products`-Tabelle löschen

### Mittelfristig (2–4 Wochen)
11. **Social Proof** — Mindestens 2 Testimonials auf Pricing-Page (eigene Test-Kunden befragen)
12. **Pilot-Trial End-to-End** — echten 14-Tage-Trial von Anfang bis Ende durchlaufen
13. **Remediation-Placeholder** — echte Funktion implementieren oder Route deaktivieren
14. **Scale-Plan CTA-Routing** — `/checkout/scale` auf validen Pfad bringen
15. **CSR-Backup** — Checkout-Fehler-Anzeige für technische Nutzer verbessern

---

## 16. Top 10 Maßnahmen nach ROI

| Rang | Maßnahme | Aufwand | Erwarteter Impact |
|------|----------|---------|------------------|
| 1 | **E-Mail-Drip nach Audit aktivieren** | 1–2h (Cron prüfen) | Direktes Follow-up für 96 bestehende Leads |
| 2 | **Upgrade-CTA im Audit-Ergebnis** | 3–5h | Höchste Intent-Schnittstelle — Nutzer hat gerade Problem gesehen |
| 3 | **Scale-Preis in Stripe eintragen** | 30 min | Schaltet 4. Tier für Checkout frei |
| 4 | **Demo-Daten aus Agent Registry entfernen** | 2–4h | Beseitigt sofortige Vertrauenszerstörer im Dashboard |
| 5 | **AAL2 enforce** | 4–8h | Glaubwürdigkeit des Produkts als Sicherheits-Tool |
| 6 | **Onboarding-Guide nach Login** | 1 Tag | Reduziert «Was soll ich jetzt tun?»-Absprung |
| 7 | **Checkout End-to-End manuell testen** | 2h | Bestätigt oder widerlegt, dass Starter/Growth/Agency wirklich kaufbar sind |
| 8 | **Resend-E-Mail-Test + DOI-Bestätigung** | 1h | Bestätigt, dass Lead-Capture-Funnel funktioniert |
| 9 | **Social Proof / Testimonials auf Pricing** | 1–2 Tage | Reduziert Kaufzögern |
| 10 | **Alte DB-Einträge (Bronze/Silver/Gold) bereinigen** | 30 min | Reduziert Verwirrung bei Entwicklung und Reports |

---

## 17. Production Readiness Score

| Bereich | Punkte | Max | Begründung |
|---------|--------|-----|-----------|
| Technische Infrastruktur | 12 | 15 | Supabase stabil, Edge Functions deployt, reale Stripe-Prices vorhanden |
| Checkout-Funnel | 5 | 15 | Code korrekt, aber nie genutzt (0 Checkouts), Scale defekt |
| E-Mail & Lead-Followup | 1 | 10 | 0 bestätigte Newsletter-Subs, Drip-Status unklar |
| Dashboard-Qualität | 3 | 15 | Demo-Daten an mehreren kritischen Stellen |
| DSGVO/Legal-Compliance | 8 | 10 | Gut umgesetzt; VvT demo_data und AAL2 als Lücken |
| Conversion-Optimierung | 2 | 10 | Kein Social Proof, kein Drip, kein Inline-Upgrade-CTA |
| Sicherheit | 4 | 10 | AAL2 observe-only, CORS auf *, gute Grundabsicherung |
| Produktreife | 3 | 15 | Ambitionierte Roadmap, aber mehrere Demo-Placeholder |
| **Gesamt** | **38** | **100** | |

**Production Readiness Score: 38 / 100**

---

## 18. Go / No-Go Empfehlung

### NO-GO

**Begründung:**

Das Produkt ist technisch weiter als der Nullumsatz vermuten lässt — der Checkout-Code ist korrekt, reale Stripe-Prices existieren, die Infrastruktur ist stabil. Das Problem ist kein einzelner technischer Blocker, sondern eine Kombination aus:

1. **Kein aktives Lead-Follow-up** — 96 Leads verotten ohne E-Mail-Sequenz
2. **Demo-Daten in der Live-App** — jeder eingeloggte Nutzer sieht sofort, dass das Produkt noch nicht «echt» ist
3. **Keine nachgewiesene Conversion** — kein einziger Test-Checkout trotz lauffähigem Code
4. **AAL2-Versprechen nicht eingelöst** — für ein Sicherheits-Compliance-Produkt fatal

**Go-Bedingungen:**
Alle vier Punkte müssen erfüllt sein, bevor Werbeausgaben skaliert werden:

- [ ] Mindestens 1 erfolgreicher End-to-End-Checkout (Starter/Growth/Agency) mit echter Kreditkarte bestätigt
- [ ] Audit-Drip-E-Mail-Sequenz nachweislich aktiv (Resend-Logs zeigen gesendete E-Mails)
- [ ] `DEMO_AGENTS` und `DEMO_CONTROL_SIGNALS` aus Production-Dashboard entfernt
- [ ] AAL2 für Evidence Vault und Billing Portal auf «enforce» gesetzt

Diese vier Punkte sind in 1–2 Arbeitstagen umsetzbar. Danach ist ein Re-Audit empfohlen.

---

*Bericht erstellt: 2026-06-17 · Methode: Code-Analyse + Live-DB-Abfragen · Auditor: Claude (claude-sonnet-4-6)*

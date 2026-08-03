# Google Cloud Billing Integration — Architekturentscheidung

**Datum:** 2026-08-02  
**Analyst:** Claude Code  
**Status:** Decision Document (kein Code-Commit, nur Dokumentation)  
**Branch:** `claude/google-payment-profile-setup-pwd80g`

---

## Executive Summary

**Entscheidung:** Google Cloud Billing wird **nicht als Tenant-Zahlungssystem** implementiert.

Stattdessen bleibt **Stripe das primäre Zahlungssystem** für Tenant-Subscriptions, während **Google Cloud Billing** ausschließlich die **internen Infrastruktur-Kosten** (Vertex AI, Cloud Compute, Logging) verwaltet.

**Rationale:**
- Eindeutigkeit: Kunde zahlt an Stripe (SaaS-Modell), nicht an Google
- DSGVO-Konformität: Kundendaten bleiben von operativen Kosten getrennt
- Finanzielle Transparenz: Revenue (Stripe) vs. OpEx (GCP) sind klar voneinander abgegrenzt
- Technische Einfachheit: Keine Notwendigkeit für parallele Billing-APIs

---

## Analyse: Aktuelle Billing-Architektur

### Stripe-Integration (Status Quo)

**Komponenten:**
- **Frontend**: `src/lib/stripe.ts`, `src/features/billing/checkout.ts`
- **Edge Functions**: 
  - `stripe-checkout` — Checkout-Session-Erstellung
  - `stripe-webhook` — Subscription-Sync
  - `stripe-portal` — Customer Portal
  - `stripe-meter-sync` — Metered Billing für Token/API-Calls
- **Datenmodell**: 
  - `public.products` (plan_key → stripe_price_id mapping)
  - `public.subscriptions` (tenant → subscription tracking)
  - Tenant RLS via `tenant_id`

**Stripe Pricing:**
- Free Plan (0 €)
- Starter (39 € / Monat) bis Scale (1.999 € / Monat)
- Metered Billing für übergeordnete Audit-Scans, API-Calls

**Zahlungsfluss:**
```
Tenant → Stripe Checkout → Stripe Customer → Subscription
                                                    ↓
                            webhook: customer.subscription.updated
                                                    ↓
                            Supabase: tenants.stripe_subscription_id
                                                    ↓
                                    RLS-gated für Tenant
```

### Google Cloud Integration (Status Quo)

**Komponenten:**
- `Google GenAI 1.29.0` SDK (bereits in package.json)
- `supabase/functions/ai-invoke` — Anthropic Claude Calls (Primär)
- Fallback zu Ollama lokal (EU, Datenschutz)

**Keine bestehende Google Cloud Billing Integration.**

**Kostenmodell bisher:**
- Anthropic Claude über Anthropic API (separat berechnet)
- Ollama lokal (selbstgehostet, keine Cloud-Kosten)
- Google GenAI nicht produktiv genutzt

---

## Konflikte identifiziert

### 1. ❌ Möglicher Konflikt: Parallele Billing-Domains

**Szenario (nicht implementieren):**
```
Tenant Zahlungen:
  - Stripe (Subscriptions)
  - Google Cloud Billing (AI Usage) ← PARALLEL
      
Problem:
  - Zwei separate Zahlungskonten pro Tenant
  - Verwirrt Kunden (zwei Rechnungen)
  - DSGVO-Risiko: Vermischung von Zahlungs- und Nutzungsdaten
  - Technisch komplex: OAuth für Google Cloud Billing per Tenant
```

**Entscheidung: Nicht implementieren.** → Google Cloud Billing nur intern.

### 2. ✅ Nicht-Konflikt: Interne Infrastruktur-Kosten

**Szenario (implementieren später):**
```
RealSyncDynamicsAI interne Kosten:
  ├─ Vertex AI Pro Inferencing (monatlich €X.XXX)
  ├─ Cloud Storage / Logging (minimal)
  └─ Monitoring & Audit Trails

Diese Kosten:
  ✅ Gehören zu Google Cloud Billing
  ✅ Werden NICHT an Tenants weitergegeben (außer Enterprise)
  ✅ Transparent für RSD-Management (Profit-Margin-Analyse)
```

---

## Architektur-Entscheidung

### Billing-Trennung

```
┌─────────────────────────────────────────┐
│         Tenant Payment Flow             │
│                                         │
│  Tenant                                 │
│    ↓                                    │
│  Stripe Checkout                        │
│    ↓                                    │
│  Stripe Customer (metadata.tenant_id)   │
│    ↓                                    │
│  Subscription (Stripe webhook sync)     │
│    ↓                                    │
│  Supabase: tenants.stripe_*             │
│    ↓                                    │
│  RLS-gated: nur Tenant-Daten sichtbar   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      Infrastructure Cost Flow           │
│                                         │
│  AI Runtime Execution                   │
│  (ai_tool_runs log: model, tokens)      │
│    ↓                                    │
│  Google Cloud Billing                   │
│  (Vertex AI API Usage)                  │
│    ↓                                    │
│  Cost Breakdown (Service + SKU)         │
│    ↓                                    │
│  BigQuery Export (audit trail)          │
│    ↓                                    │
│  RealSyncDynamicsAI Management          │
│  (Revenue vs. OpEx Analyse)             │
└─────────────────────────────────────────┘
```

### Was wird implementiert (Phase 2)

**Jetzt (kein Code):**
1. ✅ GCP Projekt-Setup (manuell in Cloud Console)
2. ✅ Service Accounts + IAM (Least Privilege)
3. ✅ Vertex AI API Enablement
4. ✅ Monitoring + Budget Alerts
5. ✅ Dokumentation (dieses Dokument + google-cloud-billing.md)

**Phase 3 (später, mit Code-Commits):**
1. ⏳ `ai-invoke` Edge Function: Vertex AI Modelle als Fallback (nach Anthropic/Ollama)
2. ⏳ Cost Attribution in `ai_tool_runs` (token tracking)
3. ⏳ Dashboard: AI Costs vs. Tenant Revenue (intern, nicht kundensichtbar)
4. ⏳ BigQuery Export + DSGVO Audit Trail

### Was wird NICHT implementiert

**Nicht-Scope:**
- ❌ Google Payment Profiles API
- ❌ Tenant Google Cloud Billing Accounts
- ❌ OAuth Connector für Google Cloud Billing
- ❌ Stripe-Replacement
- ❌ Neue Billing-Tabellen (alles in existing Stripe schema)

**Begründung:** Würde parallele Billing-Domain erzeugen (Konflikt 1).

---

## Offene Entscheidungen für Phase 3

| Entscheidung | Optionen | Empfehlung |
|---|---|---|
| **Vertex AI Region** | `europe-west1` (Belgien, DSGVO) vs. `us-central1` (schneller) | **europe-west1** (Compliance) |
| **Generative AI API vs. Vertex AI Endpoints** | Direct API (einfach) vs. Managed Endpoints (Monitoring besser) | **Hybrid**: API jetzt, Endpoints Phase 4 |
| **Cost Chargeback für Enterprise** | Stripe Metered Billing (Tokens) vs. Fixed Upcharge | **Metered** (fairere Preisgestaltung) |
| **GCP Secret Manager vs. Supabase Vault** | Beide verfügbar, Kosten vs. Zentralisierung | **Supabase Vault** (DSGVO, kostenlos, zentral) |

---

## Gefundene Anomalien & Hinweise

### 1. Plan-Key Inkonsistenz

**Status quo:**
- `src/core/billing/stripe-mapping.ts` nutzt `PRICE_FALLBACK`
- `src/features/billing/checkout.ts` nutzt andere `PlanKey`-Definitionen
- `src/core/billing/plan-config.ts` hat vollständige Plan-Konfig

**Empfehlung:** Phase 3, als Refactoring: Alle PlanKey-Definitionen in eine Datei (`src/config/pricing.ts`) konsolidieren.

### 2. Service-Role-Keys in Edge Functions

**Status quo:** Korrekt implementiert.
- Service Role Keys **nur** in Edge Functions (nicht in Client)
- Vault-First-Pattern (getSecret rpc call)
- Env-Fallback für lokale Dev

**Keine Änderung nötig.**

### 3. Webhook Idempotency

**Status quo:** Stripe Webhook nutzt `webhook_events` Tabelle zur Duplikat-Verhinderung.

**Gut.** Falls Google Cloud Audit Events gespeichert werden (Phase 3), das gleiche Muster verwenden.

---

## Konforme Lösung: Customer Payments → Google Cloud Billing

**Nur wenn explizit später gewünscht:**

Falls Enterprise-Tenants **selbst** die Google Cloud Infrastruktur-Kosten tragen sollen (z.B. für Private Cloud Deployments):

```
New Flow (Phase 4+):
Tenant selbst hat Google Cloud Projekt
    ↓
RealSyncDynamicsAI Deploy in Tenant-Projekt
    ↓
Tenant-Projektkosten (Vertex AI, Compute) → Tenant Billing Account
    ↓
RealSyncDynamicsAI behält Stripe Subscription (Software License)
    ↓
Separate Invoicing: Stripe (Software) + Google (Infrastructure)
```

**Aber:** Erfordert Terraform/IaC für Multi-Tenant GCP Deployments (nicht geplant Phase 2).

---

## Vergleichstabelle: Finale Entscheidung

| Kriterium | Stripe (Tenant Payments) | Google Cloud Billing (OpEx) |
|---|---|---|
| **Primärer Zweck** | Customer Revenue | Internal Cost Tracking |
| **Mehrwert für Kunden** | Ja (Subscription) | Nein (Transparenz nur intern) |
| **Implementiert in Phase 2** | Ja (existing) | Nein (Setup nur) |
| **Multi-Tenant Isolation** | Ja (via metadata.tenant_id) | N/A (single tenant internal) |
| **DSGVO-konform** | Ja (Supabase RLS) | Ja (kein Kundendaten-Mix) |
| **Kostenaufschlag für Kunden** | Ja (Metered) | Nein (OpEx-Absorbtion) |

---

## Empfehlung für nächste Schritte

### Kurzfristig (nächste 2 Wochen)
1. GCP Projekt manuell anlegen (`realsync-prod-gcp-2026-08`)
2. Service Accounts + IAM Setup
3. Vertex AI API aktivieren, Quotas prüfen
4. Dokumentation (dieses Dokument) mit Team teilen

### Mittelfristig (Phase 3, nächste 2-4 Wochen)
1. `ai-invoke` erweitern mit Vertex AI Support
2. Cost Attribution in `ai_tool_runs` implementieren
3. Monitoring-Dashboard (intern)
4. Audit Logs → BigQuery

### Langfristig (Phase 4+, nach Go-Live)
1. Enterprise Chargeback-Modell (optional)
2. Tenants mit GCP-PrivateCloud-Option (wenn nötig)
3. Full Vertex AI Migration (vom direkten API)

---

## Fazit

**Google Cloud Billing wird nicht als Customer-Zahlungssystem implementiert.**

Stripe bleibt das alleinige Zahlungssystem für Tenants. Google Cloud verwaltet nur interne Infrastruktur-Kosten, mit voller DSGVO-Compliance und transparenter Kostenkontrolle.

Diese Entscheidung:
- ✅ Vermeidet parallele Billing-Domains
- ✅ Behält einfache Customer Experience
- ✅ Wahrt DSGVO-Compliance
- ✅ Ermöglicht spätere Enterprise-Chargeback-Optionen

---

**Freigegeben für:** Code-Commits nach Phase-3-Architektur-Umsetzung  
**Dokumentation abgeschlossen:** 2026-08-02  
**Nächster Review:** Nach GCP Setup-Abschluss

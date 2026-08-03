# Google Cloud Billing Infrastructure

**Stand**: 2026-08-02 | **Phase**: Analyse + Architekturentscheidung (keine Implementierung)

---

## Übersicht

Google Cloud Billing ist **nicht** als Tenant-Zahlungssystem gedacht. Stattdessen verwaltet es die **internen Infrastrukturkosten** für RealSyncDynamicsAI:

- Vertex AI Modell-Zugang und -Nutzung
- Google Cloud Laufzeit (Compute, Storage, Networking)
- AI-Modell-Inferences und Quotas
- Kostenkontrolle und budgetbasierte Alerts

**Trennung der Billing-Domains:**

```
Customer Payments → Stripe (Tenant Subscriptions, Metered Billing)
Infrastructure Costs → Google Cloud Billing (Internal Ops)
```

---

## 1. Google Cloud Projekt-Struktur

### 1.1 Projekt-Anlage

**Projekt-Naming-Konvention:**
```
realsync-prod-gcp-YYYY-MM (z.B. realsync-prod-gcp-2026-08)
realsync-dev-gcp-YYYY-MM  (für Staging/Testing)
```

**Anforderungen:**
- Google Cloud Organization (falls vorhanden) zur Vereinheitlichung der Billing Accounts
- Separate Projekte für Prod/Dev
- Lifecycle-Policy: automatische Archivierung nach 2 Jahren inaktiver Nutzung

### 1.2 Billing Account

**Ein primärer Billing Account** (zentral):
- Typ: „Enterprise" (für Revenue Sharing, kostenlos)
- Zahlungsmethode: Kreditkarte (Primary) + SEPA-Überweisung (Secondary)
- Rechnungsadresse: RealSyncDynamicsAI UG Registeradresse (Deutschland)
- Kontakt: finance@realsyncdynamics.ai, ops@realsyncdynamics.ai

**Linked Projects:**
- realsync-prod-gcp-* → automatisch gebillt
- realsync-dev-gcp-* → separate Quota-Limits (optionale Budgets)

**Budget Alerts:**
```
- Monthly alert at 80%, 100%, 120% of projected spend
- Linked to ops@realsyncdynamics.ai
- Automated notification via Cloud Monitoring
```

---

## 2. Service Accounts & IAM

### 2.1 Service Account Strategie

**Least Privilege — eine SA pro Function/Komponent:**

| Service Account | Verwendung | Rollen | Geheimnis-Speicher |
|---|---|---|---|
| `vertex-ai-invoker` | Vertex AI Model Calls (Edge Functions) | `roles/aiplatform.user` | Supabase Vault |
| `google-cloud-monitoring` | Metrics + Logs (Cloud Monitoring) | `roles/monitoring.metricWriter` | Supabase Vault |
| `google-cloud-storage` | Evidence Vault Sync (optional) | `roles/storage.admin` (bucket-scoped) | Supabase Vault |
| `cloud-logging` | Audit Logging → BigQuery | `roles/logging.logWriter` | Supabase Vault |

### 2.2 Service Account Details

**Vertex AI Invoker Example:**
```json
{
  "type": "service_account",
  "project_id": "realsync-prod-gcp-2026-08",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----...",
  "client_email": "vertex-ai-invoker@realsync-prod-gcp-2026-08.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

**Speicherung:**
- **Schlüssel-JSON**: `supabase/vault` via `set_app_secret('gcp_vertex_ai_key', '...')`
- **Nicht in Code, .env, oder Git**
- **Rotation alle 90 Tage** via Cloud Console oder Terraform

### 2.3 IAM Rollen (Custom + Predefined)

**Predefined Rollen:**
- `roles/aiplatform.user` — Vertex AI Modelle aufrufen
- `roles/monitoring.metricWriter` — Custom Metrics schreiben
- `roles/logging.logWriter` — Cloud Logs schreiben
- `roles/storage.viewer` — Zugang zu Bucket-Metadaten (falls nötig)

**Custom Role (optional):**
```yaml
title: "Vertex AI + Monitoring Reader"
includedPermissions:
  - aiplatform.models.get
  - aiplatform.models.list
  - aiplatform.endpoints.predict
  - monitoring.timeSeries.create
  - monitoring.timeSeries.list
```

**Workload Identity (Falls Kubernetes/GKE):**
- Nicht nötig für Edge Functions; nur bei selbstgehostetem Ollama oder GKE-Deployment

---

## 3. API Aktivierung

**Erforderliche APIs** im Projekt:

```bash
# Cloud AI/ML
gcloud services enable aiplatform.googleapis.com

# Monitoring & Logging
gcloud services enable monitoring.googleapis.com
gcloud services enable logging.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com

# Storage (optional, für Evidence Vault Sync)
gcloud services enable storage-api.googleapis.com

# BigQuery (für Audit Logs)
gcloud services enable bigquery.googleapis.com
```

**Aktivierungsverfahren:**
1. Cloud Console → APIs & Services → Library
2. API suchen → Enable
3. Quotas prüfen (Standard-Limits reichen aus, aber Monitoring ist nötig)

---

## 4. AI Infrastruktur — Vertex AI

### 4.1 Modell-Zugang

**Vertex AI bietet:**
- **Generative AI API** (Gemini, Codey, PaLM)
- **Endpoint-Deployment** (Custom Models, auch Open Source)
- **Batch Processing** (für große Workloads, kostengünstig)
- **Model Garden** (Hugging Face, Vertex community models)

**RealSyncDynamicsAI Nutzung:**

```typescript
// Beispiel: Vertex AI Gemini über REST (in Edge Functions)
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

const result = await model.generateContent({
  contents: [{ role: "user", parts: [{ text: prompt }] }],
});
```

**Alternativen im Stack:**
- Anthropic Claude (Hauptanbieter) — über Anthropic SDK
- Google GenAI (1.29.0) — bereits integriert
- Ollama lokal (EU, Fallback) — selbstgehostet

### 4.2 Quota Management

**Limits pro Modell (standard):**
- **Gemini 1.5 Pro**: 500 Anfragen/Minute (RPM), 1 Mio. tokens/Minute (TPM)
- **Gemini 1.5 Flash**: 1.000 RPM, 4 Mio. TPM
- **Code Generation**: 100 RPM

**Monitoring:**
```
Cloud Console → Vertex AI → Model Garden → Gemini
→ Check quotas & usage graphs
```

**Request-Limit-Handling:**
- Exponentielle Backoff-Retry (3 Versuche, exponentiell up to 5 Sekunden)
- Circuit Breaker Pattern (bei konsistenten Fehlern zu Ollama Fallback)
- Metering in `ai_tool_runs` Tabelle (für Cost Attribution)

### 4.3 Kostenmodell

**Vertex AI Pricing** (bei Verwendung über Generative AI API):

| Modell | Input (pro Mio. Tokens) | Output (pro Mio. Tokens) |
|---|---|---|
| Gemini 1.5 Pro | €3,50 | €10,50 |
| Gemini 1.5 Flash | €0,075 | €0,30 |
| PaLM 2 | €0,50 (Text), €1,50 (Code) | €1,50 (Text), €6,00 (Code) |

**Budgetierung für RealSyncDynamicsAI:**
- Durchschnittlich ~2-5% der Tenant-Subscription-Revenue für AI-Kosten budgetiert
- Monatliches Tracking über `ai_tool_runs.prompt_tokens`, `completion_tokens`
- Automatische Alerts bei Überschreitung (via Cloud Billing)

---

## 5. Kostenkontrolle & Monitoring

### 5.1 Budget-Alerts

**Cloud Billing Budget:**
```
Monthly Budget: €2.000,00
Alerts:
  - 50% (€1.000) → Warning
  - 90% (€1.800) → Critical
  - 100% (€2.000) → Hard Stop (optional disable API)
```

### 5.2 Cost Breakdown

**Wo die Kosten entstehen:**
1. **Vertex AI / Generative AI** — Model Inferences
2. **Cloud Storage** — Evidence Vault Backups (optional)
3. **Cloud Logging** — Audit Logs (minimal, kostenfrei bis 50 GB/Monat)
4. **Cloud Monitoring** — Custom Metrics (kostenfrei bis 1500+ Metrics)

**Export & Reporting:**
```sql
-- BigQuery Export (automatisch täglich)
-- Tabelle: `realsync-prod-gcp.gcp_billing_data.gcp_billing_export_v1`

SELECT
  service.description,
  sku.description,
  usage.amount_in_pricing_units,
  cost
FROM `realsync-prod-gcp.gcp_billing_data.gcp_billing_export_v1`
WHERE usage_start_time >= TIMESTAMP_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY service.description, sku.description
ORDER BY cost DESC;
```

---

## 6. Security & Compliance

### 6.1 Least Privilege IAM

**Pro Edge Function:**

```hcl
# Terraform Example: vertex-ai-invoker
resource "google_service_account" "vertex_ai" {
  account_id   = "vertex-ai-invoker"
  display_name = "Vertex AI Model Invoker"
  project      = google_project.prod.project_id
}

resource "google_project_iam_member" "vertex_ai_user" {
  project = google_project.prod.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.vertex_ai.email}"

  # Condition: nur auf prod project (keine Dev Permissions)
  condition {
    title       = "Only prod resources"
    description = "Restrict to production AI endpoints"
    expression  = "resource.matchTag('env', 'prod')"
  }
}
```

**Granularität:**
- Eine SA pro Funktion (Vertex, Monitoring, Logging)
- Regelmäßige Audit: `gcloud iam service-accounts get-iam-policy`
- Keine Owner/Editor Rollen für SAs

### 6.2 Secret Management

**Google Cloud Secret Manager vs. Supabase Vault:**

| Aspekt | Google Cloud Secret Manager | Supabase Vault |
|---|---|---|
| Speicherort | Google Cloud (USA Region) | Supabase (DSGVO-konform EU) |
| Kosten | €0,06/geheim/Monat | Kostenlos (Supabase) |
| Rotation | Automatisch möglich | Manuell (via set_app_secret) |
| Audit Logging | Cloud Audit Logs | Supabase Audit Log |
| Verwendung | Externe Integrations (optional) | **Primär**: GCP SA Keys |

**Empfehlung:**
- GCP SA Keys → Supabase Vault speichern (DSGVO, zentral)
- Falls Google Cloud Secret Manager genutzt wird:
  - Region: `europe-west1` (Belgien, DSGVO)
  - Automatische Rotation: 90 Tage
  - Audit Logging aktiviert

### 6.3 Rotation Policy

**Service Account Keys:**
```
Rotationszyklus: 90 Tage
Gültigkeitsfenster: 30 Tage Overlap (alte + neue Schlüssel parallel)
Audit-Trail: Cloud Audit Logs (25 Monate Retention)
Benachrichtigung: ops-team@realsyncdynamics.ai (7 Tage vor Ablauf)
```

**Prozess:**
1. Neue SA Key generieren in Cloud Console
2. In Supabase Vault speichern: `set_app_secret('gcp_vertex_ai_key', '...')`
3. 7 Tage warten (Overlap-Phase, neue Funktionen nutzen neue Key)
4. Alte Key deaktivieren (nicht löschen, Archive für 90 Tage)

### 6.4 Audit Logging

**Cloud Audit Logs (automatisch aktiviert):**

```
Typ: admin (IAM, Konfiguration)
Typ: data (API Calls: Vertex AI, Storage)
Typ: system (Interne GCP Events)

Export: Cloud Logging → BigQuery für DSGVO Audit Trail
Retention: 90 Tage (Cloud Logging Standard), 13 Monate (BigQuery Archive)
```

**Log Queries (in Cloud Console oder BigQuery):**

```sql
-- Alle AI Model Calls pro Service Account
SELECT
  timestamp,
  protoPayload.authenticationInfo.principalEmail as service_account,
  protoPayload.methodName,
  protoPayload.status.code
FROM `realsync-prod-gcp.cloudaudit_googleapis_com_activity`
WHERE protoPayload.methodName LIKE 'google.cloud.aiplatform%'
  AND timestamp >= TIMESTAMP_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY timestamp DESC;
```

---

## 7. Architekturentscheidungen

### 7.1 Warum Google Cloud Billing ≠ Stripe

**Google Cloud Billing:**
- Verwaltet **interne Infrastruktur-Kosten** (AI Modelle, Laufzeit)
- Nicht für Tenant-Zahlungen gedacht
- Keine Multi-Tenant-Isolation (alle Tenants teilen die gleiche GCP Infrastruktur)
- Kosten sind **operativ**, nicht **kundenfakturierbar**

**Stripe:**
- Verwaltet **Tenant-Subscriptions** (Customer Payments)
- Metered Billing für Pay-as-you-go Features
- Multi-Tenant: pro Tenant eigene Stripe Customer ID
- Rechnungen gehen direkt an Kunden

**Trennung bewahrt:**
1. Compliance (DSGVO: Keine Vermischung von Kundendaten und operativen Kosten)
2. Finanzielle Transparenz (Revenue vs. OpEx Kosten getrennt)
3. Einfaches Chargeback-Modell (Kosten Attribution möglich, ohne komplexe Streuung)

### 7.2 Künftige Erweiterung: Cost Attribution

**Nicht jetzt implementieren**, aber die Architektur vorbereiten:

```
AI Runtime Execution
    ↓
ai_tool_runs Logging (tokens, latency, model, tenant_id)
    ↓
Google Cloud Billing (Gesamtkosten)
    ↓
Cost Attribution (berechnet: Tenant-spezifische AI-Kosten)
    ↓
Optional: Pass-Through Billing (Nur für Enterprise Tier)
    ↓
Stripe Metered Billing (Zusatzgebühr pro 1.000 Tokens)
```

**Phase 3+ Task:** Wenn Tenants für AI-Nutzung zahlen sollen, wird diese Architektur implementiert.

---

## 8. Implementierungs-Roadmap

### Phase 2 (Jetzt)
- [x] Analyse: Billing-Struktur dokumentieren
- [x] Architektur-Entscheidung: Google Cloud ≠ Stripe (festgehalten)
- [ ] GCP Projekt, Service Accounts, APIs enablen (manuell in GCP Console)
- [ ] Vertex AI Access testen (mit Gemini 1.5 Pro)

### Phase 3
- [ ] `supabase/functions/ai-invoke` erweitern mit Vertex AI Support
- [ ] Cost Attribution in `ai_tool_runs` hinzufügen
- [ ] Monitoring-Dashboard: AI Costs vs. Revenue
- [ ] Audit Logs → BigQuery Tagging & DSGVO-Export

### Phase 4+
- [ ] Chargeback-Modell für Enterprise Tenants
- [ ] Usage Alerts (pro Tenant, wenn KI-Kosten über Threshold)
- [ ] Stripe Metering Integration (optional)

---

## 9. Konflikte & Offene Fragen

| Frage | Status | Notiz |
|---|---|---|
| **Google Cloud Region für Daten-Residency?** | Open | EU-Region (`europe-west1` Belgien) ist DSGVO-konform, aber fügt ~10% Latenz hinzu. Alternative: US (`us-central1`) schneller, aber requires DPA. Recommendation: EU für Compliance. |
| **Vertex AI vs. direct Google GenAI API?** | Open | GenAI API (aktuell) ist einfacher, aber Vertex AI hat bessere Monitoring. Können später migrieren. |
| **Automatische Cost-Limits (Hard Stop)?** | Open | Cloud Billing Budget kann API automatisch disablen. Für Prod: eher disable=false (Alert nur). |
| **Multi-Project (Prod+Dev) Abrechnung?** | Open | Ein Billing Account mit zwei Projekten (prod+dev). Empfehlung: Separate budgets per Projekt. |

---

## 10. Checkliste für GCP-Setup

- [ ] Projekt anlegen: `realsync-prod-gcp-2026-08`
- [ ] Billing Account verbinden (Primary Zahlungsmethode)
- [ ] APIs enablen: `aiplatform`, `monitoring`, `logging`, `cloudresourcemanager`
- [ ] Service Account anlegen: `vertex-ai-invoker`, `google-cloud-monitoring`
- [ ] IAM Rollen zuweisen (Least Privilege)
- [ ] Service Account Keys generieren → Supabase Vault speichern
- [ ] Budget-Alerts konfigurieren (€2.000/Monat)
- [ ] Cloud Audit Logs → BigQuery Export enablen
- [ ] Dokumentation im Team kommunizieren (dieses Dokument)
- [ ] Vertex AI Quota limits überprüfen (ggf. erhöhen)

---

## 11. Referenzen

- **Google Cloud Billing**: https://cloud.google.com/billing/docs
- **Vertex AI Documentation**: https://cloud.google.com/vertex-ai/docs
- **IAM Best Practices**: https://cloud.google.com/iam/docs/best-practices
- **DSGVO Compliance on GCP**: https://cloud.google.com/terms/data-processing-terms
- **RealSyncDynamicsAI Stripe Integration**: `src/lib/stripe.ts`, `supabase/functions/stripe-*`

---

**Nächste Aktion:** Phase 3 — Architekturentscheidung in Branch committen (keine Implementierung).

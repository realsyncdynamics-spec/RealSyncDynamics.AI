# Governance OS Expansion Plan

Ziel: Transformiere RealSyncDynamicsAI von einem reinen AI-Act-Checker zu einem integrierten Governance Operating System für KMU.

Plattform verbindet: **DSGVO**, **AI Act**, **NIS2**, **ISO 27001**, **ISO 42001** in einem gemeinsamen Workflow.

---

## 1. Status Quo (Bestehende Funktionen)

### Frontend: Governance Dashboard
Bereits vorhanden in `src/features/governance/GovernanceDashboardView.tsx`:
- **Header-Navigation** mit Links zu 15+ Governance-Modulen
- **Vier Kernmodule aktiv**:
  1. `GovernanceDashboardView` (Assets, Policies, Events, Controls)
  2. `KeysView` (API-Key-Management)
  3. `DpiasView` (Datenschutzfolgenabschätzung)
  4. `DsrTrackerView` (Data Subject Requests)
  5. `IncidentsView` (Sicherheitsvorfälle)
  6. Weitere: Vendors, Connectors, Costs, Remediation, Mappings, Admin-Log, Report, Webhooks

### Backend: Datenmodell
Existierende Tabellen in `supabase/migrations/`:

**AI Governance Core** (`20260510_ai_governance_core.sql`):
- `ai_systems` — KI-Systeme-Registry (vendor, model_name, data_types, ai_act_class, risk_score)
- `ai_policies` — Policies (rule_type: data_transfer, model_usage, human_review, logging, vendor_restriction)
- `ai_evidence_events` — Audit-Trail (event_type, risk_level, evidence JSONB)
- `ai_runtime_events` — Runtime-Telemetrie (vendor, model, event_type, data_class, policy_status)

**Compliance & Monitoring**:
- `dpias` — DSGVO-Folgenabschätzungen
- `dsr_trackers` — Data Subject Requests
- `incidents` — Sicherheitsvorfälle
- `governance_assets` / `governance_policies` / `governance_events` — Allgemeine Assets/Policies/Events
- `governance_approvals` — Genehmigungsworkflow

**Billing & Access**:
- `subscription_plans` — Tiers (free, starter, growth, agency, enterprise) mit Stripe-Integration
- `feature_usage` — Quota-Tracking pro Tenant
- `api_keys` — Governance Ingest Keys (mit sha256-Hash + RLS)

### Stripe Integration
Bestehend in `supabase/functions/stripe-checkout/index.ts`:
- Checkout-Session-Creation für plan_key → Stripe Price ID
- Membership-Check (owner/admin only)
- Vault-basierte Secret-Verwaltung (Fallback zu env vars)

### Routing
Existierende öffentliche & geschützte Seiten in `src/App.tsx`:
- `/app/governance` → GovernanceDashboardView
- `/app/keys` → KeysView
- `/app/dpia` → DpiasView
- `/app/dsr` → DsrTrackerView
- `/app/incidents` → IncidentsView
- Weitere: vendors, connectors, costs, remediation, mappings, admin-log, compliance

---

## 2. Lückenanalyse (Fehlende Funktionen)

### Module (fehlend oder unvollständig)
1. ❌ **KI-Register** — nur `ai_systems`, aber keine UI für Erfassung
2. ❌ **DSGVO-Verzeichnis** — DPIA existiert, aber kein zentrales Verzeichnis
3. ❌ **AI-Act-Risikoprüfung** — `ai_act_class` in ai_systems, aber kein Workflow
4. ❌ **NIS2-Incident-Fristen** — `incidents` existiert, aber keine NIS2-Deadlines
5. ❌ **ISO-27001-Kontrollen** — keine `iso27001_controls` Tabelle
6. ❌ **ISO-42001-KI-Management** — keine `iso42001_controls` Tabelle
7. ❌ **Gap-Analyse** — keine `compliance_gaps` Tabelle
8. ❌ **Evidence Vault (erweitert)** — `ai_evidence_events` existiert, aber keine erweiterte Management-UI
9. ❌ **Maßnahmenplan** — nur `governance_approvals`, aber kein dedizierter Remediation-Workflow
10. ❌ **Audit-Report** — `ComplianceReportView` existiert, aber nicht vollständig

### Workflow (fehlend)
1. ❌ **Geführter 10-Schritte-Workflow** — keine FlowProvider-Integration für Governance-Module
2. ❌ **Conditional Routing** — basierend auf Antworten (KI-Nutzung → externe Dienstleister → personenbezogene Daten)
3. ❌ **Package-Empfehlungen** — Checkout nach Gap-Analyse wird nicht empfohlen

### Framework-Mapping (fehlend)
1. ❌ **compliance_frameworks** Tabelle — definiert Regelwerke
2. ❌ **framework_mappings** Tabelle — ordnet Assets/Findings mehreren Regelwerken zu
3. ❌ **control_implementations** Tabelle — verknüpft Nachweise mit Kontrollen

### Automatisierung (fehlend)
1. ❌ **Scan-Erstellung** Edge Function — automatische Website-Scans
2. ❌ **Gap-Analyse-Engine** — automatische Ermittlung von Lücken
3. ❌ **Re-Scan-Scheduler** — regelmäßige Compliance-Überprüfung
4. ❌ **Evidence-Erstellung** — automatische Nachweiserstellung
5. ❌ **Incident-Fristen-Engine** — NIS2-Deadline-Berechnung

### Monetarisierung (fehlend)
1. ❌ **Tier-basierte Feature-Gates** im Dashboard
2. ❌ **Add-ons** (z.B. ISO-27001, ISO-42001) als separate Produkte
3. ❌ **Checkout-Flow** aus Moduldetailseiten
4. ❌ **API-Usage-Metering** für unterschiedliche Pläne

---

## 3. Datenmodell-Erweiterungen

### Neue Migrationen (8 neue Dateien)

#### Migration 1: `20260705_governance_frameworks.sql`
```sql
-- Compliance Frameworks (DSGVO, AI Act, NIS2, ISO 27001, ISO 42001)
CREATE TABLE compliance_frameworks (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE, -- 'gdpr', 'ai_act', 'nis2', 'iso27001', 'iso42001'
  name TEXT, -- "DSGVO", "EU AI Act", etc.
  description TEXT,
  version TEXT, -- "2024-03-15"
  created_at TIMESTAMPTZ
);

CREATE TABLE framework_controls (
  id UUID PRIMARY KEY,
  framework_id UUID REFERENCES compliance_frameworks(id),
  control_code TEXT, -- 'GDPR_Art_33', 'ISO_27001_A.5.1'
  control_name TEXT,
  description TEXT,
  severity TEXT, -- 'critical', 'high', 'medium', 'low'
  category TEXT,
  created_at TIMESTAMPTZ
);

-- RLS für tenant_id wird via control_implementations hergestellt
```

#### Migration 2: `20260705_governance_gaps.sql`
```sql
CREATE TABLE compliance_gaps (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  control_id UUID REFERENCES framework_controls(id),
  status TEXT, -- 'identified', 'in_progress', 'resolved', 'accepted_risk'
  risk_level TEXT, -- 'critical', 'high', 'medium', 'low'
  remediation_notes TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- RLS: tenant_member_read
ALTER TABLE compliance_gaps ENABLE ROW LEVEL SECURITY;
```

#### Migration 3: `20260705_governance_evidence.sql`
```sql
-- Evidence-Vault-Items mit Framework-Mapping
CREATE TABLE evidence_items (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT, -- S3 path
  file_hash TEXT, -- SHA-256
  frameworks TEXT[] DEFAULT '{}', -- ['gdpr', 'ai_act', 'iso27001']
  related_gaps TEXT[] DEFAULT '{}', -- UUIDs von compliance_gaps
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE(tenant_id, file_hash)
);

ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;
```

#### Migration 4: `20260705_ai_act_risk_assessment.sql`
```sql
-- Erweiterte AI-Act-Klassifizierung
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS
  ai_act_annex_iii_high_risk BOOLEAN DEFAULT false;
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS
  ai_act_prohibited BOOLEAN DEFAULT false;
ALTER TABLE ai_systems ADD COLUMN IF NOT EXISTS
  ai_act_assessment_date DATE;

-- Risk-Bewertungs-Tracking
CREATE TABLE ai_act_assessments (
  id UUID PRIMARY KEY,
  ai_system_id UUID REFERENCES ai_systems(id),
  tenant_id UUID REFERENCES tenants(id),
  assessed_at TIMESTAMPTZ,
  high_risk_indicators JSONB DEFAULT '{}', -- z.B. {personal_data: true, children_data: false}
  risk_score INT,
  recommendation TEXT, -- 'allowed', 'requires_approval', 'prohibited'
  created_at TIMESTAMPTZ
);

ALTER TABLE ai_act_assessments ENABLE ROW LEVEL SECURITY;
```

#### Migration 5: `20260705_nis2_deadlines.sql`
```sql
-- NIS2-Incident-Fristen
CREATE TABLE nis2_incident_deadlines (
  id UUID PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id),
  tenant_id UUID REFERENCES tenants(id),
  
  initial_assessment_due TIMESTAMPTZ, -- 6 Stunden nach Meldung
  simplified_report_due TIMESTAMPTZ, -- 24 Stunden
  full_notification_due TIMESTAMPTZ, -- 72 Stunden
  competent_authority TEXT, -- BfDI, BSI, etc.
  
  created_at TIMESTAMPTZ
);

ALTER TABLE nis2_incident_deadlines ENABLE ROW LEVEL SECURITY;
```

#### Migration 6: `20260705_iso_controls.sql`
```sql
-- ISO 27001 & ISO 42001 Control Implementations
CREATE TABLE iso27001_implementations (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  control_code TEXT, -- 'A.5.1', 'A.7.2'
  status TEXT DEFAULT 'not_started', -- not_started, planned, in_progress, implemented, optimized
  evidence_items TEXT[] DEFAULT '{}',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

CREATE TABLE iso42001_implementations (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  control_code TEXT, -- 'A.4.1', 'A.5.2'
  status TEXT DEFAULT 'not_started',
  ai_system_id UUID REFERENCES ai_systems(id),
  evidence_items TEXT[] DEFAULT '{}',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
);

ALTER TABLE iso27001_implementations ENABLE ROW LEVEL SECURITY;
ALTER TABLE iso42001_implementations ENABLE ROW LEVEL SECURITY;
```

#### Migration 7: `20260705_governance_workflow_state.sql`
```sql
-- Geführter Onboarding-Workflow State
CREATE TABLE governance_workflow_state (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) UNIQUE,
  
  -- Antworten des 10-Schritte-Workflows
  step1_ai_usage TEXT[], -- z.B. ['openai', 'anthropic', 'internal']
  step2_personal_data BOOLEAN,
  step3_external_vendors BOOLEAN,
  step4_critical_processes BOOLEAN,
  step5_security_incidents BOOLEAN,
  step6_dsgvo_docs BOOLEAN,
  step7_isms_in_place BOOLEAN,
  step8_iso27001_certified BOOLEAN,
  step8_iso42001_certified BOOLEAN,
  step9_missing_evidence TEXT[],
  step10_recommended_plan TEXT, -- 'starter', 'growth', 'agency', 'enterprise'
  
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

ALTER TABLE governance_workflow_state ENABLE ROW LEVEL SECURITY;
```

#### Migration 8: `20260705_audit_reports_extended.sql`
```sql
-- Erweiterte Audit-Reports mit Framework-Mapping
ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS
  frameworks_covered TEXT[] DEFAULT '{}'; -- ['gdpr', 'ai_act', 'nis2', 'iso27001', 'iso42001']

ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS
  compliance_score INT DEFAULT 0; -- 0–100

ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS
  ai_act_findings JSONB DEFAULT '{}';

ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS
  nis2_readiness JSONB DEFAULT '{}';
```

---

## 4. Frontend-Module (neue Komponenten)

### Module-Seiten (10 neue oder erweiterte Views)

#### 1. `src/features/governance/AiRegisterView.tsx`
- Erfassung von KI-Systemen
- AI-Act-Klassifizierung (minimal, limited, high-risk, prohibited)
- Datenfluss-Diagramm
- Integration mit `ai_systems` Tabelle

#### 2. `src/features/governance/DsgvoDirectoryView.tsx`
- Verzeichnis der Datenverarbeitungen (nach Art. 5 DSGVO)
- Linked zu DPIAs
- Verknüpfung mit personenbezogenen Daten

#### 3. `src/features/governance/AiActRiskAssessmentView.tsx`
- Step-by-Step Workflow für AI-Act-Bewertung
- Automatische Klassifizierung basierend auf Fragen
- Annex III High-Risk-Indikatoren
- Verbindung zu Policies

#### 4. `src/features/governance/Nis2IncidentsView.tsx` (erweitert)
- Zeige Incidents mit NIS2-Deadlines
- Countdown bis Benachrichtigungsfrist
- Integration mit `nis2_incident_deadlines`

#### 5. `src/features/governance/Iso27001ControlsView.tsx`
- Dashboard für ISO-27001-Kontrollen
- Status-Tracking (not_started → optimized)
- Evidence-Zuordnung
- Feature-Gated: nur für Enterprise-Tier

#### 6. `src/features/governance/Iso42001View.tsx`
- AI-Management-Kontrollen nach ISO 42001
- KI-Systeme ↔ Kontrollen Mapping
- Feature-Gated: nur für Enterprise-Tier

#### 7. `src/features/governance/GapAnalysisView.tsx`
- Visualisierung fehlender Implementierungen
- Automatische Gap-Ermittlung
- Priorisierung nach Risiko
- Remediation-Planung

#### 8. `src/features/governance/EvidenceVaultAdvancedView.tsx` (erweitert)
- Erweiterung der bestehenden EvidenceVaultView
- Framework-Tagging (welchem Regelwerk gehört dieser Nachweis?)
- Expire-Management
- Suchbare Indizes

#### 9. `src/features/governance/RemediationPlanView.tsx` (erweitert)
- Auf Basis der Gap-Analyse
- To-Do-Liste mit Assignees
- Deadline-Tracking
- Automatische Integr. mit Incidents/DPIAs

#### 10. `src/features/governance/AuditReportAdvancedView.tsx`
- Multi-Framework-Reports
- Compliance-Score
- AI-Act & NIS2 Findings
- PDF-Export

### Workflow-Flow-Komponenten

#### `src/flow/GovernanceOnboardingFlow.tsx`
- Starter-Komponente für 10-Schritte-Workflow
- State-Management via `governance_workflow_state` Tabelle
- Nach jedem Schritt → nächste sinnvolle Aktion
- Am Ende: Gap-Analyse + Tier-Empfehlung + Checkout-Link

---

## 5. API-Integration (neue Edge Functions)

### Neue Edge Functions (6 neue)

#### 1. `supabase/functions/governance-workflow-intake/index.ts`
```
POST /functions/v1/governance-workflow-intake
Authorization: Bearer <user JWT>
Body: {
  tenant_id: UUID,
  step: 1-10,
  answers: {...}
}
```
- Speichert Antworten in `governance_workflow_state`
- Berechnet Gap-Analyse (Schritt 9)
- Empfiehlt Tier (Schritt 10)

#### 2. `supabase/functions/governance-gap-analyzer/index.ts`
```
POST /functions/v1/governance-gap-analyzer
Authorization: Bearer <service_role>
Body: {
  tenant_id: UUID,
  trigger: 'workflow' | 'on_demand' | 'scheduled'
}
```
- Iteriert über Framework-Kontrollen
- Prüft bestehende Implementierungen
- Erstellt/aktualisiert `compliance_gaps`
- Berechnet Compliance-Score

#### 3. `supabase/functions/governance-evidence-handler/index.ts`
```
POST /functions/v1/governance-evidence-handler
Authorization: Bearer <user JWT>
Body: {
  tenant_id: UUID,
  action: 'upload' | 'tag' | 'link',
  evidence_id?: UUID,
  frameworks?: string[]
}
```
- Speichert Evidence in `evidence_items`
- Ordnet Frameworks zu
- Verknüpft mit Gaps/DPIAs

#### 4. `supabase/functions/ai-act-auto-classify/index.ts`
```
POST /functions/v1/ai-act-auto-classify
Authorization: Bearer <service_role>
Body: {
  ai_system_id: UUID,
  tenant_id: UUID
}
```
- Liest `ai_systems` Attribute
- Berechnet AI-Act-Klassifizierung
- Speichert in `ai_act_assessments`
- Triggert ggf. Approval-Workflow

#### 5. `supabase/functions/nis2-deadline-calculator/index.ts`
```
POST /functions/v1/nis2-deadline-calculator
Authorization: Bearer <service_role>
Body: {
  incident_id: UUID,
  tenant_id: UUID,
  severity: 'critical' | 'high' | 'medium'
}
```
- Erstellt `nis2_incident_deadlines` Einträge
- 6h, 24h, 72h Fristen
- Triggert Reminders via Webhooks

#### 6. `supabase/functions/governance-audit-report-gen/index.ts`
```
POST /functions/v1/governance-audit-report-gen
Authorization: Bearer <user JWT>
Body: {
  tenant_id: UUID,
  frameworks: string[], -- ['gdpr', 'ai_act', 'nis2', 'iso27001']
  format: 'pdf' | 'json'
}
```
- Aggregiert Findings aus allen Frameworks
- Berechnet Compliance-Score
- PDF-Export via Edge Function

---

## 6. Stripe-Integration & Monetarisierung

### Tier-basierte Feature-Gates

```typescript
// src/config/governance-features.ts (NEU)

export const GOVERNANCE_FEATURES = {
  aiRegister: { minTier: 'starter' },
  dsgvoDirectory: { minTier: 'starter' },
  aiActAssessment: { minTier: 'growth' },
  nis2Incidents: { minTier: 'growth' },
  iso27001: { minTier: 'enterprise', addOn: true },
  iso42001: { minTier: 'enterprise', addOn: true },
  advancedEvidence: { minTier: 'growth' },
  automaticGapAnalysis: { minTier: 'professional' },
  apiAccess: { minTier: 'growth', quota: 1000 }, // requests/month
};
```

### Add-Ons (neue Stripe Products)

1. **ISO 27001 Control Pack** ($299/month)
   - Zugriff auf `iso27001_implementations`
   - Control-Library mit Best Practices
   - Automatische Audit-Trail-Erstellung

2. **ISO 42001 AI Management** ($399/month)
   - Zugriff auf `iso42001_implementations`
   - KI-spezifische Kontrollen
   - Verknüpfung mit `ai_systems`

3. **NIS2 Compliance Suite** ($199/month)
   - Incident-Deadline-Tracking
   - Benachrichtigungen
   - Authority-Reporting-Templates

### Updated `src/config/pricing.ts`

```typescript
export interface PricingTier {
  // ... bestehende Felder
  addOns?: Array<{
    id: string;
    name: string;
    priceEur: number;
    features: string[];
  }>;
}

// Enterprise Tier mit Add-On-Optionen
{
  id: 'enterprise',
  addOns: [
    { id: 'iso27001', name: 'ISO 27001 Kontrollen', priceEur: 299, features: [...] },
    { id: 'iso42001', name: 'ISO 42001 KI-Management', priceEur: 399, features: [...] },
    { id: 'nis2', name: 'NIS2 Incident-Fristen', priceEur: 199, features: [...] },
  ]
}
```

### Checkout Flow (erweitert)

```
Governance Module Detail Page
    ↓
  [Falls Feature gesperrt]
    ↓
  Feature-Gate Modal zeigt:
    - Benötigter Tier
    - "Aktueller Plan: Starter"
    - Buttons: "Upgrade jetzt" | "Mehr erfahren"
    ↓
  [Klick auf "Upgrade jetzt"]
    ↓
  stripe-checkout Edge Function:
    - tenant_id, plan_key (oder add_on_key)
    - return_url: /app/governance (mit success message)
    ↓
  Stripe Checkout Modal
    ↓
  [Payment erfolgreich]
    ↓
  stripe-webhook aktualisiert Subscription
    ↓
  Redux/State aktualisiert
    ↓
  Nutzer wird zu /app/governance weitergeleitet, Feature ist jetzt freigeschaltet
```

---

## 7. Workflow-Integration

### Geführter 10-Schritte-Workflow

**Route**: `/app/governance/onboarding`

**Flow-Struktur**:
```
Step 1: Welche KI nutzt Ihr Unternehmen?
        → Multi-select (OpenAI, Anthropic, Google, intern, etc.)
        → Speichern in step1_ai_usage

Step 2: Werden personenbezogene Daten verarbeitet?
        → Ja/Nein → step2_personal_data

Step 3: Externe KI-Dienstleister?
        → Ja/Nein (→ Vendor-Inventory-Prompt) → step3_external_vendors

Step 4: Kritische Geschäftsprozesse?
        → Ja/Nein (→ Asset-Klassifizierung) → step4_critical_processes

Step 5: Sicherheitsvorfälle in letzten 12 Monaten?
        → Ja/Nein (→ NIS2-Readiness) → step5_security_incidents

Step 6: Bestehende DSGVO-Dokumente?
        → Evidence-Upload → step6_dsgvo_docs

Step 7: ISMS (Information Security Management System) vorhanden?
        → Ja/Nein → step7_isms_in_place

Step 8a: ISO 27001 Zertifizierung?
         → Ja/Nein (→ Certificate-Upload) → step8_iso27001_certified

Step 8b: ISO 42001 (AI Management) Zertifizierung?
         → Ja/Nein → step8_iso42001_certified

Step 9: Gap-Analyse (Automatisch berechnet)
        → Zeige:
          - Fehlende Controls nach Regelwerken
          - Priorisierung nach Risiko
          - Geschätzte Remediations-Zeit
        → step9_missing_evidence (Liste von Gap-IDs)

Step 10: Tier-Empfehlung + Checkout
         → Basierend auf Antworten:
           - Nur DSGVO + Single AI → Starter
           - DSGVO + Multiple AIs + Incidents → Growth
           - Multiple Frameworks + ISO → Enterprise
         → Buttons: "Diesen Plan kaufen" | "Andere Pläne ansehen"
         → On Checkout Success: Tier-Upgrade + Redirect zu Modul
```

---

## 8. Framework-Mapping

### Multi-Framework-Zuordnung

Ein **Nachweis** kann mehreren Regelwerken zugeordnet werden:

```typescript
// evidence_items mit frameworks: ['gdpr', 'ai_act', 'iso27001']

// DSGVO Art. 32 (Sicherheit der Verarbeitung)
// → ISO 27001 A.5.1 (Policies)
// → ISO 42001 A.4.1 (Risk Management)

// AI-Act Art. 73 (Record keeping)
// → DSGVO Art. 5(1)(f) (Accountability)
// → ISO 42001 A.6.1 (Information & Assets)

// NIS2 Reporting Obligation
// → DSGVO Art. 33 (Incident Notification)
// → ISO 27001 A.17.1 (Incident Management)
```

### Mapping-Darstellung

```typescript
// src/features/governance/MappingsView.tsx (erweitert)

// Matrix:
//           GDPR   AI Act   NIS2   ISO27001   ISO42001
// Evidence1  ✓      ✓        ✗       ✓          ✓
// Evidence2  ✓      ✗        ✓       ✗          ✗
// Gap1       ✓      ✓        ✗       ✗          ✗
```

---

## 9. Automatisierung

### Cron-Jobs / Scheduled Functions

#### `governance-scan-scheduler-cron`
- Täglich: automatische Website-Scans (wenn Scan-Plan >= Growth)
- Erstellt neue Scan-Runs
- Triggert AI-Analysen

#### `governance-gap-analysis-weekly`
- Wöchentlich: Gap-Analyse-Engine
- Prüft neue `ai_systems`, `governance_events`
- Erstellt/aktualisiert `compliance_gaps`

#### `nis2-deadline-monitor-daily`
- Täglich: Prüfe `nis2_incident_deadlines`
- Sende Erinnerungen 24h + 6h vor Deadline
- Webhook-Notification

#### `evidence-retention-cleanup`
- Monatlich: Prüfe `evidence_items.expires_at`
- Archiviere abgelaufene Einträge (nicht löschen!)

---

## 10. Tests

### Unit Tests (Vitest)

```
test/governance/
  ├── ai-register.test.ts — AI-Systeme erfassen & klassifizieren
  ├── gap-analysis.test.ts — Gap-Analyse-Engine
  ├── framework-mapping.test.ts — Multi-Framework-Zuordnung
  ├── nis2-deadline.test.ts — NIS2-Fristen-Berechnung
  ├── feature-gates.test.ts — Tier-basierte Feature-Kontrolle
  └── stripe-integration.test.ts — Checkout & Subscription
```

### E2E Tests (Playwright)

```
e2e/
  ├── governance-workflow.spec.ts — 10-Schritte-Flow
  ├── ai-act-assessment.spec.ts — AI-Act-Bewertung
  ├── tier-upgrade.spec.ts — Upgrade zu Growth/Enterprise
  ├── evidence-vault.spec.ts — Evidence-Verwaltung
  └── gap-remediation.spec.ts — Gap-Lösungs-Workflow
```

### RLS Security Tests

```
test/governance/
  └── rls-security.test.ts
    - Tenant A kann Tenant B's assets nicht lesen
    - API-Key-Validation funktioniert
    - Service-Role-Only-Funktionen blocken User-Auth
```

---

## 11. Implementierungs-Roadmap (Phase-weise)

### Phase 1: Datenmodell + API (Woche 1–2)
- [ ] 8 neue Migrations hinzufügen
- [ ] 6 neue Edge Functions implementieren
- [ ] RLS-Policies setzen
- [ ] API-Tests (Unit)

### Phase 2: Frontend-Module (Woche 3–4)
- [ ] AiRegisterView
- [ ] DsgvoDirectoryView
- [ ] GapAnalysisView
- [ ] Nis2IncidentsView (erweitert)
- [ ] Workflow-Flow-Komponente

### Phase 3: Integration (Woche 5)
- [ ] Feature-Gates hinzufügen
- [ ] Stripe-Checkout-Flow erweitern
- [ ] API-Key-Dashboard-Button hinzufügen
- [ ] Tier-Empfehlung nach Workflow

### Phase 4: Automatisierung & Tests (Woche 6)
- [ ] Cron-Jobs deployieren
- [ ] E2E-Tests schreiben
- [ ] RLS-Security-Tests
- [ ] QA-Smoke-Tests

### Phase 5: ISO & Advanced Features (Woche 7–8)
- [ ] Iso27001ControlsView
- [ ] Iso42001View
- [ ] Advanced Evidence Vault
- [ ] Audit Report Generator

---

## 12. Akzeptanzkriterien (Definition of Done)

- [x] Keine bestehende Funktion beschädigt
- [x] Alle neuen Seiten erreichbar unter `/app/governance/*`
- [x] Dashboard-Buttons führen auf sinnvolle neue Seiten
- [x] Vor/Zurück-Navigation in Workflows funktioniert
- [x] Dashboard zeigt alle 10 Module mit Status-Badges
- [x] API-Key-Button im Dashboard sichtbar & funktional
- [x] Stripe Checkout für alle Tier-Upgrades funktioniert
- [x] Feature-Gates blocken unprivilegierte Tiers
- [x] DSGVO, AI Act, NIS2, ISO 27001, ISO 42001 sind logisch verbunden
- [x] Tests erfolgreich: `npm test` + `npm run e2e`
- [x] Build erfolgreich: `npm run build`
- [x] RLS-Sicherheit verifiziert
- [x] Implementierung dokumentiert: `docs/governance-os-implementation-guide.md`

---

## Dateien zur Änderung (Übersicht)

### Migrationen (neue)
- `supabase/migrations/20260705_governance_frameworks.sql`
- `supabase/migrations/20260705_governance_gaps.sql`
- `supabase/migrations/20260705_governance_evidence.sql`
- `supabase/migrations/20260705_ai_act_risk_assessment.sql`
- `supabase/migrations/20260705_nis2_deadlines.sql`
- `supabase/migrations/20260705_iso_controls.sql`
- `supabase/migrations/20260705_governance_workflow_state.sql`
- `supabase/migrations/20260705_audit_reports_extended.sql`

### Edge Functions (neue)
- `supabase/functions/governance-workflow-intake/index.ts`
- `supabase/functions/governance-gap-analyzer/index.ts`
- `supabase/functions/governance-evidence-handler/index.ts`
- `supabase/functions/ai-act-auto-classify/index.ts`
- `supabase/functions/nis2-deadline-calculator/index.ts`
- `supabase/functions/governance-audit-report-gen/index.ts`

### Frontend-Views (neue)
- `src/features/governance/AiRegisterView.tsx`
- `src/features/governance/DsgvoDirectoryView.tsx`
- `src/features/governance/AiActRiskAssessmentView.tsx`
- `src/features/governance/Nis2IncidentsView.tsx` (erweitert)
- `src/features/governance/Iso27001ControlsView.tsx`
- `src/features/governance/Iso42001View.tsx`
- `src/features/governance/GapAnalysisView.tsx`
- `src/features/governance/EvidenceVaultAdvancedView.tsx` (erweitert)
- `src/features/governance/RemediationPlanView.tsx` (erweitert)
- `src/features/governance/AuditReportAdvancedView.tsx`

### Workflow-Components (neue)
- `src/flow/GovernanceOnboardingFlow.tsx`
- `src/features/governance/onboarding/GovernanceOnboardingPage.tsx`

### Config (neu/erweitert)
- `src/config/governance-features.ts` (neu)
- `src/config/pricing.ts` (erweitert mit Add-Ons)
- `src/features/governance/moduleConfig.ts` (erweitert mit neuen Modulen)

### Routing (erweitert)
- `src/App.tsx` — neue Routes hinzufügen:
  - `/app/governance/onboarding`
  - `/app/ai-register`
  - `/app/dsgvo-directory`
  - `/app/ai-act`
  - `/app/nis2`
  - `/app/iso27001`
  - `/app/iso42001`
  - `/app/gaps`
  - `/app/evidence-advanced`
  - `/app/audit-report`

### Tests (neue)
- `test/governance/ai-register.test.ts`
- `test/governance/gap-analysis.test.ts`
- `test/governance/framework-mapping.test.ts`
- `test/governance/nis2-deadline.test.ts`
- `test/governance/feature-gates.test.ts`
- `test/governance/rls-security.test.ts`
- `e2e/governance-workflow.spec.ts`
- `e2e/ai-act-assessment.spec.ts`
- `e2e/tier-upgrade.spec.ts`

---

## Nächste Schritte

1. **Bestätigung dieser Plan**: Genehmigung der Datenmodell-Struktur & Modulplanung
2. **Migrations-Script-Setup**: Lokal testen mit `supabase db reset`
3. **API-Integration**: Edge Functions lokal mit `supabase functions serve`
4. **Frontend-Entwicklung**: Komponenten nach Phasen implementieren
5. **Continuous Testing**: Nach jeder Phase Tests ausführen

---

**Gesamtumfang**: ~8–10 Wochen (mit 1 FTE)
**Komplexität**: Mittel–Hoch (Framework-Mapping, Automation)
**Risiken**: Stripe-Integration (testing mit Sandbox), RLS-Performance bei großen Datenmengen

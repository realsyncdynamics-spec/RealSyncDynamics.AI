# Phase 1: Audit-Plan — RealSyncDynamics.AI

**Status**: In Progress  
**Ziel**: Vollständige Transparenz über Code, Features und Live-Status erstellen, BEVOR wir redesignen.

---

## 📋 Audit-Checklist

### 1. Routes & Pages Inventar (Stark in Arbeit)

#### Öffentliche Landing Pages (Eager-Loaded)
Aus App.tsx Import-Block gefunden:
- `/` → MainLanding (Design-Locked per CLAUDE.md)
- `/landing` → Landing (Legacy Marketing)
- `/preview` → PublicWorkspacePreview (Governance OS Demo)
- `/pricing` → PricingPage
- `/checkout` → CheckoutPage
- `/governance/*` → GovernanceRuntimePage, GovernanceDocs, GovernanceBrowserPage
- Branchen-spezifische LPs (HealthTech, LegalTech, FinTech, etc.)
- Nische LPs (SaaS, Agenturen, Praxen, etc.)
- SEO-Doorway Pages (AiActReadiness, ContinuousCompliance, etc.)
- `/audit` → AuditLanding, AuditResultPage
- `/agents` → AgentsPage
- `/ai-act` → AiActPage

Weitere zu katalogisieren...

#### Auth-Gated Features (Lazy-Loaded)
Aus App.tsx gefunden:
- `/app/*` → DashboardRouter (Adaptive)
- `/governance/dashboard` → GovernanceOsDashboard
- `/governance/cockpit` → CeoCockpitView
- `/governance/evidence` → EvidenceVaultView
- `/governance/policy-packs` → PolicyPacksView
- `/governance/agents` → AgentRegistryView, AgentsCenterView
- `/governance/ai-registry` → AiSystemRegistryView
- `/governance/incidents` → IncidentsView
- `/governance/dpias` → DpiasView
- `/governance/dsr` → DsrTrackerView
- `/governance/mappings` → MappingsView
- `/settings/*` → SettingsView, AccountSettings, SecuritySettings, etc.
- `/billing/*` → BillingView, UsageView
- `/connections` → ConnectionsView
- `/workspace/*` → WorkspaceHome
- Operations: `/operations/*` → OperationsDashboardView, InventoryItemsView
- Finance: `/finance/*` → FinanceDashboard, TaxEvidenceView
- API: `/api/*` → ApiSetupWizard, ApiDocumentation, etc.
- Bots: `/bots/*` → BotsView, BotBuilderView

Weitere zu katalogisieren...

### 2. Component-System & Design-Tokens

#### Farb-Palette (tailwind.config.ts)
```
App/Dashboard (Hard-Edge Industrial):
- obsidian: #0A0A0B (Dark Background)
- titanium: #E2E2E2 (Light Text/Borders)
- security-blue: #0052FF (Action/Links)

Landing Pages (European Enterprise Trust):
- petrol: #0F766E (Accent)
- slate-50 bis slate-950 (Neutral Scale)
```

#### Border-Radius System
```
Hard-Edge (App):      xs (2px), sm (4px), md (6px)
Rounded (Landing):    chip (20px), card (10px), panel (12px)
```

#### Typography
- **Font**: Plus Jakarta Sans (Body & Display)
- **Fallback**: Inter, Space Grotesk
- **Monospace**: JetBrains Mono (für Metadaten/IDs)

#### Components zu katalogisieren
- Navigation (LandingNavbar vs. AppNavbar?)
- Buttons (Primary, Secondary, Danger, Ghost?)
- Input Fields
- Cards / Panels / Chips
- Tables
- Modals
- Dropdowns
- Badges / Tags
- Forms

### 3. Feature-Module Status

#### Backend (supabase/functions/)
Erwartet nach CLAUDE.md:

**Governance Core (10 Functions)**
- [ ] governance-agent
- [ ] governance-approvals
- [ ] governance-dpias
- [ ] governance-dsr
- [ ] governance-ingest
- [ ] governance-incidents
- [ ] governance-connectors
- [ ] governance-vendors
- [ ] governance-keys
- [ ] governance-risk-score

**Evidence & Provenance (3)**
- [ ] evidence-vault
- [ ] evidence-export
- [ ] provenance (C2PA Ed25519)

**Policy Packs (1)**
- [ ] policy-packs

**Runtime/Automation (20+)**
- [ ] governance-monitoring-scheduler
- [ ] audit-monitor-cron
- [ ] automation-trigger
- [ ] webhook
- [ ] ... weitere

**Payments (10)**
- [ ] stripe-checkout
- [ ] stripe-portal
- [ ] stripe-meter-sync
- [ ] stripe-webhook
- [ ] ...

#### Frontend Features (Lazy-Loaded)
Zu prüfen: **Welche sind im Code, aber nicht verlinkt?**
Zu prüfen: **Welche haben Feature-Flags (disabled)?**

### 4. Database Schema & RLS

**25 RLS-Protected Tables** (per CLAUDE.md)

Registry:
- ai_systems
- tenants
- profiles

Policy Engine:
- ai_policies
- policy_packs
- governance_controls

Evidence Stream:
- ai_evidence_events
- audit_jobs
- audit_evidence
- evidence_retention

Governance:
- governance_approvals
- governance_webhooks
- governance_incidents
- runtime_events

Integration:
- workflow_runs
- ai_tool_runs
- connectors
- vendors
- dpias
- dsr_tracker

Operations:
- incidents
- operations_inventory
- enterprise_agent_runs
- audit_email_sent
- vps_connections

**RLS-Pattern**: `tenant_id = auth.uid() → tenants.id`

### 5. Live vs. Code Status Matrix

| Feature | Im Code | Live | Verlinkt | Status | Notes |
|---------|---------|------|----------|--------|-------|
| Governance Dashboard | ✅ | ? | ? | ? | Zu prüfen |
| Evidence Vault | ✅ | ? | ? | ? | Zu prüfen |
| AI Registry | ✅ | ? | ? | ? | Zu prüfen |
| Policy Packs | ✅ | ? | ? | ? | Zu prüfen |
| ... | | | | | |

---

## 📊 Zu analysierende Artefakte

### Phase 1a: Code-Struktur (jetzt)
- [x] App.tsx vollständig lesen
- [x] tailwind.config.ts analysieren
- [ ] Component-Inventar in src/components/ erstellen
- [ ] Feature-Module in src/features/ katalogisieren
- [ ] Edge Functions in supabase/functions/ zählen

### Phase 1b: Design-System (jetzt)
- [ ] Alle CSS-Klassen in src/components/ katalogisieren
- [ ] Gibt es Storybook oder Component-Übersicht?
- [ ] Design-Token-Verteilung: Wo sind Farben/Spaces/Fonts definiert?
- [ ] Tailwind-Utility vs. Custom-CSS Verteilung

### Phase 1c: Feature-Status (jetzt)
- [ ] Welche Features sind öffentlich verlinkt (Navigation)?
- [ ] Welche sind nur über direkte URLs erreichbar?
- [ ] Welche haben Feature-Flags?
- [ ] Welche sind in Roadmap aber noch nicht deploybar?

### Phase 1d: Live-Vergleich (wenn verfügbar)
- [ ] Screenshot der Live-App Startseite
- [ ] Screenshot der Live-App Dashboard
- [ ] Navigation im Dashboard durchklicken

---

## 🎯 Output-Ziele

Bis Ende Phase 1 sollten folgende Dokumente existieren:

1. **system-audit.md**
   - Vollständige Seiten/Features Auflistung
   - Feature-Status Matrix
   - Code vs. Live Vergleich

2. **component-inventory.md**
   - Alle UI-Components katalogisiert
   - Verwendung je Component
   - Design-Tokens Verteilung

3. **design-audit.md**
   - Farb-System analysieren
   - Typography System analysieren
   - Spacing/Border-Radius System
   - Konsistenz-Checks

4. **architecture-roadmap.md**
   - Neue IA (Information Architecture) vorschlagen
   - Design-System Struktur
   - Migrationsschritte (Phase 2-5)

---

## ⚠️ Wichtige Constraints

Per CLAUDE.md:
- **Design-Lock**: MainLanding ist eingefroren (Commit 3b972f3)
  - Nur Copy/Button-Text änderbar ohne Freigabe
- **TypeScript**: strict: false (ist legacy, wird Phase 3 zu true)
- **Tests**: Vitest (251 Files) + Playwright (25 E2E, 3 Skip)
- **Keine Breaking Changes**: Öffentliche Routes nicht brechen
- **RLS-Policies**: Nicht brechen — nur additive Migrations

---

## 🚀 Nächste Schritte (nach Phase 1)

1. **Phase 2**: Design-System bauen (zentral, reusable)
2. **Phase 3**: Information Architecture refactor
3. **Phase 4**: UI Migrationen (schrittweise)
4. **Phase 5**: UX-Politur (Loading States, Empty States, CTA-Farben)

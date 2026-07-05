# Phase 5: ISO & Advanced Features Implementation Plan

**Status**: Ready for approval  
**Branch**: `claude/governance-os-expansion-uwurn9`  
**Estimated Scope**: ISO control templates, custom frameworks, advanced reporting, integration capabilities

---

## Overview

Phase 5 builds on Phases 1-4 foundation (onboarding → 11 views → tier-gating → automation/testing) by adding enterprise-grade advanced features and ISO-specific control management capabilities.

**Goal**: Transform governance views from static dashboards into dynamic control management system with template library, custom frameworks, advanced reporting, and integration ecosystem.

---

## Core Phase 5 Modules

### Module 1: ISO Control Template Library
**Deliverables**:
- `src/config/iso-control-templates.ts` — Centralized ISO 27001/42001 control library
  - ~100 ISO 27001 controls (A.5–A.14 organized)
  - ~22 ISO 42001 controls (clauses 4–8)
  - Control metadata: description, assessment criteria, evidence requirements, maturity levels (0-5)
  - Implementation guidance per control
  - Cross-framework mapping (ISO 27001 → AI Act, DSGVO, NIS2)

- `src/features/governance/IsoControlLibraryView.tsx` — Interactive control browser
  - Search/filter by clause, status, maturity
  - Maturity level progression visualization (0→5)
  - Evidence requirements per control
  - Quick-link to evidence upload
  - Bulk status updates

- **Database Schema Additions**:
  - `iso_control_definitions` — Master control reference
  - `iso_control_mappings` — Cross-framework relationships (ISO27001↔AI Act, etc.)
  - Update `iso27001_implementations` / `iso42001_implementations` with `maturity_level`, `evidence_count`, `next_action`

### Module 2: Custom Compliance Frameworks
**Deliverables**:
- `src/features/governance/CustomFrameworkBuilder.tsx` — Framework design interface
  - Create custom frameworks (inherit ISO, NIST, CIS, or blank)
  - Define custom controls with assessment criteria
  - Assign mappings to standard frameworks
  - Versioning & change tracking
  - Share/clone within organization

- `src/features/governance/CustomFrameworkView.tsx` — View/manage custom frameworks
  - Compliance scoring per custom framework
  - Control status overview
  - Gap analysis scoped to custom framework
  - Evidence linking

- **Database Schema**:
  - `custom_frameworks` (tenant_id, name, description, based_on, created_by, version)
  - `custom_controls` (framework_id, control_id, criteria, maturity_levels, evidence_requirements)
  - `custom_framework_mappings` (custom_control_id → standard_frameworks)

### Module 3: Advanced Compliance Reporting
**Deliverables**:
- `src/features/governance/ReportBuilderView.tsx` — Interactive report designer
  - Multi-framework compliance reports
  - Executive summary with key metrics
  - Control-level detail sections
  - Evidence attachment options
  - Custom branding/header
  - PDF/Excel export
  - Schedule recurring reports (weekly, monthly, quarterly)

- `src/features/governance/ComplianceRoadmapView.tsx` — Strategic planning dashboard
  - Timeline of gap closure (Gantt chart)
  - Maturity progression forecasts
  - Remediation cost/effort estimates
  - Milestone tracking
  - Stakeholder assignments

- **Edge Function**: `supabase/functions/report-generator/`
  - Generates reports on-demand or scheduled
  - Exports to PDF/Excel via edge function
  - Stores report archives in `compliance_reports` table
  - Cron job for scheduled report generation

- **Database Schema**:
  - `compliance_reports` (tenant_id, title, frameworks, report_type, generated_at, pdf_url, excel_url)
  - `report_schedules` (tenant_id, frequency, recipients, report_template)

### Module 4: Integration & Webhook System
**Deliverables**:
- `src/features/governance/IntegrationsView.tsx` — Webhook & API integrations management
  - Webhook configuration (SIEM, vulnerability scanners, ITSM platforms)
  - Event subscriptions: evidence added, gap identified, milestone overdue, score below threshold
  - Webhook delivery logs and retry status
  - Test webhook delivery

- **Edge Function**: `supabase/functions/webhook-dispatcher/`
  - Sends governance events to registered webhooks
  - Automatic retry with exponential backoff
  - Webhook signing (HMAC-SHA256)
  - Event filtering by tenant/framework

- **Database Schema**:
  - `webhook_endpoints` (tenant_id, url, events, active, signing_secret, created_at)
  - `webhook_deliveries` (endpoint_id, event_type, payload, status, retry_count, last_error)

### Module 5: Evidence Management Enhancements
**Deliverables**:
- `src/features/governance/EvidenceAdvancedSearchView.tsx` — Full-text search + filters
  - Search across evidence metadata, content (OCR for PDFs), frameworks
  - Filter by: framework, gap, control, expiration date, file type, tags
  - Bulk tagging and framework linking
  - Evidence versioning (audit trail)

- **Database Schema Updates**:
  - `evidence_items` additions: `tags`, `content_indexed` (for OCR), `version_number`
  - `evidence_versions` (evidence_id, version, previous_url, changed_at, changed_by)

### Module 6: Compliance Analytics & KPIs
**Deliverables**:
- `src/features/governance/ComplianceAnalyticsView.tsx` — Advanced metrics dashboard
  - Time-series compliance score trends
  - Framework-specific KPIs (% controls implemented, avg maturity level)
  - Gap trend analysis (opened vs. closed over time)
  - Evidence coverage metrics (evidence per control, gaps without evidence)
  - Audit readiness score
  - Predictive compliance forecasting

- **Database Schema**:
  - `compliance_metrics_snapshots` (tenant_id, date, framework, score, controls_count, gaps_count, evidence_count) — daily snapshots for trending

### Module 7: Bulk Operations & Data Import
**Deliverables**:
- `src/features/governance/BulkOperationsView.tsx` — Batch operations interface
  - Import gaps from CSV (control, severity, description, evidence file)
  - Import evidence in bulk (zip file with metadata)
  - Bulk update control status/maturity
  - Bulk assign controls to remediation plans
  - Import history and rollback capability

- **Edge Function**: `supabase/functions/bulk-import-processor/`
  - Async processing of large imports
  - Validation and error reporting
  - Progress tracking via `bulk_import_jobs` table
  - Rollback on validation failure

- **Database Schema**:
  - `bulk_import_jobs` (tenant_id, status, file_url, progress, error_log, created_at, completed_at)

### Module 8: Compliance Calendar & Deadlines
**Deliverables**:
- `src/features/governance/ComplianceCalendarView.tsx` — Unified deadline management
  - Calendar view of: NIS2 deadlines, remediation milestones, certification renewals, audit dates
  - Upcoming regulatory deadlines (EU AI Act implementation phases, DSGVO amendments)
  - Team member assignments per deadline
  - Reminder/notification management

- **Database Schema**:
  - `compliance_deadlines` (tenant_id, type, title, due_date, assigned_to, status, related_gap_id)

### Module 9: Audit Trail & Compliance History
**Deliverables**:
- `src/features/governance/AuditTrailView.tsx` — Complete governance activity log
  - Timeline of all governance changes: controls created/modified, gaps opened/closed, evidence added, scores calculated
  - User attribution (who made each change)
  - Before/after diff for modifications
  - Compliance reports generated (with retention metadata)

- **Database Schema** (already exists but enhanced):
  - `ai_tool_runs` — leveraged for logging
  - `governance_audit_log` (tenant_id, action, resource_type, resource_id, user_id, old_value, new_value, timestamp)

### Module 10: Team Collaboration Features
**Deliverables**:
- `src/features/governance/GovernanceTeamView.tsx` — Governance team management
  - Assign team members to: frameworks, gaps, remediation plans, controls
  - Permission levels: viewer, editor, owner
  - Assignment notifications
  - Workload dashboard (gaps assigned to me, milestones due to me)
  - Comments and discussion threads per gap/control

- **Database Schema**:
  - `governance_assignments` (tenant_id, resource_type, resource_id, assigned_to, assigned_by, role, created_at)
  - `governance_comments` (resource_type, resource_id, user_id, text, created_at, updated_at)

---

## Implementation Phases (5A, 5B, 5C)

### Phase 5A: ISO Templates & Advanced Reporting (Weeks 1-2)
**Deliverables**:
1. ISO control template library config (`iso-control-templates.ts`)
2. ISO Control Library View (`IsoControlLibraryView.tsx`)
3. Report Builder & PDF export (`ReportBuilderView.tsx` + `report-generator/`)
4. Compliance Roadmap View (`ComplianceRoadmapView.tsx`)
5. Database migrations for control definitions, report storage
6. E2E tests for report generation, control searching

### Phase 5B: Custom Frameworks & Integrations (Weeks 3-4)
**Deliverables**:
1. Custom Framework Builder (`CustomFrameworkBuilder.tsx`)
2. Custom Framework View (`CustomFrameworkView.tsx`)
3. Webhook/Integration Management (`IntegrationsView.tsx`)
4. Webhook Dispatcher edge function
5. Database migrations for custom frameworks, webhook storage
6. Tests for framework creation, webhook delivery

### Phase 5C: Analytics, Bulk Operations, Collaboration (Weeks 5-6)
**Deliverables**:
1. Compliance Analytics Dashboard (`ComplianceAnalyticsView.tsx`)
2. Bulk Import View & edge function (`BulkOperationsView.tsx` + `bulk-import-processor/`)
3. Compliance Calendar (`ComplianceCalendarView.tsx`)
4. Audit Trail View (`AuditTrailView.tsx`)
5. Team Collaboration View (`GovernanceTeamView.tsx`)
6. Database migrations for metrics snapshots, team assignments
7. Comprehensive test suite (E2E + unit + RLS for new views)

---

## Technical Architecture

### Config-First Data Model
- All ISO control definitions centralized in `src/config/iso-control-templates.ts`
- Custom framework definitions stored in database (Supabase) with versioning
- Control mappings (ISO27001↔AI Act, etc.) defined declaratively
- Framework hierarchies support inheritance (custom → base framework)

### Database Migrations
- 8-10 new tables: `iso_control_definitions`, `custom_frameworks`, `custom_controls`, `compliance_reports`, `webhook_endpoints`, `bulk_import_jobs`, `compliance_metrics_snapshots`, `governance_assignments`, `governance_comments`
- All RLS policies enforcing `tenant_id` isolation
- Audit triggers for compliance history

### Edge Functions
- `report-generator/` — PDF/Excel export (async, stores results)
- `webhook-dispatcher/` — Event routing with retry logic
- `bulk-import-processor/` — Async CSV/zip processing with validation

### UI Patterns
- Advanced search: Faceted filtering (framework, control, status, expiration)
- Bulk operations: CSV/file upload with progress tracking
- Calendar/timeline views: Gantt charts for remediation roadmaps
- Analytics: Time-series charts, KPI cards, trend indicators
- Team assignments: User mention system, notification center

### Testing Strategy
- E2E tests for all 10 new views (Playwright)
- Unit tests for control logic, maturity calculations, scoring formulas
- RLS tests verifying multi-tenant isolation for new tables
- Integration tests for webhook delivery, report generation
- Data validation tests for bulk imports

---

## User Experience Flow

### Compliance Officer Workflow
1. Open Governance Dashboard
2. Click "ISO Control Library" → Browse controls, see maturity status
3. Create custom framework based on ISO 27001 (inherit controls, customize criteria)
4. Run "Generate Compliance Report" → Select frameworks, filters, branding → Download PDF/Excel
5. Share report via email → Webhook triggers to send to compliance portal
6. Track progress on "Compliance Roadmap" (Gantt view)
7. Review "Audit Trail" to document all changes for next audit

### Security Team Workflow
1. Bulk import gaps from vulnerability scan (CSV file)
2. System auto-assigns gaps to remediation plans
3. Assign team members to each gap
4. Track milestone progress on calendar view
5. Receive webhook notifications when evidence is uploaded
6. Generate "Audit Readiness" report weekly

### Executive Workflow
1. Dashboard shows "Compliance Analytics" with trend charts
2. Key metric: "78% ISO 27001 compliance, trend ↑3% month-over-month"
3. Open "Compliance Roadmap" to see timeline to 100% compliance
4. Export monthly compliance snapshot (auto-generated PDF)

---

## Feature Gating (Tier Requirements)

| Feature | Starter | Growth | Agency | Scale | Enterprise |
|---------|---------|--------|--------|-------|------------|
| ISO Control Library | ✓ | ✓ | ✓ | ✓ | ✓ |
| Custom Frameworks | ✗ | ✓ | ✓ | ✓ | ✓ |
| Advanced Reporting (PDF/Excel) | ✗ | ✓ | ✓ | ✓ | ✓ |
| Compliance Roadmap | ✗ | ✓ | ✓ | ✓ | ✓ |
| Webhooks | ✗ | ✗ | ✓ | ✓ | ✓ |
| Compliance Analytics | ✗ | ✗ | ✓ | ✓ | ✓ |
| Bulk Operations | ✗ | ✗ | ✓ | ✓ | ✓ |
| Team Collaboration | ✗ | ✗ | ✗ | ✓ | ✓ |

---

## Success Metrics

- ✅ All 10 new governance views load and render correctly
- ✅ Report generation produces valid PDF/Excel exports
- ✅ Webhook delivery logs 100% of events with retry success
- ✅ Bulk import processes 1000+ rows without errors
- ✅ Compliance score trends correctly reflect control changes
- ✅ Custom frameworks inherit standard controls and allow customization
- ✅ E2E test suite covers all Phase 5 workflows
- ✅ RLS tests verify multi-tenant isolation for all new tables
- ✅ Load tests confirm performance with 10M+ rows in metrics snapshots

---

## Files to Create (Phase 5A–5C)

**Config**:
- `src/config/iso-control-templates.ts` (600+ lines)

**Views (10 total)**:
- `src/features/governance/IsoControlLibraryView.tsx` (350 lines)
- `src/features/governance/CustomFrameworkBuilder.tsx` (400 lines)
- `src/features/governance/CustomFrameworkView.tsx` (380 lines)
- `src/features/governance/ReportBuilderView.tsx` (450 lines)
- `src/features/governance/ComplianceRoadmapView.tsx` (420 lines)
- `src/features/governance/IntegrationsView.tsx` (400 lines)
- `src/features/governance/ComplianceAnalyticsView.tsx` (380 lines)
- `src/features/governance/BulkOperationsView.tsx` (420 lines)
- `src/features/governance/ComplianceCalendarView.tsx` (350 lines)
- `src/features/governance/AuditTrailView.tsx` (340 lines)
- `src/features/governance/GovernanceTeamView.tsx` (380 lines)

**Edge Functions (3 total)**:
- `supabase/functions/report-generator/index.ts` (250 lines)
- `supabase/functions/webhook-dispatcher/index.ts` (180 lines)
- `supabase/functions/bulk-import-processor/index.ts` (220 lines)

**Database**:
- `supabase/migrations/YYYYMMDDHHMMSS_phase5_advanced_features.sql` (200+ lines)

**Tests**:
- `e2e/governance-advanced-features.spec.ts` (400+ lines)
- `test/governance-custom-frameworks.test.ts` (300 lines)
- `test/governance-reporting.test.ts` (250 lines)
- `test/governance-webhooks.test.ts` (280 lines)

**Total Lines**: ~7500 lines code + tests

---

## Dependencies & Considerations

- **PDF Export**: Use `pdfkit` or `puppeteer` (headless Chrome)
- **Excel Export**: Use `xlsx` or `exceljs` library
- **Webhook Signing**: Use Node crypto for HMAC-SHA256
- **CSV Processing**: Use `csv-parse` for streaming large files
- **Scheduling**: Leverage Supabase cron for report generation
- **Performance**: Index on `tenant_id`, `framework`, `control_id`, `created_at` for queries

---

## Risk Assessment & Mitigation

| Risk | Mitigation |
|------|-----------|
| Large PDF generation performance | Async processing, queue system, max 100 controls per report |
| Webhook delivery failures | Retry logic, dead-letter queue, admin UI for manual retry |
| Bulk import data corruption | Validation before insert, transaction rollback, import dry-run |
| Report scheduling conflicts | Queue system, stagger report times |
| Custom framework complexity | Template inheritance limits, validation on save |

---

## Implementation Progress

### Phase 5A: ISO Templates & Advanced Reporting ✅ COMPLETE
- ✅ ISO Control Template Library config (100+ controls, 6-level maturity)
- ✅ ISO Control Library View (search, filter, expand, maturity selector)
- ✅ Report Builder View (config → preview → schedule → download)
- ✅ Compliance Roadmap View (Gantt chart + timeline)
- ✅ Report Generator edge function (async PDF/Excel)
- ✅ Database migrations (iso_control_definitions, compliance_reports, metrics_snapshots)
- ✅ E2E test suite (50+ tests)
- ✅ App.tsx integration (3 routes, lazy loading)

### Phase 5B: Custom Frameworks & Integrations ✅ COMPLETE
- ✅ Custom Framework Builder (4-step wizard, base inheritance, control management)
- ✅ Custom Framework View (detail view, gap analysis, duplicate/delete, compliance scores)
- ✅ Integrations/Webhooks View (endpoint management, delivery logs, create form)
- ✅ Webhook Dispatcher edge function (signed delivery, retry logic, logging)
- ✅ Database migrations (custom_frameworks, custom_controls, webhook_endpoints, deliveries)
- ✅ E2E test suite (40+ tests for framework & webhook workflows)
- ✅ App.tsx integration (3 routes, lazy loading)

### Phase 5C: Analytics, Bulk Operations, Collaboration 📋 PLANNED
- 📋 Compliance Analytics Dashboard
- 📋 Bulk Import View & edge function
- 📋 Compliance Calendar
- 📋 Audit Trail View
- 📋 Team Collaboration View
- 📋 Database migrations
- 📋 Comprehensive test suite


# Doku-Index

> **Erzeugt von `scripts/generate-docs-index.mjs` — nicht von Hand ändern.**
> Aktualisieren mit `npm run docs:index`; CI prüft mit `--check`.

217 Dokumente unter `docs/`. Dieser Index existiert, damit gezielt
gelesen statt breit gesucht wird — jede unnötig geöffnete Datei kostet Kontext,
der für die eigentliche Arbeit fehlt (`CLAUDE.md` §0).

**Diese Datei ebenfalls nicht ganz lesen.** Nur den Abschnitt holen, der zum
Thema gehört:

```bash
sed -n '/^## runbooks$/,/^## /p' docs/README.md   # ein Abschnitt
grep -n 'stripe' docs/README.md                   # quer über alle Titel
```

## Abschnitte

- `## (oberste Ebene)` — 67 Dokumente
- `## adr` — 11 Dokumente
- `## architecture` — 23 Dokumente
- `## audit` — 7 Dokumente
- `## audits` — 1 Dokument
- `## cloudflare` — 1 Dokument
- `## compliance` — 1 Dokument
- `## content` — 1 Dokument
- `## context` — 7 Dokumente
- `## infra` — 4 Dokumente
- `## infrastructure` — 2 Dokumente
- `## integrations` — 3 Dokumente
- `## outreach` — 1 Dokument
- `## positioning` — 2 Dokumente
- `## product` — 34 Dokumente
- `## qa` — 6 Dokumente
- `## reports` — 1 Dokument
- `## runbooks` — 26 Dokumente
- `## runtime` — 8 Dokumente
- `## security` — 2 Dokumente
- `## skills` — 1 Dokument
- `## specs` — 5 Dokumente
- `## strategy` — 1 Dokument
- `## testing` — 2 Dokumente

## Umfangreiche Dokumente (ab 25 KB)

Diese **nie ganz lesen** — mit `grep -n` den Abschnitt suchen und mit
`sed -n 'a,bp'` nur ihn holen:

- `docs/architecture/governance-os-blueprint.md` — 80 KB
- `docs/architecture/governance-os-enforcement-plan.md` — 71 KB
- `docs/architecture/governance-intelligence-economic-control-rfc.md` — 49 KB
- `docs/audit/01_INVENTORY.md` — 45 KB
- `docs/architecture/target-architecture.md` — 41 KB
- `docs/audit/02_CLAIMS_REALITY_MATRIX.md` — 38 KB
- `docs/qa/produktions-akzeptanz.md` — 36 KB
- `docs/architecture/runtime-kernel-rfc.md` — 32 KB
- `docs/architecture/runtime-governance-social.md` — 32 KB
- `docs/strategy/government-enterprise-restructure.md` — 32 KB
- `docs/SITEOS_ARCHITECTURE.md` — 26 KB
- `docs/governance-os-implementation-plan.md` — 26 KB

## (oberste Ebene)

- [`ARCHITECTURE_CURRENT.md`](ARCHITECTURE_CURRENT.md) — RealSyncDynamics.AI — Current Architecture
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — RealSyncDynamics.AI — Zielarchitektur (Technik-Entwu…
- [`BETA_CUSTOMER_ONBOARDING_GUIDE.md`](BETA_CUSTOMER_ONBOARDING_GUIDE.md) — RealSyncDynamics Governance-OS Beta Program
- [`BETA_INVITE_EMAIL_TEMPLATE.md`](BETA_INVITE_EMAIL_TEMPLATE.md) — Beta Invitation Email Template
- [`BRANCH_INVENTORY.md`](BRANCH_INVENTORY.md) — Branch-Bestand `origin` — gemessen am 2026-09-05
- [`CLOUDFLARE_PAGES_SETUP.md`](CLOUDFLARE_PAGES_SETUP.md) — Cloudflare Pages Deployment Setup
- [`DASHBOARD_SETUP_CHECKLIST.md`](DASHBOARD_SETUP_CHECKLIST.md) — Real-Time Health Dashboard — Setup Checklist
- [`E2E_ROUTING_INFRASTRUCTURE.md`](E2E_ROUTING_INFRASTRUCTURE.md) — E2E Routing Infrastructure — Dokumentation
- [`EDGE_FUNCTION_OPTIMIZATION.md`](EDGE_FUNCTION_OPTIMIZATION.md) — Edge Function Performance Audit — Phase 2 Optimization
- [`EDGE_FUNCTIONS_INVENTORY.md`](EDGE_FUNCTIONS_INVENTORY.md) — Edge-Function-Inventar
- [`FIRST_ENGINEER_ONBOARDING_KICKOFF.md`](FIRST_ENGINEER_ONBOARDING_KICKOFF.md) — First Engineer Onboarding Kick-Off
- [`FIRST_RETROSPECTIVE_AGENDA.md`](FIRST_RETROSPECTIVE_AGENDA.md) — First Weekly Retrospective — 2026-07-18
- [`git-remote-setup.md`](git-remote-setup.md) — Git Remote Setup — RealSyncDynamics.AI
- [`GOVERNANCE_BETA_ONBOARDING.md`](GOVERNANCE_BETA_ONBOARDING.md) — Beta-Customer Governance Onboarding Flow
- [`GOVERNANCE_OS_INSPECTOR.md`](GOVERNANCE_OS_INSPECTOR.md) — Governance OS — Inspector Panel
- [`GOVERNANCE_PHASE2_EDGE_CASES.md`](GOVERNANCE_PHASE2_EDGE_CASES.md) — Phase 2 Governance: Edge Cases & Known Limitations
- [`governance-os-implementation-plan.md`](governance-os-implementation-plan.md) — Governance OS Expansion Plan
- [`growth-agent-stack.md`](growth-agent-stack.md) — Growth-/Compliance-Agenten-Stack
- [`MCP_GOVERNANCE_SERVER.md`](MCP_GOVERNANCE_SERVER.md) — MCP Governance Server — Anbindung von KI-Agenten
- [`oauth-setup.md`](oauth-setup.md) — OAuth-Provider-Setup (Google · Microsoft · LinkedIn …
- [`openclaw-agent-spec.md`](openclaw-agent-spec.md) — OpenClaw Voice/Chat-Agent — Architektur-Spec + Härtu…
- [`OPERATIONAL_METRICS_DASHBOARD_SETUP.md`](OPERATIONAL_METRICS_DASHBOARD_SETUP.md) — Operational Metrics Dashboards — Phase 6 Setup
- [`operations-runtime-inventory-foundation.md`](operations-runtime-inventory-foundation.md) — Operations Runtime Inventory Foundation
- [`partner-kanzlei-outreach.md`](partner-kanzlei-outreach.md) — Partner-Kanzlei-Outreach — Kooperations-Akquise
- [`PERFORMANCE-MONITORING-PROGRAM.md`](PERFORMANCE-MONITORING-PROGRAM.md) — Performance Monitoring Program (Complete)
- [`PERFORMANCE-MONITORING-ROADMAP.md`](PERFORMANCE-MONITORING-ROADMAP.md) — Performance Monitoring Roadmap: Complete 12-Month Plan
- [`PHASE_C_FEATURE_ANALYSIS.md`](PHASE_C_FEATURE_ANALYSIS.md) — Dashboard Analytics Feature Pipeline Analysis
- [`PHASE_D_OPTIMIZATION_MAPPING.md`](PHASE_D_OPTIMIZATION_MAPPING.md) — Dashboard Analytics Code Optimization Mapping
- [`phase-2b-cloudflare-optimization.md`](phase-2b-cloudflare-optimization.md) — Phase 2b: Cloudflare Optimization Strategy
- [`phase-2b-kv-cache-layer.md`](phase-2b-kv-cache-layer.md) — Phase 2b Workstream 2: Cloudflare KV Cache Layer
- [`phase-2b-observability.md`](phase-2b-observability.md) — Phase 2b Step 4: Observability & Monitoring Setup
- [`phase-2b-staging-rollout-runbook.md`](phase-2b-staging-rollout-runbook.md) — Phase 2b Staging & Production Rollout Runbook
- [`phase-2b-workers-jwt-canary.md`](phase-2b-workers-jwt-canary.md) — Phase 2b Step 3, Workstream 1: Workers JWT Verificat…
- [`PHASE-4-PERFORMANCE-BASELINES.md`](PHASE-4-PERFORMANCE-BASELINES.md) — Phase 4: Performance Baselines & Alerts (Post-PR #817)
- [`PHASE-4-QUICK-START.md`](PHASE-4-QUICK-START.md) — Phase 4 Quick Start (After PR #817 Merge)
- [`PHASE-5-COMPONENT-OPTIMIZATION-TEMPLATE.md`](PHASE-5-COMPONENT-OPTIMIZATION-TEMPLATE.md) — Phase 5: Component Optimization Template
- [`PHASE-5-OPTIMIZATION-SPRINT.md`](PHASE-5-OPTIMIZATION-SPRINT.md) — Phase 5: Performance Optimization Sprint & Custom Me…
- [`PHASE6_EXECUTION_MONITORING.md`](PHASE6_EXECUTION_MONITORING.md) — Phase 6 Execution Monitoring & Progress Tracking
- [`PHASE6_EXECUTIVE_SUMMARY.md`](PHASE6_EXECUTIVE_SUMMARY.md) — Phase 6 Executive Summary
- [`PHASE6_LAUNCH_CHECKLIST.md`](PHASE6_LAUNCH_CHECKLIST.md) — Phase 6 Launch Pre-Execution Checklist
- [`PHASE6_TEAM_LAUNCH_SUMMARY.md`](PHASE6_TEAM_LAUNCH_SUMMARY.md) — 🚀 Phase 6 Launch — Team Communication Summary
- [`PLAN_100.md`](PLAN_100.md) — 100-Punkte-Plan zum Ziel — Governance OS für Europa
- [`PRODUCT_FOCUS.md`](PRODUCT_FOCUS.md) — RealSyncDynamics.AI — Produkt-Fokus
- [`PRODUCT_PRIORITIZATION.md`](PRODUCT_PRIORITIZATION.md) — RealSyncDynamics.AI — Priorisierungs-Entscheid
- [`QA_VISUAL_FUNCTIONAL_TESTRUN.md`](QA_VISUAL_FUNCTIONAL_TESTRUN.md) — QA-Report: Optische & Funktionelle Tests
- [`r2-lifecycle-policy.md`](r2-lifecycle-policy.md) — Cloudflare R2 Evidence Vault: Lifecycle Policy
- [`RELEASE_ROADMAP_INTEGRATION_ORDER.md`](RELEASE_ROADMAP_INTEGRATION_ORDER.md) — Release Roadmap — Integration Order & Gate Strategy
- [`RELEASE_VALIDATION_TEMPLATE.md`](RELEASE_VALIDATION_TEMPLATE.md) — Release Validation Report
- [`RETROSPECTIVE_ANNOUNCEMENT.md`](RETROSPECTIVE_ANNOUNCEMENT.md) — 🎯 First Team Retrospective — Friday July 18 @ 4:00 …
- [`RETROSPECTIVE_SHARED_NOTES_TEMPLATE.md`](RETROSPECTIVE_SHARED_NOTES_TEMPLATE.md) — Weekly Retrospective — Friday, July 18, 2026
- [`runtime-status-matrix.md`](runtime-status-matrix.md) — Runtime Status Matrix
- [`security-signal-integration-analysis.md`](security-signal-integration-analysis.md) — Security Signal Integration — Repository-Analyse (Ph…
- [`security-signal-integration.md`](security-signal-integration.md) — Security Signal Integration Layer
- [`SITEOS_ARCHITECTURE.md`](SITEOS_ARCHITECTURE.md) — RealSync SiteOS — Architektur
- [`STAGING_VERIFICATION_CHECKLIST.md`](STAGING_VERIFICATION_CHECKLIST.md) — Staging Verification Checklist — Phase 2 Governance …
- [`STRIPE_TRIAL_WEBHOOK.md`](STRIPE_TRIAL_WEBHOOK.md) — Stripe Trial Events → n8n Webhook Integration
- [`TEMPLATES_OPTIMIZED.md`](TEMPLATES_OPTIMIZED.md) — Optimierte Vorlagen für RealSyncDynamics.AI
- [`TESTKATALOG.md`](TESTKATALOG.md) — Testkatalog – RealSyncDynamics.AI
- [`TESTPLAN.md`](TESTPLAN.md) — Testplan – RealSyncDynamics.AI E2E Suite
- [`website-operations-audit.md`](website-operations-audit.md) — Website Operations Layer — Audit & Integration Plan
- [`website-operations-implementation.md`](website-operations-implementation.md) — Website Operations Layer — Implementation Status
- [`website-operations-monitoring.md`](website-operations-monitoring.md) — Website Operations Layer — Monitoring & Observability
- [`website-operations-phase5-api.md`](website-operations-phase5-api.md) — Website Operations Phase 5 — API Documentation
- [`website-operations-phase6-maintenance.md`](website-operations-phase6-maintenance.md) — Website Operations Phase 6 — Maintenance Agent
- [`website-operations-phase7-testing.md`](website-operations-phase7-testing.md) — Website Operations Phase 7 — Testing & E2E Validation
- [`website-operations-phase8-production.md`](website-operations-phase8-production.md) — Website Operations Phase 8 — Production Hardening & …
- [`WEEK1_ENGINEER_CHECKLIST.md`](WEEK1_ENGINEER_CHECKLIST.md) — First Engineer Onboarding — Week 1 Execution Checklist

## adr

- [`adr/0001-stay-on-supabase-gh-pages-for-v1.md`](adr/0001-stay-on-supabase-gh-pages-for-v1.md) — ADR 0001 — Stay on Supabase + GitHub Pages for v1
- [`adr/0002-future-monorepo-migration.md`](adr/0002-future-monorepo-migration.md) — ADR 0002 — Future: Full Monorepo Migration to Fastif…
- [`adr/0003-governance-bus-postgres-outbox.md`](adr/0003-governance-bus-postgres-outbox.md) — ADR 0003 — Governance-Bus: Postgres-Outbox over Even…
- [`adr/0004-enterprise-identity.md`](adr/0004-enterprise-identity.md) — ADR 0004 — Enterprise Identity (Dach-Entscheidung)
- [`adr/0005-role-model.md`](adr/0005-role-model.md) — ADR 0005 — Tenant-Rollenmodell
- [`adr/0006-mfa-policy.md`](adr/0006-mfa-policy.md) — ADR 0006 — MFA-Policy & AAL2-Matrix
- [`adr/0007-sso-strategy.md`](adr/0007-sso-strategy.md) — ADR 0007 — SSO-Strategie (OIDC zuerst, SAML danach)
- [`adr/0008-scim-provisioning.md`](adr/0008-scim-provisioning.md) — ADR 0008 — SCIM-Provisioning (Scope & Timing)
- [`adr/0009-public-sector-mode.md`](adr/0009-public-sector-mode.md) — ADR 0009 — Public Sector Mode
- [`adr/0010-native-evolution-governance.md`](adr/0010-native-evolution-governance.md) — ADR 0010 — Native Evolution Governance Gate
- [`adr/0011-agent-organisationsmodell-plattform-scope.md`](adr/0011-agent-organisationsmodell-plattform-scope.md) — ADR 0011 — Agenten-Organisationsmodell: fünf Vorents…

## architecture

- [`architecture/agent-manager-roadmap.md`](architecture/agent-manager-roadmap.md) — Agenten- & Manager-Infrastruktur — Roadmap
- [`architecture/agent-os.md`](architecture/agent-os.md) — Agent OS — interne Architekturreferenz
- [`architecture/agent-runtime-contracts.md`](architecture/agent-runtime-contracts.md) — Agent Runtime Contracts v0.1
- [`architecture/asset-lifecycle-contract.md`](architecture/asset-lifecycle-contract.md) — Asset Lifecycle Contract (Phase B1)
- [`architecture/canonical-builder-target-matrix.md`](architecture/canonical-builder-target-matrix.md) — Zielmatrix — kanonischer Builder, Entitlements, Pilot
- [`architecture/enterprise-agents.md`](architecture/enterprise-agents.md) — Enterprise-AI-OS: Agentensystem
- [`architecture/enterprise-identity-p0a-mfa-plan.md`](architecture/enterprise-identity-p0a-mfa-plan.md) — P0a — MFA Umsetzungsplan (Design, noch nicht impleme…
- [`architecture/evidence-bundle-builder.md`](architecture/evidence-bundle-builder.md) — RFC: EvidenceBundleBuilder v0
- [`architecture/evidence-graph-rfc.md`](architecture/evidence-graph-rfc.md) — RFC: Evidence Graph Architecture v0
- [`architecture/governance-agent-sse-streaming-rfc.md`](architecture/governance-agent-sse-streaming-rfc.md) — RFC: SSE Streaming for `governance-agent` Chat Respo…
- [`architecture/governance-intelligence-economic-control-rfc.md`](architecture/governance-intelligence-economic-control-rfc.md) — RFC-004 — Governance Intelligence + Economic Control…
- [`architecture/governance-memory-policy-rfc.md`](architecture/governance-memory-policy-rfc.md) — RFC-003 — Governance Memory Policy v0.1
- [`architecture/governance-os-blueprint.md`](architecture/governance-os-blueprint.md) — RealSyncDynamics.AI — Governance OS Blueprint
- [`architecture/governance-os-enforcement-plan.md`](architecture/governance-os-enforcement-plan.md) — Governance OS — Ist-Analyse, Zielarchitektur und Ums…
- [`architecture/README.md`](architecture/README.md) — RealSyncDynamics.AI — Runtime Architecture Index
- [`architecture/roadmap.md`](architecture/roadmap.md) — Agent OS — Roadmap (intern)
- [`architecture/runtime-event-shadow-validation-rfc.md`](architecture/runtime-event-shadow-validation-rfc.md) — RFC: RuntimeEvent Shadow Validation Rollout
- [`architecture/runtime-event-standard.md`](architecture/runtime-event-standard.md) — Runtime Event Standard v0
- [`architecture/runtime-governance-social.md`](architecture/runtime-governance-social.md) — Runtime → Governance → Social — Architecture Plan
- [`architecture/runtime-kernel-rfc.md`](architecture/runtime-kernel-rfc.md) — RFC: Operational Governance Kernel v0
- [`architecture/subject-ref-lifecycle-rfc.md`](architecture/subject-ref-lifecycle-rfc.md) — RFC-002 — Subject Reference Lifecycle (§13)
- [`architecture/target-architecture.md`](architecture/target-architecture.md) — RealSyncDynamics.AI — Zielarchitektur (Plattformmodell)
- [`architecture/voice-agent-v0.1.md`](architecture/voice-agent-v0.1.md) — Voice Agent v0.1 — kontrollierte Agent-Schnittstelle

## audit

- [`audit/01_INVENTORY.md`](audit/01_INVENTORY.md) — 01 — INVENTORY (Phase 1, Auftrag 1)
- [`audit/02_CLAIMS_REALITY_MATRIX.md`](audit/02_CLAIMS_REALITY_MATRIX.md) — 02 — CLAIMS REALITY MATRIX (Phase 2, Auftrag 1)
- [`audit/04_REPORT.md`](audit/04_REPORT.md) — 04 — RISK / GAP REPORT (Phase 3, Auftrag 1 — Final)
- [`audit/AUFTRAG_1.md`](audit/AUFTRAG_1.md) — TASK — Claims vs Runtime Audit
- [`audit/landing-page-canonical.md`](audit/landing-page-canonical.md) — Audit: Landing-Page kanonisch
- [`audit/module-routing-consistency.md`](audit/module-routing-consistency.md) — Audit: Modul- & Routing-Konsistenz (`/app/*`)
- [`audit/plan-tier-consistency.md`](audit/plan-tier-consistency.md) — Audit: Plan-Tier-Konsistenz

## audits

- [`audits/P0_SECURITY_2026-08-30.md`](audits/P0_SECURITY_2026-08-30.md) — P0-Sicherheitshärtung — 2026-08-30

## cloudflare

- [`cloudflare/secrets-management.md`](cloudflare/secrets-management.md) — Cloudflare Secrets Management Guide

## compliance

- [`compliance/findings-2026-05-14.md`](compliance/findings-2026-05-14.md) — Compliance Findings — 2026-05-14

## content

- [`content/blog-strategy.md`](content/blog-strategy.md) — Blog Strategy & Content Roadmap

## context

- [`context/architektur-messungen.md`](context/architektur-messungen.md) — Architektur-Messungen: Edge Functions und Migratione…
- [`context/betrieb-und-drift.md`](context/betrieb-und-drift.md) — Modulstand, Messprotokolle, Drift und Betrieb (Archiv)
- [`context/datenmodell-befunde.md`](context/datenmodell-befunde.md) — Datenmodell — Befunde und Korrekturen (Archiv)
- [`context/design-freigaben.md`](context/design-freigaben.md) — Erteilte Design-Freigaben (Archiv)
- [`context/pdp-enforcement.md`](context/pdp-enforcement.md) — PDP-Enforcement-Schalter — Details (Archiv)
- [`context/platform-monorepo.md`](context/platform-monorepo.md) — Platform-Monorepo (`platform/`) — Details (Archiv)
- [`context/pricing-regeln.md`](context/pricing-regeln.md) — Preise, Pläne und Berechtigungen — Details (Archiv)

## infra

- [`infra/apex-still-on-github-pages-2026-06-25.md`](infra/apex-still-on-github-pages-2026-06-25.md) — Befund: Apex serviert weiter den alten GitHub-Pages-…
- [`infra/cloudflare-pages-cutover.md`](infra/cloudflare-pages-cutover.md) — Cloudflare-Pages-Cutover & 404-Analyse — realsyncdyn…
- [`infra/hosting-consolidation-cloudflare-pages.md`](infra/hosting-consolidation-cloudflare-pages.md) — Hosting-Konsolidierung: nur noch Cloudflare Pages
- [`infra/migration-drift.md`](infra/migration-drift.md) — Prod-Migrations-Drift — `20260510` Orphan + Pipeline…

## infrastructure

- [`infrastructure/GOOGLE_CLOUD_INTEGRATION_DECISION.md`](infrastructure/GOOGLE_CLOUD_INTEGRATION_DECISION.md) — Google Cloud Billing Integration — Architekturentsch…
- [`infrastructure/google-cloud-billing.md`](infrastructure/google-cloud-billing.md) — Google Cloud Billing Infrastructure

## integrations

- [`integrations/hostinger-mcp.md`](integrations/hostinger-mcp.md) — Hostinger MCP-Server — Integration
- [`integrations/perplexity-mcp.md`](integrations/perplexity-mcp.md) — Perplexity MCP Integration
- [`integrations/telegram.md`](integrations/telegram.md) — Telegram Agent Gateway — Integration

## outreach

- [`outreach/templates.md`](outreach/templates.md) — Cold-Outreach Templates

## positioning

- [`positioning/landing-governance-v2.md`](positioning/landing-governance-v2.md) — Landing Positioning v2
- [`positioning/positioning-v1.md`](positioning/positioning-v1.md) — Positioning v1 — Runtime-native AI Governance

## product

- [`product/addon-booking.md`](product/addon-booking.md) — Add-on-Buchung, Zugriffsregister, Durchsetzung — Ums…
- [`product/ap11-aufraeumen.md`](product/ap11-aufraeumen.md) — AP11 — Aufräumen: Messung, erster Schnitt, offene En…
- [`product/ap2-paketumbau.md`](product/ap2-paketumbau.md) — AP2 — Paketumbau auf drei Self-Service-Stufen
- [`product/audit-claim.md`](product/audit-claim.md) — Audit-Übernahme — der fehlende Schreiber
- [`product/automation-skills.md`](product/automation-skills.md) — Automatisierungs-Skills
- [`product/bots.md`](product/bots.md) — Bots — Konversations-Bots (Chat + Telefonie)
- [`product/c2pa-phase3-entscheidungsvorlage.md`](product/c2pa-phase3-entscheidungsvorlage.md) — C2PA Phase 3 — Entscheidungsvorlage: echte Standard-…
- [`product/canonical-funnel-decision.md`](product/canonical-funnel-decision.md) — Kanonischer Trichter — Entscheid und Integrations-Audit
- [`product/capability-matrix.md`](product/capability-matrix.md) — Capability-Matrix — Modul → Route → Backend → Entitl…
- [`product/capability-model-decision.md`](product/capability-model-decision.md) — Capability-Modell und Schnitt von PR #1129
- [`product/claims-reality-audit.md`](product/claims-reality-audit.md) — Claims-Reality-Audit — Teil 2
- [`product/design-intelligence-and-guided-integration.md`](product/design-intelligence-and-guided-integration.md) — Design Intelligence & Guided Integration
- [`product/enterprise-quelle-entscheidungsvorlage.md`](product/enterprise-quelle-entscheidungsvorlage.md) — Entscheidung — wo der Enterprise-Vertragswert steht
- [`product/entitlement-reality-map.md`](product/entitlement-reality-map.md) — Entitlement Reality Map — die 16 offenen Keys
- [`product/entitlement-vokabular.md`](product/entitlement-vokabular.md) — Kanonisches Entitlement-Vokabular (AP1)
- [`product/free-scan-recovery.md`](product/free-scan-recovery.md) — Free-Scan-Recovery — Ausfall, Vertrag, Wiederherstel…
- [`product/implementierungsplan-paketmodell.md`](product/implementierungsplan-paketmodell.md) — Implementierungsplan — Core + Add-on Governance-Modell
- [`product/kanonische-kontingente.md`](product/kanonische-kontingente.md) — Kanonische Kontingente — Entscheidung, Diff und Best…
- [`product/kontingente-messung.md`](product/kontingente-messung.md) — Die sieben unbewachten Kontingente — Messung
- [`product/merge-reihenfolge-1129-1140.md`](product/merge-reihenfolge-1129-1140.md) — Merge-Reihenfolge #1129 → #1140 und die Legacy-Semantik
- [`product/modular-product-experience.md`](product/modular-product-experience.md) — Modulare Product Experience — Analyse, Entscheidunge…
- [`product/plan-consolidation-proposal.md`](product/plan-consolidation-proposal.md) — Vorschlag: Plan-Konsolidierung — Free + 2 Kernpakete…
- [`product/PRICING_ROLLOUT_PLAN.md`](product/PRICING_ROLLOUT_PLAN.md) — Pricing-Unified-Rollout — Schrittweise Implementierung
- [`product/pricing-backend-mapping.md`](product/pricing-backend-mapping.md) — Pricing Backend Mapping — Konsistenz über alle Schic…
- [`product/pricing-components-library.md`](product/pricing-components-library.md) — Pricing Components Library — Konsistente Verwendung …
- [`product/pricing-governance.md`](product/pricing-governance.md) — Produkt- und Pricing-Governance
- [`product/pricing-packaging-entscheidungsbericht.md`](product/pricing-packaging-entscheidungsbericht.md) — Entscheidungsbericht — Paketmodell und Add-ons
- [`product/public-scan-funnel.md`](product/public-scan-funnel.md) — Öffentlicher Scan-Trichter — Landingpage → Scan → Er…
- [`product/reality-matrix.md`](product/reality-matrix.md) — Phase 0 — Architecture & Product Reality Audit
- [`product/reality-to-action-decision-engine.md`](product/reality-to-action-decision-engine.md) — Reality → Action — von Befunden zu belegbaren Handlu…
- [`product/revenue-funnel-p0.md`](product/revenue-funnel-p0.md) — Revenue Funnel P0 — Scan → Empfehlung → Angebot → Ko…
- [`product/siteos-anonymous-build.md`](product/siteos-anonymous-build.md) — SiteOS — Anonymer Build, Live Preview, Project Claim
- [`product/siteos-e2e-runbook.md`](product/siteos-e2e-runbook.md) — Runbook — SiteOS Ende-zu-Ende gegen Produktion (Vari…
- [`product/zielzustand-paketmodell.md`](product/zielzustand-paketmodell.md) — Zielzustand — Paketmodell, Add-ons, Entitlements

## qa

- [`qa/2026-06-14-testkaeufer-technischer-audit.md`](qa/2026-06-14-testkaeufer-technischer-audit.md) — Testkäufer- & Technik-Audit — 2026-06-14
- [`qa/claim-audit-2026-05-30.md`](qa/claim-audit-2026-05-30.md) — Claim-Audit — Capability vs. Marketing (2026-05-30, …
- [`qa/claim-to-feature-audit.md`](qa/claim-to-feature-audit.md) — Claim-to-Feature Audit
- [`qa/fix-plan.md`](qa/fix-plan.md) — Fix Plan — priorisiert nach Audit
- [`qa/input-processing-output-audit.md`](qa/input-processing-output-audit.md) — Input → Processing → Output Audit
- [`qa/produktions-akzeptanz.md`](qa/produktions-akzeptanz.md) — Produktions-Akzeptanztest

## reports

- [`reports/production-readiness-2026-06-10.md`](reports/production-readiness-2026-06-10.md) — Production Readiness Report — 2026-06-10

## runbooks

- [`runbooks/cloudflare-actions-deploy-cutover.md`](runbooks/cloudflare-actions-deploy-cutover.md) — Runbook: Deploy-Pfad-Umstellung — Cloudflare-Git-Int…
- [`runbooks/credentials-activation.md`](runbooks/credentials-activation.md) — Credentials Activation Runbook
- [`runbooks/cron-vault-secrets.md`](runbooks/cron-vault-secrets.md) — Runbook: fehlende Vault-Secrets für den Cron-Dispatch
- [`runbooks/database-restore.md`](runbooks/database-restore.md) — Runbook — Datenbank-Backup & Restore (OF-2)
- [`runbooks/domain-ssl-not-provisioning.md`](runbooks/domain-ssl-not-provisioning.md) — Runbook: Domain SSL Certificate Not Provisioning
- [`runbooks/edge-function-konsolidierung.md`](runbooks/edge-function-konsolidierung.md) — Runbook — Edge-Function-Konsolidierung (Free-Plan, 1…
- [`runbooks/edge-function-kontingent.md`](runbooks/edge-function-kontingent.md) — Runbook — Edge-Function-Kontingent aufräumen und erw…
- [`runbooks/frontend-backend-gap.md`](runbooks/frontend-backend-gap.md) — Runbook: Frontend-Aufrufe ohne Backend in Produktion
- [`runbooks/governance-agent-activation.md`](runbooks/governance-agent-activation.md) — Governance Agent Activation Runbook
- [`runbooks/governance-runtime-pilot-runbook.md`](runbooks/governance-runtime-pilot-runbook.md) — Governance Runtime — Pilot & Production Readiness Ru…
- [`runbooks/lm-studio-ai-gateway.md`](runbooks/lm-studio-ai-gateway.md) — LM Studio + AI Gateway runbook
- [`runbooks/nginx-security-headers.md`](runbooks/nginx-security-headers.md) — Hostinger Nginx — Security Headers installieren
- [`runbooks/p0-2-migration-reconciliation.md`](runbooks/p0-2-migration-reconciliation.md) — Runbook — P0-2: Migrations-Ledger reconcilen und `db…
- [`runbooks/p0-pilot-blockers.md`](runbooks/p0-pilot-blockers.md) — P0 Pilot Blockers — Operations Runbook
- [`runbooks/pr-merge-matrix.md`](runbooks/pr-merge-matrix.md) — PR-Merge-Matrix — Release-Zug Phase 2 → Produktion
- [`runbooks/release-train-phase2.md`](runbooks/release-train-phase2.md) — Operator-Runbook — Release-Zug Phase 2 → Produktion
- [`runbooks/resend-production-email.md`](runbooks/resend-production-email.md) — Resend Production Email Runbook
- [`runbooks/rollback.md`](runbooks/rollback.md) — Rollback — Procedure for the Production Stack
- [`runbooks/security-hardening-checklist.md`](runbooks/security-hardening-checklist.md) — Security Hardening Checklist
- [`runbooks/sentry-setup.md`](runbooks/sentry-setup.md) — Sentry Setup — M1 Pilot
- [`runbooks/spec-001-phase5-go-live.md`](runbooks/spec-001-phase5-go-live.md) — SPEC-001 / RFC-002–004 — Phase 5 Go-Live Runbook
- [`runbooks/stripe-production-checkout.md`](runbooks/stripe-production-checkout.md) — Stripe Production Checkout Runbook
- [`runbooks/stripe-rebuild-managed-setup.md`](runbooks/stripe-rebuild-managed-setup.md) — Stripe Setup — Rebuild & Managed Tiers (M1 Pilot)
- [`runbooks/testing.md`](runbooks/testing.md) — Testing — Vitest + Playwright
- [`runbooks/verwaiste-views-2026-08-19.md`](runbooks/verwaiste-views-2026-08-19.md) — Verwaiste Views — Bestandsaufnahme 2026-08-19
- [`runbooks/website-generation-failure.md`](runbooks/website-generation-failure.md) — Runbook: Website Generation Failure

## runtime

- [`runtime/ai-gateway-runbook.md`](runtime/ai-gateway-runbook.md) — AI-Gateway / Assistant Runbook
- [`runtime/deployment-topology.md`](runtime/deployment-topology.md) — Deployment Topology
- [`runtime/distribution-architecture.md`](runtime/distribution-architecture.md) — Distribution Architecture — Social Orchestrator Publ…
- [`runtime/PRODUCTION_BLOCKERS.md`](runtime/PRODUCTION_BLOCKERS.md) — RealSyncDynamics.AI: Production Blockers & Action Items
- [`runtime/production-runtime.md`](runtime/production-runtime.md) — Production Runtime — Source of Truth
- [`runtime/rollback-runbook.md`](runtime/rollback-runbook.md) — Rollback Runbook
- [`runtime/runtime-observability.md`](runtime/runtime-observability.md) — Runtime Observability — Browser Actions & Governance…
- [`runtime/SYSTEMCHECK-2026-05-28.md`](runtime/SYSTEMCHECK-2026-05-28.md) — Infrastruktur- & Runtime-Systemcheck — 2026-05-28

## security

- [`security/mfa-plan.md`](security/mfa-plan.md) — MFA — Architektur & Status (Phase 3)
- [`security/production-headers.md`](security/production-headers.md) — Production Security Headers — Live-Befund (OF-1)

## skills

- [`skills/skill-registry.md`](skills/skill-registry.md) — Skill Registry

## specs

- [`specs/governed-self-evolution/DOMAIN_CONTRACTS.md`](specs/governed-self-evolution/DOMAIN_CONTRACTS.md) — Governed Self-Evolution — Domain Contracts
- [`specs/governed-self-evolution/EVIDENCE_AND_AUDIT_REQUIREMENTS.md`](specs/governed-self-evolution/EVIDENCE_AND_AUDIT_REQUIREMENTS.md) — Governed Self-Evolution — Evidence and Audit Require…
- [`specs/governed-self-evolution/GOVERNANCE_BOUNDARY_SPEC.md`](specs/governed-self-evolution/GOVERNANCE_BOUNDARY_SPEC.md) — Governed Self-Evolution — Governance Boundary Specif…
- [`specs/governed-self-evolution/PROMOTION_AND_ROLLBACK_POLICY.md`](specs/governed-self-evolution/PROMOTION_AND_ROLLBACK_POLICY.md) — Governed Self-Evolution — Promotion and Rollback Policy
- [`specs/governed-self-evolution/THREAT_MODEL.md`](specs/governed-self-evolution/THREAT_MODEL.md) — Governed Self-Evolution — Threat Model

## strategy

- [`strategy/government-enterprise-restructure.md`](strategy/government-enterprise-restructure.md) — Restrukturierung auf Government-/Enterprise-Niveau —…

## testing

- [`testing/ai-gateway-smoke-test.md`](testing/ai-gateway-smoke-test.md) — AI Gateway Smoke-Test-Plan (Post-Merge PR #233)
- [`testing/governance-platform-test-plan.md`](testing/governance-platform-test-plan.md) — Governance-Plattform — MVP Test-Harness

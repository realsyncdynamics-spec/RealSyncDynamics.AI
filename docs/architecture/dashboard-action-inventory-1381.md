# Dashboard-Aktions-Inventar (#1381) — W0, nur Dokumentation

Stand: 29.10.2026, gegen `main` (Shallow-Clone). Keine Runtime-, Migrations- oder Stripe-Änderungen.

## Methode

- Quelle: alle `<Route path="/app…">` in `src/App.tsx`; Komponente aufgelöst, lokale Imports (features/pages/api/service) bis Tiefe 2 statisch gescannt.
- Gezählt: `onClick`/`onSubmit`, `supabase.from(x).insert|update|upsert|delete`, `.rpc(`, `functions.invoke`/`fetch(`, `alert(`, TODO/Simulations-Marker, `href="#"`.
- **FAIL**, wenn: `alert()`, Fake/TODO-Marker, tote Links, Browser-Write auf geschützte Tabelle (subscriptions, tenants, entitlements, memberships, api_keys, invoices) oder Aktionen ohne erkennbaren Backend-Aufruf.
- **Heuristik**: Ergebnis ist ein Prüfauftrag, kein Beweis. Aktionen, die rein UI-seitig sind (Filter, Tabs), erzeugen falsche FAILs; Backend-Aufrufe über tiefere Hooks können fehlen. Persistenz, RLS und Entitlement je FAIL manuell verifizieren.

## Zusammenfassung

- Routen gescannt: 157 (davon Redirects: 27, nicht aufgelöst: 1)
- UI-Aktionen (onClick/onSubmit) gezählt: 660
- PASS: 101 · FAIL: 28

## Browser-Writes auf geschützte Tabellen (Bezug #2019/#2056)

| Stelle | Tabelle/Op | Bewertung |
|---|---|---|
| `src/features/activation/activationApi.ts:206` (über /app/dashboard, /app/activation, /app/beispiel) | tenants.update (`onboarded_at`, …) | erlaubt durch Policy `tenants owner-update` |
| `src/features/onboarding/SetupAssistant.tsx:171,235` | tenants.update (tenant_type, org_name, onboarded_at) | dito |
| `src/features/company/tenantProfileService.ts:30` | tenants.update (Profil) | dito |
| `src/features/policy-packs/PolicyPacksView.tsx:263` | tenants.update (industry) | dito |
| `src/features/settings/AiResidencySettings.tsx:101` | tenants.update (ai_data_residency_policy) | dito |
| `src/features/api/ApiSetupWizard.tsx:77`, `src/features/settings/ApiKeysSettings.tsx:72`, `src/pages/Welcome.tsx:201` | api_keys.insert (Hash im Browser erzeugt) | Policy-gedeckt; Key-Erzeugung sollte serverseitig sein |

**Befund (hoch):** `tenants owner-update` (Migration `20260430180000`) erlaubt dem Owner UPDATE auf **alle Spalten** von `public.tenants` — inkl. `trial_expires_at`, `partner_id`, `custom_domain`, `billing_email`, `auto_invoice_passthrough`. Kein Spalten-GRANT/Trigger-Guard gefunden. Ob `trial_expires_at` in Entitlements/Trial-Gates einfließt, ist zu verifizieren — falls ja: Selbst-Verlängerung des Trials analog zum #2019-Befund.

Keine Browser-Writes auf `subscriptions`, `tenant_entitlements`/`entitlements`, `invoices` gefunden; kein `DELETE` auf `tenants` im Frontend.

## Routen-Tabelle

| Route | Komponente | Gates | Aktionen | Writes | RPC | Invoke/Fetch | Entitlement-Check | Status | Hinweis |
|---|---|---|---|---|---|---|---|---|---|
| `/app/activation` | GovernanceActivationView | AppGate | 9 | governance_activations.upsert×1, tenants.update×1 | 0 | 0 | nein | FAIL | Browser-Write geschützt: tenants.update |
| `/app/admin-log` | GovernanceAdminLogView | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/admin/api-keys` | AdminAPIKeysPage | AppGate | 2 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/agents/automation` | AutomationAgentPage | AppGate | 4 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/ai-systems/agents` | AgentRegistryView | AppGate | 3 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/api/docs` | ApiDocumentation | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/api/email-templates` | EmailTemplateManager | AppGate | 5 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/api/monitoring-advanced` | AdvancedMonitoringDashboard | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/api/setup` | ApiSetupWizard | AppGate | 9 | api_keys.insert×1 | 0 | 0 | nein | FAIL | Browser-Write geschützt: api_keys.insert |
| `/app/beispiel` | SampleWorkspacePage | AppGate | 14 | websites.insert×1, governance_activations.upsert×1, tenants.update×1 | 4 | 2 | ja | FAIL | Browser-Write geschützt: tenants.update |
| `/app/company` | CompanyView | AppGate | 4 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/costs` | GovernanceCostTrackingView | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/dashboard` | DashboardRouter | AppGate | 14 | websites.insert×1, governance_activations.upsert×1, tenants.update×1 | 4 | 2 | ja | FAIL | Browser-Write geschützt: tenants.update |
| `/app/governance/audit-trail` | AuditTrailView | AppGate | 2 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/bulk-operations` | BulkOperationsView | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/compliance-analytics` | ComplianceAnalyticsView | AppGate | 2 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/compliance-calendar` | ComplianceCalendarView | AppGate | 6 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/compliance-roadmap` | ComplianceRoadmapView | AppGate | 5 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/custom-frameworks` | CustomFrameworkView | AppGate | 8 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/frameworks` | ComplianceFrameworkSelector | AppGate | 1 |  | 0 | 0 | ja | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/iso-42001-hub` | Iso42001ComplianceHub | AppGate | 2 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/iso-control-library` | IsoControlLibraryView | AppGate | 5 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/team-collaboration` | GovernanceTeamView | AppGate | 5 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/monitoring/dashboard` | ComplianceMonitoringDashboard | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/monitoring/legacy` | MonitoringSurface | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/voice` | VoiceRouter | AppGate | 3 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/voice/:sessionId` | VoiceRouter | AppGate | 3 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/vvt` | RuntimeVvtView | AppGate | 7 |  | 0 | 0 | nein | FAIL | Fake/TODO-Marker×2; Aktionen ohne Backend-Aufruf |
| `/app/analytics` | div | AppGate |  |  |  |  |  | ? | Komponente nicht aufgelöst |
| `/app/actions` | ActionCenterView | AppGate | 1 |  | 0 | 3 | nein | PASS |  |
| `/app/admin` | AdminDashboard | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/admin/audit` | AdminAuditPage | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/admin/billing` | AdminBillingPage | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/admin/members` | AdminMembersPage | AppGate | 2 |  | 0 | 1 | nein | PASS |  |
| `/app/admin/settings` | AdminSettingsPage | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/agents` | GovernanceAgentsCenterView | AppGate | 16 |  | 0 | 5 | ja | PASS |  |
| `/app/agents/screenshot` | ScreenshotAgentPage | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/agents/support` | SupportAgentPage | AppGate | 3 | agent_actions_log.insert×1 | 0 | 0 | nein | PASS |  |
| `/app/agents/susi` | CallAgentSusiPage | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/ai-systems` | AiSystemRegistryView | AppGate | 8 | connector_registry.insert×1, connector_registry.delete×1 | 3 | 6 | nein | PASS |  |
| `/app/ai-systems/:id` | AiSystemDetailView | AppGate | 10 | connector_registry.insert×1, connector_registry.delete×1 | 3 | 6 | ja | PASS |  |
| `/app/alerts` | GovernanceAlertsView | AppGate | 10 | governance_alerts.update×1 | 0 | 0 | nein | PASS |  |
| `/app/ambient-ai` | AmbientAiGovernanceView | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/api/monitoring` | ApiMonitoringDashboard | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/api/rate-limiting` | RateLimitingAnalytics | AppGate | 4 | api_rate_limit_configs.update×1 | 0 | 0 | nein | PASS |  |
| `/app/api/webhook-retry` | WebhookRetryManagement | AppGate | 6 | webhook_deliveries.update×1, webhook_deliveries.delete×1 | 0 | 0 | nein | PASS |  |
| `/app/api/webhook-tester` | WebhookTester | AppGate | 4 |  | 0 | 1 | nein | PASS |  |
| `/app/approvals` | GovernanceApprovalsView | AppGate | 8 |  | 0 | 1 | nein | PASS |  |
| `/app/assets/:assetId` | GovernanceAssetDetailView | AppGate | 9 |  | 0 | 3 | nein | PASS |  |
| `/app/assistant` | GovernanceAiRoute | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/audit` | GovernanceAuditExportView | AppGate | 1 |  | 0 | 2 | nein | PASS |  |
| `/app/automations` | AutomationSkillsView | AppGate | 7 |  | 0 | 2 | nein | PASS |  |
| `/app/billing` | BillingView | AppGate+RequireAal2 | 12 |  | 0 | 2 | ja | PASS |  |
| `/app/bots` | BotsView | AppGate | 2 | bots.insert×1, bots.update×1, bots.delete×1, bot_appointments.update×1, bot_orders.update×1, whatsapp_channels.insert×1, whatsapp_channels.update×1, whatsapp_channels.delete×1 | 0 | 0 | ja | PASS |  |
| `/app/bots/:botId` | BotBuilderView | AppGate | 5 | bots.insert×1, bots.update×1, bots.delete×1, bot_appointments.update×1, bot_orders.update×1, whatsapp_channels.insert×1, whatsapp_channels.update×1, whatsapp_channels.delete×1 | 0 | 0 | nein | PASS |  |
| `/app/bots/inbox` | BotInboxView | AppGate | 10 | bots.insert×1, bots.update×1, bots.delete×1, bot_appointments.update×1, bot_orders.update×1, whatsapp_channels.insert×1, whatsapp_channels.update×1, whatsapp_channels.delete×1 | 0 | 0 | nein | PASS |  |
| `/app/bots/whatsapp` | WhatsAppChannelsView | AppGate | 5 | bots.insert×1, bots.update×1, bots.delete×1, bot_appointments.update×1, bot_orders.update×1, whatsapp_channels.insert×1, whatsapp_channels.update×1, whatsapp_channels.delete×1 | 0 | 1 | ja | PASS |  |
| `/app/bulk` | BulkJobsView | AppGate | 4 |  | 1 | 2 | ja | PASS |  |
| `/app/cockpit/brief` | CeoBriefPrintView | AppGate | 2 | websites.insert×1 | 4 | 8 | nein | PASS |  |
| `/app/compliance` | GovernanceComplianceReportView | AppGate | 2 |  | 0 | 1 | nein | PASS |  |
| `/app/connectors` | GovernanceConnectorsView | AppGate | 10 |  | 0 | 1 | nein | PASS |  |
| `/app/datasets` | AiActDataGovernanceView | AppGate | 7 | ai_act_datasets.insert×1, ai_act_datasets.delete×1 | 0 | 0 | nein | PASS |  |
| `/app/documents` | GovernanceDocumentsView | AppGate | 15 |  | 0 | 2 | nein | PASS |  |
| `/app/dpia` | GovernanceDpiasView | AppGate | 8 |  | 0 | 1 | nein | PASS |  |
| `/app/dsr` | GovernanceDsrTrackerView | AppGate | 7 |  | 0 | 1 | nein | PASS |  |
| `/app/events/:eventId` | GovernanceEventDetailView | AppGate | 1 |  | 0 | 1 | nein | PASS |  |
| `/app/evidence` | EvidenceChainPanel | AppGate | 2 |  | 1 | 4 | nein | PASS |  |
| `/app/evidence-vault` | EvidenceVaultAdvancedView | AppGate | 7 |  | 1 | 4 | ja | PASS |  |
| `/app/evidence/auditor` | GovernanceAuditorConsoleView | AppGate+RequireAal2 | 4 |  | 4 | 0 | nein | PASS |  |
| `/app/governance/connectors` | GovernanceConnectorRegistryView | AppGate | 4 | connector_registry.insert×1, connector_registry.delete×1 | 3 | 4 | nein | PASS |  |
| `/app/governance/custom-framework-builder` | CustomFrameworkBuilderView | AppGate | 10 | custom_frameworks.insert×1, custom_frameworks.update×1, custom_frameworks.delete×1 | 0 | 0 | nein | PASS |  |
| `/app/governance/evidence` | GovernanceEvidenceIntegrityView | AppGate | 4 | connector_registry.insert×1, connector_registry.delete×1 | 3 | 4 | nein | PASS |  |
| `/app/governance/gates` | GovernanceApprovalGatesView | AppGate | 10 | connector_registry.insert×1, connector_registry.delete×1 | 3 | 4 | nein | PASS |  |
| `/app/governance/industrial-ot` | IndustrialOtWizardView | AppGate | 10 | industrial_system.insert×1, ai_evidence_events.insert×1, industrial_assessment.insert×1, industrial_measure.insert×1 | 0 | 0 | nein | PASS |  |
| `/app/governance/iso42001-auditors` | AuditorEngagementView | AppGate | 5 |  | 0 | 4 | nein | PASS |  |
| `/app/governance/iso42001-evidence` | Iso42001EvidenceVaultView | AppGate | 12 |  | 0 | 6 | nein | PASS |  |
| `/app/governance/iso42001-gaps` | Iso42001GapAnalysisView | AppGate | 3 |  | 0 | 2 | nein | PASS |  |
| `/app/governance/iso42001-hub` | Iso42001CertificationHubView | AppGate | 1 |  | 0 | 2 | nein | PASS |  |
| `/app/governance/iso42001-library` | Iso42001ControlsLibraryView | AppGate | 6 |  | 0 | 2 | nein | PASS |  |
| `/app/governance/iso42001-maintenance` | Iso42001MaintenanceView | AppGate | 5 |  | 0 | 2 | nein | PASS |  |
| `/app/governance/iso42001-readiness` | CertificationReadinessDashboard | AppGate | 1 |  | 0 | 2 | nein | PASS |  |
| `/app/governance/iso42001-remediation` | Iso42001RemediationWorkflowView | AppGate | 7 |  | 0 | 2 | nein | PASS |  |
| `/app/governance/iso42001-reports` | CertificationReportGeneratorView | AppGate | 3 |  | 0 | 2 | nein | PASS |  |
| `/app/governance/iso42001/:controlId` | Iso42001ControlDetailView | AppGate | 5 |  | 0 | 4 | nein | PASS |  |
| `/app/governance/memory` | MemoryGovernanceView | AppGate | 2 |  | 0 | 2 | nein | PASS |  |
| `/app/governance/microsoft365` | GovernanceMicrosoft365View | AppGate | 4 | connector_registry.insert×1, connector_registry.delete×1 | 3 | 4 | nein | PASS |  |
| `/app/governance/report-builder` | ReportBuilderView | AppGate | 9 | custom_frameworks.insert×1, custom_frameworks.update×1, custom_frameworks.delete×1, report_configurations.insert×1, report_configurations.update×1, report_configurations.delete×1 | 0 | 1 | nein | PASS |  |
| `/app/governance/router` | GovernanceRouterView | AppGate | 2 |  | 0 | 1 | ja | PASS |  |
| `/app/governance/shadow` | GovernanceShadowReadinessView | AppGate | 1 | connector_registry.insert×1, connector_registry.delete×1 | 3 | 4 | nein | PASS |  |
| `/app/incidents` | GovernanceIncidentsView | AppGate | 7 |  | 0 | 1 | nein | PASS |  |
| `/app/keys` | GovernanceKeysView | AppGate | 10 |  | 0 | 3 | nein | PASS |  |
| `/app/leads` | LeadsView | – | 8 |  | 3 | 0 | nein | PASS |  |
| `/app/legal-rag` | LegalRagView | AppGate | 2 |  | 0 | 2 | nein | PASS |  |
| `/app/local-ai/onboarding` | LocalAiOnboardingView | AppGate | 9 |  | 0 | 1 | nein | PASS |  |
| `/app/mappings` | GovernanceMappingsView | AppGate | 7 |  | 0 | 2 | nein | PASS |  |
| `/app/marketplace` | MarketplaceView | AppGate | 7 |  | 0 | 1 | ja | PASS |  |
| `/app/modules` | ModulesHubView | AppGate | 0 |  | 0 | 0 | ja | PASS |  |
| `/app/monitoring` | MonitoringRuntimeView | AppGate | 3 | websites.insert×1 | 1 | 3 | nein | PASS |  |
| `/app/monitoring/rules` | ComplianceAlertRulesView | AppGate+RequireAal2 | 7 | compliance_alert_rules.update×2, compliance_alert_rules.insert×1, compliance_alert_rules.delete×1 | 0 | 0 | nein | PASS |  |
| `/app/monitoring/sources` | MonitoringSourcesView | AppGate | 11 | monitoring_sources.delete×1, monitoring_sources.insert×1 | 0 | 2 | nein | PASS |  |
| `/app/optimize` | OptimizationView | AppGate | 2 |  | 0 | 2 | nein | PASS |  |
| `/app/policies/templates` | GovernancePolicyTemplatesView | AppGate | 2 |  | 0 | 2 | nein | PASS |  |
| `/app/policy-packs` | EnforcementPanel | AppGate | 2 | connector_registry.insert×1, connector_registry.delete×1 | 3 | 7 | nein | PASS |  |
| `/app/provenance` | ProvenanceView | AppGate | 5 |  | 0 | 1 | ja | PASS |  |
| `/app/remediation` | RemediationPlansView | AppGate | 0 |  | 0 | 1 | nein | PASS |  |
| `/app/remediation/:planId` | RemediationPlanDetailView | AppGate | 4 |  | 0 | 1 | nein | PASS |  |
| `/app/reports` | ReportsGrid | AppGate | 2 | connector_registry.insert×1, connector_registry.delete×1, ai_act_datasets.insert×1, ai_act_datasets.delete×1 | 4 | 9 | nein | PASS |  |
| `/app/risk` | ProtectedRoute | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/risk-inventory` | AiActRiskInventoryView | AppGate | 12 |  | 0 | 1 | nein | PASS |  |
| `/app/risks` | RiskCenterView | AppGate | 16 |  | 0 | 1 | nein | PASS |  |
| `/app/scans` | GovernanceScansListView | AppGate | 3 | websites.insert×1 | 1 | 2 | nein | PASS |  |
| `/app/scans/:scanId` | GovernanceScanDetailView | AppGate | 4 | websites.insert×1 | 1 | 2 | nein | PASS |  |
| `/app/scheduler` | SchedulerView | AppGate | 5 |  | 0 | 1 | ja | PASS |  |
| `/app/security-signals` | SecuritySignalsView | AppGate | 12 | security_signals.update×1 | 0 | 1 | nein | PASS |  |
| `/app/seo-marketing-dashboard` | SEOMarketingDashboard | AppGate | 0 |  | 0 | 4 | nein | PASS |  |
| `/app/settings` | SettingsView | AppGate | 5 | profiles.update×1 | 0 | 0 | nein | PASS |  |
| `/app/settings/integrations/telegram` | TelegramIntegrationPage | AppGate | 2 |  | 0 | 2 | nein | PASS |  |
| `/app/settings/team` | TenantAdminConsole | AppGate+RequireAal2 | 4 |  | 0 | 1 | nein | PASS |  |
| `/app/siteos` | SiteOsDashboardView | AppGate | 5 |  | 1 | 15 | ja | PASS |  |
| `/app/siteos/builder` | LegacySiteOsBuilderRedirect | AppGate | 0 |  | 0 | 0 | nein | PASS |  |
| `/app/siteos/claim` | SiteOsClaimView | AppGate | 4 |  | 1 | 15 | ja | PASS |  |
| `/app/siteos/modernize` | FmtModernizeWizard | AppGate | 5 | fmt_projects.insert×1, fmt_projects.update×1, fmt_source_sites.upsert×1, fmt_governance_events.insert×1 | 0 | 0 | ja | PASS |  |
| `/app/siteos/modernize/:projectId` | FmtModernizeWizard | AppGate | 5 | fmt_projects.insert×1, fmt_projects.update×1, fmt_source_sites.upsert×1, fmt_governance_events.insert×1 | 0 | 0 | ja | PASS |  |
| `/app/team` | TenantAdminConsole | AppGate+RequireAal2 | 4 |  | 0 | 1 | nein | PASS |  |
| `/app/terminal` | GovernanceTerminalView | AppGate | 18 | terminal_sessions.insert×1, terminal_commands.insert×1, terminal_session_invitations.insert×1, terminal_activity_log.insert×5, terminal_session_members.update×1, terminal_approvals.insert×1, terminal_approvals.update×2 | 0 | 4 | nein | PASS |  |
| `/app/vendor-exposure` | VendorExposureView | AppGate | 1 |  | 0 | 1 | nein | PASS |  |
| `/app/vendors` | GovernanceVendorInventoryView | AppGate | 8 |  | 0 | 1 | nein | PASS |  |
| `/app/webhooks` | GovernanceWebhooksView | AppGate | 10 | webhook_endpoints.insert×1, webhook_endpoints.update×1, webhook_endpoints.delete×1, webhook_deliveries.update×1 | 0 | 0 | nein | PASS |  |
| `/app/websites` | WebsiteGovernanceView | AppGate | 17 | website_projects.insert×1, websites.insert×1 | 1 | 4 | nein | PASS |  |
| `/app/workflows` | WorkflowsView | AppGate | 16 | workflows.insert×1, workflows.update×2, workflows.delete×1 | 0 | 2 | ja | PASS |  |
| `/app` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/bauen` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/cockpit` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/ai-act-assessment` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/ai-register` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/api-keys` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/audit-reports` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/dsgvo-directory` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/evidence-vault-advanced` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/gaps` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/integrations` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/iso27001` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/iso42001` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/nis2-incidents` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/recommendation` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/remediation-plans` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/governance/start` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/home` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/home` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/intelligence` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/local-ai` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/mein-geschaeft` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/onboarding` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/overview` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/settings/billing` | redirect | – |  |  |  |  |  | N/A | Redirect |
| `/app/simple` | redirect | – |  |  |  |  |  | N/A | Redirect |

## Vorgeschlagene Fix-Slices

1. **Security: tenants-Spaltenschutz** — `tenants owner-update` auf unkritische Profilspalten begrenzen (Column-GRANT oder BEFORE-UPDATE-Guard), `trial_expires_at`/`partner_id`/Billing-Felder nur service_role. Separater Security-PR, Freigabe Dominik.
2. **API-Key-Erzeugung serverseitig** — Edge Function statt Browser-Insert (Welcome, ApiSetupWizard, ApiKeysSettings, /app/admin/api-keys).
3. **Governance-Module ohne Backend** — frameworks, iso-42001-hub, iso-control-library, compliance-roadmap/-calendar/-analytics, custom-frameworks, bulk-operations, audit-trail, team-collaboration: je Aktion Handler anbinden oder als nicht verfügbar gaten.
4. **Voice/Costs/Admin-Log/Monitoring-Dashboards** — Datenquelle verifizieren, Mock-Daten entfernen.
5. **/app/vvt** — TODO/Fake-Marker auflösen.

## Nicht abgedeckt

- Laufzeitverhalten (kein Browser-/E2E-Lauf), Edge-Function-Inhalte, Entitlement-Logik serverseitig.
- `/app/analytics` (Inline-Element) und `/build`, `/app/siteos/builder` (Redirect) nur oberflächlich.
- Einzelne Buttons sind nur gezählt, nicht einzeln gelistet; Einzel-Inventar je FAIL-Route folgt in den Fix-Slices.

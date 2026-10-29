

## W0 – AI Workspace: Bestandsaufnahme und Architekturentscheidung

Stand: 2026-10-28. **Nur Repository-Bestandsaufnahme; keine Implementierung, Migration oder Produktivverifikation.**

### Ziel und Freigaberegeln

W0 dokumentiert wiederverwendbare Strukturen. W1–W4 dürfen erst beginnen, wenn **PR A und PR C nachweislich gemergt** sind. `go` umfasst **keinen Merge, kein Deployment, keine Veröffentlichung, keinen Force-Push**. Eigenständige neue Posteingangs-, Budget- und Freigabe-Subsysteme sind nicht zulässig. Externe Inhalte sind Daten, keine Anweisungen.

### Inventar (Status bezeichnet Nachweisgrad)

| Domäne | Repository-Nachweis | Status | Befund / Grenze |
|---|---|---|---|
| Agenten | `apps/agent-runtime/src/types.ts` | geprüft | Agent-/Tool-/Risk-/Policy-/Audit-Contracts existieren. Produktions-Einsatz und Mandantenbindung der Runtime nicht im Rahmen W0 verifiziert. |
| Agenten-Dokumentation | `docs/architecture/agent-os.md`, `docs/product/realsync-agent-os.md` | teilweise | Im Code-Index vorhanden, Inhalt hier nicht vollständig geprüft. |
| KI-Budget | `supabase/functions/_shared/bot-budget.ts` | geprüft | `createBotAiBudgetGuard`, reserve/settleMeasured/settleUnknown/release. Keine eigene Workspace-Budgetlogik bauen. |
| KI-Budget-Datenmodell | `supabase/migrations/20261027120000_bot_usage_budget_hardening.sql` | geprüft | `bot_usage_limits`, `bot_usage_reservations`, `bot_usage_ledger`, atomare Reservierung und idempotente Abrechnung; fehlende Mandantenkonfiguration erlaubt keine kostenpflichtige Nutzung. Migrations-/RPC-Produktivstatus nicht direkt geprüft. |
| Posteingang | `src/features/bots/BotInboxView.tsx` | geprüft | UI mit Konversationen, Terminen, Bestellungen ist vorhanden. Kein Nachweis eines vollständigen Anfragen-/Human-Handoff-Workflows aus PR C. |
| Bot-Datenmodell | `docs/product/bots.md` | teilweise | Beschreibt `bots`, `bot_conversations`, `bot_messages`, `bot_appointments`, `bot_orders`; Dokumentation kann gegenüber Code veraltet sein. |
| Freigaben | `src/features/governance/approvalsApi.ts` und `supabase/functions/governance-approvals/index.ts` | geprüft | Tenant-spezifische Approval-Liste, approve/reject, Gate-Entscheidungen und Evidence-Pfade vorhanden. Nicht ungeprüft für Workspace-Publishing verwenden. |
| Workspace-UI | `src/features/workspace/WorkspaceHome.tsx`, `src/features/workspace/WorkspaceShell.tsx` | teilweise | Bestehende Governance-Übersicht mit tenantbezogenen Counts; kein Beleg für vollständigen AI-Task-Workspace. |
| Aufgaben/Jobs | `platform/builder_orchestrator/app/services/task_graph.py`, `supabase/migrations/20260926230000_browser_task_planner_tool.sql` | nicht verifiziert | Fundstellen im Index, Lifecycle, Persistenz, Idempotenz und Runtime-Trennung vor W2 prüfen. |
| Wissensquellen | `src/core/runtime/memory.ts`, `supabase/migrations/20260527000000_hermes_agent.sql` | nicht verifiziert | Keine belastbare Festlegung für verbindliche Quellen, Herkunft/Version/Status/RLS; vor W1 prüfen. |
| Landingpage-Skill | bestehende SiteOS-Module, u. a. `src/features/siteos/workspace/AppBuilderWorkspacePage.tsx` | teilweise | UI-Fundstelle; Skill-Registry, Tool-Allowlist, Preview/Publish-Gate noch nachzuweisen. |
| Tagesübersicht | `src/features/workspace/WorkspaceHome.tsx` | teilweise | Governance-Kennzahlen existieren, manuell startbare KI-Zusammenfassung als Skill nicht nachgewiesen. |

### Architekturrichtung – verbindlich für weitere Prüfung, kein Implementierungsbeschluss

1. **Agenten:** vorhandene `apps/agent-runtime`-Policy-/Tool-Schnittstellen als Kandidat weiterverwenden; vor Verwendung tenantbezogene Authentisierung, Laufzeitisolation, erlaubte Werkzeuge und Audit belegen.
2. **Wissen:** zunächst Tabellen und RLS bestehender Memory-/Knowledge-Strukturen inventarisieren. Eine verbindliche Quelle muss Herkunft, Version, Arbeitsbereich und Status (Entwurf, extrahiert, bestätigt) nachvollziehbar tragen; Änderungen bestätigter Angaben ausschließlich als Vorschläge.
3. **Jobs:** bestehende Task-/Browser-/Scheduler-Strukturen auf dauerhafte Task-Zustände, idempotente Schritte und revisionsfähige Aktionshistorie untersuchen. Kundenruntime darf nicht über Claude Code, Codex oder Shell-Executor laufen.
4. **Budget:** ausschließlich atomare Budget-RPCs aus PR A als Basis. Reservierung vor kostenpflichtigem Tool-Aufruf, unbekannter Verbrauch als intern geschätzter Höchstbetrag, Korrekturen append-only ohne Doppelzählung. Keine Claude-/Codex-Abokontingente ohne belastbare Quelle anzeigen.
5. **Freigaben:** vorhandene Governance-Approval-Gates als Kandidat, aber vor Anbindung an Veröffentlichung semantische Passung und Berechtigungen prüfen. Produktions-Publishing nur mit expliziter Einzelfreigabe.
6. **Posteingang:** kein zweites Inbox-Modell. Erst PR C und dessen kanonischen Übergabeprozess verifizieren, dann W3-Formulare dort anschließen.

### Abhängigkeiten / nachzuprüfende Gates

- PR A: [#2044](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2044) und ergänzend [#2049](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2049) laut GitHub am 28.10.2026 **gemergt**; keine separate Live-Verifikation.
- PR C: konkrete PR-Nummer, Merge-Status, kanonisches Anfrage-Datenmodell und Human-Handoff-Abnahmetests **noch nicht verifiziert**. W1–W4 bleiben blockiert.
- [#2053](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2053) ist zum Prüfzeitpunkt **geschlossen und nicht gemergt**. Kein Eingriff durch W0.
- W1: Tenant-RLS, fremdtenantbezogene Zugriffsversuche und Quelle-zu-Quelle-Prompt-Injection testen.
- W2: atomare parallele Budgetreservierung, Wiederholungs-/Timeout-Verhalten und idempotente Aufgabenschritte testen.
- W3: Tool-Allowlist, untrusted input, Draft-Vorschau ohne Produktions-Publish, Inbox-Integration und Freigabegrenze testen.
- W4: manueller Start, deterministische Quellreferenzen und keine Scheduler-Aktivierung.

### Prüfstatus und Abschluss

- **Geprüft:** die im Inventar explizit als geprüft markierten Repository-Dateien und PR-Metadaten.
- **Teilweise/nicht verifiziert:** entsprechend Inventar, insbesondere PR C, RLS und Live-Produktionsstatus.
- **Implementiert:** nur dieses Dokument (kein Runtime-Code).
- **Getestet:** keine Unit-/E2E-Tests ausgeführt; W0 ist dokumentarisch.
- **Gemergt / produktiv verifiziert:** W0 nein / nein.
- **Nächster Schritt:** PR C identifizieren, bestehende Data Contracts und RLS im Detail prüfen, Architekturentscheidung ergänzen; anschließend erst mit eigenständiger Freigabe W1 beginnen.

---

### Ergänzung 2026-10-29 – vertiefte Bestandsaufnahme (nur Repository, `origin/main` @ `edf74c9`)

Methode: `grep` über `supabase/migrations/*.sql` (402 Dateien), `supabase/functions/**`, `src/**`, `apps/**`; GitHub-PR-Metadaten via `gh`. Kein Zugriff auf die Live-Datenbank – alle DB-Befunde gelten nur für den Migrationsstand im Repository.

#### Budget / Kosten – bestehende Mechanismen

| Struktur | Datei | Aufrufer im Code | Status | Bewertung |
|---|---|---|---|---|
| `cost_check_and_reserve` (RPC, nur `service_role`) | `supabase/migrations/20260604000000_economic_intelligence.sql` (Z. 162, 308–311) | `supabase/functions/_shared/cost-cap.ts` (`reserveLlmBudget`/`settleLlmBudget`) → `_shared/ai.ts` `runAiTool` (Z. 202, 344) | geprüft | **Kanonischer Mandanten-Kostendeckel für KI-Tools.** Fail-closed seit #2051; Altledger-Härtung in #2054 (offen). |
| `bot_usage_limits/_reservations/_ledger`, `bot_ai_budget_reserve`, `bot_usage_*` | `supabase/migrations/20261027120000_bot_usage_budget_hardening.sql` | `_shared/bot-budget.ts` `createBotAiBudgetGuard` → `bot-chat`, `whatsapp-webhook`, `bot-voice-webhook` | geprüft | Kanalbudget der Bots (PR A). Ledger append-only (`bot_usage_ledger_block_mutation`). |
| `browser_executions`, `reserve_browser_execution` | `supabase/migrations/20260930190000_browser_execution_reservations.sql` | Browser-Executor | teilweise | Ausführungs-Kontingent, kein Geldbudget. |
| `mcp_quota_counters`, `mcp_quota_state` | `supabase/migrations/20260903120100_mcp_quota.sql` | MCP-API | teilweise | Request-Quota, kein Geldbudget. |
| `usage_events/usage_totals/usage_limits_config` | `supabase/migrations/20260430220000_usage_tracking.sql` | `usage-increment`, `src/core/access/usage.ts` | teilweise | Plan-/Entitlement-Zähler. |
| `agent_configuration`, `agent_token_usage`, `check_budget`, `record_token_usage` | `supabase/migrations/20260706011047_agent_token_budget.sql` | **keine Aufrufer** in `src/`, `supabase/functions/`, `apps/` | geprüft | **Altbestand, nicht verwenden.** Wäre eine zweite Budgetlogik. |
| `token_usage` | `supabase/migrations/20260515700000_token_tracking.sql` | nicht verifiziert | nicht verifiziert | Nur Telemetrie, kein Deckel. |

**Entscheidung Budget (keine zweite Budgetlogik):** Workspace-Skills (W2–W4) rufen KI ausschließlich über `runAiTool` → `cost_check_and_reserve` auf. Bot-Kanäle bleiben bei `bot-budget.ts`. Es wird **keine** neue Budget-Tabelle, kein neuer Reserve-RPC und kein Rückgriff auf `agent_token_budget` angelegt. Offene Frage für W2: ob Bot- und Mandantendeckel zu einer gemeinsamen Euro-Sicht zusammengeführt werden – nur lesend, nicht als dritte Logik. Status: geplant.

#### Anfragen / Posteingang – bestehende Mechanismen

| Struktur | Datei | Status | Bewertung |
|---|---|---|---|
| `bot_conversations`, `bot_messages`, `appointments`, `orders` | `supabase/migrations/20260628193744_bots_foundation.sql`; `src/features/bots/api.ts`, `src/features/bots/BotInboxView.tsx`, `_shared/bots.ts` | geprüft | Mandanten-Posteingang der Bots – Basis für PR C. |
| `sales_leads`, `capture_funnel_lead`, `admin_funnel_leads` | `supabase/migrations/20260505100000_sales_leads.sql`, `20261015120000_funnel_lead_capture.sql`; `src/features/admin/LeadsView.tsx`, `FunnelLeadsPanel.tsx` | geprüft | **Interner** Vertriebs-Posteingang (Plattformbetreiber), kein Mandanten-Inbox. Nicht für Workspace-Anfragen verwenden. |
| `hermes_agent_handoffs` | `supabase/migrations/20260527000000_hermes_agent.sql` | nicht verifiziert | Agent-zu-Agent-Handoff, kein Mensch-Handoff. |

**Entscheidung Posteingang (kein zweiter Anfragen-Posteingang):** W3-Formulare/Anfragen landen ausschließlich im Bot-Posteingang (`bot_conversations` + PR-C-Erweiterung). Kein neues `workspace_requests`/`inbox`-Modell. Status: geplant, blockiert durch PR C.

#### Agenten, Jobs/Tasks, Wissen, Freigaben – weitere Fundstellen

| Domäne | Struktur / Datei | Status | Bewertung |
|---|---|---|---|
| Agenten | `agent_tasks`, `agent_memory`, `agent_events`, `agent_decisions` … – `supabase/migrations/20260526000000_agent_os_substrate.sql` | teilweise | Agent-OS-Substrat mit RLS; Mandantenbindung der Policies nicht einzeln geprüft. |
| Agenten | `autonomous_agents`, `autonomous_agent_runs/_tasks/_events` – `20260705180000_autonomous_agents_core.sql` | teilweise | Paralleles Agentenmodell → Konsolidierungsrisiko; für W1 nur eines wählen. |
| Agenten | `bot_agents` – `20260628193744_bots_foundation.sql` | geprüft | Mandanten-Assistenten der Bots. Kandidat für Workspace-Agenten. |
| Agenten | Edge Functions `agent-os-runner`, `agent-scheduler`, `enterprise-ai-os-agents-*`, `governance-agent` | nicht verifiziert | Produktionsstatus siehe `src/config/production-edge-functions.ts`. |
| Jobs | `audit_jobs` + `audit_jobs_claim_next/complete` – `20260507110000_audit_jobs_queue.sql` | geprüft | Einziges belegtes Claim-/Queue-Muster; Vorlage für W2-Tasks. |
| Wissen | `agent_knowledge_base` – `20260624000000_agent_operations_layer_schema.sql`; `hermes_knowledge_items`; `governance_memory` + `memory_retention_policies` – `20260803000000_rfc003_memory_governance.sql` | teilweise | Drei Wissensmodelle; `governance_memory` hat Retention-Logik. Herkunft/Version/Status-Felder nicht verifiziert. |
| Freigaben | `governance_approvals` – `20260513200000_governance_approvals.sql`; `pdp_approval_gates`, `role_bindings`, `principals` – `20260824120000_org_subject_model_approval_gates.sql` | geprüft | Kanonische Freigabe-Gates; Workspace-Publishing hier anschließen, kein neues Freigabemodell. |
| Sicherheit | RLS aktiviert in allen o. g. Migrationen (`ENABLE ROW LEVEL SECURITY`); Reserve-RPCs nur `service_role` | teilweise | Policy-Inhalte (tenant-Bedingung) nicht pro Tabelle geprüft → W1-Pflichttest. |
| Neu erforderlich | Herkunft/Version/Status für verbindliche Wissensquellen; Workspace-Task-Zustandsmodell auf Basis `audit_jobs`-Muster | neu erforderlich | Erst nach PR C und eigener Freigabe (W1/W2). |

#### PR-A/PR-C-Abhängigkeiten (Quelle: `docs/PRODUCT_PRIORITIZATION.md`, Abschnitt „Reihenfolge der Umsetzung“)

- **PR A** = „Sicherheit/Kosten der Bot-Kanäle“ → #2044 gemergt 2026-10-28 16:09 MEZ (`721aa89`), Folge-PR #2049 gemergt 16:30 MEZ (`d08abd6`). Ergänzung A2 #2054 (Altledger fail-closed) **offen**. Status: gemergt (#2044/#2049), nicht produktiv verifiziert.
- **PR C** = „Anfragen-Posteingang mit Übergabe an Menschen“ → **kein PR auf GitHub gefunden** (Suche nach „PR C“, „Posteingang“, „Übergabe“, „handoff“). Annahme: noch nicht angelegt. Status: geplant. W3 (Formulare/Anfragen) hängt hart daran; W1–W4 bleiben gesperrt.

## Dashboard-Aktions-Inventar (#1381) — W0, nur Dokumentation

Stand: 29.10.2026, gegen `main` (Shallow-Clone). Keine Runtime-, Migrations- oder Stripe-Änderungen.

### Methode

- Quelle: alle `<Route path="/app…">` in `src/App.tsx`; Komponente aufgelöst, lokale Imports (features/pages/api/service) bis Tiefe 2 statisch gescannt.
- Gezählt: `onClick`/`onSubmit`, `supabase.from(x).insert|update|upsert|delete`, `.rpc(`, `functions.invoke`/`fetch(`, `alert(`, TODO/Simulations-Marker, `href="#"`.
- **FAIL**, wenn: `alert()`, Fake/TODO-Marker, tote Links, Browser-Write auf geschützte Tabelle (subscriptions, tenants, entitlements, memberships, api_keys, invoices) oder Aktionen ohne erkennbaren Backend-Aufruf.
- **Heuristik**: Ergebnis ist ein Prüfauftrag, kein Beweis. Aktionen, die rein UI-seitig sind (Filter, Tabs), erzeugen falsche FAILs; Backend-Aufrufe über tiefere Hooks können fehlen. Persistenz, RLS und Entitlement je FAIL manuell verifizieren.

### Zusammenfassung

- Routen gescannt: 157 (davon Redirects: 27, nicht aufgelöst: 1)
- UI-Aktionen (onClick/onSubmit) gezählt: 660
- PASS: 104 · FAIL: 24 · GESPERRT (ehrlich nicht verfügbar): 1
- Korrektur 29.10.2026: 4 Fehlalarme des Scans manuell geprüft und umklassifiziert (frameworks, iso-42001-hub, ai-systems/agents → PASS; bulk-operations → GESPERRT), siehe #2059.

### Browser-Writes auf geschützte Tabellen (Bezug #2019/#2056)

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

### Routen-Tabelle

| Route | Komponente | Gates | Aktionen | Writes | RPC | Invoke/Fetch | Entitlement-Check | Status | Hinweis |
|---|---|---|---|---|---|---|---|---|---|
| `/app/activation` | GovernanceActivationView | AppGate | 9 | governance_activations.upsert×1, tenants.update×1 | 0 | 0 | nein | FAIL | Browser-Write geschützt: tenants.update |
| `/app/admin-log` | GovernanceAdminLogView | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/admin/api-keys` | AdminAPIKeysPage | AppGate | 2 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/agents/automation` | AutomationAgentPage | AppGate | 4 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/ai-systems/agents` | AgentRegistryView | AppGate | 3 |  | 0 | 0 | nein | PASS | korrigiert (#2059): nur Filter-Buttons, kein Backend nötig |
| `/app/api/docs` | ApiDocumentation | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/api/email-templates` | EmailTemplateManager | AppGate | 5 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/api/monitoring-advanced` | AdvancedMonitoringDashboard | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/api/setup` | ApiSetupWizard | AppGate | 9 | api_keys.insert×1 | 0 | 0 | nein | FAIL | Browser-Write geschützt: api_keys.insert |
| `/app/beispiel` | SampleWorkspacePage | AppGate | 14 | websites.insert×1, governance_activations.upsert×1, tenants.update×1 | 4 | 2 | ja | FAIL | Browser-Write geschützt: tenants.update |
| `/app/company` | CompanyView | AppGate | 4 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/costs` | GovernanceCostTrackingView | AppGate | 1 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/dashboard` | DashboardRouter | AppGate | 14 | websites.insert×1, governance_activations.upsert×1, tenants.update×1 | 4 | 2 | ja | FAIL | Browser-Write geschützt: tenants.update |
| `/app/governance/audit-trail` | AuditTrailView | AppGate | 2 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/bulk-operations` | BulkOperationsView | AppGate | 1 |  | 0 | 0 | nein | GESPERRT | korrigiert (#2059): ehrlich als „Noch nicht verfügbar“ markiert, Link auf /app/bulk |
| `/app/governance/compliance-analytics` | ComplianceAnalyticsView | AppGate | 2 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/compliance-calendar` | ComplianceCalendarView | AppGate | 6 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/compliance-roadmap` | ComplianceRoadmapView | AppGate | 5 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/custom-frameworks` | CustomFrameworkView | AppGate | 8 |  | 0 | 0 | nein | FAIL | Aktionen ohne Backend-Aufruf |
| `/app/governance/frameworks` | ComplianceFrameworkSelector | AppGate | 1 |  | 0 | 0 | ja | PASS | korrigiert (#2059): Navigation mit Entitlement-Check |
| `/app/governance/iso-42001-hub` | Iso42001ComplianceHub | AppGate | 2 |  | 0 | 0 | nein | PASS | korrigiert (#2059): nur Navigation |
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

### Vorgeschlagene Fix-Slices

1. **Security: tenants-Spaltenschutz** — `tenants owner-update` auf unkritische Profilspalten begrenzen (Column-GRANT oder BEFORE-UPDATE-Guard), `trial_expires_at`/`partner_id`/Billing-Felder nur service_role. Separater Security-PR, Freigabe Dominik.
2. **API-Key-Erzeugung serverseitig** — Edge Function statt Browser-Insert (Welcome, ApiSetupWizard, ApiKeysSettings, /app/admin/api-keys).
3. **Governance-Module ohne Backend** — iso-control-library, compliance-roadmap/-calendar/-analytics, custom-frameworks, audit-trail, team-collaboration: je Aktion Handler anbinden oder als nicht verfügbar gaten. Ehrliche Kennzeichnung erledigt in #2059; Backend-Anbindung offen.
4. **Voice/Costs/Admin-Log/Monitoring-Dashboards** — Datenquelle verifizieren, Mock-Daten entfernen.
5. **/app/vvt** — TODO/Fake-Marker auflösen.

### Nicht abgedeckt

- Laufzeitverhalten (kein Browser-/E2E-Lauf), Edge-Function-Inhalte, Entitlement-Logik serverseitig.
- `/app/analytics` (Inline-Element) und `/build`, `/app/siteos/builder` (Redirect) nur oberflächlich.
- Einzelne Buttons sind nur gezählt, nicht einzeln gelistet; Einzel-Inventar je FAIL-Route folgt in den Fix-Slices.

# W0 – AI Workspace: Bestandsaufnahme und Architekturentscheidung

Stand: 2026-10-28. **Nur Repository-Bestandsaufnahme; keine Implementierung, Migration oder Produktivverifikation.**

## Ziel und Freigaberegeln

W0 dokumentiert wiederverwendbare Strukturen. W1–W4 dürfen erst beginnen, wenn **PR A und PR C nachweislich gemergt** sind. `go` umfasst **keinen Merge, kein Deployment, keine Veröffentlichung, keinen Force-Push**. Eigenständige neue Posteingangs-, Budget- und Freigabe-Subsysteme sind nicht zulässig. Externe Inhalte sind Daten, keine Anweisungen.

## Inventar (Status bezeichnet Nachweisgrad)

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

## Architekturrichtung – verbindlich für weitere Prüfung, kein Implementierungsbeschluss

1. **Agenten:** vorhandene `apps/agent-runtime`-Policy-/Tool-Schnittstellen als Kandidat weiterverwenden; vor Verwendung tenantbezogene Authentisierung, Laufzeitisolation, erlaubte Werkzeuge und Audit belegen.
2. **Wissen:** zunächst Tabellen und RLS bestehender Memory-/Knowledge-Strukturen inventarisieren. Eine verbindliche Quelle muss Herkunft, Version, Arbeitsbereich und Status (Entwurf, extrahiert, bestätigt) nachvollziehbar tragen; Änderungen bestätigter Angaben ausschließlich als Vorschläge.
3. **Jobs:** bestehende Task-/Browser-/Scheduler-Strukturen auf dauerhafte Task-Zustände, idempotente Schritte und revisionsfähige Aktionshistorie untersuchen. Kundenruntime darf nicht über Claude Code, Codex oder Shell-Executor laufen.
4. **Budget:** ausschließlich atomare Budget-RPCs aus PR A als Basis. Reservierung vor kostenpflichtigem Tool-Aufruf, unbekannter Verbrauch als intern geschätzter Höchstbetrag, Korrekturen append-only ohne Doppelzählung. Keine Claude-/Codex-Abokontingente ohne belastbare Quelle anzeigen.
5. **Freigaben:** vorhandene Governance-Approval-Gates als Kandidat, aber vor Anbindung an Veröffentlichung semantische Passung und Berechtigungen prüfen. Produktions-Publishing nur mit expliziter Einzelfreigabe.
6. **Posteingang:** kein zweites Inbox-Modell. Erst PR C und dessen kanonischen Übergabeprozess verifizieren, dann W3-Formulare dort anschließen.

## Abhängigkeiten / nachzuprüfende Gates

- PR A: [#2044](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2044) und ergänzend [#2049](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2049) laut GitHub am 28.10.2026 **gemergt**; keine separate Live-Verifikation.
- PR C: konkrete PR-Nummer, Merge-Status, kanonisches Anfrage-Datenmodell und Human-Handoff-Abnahmetests **noch nicht verifiziert**. W1–W4 bleiben blockiert.
- [#2053](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2053) ist zum Prüfzeitpunkt **geschlossen und nicht gemergt**. Kein Eingriff durch W0.
- W1: Tenant-RLS, fremdtenantbezogene Zugriffsversuche und Quelle-zu-Quelle-Prompt-Injection testen.
- W2: atomare parallele Budgetreservierung, Wiederholungs-/Timeout-Verhalten und idempotente Aufgabenschritte testen.
- W3: Tool-Allowlist, untrusted input, Draft-Vorschau ohne Produktions-Publish, Inbox-Integration und Freigabegrenze testen.
- W4: manueller Start, deterministische Quellreferenzen und keine Scheduler-Aktivierung.

## Prüfstatus und Abschluss

- **Geprüft:** die im Inventar explizit als geprüft markierten Repository-Dateien und PR-Metadaten.
- **Teilweise/nicht verifiziert:** entsprechend Inventar, insbesondere PR C, RLS und Live-Produktionsstatus.
- **Implementiert:** nur dieses Dokument (kein Runtime-Code).
- **Getestet:** keine Unit-/E2E-Tests ausgeführt; W0 ist dokumentarisch.
- **Gemergt / produktiv verifiziert:** W0 nein / nein.
- **Nächster Schritt:** PR C identifizieren, bestehende Data Contracts und RLS im Detail prüfen, Architekturentscheidung ergänzen; anschließend erst mit eigenständiger Freigabe W1 beginnen.

---

## Ergänzung 2026-10-29 – vertiefte Bestandsaufnahme (nur Repository, `origin/main` @ `edf74c9`)

Methode: `grep` über `supabase/migrations/*.sql` (402 Dateien), `supabase/functions/**`, `src/**`, `apps/**`; GitHub-PR-Metadaten via `gh`. Kein Zugriff auf die Live-Datenbank – alle DB-Befunde gelten nur für den Migrationsstand im Repository.

### Budget / Kosten – bestehende Mechanismen

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

### Anfragen / Posteingang – bestehende Mechanismen

| Struktur | Datei | Status | Bewertung |
|---|---|---|---|
| `bot_conversations`, `bot_messages`, `appointments`, `orders` | `supabase/migrations/20260628193744_bots_foundation.sql`; `src/features/bots/api.ts`, `src/features/bots/BotInboxView.tsx`, `_shared/bots.ts` | geprüft | Mandanten-Posteingang der Bots – Basis für PR C. |
| `sales_leads`, `capture_funnel_lead`, `admin_funnel_leads` | `supabase/migrations/20260505100000_sales_leads.sql`, `20261015120000_funnel_lead_capture.sql`; `src/features/admin/LeadsView.tsx`, `FunnelLeadsPanel.tsx` | geprüft | **Interner** Vertriebs-Posteingang (Plattformbetreiber), kein Mandanten-Inbox. Nicht für Workspace-Anfragen verwenden. |
| `hermes_agent_handoffs` | `supabase/migrations/20260527000000_hermes_agent.sql` | nicht verifiziert | Agent-zu-Agent-Handoff, kein Mensch-Handoff. |

**Entscheidung Posteingang (kein zweiter Anfragen-Posteingang):** W3-Formulare/Anfragen landen ausschließlich im Bot-Posteingang (`bot_conversations` + PR-C-Erweiterung). Kein neues `workspace_requests`/`inbox`-Modell. Status: geplant, blockiert durch PR C.

### Agenten, Jobs/Tasks, Wissen, Freigaben – weitere Fundstellen

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

### PR-A/PR-C-Abhängigkeiten (Quelle: `docs/PRODUCT_PRIORITIZATION.md`, Abschnitt „Reihenfolge der Umsetzung“)

- **PR A** = „Sicherheit/Kosten der Bot-Kanäle“ → #2044 gemergt 2026-10-28 16:09 MEZ (`721aa89`), Folge-PR #2049 gemergt 16:30 MEZ (`d08abd6`). Ergänzung A2 #2054 (Altledger fail-closed) **offen**. Status: gemergt (#2044/#2049), nicht produktiv verifiziert.
- **PR C** = „Anfragen-Posteingang mit Übergabe an Menschen“ → **kein PR auf GitHub gefunden** (Suche nach „PR C“, „Posteingang“, „Übergabe“, „handoff“). Annahme: noch nicht angelegt. Status: geplant. W3 (Formulare/Anfragen) hängt hart daran; W1–W4 bleiben gesperrt.

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

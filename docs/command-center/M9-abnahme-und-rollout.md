# Agent Command Center — M9 Abnahme & Rollout-Vorbereitung

Stand: 30.10.2026, 23:30 MEZ. Gilt für `main` @ `adc96e4` (M0–M8 live in Supabase `RealSyncDynamicsLive`).
Status-Modell: BACKLOG / READY / IN_PROGRESS / BLOCKED / IN_REVIEW / ACCEPTED / RELEASED.
Regel: **Empfehlung ≠ Freigabe.** Kein Produktions-Rollout ohne separate, ausdrückliche Freigabe.

## 1. Abnahmekriterien (messbar)

| # | Kriterium | Messung | Ergebnis |
|---|---|---|---|
| K1 | 0 unautorisierte kritische Aktionen | `test/runtime/db/command-center-acceptance.db.test.ts` – Matrix 3 Akteure (anon, Editor, fremder Owner) × 9 kritische Aktionen = 27 Versuche + Owner ohne Bestätigung | **erfüllt lokal** (0/28 Durchbrüche); live nicht schreibend geprüft |
| K2 | 0 zirkuläre Delegationsschleifen | gleiche Datei – 4 Zyklus-Szenarien + rekursive Schleifensuche | **erfüllt lokal** (0 angelegt, 0 gefunden) |
| K3 | 100 % freigabepflichtige Entscheidungen mit Audit | gleiche Datei – approve/approve/reject/defer → 4/4 mit `agent_decision_approvals`; 0 `approved` ohne Audit | **erfüllt lokal** |
| K4 | Fragen haben eindeutige IDs, Entscheidungen zuordenbar | gleiche Datei + Archiv-View | **erfüllt lokal** |
| K5 | Agentenregister vollständig, nicht belegte Status = UNBEKANNT | `test/command-center/CommandCenterView.test.tsx` | **erfüllt (Komponente)**; Grok-Live-Status **UNBEKANNT** |
| K6 | Keine bekannten kritischen Sicherheitslücken | `cron_execution_logs`-Lücke mit #2102 geschlossen (live verifiziert) | **offen** – siehe Blocker B2/B3 (Cron-Secrets fehlen, 401 bei zwei Cron-Zielen) |
| K7 | Eingeloggter E2E-Durchlauf (Desktop + mobil 375 px) | `e2e/command-center-loggedin.spec.ts` | **UNBEKANNT** – benötigt `E2E_CC_STORAGE_STATE` (Testnutzer + Tenant); ohne läuft die Suite als *skipped* |
| K8 | Routinen nachweisbar | `agent_routine_status_v` | **offen** – kein Scheduler ruft `record_routine_run` |
| K9 | Plattform-Health sichtbar | `cc_platform_health()` | **offen** – `cron_execution_logs` leer (Ursache B2) |
| K10 | DB-Tests in CI | Job „Migration validation“ | **offen** – Job wird auf PRs übersprungen; DB-Tests nur lokal belegt |

## 2. Testplan / Checkliste

Automatisiert (lokal ausgeführt):
- [x] Unit/Komponente Command Center (`test/command-center/*`)
- [x] DB-Rollen-/RLS-Tests M1–M9 (`test/runtime/db/agent-*.db.test.ts`, `memory-archive-routines`, `command-center-monitoring`, `command-center-acceptance`) gegen lokales Postgres 17 mit CI-Bootstrap
- [x] E2E ohne Session: Route, AuthGate, mobil 375 px (`e2e/command-center.spec.ts`)
- [ ] E2E eingeloggt (`e2e/command-center-loggedin.spec.ts`) – benötigt Testnutzer

Manuell (durch Dominik, eingeloggt, Desktop + Smartphone):
- [ ] Agentenübersicht lädt, Filter/Suche funktionieren, mobile Navigation öffnet
- [ ] Decision Inbox: Vorschlag sichtbar, „Empfehlung ≠ Freigabe“ sichtbar, Buttons ohne Häkchen gesperrt
- [ ] Eine reversible L1/L2-Testentscheidung freigeben → Eintrag in „Kosten & Monitoring → Audit“
- [ ] Details/Bibliothek/Computer: Entwurf anlegen, ohne Häkchen nicht aktivierbar
- [ ] Aufgaben-Kanban: Verschieben nach ERLEDIGT ohne Nachweis gesperrt
- [ ] Gedächtnis-Suche liefert nur eigene Mandantendaten
- [ ] Kosten & Monitoring: fehlende Quellen als UNBEKANNT, keine erfundenen Zahlen

## 3. Rollout-Runbook (nur Vorbereitung — nicht ausführen ohne Freigabe)

Hinweis: Datenbank-Objekte M1–M8 sind bereits live; die UI ist mit den Merges auf `main` gebaut. „Rollout“ meint hier die **Freischaltung für Nutzer** (Navigation/Ankündigung) und den Betrieb.

1. **Vorbedingungen (Go-Kriterien)**
   - B1 Environment-Gate in `.github/workflows/deploy.yml` (`environment: supabase-production` für `db-push`) aktiv, Secrets ins Environment verschoben.
   - B2 Cron-Keys gesetzt (Edge-Function-Secrets `CRON_SCHEDULER_DISPATCH_KEY`, `CRON_GOVERNANCE_MONITORING_KEY`, `CRON_MEMORY_DECAY_KEY` passend zu den Vault-Einträgen der `dispatch_cron_function`-Jobs) und erste Zeilen in `cron_execution_logs`.
   - B3 401-Ziele (`automation-trigger-trial-webhook`, `governance-score-calculator`) geklärt.
   - K7 eingeloggter E2E einmal grün (Desktop + 375 px).
   - Manuelle Checkliste (Abschnitt 2) abgehakt.
2. **Durchführung** (nach Freigabe): Freischaltung/Ankündigung; keine weiteren Migrationen nötig.
3. **Beobachtung 24 h**: `cc_critical_events_v`, `cc_platform_health()`, Deploy-/Cron-Antworten (`net._http_response`), Fehlerrate Edge Functions.
4. **Rollback**: UI-Zugang wieder ausblenden (Route bleibt auth-gated). Datenbank-Objekte sind additiv; kein Rückbau nötig. Kein Datenverlust-Pfad.

**No-Go**, wenn eines zutrifft: B1–B3 offen; K1–K4 in CI oder live rot; neue kritische Sicherheitsbefunde; `cron_execution_logs` weiterhin leer.

## 4. Offene Blocker (verhindern ACCEPTED/RELEASED „Produktion“)

| ID | Blocker | Befund | Zuständig |
|---|---|---|---|
| B1 | Kein Environment-Gate für `db push` | Jeder Merge mit Migrationen geht automatisch live | Dominik (Token ohne `workflow`-Scope) |
| B2 | `cron_execution_logs` leer | pg_cron-Jobs laufen (`succeeded`), aber die Functions antworten 500 `CRON_KEY_MISSING` (scheduler-dispatch 24×, governance-monitoring-scheduler 6×, memory-decay-worker 6× in 24 h) | Dominik (Secrets) |
| B3 | 401 bei Cron-Zielen | `automation-trigger-trial-webhook` 24×, `governance-score-calculator` 6× `UNAUTHORIZED_INVALID_JWT_FORMAT` (24 h) | Dominik/Team |
| B4 | Kein Scheduler schreibt `record_routine_run` | Routinen-Ansicht leer | Folge-PR |
| B5 | Historien-Vorfall `20261029121131` | Eintrag zwischen 09:09 und 13:48 MEZ (30.10.) extern entfernt, beim M5-Merge erneut idempotent angewendet; Ursache UNBEKANNT | Dominik (Audit-Log Supabase) |
| B6 | Eingeloggter E2E | Kein Testnutzer/Session im Repo/CI | Dominik |
| B7 | DB-Tests in CI übersprungen | „Migration validation“ läuft auf PRs nicht | Team |
| B8 | Agenten nutzen M6-Schutz noch nicht | kein `claim_agent_task`/`correlation_id` in Agent-Code | Folge-PR |
| B9 | Grok-Live-Status | keine Datenquelle | UNBEKANNT |
| B10 | Lokale DB-Tests fremder Bereiche | `entitlement-grants` u. a. scheitern lokal (lokaler DB-Stand), nicht M0–M9 | Team |

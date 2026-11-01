# KI-Arbeitsplatz – W0.1 Bestandsabgleich

Stand: 01.11.2026 · Status: **Dokumentation, kein Implementierungsbeschluss**
Ergänzt den W0-Abschnitt in [`docs/ARCHITECTURE_CURRENT.md`](../ARCHITECTURE_CURRENT.md) (#2055). Ersetzt ihn nicht.
Folgeauftrag: [`ki-arbeitsplatz-auftrag-v2.md`](./ki-arbeitsplatz-auftrag-v2.md)

Prüfpfad:
- Repository: `main` @ `9ca40f3` (Erstabgleich), Nachprüfung `main` @ `dbbd8a4`, jeweils shallow clone, nur gelesen.
- Datenbank: Supabase `ebljyceifhnlzhjfyxup`, nur `SELECT` (Zeilenzahlen, RLS, Policies, Spalten), 01.11.2026 ca. 04:30 UTC.
- Keine Migration, kein Deployment, kein Secret, keine Tests ausgeführt.

> **Korrektur gegenüber der Erstfassung:** Empfehlung E2 lautete `bot_agents`. Der laufende Empfangsassistent nutzt jedoch `bots` (Schema A). Siehe Abschnitt 11, Befund N2. E2 lautet jetzt **`bots`**.

---

## 1. Kernaussage

**Der KI-Arbeitsplatz muss nicht neu gebaut werden. Das Grundgerüst existiert als „Agent Command Center“ (M0–M9).**

`/app/command-center` (`src/App.tsx`, auth-gated) enthält bereits:

| Arbeitsplatz-Anforderung | Vorhanden im Command Center |
|---|---|
| Aufgabenliste | `TaskBoard.tsx` auf `agent_tasks` |
| Routinen mit Verlauf | `RoutinesView.tsx` auf `agent_routines`, `agent_routine_runs`, `agent_routine_status_v` |
| Wissen / Gedächtnis | `MemoryView.tsx` auf `agent_memory`, Suche `search_agent_knowledge()` |
| Freigaben | `DecisionInbox.tsx` auf `agent_decisions`, `agent_decision_approvals`, `agent_questions` |
| Agentenkonfiguration mit Versionen | `AgentConfigPanel.tsx` auf `agent_config_versions` |
| Kosten & Monitoring | `MonitoringView.tsx`, `cc_platform_health()`, `cc_critical_events_v` |

Empfehlung: W1 erweitert das Command Center zu einer kundentauglichen Oberfläche „KI-Arbeitsplatz“. Kein `src/features/ki-arbeitsplatz` als Parallelstruktur.

**Fast alle relevanten Tabellen sind live leer.** Das Schema existiert, ein Betriebsnachweis fehlt. Einstufung daher überwiegend „vorhanden, nicht verifiziert“.

---

## 2. Belegte Bestandsaufnahme

Legende: **G** vorhanden und geprüft · **N** vorhanden, nicht verifiziert · **T** teilweise · **L** Legacy/tot · **Neu** neu erforderlich.
`src`/`fn` = Anzahl Dateien in `src/` bzw. `supabase/functions/`, die die Tabelle referenzieren. Zeilen = Live-Stand 01.11.2026.

### 2.1 Aufgaben und Läufe

| Tabelle | Migration | Zeilen | RLS/Pol. | src/fn | Einstufung |
|---|---|---|---|---|---|
| `agent_tasks` | `20260526000000_agent_os_substrate.sql` | 0 | ja/3 | 3/1 | **N** – kanonisch (siehe N1: `board_status`, Lease) |
| `agent_runs` | `20260516100000_governance_agent.sql` | 9 | ja/2 | 0/2 | N |
| `agent_sessions` | `20260516100000_governance_agent.sql` | 7 | ja/2 | 0/1 | N |
| `agent_events` | – | 0 | ja/1 | 2/3 | N |
| `agent_actions_log` | – | 0 | ja/1 | 2/0 | N |
| `autonomous_agent_tasks` / `_runs` / `_events` | `20260705180000_autonomous_agents_core.sql` | 0 | ja | 0/0 | **L** – kein Code-Nutzer |
| `enterprise_agent_runs` | `20260513400000_enterprise_agent_runs.sql` | 4 | ja/2 | 0/3 | L-Kandidat |
| `siteos_agent_runs` | – | 28 | ja/1 | 1/3 | **G-Kandidat** für Landingpage-Läufe |

### 2.2 Agenten

| Tabelle | Migration | Zeilen | Scope | Einstufung |
|---|---|---|---|---|
| `bots` / `bot_conversations` / `bot_messages` | `20260628193744_bots_foundation.sql` | – | tenant | **N – kanonisch für Kundenassistenten** (N2) |
| `agent_config_versions` | `20261030100000_agent_config_versions.sql` | 0 | tenant | N – Versionierung interner Agenten |
| `agent_configuration` | `20260706011047_agent_token_budget.sql` | 4 | tenant | N |
| `agent_profiles` | – | 4 | kein tenant (Katalog) | N |
| `bot_agents` | `20260628193744_bots_foundation.sql` | 0 | tenant | N – **nicht** im Bot-Laufzeitpfad (N2) |
| `tenant_voice_agents` | `20261029091700_tenant_voice_agents.sql` | 0 | tenant | N – Voice-Provisionierung (Job 44 scheitert) |
| `autonomous_agents` | `20260705180000_…` | 0 | tenant | **L** |
| `governance_agent_registry` | `20260817000000_…` | 0 | tenant | T |

### 2.3 Skills

| Tabelle | Migration | Zeilen | Scope | Einstufung |
|---|---|---|---|---|
| `automation_skills` | `20260614100000_automation_skills.sql` | 6 | kein tenant (Katalog) | **T** |

Ausführung über `automation-trigger` → n8n auf dem VPS → `automation-callback`. Es fehlen Version, Verantwortlicher, erlaubte Werkzeuge, Budgetgrenze, Freigabepflicht, Entwurf/aktiv je Mandant, Pinning. Skill-Ausführung über n8n hängt am offenen P0-VPS-Audit.

### 2.4 Routinen

| Tabelle | Migration | Zeilen | Einstufung |
|---|---|---|---|
| `agent_routines` | `20261030230000_memory_archive_routines.sql:90` | 0 | **N** – kanonisch |
| `agent_routine_runs` | ebenda `:105`, append-only | 0 | N |
| `agent_routine_status_v` | ebenda `:178` | – | N |

Die Registry ist ein Nachweis, kein Scheduler: `schedule` ist Freitext. Laut `docs/command-center/M9-abnahme-und-rollout.md` (K8) ruft kein Scheduler `record_routine_run`. Es fehlen Zeitzone, Skill-Version, Budget, Fehlerverhalten, Wiederholungsgrenzen, Verantwortlicher, Parallelitätssperre, Status `running`/`uncertain`.

### 2.5 Wissen

| Tabelle | Migration | Zeilen | Einstufung |
|---|---|---|---|
| `agent_memory` | `20260526000000_agent_os_substrate.sql` | 0 | N – Gedächtnis aus Gesprächen |
| `agent_knowledge_base` | `20260624000000_agent_operations_layer_schema.sql:153` | 0 | T – Kandidat für Unternehmenswissen (E3) |
| `governance_memory` | `20260803000000_rfc003_memory_governance.sql` | – | T – Retention-Logik, laut #2055 drittes Wissensmodell |
| `hermes_knowledge_items` | `20260527000000_hermes_agent.sql` | 0 | **L** |

`agent_knowledge_base` erlaubt `tenant_id IS NULL` (global lesbar für Authentifizierte). Spalten nur `source_type, title, content, tags`. `search_agent_knowledge()` ist `SECURITY INVOKER` und wortbasiert (`ILIKE`).

### 2.6 Werkzeuge / Verbindungen

| Tabelle | Zeilen | Scope | Einstufung |
|---|---|---|---|
| `integrations` | 5 | Katalog | N |
| `integration_configs` | 0 | tenant | N |
| `integration_connectors` | 0 | tenant | N |
| `m365_connections`, `telegram_connections` | 0 | tenant | N |
| `vps_connections` | 0 | owner+tenant | **Sicherheitsprüfung nötig** |

Ob Zugangsdaten außerhalb von DB-Klartext liegen, ist je Tabelle nicht verifiziert.

### 2.7 Freigaben und Übergaben

| Tabelle | Migration | Zeilen | Einstufung |
|---|---|---|---|
| `agent_decisions` / `agent_decision_approvals` / `agent_questions` | M4/M7 | 0 | N – laut M9 K1–K4 lokal getestet |
| `governance_approvals` | `20260513200000_governance_approvals.sql` | 0 | T – in #2055 als kanonisch geführt (siehe N7) |
| `pdp_approval_gates` | `20260824120000_…` | 0 | T |
| `runtime_approval_gates` | `20260516300000_runtime_core.sql` | 0 | kein tenant, L-Kandidat |
| `terminal_approvals` | `20260710010000_…` | 0 | **Sicherheitsprüfung nötig** |
| `hermes_agent_handoffs` | `20260527000000_hermes_agent.sql` | 0 | **L** |

Für die menschliche Übergabe beim Receptionist gibt es keine genutzte Tabelle → PR C bleibt Voraussetzung.

### 2.8 Leads, Termine, Landingpages

| Tabelle | Zeilen | Einstufung |
|---|---|---|
| `sales_leads` | 204 | G-Kandidat, aber laut #2055 **interner** Vertriebs-Posteingang, kein Mandanten-Inbox |
| `appointments`, `bot_appointments` | 0 | N |
| `websites` / `website_projects` / `website_domains` | 2 / 1 / 1 | N |
| `siteos_blueprints` | 13 | N |
| `siteos_publish_evaluations` | 0 | N |

### 2.9 Budget und Verbrauch

| Struktur | Zeilen | Einstufung |
|---|---|---|
| `cost_check_and_reserve` via `runAiTool` | – | **G** (laut #2055) – Mandanten-Kostendeckel für jeden KI-Aufruf |
| `bot_usage_reservations` / `bot_usage_ledger` | 0 / 0 | N – Kanalbudget der Bots (Gate 4) |
| `bot_usage_limits` | 9 | N |
| `agent_token_usage`, `token_usage`, `api_usage`, `usage_counters` | 0 | **L-Kandidaten** – nicht neu nutzen |

---

## 3. Lückenliste (Aufwand = Annahme)

| # | Baustein | Lücke | Aufwand |
|---|---|---|---|
| L1 | Aufgaben | `board_status` um `scheduled`, `waiting_external`, `uncertain`, `cancelled` erweitern; Schritt-Tabelle mit Idempotenzschlüssel, Skill-Version, Budget-Reservierungs-ID | M |
| L2 | Aufgaben | Worker mit Wiederaufnahme (vorhandene Lease-Felder nutzen, nur idempotente Schritte wiederholen) | M |
| L3 | Skills | Mandantenbezogene `skill_versions` | M |
| L4 | Skills | Ausführung ohne n8n/VPS oder erst nach P0-Audit | M |
| L5 | Routinen | Scheduler/Worker, der `agent_routine_runs` aus der Funktionsantwort schreibt | M |
| L6 | Wissen | Status bestätigt/Entwurf/extrahiert, Herkunft, Version, Vorschlagsmodus | M |
| L7 | Wissen | Import Website/Dokumente mit Verarbeitungsstatus | M |
| L8 | Werkzeuge | Lese-/Schreibrechte, erlaubte Aktionen, letzter Test, Widerruf; Secret-Ablage verifizieren | M |
| L9 | Freigaben | Freigabe am konkreten Ergebnis (Was/Wo/Für wen/Kosten) | S |
| L10 | Oberfläche | Command Center im Kundenmodus, mobile Aktionen, Begriffe ohne Interna | M |
| L11 | Betrieb | Cron-Secrets setzen, 401-Ziele klären (Abschnitt 5) | S |

---

## 4. Abnahmekriterien W1 (Auszug)

1. Arbeitsbereich A liest keine Quellen, Aufgaben oder Ergebnisse von B.
2. Skill nutzt nur Werkzeuge seiner Version.
3. Manipulierte Wissensquelle ändert keine Berechtigung.
4. Entwurf wird nie ohne Freigabe veröffentlicht.
5. Doppeltes Ereignis → genau eine externe Aktion.
6. Timeout → Budget bleibt reserviert bzw. „geschätzt“.
7. Parallele Aufgaben überschreiten kein Limit.
8. Worker-Neustart verliert keine Aufgabe, wiederholt keine nicht-idempotenten Schritte.
9. Abgebrochene Aufgabe startet keine freigabepflichtige Aktion.
10. Skill-Änderung verändert laufende Aufgaben nicht.
11. Ergebnisse auf 375 px abrufbar.
12. Kundenwebsite, CMS und DNS bleiben unverändert.
13. Geschätzte Kosten erscheinen nicht in `bot_usage_billable`.

Vollständige Liste: [`ki-arbeitsplatz-auftrag-v2.md`](./ki-arbeitsplatz-auftrag-v2.md).

---

## 5. Betriebsbefund (nicht behoben)

Stand 01.11.2026, 04:30 UTC, `net._http_response` (6 h) und `cron.job_run_details` (24 h):

- pg_cron meldet für alle aktiven Jobs „succeeded“. Das heißt nur, dass die HTTP-Anfrage abgeschickt wurde.
- HTTP 500 `CRON_KEY_MISSING` für die Function-Secrets `CRON_SCHEDULER_DISPATCH_KEY`, `CRON_BOT_VOICE_ENFORCER_KEY`, `CRON_GOVERNANCE_MONITORING_KEY`, `CRON_MEMORY_DECAY_KEY`, `CRON_AUDIT_MONITOR_KEY`, `CRON_WEBSITE_RESCAN_KEY`.
- HTTP 401 `UNAUTHORIZED_INVALID_JWT_FORMAT` von `governance-deadline-monitor`, `governance-score-calculator`, `automation-trigger-trial-webhook` (Zuordnung nach Zeitplan abgeleitet). Ursache: `verify_jwt = true` plus `requireServiceRole()` (`supabase/functions/_shared/auth.ts`). `verify_jwt = false` allein behebt das nicht. Fix = Umstellung auf das Cron-Key-Muster (eigener Key je Function, fail-closed).
- Job 44 `voice-agent-reconcile`: Vault-Secret `voice_provision_key` fehlt. `TWILIO_AUTH_TOKEN` nicht gesetzt.

Anforderung für W1: Routinenstatus kommt aus der Antwort der ausführenden Funktion, nie aus pg_cron.

---

## 6. Sicherheitsbefunde für das P0-Audit

1. **Kein Environment-Gate für `db push`** (M9-Blocker B1): Merge mit Migration geht automatisch live. „Merge ≠ Migration“ ist technisch nicht abgesichert. Höchste Priorität.
2. **`kodee` / `vps_connections` / `terminal_approvals`:** SSH-Leseaktionen gegen VPS. Erreichbarkeit für Kunden, `verify_jwt` und Schlüsselablage klären. Für den Arbeitsplatz ausgeschlossen.
3. **n8n auf dem VPS als Skill-Executor** hängt am P0-Audit.
4. **`agent_knowledge_base` mit `tenant_id IS NULL`** ist für alle Authentifizierten lesbar. Schreibpfade für Kundenwissen müssen `tenant_id` erzwingen.

---

## 7. Offene Entscheidungen

Siehe [`ki-arbeitsplatz-auftrag-v2.md`](./ki-arbeitsplatz-auftrag-v2.md), Abschnitt 4 (E1–E9). Bis zur Entscheidung ist keine Empfehlung beschlossen.

---

## 11. Nachprüfung 01.11.2026 (`main` @ `dbbd8a4`)

| # | Befund | Beleg | Folge |
|---|---|---|---|
| N1 | `agent_tasks` hat `board_status` (`backlog, planned, in_progress, awaiting_decision, blocked, in_review, done`), `claimed_by`, `claim_expires_at`, `correlation_id`, `depends_on`, `evidence` (Pflicht bei `done`) | `supabase/migrations/20261030140000_agent_task_coordination.sql:14–33` | L1/L2 kleiner als angenommen. `board_status` erweitern, kein neues Statusfeld. |
| N2 | Bot-Laufzeit nutzt `bots`, `bot_conversations`, `bot_messages`, `whatsapp_channels`. `bot_agents` nur in `src/features/governance/voice/voiceApi.ts`; `apps/agent-runtime/src/voice/*` schließt `bot_agents` ausdrücklich aus | `grep` über `supabase/functions/{bot-chat,bot-voice-webhook,whatsapp-webhook}`, `apps/agent-runtime/src/voice/tool-gateway.ts:15` | **E2 = `bots`.** Auch #2055 („`bot_agents` Kandidat“) ist insoweit überholt. |
| N3 | Routinen-Registry existiert | `20261030230000_memory_archive_routines.sql:90, 105, 178` | Keine neue Tabelle `routines`. |
| N4 | Command Center unter `/app/command-center` | `src/App.tsx`, `src/features/command-center/` | Keine Parallelstruktur. |
| N5 | Keine Tabellen `inquiries`, `agent_task_steps`, `skill_versions` | `grep` über `supabase/migrations` | PR C und W1 fehlen weiterhin. |
| N6 | `board_status` kennt **kein** `cancelled` (nur die alte Spalte `status`) | `20261030140000_agent_task_coordination.sql:24–25`, `20260526000000_agent_os_substrate.sql:64–65` | Abbildung „abgebrochen“ braucht Erweiterung oder Rückgriff auf `status`. |
| N7 | Widerspruch Freigaben: #2055 führt `governance_approvals`/`pdp_approval_gates` als kanonisch für Workspace-Publishing; v2 schlägt `agent_decisions` vor. Beide werden im Code genutzt (12 bzw. 9 Dateien) | `docs/ARCHITECTURE_CURRENT.md` Z. 96; `grep` | Entscheidung **E7** nötig. |
| N8 | Widerspruch Posteingang: #2055 legt fest „`bot_conversations` + PR-C-Erweiterung, kein neues Inbox-Modell“; spätere Projektplanung nennt eine Tabelle `inquiries` | `docs/ARCHITECTURE_CURRENT.md` Z. 84 | Entscheidung **E8** vor PR C nötig. |
| N9 | Budget ist zweistufig: `bot-chat` nutzt `createBotAiBudgetGuard` (Kanalbudget) **und** `runAiTool` → `cost_check_and_reserve` (Mandantendeckel). #2055 legt für Workspace-Skills `runAiTool` fest | `supabase/functions/bot-chat/index.ts:154, 183`; `_shared/ai.ts:202, 344` | Kein Widerspruch, sondern zwei Ebenen. Ob zusätzlich ein Kanal `workspace` in `bot_usage_*` entsteht: **E9**. |

Nicht geprüft: Live-Datenbank seit 04:30 UTC, Tests, CI, RLS-Policy-Texte einzeln.

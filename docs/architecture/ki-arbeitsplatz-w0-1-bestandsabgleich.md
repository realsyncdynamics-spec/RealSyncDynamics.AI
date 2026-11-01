# KI-Arbeitsplatz – W0.1 Bestandsabgleich

Stand: 01.11.2026. Nur Bestandsaufnahme: keine Implementierung, keine Migration, keine Produktivverifikation.

- Code-Stand der Erstfassung: `main` @ `9ca40f3` (30.10.2026), Nachprüfung N1–N5 auf `main` @ `dbbd8a4` (01.11.2026).
- Datenbank: Produktion, ausschließlich `SELECT` (Zeilenzahlen, RLS, Policies, Spalten), Stand 01.11.2026 ca. 04:30 UTC.
- Ergänzt die W0-Bestandsaufnahme in [`docs/ARCHITECTURE_CURRENT.md`](../ARCHITECTURE_CURRENT.md#w0--ai-workspace-bestandsaufnahme-und-architekturentscheidung).
- Auftrag für W1: [`ki-arbeitsplatz-auftrag-v2.md`](ki-arbeitsplatz-auftrag-v2.md).

Legende Einstufung: **G** vorhanden und geprüft · **N** vorhanden, nicht verifiziert · **T** teilweise · **L** Legacy · **Neu** neu erforderlich.
Zeilenzahlen sind eine Momentaufnahme der Produktionsdatenbank, kein Betriebsnachweis.

---

## 1. Kernaussage

**Der KI-Arbeitsplatz wird nicht neu gebaut. Das Grundgerüst existiert als Agent Command Center (M0–M9).**

`/app/command-center` (`src/App.tsx:983`, hinter `AppGate`) enthält bereits:

| Arbeitsplatz-Anforderung | Vorhanden im Command Center |
|---|---|
| Aufgabenliste | `TaskBoard.tsx` auf `agent_tasks` |
| Routinen mit Verlauf | `RoutinesView.tsx` auf `agent_routines`, `agent_routine_runs`, `agent_routine_status_v` |
| Wissen / Gedächtnis | `MemoryView.tsx` auf `agent_memory`, Suche `search_agent_knowledge()` |
| Freigaben | `DecisionInbox.tsx` auf `agent_decisions`, `agent_decision_approvals`, `agent_questions` |
| Agentenkonfiguration mit Versionen | `AgentConfigPanel.tsx` auf `agent_config_versions` |
| Kosten und Monitoring | `MonitoringView.tsx`, `cc_platform_health()`, `cc_critical_events_v` |

Fast alle relevanten Tabellen sind live leer. Das Schema existiert, ein Betriebsnachweis fehlt. Einstufung daher überwiegend **N**.

---

## 2. Nachprüfung 01.11.2026 (`main` @ `dbbd8a4`)

| # | Befund | Beleg | Folge |
|---|---|---|---|
| N1 | `agent_tasks` hat bereits `board_status` (u. a. `awaiting_decision`, `in_review`, `blocked`), `claimed_by`/`claim_expires_at` (Lease), `correlation_id`, `depends_on`, `evidence` (Pflicht bei `done`) und RPC `move_agent_task` | `supabase/migrations/20261030140000_agent_task_coordination.sql:14–39, 151–190` | Lücken L1/L2 kleiner als in der Erstfassung angenommen. Kein neues Statusfeld, `board_status` erweitern. |
| N2 | Der laufende Empfangsassistent nutzt `bots`, `bot_conversations`, `bot_messages` (Schema A) über `supabase/functions/_shared/bots.ts`, eingebunden in `bot-chat`, `bot-voice-webhook`, `whatsapp-webhook`. `bot_agents` wird nur in `src/features/governance/voice/voiceApi.ts` gelesen; `apps/agent-runtime` schließt `bot_agents` in Kommentaren ausdrücklich aus. | `supabase/functions/_shared/bots.ts:86–183`; `bot-chat/index.ts:35`, `bot-voice-webhook/index.ts:79`, `whatsapp-webhook/index.ts:45`; `apps/agent-runtime/src/voice/tool-gateway.ts:15`, `session-runtime.ts:19` | **Empfehlung E2 der Erstfassung (`bot_agents`) ist falsch.** Kundenassistent im Arbeitsplatz = `bots` (Schema A). |
| N3 | Routinen-Registry existiert: `agent_routines`, `agent_routine_runs` (append-only), View `agent_routine_status_v` | `supabase/migrations/20261030230000_memory_archive_routines.sql:90, 105, 178` | Keine neue Tabelle `routines`. |
| N4 | Command Center unter `/app/command-center` | `src/App.tsx:983`, `src/features/command-center/` | Kein `src/features/ki-arbeitsplatz/` als Parallelstruktur (E1). |
| N5 | Keine Tabellen `inquiries`, `agent_task_steps`, `skill_versions` | Suche nach `CREATE TABLE` in `supabase/migrations/` ohne Treffer | PR C und W1 fehlen weiterhin; Sperren bleiben. |

Nicht geprüft in der Nachprüfung: Live-Datenbank, Tests, CI.

---

## 3. Belegte Bestandsaufnahme (Erstfassung, Stand `9ca40f3`)

### 3.1 Aufgaben und Läufe

| Tabelle | Migration | Zeilen | RLS/Pol. | Einstufung |
|---|---|---|---|---|
| `agent_tasks` | `20260526000000_agent_os_substrate.sql:57` | 0 | ja/3 | **N** – kanonisch; Zustände über `board_status` (N1) |
| `agent_runs` | `20260516100000_governance_agent.sql` | 9 | ja/2 | N |
| `agent_sessions` | `20260516100000_governance_agent.sql` | 7 | ja/2 | N |
| `agent_events` | – | 0 | ja/1 | N |
| `agent_actions_log` | – | 0 | ja/1 | N |
| `autonomous_agent_tasks` / `_runs` / `_events` | `20260705180000_autonomous_agents_core.sql` | 0 | ja | **L** – kein Code-Nutzer |
| `enterprise_agent_runs` | `20260513400000_enterprise_agent_runs.sql` | 4 | ja/2 | L-Kandidat |
| `siteos_agent_runs` | – | 28 | ja/1 | G-Kandidat für Landingpage-Läufe |

### 3.2 Agenten

| Tabelle | Migration | Zeilen | Scope | Einstufung |
|---|---|---|---|---|
| `agent_config_versions` | `20261030100000_agent_config_versions.sql` | 0 | tenant | N – Versionierung interner Agenten |
| `agent_configuration` | `20260706011047_agent_token_budget.sql` | 4 | tenant | N |
| `agent_profiles` | – | 4 | Katalog | N |
| `bots` (+ `bot_conversations`, `bot_messages`) | Bots-Foundation | – | tenant | **kanonisch für Kundenassistenten (N2)** |
| `bot_agents` | `20260628193744_bots_foundation.sql` | 0 | tenant | N – nicht erweitern, nicht neu anbinden |
| `tenant_voice_agents` | `20261029091700_tenant_voice_agents.sql` | 0 | tenant | N – Voice-Provisionierung |
| `autonomous_agents` | `20260705180000_…` | 0 | tenant | **L** |
| `governance_agent_registry` | `20260817000000_…` | 0 | tenant | T – Governance-Sicht |

### 3.3 Skills

| Tabelle | Migration | Zeilen | Scope | Einstufung |
|---|---|---|---|---|
| `automation_skills` | `20260614100000_automation_skills.sql` | 6 | Katalog | **T** |

Globaler Katalog; Ausführung über `automation-trigger` → n8n → `automation-callback`. Es fehlen Version, Verantwortlicher, erlaubte Werkzeuge, Budgetgrenze, Freigabepflicht, Entwurf/aktiv je Mandant und Pinning. Skill-Ausführung über n8n wird nicht Grundlage des Arbeitsplatzes (E4).

### 3.4 Routinen

| Tabelle | Migration | Zeilen | Einstufung |
|---|---|---|---|
| `agent_routines` | `20261030230000_memory_archive_routines.sql:90` | 0 | **N** – kanonisch |
| `agent_routine_runs` | ebenda `:105`, append-only | 0 | N |
| `agent_routine_status_v` | ebenda `:178` | – | N |

Die Registry ist ein Nachweis, kein Scheduler: `schedule` ist Freitext. Laut `docs/command-center/M9-abnahme-und-rollout.md` (K8) ruft kein Scheduler `record_routine_run`. Es fehlen Zeitzone, Skill-Version, Budget, Fehlerverhalten, Wiederholungsgrenzen, Verantwortlicher, Sperre gegen parallele Läufe und die Status `running`/`uncertain`.

### 3.5 Wissen

| Tabelle | Migration | Zeilen | Einstufung |
|---|---|---|---|
| `agent_memory` | `20260526000000_agent_os_substrate.sql` | 0 | N – Gesprächsgedächtnis |
| `agent_knowledge_base` | `20260624000000_agent_operations_layer_schema.sql:153` | 0 | T – Kandidat kanonisch (E3) |
| `hermes_knowledge_items` | `20260527000000_hermes_agent.sql` | 0 | **L** |

`agent_knowledge_base` erlaubt `tenant_id IS NULL` (für alle Authentifizierten lesbar). Spalten nur `source_type`, `title`, `content`, `tags`. Es fehlen Status bestätigt/Entwurf/extrahiert, Herkunft, Version, Aktualisierungsdatum, Verarbeitungsstatus, Skill-Zuordnung und Vorschlagsmodus. `search_agent_knowledge()` ist `SECURITY INVOKER` und wortbasiert (`ILIKE`).

### 3.6 Werkzeuge und Verbindungen

| Tabelle | Migration | Zeilen | Scope | Einstufung |
|---|---|---|---|---|
| `integrations` | – | 5 | Katalog | N |
| `integration_configs` | `20260706010000_api_and_webhooks.sql` | 0 | tenant | N |
| `integration_connectors` | `20260515400000_connectors.sql` | 0 | tenant | N |
| `m365_connections` | – | 0 | tenant | N |
| `telegram_connections` | – | 0 | tenant | N |
| `vps_connections` | `20260430120000_kodee_vps_connections.sql` | 0 | owner+tenant | ausgeschlossen (siehe 7) |

Ob Zugangsdaten je Tabelle außerhalb von Klartext in der Datenbank liegen, ist nicht verifiziert.

### 3.7 Freigaben und Übergaben

| Tabelle | Migration | Zeilen | Einstufung |
|---|---|---|---|
| `agent_decisions`, `agent_decision_approvals`, `agent_questions` | M4/M7 | 0 | **N** – kanonisch, laut M9 K1–K4 lokal getestet |
| `governance_approvals` | `20260513200000_governance_approvals.sql` | 0 | T – Governance-Pfad |
| `pdp_approval_gates` | `20260824120000_…` | 0 | T – Policy-Gates |
| `runtime_approval_gates` | `20260516300000_runtime_core.sql` | 0 | L-Kandidat (kein tenant) |
| `terminal_approvals` | `20260710010000_phase6_2_collaborative_terminal.sql` | 0 | ausgeschlossen (siehe 7) |
| `hermes_agent_handoffs` | `20260527000000_hermes_agent.sql` | 0 | **L** |

Für die menschliche Übergabe beim Empfangsassistenten gibt es keine genutzte Tabelle → PR C.

### 3.8 Leads, Termine, Landingpages

| Tabelle | Zeilen | Einstufung |
|---|---|---|
| `sales_leads` | 204 | G-Kandidat, aber interner Vertriebs-Posteingang des Plattformbetreibers (siehe W0), kein Mandanten-Posteingang |
| `appointments`, `bot_appointments` | 0 | N |
| `websites` / `website_projects` / `website_domains` | 2 / 1 / 1 | N – SiteOS-Betrieb vorhanden |
| `siteos_blueprints` | 13 | N |
| `siteos_publish_evaluations` | 0 | N – Veröffentlichungsprüfung ungenutzt |

### 3.9 Budget und Verbrauch

| Tabelle | Zeilen | Einstufung |
|---|---|---|
| `bot_usage_reservations`, `bot_usage_ledger` | 0 | **N** – kanonisch (Gate 4) |
| `bot_usage_limits` | 9 | N – Plan-Caps |
| `bot_usage_channel_limits` | 0 | N |
| `bot_usage_billable` (View) | – | N |
| `agent_token_usage`, `token_usage`, `api_usage`, `usage_counters` | 0 | L-Kandidaten |
| `usage_events` | 3 | L-Kandidat |

Hinweis: Die W0-Fassung in `ARCHITECTURE_CURRENT.md` nennt für Workspace-Skills den Pfad `runAiTool` → `cost_check_and_reserve`. Der Auftrag v2 sieht `bot_usage_reservations`/`bot_usage_ledger` (Kanal `workspace`) vor. **Offen, Entscheidung erforderlich** – siehe Auftrag v2, Abschnitt 4.

---

## 4. Kanonische Quellen je Baustein

| Baustein | Kanonisch | Legacy (nicht löschen, nicht neu nutzen) |
|---|---|---|
| Aufgaben | `agent_tasks` (`board_status`, Lease) + neu `agent_task_steps` | `autonomous_agent_tasks/_runs/_events`, `enterprise_agent_runs` |
| Läufe Landingpage | `siteos_agent_runs` (verlinkt aus Aufgabe) | – |
| Agenten intern | `agent_configuration` + `agent_config_versions` (Admin-Sicht) | `autonomous_agents` |
| Kundenassistenten | **`bots` + `bot_conversations` + `bot_messages`** (korrigiert, N2) | `bot_agents` nicht neu anbinden |
| Skills | neu `skill_versions`; `automation_skills` eingefroren | – |
| Routinen | `agent_routines` + `agent_routine_runs` | – |
| Wissen | `agent_knowledge_base` erweitern (E3); `agent_memory` bleibt Gesprächsgedächtnis | `hermes_knowledge_items` |
| Verbindungen | `integration_connectors` (Mandant) + `integrations` (Katalog) | Rolle `integration_configs` klären |
| Freigaben | `agent_decisions` / `agent_decision_approvals` | `runtime_approval_gates`, `hermes_agent_handoffs` |
| Budget | offen, siehe 3.9 | `agent_token_usage`, `token_usage`, `api_usage`, `usage_counters` |

---

## 5. Lückenliste (Aufwand ist eine Annahme)

| # | Baustein | Lücke | Aufwand |
|---|---|---|---|
| L1 | Aufgaben | `board_status` um `scheduled`, `waiting_external`, `uncertain` erweitern; `agent_task_steps` mit Idempotenzschlüssel, Skill-Version, Budget-Reservierungs-ID | S–M (nach N1) |
| L2 | Aufgaben | Worker mit Wiederaufnahme nach Neustart auf Basis der vorhandenen Lease-Felder | M |
| L3 | Skills | Mandantenbezogene `skill_versions` (Version, Owner, Werkzeuge, Budgetgrenze, Freigabepflicht, Entwurf/aktiv) | M |
| L4 | Skills | Ausführung als Edge Function statt n8n | M |
| L5 | Routinen | Worker, der `agent_routine_runs` aus der Funktionsantwort schreibt; Zeitzone, verpasste Läufe, Parallelsperre | M |
| L6 | Wissen | Status, Herkunft, Version, Vorschlagsmodus, Skill-Zuordnung; Schreibpfade für Kundenwissen erzwingen `tenant_id` | M |
| L7 | Wissen | Import Website/Dokumente mit Verarbeitungsstatus | M |
| L8 | Werkzeuge | Lese-/Schreibrechte, erlaubte Aktionen, letzter Test, Widerruf je Verbindung; Secret-Ablage verifizieren | M |
| L9 | Freigaben | Freigabe am konkreten Ergebnis (Was/Wo/Für wen/Kosten) an `agent_decisions` | S |
| L10 | Oberfläche | Kundenmodus des Command Centers: Aufgabeneingabe, Ergebnisse, mobile Aktionen, ohne interne Begriffe | M |

---

## 6. Betriebsbefund Routinen

`pg_cron` meldet „succeeded“, sobald die HTTP-Anfrage abgeschickt ist. Am 01.11.2026 antworteten mehrere Cron-Ziele mit HTTP 500 bzw. 401 (fehlende Cron-Keys bzw. falsches Auth-Muster). Folgerung für W1: **Routinenstatus kommt aus der Antwort der ausführenden Funktion, nie aus `pg_cron`.** Details und Behebung: [`docs/runbooks/cron-vault-secrets.md`](../runbooks/cron-vault-secrets.md) und internes Betriebsprotokoll.

## 7. Ausschlüsse und Sicherheitsvoraussetzungen

- B1 Environment-Gate für `db push` (`docs/command-center/M9-abnahme-und-rollout.md`) ist Voraussetzung für jeden weiteren Merge mit Migration (E6).
- `kodee`, `vps_connections`, `terminal_approvals` sind kein Bestandteil des Arbeitsplatzes. Keine Kundenfunktion mit Shell- oder SSH-Wirkung.
- Skill-Ausführung über VPS-Dienste erst nach Abschluss des internen P0-VPS-Audits.
- Einzelbefunde des Sicherheitsaudits werden nicht in diesem öffentlichen Repository geführt.

---

## 8. Entscheidungen (E2 korrigiert)

| # | Entscheidung | Empfehlung | Status |
|---|---|---|---|
| E1 | Arbeitsplatz als Kundenmodus des Command Centers | Ja | offen |
| E2 | Steuerbare Kundenassistenten | **`bots` (Schema A)** – korrigiert gegenüber Erstfassung (`bot_agents`) | offen |
| E3 | Kanonische Wissenstabelle | `agent_knowledge_base` erweitern | offen |
| E4 | Skill-Ausführung über n8n/VPS | Nein; Edge Functions | offen |
| E5 | Legacy-Tabellen | markieren, Neunutzung per Test sperren, Rückbau separat | offen |
| E6 | Environment-Gate für `db push` | vor jedem weiteren Merge mit Migration | offen |

## 9. Prüfpfad

- Erstfassung: Produktions-`SELECT` auf `information_schema`, `pg_class.relrowsecurity`, `pg_policies`, `count(*)`/`max(created_at)` je Tabelle, `cron.job`, `cron.job_run_details`, `net._http_response`; `grep` über `src/`, `supabase/functions/`, `supabase/migrations/`.
- Nachprüfung N1–N5: `git clone --depth 1` auf `dbbd8a4`, `grep` über `supabase/migrations/`, `supabase/functions/`, `src/App.tsx`, `apps/agent-runtime/`.
- Nicht ausgeführt: Tests, CI, RLS-Policy-Texte im Einzelnen.

# Agenten-Landschaft — Bestandsaufnahme 2026-09-06

Gemessen gegen das Live-Projekt `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`,
eu-central-1) am **2026-09-06, ca. 14:15 UTC**. Quellen: `cron.job`,
`cron.job_run_details`, `net._http_response`, `pg_tables`,
`information_schema.columns` sowie Zeilenzählung der genannten Tabellen.

**Anlass.** Vor der Bewertung eines Architektur-Entwurfs für eine
Organisations- und Rollenebene über den Agenten (siehe
[`../architecture/agent-organisation-rfc.md`](../architecture/agent-organisation-rfc.md))
stand die Frage, was von der Agenten-Landschaft heute überhaupt arbeitet.
Antwort: fast nichts — und die Ursache ist eine Kette, kein Einzelfehler.

---

## 1. Der zentrale Befund: eine Kausalkette, kein defektes System

Die Agent-OS-Runtime ist **nicht kaputt**. Sie hat nichts zu tun, weil ihr
weiter oben in der Kette die Eingangsdaten fehlen:

| # | Glied | Zustand am 2026-09-06 |
|---|---|---|
| 1 | `scan-scheduler-dispatch` (pg_cron, alle 15 min) | **rot** seit 2026-08-12 — Vault-Secret `service_role_key` fehlt |
| 2 | `websites`, `scan_runs` | **0 Zeilen** — es wird kein Scan eingeplant, also entsteht kein Scan |
| 3 | `monitoring_sources` | **0 Zeilen** — ohne Scans keine Quelle unter SLO |
| 4 | `agent-os-runner` (stündlich) | **grün** seit 2026-09-01, iteriert alle 6 Tenants, `monitoring_slos_evaluated: 0` |
| 5 | `agent_observations`, `agent_events`, `agent_tasks` | **0 Zeilen** — der Runner findet nichts, was er beobachten könnte |
| 6 | `governance_alerts` | **0 Zeilen** — ohne Beobachtung kein Alarm |

Der Reparaturpunkt liegt bei **(1)**, nicht bei (4). Jede Arbeit an der
Agenten-Ebene, die weiter unten ansetzt, behebt ein Symptom.

---

## 2. Cron-Status

Fehlläufe gesamt, gruppiert über die vollständige `cron.job_run_details`:

| Job | Zustand | seit | Fehlläufe | fehlendes Secret |
|---|---|---|---|---|
| `agent-os-runner-hourly` | 🟢 **behoben** | grün seit 2026-09-01 | 2 212 (2026-05-29 → 2026-09-01) | `agent_os_runner_token`, angelegt 2026-09-01 |
| `agent-os-runner-daily` | 🟢 **behoben** | grün seit 2026-09-01 | 92 | dito |
| `scan-scheduler-dispatch` | 🔴 rot | 2026-08-12 | 1 687+ | `service_role_key` |
| `governance-monitoring-hourly` | 🔴 rot | 2026-08-12 | 422+ | `service_role_key` |
| `memory-decay-hourly` | 🔴 rot | 2026-08-12 | 411+ | `service_role_key` |
| `governance-monitoring-daily` | 🔴 rot | 2026-08-12 | 18+ | `service_role_key` |

Die übrigen neun Jobs laufen durchgehend grün. Das Muster ist eindeutig: Jeder
Job, für den ein eigenes Vault-Secret existiert, arbeitet; die vier
verbleibenden roten Jobs hängen alle am selben fehlenden Eintrag.

Diagnose und Dispatch-Reparatur stehen bereits in
`supabase/migrations/20260820000000_cron_dispatch_fix.sql` (2026-08-20). Deren
Kopfkommentar hält fest, dass zwei Secrets nur vom Betreiber angelegt werden
können — der Service-Role-Key gehört nicht in eine Migration und nicht in die
Git-History. Eines davon (`agent_os_runner_token`) ist inzwischen angelegt, das
zweite nicht.

**Offener Betreiberschritt** (Supabase-SQL-Editor, nicht aus dem Repo möglich):

```sql
SELECT vault.create_secret('<service-role-key>', 'service_role_key');
```

Danach laufen die vier Jobs ohne Code-Änderung an — `app_functions_base_url()`
und die Dispatch-Funktion lesen den Vault bereits.

---

## 3. „Grüner Cron" heißt nicht „Agent arbeitet"

`agent-os-runner-hourly` meldet seit dem 01.09. 48 von 48 Läufen als
`succeeded`. Der pg_cron-Status sagt aber nur, dass das SQL-Statement — der
`net.http_post` — durchlief; er sagt nichts über die Antwort der Edge Function.
Die steht in `net._http_response`. Für den Lauf 2026-09-06 14:00 UTC:

```json
{"cadence":"hourly","duration_ms":1262,"total_errors":0,"phase":"B_RUNTIME",
 "tenants":[ /* alle 6 Tenants, jeweils: */
   {"tenant_id":"…","hermes_brief_created":false,"monitoring_slos_evaluated":0,
    "monitoring_slos_breached":0,"decision_overdue_flagged":0,"alerts_created":0,
    "errors":[]} ]}
```

Sechs Tenants, null Fehler, null Ergebnis. Der Runner funktioniert korrekt —
`runMonitoringSloForTenant()` lädt `monitoring_sources` mit
`status in ('active','error')`, und diese Menge ist leer.

**Das verschärft eine Regel, die schon im Repo stand.** Die frühere Root-
`CLAUDE.md` (vor dem Slim-Cut; siehe `docs/claude/CONTEXT_POLICY.md`) hielt seit
dem 2026-09-01 fest, man solle „nicht an `cron.job`, sondern an
`cron.job_run_details.status`" prüfen — geschrieben nach demselben Muster beim
`memory-decay-hourly`. Diese Messung zeigt die nächste Stufe: Ein Job hat drei
Zustände, nicht zwei — nicht registriert, registriert aber scheiternd, und grün
aber wirkungslos. Der dritte ist der teuerste, weil jede Überwachung ihn als
gesund meldet. Die verschärfte Regel bleibt **hier** im Runbook kanonisch —
nicht zurück in die schlanke Root-`CLAUDE.md`.

**Konsequenz für die Überwachung:** Ein Health-Check auf pg_cron-Status hätte
diesen Zustand als gesund gemeldet. Wer wissen will, ob ein Agent arbeitet,
muss seine **Ausgabe** messen (Zeilen in `agent_observations` seit *t*), nicht
seinen Dispatch. Das gehört in M1 der
[Agent-Manager-Roadmap](../architecture/agent-manager-roadmap.md), ist dort
aber bisher als „kein erfolgreicher Lauf seit X" formuliert — was denselben
blinden Fleck hätte.

---

## 4. Zeilenstand der Agenten- und Governance-Tabellen

| Tabelle | Zeilen | letzte |
|---|---|---|
| `agent_runs`, `agent_tasks`, `agent_events`, `agent_observations`, `agent_sessions` | **0** | — |
| `ai_tool_runs` | **0** | — |
| `workflow_runs`, `governance_alerts`, `governance_approvals`, `governance_incidents`, `governance_memory` | **0** | — |
| `monitoring_sources`, `websites`, `scan_runs`, `ai_systems` | **0** | — |
| `enterprise_agent_runs` | 4 | 2026-07-12 |
| `agent_profiles` | 4 (Seeds) | 2026-08-12 |
| `tenants` | 6 | 2026-09-01 |

Von den sechs Tenants sind vier erkennbar Test-Artefakte („Test Tenant",
„Deploy-Test-…", „Support+E2e", „Probe-…").

**Zum leeren Prüfpfad:** `ai_tool_runs` steht bei 0. Die Plattform-Regel (Ist-
Stack / AI-Provider) verlangt, dass jeder externe Modell-Call dort landet. Aus
den Daten allein lässt sich **nicht** unterscheiden, ob (a) schlicht kein
externer Call stattgefunden hat — was zum Rest dieses Befunds passt — oder ob
(b) die Protokollierung nicht auslöst. Das ist offen und sollte beim ersten
echten Agenten-Lauf gezielt geprüft werden, nicht vorher aus der Zeilenzahl
geschlossen.

---

## 5. Was daraus für die Reihenfolge folgt

1. **Vault-Secret anlegen** (Betreiber, s. o.) — löst vier Jobs auf einmal.
2. **Messen, was dann tatsächlich läuft** — insbesondere, ob der Scan-Dispatch
   `websites`/`scan_runs` füllt und ob `ai_tool_runs` Zeilen bekommt.
3. **M0 aus der Agent-Manager-Roadmap** — Registry und Read-Layer, mit einem
   Health-Kriterium, das Ausgabe misst statt Dispatch (§3).
4. Die **Stammdaten** der Organisationsebene (`org_units`, `agent_roles`,
   `agents`) sind davon unabhängig und laufen bereits — ADR 0011 und PR #1202.
   Sie vor dem ersten Betrieb festzuziehen ist richtig, weil eine falsche
   RLS-Struktur später nur destruktiv korrigierbar wäre.
5. **Erst nach (1)–(3)** die **Betriebs-Tabellen** derselben Ebene
   (`agent_tickets`, `agent_reports`, `agent_kg_*`). Berichts-Rollups und
   Ticketflüsse über einer Basis von null Beobachtungen beschreiben einen
   Betrieb, den es nicht gibt.

---

*Erhoben 2026-09-06. Methode und Projekt-ID oben; nachmessbar mit denselben
Abfragen. Wer diesen Stand fortschreibt, ersetzt die Zahlen und nennt das
neue Messdatum — nicht überschreiben ohne Datum.*

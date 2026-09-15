# Runbook: Vault-Secrets für den Cron-Dispatch

**Zielgruppe**: Betreiber (Zugriff auf den Supabase-SQL-Editor und Function Secrets
des Produktionsprojekts).
**Dauer**: wenige Minuten.
**Warum nicht automatisiert**: Die Werte sind dedizierte Cron-Keys. Sie gehören
nicht in eine Migration, nicht in die Git-History und nicht in eine
CI-Umgebung — CLAUDE.md §4 verbietet es ausdrücklich. Dieser Schritt bleibt
deshalb beim Menschen.

---

## Vertrag (live Hotfix + Repo)

Die Cron-Empfänger prüfen **nicht** den `service_role` JWT. Sie vergleichen
den inbound `Authorization: Bearer …` gegen dedizierte Function Secrets
(fail-closed: leerer Key → 401). `SUPABASE_SERVICE_ROLE_KEY` darf nach Auth noch
für PostgREST/Admin genutzt werden — nie als Inbound-Credential.

| pg_cron Job | Edge Function | Vault-Secret (pg_cron / `dispatch_cron_function`) | Function Secret (Edge) |
|---|---|---|---|
| `scan-scheduler-dispatch` | `scheduler-dispatch` | `cron_scheduler_dispatch_key` | `CRON_SCHEDULER_DISPATCH_KEY` |
| `governance-monitoring-hourly` / `-daily` | `governance-monitoring-scheduler` | `cron_governance_monitoring_key` | `CRON_GOVERNANCE_MONITORING_KEY` |
| `memory-decay-hourly` | `memory-decay-worker` | `cron_memory_decay_key` | `CRON_MEMORY_DECAY_KEY` |
| `cron_audit_recheck_key` | `CRON_AUDIT_RECHECK_KEY` |
| `cron_daily_digest_key` | `CRON_DAILY_DIGEST_KEY` |
| `cron_sub_processor_notify_key` | `CRON_SUB_PROCESSOR_NOTIFY_KEY` |
| `cron_audit_drip_key` | `CRON_AUDIT_DRIP_KEY` |
| `audit-recheck-daily` | `audit-recheck-weekly` | `cron_audit_recheck_key` | `CRON_AUDIT_RECHECK_KEY` |
| `daily-digest` | `daily-digest` | `cron_daily_digest_key` | `CRON_DAILY_DIGEST_KEY` |
| `sub-processor-notify-daily` | `sub-processor-notify` | `cron_sub_processor_notify_key` | `CRON_SUB_PROCESSOR_NOTIFY_KEY` |
| `audit-email-drip-daily` | `audit-drip-cron` | `cron_audit_drip_key` | `CRON_AUDIT_DRIP_KEY` |

`verify_jwt = false` bleibt (Drift-Guard). Ohne passenden Cron-Bearer bleibt die
Function nicht öffentlich aufrufbar.

Git-Align: `20260912180000_cron_trio_dedicated_keys.sql` schreibt die vier
Job-Kommandos auf die `cron_*` Vault-Namen (Upsert per Jobname). Ältere
Migrationen (`20260820000000` …) bleiben historisch auf `service_role_key` —
nach Apply dieser Migration muss `cron.job.command` die `cron_*` Namen tragen.

`20260915110500_cron_rest_dedicated_keys.sql` zieht dieselbe Umstellung für die
vier Rest-Jobs nach. **Danach benutzt kein Cron-Pfad mehr `service_role_key`.**

---

## Historischer Befund (2026-09-06)

Gemessen am **2026-09-06** gegen das Live-Projekt `ebljyceifhnlzhjfyxup`
(`cron.job` verbunden mit `cron.job_run_details`):

| Job | Zeitplan | ruft auf | Fehlläufe | seit |
|---|---|---|---|---|
| `scan-scheduler-dispatch` | `*/15 * * * *` | `scheduler-dispatch` | 2403 | 2026-08-12 |
| `governance-monitoring-hourly` | `15 * * * *` | `governance-monitoring-scheduler` | 601 | 2026-08-12 |
| `memory-decay-hourly` | `0 * * * *` | `memory-decay-worker` | 600 | 2026-08-12 |
| `governance-monitoring-daily` | `0 2 * * *` | `governance-monitoring-scheduler` | 25 | 2026-08-13 |

Damals scheiterten die Jobs am fehlenden Vault-Eintrag und/oder am Abgleich
gegen den Service-Role-Bearer. Live-Hotfixes nutzen bereits die `cron_*` Keys;
dieses Runbook und der Function-Code müssen denselben Vertrag halten, sonst
überschreibt der nächste Functions-Deploy die Hotfixes wieder mit 401s.

## Gemessener Stand (2026-09-15, 05:00–10:45 UTC)

Gegen die Live-DB gemessen, je Job über seine Kadenz zugeordnet. **Neun von elf
Dispatch-Jobs antworten mit HTTP 401.** Grün ist allein `agent-os-runner` — und
der benutzt `agent_os_runner_token`, ein Secret, das älter ist als die Rotation.

| Job | Vault-Secret | Antwort |
|---|---|---|
| `scan-scheduler-dispatch` | `cron_scheduler_dispatch_key` | 401, 24/24 |
| `governance-monitoring-hourly` | `cron_governance_monitoring_key` | 401, 6/6 |
| `memory-decay-hourly` | `cron_memory_decay_key` | 401, 6/6 |
| `audit-recheck-daily` | `service_role_key` | 401 |
| `daily-digest` | `service_role_key` | 401 |
| `sub-processor-notify-daily` | `service_role_key` | 401 |
| `audit-email-drip-daily` | `service_role_key` | 401 |
| `agent-os-runner-hourly` / `-daily` | `agent_os_runner_token` | 200 |

Zwei getrennte Ursachen:

1. **Das Trio**: Die drei `cron_*` Vault-Secrets existieren seit dem
   2026-09-10 11:08 UTC, und die Job-Kommandos zeigen darauf. Die **Function
   Secrets** sind auf der Function-Seite aber nicht gesetzt oder tragen einen
   anderen Wert — die Functions schlagen fail-closed aus. Es fehlt genau der
   Betreiberschritt unten, sonst nichts.
2. **Die vier Rest-Jobs**: Sie liefen bis `20260915110500` über
   `service_role_key`. Der dort hinterlegte Wert wird von ihren Functions
   ebenfalls nicht akzeptiert. Der Zwischenzustand aus `20260912180000`
   („bleiben auf service_role_key") hat also nie getragen.

**Warum das fünf Tage unbemerkt blieb** — und das ist der eigentliche Befund:
`cron.job_run_details` meldet für jeden dieser Läufe `succeeded` mit
`return_message = '1 row'`. Das bedeutet nur, dass `net.http_post` die Anfrage
eingereiht hat. Die 401 steht ausschließlich in `net._http_response`, und die
Tabelle hält nur rund sechs Stunden vor. Wer den Erfolg an der Job-Ebene misst,
sieht einen grünen Cron über einer toten Funktionskette.

## Was währenddessen nicht passiert

Das ist kein Nebenläufiges, sondern zugesagte Funktion:

- **`scheduler-dispatch`** — der Scheduler wird ab Growth verkauft
  („Tägliches Monitoring mit Drift Detection", „Scheduler für geplante Läufe
  mit Slack-/Teams-/Webhook-Alerts").
- **`governance-monitoring-scheduler`** — die Sentinel-Schleife der Governance
  Runtime samt SLO-Tracking und Incident-Dispatch.
- **`memory-decay-worker`** — der temporale Verfall aus RFC-003. Ohne ihn
  verfällt kein Memory.

## Behebung / Abgleich (Dominik — Dashboard)

Im SQL-Editor / Vault und unter Function Secrets des Produktionsprojekts
(Werte **nicht** in Issues/PRs/Chats). Nur anlegen, wenn der Eintrag fehlt —
bereits live gesetzte `cron_*` Keys nicht überschreiben.

```sql
-- Nur anlegen, wenn der Eintrag fehlt. Werte nicht aus dem Repo übernehmen.
select vault.create_secret('<cron-key>', 'cron_scheduler_dispatch_key');
select vault.create_secret('<cron-key>', 'cron_governance_monitoring_key');
select vault.create_secret('<cron-key>', 'cron_memory_decay_key');
select vault.create_secret('<cron-key>', 'cron_audit_recheck_key');
select vault.create_secret('<cron-key>', 'cron_daily_digest_key');
select vault.create_secret('<cron-key>', 'cron_sub_processor_notify_key');
select vault.create_secret('<cron-key>', 'cron_audit_drip_key');
```

Dieselben Werte als Function Secrets setzen (Namen only):

| Vault (pg_cron) | Function Secret (Edge) |
|---|---|
| `cron_scheduler_dispatch_key` | `CRON_SCHEDULER_DISPATCH_KEY` |
| `cron_governance_monitoring_key` | `CRON_GOVERNANCE_MONITORING_KEY` |
| `cron_memory_decay_key` | `CRON_MEMORY_DECAY_KEY` |

`dispatch_cron_function` liest den Vault-Namen zur Laufzeit über
`public.get_app_secret(...)`. Die Edge Function liest das Function Secret.
Beide Seiten müssen denselben Wert sehen.

> ⚠️ Keinen Schlüssel in ein Issue, einen PR, eine Migration oder einen
> Chatverlauf kopieren. SQL-Editor und Function-Secrets-UI sind die einzigen
> Orte.

**Nicht** den kompromittierten `service_role` JWT als Inbound-Bearer für eine
dieser Functions verwenden. Seit `20260915110500` reicht der Cron-Dispatch ihn
für keinen Job mehr weiter.

## Prüfen, dass es gewirkt hat

Der nächste Lauf kommt binnen 15 Minuten (`scan-scheduler-dispatch`).

**Die Job-Ebene allein beweist nichts.** Sie meldet `succeeded`, sobald die
Anfrage eingereiht ist — auch wenn die Function sie mit 401 abweist. Genau das
hat den Ausfall vom 2026-09-10 fünf Tage lang verdeckt. Maßgeblich ist die
Antwort:

```sql
-- Der eigentliche Nachweis: Statuscodes der letzten Stunden.
-- net._http_response haelt nur rund sechs Stunden vor.
select status_code, count(*) as n, min(created) as von, max(created) as bis,
       left((array_agg(content order by created desc))[1], 120) as letzte_antwort
from net._http_response
where created >= now() - interval '6 hours'
group by status_code
order by status_code;
```

Erwartung: **keine einzige 401.** Jede 401 ist ein Job, dessen Secret-Paar nicht
zusammenpasst.

Ergänzend die Job-Ebene, um abgebrochene Dispatches zu sehen (fehlendes
Vault-Secret meldet sich hier, nicht in der Antwort):

```sql
select j.jobname, d.status, d.start_time, left(coalesce(d.return_message,''), 120)
from cron.job j
join cron.job_run_details d on d.jobid = j.jobid
where j.active
order by d.start_time desc
limit 20;
```

Erwartung: `status = 'succeeded'`, `return_message = '1 row'`. Ein
`Vault-Secret "…" fehlt` weist auf die Datenbankseite, eine 401 in der Abfrage
davor auf die Function-Seite.

## Wer meldet das künftig

`Cron Health Guard` (`.github/workflows/cron-health.yml`, täglich 06:45 UTC)
prüft, ob ein aktiver Job in seinem **letzten** Lauf gescheitert ist, und
gruppiert die Ausfälle nach ihrer Meldung. `drift-alert.yml` hält daraus genau
ein Issue offen und schließt es selbst, sobald der Guard wieder grün läuft.

> ⚠️ **Der Guard beobachtet heute die falsche Ebene.** Er liest
> `cron.job_run_details.status`, und der stand während des gesamten Ausfalls vom
> 2026-09-10 bis 2026-09-15 auf `succeeded`. Ein Guard, der die Antwort nicht
> ansieht, kann diesen Fehler nicht finden. Die Erweiterung auf die
> HTTP-Antwort ist ein eigener Schritt und noch nicht gebaut.

## Verwandter, noch offener Punkt

`agent_os_runner_token` liegt im Vault, aber `agent-os-runner-hourly` und
`-daily` tragen ältere Fehlläufe aus der GUC-Zeit. Ihre jüngsten Läufe sind
grün — sie sind repariert, die Historie bleibt. Der Guard bewertet den letzten
Lauf, nicht die Fehlerquote.

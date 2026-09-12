# Runbook: Vault-Secrets für den Cron-Dispatch (Cron-Trio)

**Zielgruppe**: Betreiber (Zugriff auf den Supabase-SQL-Editor und Function Secrets
des Produktionsprojekts).
**Dauer**: wenige Minuten.
**Warum nicht automatisiert**: Die Werte sind dedizierte Cron-Keys. Sie gehören
nicht in eine Migration, nicht in die Git-History und nicht in eine
CI-Umgebung — CLAUDE.md §4 verbietet es ausdrücklich. Dieser Schritt bleibt
deshalb beim Menschen.

---

## Vertrag (live Hotfix + Repo)

Die drei Cron-Empfänger prüfen **nicht** den `service_role` JWT. Sie vergleichen
den inbound `Authorization: Bearer …` gegen dedizierte Function Secrets
(fail-closed: leerer Key → 401). `SUPABASE_SERVICE_ROLE_KEY` darf nach Auth noch
für PostgREST/Admin genutzt werden — nie als Inbound-Credential.

| pg_cron Job | Edge Function | Vault-Secret (pg_cron / `dispatch_cron_function`) | Function Secret (Edge) |
|---|---|---|---|
| `scan-scheduler-dispatch` | `scheduler-dispatch` | `cron_scheduler_dispatch_key` | `CRON_SCHEDULER_DISPATCH_KEY` |
| `governance-monitoring-hourly` / `-daily` | `governance-monitoring-scheduler` | `cron_governance_monitoring_key` | `CRON_GOVERNANCE_MONITORING_KEY` |
| `memory-decay-hourly` | `memory-decay-worker` | `cron_memory_decay_key` | `CRON_MEMORY_DECAY_KEY` |

`verify_jwt = false` bleibt (Drift-Guard). Ohne passenden Cron-Bearer bleibt die
Function nicht öffentlich aufrufbar.

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

## Was währenddessen nicht passiert

Das ist kein Nebenläufiges, sondern zugesagte Funktion:

- **`scheduler-dispatch`** — der Scheduler wird ab Growth verkauft
  („Tägliches Monitoring mit Drift Detection", „Scheduler für geplante Läufe
  mit Slack-/Teams-/Webhook-Alerts").
- **`governance-monitoring-scheduler`** — die Sentinel-Schleife der Governance
  Runtime samt SLO-Tracking und Incident-Dispatch.
- **`memory-decay-worker`** — der temporale Verfall aus RFC-003. Ohne ihn
  verfällt kein Memory.

## Behebung / Abgleich

Im SQL-Editor des Produktionsprojekts (Werte **nicht** in Issues/PRs/Chats):

```sql
-- Nur anlegen, wenn der Eintrag fehlt. Werte nicht aus dem Repo übernehmen.
select vault.create_secret('<cron-key>', 'cron_scheduler_dispatch_key');
select vault.create_secret('<cron-key>', 'cron_governance_monitoring_key');
select vault.create_secret('<cron-key>', 'cron_memory_decay_key');
```

Dieselben Werte als Function Secrets setzen:

- `CRON_SCHEDULER_DISPATCH_KEY`
- `CRON_GOVERNANCE_MONITORING_KEY`
- `CRON_MEMORY_DECAY_KEY`

`dispatch_cron_function` liest den Vault-Namen zur Laufzeit über
`public.get_app_secret(...)`. Die Edge Function liest das Function Secret.
Beide Seiten müssen denselben Wert sehen.

> ⚠️ Keinen Schlüssel in ein Issue, einen PR, eine Migration oder einen
> Chatverlauf kopieren. SQL-Editor und Function-Secrets-UI sind die einzigen
> Orte.

**Nicht** den kompromittierten `service_role` JWT als Inbound-Bearer für diese
drei Functions verwenden.

## Prüfen, dass es gewirkt hat

Der nächste Lauf kommt binnen 15 Minuten (`scan-scheduler-dispatch`).

```sql
select j.jobname, d.status, d.start_time, left(coalesce(d.return_message,''), 120)
from cron.job j
join cron.job_run_details d on d.jobid = j.jobid
where j.jobname in (
  'scan-scheduler-dispatch','governance-monitoring-hourly',
  'memory-decay-hourly','governance-monitoring-daily'
)
order by d.start_time desc
limit 8;
```

Erwartung: `status = 'succeeded'`, `return_message = '1 row'`.

**Nicht an `cron.job` prüfen, sondern an `cron.job_run_details.status`.**

## Wer meldet das künftig

`Cron Health Guard` (`.github/workflows/cron-health.yml`, täglich 06:45 UTC)
prüft, ob ein aktiver Job in seinem **letzten** Lauf gescheitert ist, und
gruppiert die Ausfälle nach ihrer Meldung. `drift-alert.yml` hält daraus genau
ein Issue offen und schließt es selbst, sobald der Guard wieder grün läuft.

## Verwandter, noch offener Punkt

`agent_os_runner_token` liegt im Vault, aber `agent-os-runner-hourly` und
`-daily` tragen ältere Fehlläufe aus der GUC-Zeit. Ihre jüngsten Läufe sind
grün — sie sind repariert, die Historie bleibt. Der Guard bewertet den letzten
Lauf, nicht die Fehlerquote.

# Runbook: Vault-Secrets für den Cron-Dispatch (Cron-Trio)

**Zielgruppe**: Betreiber (Zugriff auf den Supabase-SQL-Editor und Function Secrets
des Produktionsprojekts).
**Dauer**: wenige Minuten.
**Warum nicht automatisiert**: Dedizierte Cron-Keys gehören nicht in
Migrationen, Git-History oder CI (CLAUDE.md §4) — der Schritt bleibt beim
Menschen.

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
| `website-rescan-daily` | `email-auth-rescan` | `cron_website_rescan_key` | `CRON_WEBSITE_RESCAN_KEY` |

`verify_jwt = false` bleibt (Drift-Guard). Ohne passenden Cron-Bearer bleibt die
Function nicht öffentlich aufrufbar.

Git-Align: `20260912180000_cron_trio_dedicated_keys.sql` schreibt die vier
Job-Kommandos auf die `cron_*` Vault-Namen (Upsert per Jobname). Ältere
Migrationen (`20260820000000` …) bleiben historisch auf `service_role_key` —
nach Apply dieser Migration muss `cron.job.command` die `cron_*` Namen tragen.

---

## Historischer Befund (2026-09-06)

Gemessen am **2026-09-06** gegen das Live-Projekt `ebljyceifhnlzhjfyxup`
(`cron.job` verbunden mit `cron.job_run_details`):

| Job | Zeitplan | Fehlläufe | seit |
|---|---|---|---|
| `scan-scheduler-dispatch` | `*/15 * * * *` | 2403 | 2026-08-12 |
| `governance-monitoring-hourly` | `15 * * * *` | 601 | 2026-08-12 |
| `memory-decay-hourly` | `0 * * * *` | 600 | 2026-08-12 |
| `governance-monitoring-daily` | `0 2 * * *` | 25 | 2026-08-13 |

Damals scheiterten die Jobs am fehlenden Vault-Eintrag und/oder am Abgleich
gegen den Service-Role-Bearer. Live-Hotfixes nutzen bereits die `cron_*` Keys;
dieses Runbook und der Function-Code müssen denselben Vertrag halten, sonst
überschreibt der nächste Functions-Deploy die Hotfixes wieder mit 401s.

Ausgefallen war Zugesagtes: Scheduler/Drift-Monitoring,
Governance-Sentinel, Memory-Verfall (RFC-003).

## Behebung / Abgleich (Dominik — Dashboard)

Im SQL-Editor / Vault und unter Function Secrets des Produktionsprojekts.
Nur anlegen, wenn der Eintrag fehlt — bereits live gesetzte `cron_*` Keys
nicht überschreiben.

```sql
-- Nur anlegen, wenn der Eintrag fehlt. Werte nicht aus dem Repo übernehmen.
select vault.create_secret('<cron-key>', 'cron_scheduler_dispatch_key');
select vault.create_secret('<cron-key>', 'cron_governance_monitoring_key');
select vault.create_secret('<cron-key>', 'cron_memory_decay_key');
select vault.create_secret('<cron-key>', 'cron_website_rescan_key');
```

Dieselben Werte als Function Secrets setzen (Namen only):

| Vault (pg_cron) | Function Secret (Edge) |
|---|---|
| `cron_scheduler_dispatch_key` | `CRON_SCHEDULER_DISPATCH_KEY` |
| `cron_governance_monitoring_key` | `CRON_GOVERNANCE_MONITORING_KEY` |
| `cron_memory_decay_key` | `CRON_MEMORY_DECAY_KEY` |
| `cron_website_rescan_key` | `CRON_WEBSITE_RESCAN_KEY` |

`dispatch_cron_function` liest den Vault-Namen zur Laufzeit über
`public.get_app_secret(...)`. Die Edge Function liest das Function Secret.
Beide Seiten müssen denselben Wert sehen.

> ⚠️ Keinen Schlüssel in ein Issue, einen PR, eine Migration oder einen
> Chatverlauf kopieren. SQL-Editor und Function-Secrets-UI sind die einzigen
> Orte.

**Nicht** den kompromittierten `service_role` JWT als Inbound-Bearer für diese
Functions verwenden.

### `website-rescan-daily` → `email-auth-rescan` (neu, 2026-09-25)

Täglich 03:30 UTC SPF/DMARC/DKIM-Recheck mit Auto-Resolve. Reihenfolge nach
dem Merge: Vault-Eintrag + Function Secret (derselbe Zufallswert, s. o.) →
Migration `20260925210000_email_auth_rescan.sql` → Deploy-Workflow.
Fail-closed, nichts wird geschrieben: Vault fehlt → Lauf `failed` ohne
HTTP-Request; Secret fehlt → `500 CRON_KEY_MISSING`; Werte verschieden →
`401 cron only`. Probelauf ohne Writes: `POST` mit Cron-Bearer und Body
`{"trigger":"manual","dry_run":true}`.

## Prüfen, dass es gewirkt hat

Der nächste Lauf kommt binnen 15 Minuten (`scan-scheduler-dispatch`).

```sql
select j.jobname, d.status, d.start_time, left(coalesce(d.return_message,''), 120)
from cron.job j
join cron.job_run_details d on d.jobid = j.jobid
where j.jobname in (
  'scan-scheduler-dispatch','governance-monitoring-hourly',
  'memory-decay-hourly','governance-monitoring-daily','website-rescan-daily'
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

## Verwandter Punkt

`agent-os-runner-hourly`/`-daily` (`agent_os_runner_token`) tragen alte
Fehlläufe aus der GUC-Zeit; die jüngsten Läufe sind grün (der Guard bewertet
nur den letzten Lauf).

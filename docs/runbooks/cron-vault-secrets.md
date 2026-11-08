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
(fail-closed: leerer Key → `500 CRON_KEY_MISSING`, falscher Bearer →
`401 cron only`). `SUPABASE_SERVICE_ROLE_KEY` darf nach Auth noch
für PostgREST/Admin genutzt werden — nie als Inbound-Credential.

| pg_cron Job | Edge Function | Vault-Secret (pg_cron / `dispatch_cron_function`) | Function Secret (Edge) |
|---|---|---|---|
| `scan-scheduler-dispatch` | `scheduler-dispatch` | `cron_scheduler_dispatch_key` | `CRON_SCHEDULER_DISPATCH_KEY` |
| `governance-monitoring-hourly` / `-daily` | `governance-monitoring-scheduler` | `cron_governance_monitoring_key` | `CRON_GOVERNANCE_MONITORING_KEY` |
| `memory-decay-hourly` | `memory-decay-worker` | `cron_memory_decay_key` | `CRON_MEMORY_DECAY_KEY` |
| `website-rescan-daily` | `email-auth-rescan` | `cron_website_rescan_key` | `CRON_WEBSITE_RESCAN_KEY` |
| `audit-monitor-daily` | `audit-monitor-cron` | `cron_audit_monitor_key` | `CRON_AUDIT_MONITOR_KEY` |
| `bot-voice-enforcer` (jede Minute) | `bot-voice-enforcer` | `cron_bot_voice_enforcer_key` | `CRON_BOT_VOICE_ENFORCER_KEY` |
| `daily-digest` | `daily-digest` | `cron_daily_digest_key` | `CRON_DAILY_DIGEST_KEY` |
| `audit-recheck-daily` | `audit-recheck-weekly` | `cron_audit_recheck_key` | `CRON_AUDIT_RECHECK_KEY` |
| `audit-email-drip-daily` | `audit-drip-cron` | `cron_audit_drip_key` | `CRON_AUDIT_DRIP_KEY` |
| `sub-processor-notify-daily` | `sub-processor-notify` | `cron_sub_processor_notify_key` | `CRON_SUB_PROCESSOR_NOTIFY_KEY` |
| `governance-deadline-monitor-daily` | `governance-deadline-monitor` | `cron_governance_deadline_key` | `CRON_GOVERNANCE_DEADLINE_KEY` |
| `governance-score-calculator-hourly` | `governance-score-calculator` | `cron_governance_score_key` | `CRON_GOVERNANCE_SCORE_KEY` |

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
select vault.create_secret('<cron-key>', 'cron_audit_monitor_key');
```

Dieselben Werte als Function Secrets setzen (Namen only):

| Vault (pg_cron) | Function Secret (Edge) |
|---|---|
| `cron_scheduler_dispatch_key` | `CRON_SCHEDULER_DISPATCH_KEY` |
| `cron_governance_monitoring_key` | `CRON_GOVERNANCE_MONITORING_KEY` |
| `cron_memory_decay_key` | `CRON_MEMORY_DECAY_KEY` |
| `cron_website_rescan_key` | `CRON_WEBSITE_RESCAN_KEY` |
| `cron_audit_monitor_key` | `CRON_AUDIT_MONITOR_KEY` |
| `cron_bot_voice_enforcer_key` | `CRON_BOT_VOICE_ENFORCER_KEY` |
| `cron_daily_digest_key` | `CRON_DAILY_DIGEST_KEY` |
| `cron_audit_recheck_key` | `CRON_AUDIT_RECHECK_KEY` |
| `cron_audit_drip_key` | `CRON_AUDIT_DRIP_KEY` |
| `cron_sub_processor_notify_key` | `CRON_SUB_PROCESSOR_NOTIFY_KEY` |
| `cron_governance_deadline_key` | `CRON_GOVERNANCE_DEADLINE_KEY` |
| `cron_governance_score_key` | `CRON_GOVERNANCE_SCORE_KEY` |

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

### `audit-monitor-daily` → `audit-monitor-cron` (neu, 2026-10-09)

Täglich 04:00 UTC Re-Scan der `monitored_domains` (Kadenz je Plan: täglich mit
`monitoring.daily`, monatlich mit nur `monitoring.monthly`, sonst kein
Dauerbetrieb). Reihenfolge nach dem Merge: Vault-Eintrag `cron_audit_monitor_key`
+ Function Secret `CRON_AUDIT_MONITOR_KEY` (derselbe Zufallswert) → Migration
`20261009230000_audit_monitor_daily_cron.sql` → Deploy der Function.
Fail-closed: Vault fehlt → Lauf `failed` ohne HTTP-Request; Secret fehlt →
`500 CRON_KEY_MISSING`; Werte verschieden → `401 cron only`; Scan- oder
Evidence-Fehler → Antwort `ok:false` (HTTP 500), kein Alert. Drift-Mails nutzen
das vorhandene `RESEND_API_KEY`; fehlt es, steht `alert: not_configured` im Ergebnis.

### Restliche sechs Jobs (neu, 2026-11-08)

Befund 08.11.2026 (Live-Logs): Die sechs Jobs mit Vault `service_role_key` scheiterten
durchgehend mit `401` – kein Daily Digest, keine Audit-Nachprüfung, keine Drip-Mails,
keine Unterauftragsverarbeiter-Benachrichtigung, keine Fristen- und Score-Berechnung.
Die Jobs `governance-deadline-monitor-daily` und `governance-score-calculator-hourly`
existierten nur in der Produktions-DB; Migration
`20261108170000_cron_dedicated_keys_remaining.sql` holt alle sechs ins Repo.

Reihenfolge: 1. je Job einen neuen Zufallswert als Vault-Secret **und** gleichnamigen
Function Secret setzen (Tabelle oben) → 2. die sechs Functions deployen → 3. Migration
anwenden. Vor Schritt 3 bleibt alles im heutigen Zustand (401). Fail-closed: Vault fehlt →
Lauf `failed` ohne HTTP-Request; Secret fehlt → `500 CRON_KEY_MISSING`; Werte verschieden
→ `401 cron only`.

```sql
-- Nur anlegen, wenn der Eintrag fehlt. Werte nicht aus dem Repo übernehmen.
select vault.create_secret('<cron-key>', 'cron_daily_digest_key');
select vault.create_secret('<cron-key>', 'cron_audit_recheck_key');
select vault.create_secret('<cron-key>', 'cron_audit_drip_key');
select vault.create_secret('<cron-key>', 'cron_sub_processor_notify_key');
select vault.create_secret('<cron-key>', 'cron_governance_deadline_key');
select vault.create_secret('<cron-key>', 'cron_governance_score_key');
```

## Prüfen, dass es gewirkt hat

Der nächste Lauf kommt binnen 15 Minuten (`scan-scheduler-dispatch`).

```sql
select j.jobname, d.status, d.start_time, left(coalesce(d.return_message,''), 120)
from cron.job j
join cron.job_run_details d on d.jobid = j.jobid
where j.jobname in (
  'scan-scheduler-dispatch','governance-monitoring-hourly',
  'memory-decay-hourly','governance-monitoring-daily','website-rescan-daily',
  'audit-monitor-daily','daily-digest','audit-recheck-daily',
  'audit-email-drip-daily','sub-processor-notify-daily',
  'governance-deadline-monitor-daily','governance-score-calculator-hourly'
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

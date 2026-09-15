# Runbook: Vault-Secrets für den Cron-Dispatch

**Zielgruppe**: Betreiber (Supabase-SQL-Editor und Function Secrets der Produktion).
**Warum nicht automatisiert**: Die Werte sind Cron-Keys. Sie gehören nicht in eine
Migration, nicht in die Git-History, nicht in CI — CLAUDE.md §4 verbietet es.

---

## Vertrag

Die Cron-Empfänger prüfen **nicht** den `service_role` JWT. Sie vergleichen den
inbound `Authorization: Bearer …` gegen ein dediziertes Function Secret
(fail-closed: leerer Key → 401). `SUPABASE_SERVICE_ROLE_KEY` darf nach der Auth
für PostgREST/Admin dienen — nie als Inbound-Credential.

| pg_cron Job | Edge Function | Vault-Secret | Function Secret |
|---|---|---|---|
| `scan-scheduler-dispatch` | `scheduler-dispatch` | `cron_scheduler_dispatch_key` | `CRON_SCHEDULER_DISPATCH_KEY` |
| `governance-monitoring-hourly` / `-daily` | `governance-monitoring-scheduler` | `cron_governance_monitoring_key` | `CRON_GOVERNANCE_MONITORING_KEY` |
| `memory-decay-hourly` | `memory-decay-worker` | `cron_memory_decay_key` | `CRON_MEMORY_DECAY_KEY` |
| `audit-recheck-daily` | `audit-recheck-weekly` | `cron_audit_recheck_key` | `CRON_AUDIT_RECHECK_KEY` |
| `daily-digest` | `daily-digest` | `cron_daily_digest_key` | `CRON_DAILY_DIGEST_KEY` |
| `sub-processor-notify-daily` | `sub-processor-notify` | `cron_sub_processor_notify_key` | `CRON_SUB_PROCESSOR_NOTIFY_KEY` |
| `audit-email-drip-daily` | `audit-drip-cron` | `cron_audit_drip_key` | `CRON_AUDIT_DRIP_KEY` |

`verify_jwt = false` bleibt (Drift-Guard). Ohne passenden Cron-Bearer ist die
Function trotzdem nicht öffentlich aufrufbar.

Git-Align: `20260912180000` schreibt die Trio-Jobs auf `cron_*`,
`20260915110500` die vier übrigen. **Danach reicht kein Cron-Pfad mehr
`service_role_key` weiter.** Ältere Migrationen bleiben historisch darauf;
nach dem Apply muss `cron.job.command` die `cron_*` Namen tragen.

---

## Gemessener Stand (2026-09-15, 05:00–10:45 UTC)

Gegen die Live-DB, je Job über seine Kadenz zugeordnet: **neun von elf
Dispatch-Jobs antworten mit HTTP 401**. Grün ist allein `agent-os-runner`, mit
einem Secret, das älter ist als die Rotation. Zwei Ursachen:

1. **Trio** — die `cron_*` Vault-Secrets existieren seit 2026-09-10, die
   Job-Kommandos zeigen darauf, die **Function Secrets** fehlen. Es fehlt genau
   der Betreiberschritt unten, sonst nichts.
2. **Die vier übrigen** — bis `20260915110500` auf `service_role_key`; auch
   dieser Wert wird nicht akzeptiert. Der Zwischenzustand aus `20260912180000`
   hat nie getragen.

**Warum das fünf Tage unbemerkt blieb**, und das ist der eigentliche Befund:
`cron.job_run_details` meldet `succeeded` / `1 row` — das bezeugt nur, dass
`net.http_post` die Anfrage eingereiht hat. Die 401 steht ausschließlich in
`net._http_response`, und die Tabelle hält nur rund sechs Stunden vor. Wer an
der Job-Ebene misst, sieht einen grünen Cron über einer toten Funktionskette.

## Was währenddessen nicht passiert

Kein Nebenläufiges, sondern zugesagte Funktion: **`scheduler-dispatch`** (ab
Growth verkauft), **`governance-monitoring-scheduler`** (Sentinel-Schleife),
**`memory-decay-worker`** (RFC-003 — ohne ihn verfällt kein Memory), dazu
Audit-Recheck, Drip-Mails, Digest und die Sub-Processor-Notice (Art. 28 DSGVO).

## Behebung (Dominik — Dashboard)

Im SQL-Editor/Vault und unter Function Secrets der Produktion. Nur anlegen, wenn
der Eintrag fehlt — bereits gesetzte `cron_*` Keys nicht überschreiben.

```sql
-- Werte nicht aus dem Repo übernehmen; je Zeile ein eigener Zufallswert.
select vault.create_secret('<cron-key>', 'cron_scheduler_dispatch_key');
select vault.create_secret('<cron-key>', 'cron_governance_monitoring_key');
select vault.create_secret('<cron-key>', 'cron_memory_decay_key');
select vault.create_secret('<cron-key>', 'cron_audit_recheck_key');
select vault.create_secret('<cron-key>', 'cron_daily_digest_key');
select vault.create_secret('<cron-key>', 'cron_sub_processor_notify_key');
select vault.create_secret('<cron-key>', 'cron_audit_drip_key');
```

Danach **denselben Wert** als Function Secret setzen (Namenspaare in der
Vertragstabelle oben). `dispatch_cron_function` liest den Vault-Namen über
`public.get_app_secret(...)`, die Function ihr Secret — beide müssen denselben
Wert sehen.

> ⚠️ Keinen Schlüssel in ein Issue, einen PR, eine Migration oder einen
> Chatverlauf kopieren. SQL-Editor und Function-Secrets-UI sind die einzigen Orte.

## Prüfen, dass es gewirkt hat

Der nächste Lauf kommt binnen 15 Minuten (`scan-scheduler-dispatch`).

**Die Job-Ebene allein beweist nichts** — sie meldet `succeeded`, sobald die
Anfrage eingereiht ist, auch wenn die Function sie abweist. Maßgeblich ist die
Antwort:

```sql
-- net._http_response haelt nur rund sechs Stunden vor.
select status_code, count(*) as n, min(created) as von, max(created) as bis,
       left((array_agg(content order by created desc))[1], 120) as letzte_antwort
from net._http_response
where created >= now() - interval '6 hours'
group by status_code order by status_code;
```

Erwartung: **keine einzige 401.** Jede 401 ist ein Job, dessen Secret-Paar nicht
zusammenpasst. Ergänzend `cron.job_run_details` lesen — ein fehlendes
Vault-Secret meldet sich dort, nicht in der Antwort.

## Wer meldet das künftig

`Cron Health Guard` (`.github/workflows/cron-health.yml`, täglich 06:45 UTC)
prüft den **letzten** Lauf je aktivem Job; `drift-alert.yml` hält daraus ein
Issue offen und schließt es selbst wieder.

> ⚠️ **Der Guard beobachtet die falsche Ebene.** Er liest
> `cron.job_run_details.status` — und der stand während des ganzen Ausfalls vom
> 2026-09-10 bis 2026-09-15 auf `succeeded`. Ein Guard, der die HTTP-Antwort
> nicht ansieht, kann diesen Fehler nicht finden. Die Erweiterung ist ein
> eigener Schritt und noch nicht gebaut.

## Verwandter, noch offener Punkt

`agent-os-runner-hourly` / `-daily` tragen ältere Fehlläufe aus der GUC-Zeit.
Ihre jüngsten Läufe sind grün — repariert, die Historie bleibt. Der Guard
bewertet den letzten Lauf, nicht die Fehlerquote.

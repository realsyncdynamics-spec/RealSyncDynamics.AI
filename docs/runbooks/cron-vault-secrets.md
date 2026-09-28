# Runbook: Vault-Secrets für den Cron-Dispatch

**Zielgruppe**: Betreiber (Supabase-SQL-Editor und Function Secrets der Produktion).
**Warum nicht automatisiert**: Cron-Keys gehören nicht in Migration, Git-History
oder CI (CLAUDE.md §4).

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
| `website-rescan-daily` | `email-auth-rescan` | `cron_website_rescan_key` | `CRON_WEBSITE_RESCAN_KEY` |

`verify_jwt = false` bleibt (Drift-Guard). Ohne passenden Cron-Bearer ist die
Function trotzdem nicht öffentlich aufrufbar.

Git-Align: `20260912180000` schreibt die Trio-Jobs auf `cron_*`,
`20260928120500` die vier übrigen; `20260925210000` plant `website-rescan-daily`
direkt auf `cron_website_rescan_key`. **Danach reicht kein Cron-Pfad mehr
`service_role_key` weiter.** Nach dem Apply muss `cron.job.command` die
`cron_*` Namen tragen.

---

## Gemessener Stand (2026-09-15, 05:00–10:45 UTC)

Gegen die Live-DB, je Job über seine Kadenz zugeordnet: **neun von elf
Dispatch-Jobs antworten mit HTTP 401**. Grün ist allein `agent-os-runner`, mit
einem Secret, das älter ist als die Rotation. Zwei Ursachen:

1. **Trio** — die `cron_*` Vault-Secrets existieren seit 2026-09-10, die
   Job-Kommandos zeigen darauf, die **Function Secrets** fehlen (Betreiberschritt
   unten).
2. **Die vier übrigen** — bis `20260928120500` auf `service_role_key`; auch
   dieser Wert wird nicht akzeptiert. Der Zwischenzustand aus `20260912180000`
   hat nie getragen.

**Warum das fünf Tage unbemerkt blieb**, und das ist der eigentliche Befund:
`cron.job_run_details` meldet `succeeded` / `1 row` — das bezeugt nur, dass
`net.http_post` die Anfrage eingereiht hat. Die 401 steht ausschließlich in
`net._http_response`, und die Tabelle hält nur rund sechs Stunden vor. Wer an
der Job-Ebene misst, sieht einen grünen Cron über einer toten Funktionskette.

Ausgefallen war Zugesagtes: Scheduler (ab Growth verkauft), Governance-Sentinel,
Memory-Verfall (RFC-003), Audit-Recheck, Drip-Mails, Digest, Sub-Processor-Notice
(Art. 28 DSGVO).

## Behebung / Abgleich (Dominik — Dashboard)

Im SQL-Editor / Vault und unter Function Secrets der Produktion. Nur anlegen,
wenn der Eintrag fehlt — live gesetzte `cron_*` Keys nicht überschreiben.

```sql
-- Werte nicht aus dem Repo übernehmen; je Zeile ein eigener Zufallswert.
select vault.create_secret('<cron-key>', 'cron_scheduler_dispatch_key');
select vault.create_secret('<cron-key>', 'cron_governance_monitoring_key');
select vault.create_secret('<cron-key>', 'cron_memory_decay_key');
select vault.create_secret('<cron-key>', 'cron_audit_recheck_key');
select vault.create_secret('<cron-key>', 'cron_daily_digest_key');
select vault.create_secret('<cron-key>', 'cron_sub_processor_notify_key');
select vault.create_secret('<cron-key>', 'cron_audit_drip_key');
select vault.create_secret('<cron-key>', 'cron_website_rescan_key');
```

Danach **denselben Wert** als Function Secret setzen (Namenspaare in der
Vertragstabelle oben). `dispatch_cron_function` liest den Vault-Namen über
`public.get_app_secret(...)`, die Function ihr Secret — beide müssen denselben
Wert sehen.

> ⚠️ Keinen Schlüssel in ein Issue, einen PR, eine Migration oder einen
> Chatverlauf kopieren. SQL-Editor und Function-Secrets-UI sind die einzigen Orte.

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
zusammenpasst. Ein fehlendes Vault-Secret meldet sich dagegen in
`cron.job_run_details`, nicht in der Antwort.

## Wer meldet das künftig

`Cron Health Guard` (`.github/workflows/cron-health.yml`, täglich 06:45 UTC)
prüft den **letzten** Lauf je aktivem Job; `drift-alert.yml` hält daraus ein
Issue offen und schließt es selbst wieder.

> ⚠️ **Der Guard beobachtet die falsche Ebene.** Er liest
> `cron.job_run_details.status` — der stand während des ganzen Ausfalls
> (2026-09-10 bis -15) auf `succeeded`. Ohne Blick auf die HTTP-Antwort kann er
> diesen Fehler nicht finden. Die Erweiterung ist ein eigener Schritt und noch
> nicht gebaut.

## Verwandter Punkt

`agent-os-runner-hourly`/`-daily` (`agent_os_runner_token`) tragen alte
Fehlläufe aus der GUC-Zeit; die jüngsten Läufe sind grün (der Guard bewertet
nur den letzten Lauf).

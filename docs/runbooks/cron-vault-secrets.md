# Runbook: fehlende Vault-Secrets für den Cron-Dispatch

**Zielgruppe**: Betreiber (Zugriff auf den Supabase-SQL-Editor des
Produktionsprojekts).
**Dauer**: wenige Minuten.
**Warum nicht automatisiert**: Der Wert ist der Service-Role-Schlüssel. Er
gehört nicht in eine Migration, nicht in die Git-History und nicht in eine
CI-Umgebung — das schreibt `20260820000000_cron_dispatch_fix.sql` selbst so
fest, und CLAUDE.md §4 verbietet es ausdrücklich. Dieser Schritt bleibt
deshalb beim Menschen.

---

## Befund

Gemessen am **2026-09-06** gegen das Live-Projekt `ebljyceifhnlzhjfyxup`
(`cron.job` verbunden mit `cron.job_run_details`):

| Job | Zeitplan | ruft auf | Fehlläufe | seit |
|---|---|---|---|---|
| `scan-scheduler-dispatch` | `*/15 * * * *` | `scheduler-dispatch` | 2403 | 2026-08-12 |
| `governance-monitoring-hourly` | `15 * * * *` | `governance-monitoring-scheduler` | 601 | 2026-08-12 |
| `memory-decay-hourly` | `0 * * * *` | `memory-decay-worker` | 600 | 2026-08-12 |
| `governance-monitoring-daily` | `0 2 * * *` | `governance-monitoring-scheduler` | 25 | 2026-08-13 |

**3629 Fehlläufe, eine Ursache.** Alle vier melden wortgleich:

```
ERROR: Cron-Dispatch "<function>" abgebrochen: Vault-Secret "service_role_key"
fehlt. Anlegen mit: SELECT vault.create_secret('<wert>', 'service_role_key');
```

Der Vault trägt heute sieben Secrets — `market_scanner_token`,
`business_metrics_shared_secret`, `governance_erasure_sweeper_token`,
`stripe_meter_shared_secret`, `stripe_secret_key`, `stripe_webhook_secret`,
`agent_os_runner_token` — und `service_role_key` ist nicht darunter.

Der Dispatch selbst ist in Ordnung. `20260820000000_cron_dispatch_fix.sql` hat
den älteren GUC-Fehler (`unrecognized configuration parameter
"app.supabase_url"`) behoben; die Jobs mit eigenem Token laufen seither sauber
(`dsr-erasure-sweep`, `agent-os-runner-*`, `business-metrics-cron-15min`,
`market-scanner-daily` und weitere). Es fehlt genau ein Wert.

## Was währenddessen nicht passiert

Das ist kein Nebenläufiges, sondern zugesagte Funktion:

- **`scheduler-dispatch`** — der Scheduler wird ab Growth verkauft
  („Tägliches Monitoring mit Drift Detection", „Scheduler für geplante Läufe
  mit Slack-/Teams-/Webhook-Alerts"). Er hat **noch nie** einen erfolgreichen
  Lauf gehabt.
- **`governance-monitoring-scheduler`** — die Sentinel-Schleife der Governance
  Runtime (CLAUDE.md §5, Modul bei 85 %) samt SLO-Tracking und
  Incident-Dispatch.
- **`memory-decay-worker`** — der temporale Verfall aus RFC-003. Ohne ihn
  verfällt kein Memory. Heute ohne Schaden, weil `governance_memory` leer ist;
  die Zusage steht trotzdem ungedeckt.

## Behebung

Im SQL-Editor des Produktionsprojekts, **einmal**:

```sql
select vault.create_secret('<service-role-key>', 'service_role_key');
```

Den Wert findet man unter *Project Settings → API → service_role*. Er wird
nirgends sonst hinterlegt: `dispatch_cron_function` liest ihn zur Laufzeit
über `public.get_app_secret('service_role_key')`.

> ⚠️ Den Schlüssel nicht in ein Issue, einen PR, eine Migration oder einen
> Chatverlauf kopieren. Der SQL-Editor ist der einzige Ort, an dem er
> auftauchen darf.

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

**Nicht an `cron.job` prüfen, sondern an `cron.job_run_details.status`.** Alle
vier Jobs standen die ganze Zeit als `active = true` in `cron.job` — registriert
und aktiv, und trotzdem wirkungslos. Genau daran ist die frühere Fassung von
CLAUDE.md §5 vorbeigegangen.

## Wer meldet das künftig

`Cron Health Guard` (`.github/workflows/cron-health.yml`, täglich 06:45 UTC)
prüft, ob ein aktiver Job in seinem **letzten** Lauf gescheitert ist, und
gruppiert die Ausfälle nach ihrer Meldung. `drift-alert.yml` hält daraus genau
ein Issue offen und schließt es selbst, sobald der Guard wieder grün läuft.

Der Guard hat bewusst **keine** Ausnahmeliste: Ein bekannter Ausfall, der den
Guard grün lässt, ist wieder ein Befund, den niemand sieht. Solange das Secret
fehlt, bleibt das Issue offen — das ist die Absicht, nicht ein Mangel.

## Verwandter, noch offener Punkt

`agent_os_runner_token` liegt im Vault, aber `agent-os-runner-hourly` und
`-daily` tragen ältere Fehlläufe aus der GUC-Zeit (`null value in column "url"`).
Ihre jüngsten Läufe sind grün — sie sind repariert, die Historie bleibt. Der
Guard bewertet deshalb den letzten Lauf, nicht die Fehlerquote.

# Runtime-Beobachtungen zu Edge Functions

> **Snapshot:** 2026-11-08 · Projekt `RealSyncDynamicsLive` · Read-only-Abgleich.  
> Dieses Dokument ergänzt das statische [Edge-Function-Inventar](./EDGE_FUNCTIONS_INVENTORY.md); es ist kein automatischer Healthcheck.

## Produktions-Cron-Jobs mit 401

Der Produktionsabgleich ergab diese beiden aktiven pg_cron-Einträge:

| Job-ID | Jobname | Function | Schedule | Beobachteter Aufrufstatus |
|---:|---|---|---|---|
| 45 | `governance-deadline-monitor-daily` | `governance-deadline-monitor` | `0 2 * * *` | 401 am 2026-11-08 |
| 46 | `governance-score-calculator-hourly` | `governance-score-calculator` | `15 * * * *` | 23 von 23 protokollierten Aufrufen mit 401 |

Beide Jobs rufen `dispatch_cron_function(…, 'service_role_key')` über `pg_net` auf. Der Status belegt eine konfigurierte Laufzeit-Auslösung, aber **keine erfolgreiche Ausführung**. Die 401-Antworten sind ein Betriebsfehler und müssen separat behoben werden.

## Bedeutung für das statische Inventar

`governance-deadline-monitor` und `governance-score-calculator` stehen in der #16-Kandidatenliste, weil der Generator nach internen Referenzen im Repository scannt. Die produktiven Cron-Einträge werden außerhalb der vom Generator gescannten Migrationen verwaltet. Daher bedeutet `DEPLOYT-OHNE-CALLER` dort ausschließlich **„kein interner Caller/Trigger im gescannten Repo gefunden“**; es bedeutet weder „kein Laufzeit-Trigger“ noch „ungenutzt“ oder „löschbar“.

Die Beobachtung ist ein zeitgebundener Snapshot. Vor Deaktivierung oder Deprecation müssen die produktiven Cron-Konfigurationen und Logs erneut geprüft werden. Diese Dokumentation ändert weder Cron-Jobs noch Secrets oder Produktionskonfiguration.

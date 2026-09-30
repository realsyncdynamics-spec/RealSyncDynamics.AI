# Browser-Ausführungen: Reservierungen prüfen

Freigabepflichtige Browser-Aktionen (`click`, `type`, `select`) verbrauchen
ihre Freigabe genau einmal. `browser-execute` reserviert sie über
`reserve_browser_execution()` **vor** dem Executor-Aufruf in
`public.browser_executions`
(Migration `20260930190000_browser_execution_reservations.sql`, PR #1728).

| Status | Bedeutung | Handlung |
|---|---|---|
| `reserved` | Reserviert, Executor läuft oder die Function brach vorher ab | nach 5 Minuten: prüfen (siehe unten) |
| `executed` | Aktion gelaufen, Event und Evidence geschrieben | keine |
| `executed_unrecorded` | Aktion gelaufen, **Prüfpfad unvollständig** | manuell prüfen und nachdokumentieren |
| `executor_failed` | Executor-Fehler oder Timeout. Ob der Browser schon teilweise gehandelt hat, ist nicht feststellbar | Zielsystem prüfen, bei Bedarf neue Freigabe |

**Keiner dieser Status gibt die Freigabe wieder frei**, auch nicht manuell.
Ein neuer Versuch braucht immer eine neue Freigabe.

## Stehengebliebene und ungeklärte Ausführungen

Mit Service-Role (SQL-Editor):

```sql
SELECT e.id, e.tenant_id, e.approval_id, e.status, e.detail,
       e.reserved_at, e.finished_at,
       now() - e.reserved_at AS age
  FROM public.browser_executions e
 WHERE (e.status = 'reserved' AND e.reserved_at < now() - interval '5 minutes')
    OR e.status IN ('executed_unrecorded', 'executor_failed')
 ORDER BY e.reserved_at DESC;
```

Das Executor-Timeout liegt bei 90 Sekunden. Ein Eintrag, der nach 5 Minuten
noch `reserved` ist, heißt deshalb: Die Function ist zwischen Reservierung und
Abschluss abgebrochen. Ob die Aktion gelaufen ist, zeigt das Zielsystem oder
ein `governance_events`-Eintrag `browser.action.executed` mit
`payload->>'browser_execution_id' = e.id::text`.

## Deploy-Reihenfolge

Zuerst die Migration, dann `browser-execute`. In umgekehrter Reihenfolge
scheitert jede Reservierung (`503 RESERVATION_UNAVAILABLE`). Dann läuft keine
freigabepflichtige Aktion, aber es wird auch nichts doppelt ausgeführt.

# Phase 3 P0 — DSGVO-Bridge: DSR-Evidence und Löschaufträge absichern

Stand: 2026-11-20 · **Entwurf / KEINE Migration** · Ausgangsbasis: main, governance-dsr/index.ts

## Reproduzierbarer Befund

- `handleCreate`, `handleUpdate`, `handleAssign` und `handleClose` schreiben den DSR-Datensatz **vor** `audit()` und `emitEvidence()`.
- `audit()` gibt bei Schreibfehler `{ ok:false }` zurück; die mutierenden Handler werten dies derzeit nicht aus.
- `emitEvidence()` fängt Fehler und schreibt lediglich stderr. Der API-Erfolg kann daher trotz fehlendem `runtime_events`-Eintrag gemeldet werden.
- `ensureSubjectRef()`, `upsertMapping()` und `enqueueErasure()` sind ebenfalls best-effort. Erasure-Intake kann erfolgreich sein, obwohl die Löschung nicht zur Bearbeitung markiert wurde.
- Dashboard-/API-Beschriftung darf deshalb nicht behaupten, jeder abgeschlossene DSR sei revisionssicher belegt.

## Entscheidung: transaktionale Outbox statt nachträglicher Fire-and-forget-Logs

Der Eingang einer Betroffenenanfrage darf bei Ausfall eines nachgelagerten Evidence-Dienstes nicht verloren gehen. Der **dauerhafte Nachweisauftrag** darf aber auch nicht fehlen.

1. Postgres-Migration erzeugt `governance_event_outbox` mit `id`, `tenant_id`, `aggregate_type`, `aggregate_id`, `event_type`, `operation_id`, `payload`, `state` (`pending|processing|sent|failed`), `attempt_count`, `next_attempt_at`, `last_error`, `created_at`, `delivered_at`. Das Payload enthält keine unkontrollierten Klartext-PII.
2. Ein serverseitiger RPC/DB-Schreibpfad schreibt **DSR-Änderung und Outbox-Event in derselben DB-Transaktion**. Gleiches gilt für den notwendigen Subject-/Erasure-Status. Wenn der Transaktionsschritt fehlschlägt, wird die DSR-Mutation nicht als Erfolg quittiert.
3. `operation_id` wird vor Ausführung vom autorisierten Backend gebildet oder sicher gegen Replay validiert. Unique Constraint für `(tenant_id, operation_id, event_type)` verhindert doppelte Outbox-Events bei Retries.
4. RLS/Grants: Outbox niemals direkt für normale Nutzer schreibbar; `SECURITY DEFINER`-RPCs haben minimales `search_path`, `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` soweit nur die vertrauenswürdige Edge Function aufruft. Tenant- und Rollenprüfung findet **vor** jedem Service-Role-Schreibpfad statt.
5. Ein dedizierter Worker holt fällige Aufträge mit `FOR UPDATE SKIP LOCKED` und Lease, schreibt `runtime_events`/Audit **idempotent**, bestätigt erst nach erfolgreichem Commit mit `sent`. Hash-Ketten sind je Tenant seriell zu appendieren.
6. Retriable Fehler: begrenztes Exponential-Backoff und Alerting. Nach maximalen Versuchen `failed` plus operativer Requeue-Prozess; niemals still löschen oder still als erledigt markieren.
7. Fehlt die `subject_ref`, bleibt die DSR-Annahme möglich, aber ein **atomar gespeicherter** `subject_link_pending`-Auftrag muss die Verknüpfung nachholen. Eine Erasure-Anfrage erhält keinen Zustand `completed`, solange verpflichtende Lösch-/Retention-Prüfungen und Evidenznachweise fehlen.
8. `GET`/Dashboard zeigt getrennt `dsr_status` und `evidence_status`: `pending|delivered|failed` (keine fiktive Erfolgsmeldung). Behördenmeldung bleibt genehmigungsgebunden.

## Testmatrix vor Migration/Deployment

| Test | Muss gelten |
| --- | --- |
| 401 ungültiger JWT | Keine Mutation, kein Outbox-Eintrag |
| 403 fremder Tenant / fehlende Writer-Rolle | Keine Mutation, keine Daten-/Metadatenoffenlegung |
| DSR-Annahme gültig | Genau ein DSR + ein persistenter Nachweisauftrag in einer Transaktion |
| Transaktionsabbruch beim Outbox-Insert | Kein als erfolgreich bestätigter DSR-Write |
| runtime_events-Insert fällt aus | DSR bleibt angenommen, Outbox bleibt pending/failed und wird alarmiert |
| Worker wiederholt gleichen Auftrag | Ein Evidence-Event, keine doppelte Side-Effect-Verarbeitung |
| Zwei Worker übernehmen zugleich | Exakt eine aktive Lease / keine doppelte Hash-Chain-Erweiterung |
| subject_ref-HMAC/Vault temporär unzugänglich | Verbindlicher pending-link-Auftrag, kein erfundener Erasure-Erfolg |
| Partition für runtime_events fehlt | Sichtbarer Retry-/Alert-Pfad, kein nachweisloser Abschluss |
| 30-Tage-Retention/Legal Hold | Keine automatische Löschung vor Freigabe der gesetzlichen Voraussetzungen |
| Export Art. 15 auf Tenant B | Zugriff verweigert, auch über Row-ID oder subject_ref |
| Worker-/Service-Role-Secrets fehlen | Fail-closed, keine öffentliche Worker-Ausführung |

## Freigabevoraussetzungen

- DB-Migration, RPC-Berechtigungen, Tenant-RLS, idempotenter Worker und Alarmierung jeweils per Diff geprüft.
- Positive und negative Integrationstests auf isolierter PostgreSQL/Supabase-Umgebung grün; Hash-Chain und Retries zusätzlich unter Konkurrenzlast geprüft.
- Historische DSR-Datensätze auf fehlende Evidence-/Subject-Mappings inventarisiert und nachvollziehbar repariert.
- Kein automatischer produktiver Deploy oder Datenmigration ohne gesonderte Abnahme.

**Abgrenzung:** Dieses Dokument ist ein technischer Implementierungsvertrag; die Outbox ist damit **nicht implementiert oder abgenommen**. Rechtliche Prüfungen zu Lösch- und Aufbewahrungspflichten bleiben erforderlich.

## Weitere Phase-3-Restpunkte

- `automation-trigger` prüft monatliche Runs vor dem Start; die eigentliche Reservierung ist weiterhin **nicht atomar**. Eine transaktionale DB-Reservierung ist für strikte Quota-Isolation erforderlich.
- `automation-callback` schreibt `recordUsage()` nur bei Erfolg und behandelt einen Zählfehler best-effort. Idempotenter Abschluss und Usage-Accounting sind in derselben Transaktion abzusichern.
- `governance-dpias` lässt `status: approved` im generischen Update-Pfad zu; Freigaben erfordern getrennten, nicht umgehbaren Approval-Vertrag.

# RealSync Phase 3 — DSR Evidence Outbox: Rollout- und Abnahmevertrag

Stand 20.11.2026 · **Draft / Nicht produktiv freigegeben**

## Enthalten

- SQL-Migration `20261120040000_dsr_evidence_outbox.sql`.
- DSR-Trigger schreibt einen **dauerhaften Outbox-Eintrag und einen minimalen Admin-Audit-Eintrag in derselben Transaktion** wie den DSR-Datensatz.
- `dsr_outbox_drain(25)` verarbeitet `pending/failed` mit `FOR UPDATE SKIP LOCKED`; Event-Anlage in `runtime_events` und `delivered`-Markierung sind atomar, inklusive Wiederanlauf nach verlorener HTTP-Antwort.
- Cron-gesicherte Edge Function `governance-dsr-outbox` (keine Nutzer-JWTs und kein service_role JWT als eingehende Authentifizierung).
- `governance-dsr` prüft vor allen vier Mutationen `dsr_outbox_ready` und erzeugt DSR-Lifecycle-Events **nicht mehr selbst**. Bei fehlender Migration: HTTP 503 statt nachweislosem Erfolg.
- Der bestehende Admin-Audit-Aufruf der Edge Function bleibt für persönliche Akteursangaben zunächst erhalten; der SQL-Trigger liefert zusätzlich einen minimalen, atomaren System-Audit-Eintrag.

## Was noch offen ist

**Diese PR ist nicht die vollständige DSGVO-Abnahme.**

1. *Betroffenen-Identität und Löschauftrag*: `ensureSubjectRef`, `upsertMapping` und `enqueueErasure` sind weiterhin best-effort und nicht in derselben DSR-Transaktion. Ein erfolgreicher DSR-Eingang ist daher kein Nachweis einer erfolgreich vorgemerkten Löschung. Dafür ist ein separater persistenter Link-/Erasure-Auftrag erforderlich.
2. *Akteursbezug*: Der Edge-Handler schreibt mit service_role, daher ist `auth.uid()` im SQL-Trigger nicht automatisch der handelnde Nutzer. Der atomare System-Audit hat dann `actor_user_id=NULL`; der bisherige nachgelagerte Akteurs-Audit bleibt best-effort. Vollständig atomare „wer hat was geändert“-Attribution erfordert einen autorisierten Mutation-RPC oder gleichwertige vertrauenswürdige Sitzungsübergabe.
3. *Historische Nachweise*: vor Ausrollen fehlende `runtime_events` und `subject_ref_mappings` inventarisieren; keine synthetischen historischen Ereignisse vortäuschen.
4. *Abschlussstatus*: eine DSR-Abschlussanzeige darf erst als vollständig revisionssicher gelten, wenn alle verpflichtenden Nachweise vorliegen und der Outbox-Status `delivered` ist.
5. *Echte PostgreSQL-Abnahme*: Sieben Integrationsprüfungen im neuen Testfile; bis deren Lauf nachgewiesen ist, bleiben sämtliche Prüfungen **offen**.
6. *Worker-Cadence und Alarmierung*: Nach Freigabe Cron-Health- und Outbox-Rückstand überwachen. HTTP-503 vom Worker zeigt fehlgeschlagene oder dauerhaft erschöpfte Aufträge an.

## Isolierter DB-Test

Voraussetzung: lokale PostgreSQL-Testumgebung, `psql`, bestehender Bootstrap aus
`scripts/test-db/up.sh`. **Nie ein produktives DB-Ziel angeben.**

```bash
TEST_DB_URL="$(bash scripts/test-db/dsr-outbox-up.sh)" \
  npx vitest run test/runtime/db/dsr-evidence-outbox.db.test.ts
npx vitest run test/edge/governance-dsr-outbox-contract.test.ts
```

Prüfe anhand des Vitest-Berichts, dass sieben Tests ausgeführt (nicht übersprungen)
und erfolgreich sind. Ohne `TEST_DB_URL` sind die DB-Tests ausdrücklich skipped.

## Operator-Runbook (nicht automatisch ausführen)

1. Review der Migration inkl. Constraint, RLS, SECURITY DEFINER, Grants und Zugriff über `service_role`; anschließend isolated DB-Test.
2. **DSR-Schreibvorgänge und den Erasure-Sweeper während des kurzen Cutovers pausieren.** Die bisherige Edge-Version schreibt Lifecycle-Evidence noch direkt; gleichzeitige Verarbeitung durch den neuen Outbox-Trigger kann sonst doppelte Ereignisse erzeugen. Gesondert autorisierte Staging-Migration aufspielen. Den Trigger und `dsr_outbox_ready() = true` mit Service-Role prüfen, bevor die geänderte `governance-dsr` Edge Function deployt wird.
3. Staging-Edge-Functions `governance-dsr` und `governance-dsr-outbox` deployen; Negativtests `401`, `403`, Cross-Tenant und Partition-Ausfall durchführen.
4. Dedizierten Zufalls-Cron-Key als Vault-Secret `cron_dsr_outbox_key` anlegen und optional denselben Wert als Function Secret `CRON_DSR_OUTBOX_KEY` setzen. **Werte niemals im Repository, PR oder Chat speichern.**
5. Erst nach erfolgreicher Staging-Abnahme und separater Produktionsfreigabe darf ein Cron-Job aktiviert werden:

```sql
-- Nur bei ausdrücklicher Produktionsfreigabe ausführen.
SELECT cron.schedule(
  'dsr-evidence-outbox-minute',
  '* * * * *',
  $cron$ SELECT public.dispatch_cron_function(
    'governance-dsr-outbox',
    'cron_dsr_outbox_key'
  ) $cron$
);
```

6. Per `cron_dispatch_requests` und `net._http_response` tatsächliche HTTP-Antwort verifizieren. Der reine `pg_cron`-Status `succeeded` ist noch kein Nachweis für erfolgreiche Event-Auslieferung. Rückstand und `exhausted` aktiv überwachen.
7. Abschließend echte Hash-Chain-Verifikation pro Tenant und Abgleich `dsr_evidence_outbox` → `runtime_events.payload.outbox_id`; Produktionsfreigabe erst nach positiver Evidenz.

## Sicherheitsregeln

- Kein Merge in `main`, keine Migration in Produktiv-Supabase und keine automatische Bereitstellung von Secrets.
- Der DSR-Eingang ist auch dann nachweisbar, wenn `runtime_events` temporär nicht erreichbar ist; der Outbox-Eintrag bleibt persistent, mit Retry/Fehlerzustand.
- Derzeit wird bei Fehlern der **Outbox-Tabelle selbst** die DSR-Schreiboperation abgebrochen. Dies verhindert nachweislose Bestätigungen; gesetzliche Fristen und Notfallannahme müssen organisatorisch abgesichert werden.
- Kein automatischer Behördenversand. Datenschutzpflichten und Aufbewahrungsfragen gesondert juristisch prüfen.

Quellen: `supabase/functions/governance-dsr/index.ts`,
`supabase/functions/governance-erasure-sweeper/index.ts`,
`supabase/migrations/20260602100000_runtime_events_backbone.sql`.

---
title: SF-003 – Persistenzarchitektur, Recovery und transaktionale Sicherheitsgrenzen
owner: Plattform-Betrieb
reviewed: 2026-11-20
status: entwurf
---

# SF-003 – Dauerhafte Aufträge und Recovery: technischer Entwurf

**Status 20.11.2026:** lesender Recovery-Inspector und Testfälle auf isoliertem Entwicklungsbranch. **Keine neue Migration**, keine produktive Tabelle/Funktion, kein Supabase-Write, kein GitHub-Workflow-Dispatch, kein automatischer Worker.

Verweise: [SF-001](software-factory-sf001.md), [SF-002](software-factory-sf002.md), `packages/ai-os-core/src/factory-recovery.ts`.

## 1. Jetzt implementiert

`inspectFactoryRecovery({ job, lease, undeliveredOutboxCount, observedAt })` wertet einen bereits geladenen *synthetischen* Snapshot rein lesend aus:

- `invalid_snapshot`: Widerspruch bei Versionszahl, Event-Reihenfolge, verbotenem Statusübergang, Approval-Metadaten, Receipts, Scope/Lease, Kosten oder Zeit.
- `storage_incomplete`: Lease-/Outbox-Daten fehlen. Das bedeutet **nicht**, dass der Job sicher sei.
- `outbox_reconciliation_required`: nicht zugestellte Seiteneffekte erfordern Abgleich, unabhängig vom Jobstatus.
- `orphaned_worker`: `running` ohne gültige Lease / abgelaufene Lease; kein Auto-Retry.
- `lease_active`: vorläufig beobachtete Lease, kein Recovery-Schreibzugriff.
- `awaiting_human_review`, `terminal`, `not_running`: keine selbstständige Fortsetzung.

Alle Antworten setzen `canAutomaticallyExecute: false`. Es gibt **keine** Eingabe, die das umkehren kann. Der Inspector trifft keine echte Authentifizierungsentscheidung und validiert nicht kryptografisch, ob `evidenceRef` auf ein gespeichertes Beweismittel zeigt. Die Prüfungen können einen Snapshot nur plausibilisieren, nicht die Authentizität beweisen.

## 2. Postgres-Transaktionsgrenze (Review-Blueprint, **kein lauffähiges Migrationsskript**)

Eigenes privates Schema, z. B. `internal_factory`, erst nach separater Schema-/Security-Freigabe. Nicht in das Kunden-`public`-Schema mischen und `agent_tasks` / `agent_decisions` nicht durch Annahmen über ihre bestehenden Rechte zweckentfremden.

**Mindesttabellen** (Namen vor Migration mit Live-Inventar abgleichen):

| Tabelle | Schlüssel und Invariante |
| --- | --- |
| `jobs` | Primärschlüssel `(scope_id, job_id)`; `version` monoton; Status, Spec-SHA256, Budget und Spend |
| `events` | Unique `(scope_id, job_id, seq)`; nur Insert; unveränderlicher Payload-Digest |
| `receipts` | Unique `(scope_id, job_id, request_key)`; Request-Hash + Ergebnisversion + Ergebnisdigest |
| `approvals` | Bindung an Job, Spec-Hash, Scope, menschliche Identität, AAL2-Nachweis, Zeitpunkt und Ablauf |
| `leases` | Unique `(scope_id, job_id)`; Revision + monoton wachsendes `fencing_epoch`; Holder + Ablauf |
| `cost_ledger` | jede Reservierung und jede Abrechnung eindeutig zu Job, Request, Provider-Operation |
| `outbox` | Unique `(scope_id, job_id, event_seq, destination)`; Übergabe-ID; Status + Attempts |
| `evidence_manifest` | kanonischer Digest, Speicherort, Objekt-Version, Job-ID, Quelle/Tool, Freigabe/CI-Beleg |

**Ein atomarer Statuswechsel** muss in einer einzelnen Datenbanktransaktion stattfinden. Der Ablauf ist eine *Spezifikation*, keine auszuführende SQL-Funktion:

```text
SERVER: authentifizierter interner Plattform-Operator, aktuelle MFA-Stufe,
        Scope aus Serverkontext, Policy/Kill-Switch vor jedem Schreibzugriff.
BEGIN transaction
  Lock Job(scope, job_id) FOR UPDATE
  Check stored receipt(request_key)
    - gleicher kanonischer Request-Hash: Ergebnisbeleg zurückgeben
    - anderer Hash: eindeutiger Idempotenzfehler
  Assert version = expected_version
  Assert Übergang erlaubt, Approval/Spec-Hash stimmt, nicht abgelaufen
  For worker-originated writes: assert lease.holder, lease.epoch, lease.expires_at
  Reserve required budget atomically BEFORE any billable external action
  Update Job(state, version + 1, costs)
  Insert immutable Event(seq = version + 1, digest)
  Insert unique Receipt(request_key, request_hash, result_version, digest)
  Insert immutable Outbox record(s), wenn externe Lieferung erforderlich
COMMIT
Only AFTER successful commit return "committed"; otherwise ROLLBACK
```

**Wichtig:** Ein Client darf diese Schritte **nicht** als mehrere unabhängige Data-API-Aufrufe zusammenfügen. Das wäre keine atomare Transaktion. Für den späteren Serverzugang entweder eine im privaten Schema und mit streng begrenzten Rechten definierte Funktion oder eine geprüfte serverseitige Verbindung mit expliziter SQL-Transaktion verwenden. **Keine** öffentlich ausführbare `SECURITY DEFINER`-RPC als einfache Abkürzung: im Supabase-Modell sind Grants, Exposed Schemas, RLS und Funktionsberechtigungen getrennte Sicherheitsgrenzen.

Das Produktions-Auth-Modell muss für den konkreten Execution-Channel geprüft werden; der aktuelle `FactoryMockContext` mit `isOperator` und `aal2` ist **testseitig kontrolliert**, keine Benutzerautorisierung.

**Aktuelle Supabase-Änderung (seit 30.10.2026):** Neue Tabellen im `public`-Schema werden bei bestehenden Projekten nicht mehr automatisch für Data API / GraphQL freigegeben. Das geplante private Factory-Schema soll ohnehin nicht exponiert werden. Bei jeder späteren Migration sind dennoch die Grants für die **konkret verwendete Serverrolle** explizit und minimal zu prüfen; eine `42501`-Fehlermeldung wird nicht durch pauschale Grants an `anon` oder Abschalten von RLS behoben. [Offizieller Supabase-Changelog](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## 3. Genau-einmal-Absicht versus externe Wirklichkeit

Postgres kann Jobstatus, Event, Receipt und Outbox gemeinsam committen. Damit ist **nicht** garantiert, dass ein externer Provider einen Befehl genau einmal ausführt.

- *Vor* Outbox-Zustellung: eine stabile externe Operation-ID reservieren, an Provider schicken, sofern der Provider Idempotenz unterstützt.
- Nach Netzwerk-Timeout: nie blind erneut kostenpflichtige Calls auslösen; zuerst anhand Operation-ID/Providerstatus abgleichen.
- `delivered` erst nach nachweisbarer Bestätigung; Ergebnisse/Provider-Receipts versioniert als Evidence verankern.
- Ohne Provider-Idempotenz oder Reconciliation bleibt der Zustand `blocked` / `review_required`, bis ein Mensch die Wirkung bewertet.
- Kostenreservierung, tatsächlich abgerechnete Kosten und Freigabe nicht verbrauchter Reservierung müssen in einem auditierten Ledger korrelieren.

## 4. Lease/Fencing und Wiederanlauf

- Alle Worker-Leases entstehen durch **atomare** Vergabe in der DB mit vertrauenswürdiger Datenbankzeit und strikt steigendem Epoch-Zähler; keine clientseitige Uhr als Entscheidungsgrundlage.
- Jede geschützte DB-Write-Aktion muss den aktuellen Holder **und** die Epoch auf Gültigkeit prüfen; fremde/abgelaufene Epoch wird abgewiesen. Dies verhindert nicht automatisch Seiteneffekte bei externen Providern, die keine Fencing-/Idempotenzparameter kennen.
- Worker-Heartbeat ist keine neue Freigabe. Kill-Switch, Revocation und Budget werden vor jeder möglichen Wirkung erneut geprüft.
- Ein Worker-Absturz mit `running` + abgelaufener Lease erzeugt zunächst einen **Reconciliation-Fall**. Die nächste Lease kann nicht einfach den alten Auftrag fortführen.
- Neustart benötigt einen **neuen Versuch** mit eigenständiger Versuch-ID; spezifizierten Quellcommit, Ergebnisstatus, offene Outbox und bestätigte Provider-Wirkungen prüfen. Genehmigungen niemals aus einem abgelaufenen Job wiederverwenden.

**Recovery-Entscheidungsbaum:**

```text
Snapshot vorhanden + plausibel?
  nein -> halt_and_investigate
Lease + Outbox vollständig?
  nein -> halt_and_investigate
Outbox offen?
  ja  -> reconcile_outbox (kein automatisches Nachsenden)
running, aber Lease abgelaufen/fehlt?
  ja  -> inspect_orphaned_job (kein automatischer neuer Worker)
running, Lease gültig?
  ja  -> observe_only
review_required?
  ja  -> request_human_review
terminal?
  ja  -> none
sonst -> none
```

## 5. Prüf- und Freigabegates

| Gate | Abnahme | Stand |
| --- | --- | --- |
| SF-003 Snapshot-Inspector | deterministisch, fail-closed | lokal: 16/16 Smoke-Tests; GitHub: 17 Vitest-Fälle angelegt |
| TypeScript `--strict` für Inspector + SF-001 | keine Fehler | lokal bestanden |
| Repository-Vitest + vollständiger Typecheck | CI auf Branch-Head | **offen** |
| Transaction Rollback / DB-Ausfall | Testcontainer, nachgewiesene Atomizität | **offen** |
| Parallele Worker + Epochen nach Absturz | DB-Integration mit echten parallelen Transaktionen | **offen** |
| Datenbankrechte/RLS/Operator-AAL2 | Negativtests mit falscher Rolle und Scope | **offen** |
| Providerseitige Idempotenz + Kosten-Reconciliation | E2E in isoliertem Sandbox-Provider | **offen** |
| Evidence Vault: Digest und tatsächliche Ablage | manipulationssicherer Prüfpfad | **offen** |
| Produktionsfreigabe `production` | GitHub Environment mit Required Reviewer wirksam | **offen**, PR #2336 Draft |

**Nächster technischer Schritt SF-004:** separater, von einem Review freigegebener *lokaler* PostgreSQL-Testadapter in einer vollständig isolierten Entwicklungsdatenbank; zuerst Tests (Rollback, CAS, Lease-Expiry, Transaktionsabbruch, fremde Rollen), erst anschließend tatsächliche Produktionsmigration beantragen. Keine Änderung an `main` und kein Merge/Deploy aus diesem Branch.

Quellen: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions), [Supabase Securing your API](https://supabase.com/docs/guides/api/securing-your-api), [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

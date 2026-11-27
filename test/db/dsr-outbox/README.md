# P0 #2360 – DSR-Outbox (isolierter Integrationskandidat)

**Status: Draft / keine Produktionsmigration.** Die Dateien unter `test/db/dsr-outbox/` werden
ausschließlich in einer kurzlebigen PostgreSQL-Testdatenbank ausgeführt. Es wird
**kein** neues System deployt und keine zusätzliche Worker-Infrastruktur geschaffen.
Die spätere Verarbeitung muss in die vorhandene RealSync-Governance-Runtime
eingebunden werden.

## Nachweisbarer Stand

| Datei | Zweck |
| --- | --- |
| `intake.sql` | Atomare `dsr_requests`-Annahme + dauerhafter Outbox-Auftrag; private, mit Tenant-/Operations-UUID gebundene SHA-256-Fingerprints der ursprünglichen Eingaben sowie E-Mail-Bindung; DB-Trigger schützt die Identitätsfelder vor Updates; service-role-only RPC |
| `worker.sql` | Isolierter `FOR UPDATE SKIP LOCKED`-Claim, Worker-Lease, Fencing-Epoch, begrenzter Backoff, Dead-Letter nach acht Versuchen |
| `evidence-ack.sql` | Atomare Evidence-/Audit-/Erasure-/ACK-RPC; verlangt gültige Lease, unveränderte Antragsteller-E-Mail, tenantgebundene Mapping-Zeile und erneute kryptografische HMAC-Prüfung mit der gespeicherten Key-Version; keine Klartext-PII im Event-/Audit-Payload |
| `postgres-integration.mjs` | Echte PostgreSQL-Prüfung (**31 Producer-/Lease-/ACK-Checks**, inklusive manipulierter Payload, HMAC-Fehler und unveränderlicher Identität), darunter 20 parallele Anfragen, erzwungene Evidence-/Audit-Fehler, ACK-Replay, Worker-Fencing und Erasure-Idempotenz; die Evidence-Tabellen sind Test-Fixtures, **nicht** das produktive Hash-Chain-Schema |
| `real-runtime-integration.mjs` | **14** zusätzliche Integrationstests mit den **Originalmigrationen** für DSR, Admin-Log, partitionierte `runtime_events`, HMAC-Subject-Lifecycle und DSR-Erasure; prüft SHA-256-Hash-Chain, Transaktionsrollback, Append-only und Tenant-Prüfung. Das Supabase-Auth-/Vault-Bootstrap bleibt synthetisch. |
| `recovery.mjs` | Älterer ergänzender PGlite-Test mit persistentem Testverzeichnis |
| `.github/workflows/dsr-outbox-isolated-postgres.yml` | Branchgebundener Wegwerf-PostgreSQL-Container (nur CI, keine Verbindung zu Supabase-Produktion) |

Prüfprotokoll: GitHub Actions → **DSR Outbox - isolated PostgreSQL contract (no deploy)**.

**Abnahme vom 27.11.2026:** [CI-Lauf #46003714945](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/runs/46003714945) erfolgreich: **31/31 isolierte Producer-/Lease-/ACK-Tests** + **14/14 Tests mit ausgewählten Originalmigrationen**, zusammen **45/45**. Die Hash-Chain wurde mit `runtime_events_verify_chain` der echten Migration bestätigt; bei Fehler im zweiten Event-Insert blieben keine Audit-/Evidence-/Erasure-Nebenwirkungen bestehen.

**Genauer Schema-Scope:** `20260514100000_governance_admin_log.sql`, `20260515200000_dsr_tracker.sql`, `20260602100000_runtime_events_backbone.sql`, `20260603000000_subject_ref_lifecycle.sql`, `20260604100000_runtime_events_spec_version_v02.sql` und `20260626000000_dsr_erasure_automation.sql` werden aus dem Repository in eine Wegwerf-Datenbank geladen. Dazu dienen `scripts/test-db/bootstrap.sql` (Auth-Stubs) und die Originaldefinition von `set_updated_at()`. **Dies ist kein vollständiger Replay aller Repository-Migrationen und keine Prüfung des Supabase-Vault-Dienstes.**

## Ausdrücklich noch offen

1. **Produktionstaugliche Migration** aus dem isolierten Kandidaten ableiten;
   historische Migrationsfolge, Migration-Ledger-Drift, reale Schemas und RLS
   isoliert prüfen. Die Dateien sind absichtlich **nicht** unter
   `supabase/migrations/`.
2. `create`, `update`, `assign`, `close` in der bestehenden
   `governance-dsr`-Edge Function auf atomare RPCs umstellen. Bisher
   testet dieser Kandidat ausschließlich die Annahme (`create`).
3. **Evidence-Consumer weiter integrieren:** Der atomare Abschluss und die echte kryptografische Bindung an die gespeicherte Subject-Key-Version sind nun
   mit einem synthetischen Test-Envelopeschema **und** den originalen
   Runtime-/Hash-Chain-Migrationen isoliert geprüft. Offen bleiben der
   ausführende Consumer im vorhandenen Scheduler, automatisierte
   HMAC-/Vault-Mapping-Recovery und -Provisionierung, der vollständige historische
   Migrationsreplay inklusive Ledger-Drift, weitere JWT-/RLS-Varianten und
   produktionsnahe End-to-End-Abnahme. Fehlende Subject-Referenzen bleiben
   **pending/retry**, niemals `complete`.
4. `evidence_status` separat vom fachlichen DSR-Status für den Tenant
   im Dashboard sichtbar machen, ohne private Task-Payloads freizugeben.
5. HTTP/JWT 401, Tenant-Fremdzugriff 403, Viewer 403 und komplette
   Auth-/Edge-/Erasure-End-to-End-Tests mit Fehler-Injektion und Replay
   im isolierten **vollständigen** Supabase-Migrationsschema nachweisen.
6. Die `service_role`-RPC ist keine öffentliche Autorisierung: Die reale
   Edge Function muss weiter JWT, Mitgliedschaft, Rolle, Tenant-Bindung
   und Operations-ID prüfen. Der Service-Role-Key darf nie an Clients gelangen.

**Freigaberegel:** Keine produktive Migration, kein Branch-Merge und
keine Live-Aktivierung vor separater Abnahme. Ein grünes CI-Ergebnis
für diese Kandidaten bedeutet **nicht** revisionssichere DSR-Erfüllung.

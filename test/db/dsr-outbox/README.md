# P0 #2360 – DSR-Outbox (isolierter Integrationskandidat)

**Status: Draft / keine Produktionsmigration.** Die Dateien unter `test/db/dsr-outbox/` werden
ausschließlich in einer kurzlebigen PostgreSQL-Testdatenbank ausgeführt. Es wird
**kein** neues System deployt und keine zusätzliche Worker-Infrastruktur geschaffen.
Die spätere Verarbeitung muss in die vorhandene RealSync-Governance-Runtime
eingebunden werden.

## Nachweisbarer Stand

| Datei | Zweck |
| --- | --- |
| `intake.sql` | Atomare `dsr_requests`-Annahme + dauerhafter Outbox-Auftrag, tenant- und actor-gebundene Operations-ID, Replay-Konfliktschutz; service-role-only RPC |
| `worker.sql` | Isolierter `FOR UPDATE SKIP LOCKED`-Claim, Worker-Lease, Fencing-Epoch, begrenzter Backoff, Dead-Letter nach acht Versuchen |
| `evidence-ack.sql` | Isolierte atomare Evidence-/Audit-/Erasure-/ACK-RPC; verlangt gültige Lease, HMAC-Subject-Referenz und vorhandenes Tenant-Mapping, kein PII im Event-/Audit-Payload |
| `postgres-integration.mjs` | Echte PostgreSQL-Prüfung (bisher 16 Producer-/Lease-Checks plus 10 neue ACK-Checks), darunter 20 parallele Anfragen, erzwungene Evidence-/Audit-Fehler, ACK-Replay, Worker-Fencing und Erasure-Idempotenz; die Evidence-Tabellen sind Test-Fixtures, **nicht** das produktive Hash-Chain-Schema |
| `recovery.mjs` | Älterer ergänzender PGlite-Test mit persistentem Testverzeichnis |
| `.github/workflows/dsr-outbox-isolated-postgres.yml` | Branchgebundener Wegwerf-PostgreSQL-Container (nur CI, keine Verbindung zu Supabase-Produktion) |

Prüfprotokoll: GitHub Actions → **DSR Outbox - isolated PostgreSQL contract (no deploy)**.

## Ausdrücklich noch offen

1. **Produktionstaugliche Migration** aus dem isolierten Kandidaten ableiten;
   historische Migrationsfolge, Migration-Ledger-Drift, reale Schemas und RLS
   isoliert prüfen. Die Dateien sind absichtlich **nicht** unter
   `supabase/migrations/`.
2. `create`, `update`, `assign`, `close` in der bestehenden
   `governance-dsr`-Edge Function auf atomare RPCs umstellen. Bisher
   testet dieser Kandidat ausschließlich die Annahme (`create`).
3. **Evidence-Consumer weiter integrieren:** `evidence-ack.sql` prüft bereits
   Leasing, Mapping, Rollenrechte sowie den atomaren Abschluss mit
   `runtime_events`, `governance_admin_log`, Erasure-Vormerkung und Outbox-ACK
   **im isolierten Testschema**. Noch offen bleiben der ausführende Consumer
   im vorhandenen Scheduler, HMAC-/Vault-Mapping-Recovery, echte
   hash-chain-Trigger mit Partitionen, Retention und RLS im Vollschema.
   Fehlende Subject-Referenzen bleiben **pending/retry**, niemals `complete`.
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

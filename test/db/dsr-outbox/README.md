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
| `worker.sql` | Isolierter `FOR UPDATE SKIP LOCKED`-Claim, Worker-Lease, Fencing-Epoch, begrenzter Backoff, Dead-Letter nach 8 Versuchen; kein Evidence-ACK |
| `postgres-integration.mjs` | Echte PostgreSQL-Prüfung mit 16 unabhängigen Assertions/Checks, darunter 20 parallele Aufrufe, künstlicher DB-Fehler, Rollen-/Tenant-Guards, konkurrierende Worker und Wiederanlauf |
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
3. **Evidence-Consumer:** HMAC-/Subject-Mapping und Erasure-Auftrag über
   den bestehenden Lifecycle bilden. Ein taskbezogener Abschluss muss
   `runtime_events`, `governance_admin_log` und das Outbox-ACK in
   **derselben PostgreSQL-Transaktion** schreiben; UNIQUE/Idempotenz,
   Hash-Chain, Retention und RLS mit dem echten Schema testen.
   `worker.sql` bietet derzeit deshalb bewusst **keinen** Complete-/ACK-RPC.
4. `evidence_status` separat vom fachlichen DSR-Status für den Tenant
   im Dashboard sichtbar machen, ohne private Task-Payloads freizugeben.
5. HTTP/JWT 401, Tenant-Fremdzugriff 403, Viewer 403 und komplette
   Auth-/Edge-/Erasure-End-to-End-Tests mit Fehler-Injektion und Replay
   im isolierten Full-Schema nachweisen.

**Freigaberegel:** Keine produktive Migration, kein Branch-Merge und
keine Live-Aktivierung vor separater Abnahme. Ein grünes CI-Ergebnis
für diese Kandidaten bedeutet **nicht** revisionssichere DSR-Erfüllung.

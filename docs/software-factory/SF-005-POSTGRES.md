# SF-005 — PostgreSQL-Checkpoint: Review-Fassung

Stand: 20.11.2026. Entwurf auf Entwicklungsbranch, NICHT auf einer Datenbank ausgeführt.

## Architektur: vorhandene Aufgabenverwaltung behalten

Die Tabelle public.agent_tasks bleibt die einzige Job-Queue. Die bestehende
Agent-OS-Koordination aus 20261030140000_agent_task_coordination.sql hat bereits
Delegation, Task-Leases und Prüfnachweise. Es wird keine zweite Scheduler-
oder Taskverwaltung erstellt. Ein ergänzendes nicht öffentliches Schema
factory_runtime enthält lediglich einen versionierten Zustand pro vorhandener
Aufgabe und die zugehörigen atomaren Versionsevents.

Das SQL liegt ausdrücklich NICHT im Supabase-Migrationsordner. Es ist ein
Review-Entwurf, keine bereits deployte Migration.

## Artefakte

- apps/factory-worker/loop/db/postgres-contract.sql
- apps/factory-worker/loop/db/adapter.mjs
- apps/factory-worker/loop/db/test/adapter.test.mjs
- test/runtime/db/factory-loop-persistence.db.test.ts
- apps/factory-worker/loop/engine.mjs
- docs/software-factory/SF-005-GOAL-LOOP.md

## Datenbank-Funktionen

- loop_init: Überprüft Task, Tenant, Factory-Markierung und initialen
  Goal-Checkpoint. Erstellt Checkpoint und Ereignis in EINER Transaktion.
- loop_claim: Sperrt Zeile, setzt zeitlich begrenzte Worker-Lease und erhöht
  Fencing-Epoche atomar.
- loop_commit: Erwartet gültige Lease, aktuelle Fencing-Epoche und alte Version.
  Erzwingt Status- und Budgetgrenzen, fortlaufende Event-Historie,
  Checkpoint-Version und Event-Audit in einer Transaktion.
- loop_read: Liefert nur an den autorisierten Serverdienst den Snapshot und
  die Version zurück, sodass ein Neustart den letzten Zustand lesen kann.

Der neue serverseitige JavaScript-Adapter verwendet ausschließlich parametrisierte
SQL-Aufrufe und benötigt einen bereits authentifizierten Datenbankclient. Er
öffnet selbst keine Verbindung, lädt keine Secrets und führt keinen Agenten aus.
Bei Datenbankfehlern bricht er ohne Erfolgsbestätigung ab.

Wiederholte Schreibversuche mit identischem Idempotenzschlüssel und Inhalt
werden als Replay erkannt. Derselbe Schlüssel mit verändertem Inhalt scheitert.

## Sicherheitsgrenzen

- Schema factory_runtime bleibt außerhalb der Supabase Data API.
- Tabellen haben RLS und keine direkten App-Schreibrechte.
- Privilegierte Funktionen sind ausschließlich dem service_role erteilt.
  Dieser Schlüssel darf niemals im Browser verwendet werden.
- Worker-ID und Verifier-ID sind noch keine kryptografisch attestierten
  Identitäten. Der künftig nutzende Backenddienst muss separat abgesichert
  werden.
- Die Factory-Checkpoint-Lease ist noch nicht mit der vorhandenen Lease
  in public.agent_tasks zusammengeschaltet. Kein gleichzeitiger Betrieb
  beider Claim-Wege ohne gemeinsames Lease-Protokoll.
- Evidenzreferenzen beweisen weder Herkunft noch korrekte Testausführung;
  Kostenwerte sind vom Backend angelieferte Angaben und noch keine
  tatsächliche tokenbasierte Abrechnung.
- Kein KI-Aufruf, kein REA- oder Codex-Start, kein Deploy und kein Merge.

## Isolierte Testabnahme

1. Disposable-PostgreSQL-Instanz mit den vollständigen vorhandenen
   Supabase-Tabellen, Rollen und Migrationen erzeugen. Keine Produktions-DB!
2. Die SQL-Review-Datei nach eigenständiger Prüfung NUR dort anwenden.
3. TEST_DB_URL für diese Testdatenbank setzen.
4. Tests aufrufen:

    npx vitest run test/runtime/db/factory-loop-persistence.db.test.ts

5. In CI unbedingt REQUIRE_DB_TESTS=1 setzen: Fehlt TEST_DB_URL, darf die
   Integrationssuite nicht stillschweigend als erfolgreich gelten.

Ohne Testdatenbank laufen lediglich statische Code-Vertragsprüfungen.
Zusätzlich sind zehn Offline-Adaptertests für Eingabevalidierung,
Parametrisierung und Fail-Closed-Verhalten vorhanden. Sie ersetzen
keinen echten Datenbanklauf.

Die eigentlichen PostgreSQL-Läufe und parallele Worker-Lease-Tests
bleiben ausstehend.

## Noch offene Abnahme

- SQL gegen echten PostgreSQL-Server parsen, anlegen und zurückrollen.
- Parallelzugriffe mit ZWEI unabhängigen Sessions, Lease-Übernahme und
  veralteten Fencing-Epochen nachweisbar testen.
- Absturz und Resume nach persistiertem Checkpoint ausführen.
- Authentische Verifier-Nachweise, tenantgebundene API-Authorisierung,
  echte Kostenreservierung und Not-Aus integrieren.
- Erst dann Migration per Supabase CLI erzeugen und nach Review freigeben.
- WIP-PRs #2346 und #2347, bestehende Release-Gates und Main-Schutz
  unverändert beachten.

STATUS: SQL-Vertrag und Testplan vorhanden; kein produktiver Datenbank-Test,
kein angewandtes Schema, keine aktive Agentenschleife.

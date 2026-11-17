# RSD-015 – Subprozessor-Mailschema: kontrollierte Wiederherstellung

**17.11.2026 · Draft / keine Produktivfreigabe**  
**Schema:** PR #2278 · **Handler:** PR #2235

## Produktionsbefund (read-only bestätigt)
Die Migrationshistorie führt 20260507140000 als ausgeführt; die drei Tabellen
sub_processor_subscriptions, sub_processor_changes, sub_processor_notifications
und zwei RPCs sub_processor_changes_pending(), sub_processor_change_mark_notified(uuid)
sind im produktiven Schema dennoch nicht vorhanden. Der Function-Aufruf
sub-processor-notify meldete am 17.11.2026 HTTP 500.

Die alte Migration darf NICHT unverändert erneut ausgeführt werden: Sie
enthält eine anonyme INSERT-Policy und veraltete Cron-/Bearer-Konfiguration.
Der neue PR #2278 stellt nur fehlende Objekte und service-only-Rechte wieder
her, ohne Cron, Vault, HTTP, Secrets oder Kundenbestände anzufassen.

## Release-Reihenfolge – ausschließlich mit gesonderter Owner-Freigabe

1. Den aktiven Job vor dem Cutover kontrolliert pausieren, damit der alte Handler
   nicht gegen das neue Schema läuft. Job-Pause selbst ist ein Produktiveingriff.
2. Verifiziertes Empfängerverzeichnis einschließlich bestehender AVV-/Workspace-
   Vertragskontakte festlegen. Anonyme Anmeldung ist kein DOI-Beleg.
3. Zuerst die korrigierte Handler-Version in Draft-PR #2235 mit Tests gegen
   isolierte Datenbank und Test-Resend prüfen. Beide PRs müssen zusammenpassen.
4. RSD-015-Migration in isolierter Datenbank zweimal anwenden (Idempotenz).
   Negativtests: anon/authenticated dürfen weder schreiben noch RPCs ausführen.
   Positivtest: service_role kann Tabellen/RPCs verwenden.
5. Den gekoppelten Release nur mit Freigabe, gesichertem Backup/PITR und
   Rollbackplan durchführen. Erst danach Testkontakte/-nachrichten und Cron-
   Reaktivierung; keine neuen Edge-Function-Slots erforderlich.
6. Fällige Teständerung → Provider Message-ID → gespeichertes Receipt →
   Markierung nur bei vollständiger Liste; Retry/Zero-Subscriber-/Fehler-/
   Abmeldungs-/Ungültige-Auth-Fälle nachweisen. Dabei keine echten Kunden
   anschreiben, solange der Prozess nicht freigegeben ist.
7. Providerannahme ist keine finale Postfachzustellung. Nachgelagerte Delivery-
   Events, eine persistente Outbox und Reconciliation über die 24-Stunden-
   Idempotenz hinaus bleiben separate Freigabepunkte.

## Read-only-Nachprüfung nach genehmigter Migration

    SELECT
      to_regclass('public.sub_processor_subscriptions') AS subscriptions,
      to_regclass('public.sub_processor_changes') AS changes,
      to_regclass('public.sub_processor_notifications') AS notifications,
      to_regprocedure('public.sub_processor_changes_pending()') AS pending_rpc,
      to_regprocedure('public.sub_processor_change_mark_notified(uuid)') AS mark_rpc;

    SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'sub_processor_subscriptions',
        'sub_processor_changes',
        'sub_processor_notifications'
      );

    SELECT
      has_table_privilege('anon','public.sub_processor_subscriptions','INSERT') AS anon_can_insert,
      has_table_privilege('authenticated','public.sub_processor_subscriptions','INSERT') AS authenticated_can_insert,
      has_table_privilege('service_role','public.sub_processor_subscriptions','INSERT') AS service_can_insert,
      has_function_privilege('anon','public.sub_processor_changes_pending()','EXECUTE') AS anon_can_rpc,
      has_function_privilege('service_role','public.sub_processor_changes_pending()','EXECUTE') AS service_can_rpc;

    SELECT count(*) AS all_receipts,
           count(*) FILTER (WHERE resend_message_id IS NULL
             OR error_message IS NOT NULL) AS invalid_receipts
    FROM public.sub_processor_notifications;

Erwartete Rechte: anon/authenticated INSERT = false, anon RPC = false,
service_role INSERT und RPC = true; alle drei Tabellen haben RLS=true.

## Offene Risiken

**Öffentlicher Anmeldeweg:** Der bisherige anonyme REST-INSERT und
die falsche Erfolgsanzeige sind im selben Draft-PR #2278 entfernt. Bis
zur geprüften verifizierten DOI-Anmeldung ist ausschließlich ein
manueller Kontakt per mailto verfügbar, der keine Registrierung verspricht.
Die Änderung ist noch nicht auf der produktiven Website deployed.

**Abmeldung:** Die produktiven Mail-Templates verweisen auf
/api/sp-unsubscribe und /api/drip-unsubscribe; im geprüften Repo wurden
keine passenden Endpunktimplementierungen gefunden. Vor Versandfreigabe
sind ein sicherer GET-Bestätigungsweg und ein RFC-8058-One-Click-POST
mit überprüfbarer DB-Änderung, Rate-Limit und negativem Test nachzuweisen.
Der korrigierte Handler-PR #2235 enthält deshalb die neuen standardmäßig
deaktivierten Schalter SUB_PROCESSOR_NOTICES_ENABLED bzw.
AUDIT_DRIP_SEND_ENABLED. NICHT aktivieren, solange die Tests fehlen.

**Vertragsrecht:** Benachrichtigungen an freiwillige Newsletter-Empfänger
allein erfüllen noch nicht die Vertragspartner-Information. Owner-/AVV-
Kontakte und Widerruf/Widerspruch sind separat zu definieren.

**Zustellung:** Provider-HTTP-2xx beweist Annahme, nicht Inbox-Zustellung.
Nachweisbarer persistenter Outbox-/Webhook-Abgleich fehlt.

**Nebenläufigkeit:** Die Update-RPC vergleicht die zum Abschlusszeitpunkt
verifizierten Abonnenten; parallele Neuaufnahme braucht einen gesonderten
Race-Condition-Test oder einen unveränderlichen Empfänger-Snapshot.

**Rollback:** Die zugehörige Rollback-Datei verweigert die Löschung, sobald
irgendeine der drei Tabellen Daten enthält. Bei vorhandenen Daten nur
kontrolliertes Pausieren/Forward-Fix; kein blindes DROP.

**Status:** ausschließlich GitHub-Draft; keine Live-Migration oder E-Mail.

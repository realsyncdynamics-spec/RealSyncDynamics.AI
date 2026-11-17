# Infrastruktur-Wiederherstellung – vorbereiteter Ablauf

Stand: 04.11.2026, Repository-Basis `c8af738fa834a8977486e5f7fd5f206c101ab3dd`.
Dieser Ablauf ist vorbereitet, nicht produktiv ausgeführt. Es besteht keine
pauschale Freigabe für Restore, Migrationen, Function-Deploys oder Backups.

## Belegte Ausgangslage

- Supabase `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`, Frankfurt) meldete
  über Projektliste und Einzelabfrage `INACTIVE`.
- [Deploy 41687189154](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/runs/41687189154):
  `Push migrations` scheiterte beim Link mit `project is paused`;
  Function-Deploys scheiterten am nicht mehr unterstützten `[inbucket]`-Schlüssel.
- [Cron-Lauf 41851946488](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/runs/41851946488)
  meldete Management API 400 / Datenbank nicht erreichbar, endete aber erfolgreich.
- Cloudflare-App-Check für `c8af738` erfolgreich, Deployment
  `5976a32a-0dee-4281-8a5c-b203824b2ad3`. Der Actions-Live-Smoke wurde übersprungen.
  Der erfolgreiche App-Check belegt keinen funktionsfähigen Backend-Nutzerfluss.
- VPS-Backup war pausiert, tatsächlicher Backup-Job übersprungen. Der Stand
  anderer Provider-Sicherungen und die aktuelle VPS-Erreichbarkeit sind unbekannt.

## 1. Diagnose und Alarmierung korrigieren

Unvollständige Betriebsprüfungen dürfen keine Recovery auslösen. Prüfe lokal mit
`node --test scripts/tests/operations-guard-process.test.mjs` ohne reale Secrets.
Bewerte auch den nächsten echten Scheduled-Lauf nach einem gesondert freigegebenen
Merge: bei weiterhin pausiertem Projekt muss er fehlgeschlagen/ungeprüft melden.
Ein solcher Fehler beweist keine bestätigte ACL-, Plan- oder Migrationsabweichung.

## 2. Restore vorbereiten und einzeln freigeben

Vor Wiederaufnahme im Supabase-Dashboard prüfen: Grund der Pause, Abrechnung,
verfügbare Sicherung samt Zeitpunkt, Restore-Methode und mögliche Kosten.
Die Ursache der Pause ist noch nicht festgestellt; weder automatische Inaktivität
noch ein Zahlungsproblem ist belegt.

Vor dem Restore die erwarteten Nebenwirkungen erfassen. pg_cron-Jobs, Queue-Worker,
Webhooks und Provider-Integrationen können nach Wiederaufnahme erneut arbeiten.
Solange die DB nicht lesbar ist, ist eine aktuelle Liste dieser Jobs nicht bestätigt.
Keine pauschalen Abschaltungen, Key-Rotationen oder Queue-Löschungen durchführen.
Benötigte Sperren/Änderungen als konkrete, getrennte Aktionen vorlegen.

Die Einzelfreigabe muss das Projekt und die Wiederaufnahme ausdrücklich benennen.
Keine automatischen Migrationen oder Function-Deploys an den Restore anhängen.
Nach Wiederaufnahme zuerst nur lesend Projektstatus, DB-Erreichbarkeit,
Migrationsledger, Cron-Kadenz und fehlgeschlagene HTTP-Dispatches prüfen.

## 3. Deploy-Pfad und Versionsabgleich

- Konfigurationskorrektur bereits vorhanden:
  [#2158](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2158).
  Vor Merge aktuellen Head, Approval und CI erneut prüfen. Merge löst produktiven
  DB-/Functions-Workflow aus; nicht als harmloses Konfigurations-Update behandeln.
- CLI-Version gemeinsam mit dieser Konfiguration verifizieren und anschließend
  festsetzen. Noch keine Version als kompatibel behaupten; ein TOML-Parse ersetzt
  keinen Lauf mit dem tatsächlich verwendeten Supabase-CLI-Parser.
- Environment-Gate bereits vorbereitet in
  [#2142](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2142).
  Zielprojekt und Environment-Konfiguration vor Freigabe prüfen. Nicht blind
  einen zweiten konkurrierenden Fix in `deploy.yml` erstellen.
- Datenbank- und Function-Deploy laufen auf der geprüften Basis unabhängig.
  Benötigte Schema-/Function-Reihenfolge je Release festlegen; neue Funktionen
  erst nach bestätigtem Schema, destruktive Änderungen separat behandeln.
- Ausstehenden Stand zuerst lesend ermitteln. Kein unbesehenes
  `db push --include-all` oder `migration repair` als Wiederherstellungsversuch.
  Jede Migration bleibt einzeln freigabepflichtig.

## 4. Backup und Abnahme

Prüfe beim VPS zunächst Host, Port, Host-Key und autorisierten SSH-Zugang.
Aktiviere `VPS_BACKUP_ENABLED` erst nach bestätigter Erreichbarkeit und Freigabe.
Bestätige danach Backup-Datei, Alter und eine isolierte Wiederherstellungsprobe;
ein grüner Workflow oder ein Provider-Vertrag ersetzt diese Nachweise nicht.

Prüfe den vollständigen Nutzerfluss mit autorisierten Testdaten: Login,
Mandantenzugriff, Scan, persistierter Befund und Evidence-Abruf. Billing bleibt
im Sandbox-Modus; keine realen Zahlungen, Nachrichten oder Telefonanrufe.
Berücksichtige den vorhandenen Release-E2E-Entwurf
[#2132](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2132).
Dokumentiere je Schicht Commit/Version, Datenzeitpunkt und Beleg. DNS, TLS,
WAF und VPS-Dienste sind gesondert zu messen.

## Abbruch und Rollback

Bei unbekanntem Ziel, fehlender Sicherung oder ungeklärten Nebenwirkungen vor
der jeweiligen schreibenden Aktion stoppen. Nach Restore-Fehlern keinen neuen
Restore oder Deploy blind wiederholen. Logs und Provider-Status auswerten.
Ein Frontend-Rollback stellt weder ein DB-Schema noch Cron-Zustände zurück.
Die erneute Pause der Datenbank ist eine Betriebsentscheidung mit möglichen
Ausfällen und kein automatisch auszuführender Rollback.

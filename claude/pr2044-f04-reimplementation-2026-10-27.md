# PR #2044: eigenständige F04-Nacharbeit

Basis: `51f5ecebaf2ae535be7d214601c4e7e937e73fd5`. Kein alter Patch verwendet.

## Anforderung

F04 beschreibt im Audit die Klasse von Bearer-Präfixprüfungen vor privilegiertem Zugriff. Der Enforcer prüfte schon das dedizierte Cron-Secret, war also kein nachgewiesener Auth-Bypass; sein `startsWith`-Muster löste aber den unveränderten systemischen F04-Wächter aus. Er muss den vollständigen Authorization-Header zeitkonstant gegen `Bearer ${CRON_KEY}` vergleichen und bei fehlendem Secret beziehungsweise falschem Header vor DB- und Anbieterzugriff abbrechen. Separat müssen Tabellen-Defaults und Reservierungs-Fallbacks ab der ersten Migration dieselbe zentrale Funktion verwenden; 5/50 USD, 2 Anrufe und 600 Sekunden bleiben vorläufig und unbeschlossen.

## Dateien

- `supabase/functions/bot-voice-enforcer/index.ts`: vollständiger Headervergleich, kein startsWith/slice.
- `supabase/migrations/20261027120000_bot_usage_budget_hardening.sql`: Fallback-Funktion vor der Tabelle, Defaults und Reservierungsfunktionen lesen sie; EXECUTE nur für service_role und Owner.
- `supabase/migrations/20261027140000_bot_usage_channel_limits_voice_enforcement.sql`: doppelte Definition/ALTER DEFAULT entfernt.
- `test/bots/voiceEnforcement.test.ts`: aktualisierter Verdrahtungswächter, zentrale Quelle und Werte abgesichert; echter Handler im VM-Kontext mit DB-/Anbieter-Attrappen, 7 ungültige Header, gültiger Header, fehlendes Secret.
- Dieser Bericht.

## Rot-Grün

Tests zuerst geändert, danach Implementierung. Erster Lauf: 4 failed, 25 passed (29).

Gegenprobe nach Erweiterung der Handler-Tests: nur die drei Implementierungsdateien auf HEAD zurückgesetzt, aktuelle Tests unverändert gelassen, danach Dateien wiederhergestellt:

```sh
npx vitest run test/security/service-role-auth.test.ts test/bots/voiceEnforcement.test.ts
```

Ergebnis: Exit 1; `Test Files 2 failed (2)`, `Tests 4 failed | 34 passed (38)`.
Die vier Fehler sind der bestehende systemische F04-Wächter, der aktualisierte Enforcer-Wächter sowie beide Tests der Fallback-Zentralisierung. Die Verhaltenstests akzeptieren auch den alten Handler: er verglich bereits das Secret; es wird kein vorheriger Auth-Bypass behauptet.

Mit Fix:

```sh
npx vitest run test/security/service-role-auth.test.ts test/bots/voiceEnforcement.test.ts test/bots/botBudget.test.ts
```

Ergebnis: Exit 0; `Test Files 3 passed (3)`, `Tests 70 passed (70)`.

Weitere Prüfungen: `npm run lint` (tsc), `check:edge-syntax` (197 Entrypoints), `check:edge-refs`, `check:context`, `git diff --check`. Migrationskollisionen gegen `origin/main@ac3f218`: keine; beide Migrationen fehlen auf main, keine dort veröffentlichte Migration verändert. Vergleich gegen andere offene PRs mangels Token nicht gelaufen.

## Grenzen und offene Punkte

Keine komplette Unit-Suite und keine DB-Laufzeittests dieses neuen Commits durchgeführt. PostgreSQL fehlt; Installationsversuch scheiterte an den Umgebungsrechten. Die SQL-Tests oben sind Quelltextwächter, kein Ersatz für Migration validation auf PostgreSQL. Frühere Berichte mit 8146 Unit-/436 DB-Tests gelten nicht als Nachweis dieser Implementierung.

Budgetoption A/B, Kanalreserven, Telefonkosten im USD-Budget und Enterprise-Minutenlimit bleiben unbeschlossen. Secrets/Vault-Konfiguration und Twilio-Live-Test bleiben offen. PR muss Draft bleiben; kein Merge, kein Produktionsdeploy. Ein Branch-Push kann automatisch eine Frontend-Vorschau auslösen.

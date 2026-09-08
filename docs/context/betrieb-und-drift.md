# Modulstand, Messprotokolle, Drift und Betrieb (Archiv)

> Ausgelagert aus `CLAUDE.md` §5, damit der Kern-Kontext klein bleibt.
> Enthält die datierten Messungen gegen die Live-DB, die Drift-Guards, den
> Cron-Befund und die Lehren daraus. **Regel bleibt**: vor jeder Aussage zum
> Produktionsstand messen, nicht aus dieser Datei ableiten — eine Ledger-Messung
> altert mit jedem Merge.

### Module (Phase 2) — Repo-Vollständigkeit

> #### ⚠️ Repo-Stand ≠ Produktions-Stand
>
> Die Prozentangaben unten beschreiben den **Stand im Repository**, nicht was in
> Produktion läuft. Die Regel bleibt: vor jeder Aussage zum Produktionsstand
> gegen die Live-DB messen, nicht gegen diese Liste.
>
> **Messung vom 2026-08-30, nach dem Merge von PR #1171**, `main` @ `6e8b761`,
> per Management-API direkt gegen das Live-Projekt `RealSyncDynamicsLive`
> (`ebljyceifhnlzhjfyxup`, eu-central-1, PostgreSQL 17.6.1.104,
> `ACTIVE_HEALTHY`). Quellen: `list_edge_functions`,
> `supabase_migrations.schema_migrations`, `pg_tables` / `pg_class` /
> `pg_policy`. **Mengen in beide Richtungen verglichen, nicht nur Zahlen** —
> siehe die Lehre weiter unten.
>
> | | Repo (`main`) | in Produktion | Lücke |
> |---|---|---|---|
> | Migrationen | 297 Dateien | **299** verbucht (neueste `20260831020000`) | **2**¹ |
> | Edge Functions | 179 (+ `_shared`) | **179** aktiv | **0**² |
> | Tabellen in `public` | — | 351 (`pg_tables`, ohne Views) | — |
> | davon mit RLS | — | **351 / 351** | **0** |
> | Views · `public`-Funktionen | — | 19 · 227 | — |
>
> Frühere Stände nannten hier 369 Tabellen ohne Messmethode — vermutlich
> inklusive Views. Ab jetzt zählt `pg_tables`, damit die Zahl vergleichbar bleibt.
>
> **Keine Repo-Migration ist unverbucht.** Die 2026-08-24 dokumentierte Lücke
> in dieser Richtung ist geschlossen; die verbleibende Differenz zeigt in die
> *andere* Richtung — siehe ¹ und ².
>
> **RLS gilt lückenlos**: alle 351 Tabellen haben RLS aktiviert, keine
> einzige ohne. 28 davon haben RLS ohne eigene Policy; das ist bei 27 von
> ihnen richtig so — 11 sind Partitionen von `runtime_events` (die
> Elterntabelle trägt 3 Policies, die beim Zugriff über sie greifen) und 16
> werden ausschließlich von Edge Functions per Service-Role angefasst, für
> Clients also bewusst gesperrt. Der 28. Fall war ein Bug, siehe ³.
>
> **Lehre aus dieser Messung: Zahlengleichheit ist kein Beleg.** Repo und
> Produktion zeigten beide „179 Edge Functions" — die Mengen waren trotzdem
> verschieden, weil `_shared` im Repo keine Function ist und dafür eine
> Function live läuft, die es im Repo nie gab. Wer nur `wc -l` vergleicht,
> übersieht das. Deshalb ab jetzt: `comm -23` **und** `comm -13`.
>
> **Wirksam in Produktion, nicht nur im Repo**: `deploy.yml` lief am
> 2026-08-30 um 21:58 UTC grün auf `1533cf5` (Run 33337859594). Damit sind
> die drei Migrationen aus PR #1172 angewandt — die beiden nachgezogenen
> Out-of-Band-Versionen aus ¹ und
> `20260831030000_integrations_catalog_read_access` aus ³. Nachgezogen heißt
> nicht angekommen; dies ist der Beleg für Letzteres.
>
> **Zur Sperre durch die Migrations-Drift**: Sie bestand vom 2026-08-26 bis
> zum 2026-08-30, blieb aber folgenlos — in diesem Fenster berührte kein
> Commit `supabase/**`, also wurde `deploy.yml` gar nicht ausgelöst.
> Blockiert, aber niemand ist hineingelaufen. Der letzte grüne Lauf davor
> war am 2026-08-25 um 18:36 UTC auf `2e60a21`.
>
> **Nachmessung 2026-09-01**, `main` @ `310ab0e`, gleiche Methode und gleiche
> Quelle wie oben. Repo und Produktion sind weiterhin deckungsgleich — auf
> höheren Zahlen, weil seither fünf Migrationen dazugekommen sind:
>
> | | Repo (`main`) | in Produktion | Lücke |
> |---|---|---|---|
> | Migrationen | 305 Dateien | **305** verbucht (neueste `20260902000100`) | **0** |
> | Edge Functions | 179 (+ `_shared`) | **179** aktiv | **0** |
> | Tabellen in `public` | — | 354 | — |
> | davon mit RLS | — | **354 / 354** | **0** |
> | Views | — | 19 | — |
>
> `comm -23` und `comm -13` sind beide leer, bei Migrationen wie bei
> Functions. Die Zahlen in §2 und §7 sind damit nicht geschätzt, sondern
> nachgezogen. Dass Repo und Ledger beide 305 zeigen, war dabei nicht der
> Beleg — der Mengenvergleich war es.
>
> **Nachmessung 2026-09-04, 23:39 UTC**, `main` @ `1c40003` (Merge von
> PR #1196), nach dem grünen Deploy-Lauf 33929752213. Gleiche Methode:
> Ledger und Management-API, Mengen in beide Richtungen verglichen.
>
> | | Repo (`main`) | in Produktion | Lücke |
> |---|---|---|---|
> | Migrationen | 317 Dateien | **317** verbucht (neueste `20260904000300`) | **0** |
> | Edge Functions | 182 (+ `_shared`) | **182** aktiv | **0** |
>
> `comm -23` und `comm -13` sind beide leer. Zusätzlich per HTTP-Probe ohne
> Token geprüft, dass die Gates aus AP9 Welle 3 und 4 in Produktion greifen:
> `tenant-branding-update`, `evidence-vault-export`,
> `generate-compliance-report`, `report-generator`, `api-audit`,
> `compliance-alert-trigger`, `governance-risk-escalate` und
> `audit-monitor-cron` antworten alle mit `401` — die beiden Cron-Functions
> aus ihrem eigenen Bearer-Check (`verify_jwt` ist dort aus), die übrigen
> aus `requireUser`.
>
> ¹ **Zwei Migrationen sind live, ohne dass es je eine Datei gab**:
> `20260825204748_fix_websites_authenticated_crud_rls` (2026-08-25) und
> `20260829011038_onboarding_orchestrator_hardening` (2026-08-29). Beide
> wurden am 2026-08-30 wortgleich aus dem Ledger ins Repo nachgezogen,
> mit unveränderter Version, damit `db push` sie als angewandt erkennt und
> ein frisches `db reset` denselben Stand herstellt. Die erste ist
> sicherheitsrelevant: Sie trägt die INSERT/UPDATE/DELETE-Policies auf
> `public.websites`. Solange sie fehlte, hatte eine lokale Datenbank eine
> **andere Sicherheitslage als Produktion**.
>
> ² **Eine Edge Function lief ohne Quellcode im Repo — inzwischen geborgen**:
> `onboarding-orchestrator`, Version 4, angelegt 2026-08-29 01:06 UTC,
> zuletzt 01:17. Keine Git-History, kein Aufruf im Code, nicht in
> `src/config/production-edge-functions.ts`. `verify_jwt: true`. Die
> Migration aus ¹ vom selben Zeitfenster (01:10) gehört dazu — ein
> vollständiges Feature ging an Repo und CI vorbei nach Produktion.
>
> Am 2026-08-30 wurde der Quellcode aus der laufenden Function
> zurückgeholt und unverändert nach
> `supabase/functions/onboarding-orchestrator/` gelegt, samt
> `README.md` mit Herkunft, `ezbr_sha256` der deployten Version und
> Sicherheitsbewertung. **Damit sind Repo und Produktion jetzt in beide
> Richtungen deckungsgleich: 179 = 179, `comm` in beide Richtungen leer.**
> Der Weg war bewusst der additive — eine laufende Production-Function zu
> löschen wäre nicht rückholbar gewesen.
>
> **Weiterhin offen, aber keine Drift mehr, sondern eine Produktfrage**: Die
> Function wird nirgends aufgerufen. Ob der Onboarding-Pfad noch kommt oder
> das Feature aufgegeben wurde, entscheidet der Eigentümer.
>
> ³ **`public.integrations`**: RLS an, null Policies, kein Leserecht für
> `authenticated` — bei fünf vorhandenen, aktiven Zeilen. Die clientseitige
> Abfrage in `IntegrationMarketplaceView.tsx` lief deshalb immer leer, ohne
> Fehlermeldung (`if (!error) …` verschluckt sie). Behoben durch
> `20260831030000_integrations_catalog_read_access.sql`: Leserecht für
> `authenticated`, Policy auf `enabled is true`, kein Schreibrecht. Die
> Tabelle ist ein globaler Produktkatalog ohne `tenant_id` und ohne
> Zugangsdaten — die liegen in `connectors`.
>
> **Der wiederkehrende Befund ist nicht die Zahl, sondern das Muster.** Nach
> dem ACL-Vorfall vom 2026-08-23 ist dies der zweite und dritte belegte
> Eingriff direkt in Produktion, vorbei an Repo und CI. Für ein Produkt, das
> Prüfpfad und Nachvollziehbarkeit zusagt, ist jede solche Änderung ein
> Governance-Befund, unabhängig davon, wie gut sie inhaltlich ist.
>
> #### Die Guards hatten recht, bevor die Messung lief
>
> Am 2026-08-30 nachträglich geprüft: **Die Automatik hatte alles schon
> gefunden.** Die manuelle Messung hat nichts entdeckt, was die Drift-Guards
> nicht Tage vorher gemeldet hätten — sie hat nur jemanden gefunden, der
> hinsieht.
>
> | Guard | Stand | Befund |
> |---|---|---|
> | `Migration Drift Guard` | rot **seit 2026-08-26**, fünf Tage | nennt `20260825204748` und `20260829011038` namentlich |
> | `Edge Function Drift Guard` | rot **seit 2026-08-29** | `ORPHAN: onboarding-orchestrator`, inkl. Handlungsanweisung |
> | `Function ACL Drift Guard` | durchgehend grün | prüft Funktions-Grants, **nicht** RLS-Flags auf Tabellen → blinder Fleck, kein Versagen |
>
> Beide roten Guards nannten exakt den Fix, für den sich die Sitzung dann
> unabhängig entschieden hat: „Quelle ins Repo committen".
>
> **Die Betriebsfolge, die dabei fast untergegangen wäre**: Solange
> Migrations-Drift offen ist, bricht `supabase db push` vollständig ab —
> dann erreicht **keine** Migration mehr die Produktion, auch keine
> unbeteiligte. Der Guard sagt das in seinem eigenen Protokoll.
>
> **Daraus folgt nicht „mehr Prüfungen bauen", sondern „Befunde zustellen".**
> Ein roter Scheduled-Run erzeugt bestenfalls eine E-Mail, die niemanden
> erreicht, der handelt. Deshalb `.github/workflows/drift-alert.yml`: Es
> beobachtet die drei Guards per `workflow_run` und legt bei Rot ein
> GitHub-Issue an (bzw. kommentiert ein bestehendes, statt ein zweites zu
> öffnen); wird der Guard wieder grün, schließt es das Issue selbst. Die
> Guards bleiben unverändert — ihre Aufgabe ist Messen, nicht Melden.
>
> **Nächste Sitzung, bevor du misst**: Sieh in den Actions-Tab. Ein roter
> Drift-Guard ist der schnellere Weg zum Befund als jede eigene Messung.
>
> #### Die DB-Integrationstests laufen seit dem 2026-09-06 vollständig in CI
>
> Bis dahin lief im `db`-Job **eine** Datei gegen das voll migrierte Schema,
> später sechs. Begründet war das mit „7 der 23 Dateien scheitern dort" — und
> das stimmte. Nachgemessen scheiterte aber **keine** an einem Befund, sondern
> jede an einer Annahme des minimalen Harnischs (`scripts/test-db/up.sh`):
> eine feste Vorgabe-Mailadresse gegen `auth.users.email UNIQUE`, ein Insert
> in `public.app_secrets` statt in Vault, ein leerer Produktkatalog, ein
> Trigger, der jedem neuen Mandanten sofort ein Free-Tier-Abo anlegt.
>
> **Das Schwerwiegendste daran**: `rls.db.test.ts` war eine der sieben. Die
> Mandantentrennung ist laut §3 nicht verhandelbar — und ihr eigener Test lief
> in keinem CI-Lauf. Er läuft jetzt; alle 25 Dateien laufen, mit genau einer
> benannten Ausnahme (`entitlement-grants.db.test.ts`, siehe Kopf der Datei:
> sie bildet bewusst den Produktionsstand vom 2026-08-08 nach). Der Schritt
> nimmt das Verzeichnis, nicht eine Namensliste — sonst fehlt die nächste neue
> Datei wieder.
>
> **Zwei Befunde fielen dabei ab, und beide sind grundsätzlicher als die
> Testdateien:**
>
> **1. Das CI-Schema war durchlässiger als Produktion.** Ein pauschales
> `GRANT ... ON ALL TABLES IN SCHEMA public TO anon, authenticated` lief
> **nach** allen Migrationen und machte damit zwölf ausdrückliche `REVOKE`s
> wieder auf — darunter die sechs auf `mv_cost_*` / `mv_tenant_risk_*` und die
> Spaltenrechte, die `m365_connections.credentials_enc` schützen. Eine
> materialisierte Sicht kennt keine RLS-Policies; ihr Inhalt ist die fertige
> Aggregation über **alle** Mandanten. `mv-aggregates.db.test.ts` wies genau
> das nach und fiel dort um, ohne dass an der Sperre etwas falsch war.
> Behoben, indem CI die Default-Privileges jetzt **vor** den Migrationen setzt
> (so wie Supabase) und Matviews danach ausdrücklich sperrt. Gegen das
> Live-Projekt gemessen: dort tragen alle acht Matviews
> `{postgres, service_role}` — CI bildet das jetzt ab.
>
> **Regel daraus**: Das CI-Schema darf **strenger** sein als Produktion,
> niemals lockerer. Ein Test, der eine Sperre nachweist, ist sonst nichts wert
> — und schlimmer: Ein Test, der Zugriff nachweist, wird dort grün, wo
> Produktion sperrt.
>
> **2. Ein Test konnte die Testdatenbank dauerhaft verändern.** Jede Datei
> läuft in einer Transaktion, die zurückgerollt wird — darauf beruht die
> Isolation. `tenant-entitlements-callers` wandte `20260831020000`
> unverändert an, samt deren eigenem `COMMIT;`. PostgreSQL kennt keine
> geschachtelten Transaktionen: Das `COMMIT` schloss die **äußere**
> Transaktion ab und hinterließ `products`, `entitlements`, `subscriptions`
> und `entitlement_grants` dauerhaft in der Datenbank. Der nächste Lauf
> scheiterte an „relation subscriptions already exists" — an einem Zustand,
> den ein früherer Test hinterlassen hatte, nicht an einem Befund. Zwei
> Dateien hatten die Klammer einzeln entfernt, eine nicht. **Regel**: Eine
> Migration im Test nur über `applyMigration()` aus `db-helpers.ts` anwenden;
> die entfernt `BEGIN`/`COMMIT` an einer Stelle für alle.
>
> ¹ **Migrations-Lücke und Versionskollision, gemessen 2026-08-24** (Ledger via
> `supabase_migrations.schema_migrations`, Deploy-Log Run 32705231581): PR #1131
> und PR #1124 vergaben unabhängig voneinander dieselbe Version `20260826000000`
> (`whatsapp_channel` bzw. `restore_client_function_grants`) — die PR-CI konnte
> das nicht sehen, weil beide gegen eine `main`-Basis ohne die jeweils andere
> Datei liefen. Der `deploy.yml`-Lauf nach dem #1124-Merge scheiterte daran
> (CLI führte `whatsapp_channel` erneut aus → `42710`, Trigger existiert).
> Fix: `restore_client_function_grants` → `20260826000001` umbenannt. Die zwei
> unverbuchten Migrationen (`20260826000001`, `20260827000000`) sind inhaltlich
> bereits wirksam (out-of-band-Hotfix, per ACL-Messung belegt); es fehlt nur die
> Verbuchung durch den nächsten grünen Deploy. Lehre: Vor dem Merge eines PRs
> mit Migration die Versionsnummer gegen den **aktuellen** `main`-Stand prüfen,
> nicht gegen die PR-Basis.
>
> **Diese Aussage galt am 2026-08-24 und gilt nicht mehr.** Die Messung vom
> 2026-08-30 oben zeigt eine deployte Function ohne Verzeichnis
> (`onboarding-orchestrator`). In der anderen Richtung stimmt es weiterhin:
> Es gibt keine Function im Repo, die nicht deployt wäre. Das war ein
> Momentzustand, kein Naturgesetz: Der
> nächste Merge, der eine Function hinzufügt, öffnet die Lücke wieder, bis
> `deploy.yml` gelaufen ist.
>
> **Die Function-Lücke ist geschlossen.** Frühere Stände dieser Datei nannten
> „103 deployt, 74 fehlend" und erklärten das mit dem Kontingent des
> Free-Tarifs (`HTTP 402: Max number of functions reached`). Diese Erklärung
> ist überholt. Die Vermutung einer harten Schranke bei 100 hat sich
> erledigt — sie war schon beim Deploy von Function 101 (`siteos`) widerlegt.
>
> **Auch die Migrations-Lücke von damals ist geschlossen.** `20260821000000_b2_website_asset_relation`
> ist angekommen; am Schema geprüft, nicht aus der Liste geschlossen:
> `websites.governance_asset_id`, `scan_runs.asset_id` und der Constraint
> `findings_scan_run_fk` existieren live.
>
> **Was daraus für die Arbeitsweise folgt.** Zweimal stand hier eine
> Erklärung, die aus einer Beobachtung geschlossen war (erst der alphabetische
> Schnitt, dann das Tarif-Kontingent), und zweimal war sie falsch. Beide Male
> hätte eine Messung die Frage sofort beantwortet. Deshalb: messen, nicht
> herleiten — und die Messung mit Datum und Methode hinschreiben, damit die
> nächste Sitzung sie prüfen statt glauben muss.
>
> **ACL-Vorfall 2026-08-23**: Ein Out-of-Band-Bulk-Revoke (nicht aus dem Repo,
> Actor unbekannt, älter als das 24h-Log-Fenster) hatte ~160 `public`-Funktionen
> in Prod auf `{postgres, service_role}` reduziert und `update_onboarding_progress`
> gedroppt — Symptom: „permission denied for function is_tenant_member" auf
> /welcome, damit RLS für alle eingeloggten Nutzer kaputt. Repariert durch
> `20260826000001_restore_client_function_grants.sql` (gezielte Grants nur für
> Client-Rollen, interne Funktionen bleiben gesperrt). Konsequenz: Auch
> Funktions-ACLs gehören zur Drift-Prüfung, nicht nur Existenz von Functions
> und Migrationen — seitdem geprüft durch `npm run check:function-acls`
> (`.github/workflows/function-acl-drift.yml`, täglich 06:30 UTC; Soll-Listen
> im Skript nachziehen, wenn eine Migration Client-Grants ändert).
>
> Der Free-Tarif bleibt davon unberührt und bleibt ein eigener Befund: keine
> täglichen Backups, kein Point-in-Time-Recovery, kein SLA, Projekt-Pausierung
> bei Inaktivität. Für ein Produkt, das Prüfpfad, Evidence-Hash-Ketten und
> ISO-orientierte Prozesse zusagt, ist das unabhängig von jedem Limit ein
> Problem.
>
> Ein Modul, dessen Backend nie deployt wurde, ist in Produktion **nicht**
> verfügbar, egal wie vollständig der Code im Repo ist. Vor Aussagen zum
> Produktionsstand daher gegen `src/config/production-edge-functions.ts` bzw.
> `supabase functions list` prüfen.

- **Audit** (95%) — DSGVO-Scan, Recheck-Cron, Email-Drip, Share-Token
  > ⚠️ **Ausfall 2026-08-11 bis 2026-08-30, behoben.** `gdpr-audit/index.ts`
  > rief sechs nirgends definierte Funktionen auf — im Repo **und** in
  > Produktion (Version 46). Jeder `/audit`-Aufruf endete in HTTP 500;
  > `gdpr_audits` blieb 18 Tage bei 159 Zeilen.
  >
  > **Ursache — geschlossen.** Ein Gate gab es, aber es konnte diesen Fall
  > nicht sehen: `check:edge-syntax` ist bewusst ein reiner Parse-Check, und
  > eine Datei, die `runChecks(...)` aufruft, ohne dass `runChecks`
  > existiert, ist syntaktisch einwandfrei. Die Lücke lag **oberhalb** des
  > Syntax-Gates, bei der Auflösung der Namen — geschlossen durch
  > `check:edge-refs` (`f94ebf4`).
  >
  > **Zwei unabhängige Rekonstruktionen.** Der Ausfall wurde zweimal
  > behoben: `2305e3f` (auf `main`, live) und PR #1167. Aufgelöst nach
  > Entscheid des Eigentümers vom 2026-08-31 — **Struktur von `2305e3f`
  > (`gdpr-audit/checks.ts`), Vertrag aus der Messung**: Befund-Vokabular,
  > Severities und Scoring-Gewichte (25/12/6/2/0) stammen aus den 159
  > historischen Audits, festgehalten in
  > `test/fixtures/gdpr-audit-production-contract.json`.
  >
  > Die zweite Fassung wich in 12 Codes ab und liess 19 weg (darunter alle
  > sieben Unterseiten-Prüfungen). Schwerer wog ein stiller Fehler: Sie gab
  > die Fakten **flach** (`{'consent.banner.detected': true}`) statt
  > verschachtelt zurück. `getFact()` in `_shared/rules/evaluator.ts` zerlegt
  > den Pfad an den Punkten — flach liefert das `undefined`, und die
  > **gesamte Rule Engine (14 Regeln, DSGVO und AI Act) schwieg**, ohne dass
  > etwas bricht. Beleg: 61 von 159 historischen Audits trugen einen
  > `rule:`-Befund, die drei vom 2026-08-31 keinen einzigen.
  >
  > **Regel daraus**: Befund-Codes, Severities und Scoring-Gewichte sind
  > versionsrelevant. Wer sie ändert, entscheidet über die Vergleichbarkeit
  > aller bisherigen Kundenberichte — das gehört entschieden, nicht
  > nebenbei. Hergang: `docs/product/free-scan-recovery.md`.
- **Policy Packs** (100%) — DSGVO, EU AI Act, branchenspezifisch; Auto-Empfehlung nach Tenant-Branche
- **Evidence Vault** (90%) — Ingestion, Retrieval, Hash-Chain-Verifizierung, PDF/JSON-Export, Compliance-Hold
- **Governance Runtime** (85%) — Sentinel-Loop, SLO-Tracking, Auto-Mapping (Asset → Control-Status), Incident-Dispatch
- **Provenance / C2PA** (80%) — Ed25519-Signatur, Custody-Auto-Capture, externe Verifizierung
- **Memory Governance / RFC-003** (Phase 3, im Repo vollständig) — temporaler Verfall,
  Klassifikations-Unveränderlichkeit, Aufbewahrung mit Holds. Tabelle `governance_memory`,
  Zustandsautomat `active → cooling → archived → expired → purged`.
  Edge Functions: `governance-memory` (User-API), `memory-decay-worker` (stündlicher Cron),
  `memory-confidence-trigger` (Re-Bewertung bei neuer Evidence).
  UI: `/app/governance/memory`. Spezifikation: `docs/architecture/governance-memory-policy-rfc.md`.
  **Regel**: Die Schwellen (0.5 / 0.2 / 0.8), Aufbewahrungsklassen und Grace-Perioden
  stehen doppelt — in `src/core/governance/rfc003-memory.ts` und in der Migrations-SQL.
  Nie einseitig ändern; `test/governance/rfc003-sql-parity.test.ts` bricht sonst.
  **Betrieb**: Der Decay-Worker tickt nur, wenn der pg_cron-Job `memory-decay-hourly`
  registriert ist (Migration `20260819000000`) — ohne ihn verfällt kein Memory.
  **Registriert reicht aber nicht**, und genau darauf hat dieser Satz vertraut:
  Am 2026-09-01 gegen die Live-DB gemessen ist der Job seit dem 2026-08-12
  registriert, aktiv **und in jedem Lauf gescheitert** — das Vault-Secret
  `service_role_key` fehlt (siehe `20260820000000_cron_dispatch_fix.sql`).
  In Produktion verfällt heute kein Memory. Ohne Schaden, weil
  `governance_memory` leer ist, aber die Zusage steht ungedeckt.
  Prüfen also nicht an `cron.job`, sondern an `cron.job_run_details.status`.

  **Und es ist nicht dieser eine Job.** Nachgemessen am 2026-09-06 über alle
  15 registrierten pg_cron-Jobs: **vier** scheitern an genau diesem fehlenden
  Secret, zusammen **3629 Fehlläufe** seit dem 2026-08-12 —
  `scan-scheduler-dispatch` (2403, **noch nie** erfolgreich),
  `governance-monitoring-hourly` (601), `memory-decay-hourly` (600),
  `governance-monitoring-daily` (25). Damit liegt nicht nur RFC-003 still,
  sondern auch die Sentinel-Schleife der Governance Runtime und der
  **Scheduler, der ab Growth verkauft wird**. Die frühere Fassung nannte nur
  `memory-decay-hourly`, weil nur danach gefragt worden war; die anderen drei
  standen nirgends. Ein Job je Messung zu prüfen findet je Messung einen Job —
  der Sweep findet die Klasse.

  **Der Betreiberschritt bleibt beim Betreiber**: Der Service-Role-Schlüssel
  gehört nicht in Migration, Repo oder CI (§4). Anleitung, Befund und
  Nachprüfung: `docs/runbooks/cron-vault-secrets.md`.

  **Zugestellt wird das jetzt automatisch.** `Cron Health Guard`
  (`.github/workflows/cron-health.yml`, täglich 06:45 UTC,
  `npm run check:cron-health`) prüft je aktivem Job den **letzten** Lauf — nicht
  die Fehlerquote, denn `dsr-erasure-sweep` und `agent-os-runner-*` tragen
  hunderte Altfehler aus der GUC-Zeit und laufen heute sauber. `drift-alert.yml`
  hält daraus genau ein Issue offen. Bewusst **ohne** Ausnahmeliste: Ein
  bekannter Ausfall, der den Guard grün lässt, ist wieder ein Befund, den
  niemand sieht.


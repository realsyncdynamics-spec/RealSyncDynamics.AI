---
description: AP-3 Policy-SSoT — vier getrennte Phasen, Entscheidungen E-AP0 bis E-AP4, sichere Versionierung und Evidence
---

# AP-3 — Tenant Policy Single Source of Truth (SSoT)

> **Stand:** 2026-11-01 · **Basis:** `main@abdef5314dad3a7fdbd6b9c048565aef9a98d510` (read-only-Recherche).
> **Status:** dokumentierter, rekonstruierter **Entwurf**. Der ursprünglich erwähnte lokale Projekttext `claude/ap3-policy-ssot.md` war in dieser Session nicht zugänglich und wurde **nicht** als unverändert übernommene Quelle ausgegeben.
> **Owner-Freigabe:** E-AP0 bis E-AP4 am 2026-11-01 durch „Go“ für die **Planung und diesen Dokumentations-PR** bestätigt. **Kein GO für Produktionsabfragen, Migrationen, produktive Schreibpfade, Deploy oder Merge.**
> **Abgrenzung:** Dieser Auftrag ist **kein** Nachweis einer implementierten Policy-SSoT, nicht „live“ und kein Freibrief für autonome Policy-Änderungen.

## 0. Verbindliche Entscheidungen

| ID | Entscheidung | Sicherheitsgrenze |
|---|---|---|
| **E-AP0** | AP-3 als eigenständiges Paket planbar; AP-1a bis AP-2 im PLAN als **nicht beauftragt / nicht nachgewiesen** führen | Unverzichtbare technische Voraussetzungen trotzdem einzeln nachweisen; keine fiktiven abgeschlossenen Vorgänger |
| **E-AP1** | `governance_policies` ist die kanonische Quelle für mandantenspezifische Regeln; `ai_policies` bleibt die **globale Plattform-Basis** | Keine mandantenbezogenen `ai_policies` abschalten, löschen oder still ignorieren, bevor Produktionsbestand nach gesondertem GO geprüft und ein verlustfreier Migrationspfad akzeptiert ist |
| **E-AP2** | Neue append-only Tabelle `governance_policy_revisions` statt Änderung der vorhandenen `governance_policy_versions` | Alte Tabelle, Trigger und historische Datensätze unverändert erhalten; nachvollziehbarer, idempotenter Backfill |
| **E-AP3** | Wirksamer Snapshot bei jedem Policy-Write | Versions-/Snapshot-/Evidence-Konsistenz in einer überprüfbaren atomaren Grenze; Fehler führen zum Abbruch der wirksamen Änderung |
| **E-AP4** | ADR 0010 und `docs/specs/governed-self-evolution/` führen die übergeordneten Governance-Verträge; diese AP-3-Datei und die OS-Funnel-Spec dokumentieren Ist-/Plan-Abgleich | Querverweise in beiden Spec-Familien nachziehen und Widerspruch zu E-GE5 vor Implementierung auflösen |

E-GE5 aus PR #2126 untersagt mandantenübergreifendes Lernen, einschließlich anonymisierter gemeinsamer Lernnutzung. `docs/specs/governed-self-evolution/GOVERNANCE_BOUNDARY_SPEC.md` §11 lässt derzeit explizit autorisierte Cross-Tenant-Aggregation/Lernen zu: **Vertragskonflikt**, keine implizite Ausnahme. Bis zur harmonisierten Owner-Freigabe das strengere Verbot als Zielarchitektur ansetzen, nicht autonom umdeuten. PR #2126 ist **offen**, also nicht als gemergten Ist-Stand behandeln.

**Wichtig:** AP-3 ist die administrative, überprüfbare **Policy-Speicher- und Schreibarchitektur**. Das autonome Governed-Evolution-Gate darf weder Governance-Policies noch seine eigenen Trust-Boundaries selbst verändern. Siehe `docs/adr/0010-native-evolution-governance.md`, `docs/specs/governed-self-evolution/GOVERNANCE_BOUNDARY_SPEC.md` und `DOMAIN_CONTRACTS.md` (`GovernanceDecision.policy_version`).

## 1. Nachgewiesener Bestand (Referenz: main@abdef531)

| Pfad | Befund / AP-3-Folge |
|---|---|
| `supabase/functions/_shared/pdp/decide.ts` | `loadSnapshot` liest aktivierte `ai_policies` für Tenant **oder global** und `governance_policies` nur für den Tenant. Pro-Instanz-Cache mit `PDP_CACHE_TTL_MS = 30_000`. `persistSnapshot` ist aktuell **best-effort**; ein Persistenzfehler bricht Entscheidungen nicht ab. |
| `supabase/functions/_shared/pdp/core.ts` | Der bestehende `snapshot.version`-Wert ist ein aus kompilierten Policies abgeleiteter FNV-1a-Fingerprint, **keine** monotone per-Policy-Revisionsnummer. Die Begriffe nicht verwechseln. |
| `supabase/migrations/20260512000000_governance_events.sql` | `governance_policies` hat derzeit keine adressierbare eigene Versionsnummer; `governance_events` und `governance_evidence` existieren. |
| `supabase/migrations/20260620000004_governance_policy_versions.sql` | Alte Historientabelle sichert `OLD` bei `UPDATE/DELETE` auch für Assets; kein vollständiger Create-/Versions-Contract. Diese Migration **nicht** umschreiben. |
| `supabase/migrations/20260824090000_pdp_snapshots_shadow.sql` | `policy_snapshots` ist mandantenbezogen mit `UNIQUE(tenant_id, version)` und `compiled`-Payload. `pdp_shadow_log` ist Live-Vergleich, kein Offline-Replay. |
| `supabase/functions/governance-resources/index.ts` | Erstellt/ändert/deaktiviert `governance_policies`; direkter Schreibpfad. |
| `supabase/functions/policy-packs/index.ts` | Erstellt/aktualisiert Regeln bei Pack-Aktivierung; direkter Schreibpfad. |
| `supabase/functions/provision-tenant/index.ts` | Erstellt Policy-Zeilen aus Templates beim Tenant-Boot; direkter Schreibpfad. |
| `supabase/functions/governance-ingest/index.ts` | Policy-Lese-/Auswertungspfad; der automatische `policy_snapshot`-Evidence-Eintrag ist in einem Teilpfad noch **ungekettet** (bekanntes O1b). Kein vierter Policy-Schreibpfad. |
| `docs/specs/governed-self-evolution/DOMAIN_CONTRACTS.md` | `GovernanceDecision` verlangt ein `policy_version`-Feld. Seine Referenzierung muss nach AP-3 eindeutig und reproduzierbar sein. |
| `.claude/os-funnel/PLAN.md` §4 | AP-1a → AP-1b → AP-1c → AP-1d → AP-2 → AP-3 bisher als Reihenfolge, nicht als nachgewiesene Aufträge. |

**Nicht gemessen:** reale Produktionszeilen in `ai_policies` und `governance_policies`, Deployment-/Migrationsstatus, Ausmaß historischer Drift und tatsächliche Schreibberechtigungen in Prod. Keine Annahme „0 Tenant-Zeilen“ und keine Behauptung einer produktiv aktiven AP-3-Implementierung.

## 2. Arbeitsdisziplin und Gates (gilt für alle Phasen)

1. **Ein Teilpaket = ein Branch = ein PR**; nur sein eigener Umfang. Vor jeder Session `main` und offene PRs neu prüfen. **Bei >20 offenen PRs stoppen** (WIP-Regel).
2. Vor Änderungen betroffene Pfade per `rg`/GitHub belegen, vorhandene Funktionen/Trigger/RLS/Tests inventarisieren; neue Migrationen nur **additiv**, mit einzigartigem Timestamp und eigener Freigabe. Bereits angewandte Migrationen nie ändern.
3. Tenant-Autorität serverseitig aus `JWT user → memberships → tenant_id → Rolle/Policy` bzw. vertrauenswürdigem Boot-Kontext; **nie** aus unvalidiertem Body, URL oder `localStorage`. Keine Service-Role im Browser.
4. Keine stille Überschreibung, keine Cross-Tenant-Reads/-Writes, kein Umgehen von RLS oder Gate, keine automatische Promotion, keine synthetische Evidence, keine Ersetzung eines fehlenden Checks durch Erfolgsbehauptungen.
5. **No-Go ohne separates ausdrückliches Owner-GO:** jede Produktionsabfrage (auch SELECT), SQL-Migration/Backfill/DDL in jeglicher verbundenen DB, Produktiv-Secret, Deploy, Merge, Live-Checkout oder produktiver Policy-Write. Das heutige „Go“ gilt ausschließlich für Entscheidungen und die **Dokumentationsarbeit**.
6. Ein offener PR ist keine deployte Wahrheit. Insbesondere #2126 (E-GE2/5–8) und #2122 (WP7a) vor jeder Abhängigkeit erneut prüfen; keine konkurrierenden Textabschnitte parallel überschreiben.
7. Bei unerfüllter Atomizität, unklarer Migration, offenen Tenant-Daten oder unklarer Versionsbindung **fail closed** und konkreten Blocker im PR dokumentieren.

## 3. AP-3a — Planung und Bestandsaufnahme (jetzt als Dokumentation erlaubt)

**Ziel:** `PLAN.md` nachführen, Vorbedingungen aus AP-1a bis AP-2 präzise benennen, aktuelle Producer-/Consumer-Matrix mit Datei und Zeilen erstellen, Alt- und Zielzustand unterscheiden. Die Namen von AP-1a bis AP-2 bleiben **nicht beauftragt / nicht nachgewiesen** und dürfen nur bei echten Belegen auf DONE wechseln. Die Governance-Sicherheitsvorbedingungen (Tenant-Isolation, Autorisierung, Evidence, Rollback) bleiben trotzdem Gates.

**Zwei und nur zwei vorgeschlagene Produktions-Zählabfragen:** erst nach **einem separaten ausdrücklichen GO für read-only Prod-SELECT**; aggregiert, ohne tenant_id, E-Mails oder Policy-Inhalte auszugeben. Vor Ausführung Zielprojekt, Rolle und Abfrageumfang protokollieren.

~~~sql
-- Q1: globale vs. mandantengebundene ai_policies (keine IDs)
SELECT (tenant_id IS NULL) AS is_global, count(*) AS policy_count
FROM public.ai_policies
GROUP BY (tenant_id IS NULL)
ORDER BY is_global DESC;

-- Q2: Zahl von Tenant-Policies und betroffenen Mandanten (keine IDs)
SELECT count(*) AS policy_count,
       count(DISTINCT tenant_id) AS tenant_count
FROM public.governance_policies;
~~~

Wenn Q1 Mandantenzeilen ergibt: keinen automatischen Wechsel auf „global only“ durchführen. Vorher Klassifikation, Besitz, fachliche Semantik, Priorität, Konfliktfälle und migrationsfähiges Mapping klären; hierfür separate Datenschutz-/Datenfreigabe bei Detailabfragen. Keine „Zählung = Null“-Annahme.

**3a-Deliverables:** PLAN-Nachtrag E-AP0–E-AP4, Matrix aller drei Writes und aller Reads, RLS/Service-Role-Autorität, Konfliktliste `ai_policies` vs. `governance_policies`, Migrationsentwurf mit Rollback-/Backout-Plan, Freigabeanforderungen und das offene E-GE5-Spec-Divergenzticket. Kein Produktiv-SELECT als Bestandteil dieses Doku-PRs.

## 4. AP-3b — Versioniertes Policy-Register (NEUES, separates GO nötig)

**Test-first.** Erst DB-Tests und Erwartungsverhalten festlegen; danach neue, additive Migrationsdatei planen. Modell mindestens:

- `governance_policies.version` als pro Policy **monoton steigende Ganzzahl**; Startwert und Update-Regeln dokumentieren. Nicht mit `policy_snapshots.version` (Content-Fingerprint) gleichsetzen.
- Neue `governance_policy_revisions`: eindeutiger Revisionsschlüssel (z. B. `policy_id + version`), `tenant_id`, Operation (create/update/deactivate; delete nur nach gesonderter Designprüfung), unveränderliches vollständiges Policy-Snapshot, Actor/Origin, Zeit, Vergleichsversion/Correlation-ID und referenzierbare Evidence. Tenant-Scope und Fremdschlüssel-/Tombstone-Verhalten explizit prüfen.
- Backfill bestehender Policies **idempotent** mit eindeutiger Ursprungsklassifikation („Bestandsaufnahme“, **nicht** fiktiv rekonstruierte Historie). Die vorhandene `governance_policy_versions` einschließlich Trigger für Policies/Assets unangetastet lassen.
- Schreibwege gegen Lost Updates absichern: Expected-Version/CAS oder vergleichbare DB-seitige Transaktionssperre. Zwei konkurrierende Writes dürfen nie dieselbe neue Version erzeugen. Idempotency-Key für retried Requests.
- DB-RLS: Tenant-Rollen erhalten nur berechtigte Reads; Revisionen dürfen nicht von normalen Clients geschrieben, geändert oder gelöscht werden. Für privilegierte/SECURITY-DEFINER-Pfade explizite Checks, Tests gegen fremde Tenant-IDs, geprüfter `search_path`.
- Evidence und unveränderliche Revision **konsistent** zum Policy-Zustand erzeugen. **Mehrere aufeinanderfolgende Supabase-Aufrufe aus einer Edge Function sind keine gemeinsame DB-Transaktion.** Transaktionale DB-RPC oder gleichwertiges Design vor Implementierung entscheiden; bei Evidence-Fehler keine wirksame neue Version.

**Negative Tests:** parallele Updates, falsche erwartete Version, Duplicate/Retry, RLS Tenant A→B, fehlender Actor, abgebrochener Backfill, Trigger-Doppelung, Delete-Semantik, fehlende Evidence, Rollback-Wiederholung. Keine Umsetzung oder Ausführung ohne neues GO.

## 5. AP-3c — Ein kanonischer Schreibvertrag (NEUES, separates GO nötig)

Ein gemeinsamer serverseitiger Einstiegspunkt unter `supabase/functions/_shared/policyStore.ts` für genau die im aktuellen Repo belegten Policy-Writer:

1. `governance-resources/index.ts` — Create, Enable/Disable, Update;
2. `policy-packs/index.ts` — Create/Update bei Pack-Aktivierung;
3. `provision-tenant/index.ts` — Template-/Boot-Create.

**API-Vertrag:** authentifizierter/vertrauenswürdiger Kontext mit abgeleiteter `tenant_id`, Actor/Origin, gewünschter Operation, Expected-Version, Idempotency-Key; die eigentliche atomare Persistenz gehört unter einen DB-Transaktionsanker. Gemeinsame Validierung und konsistente Fehlermodelle; unzulässige/nicht eindeutig gebundene Schreibversuche blockieren.

**Evidence-Vertrag:** die bestehende `append_governance_evidence`-Kette respektieren; Event/Revision/Policy/Snapshot eindeutig verlinken. Eine getrennt nachgelagerte Evidence-Anhängung **reicht nicht** zur behaupteten Atomizität. Bestehende `governance_events`- und `governance_approvals`-Fremdschlüssel beachten (`event_id`: NOT NULL/UNIQUE); kein neues Approval-Feature und keine `kind = 'policy_change'`-Migration in AP-3.

Tests pro Writer plus Integration: alter erfolgreicher Ablauf erhält dieselbe Bedeutung, Fehler führt zu **keinem** teilweise wirksamen Write, Retry erzeugt keine Duplikate, keine Tenant-Grenzüberschreitung, korrektes Rollen-/Entitlement-Gate. `governance-ingest` bleibt separat als **Leser** zu prüfen, nicht blind an den Store anschließen.

## 6. AP-3d — Snapshot-on-Write und Replay-Basis (NEUES, separates GO nötig)

- Bei jedem **wirksamen** Tenant-Policy-Write muss die genaue **auswertbare** Policy-Menge einschließlich der gültigen globalen `ai_policies`-Basis reproduzierbar an eine Version gebunden werden. Policy-Revisionsnummer, tenantweiter Snapshot-Fingerprint, globale Baseline und eventuelle Gate-Version sind **verschiedene** Identifikatoren.
- Snapshot muss **atomar mit dem wirksamen Write** vorliegen oder der Write bleibt nicht wirksam. Da Kompilierung derzeit in TypeScript statt im SQL-Trigger liegt, ist das Transaktionsdesign vor Codefreigabe ausdrücklich zu entscheiden (z. B. prävalidierter kanonischer Payload plus DB-RPC, serverseitige Nachvalidierung, sichere Aktivierung erst nach Persistenz). Keine verdeckte Best-Effort-Stufe.
- Cache-Invalidierung über alle Instanzen berücksichtigen: aktuelle 30-s-Instanz-Caches dürfen nach Commit keine alten Policies als neue Version ausgeben. Falls sofortige Invalidierung nicht garantiert werden kann, kontrollierte Aktivierung/versioniertes Lesen bis zur Synchronisation; keine falsche „instant“-Behauptung.
- `policy_snapshots` als unveränderliche Replay-Eingabe; Offline-Replay nach E-GE6 **read-only**, keine Side Effects, keine Umstellung des `pdp_shadow_log`-Schemas. Input, Tenant, Regel-/Gate-Version, erwartete und simulierte Entscheidung sowie Evidence referenzierbar halten.
- Bei fehlendem Snapshot, Drift zwischen Quellen, nicht verfügbarem Evidence-Gate oder unbekannter Version **fail closed**. Den bestehenden ungeketteten `governance-ingest`-Snapshot-Evidence-Pfad O1b separat prüfen, nicht still als gelöst markieren.
- Tests: Write→Revision→Snapshot→Decision→Evidence-Korrelation, Global-Baseline-Änderung, Parallelität, Cache-Staleness, Rollback, Replay ohne Write/Provider/Netzwerk, Tenant-Isolation, deterministische Wiederholung.

## 7. Dokumentationshierarchie und Konfliktliste

- **Normative Governance-Grenzen:** `docs/adr/0010-native-evolution-governance.md` und `docs/specs/governed-self-evolution/` (insbesondere `GOVERNANCE_BOUNDARY_SPEC.md`, `DOMAIN_CONTRACTS.md`).
- **AP-3-Implementierungsauftrag:** diese Datei; **Funnel-/Ist-Abgleich:** `.claude/os-funnel/PLAN.md` und `.claude/os-funnel/governed-evolution.md`.
- In AP-3a die **beidseitigen Querverweise** zwischen diesen Spec-Familien herstellen, ohne bereits angenommene Architekturregeln zu überschreiben. Den Cross-Tenant-Widerspruch ausdrücklich beheben; Änderungen an ADR 0010/Governance Boundary nur in eigenem prüfbaren Dokumentationsschritt mit Owner-Review.
- E-GE2 (Vier-Augen/Solo 72 h) und E-GE7/E-GE8 (Proposal-Typ/Approval-Gate) gehören zur späteren Governed-Evolution-Implementierung **nach** AP-3. Sie sind keine heimlichen AP-3-Migrationsbestandteile.

## 8. Definition of Done / Abschlussbericht

Für jeden **separat freigegebenen** Phasen-PR berichten: aktuelle `main`-SHA, Scope, Dateien/Zeilen, Schema-Diff, Rollen und Tenant-Bindung, Transaktions-/CAS-Garantie, Evidence-Kette, Policy-Version vs. Snapshot-Fingerprint, Backfill-/Rollback-Konzept, Kompatibilitätsprüfung, tatsächlich ausgeführte Tests mit Ergebnissen, weiterhin offene Risiken und ausdrücklich ausstehende Owner-GOs.

**AP-3a DONE:** Dokumentationsmatrix und Entscheidungen nachvollziehbar, nur lesende Repo-Recherche durchgeführt; Produktions-SQL entweder gesondert freigegeben/ausgeführt oder ausdrücklich offen. **AP-3b/c/d sind durch diesen Auftrag nicht begonnen und nicht freigegeben.**

Kein „live“, „revisionssicher“, „production-ready“ oder „atomar“ ohne Test und Laufzeitnachweis. **Kein Merge / kein Deploy / keine Migration allein wegen dieses Auftrags.**

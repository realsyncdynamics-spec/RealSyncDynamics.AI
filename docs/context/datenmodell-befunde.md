# Datenmodell — Befunde und Korrekturen (Archiv)

> Ausgelagert aus `CLAUDE.md` §3, damit der Kern-Kontext klein bleibt.
> Zwei abgeschlossene, aber lehrreiche Befunde: der fehlende Erzeugungspfad für
> `profiles` und die sieben Tabellennamen, die ins Leere zeigten.
> **Regel bleibt**: Vor dem Hinzufügen eines Tabellennamens gegen `pg_tables`
> prüfen, nicht gegen die Erinnerung.

## `profiles` ohne Erzeugungspfad (behoben 2026-09-06)

⚠️ **`profiles` hatte bis zum 2026-09-06 keinen Erzeugungspfad.** Gemessen
gegen Produktion: 6 Nutzer, **1 Profil**. Kein Teilproblem, sondern ein
geschlossener Kreis — `handle_new_auth_user` legte Mandant und
Mitgliedschaft an, aber kein Profil; **keine** Migration im Repo insertete
je in `profiles`; und die Tabelle trägt Policies für SELECT und UPDATE,
aber **keine für INSERT**. Serverseitig kein Pfad, clientseitig kein Recht.

**Die stillste Folge zuerst**: `SettingsView` und `AiResidencySettings`
schreiben mit `.update() … .eq('id', …)`. Ein UPDATE ohne Treffer ist kein
Fehler — PostgREST liefert `error: null`. Beide Oberflächen meldeten
„gespeichert" und behielten nichts, auch nicht die
**KI-Datenresidenz-Präferenz** (`ai_data_residency`, EU-lokal vs. Cloud).
Dieselbe Fehlerform wie bei `public.integrations` (§5 ³): kein Fehler,
kein Ergebnis. Daneben fehlte der Abschnitt `profile` in jeder
`gdpr-export`-Auskunft nach Art. 15 DSGVO. Die `is_super_admin`-Prüfungen
sind unschädlich — sie schlagen fail-closed aus.

Behoben durch `20260906200000_profiles_on_signup.sql`: Der Trigger legt
das Profil mit an, die fünf Bestandsnutzer werden nachgetragen. **Der
Insert steht vor dem Mitgliedschafts-Wächter** — dahinter liefe er für
keinen Bestandsnutzer, weil der Early-Return greift, sobald eine
Mitgliedschaft existiert. `test/db/profiles-on-signup.test.ts` hält genau
diese Reihenfolge fest.

## Sieben Namen, die ins Leere zeigten (gemessen 2026-08-31)

#### ⚠️ Sieben Namen in dieser Liste zeigten ins Leere

**Gemessen 2026-08-31** gegen das Live-Projekt `ebljyceifhnlzhjfyxup`
(`pg_tables` / `pg_views`, jeder Name einzeln geprüft; Ledger über
`supabase_migrations.schema_migrations`). Bis dahin nannte dieser Abschnitt
sieben Tabellen, die **in Produktion nicht existieren**:

| genannt | Migration im Repo | tatsächlich zu verwenden |
|---|---|---|
| `governance_controls` | keine | `framework_controls` (219 Zeilen) + `compliance_frameworks` (5) |
| `policy_packs` | keine | `policy_pack_catalog` (7), `policy_pack_controls` (196) |
| `evidence_retention` | keine | `ai_evidence_retention` |
| `connectors` | keine | `integration_connectors`, `enterprise_connectors` |
| `dsr_tracker` | keine | `dsr_requests` |
| `operations_inventory` | keine | `inventory_items` und die `inventory_*`-Familie |
| `audit_evidence` | **`20260507100000`** | Sonderfall, siehe unten |

Für sechs der sieben gilt: kein `CREATE TABLE` im Repo, keine einzige
Abfrage im Code. Der Schaden lag allein darin, dass diese Datei die
Namensautorität ist — wer sich beim Bauen darauf verließ, schrieb gegen
etwas, das es nicht gibt. Genau das ist beim MCP Governance Server
passiert: Dessen Governance-Werkzeuge waren gegen `governance_controls`
entworfen und mussten auf `framework_controls` umgestellt werden.

**`audit_evidence` ist der Sonderfall — und der einzige mit Wirkung.**
Die Migration `20260507100000_audit_evidence.sql` existiert und steht im
Ledger als **angewendet**; die Tabelle fehlt in Produktion trotzdem. Das ist
der Ledger-Wirklichkeits-Bruch, den `DEBUG_ROOT_CAUSE_2026-08-02.md` und
`docs/audit/01_INVENTORY.md` §339 bereits beschreiben. Spätere Migrationen
(`20260619000000`, `20260723000001`) fangen ihn mit `to_regclass`-Wächtern
ab und überspringen ihre Trigger und Policies mit `RAISE NOTICE`.

**Behoben am 2026-09-06** durch `20260906000000_reconcile_audit_evidence.sql`
— additiv, idempotent, nach dem Muster von `20260822000000`. Sie legt
Tabelle, Indizes, RLS-Policy (`is_tenant_member`), die Append-only-Trigger,
den in `20260619000000` übersprungenen Aktivierungs-Trigger **und den
Storage-Bucket** an. Vor dem Merge vollständig gegen das Live-Schema
ausgeführt und zurückgerollt.

**Zwei Korrekturen an dem, was hier vorher stand.** Beide stammen aus der
Messung vom 2026-09-06, beide gehen in dieselbe Richtung — die frühere
Fassung war zu sicher:

1. **Es ging nichts verloren.** Hier stand, der Screenshot-Nachweis „eines
   jeden Audits" gehe still verloren, weil `worker/src/persistence.ts`
   (`recordScreenshotEvidence`) non-fatal gegen die fehlende Tabelle
   insertet. Gemessen ist die ganze Worker-Pipeline in Produktion leer:
   `audit_jobs` 0, `scan_runs` 0, `findings` 0. Der Produktions-Auditpfad ist
   die Edge Function `gdpr-audit` (173 Zeilen in `gdpr_audits`); der Worker
   hat dort nie gelaufen. Der Satz war aus dem Code hergeleitet, nicht aus der
   Datenbank gelesen — genau der Fehler, den der Kasten selbst anprangert.
2. **Der Bucket fehlte auch.** `storage.buckets` führte `audit-evidence`
   nicht. `crawler.ts` lädt den Screenshot dorthin und ruft
   `recordScreenshotEvidence` erst danach — der Upload wäre also schon vor dem
   Insert gescheitert. Wer nur die Tabelle nachgezogen hätte, hätte den Pfad
   nicht funktionsfähig gemacht und das für erledigt gehalten.

**Bewusst nicht mitgenommen**: die View `v_findings_with_evidence` aus der
Ursprungsmigration. Sie liest `audit_findings.audit_id` und `.rule_id`;
Produktion führt eine andere `audit_findings` mit `audit_report_id` und
`control_reference`. Ein Replay wäre mit 42703 abgebrochen und hätte
`supabase db push` blockiert — für jede nachfolgende Migration mit. Welche
der beiden Definitionen gelten soll, ist eine offene Schemafrage wie bei
`runtime_events` in `20260822000000`.

**Lehre, dieselbe wie in §5**: messen, nicht herleiten — und zwar
vollständig. Die erste Fassung dieses Kastens behauptete, `audit_evidence`
sei „nie angelegt" worden und kein Code greife zu. Beides war falsch: Der
zugrunde liegende `grep` hatte `worker/` nicht eingeschlossen und das
Migrations-Ledger gar nicht erst befragt. Eine Tabellenliste in einer
Kontextdatei altert still — sie bricht nichts, sie führt nur die Leser in
die Irre, die ihr am meisten vertrauen. Vor dem Hinzufügen eines Namens
hier: gegen `pg_tables` prüfen, nicht gegen die Erinnerung.

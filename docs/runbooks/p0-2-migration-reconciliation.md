# Runbook — P0-2: Migrations-Ledger reconcilen und `db push` entsperren

**Stand:** 2026-08-03 · **Befund:** `DEBUG_ROOT_CAUSE_2026-08-02.md` · **Status:** teilweise erledigt

> ## ⚠️ Nachtrag 2026-08-10 — Schritt 1 ist erledigt, die Blockade hat sich verschoben
>
> **Die Ledger-Waisen sind weg.** #932 ist gemergt; alle zwölf Versionen haben inzwischen
> eine Repo-Datei (lokal verifiziert). `db push` bricht **nicht mehr** mit
> „Remote migration versions not found" ab, sondern läuft an und wendet Migrationen an.
> Schritt 1 unten ist damit gegenstandslos — der Notfallpfad (`repair --status reverted`)
> erst recht.
>
> **Neue Blockade:** Der Push scheitert jetzt an der zweiten Migration:
>
> ```
> Applying migration 20260602000000_runtime_events_kernel_v1.sql...
> ERROR: column "occurred_at" does not exist (SQLSTATE 42703)
> create index if not exists runtime_events_tier_idx
>   on public.runtime_events (tenant_id, event_tier, occurred_at desc)
> ```
>
> **Ursache — zwei konkurrierende `runtime_events`-Designs:**
>
> | | Zeitspalte | erstellt in |
> |---|---|---|
> | `runtime_core` | `occurred_at` | `20260516300000_runtime_core.sql` |
> | Backbone | `ts` | `20260602100000_runtime_events_backbone.sql` |
>
> Produktion fährt das **Backbone-Schema** (verifiziert am 2026-08-10 gegen die Live-DB):
> `global_seq, tenant_seq, id, spec_version, tenant_id, ts, ingested_at, type, severity,
> source, review_status, subject_ref, payload, evidence_refs, trace_id, correlation_id,
> causation_id, prev_hash, event_hash`.
> Das ist auch die Struktur, gegen die alle Edge Functions schreiben.
>
> `kernel_v1` wurde dagegen für das `runtime_core`-Schema geschrieben und indiziert auf
> `occurred_at` — eine Spalte, die es in Produktion nicht gibt. Die Migration läuft in
> einer Transaktion, scheitert an Statement 11 und wird komplett zurückgerollt; deshalb
> fehlt auch `event_tier` in der Live-Tabelle.
>
> **Warum CI das nicht fängt:** Die `Migration validation` startet auf leerem Postgres.
> Dort läuft `runtime_core` zuerst und legt `occurred_at` an — der Index passt, der Job
> ist grün. Gegen Produktion, wo die Tabelle bereits im Backbone-Schema existiert
> (`create table if not exists` → `runtime_core` tat dort nichts, der Ledger-Eintrag
> wurde trotzdem gesetzt), schlägt derselbe Befehl fehl. **CI und Produktion testen
> unterschiedliche Schemata.**
>
> **Zweiter, stiller Konflikt:** `kernel_v1` will `causation_id bigint` anlegen; live ist
> die Spalte `uuid`. Wegen `add column if not exists` gibt das keinen Fehler — der
> Typunterschied bleibt einfach bestehen.
>
> **Offene Entscheidung** (nicht eigenmächtig getroffen, weil architektonisch):
>
> 1. *Index defensiv machen* — die beiden Index-Statements in einen `DO`-Block, der die
>    vorhandene Zeitspalte nutzt und sonst überspringt. Minimal-invasiv, entsperrt die
>    Pipeline, ändert keine Semantik.
> 2. *`repair --status applied 20260602000000`* — überspringen, weil Backbone die
>    Migration überholt hat. Keine Code-Änderung, aber ein frisches Environment bekommt
>    die Spalten nie.
> 3. *Klären, welches `runtime_events`-Design gelten soll,* und die unterlegene Migration
>    zurückbauen. Sauberste, aber größte Variante.
>
> Empfehlung: (1) als Sofortmaßnahme, (3) als Nacharbeit — sonst bleibt die Divergenz
> zwischen CI und Produktion bestehen und der nächste Schema-Konflikt kommt bestimmt.
>
> **Unabhängig davon** blockiert das Supabase-Function-Limit den zweiten Deploy-Job:
> `docs/runbooks/edge-function-kontingent.md`.

Stellt den Produktions-Zustand wieder her, in dem `supabase db push` durchläuft.
Aktuell erreichen **118 von 244** Migrationen die Produktion nicht, wodurch **66 von 148**
vom Frontend abgefragten Tabellen fehlen (`HTTP 404` / `PGRST205`) und die Governance-UI
leer bleibt.

---

## Vorbedingungen

Alle drei müssen **vorher** in `main` sein — die Reihenfolge ist inhaltlich begründet,
nicht kosmetisch:

| PR | Warum zwingend vorher |
|---|---|
| ~~#941~~ ✅ **gemergt 2026-08-03** | Machte `20260608000001_user_consents` idempotent. Ohne das wäre `db push` an Position ~13 von 118 mit `42710 policy already exists` abgebrochen. Auf `main` verifiziert: zwei `DROP POLICY IF EXISTS` vorhanden. |
| #942 | Benennt die `autonomous_agents_core`-Tabellen um. Ohne das aktiviert der Push RLS und legt Policies auf **drei produktiven Tabellen** an (`agent_runs`, `agent_tasks`, `agent_events`) — fehlerfrei und damit unbemerkt. |
| #932 | Liefert die Repo-Dateien für die 11 Ledger-Waisen nach. **Damit entfällt die Ledger-Operation komplett** — siehe Schritt 1. |

Zusätzlich:
- **Logischen Dump ziehen** (siehe Rollback — auf dem Free-Plan gibt es keinen
  automatischen Wiederherstellungspunkt):
  ```bash
  supabase db dump --linked -f "pre-push-$(date -u +%Y%m%dT%H%M%SZ).sql"
  ```
  Datei außerhalb des Repos ablegen und Zeitstempel notieren.
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD` verfügbar.

---

## Schritt 1 — Ledger: nichts tun (sofern #932 gemergt ist)

`db push` bricht ab, solange eine Remote-Version keine passende Repo-Datei hat
(`Remote migration versions not found in local migrations directory`). Betroffen sind
12 Versionen.

**#932 löst das, ohne den Ledger anzufassen:** Der PR stellt für die 11 echten Waisen die
Original-Migrationen 1:1 aus `supabase_migrations.schema_migrations` wieder her. Die
zwölfte (`20260510`) hat mit `20260510_ai_governance_core.sql` bereits eine Repo-Datei.
Danach hat jede Remote-Version ihr lokales Gegenstück und `db push` läuft direkt durch.

> **Diesen Weg bevorzugen.** Er ist der sicherere: Der Ledger bleibt unangetastet, die
> reale Historie bleibt im Repo nachspielbar (`supabase db reset` reproduziert Prod), und
> es gehen keine Informationen verloren.

<details>
<summary>Nur als Notfallpfad, falls #932 nicht mergebar ist: Ledger reverten</summary>

Diese Variante wirft die Historie der 11 Waisen weg — die Objekte bleiben zwar in Prod,
aber ein frisches Environment hätte sie nie. Nur einsetzen, wenn #932 ausfällt.

```bash
supabase link --project-ref "$SUPABASE_PROJECT_ID"

supabase migration repair --status reverted \
  20260510 \
  20260628121531 20260628121551 20260628121603 \
  20260628193744 20260628193759 20260628193820 \
  20260701121059 20260715105402 \
  20260720123325 20260720123711 20260720124405
```

`20260510` ist dabei unbedenklich (5× `CREATE TABLE IF NOT EXISTS`, der eine
`ADD CONSTRAINT` hat ein `drop constraint if exists` davor), ebenso die sechs `bots_*`
(Duplikate der idempotenten Repo-Fassung `20260628120000/100/200`).

</details>

---

## Schritt 2 — Push

```bash
supabase db push --include-all 2>&1 | tee /tmp/db-push.log
```

Bricht der Push ab: **nicht wiederholen**, sondern die fehlgeschlagene Migration im Log
identifizieren. Die Trockenanalyse fand genau einen Blocker (`user_consents`, via #941
behoben) — ein weiterer wäre ein neuer Befund und gehört analysiert, nicht überfahren.

---

## Schritt 3 — Verifikation

```sql
-- Muss danach 8 Zeilen liefern (Auswahl aus den 66 zuvor fehlenden Tabellen):
SELECT relname FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
  AND relname IN ('policy_pack_catalog','websites','audit_jobs','terminal_sessions',
                  'webhook_endpoints','signing_keys','iso42001_controls','nis2_deadlines')
ORDER BY relname;

-- Gegenprobe: die produktiven agent_os_substrate-Tabellen dürfen sich NICHT verändert haben
SELECT tablename, count(*) AS policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('agent_runs','agent_tasks','agent_events')
GROUP BY tablename;
-- erwartet: agent_runs 2, agent_tasks 3, agent_events 1 (Stand vor dem Push)
```

Danach:

```bash
# PostgREST-Ebene — muss 200 statt 404 liefern
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://ebljyceifhnlzhjfyxup.supabase.co/rest/v1/policy_pack_catalog?select=*&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

node scripts/check-migration-drift.mjs   # muss in beide Richtungen grün sein
```

- `Deploy`-Workflow muss grün werden (beide Jobs).
- `/app`-Dashboard sollte Daten statt Leerflächen zeigen.

---

## Rollback

> ⚠️ **Es gibt keinen automatischen Wiederherstellungspunkt.** Die Organisation
> `realsyncdynamics-spec's Org` läuft auf dem **Free-Plan**. Supabase legt dort
> weder tägliche Backups noch PITR an — beides beginnt beim Pro-Plan (PITR
> zusätzlich als kostenpflichtiges Add-on). Eine frühere Fassung dieses Runbooks
> nannte „PITR auf den notierten Zeitstempel" als Rollback; das war nicht
> ausführbar. Verifiziert am 2026-08-03 über `get_organization` (`"plan":"free"`)
> und die Supabase-Doku zu Backups.

Der Push ist nicht transaktional über alle Migrationen hinweg — ein Teilabbruch
hinterlässt einen teilmigrierten Zustand. Rückweg ist deshalb ausschließlich der
in den Vorbedingungen gezogene logische Dump:

```bash
# Nur im Notfall und mit Bedacht: spielt den Stand VOR dem Push zurück.
psql "$DATABASE_URL" -f pre-push-<zeitstempel>.sql
```

Der Dump ist logisch, kein physisches Abbild: Storage-Objekte, Auth-Sessions und
alles, was zwischen Dump und Rollback geschrieben wurde, sind damit **nicht**
abgedeckt. Wer diesen Rückweg nicht akzeptieren will, hebt vor dem Push auf den
Pro-Plan an — dann stehen tägliche Backups zur Verfügung, und PITR lässt sich
als Add-on zubuchen.

---

## Danach noch offen

- **P0-3 — Edge-Function-Quota.** Der Push repariert die Datenbank-Seite, nicht die
  Function-Seite. Der Free-Plan erlaubt **100** Edge Functions, das Projekt steht
  exakt darauf; im Repo liegen 170. Neue Functions scheitern mit
  `402 Max number of functions reached for project` — betroffen sind u. a.
  `evidence-vault`, `policy-packs`, `provenance` und alle `iso42001-*`. Tabellen
  allein reichen also nicht: Ein Modul braucht beides. Konsolidierung schließt die
  Lücke rechnerisch nicht (fünf Waisen ohne Repo-Gegenstück plus 20 statisch
  unreferenzierte Functions gegen 75 fehlende), Pro erlaubt 500.
- **`VITE_SENTRY_DSN`** in den Cloudflare-Pages-Umgebungsvariablen setzen. Ohne DSN gibt
  es kein Error-Tracking in Produktion — genau deshalb blieb die 404-Flut wochenlang
  unbemerkt. Liegt außerhalb des Repos.
- Entscheiden, welcher Deploy-Pfad kanonisch ist: Cloudflares Git-Integration **oder**
  `deploy-cloudflare-pages.yml`. Nur der Actions-Pfad injiziert die `VITE_*`-Secrets.

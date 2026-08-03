# Runbook — P0-2: Migrations-Ledger reconcilen und `db push` entsperren

**Stand:** 2026-08-03 · **Befund:** `DEBUG_ROOT_CAUSE_2026-08-02.md` · **Status:** noch nicht ausgeführt

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
- **PITR-/Backup-Punkt** im Supabase-Dashboard anlegen und Zeitstempel notieren.
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

PITR auf den in den Vorbedingungen notierten Zeitstempel. Der Push ist nicht
transaktional über alle Migrationen hinweg — ein Teilabbruch hinterlässt einen
teilmigrierten Zustand, der ohne PITR nur von Hand zu reparieren ist.

---

## Danach noch offen

- **`VITE_SENTRY_DSN`** in den Cloudflare-Pages-Umgebungsvariablen setzen. Ohne DSN gibt
  es kein Error-Tracking in Produktion — genau deshalb blieb die 404-Flut wochenlang
  unbemerkt. Liegt außerhalb des Repos.
- Entscheiden, welcher Deploy-Pfad kanonisch ist: Cloudflares Git-Integration **oder**
  `deploy-cloudflare-pages.yml`. Nur der Actions-Pfad injiziert die `VITE_*`-Secrets.

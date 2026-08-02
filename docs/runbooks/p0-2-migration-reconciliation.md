# Runbook — P0-2: Migrations-Ledger reconcilen und `db push` entsperren

**Stand:** 2026-08-02 · **Befund:** `DEBUG_ROOT_CAUSE_2026-08-02.md` · **Status:** noch nicht ausgeführt

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
| #941 | Macht `20260608000001_user_consents` idempotent. Ohne das bricht `db push` an Position ~13 von 118 mit `42710 policy already exists` ab. |
| #942 | Benennt die `autonomous_agents_core`-Tabellen um. Ohne das aktiviert der Push RLS und legt Policies auf **drei produktiven Tabellen** an (`agent_runs`, `agent_tasks`, `agent_events`) — fehlerfrei und damit unbemerkt. |
| #949 | Erfasst `document_vault` und `tenants.industry`, die nur in Prod existieren. Ohne das gehen sie beim Ledger-Revert dauerhaft aus dem Repo verloren. |

Zusätzlich:
- **PITR-/Backup-Punkt** im Supabase-Dashboard anlegen und Zeitstempel notieren.
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD` verfügbar.

---

## Schritt 1 — Ledger bereinigen

12 Remote-Versionen haben keine passende Repo-Datei und blockieren `db push` vollständig
(`Remote migration versions not found in local migrations directory`).

```bash
supabase link --project-ref "$SUPABASE_PROJECT_ID"

supabase migration repair --status reverted \
  20260510 \
  20260628121531 20260628121551 20260628121603 \
  20260628193744 20260628193759 20260628193820 \
  20260701121059 20260715105402 \
  20260720123325 20260720123711 20260720124405
```

Warum jede einzelne unbedenklich ist — vorab verifiziert:

| Version | Begründung |
|---|---|
| `20260510` | Repo-Datei `20260510_ai_governance_core.sql` existiert; 5× `CREATE TABLE IF NOT EXISTS`, der eine `ADD CONSTRAINT` hat ein `drop constraint if exists` davor → läuft gefahrlos erneut |
| 6× `bots_*` | Duplikate von `20260628120000/100/200`; Repo-Fassung ist idempotent (5× `IF NOT EXISTS`, 10× `DROP POLICY IF EXISTS`, alle Inserts mit `ON CONFLICT`) |
| `20260701121059` | `20260501000000` legt `on_auth_user_created` bereits mit vorangestelltem `DROP IF EXISTS` an; Prod hat genau diesen einen Trigger |
| `20260715105402`, `20260720124405`, `20260720123711` | durch #949 im Repo erfasst |
| `20260720123325` | reine Performance-Optimierung, bewusst nicht nachgebildet (siehe #949) |

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

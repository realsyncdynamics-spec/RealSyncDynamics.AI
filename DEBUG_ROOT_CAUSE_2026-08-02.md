# Root-Cause-Analyse — „Inhalte erscheinen nicht im Frontend"

**Datum:** 2026-08-02 · **Analyse-Branch:** `claude/realsync-debug-analysis-d4iawc` · **Basis:** `main` @ `c5486a8` (2026-07-23)
**Status:** Nur Analyse — **keine Code-Änderungen vorgenommen.**

---

## TL;DR

Das Problem liegt **nicht** im Frontend, nicht am Build und nicht an Cloudflare.

**Die gesamte Backend-Auslieferung steht seit ~3 Wochen still.** Der `Deploy`-Workflow schlägt bei
**jedem** Lauf fehl — beide Jobs, aus zwei unabhängigen Gründen:

| # | Blocker | Wirkung |
|---|---|---|
| **P0-1** | **Ein** Syntaxfehler in `supabase/functions/add-auditor/index.ts:95` | `supabase functions deploy` bündelt alles-oder-nichts → **73 von 168** Edge Functions nie deployt (u. a. `evidence-vault`, `policy-packs`, `provenance`, alle `iso42001-*`) |
| **P0-2** | 12 Orphan-Einträge im Remote-Migrations-Ledger | `supabase db push` bricht ab → **118 von 243** Migrationen nie angewendet → **66 von 148** vom Frontend abgefragten Tabellen existieren in Prod nicht (HTTP 404 / `PGRST205`) |

Das Frontend rendert korrekt — es fragt nur Tabellen und Functions ab, die es in der Produktion
schlicht nicht gibt. Zusätzlich ist **Sentry im Prod-Build inaktiv** (kein DSN injiziert), weshalb
diese Fehler nie im Monitoring auftauchten.

---

## A) Was sollte sichtbar sein?

Laut `CLAUDE.md` sind in Phase 2 produktiv:
Audit Module (95 %), Policy Packs (100 %), Evidence Vault (90 %), Governance Runtime (85 %),
Provenance/C2PA (80 %) — jeweils mit Dashboard-Flächen unter `/app/*` und `/governance/*`.

## B) Wo bricht die Kette?

```
Browser ──► Cloudflare Pages ──► SPA-Bundle ──► Supabase REST/Functions ──► Postgres
  ✅ ok         ✅ ok              ✅ ok            ❌ 404 PGRST205        ❌ Tabelle fehlt
                                                    ❌ Function fehlt
```

Der Bruch liegt **hinter** dem ausgelieferten Frontend, an der Grenze zur Datenbank.

---

## C) Konkreter Fehler (verifizierte Messungen)

### C1 · Frontend / Hosting — **gesund, Ursache ausgeschlossen**

| Prüfung | Ergebnis |
|---|---|
| `realsyncdynamicsai.de` · `/ /pricing /audit /app /governance-runtime` | **alle HTTP 200** |
| `www.` und `realsyncdynamics-ai.pages.dev` | alle HTTP 200 |
| Apex vs. pages.dev — HTML-Diff | **identisch**, gleiche Asset-Hashes (`index-BQzdmg3A.js`, `index-BAcrpEVo.css`); die 938 Byte Unterschied sind ausschließlich Cloudflares injiziertes Bot-Challenge-Script |
| Lokaler Build vs. Live-Deploy | `npm run build` erzeugt **denselben Hash** `index-BQzdmg3A.js` → **Live-Deploy = `main` HEAD**, kein veralteter Build |
| `npm run lint` (`tsc --noEmit`) | **Exit 0** |
| Headless-Chromium-Render (11 Routen) | Alle Seiten rendern; textLen 947–15 520; **0 JS-Fehler** (einzige Console-Meldung: harmlose CSP-`frame-ancestors`-Meta-Warnung) |
| Auth-Gate | `/app`, `/dashboard` → Redirect nach `/welcome` — korrektes Verhalten ohne Session |

> Die Befunde aus `REALSYNC_LIVE_ROUTING_STATUS.md` / `REALSYNC_DOMAIN_EDGE_DIAGNOSIS.md`
> (Apex liefert überall HTTP 500) sind **veraltet**. Der Apex-500 existiert nicht mehr.
> Beide Dokumente sollten als erledigt markiert werden.

### C2 · Deployment — **rot, seit mindestens 2026-07-20**

`Deploy`-Workflow, 10 der 10 letzten Läufe (`#271`–`#280`): **failure**.

**Job „Push migrations" (Log Run #280):**
```
Remote migration versions not found in local migrations directory.
supabase migration repair --status reverted 20260510 20260628121531 20260628121551
  20260628121603 20260628193744 20260628193759 20260628193820 20260701121059
  20260715105402 20260720123325 20260720123711 20260720124405
##[error]supabase db push exited with code 1
```

**Job „Deploy edge functions" (Log Run #280):**
```
Error: failed to create the graph
Caused by:
    The module's source code could not be parsed: Unexpected eof at
    .../supabase/functions/add-auditor/index.ts:95:1
failed to bundle function: exit 1
```

Letzter erfolgreicher Function-Deploy laut Supabase-API: **~2026-07-01**.

### C3 · Datenbank — 118 Migrationen fehlen, 66 Tabellen fehlen

- Repo: **243** Migrationsdateien · in `schema_migrations` verzeichnet: **136** · **Differenz: 118**
- Von 148 Tabellen, die das Frontend per `.from()` abfragt, **existieren 66 nicht** (45 %).

Live-Verifikation gegen die Produktions-REST-API:
```
websites             HTTP 404  PGRST205  "Could not find the table 'public.websites'"
audit_jobs           HTTP 404  PGRST205
policy_pack_catalog  HTTP 404  PGRST205
terminal_sessions    HTTP 404  PGRST205
webhook_endpoints    HTTP 404  PGRST205
governance_assets    HTTP 200  []        ← existiert, RLS greift korrekt
tenants              HTTP 200  []        ← existiert, RLS greift korrekt
```

**Betroffene UI-Flächen (Auswahl, Tabelle → Datei):**

| Fehlende Tabelle | Konsument |
|---|---|
| `dashboard_kpis`, `compliance_score_history` | `src/features/dashboard/DashboardView.tsx` |
| `policy_pack_catalog`, `policy_pack_controls`, `policy_pack_activations` | `src/features/policy-packs/policyPacksApi.ts` |
| `websites` | `src/features/governance/scans/scansApi.ts` |
| `audit_jobs` | `src/features/smb/useSmbBusinessData.ts` |
| `terminal_sessions`, `terminal_commands`, `terminal_approvals` | `src/features/governance/terminal/*` |
| `webhook_endpoints`, `webhook_deliveries`, `webhook_subscriptions` | `src/features/governance/webhooks/useWebhooks.ts`, `src/features/api/*` |
| `scans` | `src/core/billing/useScanLimits.ts` |
| `monitored_domains` | `src/pages/RiskDashboard.tsx` |
| `custom_frameworks`, `compliance_alert_rules`, `report_configurations`, `generated_reports` | Governance-Reporting-Flächen |

**Sonderfall — Ledger inkonsistent:** `20260507150000_websites`, `20260507110000_audit_jobs_queue`
und `20260507100000_audit_evidence` sind als *angewendet* verzeichnet, die Tabellen existieren
aber nicht. Das deutet auf ein früheres `migration repair --status applied` ohne tatsächliche
Ausführung hin. **Ein reines `db push` wird diese drei nicht nachziehen** — sie brauchen
Sonderbehandlung.

**Weiterer Hinweis:** Die tracked Migration `20260720123711_add_missing_tenants_industry_column`
ist ein Hand-Patch für eine Spalte, die eigentlich aus der nie angewendeten Migration
`20260702130000_tenant_industry` käme. Der Drift wurde also bereits einmal punktuell umschifft,
statt behoben.

### C4 · Edge Functions — 73 von 168 nie deployt

Vollständiger Parse aller 168 Functions mit dem TypeScript-Parser:
**genau eine** Datei hat einen echten Syntaxfehler.

```
✗ add-auditor   95:1  ')' expected.
```

Ursache: `Deno.serve(async (req) => {` (Zeile 8) wird nie geschlossen — die Datei endet in
Zeile 94 mit `}` statt `});`.

Nicht deployte Functions u. a.: `evidence-vault`, `policy-packs`, `provenance`,
`iso42001-controls-library`, `iso42001-gap-analysis`, `iso42001-evidence-vault`,
`c2pa-manifest-generate`, `bulk-scan`, `dashboard-intelligence`, `governance-score-calculator`,
`governance-gap-analyzer`, `webhook-deliver`, `oauth2-apps`, `report-generator`,
`create-trial-subscription`, `website-operations-agent` — also exakt die Backends der Module,
die in `CLAUDE.md` als 80–100 % produktiv geführt werden.

### C5 · Build-Env — Sentry blind, Stripe auf Fallback

Analyse des **live ausgelieferten** Bundles:

| Variable | Zustand live | Folge |
|---|---|---|
| `VITE_SUPABASE_URL` / `_ANON_KEY` | **nicht gesetzt** — Hardcoded-Fallback aus `src/lib/supabaseUrl.ts` greift | funktioniert, aber unbeabsichtigt |
| `VITE_SENTRY_DSN` | **nicht gesetzt** — 0 DSN im Bundle | **Kein Error-Tracking in Produktion.** Erklärt, warum die 404-Flut nie auffiel |
| `VITE_STRIPE_PRICE_*` | nicht gesetzt → `PRICE_FALLBACK`-Literale | Checkout nutzt serverseitige DB-Auflösung, daher unkritisch — aber UI-Preise sind ungeprüft |

Grund: Der Live-Deploy läuft über **Cloudflares Git-Integration**, nicht über
`deploy-cloudflare-pages.yml`. Nur der Actions-Pfad injiziert die `VITE_*`-Secrets; die
Git-Integration hat sie nicht gesetzt.

---

## D) Ursache

1. **`add-auditor/index.ts` wurde mit unvollständigem Code gemergt.** `supabase functions deploy`
   ohne Funktionsnamen bündelt den kompletten Graph — ein einziger Parse-Fehler kippt alle 168.
   Es gibt keinen CI-Gate, der Edge Functions vor dem Merge parst.

2. **Der Migrations-Ledger ist beidseitig auseinandergelaufen.** 12 Remote-Versionen ohne
   Repo-Datei blockieren `db push` vollständig — dadurch erreichen auch die 118 sauberen
   Migrationen die Produktion nie.

3. **Der Drift-Guard prüft nur eine Richtung.** `scripts/check-migration-drift.mjs` meldet
   ausschließlich *Remote ohne Repo-Datei*. Der umgekehrte, hier entscheidende Fall
   (*Repo-Migration nie angewendet*) wird nicht erfasst — deshalb blieben 118 fehlende
   Migrationen unbemerkt. Zusätzlich wird der Job ohne Supabase-Secrets stillschweigend
   übersprungen.

4. **Kein Prod-Error-Tracking.** Ohne Sentry-DSN gab es kein Signal, dass die SPA im Betrieb
   massenhaft 404 von PostgREST bekommt.

Der Zustand ist im Repo sogar dokumentiert — `deploy.yml` enthält den Kommentar:
> „Solange der Remote-Ledger-Drift nicht reconciled ist, schlägt dieser Job bewusst fehl —
> das ist der ehrliche Zustand: Migrationen deployen derzeit **NICHT**."

Der Fehlschlag ist also bekannt und bewusst hart gestellt, aber die Reconciliation wurde nie
durchgeführt.

---

## E) Empfohlene Lösung (nach Priorität)

### P0-1 — Edge-Function-Deploy entsperren (Aufwand: Minuten)
`supabase/functions/add-auditor/index.ts` Zeile 94: `}` → `});`.
Danach greifen 73 nachgelagerte Function-Deploys automatisch.

### P0-2 — Migrations-Ledger reconcilen (Aufwand: Stunden, sorgfältig)
1. Ledger bereinigen mit dem vom CLI vorgeschlagenen Befehl (12 Orphan-Versionen), **nachdem**
   geprüft ist, ob deren Objekte in Prod existieren — für die `2026062812…`/`2026062819…`-Paare
   ist zu klären, welche Variante die reale ist (Duplikate von `bots_foundation` u. a.).
2. **Vor jedem Push: Backup / PITR-Punkt der Prod-DB.**
3. Die 118 fehlenden Migrationen auf einem **Supabase-Branch oder lokal** (`supabase db reset`)
   durchspielen — 118 Migrationen ungetestet gegen Prod zu pushen ist nicht vertretbar.
4. Sonderfall `websites`, `audit_jobs`, `audit_evidence`: als *applied* verzeichnet, aber nicht
   existent — hier `migration repair --status reverted` für genau diese drei, damit `db push`
   sie nachzieht.
5. Die 13 `.<version>.sql.bak`-Dateien im Repo-Root sind **Duplikate** der gleichnamigen Dateien
   in `supabase/migrations/`. Klären, welche Variante gilt, und die Kopien im Root entfernen.

#### Nachtrag 2026-08-02 — Trockenanalyse der 118 Migrationen gegen Prod (read-only)

Vor jedem Schreibzugriff wurde statisch geprüft, welche der 118 offenen Migrationen auf
bereits existierende Objekte treffen. Grundlage: vollständiges Objekt-Inventar der Prod-DB
(178 Tabellen, 220 Funktionen, 654 Indizes, 2 124 Spalten) gegen die Statements der
Migrationsdateien, **guard-bewusst** — also unter Berücksichtigung von
`DROP … IF EXISTS`, `DO $$ … IF NOT EXISTS (pg_constraint …)` und
`EXCEPTION WHEN duplicate_object`.

**Ergebnis: genau ein echter Blocker.**

| Prüfklasse | Treffer | Bewertung |
|---|---|---|
| `CREATE TABLE` ohne `IF NOT EXISTS` auf existierender Tabelle | 0 | — |
| `CREATE VIEW` / MV | 0 | alle mit `DROP … IF EXISTS` davor |
| `CREATE TRIGGER` auf existierender Tabelle | 0 | — |
| `ALTER TABLE … ADD CONSTRAINT` auf existierendem Constraint | 0 | 18 Constraints existieren zwar, **alle** Statements sind geguardet |
| `CREATE POLICY` auf existierender Policy | **2** | ❌ `20260608000001_user_consents.sql` |

`CREATE POLICY` kennt kein `IF NOT EXISTS` und schlägt mit `42710` fehl. Beide Policies
(`user_own_consents`, `service_role_all`) existieren in Prod bereits, während die Migration
im Ledger nie als angewendet steht. Da `db push` in Versionsreihenfolge arbeitet und diese
Migration an Position ~13 von 118 liegt, wäre der Push dort abgebrochen — die restlichen
~105 Migrationen hätten die Produktion weiterhin nie erreicht.

Behoben durch vorangestellte `DROP POLICY IF EXISTS` (gleiches Muster wie in
`20260611000000` / `20260701150000`). Gegen eine Wegwerf-PostgreSQL-16-Instanz real
verifiziert:

| Szenario | alt | neu |
|---|---|---|
| Frische DB (CI-Fall) | ok | ok |
| DB mit bereits vorhandenen Policies (Prod-Fall) | `ERROR: policy … already exists` | ok |

**Zwei Befunde, die kein Blocker sind, aber vor dem Go bekannt sein müssen:**

1. **`agent_runs` / `agent_tasks` / `agent_events` — Namenskollision zweier Features.**
   In Prod existieren sie aus `20260526000000_agent_os_substrate` als LLM-Run-Protokoll
   (`session_id`, `user_message`, `tool_calls`, `input_tokens` …).
   `20260705180000_autonomous_agents_core.sql` erwartet unter demselben Namen ein
   Scheduler-Modell (`agent_id`, `triggered_by`, `input_params`, `status` …). Die Migration
   ist per `DO $$ IF NOT EXISTS` abgesichert, **überspringt also still** — der `db push`
   läuft durch, aber das Autonomous-Agents-Feature bekommt die falschen Spalten und
   scheitert erst zur Laufzeit. Muss fachlich entschieden werden (Umbenennung eines der
   beiden Sets), nicht durch die Migration.

2. **`bots_*` liegt dreifach vor.** Repo: `20260628120000/120100/120200`.
   Remote-Ledger: `…121531/121551/121603` **und** `…193744/193759/193820` — dieselben drei
   Migrationen also zweimal unter verschiedenen Zeitstempeln angewendet. Beim Ledger-Repair
   ist zu entscheiden, welche Einträge `reverted` werden, bevor die Repo-Fassung greift.

**Noch offen und ausdrücklich nicht ausgeführt** (erfordert separate Freigabe + PITR-Punkt):
`supabase migration repair` für die 11 Orphan-Versionen und der eigentliche
`supabase db push` gegen die Produktions-DB.

### P1 — CI-Lücken schließen
- Edge-Function-Parse-Gate im PR-CI (`deno check` oder ein Skript wie das hier verwendete
  TypeScript-Parser-Snippet über alle `supabase/functions/*/index.ts`).
- `check-migration-drift.mjs` um die Gegenrichtung erweitern (Repo-Migration ohne Ledger-Eintrag).
- `supabase functions deploy` pro Funktion statt als Gesamtgraph, damit ein defektes Modul nicht
  alle blockiert.

### P2 — Observability & Env
- `VITE_SENTRY_DSN` in der Cloudflare-Pages-Git-Integration setzen (Umgebungsvariablen im
  Cloudflare-Dashboard), sonst bleibt Produktion blind.
- Entscheiden, welcher Deploy-Pfad kanonisch ist: Cloudflare-Git-Integration **oder**
  `deploy-cloudflare-pages.yml`. Aktuell existieren beide; nur der Actions-Pfad injiziert
  `VITE_*`-Secrets.

### P3 — Doku korrigieren
- `REALSYNC_LIVE_ROUTING_STATUS.md` und `REALSYNC_DOMAIN_EDGE_DIAGNOSIS.md` als **erledigt**
  markieren (Apex-500 existiert nicht mehr).
- Die Fertigstellungsgrade in `CLAUDE.md` (Policy Packs 100 %, Evidence Vault 90 %,
  Provenance 80 %) spiegeln den **Repo-Stand**, nicht die Produktion. Deployment-Status
  getrennt ausweisen.

---

## F) Zu ändernde Dateien

| Priorität | Datei | Änderung |
|---|---|---|
| P0-1 | `supabase/functions/add-auditor/index.ts` | Zeile 94: `}` → `});` |
| P0-2 | — (kein Code) | `supabase migration repair` + kontrollierter `db push` gegen Prod |
| P0-2 | Repo-Root `.2026*.sql.bak` (13 Dateien) | Duplikate klären / entfernen |
| P1 | `.github/workflows/ci.yml` *oder* neuer Workflow | Edge-Function-Syntax-Gate im PR |
| P1 | `scripts/check-migration-drift.mjs` | Gegenrichtung ergänzen |
| P1 | `.github/workflows/deploy.yml` | Functions einzeln deployen |
| P2 | Cloudflare-Dashboard (kein Repo-Change) | `VITE_SENTRY_DSN` setzen |
| P3 | `REALSYNC_LIVE_ROUTING_STATUS.md`, `REALSYNC_DOMAIN_EDGE_DIAGNOSIS.md`, `CLAUDE.md` | Status aktualisieren |

---

## Nicht die Ursache (geprüft und ausgeschlossen)

| Hypothese | Befund |
|---|---|
| Cloudflare Pages zeigt alten Build | ❌ Build-Hash live == lokaler Build von `main` HEAD |
| Env-Vars fehlen im Prod-Build | ⚠️ teilweise — Supabase-Fallbacks greifen; **Sentry fehlt wirklich** |
| RLS blockiert Daten → UI leer | ❌ RLS ist auf allen 180 Tabellen aktiv und antwortet korrekt (`200 []`) |
| Feature Flag / Auth Guard versteckt Komponenten | ❌ Auth-Gate verhält sich korrekt |
| Frontend ruft alte API-URL auf | ❌ Bundle zeigt korrekt `ebljyceifhnlzhjfyxup.supabase.co` |
| Apex-Domain liefert HTTP 500 | ❌ veraltet — alle Routen 200 |
| React-Router / Lazy-Loading defekt | ❌ 11 Routen gerendert, 0 JS-Fehler |

---

## Reproduktionsbefehle

```bash
# Deployment-Status
curl -sS -o /dev/null -w "%{http_code}\n" https://realsyncdynamicsai.de/

# Fehlende Tabelle live nachweisen
curl -sS "https://ebljyceifhnlzhjfyxup.supabase.co/rest/v1/websites?select=*&limit=1" \
  -H "apikey: <anon>" -H "Authorization: Bearer <anon>"
# → 404 PGRST205

# Syntaxfehler in Edge Functions finden
node -e "const ts=require('typescript'),fs=require('fs');
for(const d of fs.readdirSync('supabase/functions')){
  const p='supabase/functions/'+d+'/index.ts'; if(!fs.existsSync(p))continue;
  const sf=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),99,true);
  if(sf.parseDiagnostics.length) console.log(d, sf.parseDiagnostics[0].messageText);}"
```

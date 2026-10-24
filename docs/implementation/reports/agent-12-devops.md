# Agent 12 (DevOps): Release-Readiness und Deployment-Sicherheit

Stand: 23.10.2026, Repo `realsyncdynamics-spec/RealSyncDynamics.AI`, lokaler HEAD `b4f8a2f` (== origin/main).
Arbeitsweise: nur gelesen. Es wurden keine Workflows ausgelöst, keine Re-Runs gestartet, keine Labels, Kommentare oder Einstellungen geändert und keine Cloudflare-, Supabase- oder Vercel-MCP-Tools benutzt. GitHub wurde ausschließlich über lesende `mcp__github__*`-Tools abgefragt (Runs, Jobs, Job-Logs, Branches, PRs).
Statusmarker: **VERIFIZIERT** (Datei:Zeile, Run-ID oder API-Antwort), **ABGELEITET** (Schluss aus belegten Fakten), **BLOCKIERT** (mit den vorhandenen Tools nicht prüfbar, Grund genannt).
Zeilenstatus in den Tabellen: **ok**, **fehlt**, **Risiko**.

---

## 0. Pflichtprüfungen von Dominik (vorrangig)

### 0.1 `auto-merge.yml`: Freigabe für PR-Sicherheit

Die Datei wurde vollständig gelesen (111 Zeilen).

**(1) Unter welchen Bedingungen gemergt wird**

| Bedingung | Beleg | Status |
|---|---|---|
| Trigger nur bei `pull_request` gegen `main` mit den Typen `labeled, unlabeled, synchronize, ready_for_review, reopened`. Kein `opened`, kein `pull_request_target`. | `.github/workflows/auto-merge.yml:24-27` | VERIFIZIERT |
| Der Job läuft nur, wenn **alle** folgenden Bedingungen gelten: `github.event.pull_request.draft == false` **und** der Head-Branch liegt im selben Repo (kein Fork) **und** (Label `automerge` ist gesetzt **oder** es wurde gerade `automerge` entfernt). | `auto-merge.yml:38-42` | VERIFIZIERT |
| Das Token stammt aus einer GitHub App (`vars.AUTOMERGE_APP_ID` plus `secrets.AUTOMERGE_APP_PRIVATE_KEY`). Der Workflow selbst hat nur `contents: read`. | `auto-merge.yml:29-30, 45-52` | VERIFIZIERT |
| Das Label wird live nachgelesen. Fehlt `automerge`, wird ein aktives Auto-Merge abgeschaltet. | `auto-merge.yml:64-82` | VERIFIZIERT |
| Fail-closed: Ab 3000 geänderten Dateien oder bei nicht lesbarer Dateiliste gibt es kein Auto-Merge. | `auto-merge.yml:86-97` | VERIFIZIERT |
| Migrationssperre: Ändert der PR `supabase/migrations/**` (auch umbenannte Dateien), gibt es kein Auto-Merge, und ein aktives wird abgeschaltet. | `auto-merge.yml:91-104` | VERIFIZIERT |
| Sonst wird `gh pr merge --squash --auto` gesetzt. Der Workflow merged nicht selbst: GitHub merged erst, wenn die Pflicht-Checks des Rulesets grün sind. | `auto-merge.yml:106-111` und Kommentar `:3-5` | VERIFIZIERT |
| Autor: Es gibt keine Autor-Einschränkung. Jeder PR aus dem Repo mit dem Label ist berechtigt. | `auto-merge.yml:38-42` | VERIFIZIERT |
| Checks: Der Workflow prüft keine Checks selbst. Er verlässt sich auf das Ruleset. Dieses verlangt „4 of 4 required status checks“ (Log von Run 39766702607). Nach Doku sind das `build`, `Migration validation`, `Merge Hygiene / conflict-state` und `Merge Hygiene / hygiene` (`docs/MERGE_CONFLICT_CONCEPT.md:57`). | Job 119783825780 (Log) | Anzahl VERIFIZIERT, Namen ABGELEITET |
| **Aktueller Zustand: Auto-Merge ist derzeit nicht funktionsfähig.** Die Repo-Variable `AUTOMERGE_APP_ID` fehlt. Fehlermeldung am 23.10.2026 13:56 UTC: `[@octokit/auth-app] appId option is required`. In den letzten 100 Läufen gab es 98× `skipped`, 2× `failure` und 0× `success`. | Run 39965410516, Job 120453862377; Runliste `auto-merge.yml` | VERIFIZIERT |

**(2) Kann ein Draft-PR nach `main` automatisch gemergt werden? NEIN.**
- Der Job wird bei Drafts übersprungen (`auto-merge.yml:39`). VERIFIZIERT. Belegt auch durch den Draft-PR #1971: Check `auto-merge` = `skipped` (Check-Run 120695983817).
- Außerdem kann GitHub Draft-PRs grundsätzlich nicht mergen (Plattformverhalten). ABGELEITET.
- **Falle:** Wird ein Draft mit gesetztem Label `automerge` auf „Ready for review“ gestellt, feuert `ready_for_review` (`auto-merge.yml:26`). Dann würde Auto-Merge sofort aktiviert, sobald die App konfiguriert ist.

**(3) Kann ein reiner Docs-PR (nur `docs/implementation/*.md`) automatisch gemergt werden? Technisch JA, aber nur unter allen folgenden Voraussetzungen.**
1. Der PR ist kein Draft.
2. Er trägt das Label `automerge`.
3. `AUTOMERGE_APP_ID` und der App-Key sind gesetzt. Derzeit nicht der Fall (VERIFIZIERT, siehe oben).
4. Die 4 Pflicht-Checks sind grün. Für Docs gibt es keinen Pfadfilter in `ci.yml`, `build` läuft also voll durch.

Die Migrationssperre greift bei Docs nicht. Heute wäre das Ergebnis deshalb **nein**, weil die App fehlt.
**Unabhängig von `auto-merge.yml`:** Mit dem Owner-Token kann jeder die native GitHub-Funktion „Enable auto-merge“ setzen oder direkt mergen. Das betrifft auch die Agenten, denn ihr MCP-Token ist `realsyncdynamics-spec`, also der Owner (`mcp__github__get_me`, VERIFIZIERT). Die Session bietet dafür `mcp__github__enable_pr_auto_merge` und `mcp__github__merge_pull_request` an. Der Schutz hängt also an Agentendisziplin, nicht an Technik.

**(4) Was man zwingend vermeiden muss**
- Das Label `automerge` setzen, auch nicht auf Drafts. Es wird scharf, sobald der PR „ready“ wird.
- Einen PR mit Label von Draft auf Ready stellen.
- `mcp__github__enable_pr_auto_merge`, `mcp__github__merge_pull_request`, `mcp__github__update_pull_request` mit `draft:false` und `mcp__github__actions_run_trigger` benutzen.
- `.github/workflows/**` im PR ändern. Bei Same-Repo-PRs gilt die PR-Version des Workflows, und sie läuft mit Repo-Secrets (siehe 0.2).
- `supabase/**` ändern. Das ist nicht auto-merge-relevant, aber jeder Merge bedeutet einen Produktions-Deploy (siehe C).
- Branch-Präfix `feature/**`. Er löst `e2e.yml` bei jedem Push aus (`e2e.yml:7`).
- Unkritisch sind die Labels, die `merge-hygiene.yml` selbst setzt: `conflicts`, `needs-rebase`, `hot-file` (`merge-hygiene.yml:47-83`). Kein Workflow setzt `automerge` automatisch (grep über `.github/` und `scripts/`, VERIFIZIERT).

**(5) Ergebnis: SICHER für einen Docs-Draft-PR, mit Auflagen.**
Begründung: Für Drafts ist Auto-Merge doppelt gesperrt (`auto-merge.yml:39` und GitHub-Plattform), und die App ist zurzeit nicht konfiguriert (Run 39965410516). Ein Docs-Draft-PR löst keinen Produktions-Deploy aus (siehe F).
Auflagen:
- kein Label `automerge`;
- nicht auf Ready stellen ohne Dominiks Freigabe;
- keine Merge- oder Auto-Merge-Tool-Calls;
- keine Änderungen an `.github/`, `supabase/`, `functions/`, `wrangler*.toml` oder `package*.json`.

Nebenwirkungen eines Docs-Draft-PRs (VERIFIZIERT an #1971):
- Cloudflare-Pages-Preview-Build durch die Git-Integration;
- `Playwright E2E` gegen den lokalen Preview-Server;
- CodeQL;
- Merge Hygiene, die Labels und Kommentare setzen kann.

### 0.2 `deploy-cloudflare-pages.yml`: vollständige Prüfung

Die Datei wurde vollständig gelesen (321 Zeilen).

| Aspekt | Befund | Beleg | Status |
|---|---|---|---|
| Trigger `push` | nur `main`, mit Pfadfilter (src, platform, public, scripts, index.html, package*.json, vite.config.ts, tsconfig.json, wrangler.toml, _redirects, _headers, die Workflow-Datei) | `:3-19` | VERIFIZIERT |
| Trigger `pull_request` | **keine** `types` (also Default: opened, synchronize, reopened), **kein** `branches`-Filter (PRs gegen jede Basis), Pfade wie oben ohne `_redirects`/`_headers`, kein Draft-Filter | `:20-32` | VERIFIZIERT |
| Trigger `workflow_dispatch` | ohne Inputs, **auf jedem Branch auslösbar**, ohne Ref-Wächter | `:33` | VERIFIZIERT |
| Fork-PRs | GitHub gibt Fork-PRs keine Secrets und nur ein Read-Token. Der Build liefe ohne `VITE_*`-Werte. Das Repo ist **public** (`list_repos`), Fork-PRs sind also möglich. Die Einstellung für die Workflow-Freigabe von Fork-PRs ist nicht lesbar. | – | ABGELEITET / Einstellung BLOCKIERT |
| `pull_request_target` | wird in keinem der 38 Workflows verwendet | grep `.github/` | VERIFIZIERT |
| `permissions` | `contents: read` (top-level) | `:48-49` | ok |
| `environment:` | **keiner** in keinem Job | ganze Datei | fehlt |
| Job `build`, Step „Detect Cloudflare credentials“ | Secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, Variable `CLOUDFLARE_ACTIONS_DEPLOY` im Step-Env. Läuft **auch bei PRs** und Drafts. | `:63-118` | VERIFIZIERT |
| Job `build`, Step „Build Vite + Prerender“ | Secrets: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SENTRY_DSN, VITE_STRIPE_PRICE_{STARTER,GROWTH,AGENCY}[_YEARLY], VITE_SUPABASE_ANON_JWT, VITE_TURNSTILE_SITE_KEY, VITE_STRIPE_PUBLISHABLE_KEY, VITE_STRIPE_AUDIT_PRO_LINK, VITE_STRIPE_CONNECT_ID, VITE_GOOGLE_OAUTH_ID, VITE_SENTRY_TRACES_SAMPLE_RATE, VITE_MARKETING_ANALYTICS_ENABLED, VITE_GOOGLE_ADS_ID/_LABEL_{LEAD,TRIAL,PURCHASE}, VITE_LINKEDIN_CONVERSION_{LEAD,TRIAL,PURCHASE}, VITE_AUTH_{GOOGLE,AZURE,GITHUB,LINKEDIN}_ENABLED. Alles öffentliche Bundle-Werte. Läuft auch bei PRs. | `:145-179` | VERIFIZIERT |
| Job `deploy` | `if: github.event_name != 'pull_request' && needs.build.outputs.cf_ready == 'true'` | `:203` | VERIFIZIERT |
| **`--branch`-Argument** | `wrangler pages deploy dist --project-name=realsyncdynamics-ai --branch=main` ist **fest codiert**. Es gibt keinen PR- oder Head-Ref-Zweig. Wann immer der Job läuft (push auf main **oder workflow_dispatch von beliebigem Branch**), deployt er auf den Pages-Branch `main`, also in die Produktion. Bei `pull_request` läuft der Job wegen `:203` nicht, ein Preview gibt es hier also gar nicht. | `:212-217` | VERIFIZIERT |
| Job `smoke-test` | gleiche `if`-Bedingung; prüft nur lesend `https://realsyncdynamicsai.de` | `:219-321` | ok |
| Pages-Produktionsbranch | `wrangler.toml:45-47` enthält nur `name`, `pages_build_output_dir` und `compatibility_date`, **keinen** Production-Branch. Dieser ist im Cloudflare-Dashboard hinterlegt. Die Doku (`DEPLOYMENT.md:63`, `docs/runbooks/cloudflare-actions-deploy-cutover.md:72-79`) beschreibt die Git-Integration als Auslieferungsweg. | – | Dashboard-Wert BLOCKIERT (Cloudflare-Tools untersagt) |
| Ist-Zustand des Actions-Deploys | Auf `main` wird `deploy` **übersprungen**, weil `cf_ready=false`. Die Cloudflare-Secrets sind dort also leer oder nicht gesetzt. Ausgeliefert wird durch die Cloudflare-Git-Integration (App „Cloudflare Workers and Pages“). | Run 39972134885, Job 120478227375 `skipped` | VERIFIZIERT |
| Preview-Deploys | Sie entstehen **nicht** durch diesen Workflow, sondern durch die Cloudflare-Git-Integration. Auf dem Docs-Draft-PR #1971 erscheint ein Check-Run `Cloudflare Pages` = success mit Link auf ein Pages-Deployment. | Check-Run 120699269847 | VERIFIZIERT |
| Supabase- oder Edge-Function-Deploy im selben Workflow | nein | ganze Datei | VERIFIZIERT |
| Preview spricht mit der Produktion | Die Pages Function `functions/api/fn/[[name]].ts:8` leitet `/api/fn/*` fest an das **Produktions**-Supabase-Projekt `ebljyceifhnlzhjfyxup` weiter. Der Frontend-Fallback zeigt ebenfalls auf die Produktion (`src/lib/supabaseUrl.ts:12,20,26-37`). Auch Cloudflare-Previews arbeiten also gegen Produktionsdaten und Produktions-Functions. | – | VERIFIZIERT (Code); Preview-Env-Variablen im Dashboard BLOCKIERT |

**Ergebnis (2): PRODUKTION MÖGLICH, aber nur unter Bedingungen. Ein normaler PR ohne Workflow-Änderung führt zu NUR PREVIEW.**
- Normaler PR (src, docs), Workflow unverändert:
  - GitHub Actions baut nur und deployt nichts (`:203`).
  - Cloudflare-Git-Integration erzeugt ein **Preview**-Deployment (#1971). Das bleibt Preview, solange der Production-Branch im Dashboard `main` ist (BLOCKIERT, laut Doku ABGELEITET).
  - Der Preview nutzt aber das Produktions-Supabase (`functions/api/fn/[[name]].ts:8`).
- Produktion ist in folgenden Fällen erreichbar:
  1. Merge oder Push auf `main`. Bestimmungsgemäß.
  2. `workflow_dispatch` dieses Workflows **von einem beliebigen Branch**, sobald `CLOUDFLARE_API_TOKEN` und `CLOUDFLARE_ACCOUNT_ID` gesetzt sind. Dann läuft `--branch=main` mit Branch-Code (`:33, :203, :217`). Heute ABGELEITET nicht wirksam, weil die Secrets leer sind (Run 39972134885). Die Secrets werden aber in 6 weiteren Workflows referenziert.
  3. Ein Same-Repo-PR, der **die Workflow-Datei selbst ändert** (z. B. die `:203`-Bedingung entfernt). Bei `pull_request` läuft die PR-Version des Workflows mit Repo-Secrets. ABGELEITET aus GitHub-Semantik; wirksam, sobald Cloudflare-Secrets existieren.
  4. Analog dazu jeder Same-Repo-PR, der einen der PR-getriggerten Workflows mit `SUPABASE_ACCESS_TOKEN` ändert oder das von ihnen ausgeführte Skript (siehe Risiko R2). **Das ist heute schon wirksam.**

---

## Risiken vor Welle 2 (Pflichtabschnitt, nach Schweregrad)

| # | Schwere | Risiko | Beleg | Empfehlung (nur Empfehlung) |
|---|---|---|---|---|
| R1 | **Kritisch** | **Jeder Merge, der `supabase/migrations/**`, `supabase/functions/**` oder `config.toml` berührt, wird ohne Freigabe-Gate sofort in der Produktion angewendet.** `deploy.yml` hat kein `environment:`, nutzt `db push --include-all` und deployt Functions. Belegt durch die automatischen Runs 39967830851 (#1950 mit Migration) und 39975271469 (#1860). Zusätzlich nennt sich #1908 selbst „Review-Migration, nicht automatisch anwenden“. Ein Merge wendet sie trotzdem an. | `deploy.yml:3-11, 24-38, 80-93, 95-173` | GitHub-Environment `production` mit Required Reviewer an `deploy.yml` (beide Jobs) und Deployment-Branch `main`. Welle 2: keine `supabase/`-PRs ohne Einzel-Freigabe. |
| R2 | **Kritisch** | **PR-getriggerte Workflows führen PR-kontrollierten Code mit Produktions-Supabase-Credentials aus**, auch bei Drafts. `migration-drift` (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `supabase link` auf Prod), `edge-function-drift`, `entitlement-drift` (vorher `npm ci`), `function-acl-drift` und `cron-health` starten `scripts/check-*.mjs` aus dem PR-Head. Diese Skripte nutzen `POST /v1/projects/{ref}/database/query`, also beliebiges SQL. Ein Agenten-PR, der eines dieser Skripte oder Workflows ändert, könnte Prod verändern. | `migration-drift.yml:9-15, 46-65`; `edge-function-drift.yml:40-47`; `entitlement-drift.yml:28-40`; `function-acl-drift.yml:28-34`; `cron-health.yml:46-52`; `scripts/check-function-acl-drift.mjs:154-156`; `scripts/check-cron-health.mjs:372-374`; `scripts/check-entitlement-parity.mjs:87-89` | Für PRs nur Read-only-Credentials (eigenes Token oder Read-Replica) oder Secrets nur über ein Environment mit Reviewer. Agenten dürfen `scripts/check-*`, `.github/workflows/**` und `package.json` nicht anfassen. |
| R3 | **Hoch** | **Die Agenten arbeiten mit dem Owner-Account** (`realsyncdynamics-spec`). CODEOWNERS ist derselbe Account. PR #1860 wurde ohne APPROVED-Review gemergt (nur COMMENTED-Reviews). Eine Review-Pflicht greift für diesen Account also faktisch nicht. Merge, Auto-Merge, `workflow_dispatch` und Settings sind für Agenten technisch möglich. | `mcp__github__get_me`; `.github/CODEOWNERS`; PR #1860 Reviews und `merged_by` | Eigener Bot-Account oder GitHub App mit minimalen Rechten für Agenten; Merge nur durch Dominik; Ruleset ohne Bypass für Bot. |
| R4 | **Hoch** | `migration-reconciliation.yml` setzt **auch im Dry-Run** `supabase migration repair --status reverted 20260510` gegen Prod (Step ohne `if`). Ohne Branch-Wächter deployt er mit `dry_run=false` Migrationen und **alle** Functions vom ausgewählten Branch. | `migration-reconciliation.yml:3-10, 28-35, 51-82` | Workflow stilllegen oder Environment, Wächter `refs/heads/main` und `repair` nur außerhalb des Dry-Runs. |
| R5 | **Hoch** | Gefährliche `workflow_dispatch`-Workflows haben **kein Environment und keinen Branch-Wächter**: `delete-edge-function` (löscht Prod-Function), `enable-leaked-password-protection` (PATCH Prod-Auth-Config), `list-edge-functions`, `deploy-frontend-production`, `deploy-frontend-vps`, `provision-govard-gateway` und `siteos-production-e2e` (nur Texteingabe „PROVISION“ bzw. „PUBLISH“ als Bestätigung). `deploy.yml` hat immerhin einen Wächter auf `refs/heads/main` (`:27, :97`), schützt laut eigenem Kommentar aber nicht gegen einen geänderten Workflow (`:19-23`). | jeweils `on: workflow_dispatch`; `provision-govard-gateway.yml:38-66`; `siteos-production-e2e.yml:32-35` | Environment `production` mit Reviewer für alle Prod-Workflows; Agenten dürfen `actions_run_trigger` nicht verwenden. |
| R6 | **Hoch** | **Es gibt keine isolierte Staging-Umgebung.** Ein einziges `SUPABASE_PROJECT_ID`. Cloudflare-Previews und der Frontend-Fallback zeigen auf Prod-Supabase. `deploy/deploy-to-staging.sh:28` hat nur den Platzhalter `staging-project-id`. Die Environment-Option „staging“ gibt es nur im stillgelegten VPS-Workflow. | `functions/api/fn/[[name]].ts:8`; `src/lib/supabaseUrl.ts:12-37`; `deploy-frontend-vps-production.yml:6-13, 23-24` | Separates Supabase-Projekt (Preview/Branching) und Preview-Env-Variablen in Cloudflare darauf richten. Bis dahin Previews als „gegen Prod“ behandeln. |
| R7 | **Mittel** | **Kein Merge-Queue-Betrieb und unklare Review-Pflicht.** Die Doku fordert Merge Queue und 1 Review (`docs/MERGE_CONFLICT_CONCEPT.md:52-60`). Es gab aber nie einen `merge_group`-Run (`ci.yml`, Filter `event=merge_group`: `total_count 0`). Verifiziert ist nur: „PR erforderlich“ und „4 of 4 required status checks“. | Job 119783825780; Runliste `ci.yml` | Dominik prüft das Ruleset manuell (siehe B). |
| R8 | **Mittel** | Cloudflare-Git-Integration baut **jeden Branch und PR** als öffentlich erreichbaren Preview (`*.pages.dev`), unter Umständen mit Produktions-Env-Variablen. | Check-Run 120699269847 (#1971) | Cloudflare Access für Preview-Deployments; Preview-Branches auf eine Allowlist begrenzen (Dashboard). |
| R9 | **Mittel** | 20 Workflows haben keinen top-level `permissions:`-Block. Dann gelten die Default-Token-Rechte des Repos, die nicht lesbar sind (siehe Tabelle C). | Tabelle C | Default auf read-only setzen; `permissions: {}` bzw. minimal je Workflow. |
| R10 | **Mittel** | Rollback-Runbook ist veraltet: Pfad 1 verweist auf das nicht existierende `deploy-frontend.yml` und auf den VPS, statt Cloudflare-Pages-Rollback zu beschreiben. Migrationen sind nur fix-forward. Die DB-Backup-Art (PITR ja/nein) ist unbestätigt. | `docs/runbooks/rollback.md:1-8, 31-56, 85-100`; `docs/runbooks/database-restore.md:15-20` | Runbook auf „Cloudflare Dashboard → Deployments → Rollback“ aktualisieren; PITR bestätigen. |
| R11 | **Niedrig** | `docker-deploy.yml` nutzt nicht gepinnte Actions (`@v4`, `@v3`, `@v5`, `@v7`, `@v1`), obwohl laut Kommentar SHA-Pinning Org-Policy ist. `supabase/setup-cli` mit `version: latest` an 7 Stellen. | `docker-deploy.yml:21,26,63,66,69,77,86,114,173,187,200,220`; `deploy-backend-cloudflare.yml:36` | Workflow löschen (stillgelegt seit 03.08.) oder pinnen; CLI-Version fixieren. |
| R12 | **Niedrig** | `tracker-db-update.yml` pusht direkt auf `main` und scheitert seit 24.09. an jedem Lauf am Ruleset. Positiv ist: Das Ruleset greift. | Run 39766702607 („Changes must be made through a pull request“) | Auf PR-Erstellung umstellen oder deaktivieren. |
| R13 | **Niedrig** | Vercel-Apps sind laut Doku weiterhin am Repo angebunden (Konto gesperrt). Auf #1971 erscheint kein Vercel-Check. | `DEPLOYMENT.md:66-128`; Check-Runs #1971 | GitHub-App-Verbindung im Vercel-Dashboard trennen (`DEPLOYMENT.md:120`). |

---

## A) GitHub Environments

| Punkt | Befund | Status | Zeilenstatus |
|---|---|---|---|
| Workflows mit `environment:` | Nur 3 von 38: `docker-deploy.yml:109-111` (`production`, stillgelegt), `deploy-playwright-scanner.yml:15-16` (`production`), `deploy-frontend-vps-production.yml:23-24` (`${{ github.event.inputs.environment }}`, also `production` oder `staging`, stillgelegt). | VERIFIZIERT | Risiko |
| Prod-Deploys **ohne** Environment | `deploy.yml` (Migrationen und Functions), `deploy-cloudflare-pages.yml`, `deploy-govard-gateway.yml`, `deploy-siteos-preview.yml`, `deploy-backend-cloudflare.yml`, `deploy-agent-runtime-vps.yml`, `migration-reconciliation.yml`, `delete-edge-function.yml`, `enable-leaked-password-protection.yml`, `provision-govard-gateway.yml`, `siteos-production-e2e.yml`, `cloudflare-domain-cutover.yml` | VERIFIZIERT | fehlt |
| Existenz der Environments `production` und `staging`, Pflicht-Reviewer, Wait-Timer, Deployment-Branches | Kein `mcp__github__*`-Tool deckt `GET /repos/{owner}/{repo}/environments` ab (Toolliste: actions_list/get, list_branches, pull_request_read, get_file_contents usw., kein Environments-Endpunkt). Indiz: Der einzige Run eines Environment-Workflows (`deploy-playwright-scanner`, Run 36224168113) endete in `failure`, nicht in `waiting`. | **BLOCKIERT** | – |
| **Manuelle Prüfung durch Dominik** | GitHub → Settings → Environments: Gibt es `production` und `staging`? Für `production`: „Required reviewers“ (Dominik), „Prevent self-review“ (nur sinnvoll mit separatem Agenten-Account), „Deployment branches and tags = Selected: main“, Wait-Timer optional. Wo liegen Secrets: Repository oder Environment? | – | – |

## B) Branch-Schutz und Rulesets für `main`

| Regel | Befund | Beleg | Status | Zeilenstatus |
|---|---|---|---|---|
| `main` geschützt | `protected: true` (alle anderen 121 Branches: `false`) | `list_branches` Seite 2 | VERIFIZIERT | ok |
| PR-Pflicht | „Changes must be made through a pull request.“ (GH013 beim direkten Push durch `GITHUB_TOKEN`) | Job 119783825780 (Run 39766702607, 22.10.2026) | VERIFIZIERT | ok |
| Required Checks | „4 of 4 required status checks are expected.“ Namen laut Doku: `build`, `Migration validation`, `Merge Hygiene / conflict-state`, `Merge Hygiene / hygiene` | wie oben; `docs/MERGE_CONFLICT_CONCEPT.md:57` | Anzahl VERIFIZIERT, Namen ABGELEITET | ok |
| Required Reviews | Laut Doku 1 Review mit Dismiss stale. PR #1860 wurde aber ohne APPROVED gemergt. Entweder ist keine Review-Pflicht aktiv, oder der Owner hat Bypass. | `docs/MERGE_CONFLICT_CONCEPT.md:55`; PR #1860 `get_reviews` | Wirkung VERIFIZIERT, Konfiguration BLOCKIERT | Risiko |
| Force-Push- und Löschschutz | Doku: beide aus (`:59-60`). Nicht über Tools prüfbar. | – | BLOCKIERT | – |
| Squash-only | Doku `:44-46`. Merges auf main sind Squash-Commits mit `(#NNNN)` (z. B. `b4f8a2f`). | `git log`; Runliste `deploy.yml` | ABGELEITET | ok |
| Merge Queue | Doku `:58`, `ci.yml:9-10` und `e2e.yml:11-13` hören auf `merge_group`, aber **0 `merge_group`-Runs** in `ci.yml` | `actions_list` (event=merge_group) | VERIFIZIERT (nicht im Betrieb) | fehlt |
| „Skipped required check gilt als bestanden“ | Bei Drafts werden `build` und `Migration validation` übersprungen. Unkritisch, weil Drafts nicht mergebar sind. Für Ready-PRs laufen sie. | `ci.yml:118-126, 147` | VERIFIZIERT | ok |
| Kein Endpunkt | Keines der verfügbaren `mcp__github__*`-Tools liest `/repos/{o}/{r}/rulesets`, `/branches/main/protection` oder `/rules/branches/main` | Toolliste | **BLOCKIERT** | – |
| **Manuelle Prüfung durch Dominik** | Settings → Rules → Rulesets → Ruleset für `main` (laut `auto-merge.yml:4` „main merge hygiene“): (a) Bypass-Liste (Owner? Apps?), (b) „Require a pull request“ mit Anzahl der Approvals und „Require review from Code Owners“, (c) Required status checks inklusive exakter Namen und „up to date“, (d) „Require merge queue“ an oder aus, (e) „Block force pushes“ und „Restrict deletions“ an. Settings → General: nur Squash, „Allow auto-merge“. Settings → Actions → General: „Workflow permissions“ (read vs. write) und „Fork pull request workflows“ (Approval-Pflicht). | – | – | – |

## C) Alle 38 Workflows

Legende Spalte „perm“: `T` = top-level `permissions`-Block vorhanden, `J` = nur auf Job-Ebene, `–` = fehlt (es gelten die Default-Token-Rechte, BLOCKIERT).
Secrets sind nur als Namen angegeben.

| # | Workflow | Trigger | Deployt was wohin | Env | Secrets | perm | Risiko |
|---|---|---|---|---|---|---|---|
| 1 | auto-merge | PR→main (labeled, unlabeled, synchronize, ready_for_review, reopened) | aktiviert Squash-Auto-Merge | – | AUTOMERGE_APP_PRIVATE_KEY (+var AUTOMERGE_APP_ID) | T read | ok (App fehlt, inaktiv) |
| 2 | backend-services-ci | push main (services, playwright-scanner, worker, apps), PR (services, worker, apps), dispatch | nichts (Compile-CI) | – | – | – | ok/Risiko (perm) |
| 3 | branch-cleanup | dispatch (`apply` bool) | **löscht Branches** mit `github.token` | – | (github.token) | T contents:write | Risiko (Dispatch ohne Env) |
| 4 | ci | PR→main (opened, synchronize, reopened, ready_for_review), merge_group, push main und feat/governance-ai-product, dispatch | nichts; Drafts übersprungen | – | – | – | ok |
| 5 | cloudflare-domain-cutover | dispatch | Cloudflare DNS/Domain-Änderung (Prod-Zone) | – | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | T read | Risiko (kein Env) |
| 6 | codeql | push main, PR→main, schedule Mo 04:23, dispatch | nichts (Security-Events) | – | – | J | ok |
| 7 | cron-health | schedule 06:45, dispatch, **PR** (Skript- und Workflow-Pfad) | liest Prod-DB per Mgmt-API | – | SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID | – | **Risiko R2** |
| 8 | cta-enforcement | PR→main (src/pages, src/components u. a.), dispatch | nichts | – | – | – | ok |
| 9 | delete-edge-function | dispatch (`function_name`) | **löscht Prod-Edge-Function** | – | SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID | – | **Risiko R5** |
| 10 | deploy-agent-runtime-vps | push main (apps/agent-runtime, deploy/agent-runtime-vps), dispatch | VPS (rsync/ssh, docker compose) | – | AGENT_RUNTIME_API_TOKEN, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, VPS_SSH_{HOST,KEY,KNOWN_HOST,PORT,USER}, XAI_API_KEY | T read | Risiko (auto bei Merge, Service-Role, kein Env) |
| 11 | deploy-backend-cloudflare | push main (services/realsync-runtime-core), dispatch | Cloudflare Container (wrangler deploy), Guard bei fehlenden Secrets | – | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | – | Risiko (auto bei Merge, kein Env) |
| 12 | deploy-cloudflare-pages | push main (Pfade), PR (Pfade), dispatch | Pages-Prod `--branch=main` nur bei Nicht-PR und gesetzten Secrets (derzeit übersprungen) | – | CLOUDFLARE_*, 29× VITE_* (siehe 0.2) | T read | Risiko (Dispatch von jedem Branch → Prod) |
| 13 | deploy-frontend-production | dispatch | VPS docker compose (stillgelegt, VPS nicht erreichbar) | – | VPS_FRONTEND_PATH, VPS_SSH_{HOST,KEY,USER} | – | niedrig (stillgelegt) |
| 14 | deploy-frontend-vps-production | dispatch (environment: production/staging) | VPS | **${inputs.environment}** | SLACK_WEBHOOK_DEPLOY, VITE_SENTRY_DSN, VITE_SUPABASE_{ANON_KEY,URL}, VPS_SSH_{HOST,KEY,KNOWN_HOST,USER} | – | niedrig (stillgelegt) |
| 15 | deploy-frontend-vps | dispatch | VPS rsync (stillgelegt) | – | SLACK_WEBHOOK_DEPLOY, VITE_SENTRY_DSN, VITE_SUPABASE_{ANON_KEY,URL}, VPS_SSH_{HOST,KEY,KNOWN_HOST,PORT,USER} | – | niedrig |
| 16 | deploy-govard-gateway | push main (workers/govard-gateway), dispatch | Cloudflare Worker und **D1-Migrationen remote**; Guard bei Platzhalter | – | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | – | Risiko (auto bei Merge) |
| 17 | deploy-playwright-scanner | push main (deploy/playwright-scanner), dispatch | VPS docker compose | **production** | SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID, VPS_SSH_{HOST,KEY,KNOWN_HOST,PORT,USER} | – | mittel (Env-Schutz unbekannt) |
| 18 | deploy-siteos-preview | push main (workers/siteos-preview, src/lib/preview-sandbox.ts), dispatch | Cloudflare Worker (Guard) | – | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | – | Risiko (src-Datei löst Worker-Deploy aus) |
| 19 | **deploy** | **push main** (supabase/migrations, functions, config.toml, deploy.yml), dispatch | **Prod: `supabase db push --include-all` und `functions deploy`**; Wächter `refs/heads/main` | – | SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_ID | – | **Kritisch R1** |
| 20 | docker-deploy | dispatch | GHCR Push und VPS (stillgelegt, Secret-Namen existieren laut Kommentar nicht) | production (Job deploy) | ACME_EMAIL, DEPLOY_PATH, DOMAIN, GITHUB_TOKEN, JWT_SECRET, N8N_ENCRYPTION_KEY, SLACK_WEBHOOK_URL, VITE_*, VPS_HOST, VPS_SSH_KEY, VPS_USER | J | niedrig (ungepinnte Actions) |
| 21 | drift-alert | workflow_run (6 Guards, completed); `if` nur main und Nicht-PR | erstellt und pflegt Issues | – | – | T issues:write | ok (`drift-alert.yml:104-108`) |
| 22 | e2e | **push main und `feature/**`**, PR→main (auch Drafts), merge_group | nichts; lokaler Preview-Server | – | TEST_BASE_URL, TEST_EMAIL (beide derzeit leer → lokal, Run 40036145434) | – | ok/Risiko (perm; würde Prod testen, wenn TEST_BASE_URL gesetzt) |
| 23 | edge-function-drift | schedule 06:00, dispatch, **PR** (supabase/config.toml, functions, Liste, Skript) | liest Prod-Functions-Liste | – | SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID | – | **Risiko R2** |
| 24 | enable-leaked-password-protection | dispatch (true/false) | **PATCH Prod-Auth-Config** | – | SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID | – | **Risiko R5** |
| 25 | entitlement-drift | schedule 06:45, dispatch, **PR** (shared/pricing.ts, **supabase/migrations/**, Skript) | Prod-DB-Abfrage per Mgmt-API (nach `npm ci`) | – | SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID | – | **Risiko R2** |
| 26 | function-acl-drift | schedule 06:30, dispatch, **PR** (Skript, Workflow) | Prod-DB-Abfrage | – | SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID | – | **Risiko R2** |
| 27 | lighthouse-ci | PR→main (src, public u. a.), push main, dispatch | nichts | – | LHCI_GITHUB_APP_TOKEN | J (pull-requests:write) | ok |
| 28 | list-edge-functions | dispatch | liest Prod | – | SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID | – | niedrig |
| 29 | merge-hygiene | PR→main (opened, synchronize, reopened, ready_for_review), merge_group, schedule */30, dispatch | Labels und Kommentare | – | (github.token) | T PR/issues:write | ok |
| 30 | migration-collision | PR (supabase/migrations, Skript, Workflow) | nichts | – | GITHUB_TOKEN | T read | ok |
| 31 | migration-drift | schedule 06:00, dispatch, **PR** (supabase/migrations, Skript, Workflow) | `supabase link` auf **Prod** und Ledger-Abgleich | – | SUPABASE_ACCESS_TOKEN, **SUPABASE_DB_PASSWORD**, SUPABASE_PROJECT_ID | – | **Risiko R2** |
| 32 | migration-reconciliation | dispatch (`dry_run`) | **Prod: repair (auch im Dry-Run), db push, alle Functions** | – | SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_ID | – | **Hoch R4** |
| 33 | pre-deploy-check | PR→main und push main (supabase, src/runtime/agents, validator, deploy*.yml, Skript), dispatch | nichts (Lint) | – | – | – | ok |
| 34 | provision-govard-gateway | dispatch (Bestätigung `PROVISION`) | Cloudflare D1/R2 anlegen, D1-Migrationen und SQL remote | – | CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID | – | Risiko R5 |
| 35 | siteos-production-e2e | dispatch (Bestätigung `PUBLISH`) | **echter Publish-Test gegen https://realsyncdynamicsai.de** | – | E2E_TEST_EMAIL, E2E_TEST_PASSWORD | – | Risiko R5 |
| 36 | ssh-setup | dispatch | nur `ssh-keyscan` | – | VPS_SSH_HOST, VPS_SSH_PORT | – | niedrig |
| 37 | tracker-db-update | schedule Do 06:00, dispatch | Direkt-Push auf main (scheitert am Ruleset) | – | – | T contents:write | niedrig R12 |
| 38 | vps-backup | schedule 03:17, dispatch; nur bei var VPS_BACKUP_ENABLED=true | VPS-Backup per scp/ssh | – | VPS_SSH_{HOST,KEY,KNOWN_HOST,PORT,USER} | – | niedrig |

Zusatzbefunde zu C:
- **`pull_request_target`**: Wird nicht verwendet. VERIFIZIERT. Status ok.
- **Ungepinnte Third-Party-Actions**: nur in `docker-deploy.yml` (12 Stellen, darunter `docker/*`, `slackapi/*`, `actions/*`). Alle übrigen Workflows sind auf 40-stellige SHAs gepinnt. VERIFIZIERT (grep). Status Risiko (niedrig).
- **`supabase/setup-cli` mit `version: latest`**: 7 Workflows, darunter `deploy.yml:34-36,107-109`. Die CLI-Binärversion ist damit nicht gepinnt. Status Risiko (niedrig).
- **Automatisch bei Push oder Merge auf main deployen**: `deploy` (Supabase), `deploy-agent-runtime-vps`, `deploy-backend-cloudflare`, `deploy-govard-gateway`, `deploy-siteos-preview`, `deploy-playwright-scanner`, `deploy-cloudflare-pages` (derzeit nur Build), dazu die Cloudflare-Git-Integration. VERIFIZIERT (Trigger). Für `deploy.yml` sind die automatischen Prod-Läufe belegt (Runs 39975271469, 39967830851, 39965685932, 39939065946, 39802393962, alle `push`/`main`/`success`).
- **`e2e.yml` auf `feature/**`**: läuft mit `TEST_BASE_URL` und `TEST_EMAIL`. Beide sind derzeit leer, der Test läuft gegen `http://127.0.0.1:4173` (Log Job 120696304047). Die gebaute App nutzt ohne `VITE_SUPABASE_URL` den Prod-Fallback (`src/lib/supabaseUrl.ts:26-29`). Die Specs in `tests/e2e/` sind überwiegend reine Seitenaufrufe. ABGELEITET: geringes Risiko.

## D) Weitere Deploy-Wege und Token-Inventar

| Weg | Ist-Stand | Beleg | Status | Zeilenstatus |
|---|---|---|---|---|
| Cloudflare Pages (Frontend) | Auslieferung durch die Cloudflare-Git-Integration, ohne Repo-Secret; Actions-Deploy derzeit übersprungen. Projekt `realsyncdynamics-ai`, Output `dist`. Root-`functions/` wird als Pages Functions mitdeployt (Proxy auf Prod-Supabase). | `wrangler.toml:45-47`; `DEPLOYMENT.md:63`; Run 39972134885; `functions/api/fn/[[name]].ts:8` | VERIFIZIERT | ok/Risiko (R6, R8) |
| Cloudflare Workers | `wrangler-workers.toml` (Worker `realsyncdynamics-workers`, Route `api.realsyncdynamics.ai`, KV/R2-IDs, kein Secret). **Kein Workflow deployt diese Datei.** Weitere Worker: `workers/govard-gateway`, `workers/siteos-preview` (eigene Workflows mit Guards). | `wrangler-workers.toml`; grep `.github/` | ABGELEITET (manueller Weg oder verwaist) | Risiko (unklar) |
| Supabase | `deploy.yml` (automatisch); `supabase/config.toml:7` `project_id = "realsyncdynamics-ai"`; keine `[remotes]` bzw. kein Staging-Branch | grep config.toml | VERIFIZIERT | Risiko R1 |
| VPS (Hostinger, Docker/Traefik) | `deploy/`, `docker/realsync-web(-staging)`, `docker-compose.yml`, `traefik/`, `Dockerfile.frontend`. Die Frontend-VPS-Workflows sind laut Kommentar seit 03.08. stillgelegt („VPS über Port 22 nicht erreichbar“). Aktiv per Push auf main sind weiterhin `deploy-agent-runtime-vps` und `deploy-playwright-scanner`. | Kopfkommentare `deploy-frontend-production.yml`, `deploy-frontend-vps.yml`, `docker-deploy.yml:3-7`, `vps-backup.yml` | VERIFIZIERT (Dateien), Erreichbarkeit ABGELEITET | Risiko (gemischter Zustand) |
| Vercel | Keine `vercel.json` im Root, kein Workflow. `services/realsync-runtime-core/vercel.json` existiert laut Doku. Zwei Vercel-Projekte hängen als GitHub-App am Repo (Konto gesperrt). Auf #1971 ist kein Vercel-Check sichtbar. | `DEPLOYMENT.md:66-128`; Check-Runs #1971 | VERIFIZIERT/ABGELEITET | Risiko (niedrig) |
| `DEPLOYMENT.md` gegen Ist-Stand | Zeile 65 nennt `docker-deploy.yml` als VPS-Weg, der stillgelegt ist. Rollback-Abschnitt `:392-406` und `docs/runbooks/rollback.md:31-56` passen nicht zu Cloudflare Pages. Die Supabase-Zeile `:64` stimmt. | – | VERIFIZIERT | Risiko R10 |

**Token-Inventar (nur Namen, mit Fundstellen):**
- **Cloudflare:** CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID in deploy-cloudflare-pages, deploy-backend-cloudflare, deploy-govard-gateway, deploy-siteos-preview, provision-govard-gateway und cloudflare-domain-cutover. Dazu die Variable CLOUDFLARE_ACTIONS_DEPLOY.
- **Supabase:**
  - SUPABASE_ACCESS_TOKEN (Management-PAT): 12 Workflows (deploy, migration-drift/-reconciliation, edge-function-drift, entitlement-drift, function-acl-drift, cron-health, delete-/list-edge-functions, enable-leaked-password-protection, deploy-playwright-scanner).
  - SUPABASE_DB_PASSWORD: deploy, migration-drift, migration-reconciliation.
  - SUPABASE_PROJECT_ID: alle genannten Supabase-Workflows.
  - SUPABASE_SERVICE_ROLE_KEY und SUPABASE_URL: deploy-agent-runtime-vps.
  - VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_ANON_JWT: öffentlich.
- **Stripe:** nur öffentliche Werte, nämlich VITE_STRIPE_PUBLISHABLE_KEY, VITE_STRIPE_PRICE_*, VITE_STRIPE_AUDIT_PRO_LINK und VITE_STRIPE_CONNECT_ID. Stripe-Secret-Keys liegen nicht in GitHub, sondern laut Doku im Supabase Vault.
- **Vercel:** keine VERCEL_*-Secrets.
- **SSH/VPS:** VPS_SSH_KEY, VPS_SSH_HOST, VPS_SSH_USER, VPS_SSH_PORT, VPS_SSH_KNOWN_HOST, VPS_FRONTEND_PATH sowie die Altnamen VPS_HOST, VPS_USER und DEPLOY_PATH (nur in docker-deploy).
- **Sonstige:**
  - AUTOMERGE_APP_PRIVATE_KEY (+ Variable AUTOMERGE_APP_ID, fehlt)
  - AGENT_RUNTIME_API_TOKEN, XAI_API_KEY
  - SLACK_WEBHOOK_DEPLOY, SLACK_WEBHOOK_URL
  - LHCI_GITHUB_APP_TOKEN
  - E2E_TEST_EMAIL, E2E_TEST_PASSWORD, TEST_BASE_URL, TEST_EMAIL
  - JWT_SECRET, N8N_ENCRYPTION_KEY, ACME_EMAIL, DOMAIN
  - VITE_SENTRY_DSN, VITE_SENTRY_TRACES_SAMPLE_RATE, VITE_TURNSTILE_SITE_KEY, VITE_GOOGLE_*, VITE_LINKEDIN_*, VITE_AUTH_*, VITE_MARKETING_ANALYTICS_ENABLED
  - Variable VPS_BACKUP_ENABLED

## E) Staging, Observability, Rollback

| Punkt | Befund | Beleg | Status | Zeilenstatus |
|---|---|---|---|---|
| Echte Staging-Umgebung | **Nein.** Ein einziges Supabase-Projekt. Previews und Fallbacks laufen gegen Prod. `deploy/deploy-to-staging.sh:28` hat nur den Platzhalter. | R6 | VERIFIZIERT (Repo), Dashboard BLOCKIERT | fehlt |
| Preview-Deploys | Cloudflare-Git-Integration pro Branch oder PR (öffentlich, Backend = Prod) | Check-Run 120699269847 | VERIFIZIERT | Risiko |
| Health- und Cron-Checks | `cron-health` (täglich), `migration-drift`, `edge-function-drift`, `function-acl-drift`, `entitlement-drift` (täglich); `drift-alert` macht aus Befunden Issues (nur main, nicht PR) | Workflows 7, 21, 23, 25, 26, 31 | VERIFIZIERT | ok |
| Post-Deploy-Smoke | Der Smoke-Test in `deploy-cloudflare-pages` läuft nur beim Actions-Deploy und wird deshalb derzeit **nie** ausgeführt. | `:219-227`; Run 39972134885 (`skipped`) | VERIFIZIERT | fehlt |
| Logging und Monitoring | Sentry im Frontend (`src/main.tsx:10-16`, DSN aus Secret); Supabase-Function-Logs; Uptime Kuma laut Doku auf dem VPS, der aber unerreichbar ist (`DEPLOYMENT.md:65`) | – | ABGELEITET | Risiko (kein externes Uptime-Monitoring belegt) |
| Rollback Frontend | Das Runbook beschreibt einen VPS- und rsync-Weg über das nicht existierende `deploy-frontend.yml`. Der tatsächliche Weg (Cloudflare Dashboard → Rollback oder Revert-PR) ist nicht dokumentiert. | `docs/runbooks/rollback.md:31-56` | VERIFIZIERT | Risiko R10 |
| Rollback Edge Functions | Runbook Pfad 2: alte Version lokal deployen. Real geht das über Revert-PR, denn ein Merge deployt automatisch. | `rollback.md:59-80` | VERIFIZIERT | ok/teilweise |
| Rollback Migrationen | Nur fix-forward (keine Down-Skripte); CI erzwingt append-only (`ci.yml:493-510`). Ein Guard gegen destruktives SQL (DROP, TRUNCATE) fehlt in CI und `pre-deploy-lint` (grep ohne Treffer). In 390 Migrationsdateien gibt es 1 Datei mit DROP TABLE bzw. COLUMN oder TRUNCATE. | `rollback.md:85-100`; grep | VERIFIZIERT | Risiko |
| DB-Backup | Supabase plattformseitig; PITR unbestätigt („Operator-Aufgabe“) | `docs/runbooks/database-restore.md:15-20` | BLOCKIERT (Dashboard) | Risiko |

## F) Sicherheit für die Multi-Agent-Umsetzung (Pflichtgrundlage für die Freigabe von Welle 2)

| Aktion | Ausgelöste GitHub-Workflows | Secrets im Spiel | Deploy oder Preview | Prod-Veränderung möglich? | Status |
|---|---|---|---|---|---|
| Push eines Branches `claude/*` oder `agent/*` **ohne PR** | **Keiner.** Push-Trigger existieren nur für `main`, `feat/governance-ai-product` (`ci.yml:12-13`) und `feature/**` (`e2e.yml:4-7`). | keine (GitHub) | **Cloudflare-Pages-Preview über die Git-Integration** (öffentlich, Backend = Prod-Supabase) | Nein über GitHub. Über den Preview nur das, was jeder Nutzer der Live-App auch kann (dieselbe Prod-API). | GitHub VERIFIZIERT; Cloudflare-Branch-Preview ABGELEITET (für PR-Branches belegt, Dashboard-Einstellung BLOCKIERT) |
| Push auf `feature/**` | `e2e.yml` | TEST_BASE_URL, TEST_EMAIL (derzeit leer) | Cloudflare-Preview | Nein | VERIFIZIERT. **Präfix für Agenten vermeiden** |
| **Draft-PR → main, nur `docs/`** | `ci` (alle Jobs übersprungen), `e2e` (läuft), `codeql`, `merge-hygiene` (Labels/Kommentare), `auto-merge` (übersprungen) | e2e: TEST_*; merge-hygiene: github.token mit PR- und Issues-Schreibrecht | Cloudflare-Preview (Check `Cloudflare Pages`) | **Nein** | **VERIFIZIERT an #1971** (13 Check-Runs) |
| **Draft-PR → main, nur `src/`** | wie Docs, zusätzlich `deploy-cloudflare-pages` (nur Build; `deploy` und `smoke` wegen `:203` übersprungen), `lighthouse-ci`, `cta-enforcement` (src/pages, src/components), ggf. `pre-deploy-check` (src/runtime/agents, validator.ts). `deploy-siteos-preview` läuft nur bei Push auf main. | CLOUDFLARE_API_TOKEN und ACCOUNT_ID (nur im Detect-Step), 29× VITE_* (öffentlich), LHCI_GITHUB_APP_TOKEN | Cloudflare-Preview mit **neuem Agenten-Code gegen Prod-Supabase** | **Nein**, solange keine Workflow- oder Skriptdatei geändert wird | Trigger VERIFIZIERT |
| **Draft-PR → main mit `supabase/`** | zusätzlich `migration-collision`, **`migration-drift`**, **`entitlement-drift`** (bei migrations), **`edge-function-drift`** (bei functions/config), `pre-deploy-check` | **SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, SUPABASE_PROJECT_ID (Prod)** | kein Deploy auf PR. **Beim Merge sofort Prod-Migration und Function-Deploy über `deploy.yml`, ohne Gate.** | Auf PR: nur wenn der PR auch `scripts/check-*.mjs`, `package.json` (entitlement-drift ruft `npm ci` und `npm run`) oder Workflows ändert (R2). Bei Merge: **ja, automatisch.** | VERIFIZIERT (Trigger, Runs) |
| PR, der `.github/workflows/**` ändert | Die PR-Version des Workflows läuft mit allen Repo-Secrets (Same-Repo) | alle | beliebig | **Ja.** Das ist der gefährlichste Fall. | ABGELEITET (GitHub-Semantik) |
| Label `automerge` oder Draft → Ready | `auto-merge` (derzeit fehlerhaft, keine App-ID) | AUTOMERGE_APP_PRIVATE_KEY | – | Merge → Deploy (R1) | VERIFIZIERT |
| `workflow_dispatch` durch einen Agenten (Tool `actions_run_trigger`) | jeder Dispatch-Workflow | alle | Prod | **Ja** (R4, R5) | VERIFIZIERT (Trigger, Owner-Token) |

**Freigabefähig für Welle 2 (ABGELEITET):**
- Branches `claude/*` und `agent/*`;
- Draft-PRs mit Änderungen nur in `docs/**` oder `src/**` (ohne `src/lib/preview-sandbox.ts`);
- **keine** Änderungen an `.github/**`, `scripts/**`, `package*.json`, `supabase/**`, `functions/**`, `workers/**`, `wrangler*.toml`, `deploy/**`, `apps/agent-runtime/**`, `services/realsync-runtime-core/**`;
- kein `automerge`-Label, kein Ready-Schalten, kein Merge, kein Dispatch.

## G) Secrets-Inventar und Klartext-Funde

- **Inventar:** 56 eindeutige `secrets.*`-Namen in Workflows plus 3 `vars.*`. Vollständige Liste in D. Dazu kommen zwei Pseudotreffer `secrets.md` (Pfad im Kommentar `cron-health.yml:22`, `drift-alert.yml:261`).
- **Klartext-Scan:** Durchsucht wurden Stripe sk/rk/whsec, AWS, GitHub-Tokens, Slack, Supabase `sbp_`/`sb_secret_`, Anthropic, OpenAI, xAI, Google `AIza`, JWT, Postgres-URL mit Passwort und PEM-Private-Key. Ausgeschlossen waren node_modules, .git, dist, Lockfiles und `*.sql.bak` (laut Regel nicht lesen). Es wurden nur Pfad, Zeile und Länge ausgegeben, keine Werte.

| Fundstelle | Typ | Bewertung | Status |
|---|---|---|---|
| `test/app-builder/bolt-engine.test.ts:47,105,204,251` | Anthropic-Format | Test-Fixture (Marker `abcd`) | ok |
| `test/edge/ingest-key-auth.test.ts:64` | `sk_live_`-Format | Test-Fixture (`AbCd`) | ok |
| `src/features/governance/IntegrationsView.tsx:58` | `sk_test_`-Format | Platzhalter (`test`) | ok |
| `test/api-integrations.test.ts:482` | Slack `xoxb-` | Fixture (`secret`) | ok |
| `.archive/root-docs/WEBHOOK_INTEGRATION_GUIDE.md:46` | `whsec_` | Platzhalter (`1234`) | ok |
| `AUDIT/18_FINDINGS.md:408`, `docs/reports/production-readiness-2026-06-10.md:17`, `docs/runbooks/credentials-activation.md:29`, `docs/runtime/PRODUCTION_BLOCKERS.md:64` | `sk_live_` | Platzhalter (`PLACEHOLDER`) | ok |
| `.archive/root-docs/INCIDENT_RESPONSE_PLAYBOOK.md:80`, `worker/.env.example:7` | Postgres-URL mit Passwort | Platzhalter (`your-project`) | ok |
| `src/features/kodee/connections/ConnectionsView.tsx:281`, `platform/builder_orchestrator/tests/test_workspace.py:196`, `docs/infrastructure/google-cloud-billing.md:82` | PEM-Header | Placeholder-Text bzw. Fixture ohne Schlüsselmaterial | ok |
| `.env.docker.example:88-89`, `DEPLOYMENT.md:145-146`, `supabase/functions/*/README.md`, `scripts/provision-stripe-vault.sh`, `scripts/sync-stripe-catalog.ts` | `sk_live_`/`whsec_`-Präfixe, Länge ≤ 11 | Präfix-Platzhalter | ok |
| `src/lib/supabaseUrl.ts:20` | Supabase **publishable** anon key | öffentlich per Design (kein Secret) | ok |
| `tools/realsync-cli/data/demo.pub.pem` | Public Key | kein Secret | ok |

Ergebnis: **Kein echtes Klartext-Secret gefunden.** VERIFIZIERT für die genannten Muster. `*.sql.bak` wurde gemäß Regel nicht gescannt; zusätzlich gilt: „GitHub Secret Scanning-Status“ ist BLOCKIERT, weil das Tool `run_secret_scanning` hier nicht genutzt wurde.

---

## Abhängigkeiten zu offenen PRs und Issues

- **#1908** (`governance_evidence` append-only): Fügt `supabase/migrations/20261023223000_governance_evidence_append_only.sql` hinzu. Die Migration nennt sich selbst „nicht automatisch anwenden“, ein Merge wendet sie aber über `deploy.yml` sofort auf Prod an (R1). Auto-Merge wäre gesperrt (`auto-merge.yml:98-104`), ein manueller Merge nicht. VERIFIZIERT (`get_files`).
- **#1907** (Seats), **#1970** (GDPR-Delete), **#1869** (Audit-Claim-Security), **#1926** (Leads): Laut Titel wahrscheinlich `supabase/functions/**` oder Migrationen. Dann ist jeder Merge ein Prod-Deploy ohne Gate, und für Functions-PRs gilt keine Auto-Merge-Sperre. Dateilisten nicht geprüft, daher ABGELEITET.
- **#1971** (Docs-Draft): Referenz für die verifizierte Check-Matrix eines Docs-Draft-PRs (siehe F).
- **#1961**: Gleicher Branchname wie der bereits gemergte #1966 (Residency). Möglicherweise ein Duplikat. ABGELEITET.
- **Issue #1650** (Schema Drift): betrifft `migration-drift.yml` (R2) und `deploy.yml` (Repair-Liste `:56-69`).
- **Master-Epic #1972**: Diese Befunde sind die Gate-Grundlage.

## Vorschläge für Welle 2 (nur Empfehlungen, nichts geändert)

### Release-Gate-Checkliste je Welle-2-PR
1. Der Branch heißt `claude/*` oder `agent/*`. Kein `feature/*`.
2. Der PR bleibt Draft. Kein Label `automerge`.
3. Diff-Allowlist: nur `docs/**` bzw. die zugewiesenen `src/**`-Pfade. Kein `.github/`, `scripts/`, `package*.json`, `supabase/`, `functions/`, `workers/`, `wrangler*.toml`, `deploy/`, `apps/`, `services/`, `src/lib/preview-sandbox.ts`.
4. Keine Tool-Calls `merge_pull_request`, `enable_pr_auto_merge`, `actions_run_trigger` oder `update_pull_request(draft:false)`.
5. Ready und Merge nur durch Dominik. Vor Merge prüfen: Berührt der Diff `supabase/**`? Wenn ja, bedeutet das einen Prod-Deploy, also Einzel-Freigabe und Deploy-Fenster.
6. Nach Merge: Run von `deploy.yml` bzw. Check-Run `Cloudflare Pages` (App) prüfen, nicht den übersprungenen Actions-Job.

### Arbeitspakete (Infra)

**WP-OPS-1: Prod-Gate für Supabase-Deploy**
- Ziel: `environment: production` mit Reviewer für beide Jobs in `deploy.yml`.
- Dateien: `.github/workflows/deploy.yml` und GitHub-Settings.
- Neuer PR; Hotspot: CODEOWNERS.
- Risiko: mittel. Ein Deploy wartet dann auf Freigabe.
- Tests: Dry-Merge eines Docs-PRs, dann ein Functions-PR mit Status „waiting“.

**WP-OPS-2: PR-Drift-Guards ohne Prod-Schreibrechte**
- Ziel: In `migration-drift`, `entitlement-drift`, `edge-function-drift`, `function-acl-drift` und `cron-health` bei `pull_request` keine Prod-Secrets mehr. Stattdessen nur `schedule` oder `main`, oder ein Environment mit Reviewer, oder ein Read-only-Token.
- Dateien: diese 5 Workflows.
- Neuer PR. Risiko: weniger PR-Signal.
- Tests: PR-Lauf zeigt „Secrets nicht verfügbar → advisory skip“.

**WP-OPS-3: Dispatch-Workflows absichern**
- Ziel: Environment und `refs/heads/main`-Wächter für `migration-reconciliation` (Repair nur außerhalb des Dry-Runs), `delete-edge-function`, `enable-leaked-password-protection`, `provision-govard-gateway`, `siteos-production-e2e`, `cloudflare-domain-cutover`, `deploy-cloudflare-pages` (Dispatch nur von main). Stillgelegte Workflows `docker-deploy`, `deploy-frontend-*` und `tracker-db-update` löschen oder auf PR-Erstellung umstellen.
- Neuer PR. Risiko: gering.
- Tests: `actionlint`, Trockenlauf.

**WP-OPS-4: Token-Rechte**
- Ziel: Top-level `permissions: contents: read` (oder `{}`) für 20 Workflows ohne Block; `docker-deploy` pinnen oder löschen; `supabase/setup-cli` mit fester Version.
- Risiko: gering.
- Tests: CI grün.

**WP-OPS-5: Agenten-Identität**
- Ziel: Eigene GitHub App oder eigener Bot-Account für Agenten (nur `contents` und `pull_requests` auf Branches); Ruleset mit Pflicht-Review durch Dominik (Owner), Bypass nur Owner.
- Nur Settings, keine Repo-Dateien.
- Risiko: Umstellung der Agenten-Credentials.

**WP-OPS-6: Staging und Preview-Isolation**
- Ziel: Supabase-Staging- oder Branching-Projekt; Cloudflare-Preview-Env-Variablen und Pages-Function-Ziel per Env statt fest codiert (`functions/api/fn/[[name]].ts:8`); Cloudflare Access für Previews.
- Dateien: `functions/**`, `src/lib/supabaseUrl.ts`, Cloudflare-Dashboard.
- Neuer PR. Risiko: mittel.
- Tests: Preview zeigt auf das Staging-Projekt.

**WP-OPS-7: Runbooks**
- Ziel: `docs/runbooks/rollback.md` und `DEPLOYMENT.md` an Cloudflare Pages und den automatischen Supabase-Deploy angleichen; PITR-Status dokumentieren; Smoke-Test nach Git-Integration-Deploy (z. B. geplanter Workflow nur lesend).
- Risiko: gering.

## Blocker und offene Fragen an Dominik

1. **Environments** (BLOCKIERT, kein Tool-Endpunkt): Gibt es `production` und `staging`? Mit Required Reviewers, Deployment-Branch `main` und Wait-Timer? Liegen Secrets auf Repo- oder Environment-Ebene?
2. **Ruleset `main`** (BLOCKIERT): Bypass-Liste, Anzahl der Pflicht-Approvals (PR #1860 wurde ohne Approval gemergt), Code-Owner-Review, Force-Push- und Löschschutz, Merge Queue (keine `merge_group`-Runs), exakte Namen der 4 Required Checks.
3. **Actions-Settings** (BLOCKIERT): Default-„Workflow permissions“ (read oder write)? Approval-Pflicht für Fork-PR-Workflows (Repo ist public)?
4. **Cloudflare Pages** (BLOCKIERT, Cloudflare-Tools untersagt): Production-Branch (`main`?), Preview-Branch-Regel (alle Branches?), Preview-Env-Variablen (Prod-Supabase?), Access-Schutz für `*.pages.dev`?
5. **Auto-Merge:** Soll `AUTOMERGE_APP_ID` gesetzt werden? Bis Welle 2 abgeschlossen ist, wird empfohlen, sie **nicht** zu setzen.
6. **#1908:** Die Migration nennt sich „nicht automatisch anwenden“, ein Merge wendet sie aber automatisch an. Wie soll sie ausgerollt werden?
7. **Supabase-Backups:** Ist PITR aktiv, und mit welcher Aufbewahrungsdauer?
8. Sollen die Agenten in Welle 2 weiter den Owner-Account nutzen? Das ist R3, mit dem höchsten organisatorischen Hebel.

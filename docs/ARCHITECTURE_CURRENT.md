

## Deployment-Governance — Inventar, Zielkonzept, Entscheidungspakete

Stand: 24.10.2026 (Inventar auf `b4f8a2f`, am 26.10. gegen `7e72886` geprüft: keine Workflow-Änderung dazwischen). **Entwurf. Nichts davon ist umgesetzt.**
Grundlage: Entscheidungen B (Produktion nur mit gesonderter menschlicher Freigabe, auch Pages)
und D (Workflows jetzt nur planen) von Dominik. Jedes Paket in §6 braucht eine Einzel-Freigabe.

Status: **BESTÄTIGT** = im Repo nachgelesen · **TEILWEISE** = Indiz, nicht vollständig belegt ·
**NICHT GEPRÜFT** = außerhalb des Repos (GitHub-/Cloudflare-/Supabase-Einstellungen).

### 1. Kritische Befunde

| ID | Befund | Status |
|---|---|---|
| K1 | Push auf `main` deployt ohne Environment und ohne Freigabe: Supabase-Migrationen (`deploy.yml`: `supabase db push --include-all`, vorher `migration repair`), Edge Functions, VPS-Runtime, drei Workers, Pages. | BESTÄTIGT |
| K2 | Kein Deploy-Workflow hat einen Test-Job als `needs`. Pages baut nur (`build:full`), VPS, Workers und Supabase deployen ohne jede Prüfung. | BESTÄTIGT |
| K3 | `deploy.yml` hat keine `concurrency`: zwei Merges kurz nacheinander können `db push` parallel ausführen. | BESTÄTIGT |
| K4 | Produktions-Secrets liegen als Repo-Secrets vor (keine Environment-Secrets). PR-Workflows führen den Code des PR-Branches mit `SUPABASE_ACCESS_TOKEN` aus (`edge-function-drift`, `function-acl-drift`, `entitlement-drift`, `cron-health`), `migration-drift` zusätzlich mit `SUPABASE_DB_PASSWORD`. Wer auf einen Branch pushen darf, erreicht damit Produktionszugänge ohne Merge. Fork-PRs bekommen keine Secrets. | BESTÄTIGT (Workflows), Secret-Ablage NICHT GEPRÜFT |
| K5 | Agenten und Freigabeverantwortlicher nutzen denselben GitHub-Account (`realsyncdynamics-spec`, Owner und Admin des persönlichen Repos). PRs und Commits der Agenten laufen unter diesem Account. Eine Environment-Freigabe durch denselben Account trennt nicht. | BESTÄTIGT (PR- und Commit-Autoren) |
| K6 | Reine Dispatch-Workflows mit Produktionswirkung haben kein Environment (u. a. `migration-reconciliation`: `db push` + Functions, `delete-edge-function`, `cloudflare-domain-cutover`). Jede Identität mit Write-Recht kann sie starten, auch Agenten über die GitHub-API. | BESTÄTIGT |
| K7 | `auto-merge.yml` sperrt nur `supabase/migrations/**`. Ein PR unter `apps/agent-runtime/**`, `workers/**` oder `src/**` mit Label `automerge` wird gemergt und sofort deployt. | BESTÄTIGT |
| K8 | Cloudflare Pages ist zusätzlich per Git-Integration verbunden: Sie baut und veröffentlicht für jeden Branch-Push ein Preview, unabhängig von den Pfadfiltern der Actions (belegt auf dem reinen Doku-PR #1979). Ob sie `main` automatisch in Produktion deployt, ist offen. Das wäre ein Deploy-Pfad an GitHub Actions vorbei. | Previews BESTÄTIGT, Produktion NICHT GEPRÜFT |
| K9 | `tracker-db-update.yml` pusht per Zeitplan direkt auf `main` (`public/tracker-db-version.json`). Pushes mit `GITHUB_TOKEN` lösen keine Folge-Workflows aus. | BESTÄTIGT, Ruleset-Bypass NICHT GEPRÜFT |
| K10 | Lokale Skripte mit Produktionswirkung: `release-merge-deploy.sh` (Direkt-Push + wrangler), `deploy-phase4.sh`, `deploy-to-staging.sh`, `scripts/ops/supabase-functions-deploy.sh`, `scripts/ci/revert-orphan-migration-ledger.sh`, `stripe:sync` (`--apply`), `release:publish`. In dieser Cloud-Session gab es keine Supabase-/Cloudflare-/VPS-Zugangsdaten (nur Variablennamen geprüft). | TEILWEISE |
| K11 | Ruleset, Required Checks, Default-Rechte von `GITHUB_TOKEN` und Schutzregeln des bestehenden Environments `production` sind über die verfügbaren Werkzeuge nicht lesbar. | NICHT GEPRÜFT |

### 2. Inventar

#### 2.1 Workflows mit Produktionswirkung

| Workflow | Trigger | Ziel | Zugang | Tests davor | Approval | Risiko | Änderung | Rollback |
|---|---|---|---|---|---|---|---|---|
| `deploy.yml` | push `main` (`supabase/migrations/**`, `functions/**`, `config.toml`), dispatch | Prod-DB, Prod-Functions | Supabase-Token, DB-Passwort | keine | keine | sehr hoch | Env `production-db` / `production-functions`, `concurrency`, `needs` auf CI-Erfolg des SHA | DB: nur Vorwärts-Migration; Functions: Redeploy alter SHA (Dispatch mit `ref`, fehlt) |
| `deploy-agent-runtime-vps.yml` | push `main` (`apps/agent-runtime/**`, `deploy/agent-runtime-vps/**`), dispatch | VPS-Runtime | SSH, Service-Role, xAI-Key, Runtime-Token | keine | keine | hoch | Env `production-runtime`, Test-Job `typecheck && test` als `needs` | Automatisch bei unhealthy auf `:previous` (BESTÄTIGT); manueller Rollback fehlt |
| `deploy-backend-cloudflare.yml` | push `main` (`services/realsync-runtime-core/**`), dispatch | Worker | Cloudflare-Token | keine | keine | mittel | Env `production-edge`, `concurrency` | `wrangler rollback` (nicht im Repo hinterlegt) |
| `deploy-govard-gateway.yml` | push `main` (`workers/govard-gateway/**`), dispatch | Worker | Cloudflare-Token | keine | keine | mittel | wie oben | wie oben |
| `deploy-siteos-preview.yml` | push `main` (`workers/siteos-preview/**`, `src/lib/preview-sandbox.ts`), dispatch | Produktions-Worker der Vorschau-Sandbox | Cloudflare-Token | keine | keine | mittel | wie oben | wie oben |
| `deploy-cloudflare-pages.yml` | push `main` (`src/**`, `scripts/**`, `public/**`, `package.json` u. a.), PR (nur Build), dispatch | Pages Produktion (`--branch=main`) | Cloudflare-Token, `VITE_*` | Build, danach Smoke | keine | hoch (Entscheidung B) | Env `production-pages` am Job `deploy`; Build-Job bleibt ohne Env | Cloudflare „Rollback to deployment“; Redeploy per Dispatch mit `ref` (fehlt) |
| Cloudflare Git-Integration | Push (außerhalb GitHub) | Pages | Cloudflare | – | – | unbekannt | Automatische Produktions-Deploys im Dashboard abschalten, Previews behalten | Cloudflare-Dashboard |
| `deploy-playwright-scanner.yml` | push `main` (`deploy/playwright-scanner/**`), dispatch | VPS-Scanner | SSH, Supabase-Token | keine | Env `production`, Regeln NICHT GEPRÜFT | mittel | Reviewer prüfen, `needs` Build | nicht hinterlegt |
| `docker-deploy.yml` | dispatch | VPS (Docker-Stack) | SSH, JWT-/n8n-Secrets | `build-and-test` | Env `production`, Regeln NICHT GEPRÜFT | mittel | Reviewer prüfen | nicht hinterlegt |
| `deploy-frontend-vps-production.yml` | dispatch (`production`/`staging`) | VPS-Frontend | SSH | keine | Env aus Eingabe; `staging` würde ohne Regeln angelegt | mittel | festes Env statt Eingabe, oder stilllegen | nicht hinterlegt |
| `deploy-frontend-production.yml`, `deploy-frontend-vps.yml` | dispatch | VPS-Frontend (laut Kopf stillgelegt) | SSH | teils | keine | niedrig | stilllegen bzw. Env | – |
| `migration-reconciliation.yml` | dispatch | Prod-DB + Functions | Supabase-Token, DB-Passwort | keine | keine | sehr hoch | Env `production-db` | Vorwärts-Migration |
| `delete-edge-function.yml` | dispatch | Prod-Functions (löschen) | Supabase-Token | keine | keine | hoch | Env `production-functions` | Redeploy aus Repo |
| `enable-leaked-password-protection.yml` | dispatch | Supabase-Auth-Konfiguration | Supabase-Token | keine | keine | mittel | Env `production-functions` | Einstellung zurücksetzen |
| `cloudflare-domain-cutover.yml`, `provision-govard-gateway.yml` | dispatch | DNS, Pages-Domain, Worker-Ressourcen | Cloudflare-Token | keine | keine | hoch | Env `production-edge` | DNS-Records manuell |
| `siteos-production-e2e.yml` | dispatch mit Bestätigung | Produktions-Publish über SiteOS | Test-User | Eingabebestätigung | keine | mittel | Env `production-pages` | – |
| `tracker-db-update.yml` | Zeitplan, dispatch | `main` (Direkt-Push) | `GITHUB_TOKEN` (contents: write) | – | keine | niedrig | in PR umwandeln oder Bypass dokumentieren | Revert |
| `auto-merge.yml` | PR-Label | Merge (→ Deploys oben) | App-Token | Required Checks | Label | hoch | Ausschlüsse nach §4.5 | – |

#### 2.2 Workflows mit Produktionszugang ohne Deploy

| Workflow | Trigger | Zugang | Risiko | Änderung |
|---|---|---|---|---|
| `edge-function-drift`, `function-acl-drift`, `entitlement-drift`, `cron-health` | Zeitplan, dispatch, **PR (Pfadfilter)** | Supabase-Token | Code des PR-Branches läuft mit Token (K4) | PR-Lauf ohne Secrets (Offline-Teil); Prod-Abgleich nur Zeitplan/`main` oder Env mit Reviewer |
| `migration-drift.yml` | Zeitplan, dispatch, **PR** | Supabase-Token, DB-Passwort | wie oben, zusätzlich DB-Passwort | wie oben |
| `list-edge-functions.yml` | dispatch | Supabase-Token | Lesen | Env `production-readonly` optional |
| `vps-backup.yml`, `ssh-setup.yml` | Zeitplan/dispatch | SSH | Zugriff auf VPS | Env `production-runtime` |
| `e2e.yml` | push, PR `main` | Test-User | Test-Zugang | unverändert |
| `drift-alert.yml` | `workflow_run` | `issues: write` | keiner | unverändert |

Wiederverwendbare Workflows (`uses: ./.github/workflows/…`): keine gefunden (BESTÄTIGT).

### 3. Rollen- und Identitätsmodell

| Rolle | Identität | Rechte | Darf nicht |
|---|---|---|---|
| Agent | eigene Identität, getrennt vom Owner | Write: Branches, Draft-PRs, Kommentare | Admin, Environment-Freigaben, Settings, Merge geschützter PRs |
| Entwickler/Reviewer | Dominik (Arbeitsaccount) | Review, Merge-Freigabe | – |
| Release-Approver | separater menschlicher Account, nur Browser, Passkey/2FA, kein PAT, keine OAuth-Apps, nie mit Agenten verbunden | Required Reviewer der `production-*`-Environments | Code pushen |
| Owner (Break-Glass) | Owner-Account mit Hardware-Key | Admin, Notfall | Alltagsarbeit, Agentenverbindung |

Optionen zur Umsetzung:

- **A — minimal:** Release-Approver-Account als Collaborator anlegen und als einzigen Reviewer der Environments setzen, mit „Prevent self-review“ an und Admin-Bypass aus. Restrisiko: Agenten laufen weiter unter dem Owner-Account und könnten Environment-Regeln per Admin-API ändern. Einschätzung: **unzureichend**, nur als Übergang.
- **B — empfohlen:** Agenten bekommen eine eigene Identität (eigener GitHub-Account für die Claude-/Codex-Verbindung) mit Rolle Write. Der Owner-Account wird von keinem Agenten mehr genutzt. Environments wie in A. Bei einem persönlichen Repo haben Collaborators nur Write, das passt. Aufwand: claude.ai-GitHub-Verbindung und Codex auf den Agent-Account umstellen, Claude-GitHub-App-Zugriff prüfen.
- **C — langfristig:** Repo in eine GitHub-Organisation überführen (feinere Rollen, Teams als Reviewer). Integrationen (Cloudflare, Supabase, Apps) und URLs prüfen. Aufwand hoch.

Das Repo ist öffentlich: Environments mit Required Reviewers stehen damit auf allen GitHub-Plänen zur Verfügung.

### 4. Zielkonzept

#### 4.1 Environments

| Environment | Jobs | Branch-Regel | Secrets (umziehen) |
|---|---|---|---|
| `production-db` | `deploy.yml/db-push`, `migration-reconciliation` | nur `main` | `SUPABASE_DB_PASSWORD`, Supabase-Token |
| `production-functions` | `deploy.yml/functions-deploy`, `delete-edge-function`, `enable-leaked-password-protection` | nur `main` | Supabase-Token |
| `production-runtime` | `deploy-agent-runtime-vps`, `vps-backup`, `ssh-setup` | nur `main` | `VPS_SSH_*`, `SUPABASE_SERVICE_ROLE_KEY`, `XAI_API_KEY`, `AGENT_RUNTIME_API_TOKEN` |
| `production-edge` | drei Worker-Deploys, `cloudflare-domain-cutover`, `provision-govard-gateway` | nur `main` | Cloudflare-Token (Workers-Scope) |
| `production-pages` | `deploy-cloudflare-pages/deploy`, `siteos-production-e2e` | nur `main` | Cloudflare-Token (Pages-Scope) |
| `production` (besteht) | `deploy-playwright-scanner`, `docker-deploy` | nur `main` | vorhandene |
| `ci-readonly` (optional) | Prod-Abgleich der Drift-Checks | nur `main` | Supabase-Token |

Je Environment: Required Reviewer = Release-Approver, „Prevent self-review“ an, „Allow administrators to bypass“ aus.
Secrets erst ins Environment kopieren, dann als Repo-Secret löschen.
**Reihenfolge wichtig:** Environments erst anlegen und schützen, dann im Workflow referenzieren. Ein im Workflow genanntes, nicht vorhandenes Environment legt GitHub ohne Schutzregeln an.

#### 4.2 Gates vor dem Deploy

- Deploy-Jobs hängen per `needs` an Test-Jobs im selben Workflow (VPS: `npm ci && npm run typecheck && npm test`; Workers: Build/Typecheck; Supabase: `check:edge-syntax`, `check:edge-refs`, Migration-Validierung).
- Alternative für Pages: `workflow_run` auf erfolgreiche CI desselben SHA.
- Ein grüner Preview ist kein Gate.

#### 4.3 Synchronisierung

`concurrency: { group: production-<system>, cancel-in-progress: false }` je Environment, damit es keine parallelen Deploys gibt.
Wartende Läufe nach mehreren Merges: nur den neuesten freigeben, ältere verwerfen. Bei Migrationen jeden Lauf einzeln prüfen, weil `--include-all` alle offenen Migrationen anwendet.

#### 4.4 PR-Workflows mit Secrets

Auf `pull_request` keine Produktions-Secrets. Drift-Checks im PR nur offline gegen das Repo. Den Abgleich mit Produktion nur per Zeitplan oder auf `main`, oder im Environment `ci-readonly` mit Reviewer.

#### 4.5 Auto-Merge-Sperre

Kein Auto-Merge, wenn eines zutrifft:

- Label `security` oder Titel `(security)`
- Pfade `supabase/**`, `apps/agent-runtime/**`, `deploy/**`, `workers/**`, `services/realsync-runtime-core/**`, `.github/workflows/**`, `.github/CODEOWNERS`
- Auth- und Policy-Pfade, z. B. `src/features/auth/**`, `apps/agent-runtime/src/voice/**`, `supabase/functions/_shared/**`

Bis die Environments greifen, gilt wegen Entscheidung B zusätzlich jeder Pfad aus dem Pages-Deploy.
Ergänzend: CODEOWNERS für diese Pfade (Review durch den Owner).

#### 4.6 Auditierbarkeit

- GitHub protokolliert je Deployment Approver, Zeitpunkt und Kommentar. Pflichtkommentar: PR-Nummer und Triage-Zeile.
- Nach dem Deploy: Smoke-Ergebnis im Job-Summary. Bei Migrationen das `db push`-Log als Artefakt.

#### 4.7 Rollback

| System | Weg | Status |
|---|---|---|
| Pages | Cloudflare-Rollback auf früheres Deployment; Dispatch mit `ref` ergänzen | Dashboard-Weg NICHT GEPRÜFT |
| VPS-Runtime | automatisch auf `:previous` bei unhealthy; manueller Dispatch-Rollback ergänzen | Automatik BESTÄTIGT |
| Workers | `wrangler rollback` als Dispatch-Job ergänzen | fehlt |
| Edge Functions | Redeploy eines früheren SHA per Dispatch mit `ref` | fehlt |
| Datenbank | nur Vorwärts-Korrektur-Migration; PITR/Backup-Stand klären | NICHT GEPRÜFT |

#### 4.8 Notfallverfahren

Break-Glass nur über den Owner-Account und nur bei einem Produktionsvorfall. Danach innerhalb von 24 h eine Notiz mit Grund, Aktion und SHA im PR oder Issue.
`release:merge` und lokale Deploy-Skripte gelten als Break-Glass.

### 5. Abhängigkeiten

P1 (Identität) → P2 (Environments anlegen) → P3–P8 (Workflows). P6 braucht zusätzlich das Cloudflare-Dashboard.
P9–P11 sind unabhängig, brauchen aber jeweils eine eigene Freigabe. P11 ändert `scripts/**` und löst damit heute einen Pages-Deploy aus.

### 6. Entscheidungspakete

| Paket | Dateien / Ort | Änderung | Sicherheitswirkung | Unterbrechung | Test | Rollback | Freigabe | Aufwand |
|---|---|---|---|---|---|---|---|---|
| P1 Identität | GitHub-Accounts, claude.ai-/Codex-Verbindung | Option B aus §3 | Agent kann Produktion nicht freigeben | Agentensitzungen kurz neu verbinden | Test-PR vom Agent-Account; Freigabeversuch muss scheitern | Verbindung zurückstellen | Dominik | M |
| P2 Environments | GitHub Settings | §4.1 anlegen, Reviewer, Branch-Regel, Secrets umziehen | Secrets nur noch für freigegebene `main`-Jobs | Deploys warten auf Freigabe | Dispatch eines harmlosen Jobs mit Env | Regeln entfernen | Dominik | M |
| P3 Supabase | `deploy.yml`, `migration-reconciliation.yml`, `delete-edge-function.yml`, `enable-leaked-password-protection.yml` | `environment`, `concurrency`, Gate-Job | Keine ungeprüfte Prod-Migration | keine, solange freigegeben wird | Dry-Run-Branch: Job muss auf Freigabe warten | Revert-PR | Einzel | S |
| P4 VPS | `deploy-agent-runtime-vps.yml`, `vps-backup.yml`, `ssh-setup.yml` | `environment`, Test-Job, Rollback-Dispatch | Runtime nur getestet und freigegeben | keine | wie oben | Revert-PR | Einzel | S |
| P5 Workers | drei Worker-Deploys, `cloudflare-domain-cutover.yml`, `provision-govard-gateway.yml` | `environment`, `concurrency`, `wrangler rollback`-Job | wie oben | keine | wie oben | Revert-PR | Einzel | S |
| P6 Pages | `deploy-cloudflare-pages.yml`, `siteos-production-e2e.yml`, Cloudflare-Dashboard | `environment` am Job `deploy`; Git-Integration ohne automatische Produktion | Entscheidung B technisch umgesetzt | Frontend-Release wartet auf Freigabe | Merge eines Doku-PRs mit `src/`-Änderung: Deploy muss warten | Revert-PR, Dashboard zurück | Einzel | S |
| P7 sonstige Deploys | `deploy-playwright-scanner.yml`, `docker-deploy.yml`, `deploy-frontend-*.yml` | Reviewer prüfen, festes Env, Stilllegungen | keine ungeschützten Dispatch-Pfade | keine | Dispatch muss warten | Revert-PR | Einzel | S |
| P8 PR-Secrets | vier Drift-Workflows, `cron-health.yml` | §4.4 | PR-Code erreicht keine Prod-Zugänge | Drift-Befund im PR nur offline | PR mit geändertem Check-Skript: kein Secret im Lauf | Revert-PR | Einzel | M |
| P9 Auto-Merge | `auto-merge.yml`, `.github/CODEOWNERS` | §4.5 | Label löst keine geschützte Änderung aus | keine | Test-PR mit Label auf Sperrpfad: Auto-Merge aus | Revert-PR | Einzel | S |
| P10 CI-Abdeckung | `ci.yml`, `codeql.yml`, `merge-hygiene.yml`, neuer Secret-Scan | Läufe auch für gestapelte PRs, gitleaks | Security-PRs vor Merge vollständig geprüft | mehr CI-Minuten | gestapelter Test-PR bekommt alle Checks | Revert-PR | Einzel | S |
| P11 Skripte und Hotspots | `scripts/sync-with-main.mjs`, `scripts/lib/merge-playbook.mjs`, `scripts/release-merge-deploy.sh`, `package.json` | `sync:main` per Merge, Hotspots V6, Notfallskript mit Freigabe-Flag | Kein versehentlicher Rebase oder Direkt-Push | Pages-Deploy beim Merge | Unit-Tests der Skripte | Revert-PR | Einzel (+ Deploy) | S |
| P12 Direkt-Push | `tracker-db-update.yml` | PR statt Push, oder dokumentierter Bypass | `main` nur über PR | keine | Zeitplanlauf erzeugt PR | Revert-PR | Einzel | S |
| P13 Rule-Gates | neue Skripte `check:rules`, `check:deploy-gates`, `check:browser-secrets` + Tests | strukturelle Prüfungen, zuerst nur Warnung | Regeldrift und neue ungeschützte Deploys fallen auf | keine | Fixtures für positive und negative Fälle | Revert-PR | Phase | M |

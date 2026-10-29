# Claude Code — Kontext- und Token-Policy

Stand: 2026-09-12, ergänzt 2026-10-24

## Problem

Die alte Root-`CLAUDE.md` war ~88 KB / ~22k Tokens und wurde **in jeder Nachricht** geladen.
Zusätzlich startete `.claude/hooks/session-start.sh` in Cloud-Sessions (`CLAUDE_CODE_REMOTE=true`) jedes Mal `npm install` (Timeout 10 min).
`.mcp.json` lud acht MCP-Server (7× Hostinger + Perplexity) — Tool-Schemas in jeder Runde.
Ein versehentliches Read von `package-lock.json` (~185k Tokens) oder
`pricing.generated.ts` (~35k Tokens) leert das Fenster in einem Turn.

## Regeln

1. Root-`CLAUDE.md` bleibt unter ~150 Zeilen / ~2k Tokens (`npm run check:context`).
2. Ledger, Migrationszählung, Deploy-Run-IDs, Tabellen-Forensik → `docs/` oder Git-History, nie in CLAUDE.md zurückschreiben.
3. Cloud-SessionStart darf kein `npm install` ausführen. Abhängigkeiten kommen aus dem Setup-Skript
   der Cloud-Umgebung (unten). Agenten installieren nicht selbst, auch nicht über `npx`, Scratchpad oder globale Pakete.
4. MCP nur aktivieren, wenn die Session sie braucht; Website-Default: `.mcp.json` leer.
5. Website-Arbeit: Scope auf `src/pages` + genutzte Components. Kein Repo-Root-Glob.
6. Lange Chats beenden; neue Session nach großen Kontext-Änderungen.
7. Read-Deny in `.claude/settings.json` für Lockfiles, `*.generated.ts`, Build-Reports —
   nicht umgehen, indem die Dateien per Shell ganz ausgegeben werden.
8. `CLAUDE.md` importiert `AGENTS.md` (`@AGENTS.md`, offizielle Claude-Code-Importsyntax; ohne Import
   liest Claude `AGENTS.md` nicht, sobald eine `CLAUDE.md` existiert). Beide zählen ins Budget.
   Profile (Abschnitt „Aufgabenprofile“ unten) werden nur bei Bedarf gelesen, nie importiert.
9. Betriebsregeln zu Cron/Health gehören in Runbooks — kanonisch:
   `docs/runbooks/agenten-bestandsaufnahme-2026-09-06.md` §3 — nicht zurück in Root-`CLAUDE.md`.

## Cloud-Setup für Abhängigkeiten (Entscheidung A, 24.10.2026)

Abhängigkeiten werden vor der Agentensitzung bereitgestellt, nicht im Gespräch und nicht als
SessionStart-Hook. Einrichtung durch Dominik: Cloud-Umgebung → Edit → Setup script. Das Skript
läuft beim Start jeder neuen Cloud-Session (neuer Container), außerhalb des Agentenkontexts,
und startet ein Verzeichnis über dem Repo. Die Sperre `npm install`/`npm ci` in
`.claude/settings.json` bleibt unverändert.

```bash
#!/bin/bash
set -uo pipefail
cd RealSyncDynamics.AI || exit 1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 HUSKY=0
log="$HOME/.deps-setup.log"; : > "$log"
# Nur aus Lockfiles (reproduzierbar). Ein Fehler stoppt nur das betroffene Paket.
for d in . apps/agent-runtime apps/mcp-server services/openclaw-agent \
         services/playwright-scanner services/realsync-runtime-core; do
  if (cd "$d" && npm ci --no-audit --no-fund >/dev/null 2>&1); then
    echo "ok $d" >> "$log"
  else
    echo "FEHLER $d" >> "$log"
  fi
done
```

- Ohne Lockfile und daher nicht reproduzierbar: `worker/`, `deploy/playwright-scanner/`. Werden nicht installiert.
- Agenten lesen `~/.deps-setup.log` und melden fehlende Pakete. Prüfungen dort sind `TEILWEISE`.
- Abweichungen zur CI: Container-Node (aktuell 22) gegenüber CI-Node 20; Playwright-Browser des
  Containers gegenüber der Projektversion. Maßgeblich bleibt die CI.

## Wiederherstellen der langen Datei

`git show a5041eb:CLAUDE.md` (Stand vor diesem Slim-Cut).
Nicht nach Root kopieren, solange Cloud Code Tokens sparen soll.

## Aufgabenprofile (Ebene 3)

Genau ein Profil je Aufgabe lesen (Tabelle in `AGENTS.md`). Profile gelten zusätzlich zu `AGENTS.md` und lockern nichts davon.

### Profil Website (Landing, SEO, UI, Performance)

#### Pfade

Schreiben: `src/pages/`, `src/components/` soweit Public Pages sie importieren,
`src/index.css` (Design-Tokens im `@theme`-Block), `src/styles/`, `src/config/seo.ts`.
`packages/siteos-core` nur, wenn der Builder betroffen ist.
Nicht anfassen: `supabase/`, `platform/`, `services/`, `apps/` (dafür gibt es eigene Profile).

#### Startseite

Maßgeblich ist das Element von `<Route path="/">` in `src/App.tsx`, nicht dieses Dokument.
Stand 24.10.2026: `src/pages/LandingV6.tsx` (lazy geladen). Markup
`src/components/landing/v6/LandingV6View.tsx`, Logik/CTA-Ziele `useLandingV6.ts`,
Tokens `src/styles/landing-v6.css`. Ältere Fassungen als Vorschau unter `/design/landing-v5`,
`/design/landing-v4`, `/design/landing-v2`. Beta-Schalter `src/config/beta.ts`
(`VITE_BETA_PHASE=off` beendet die Testphase). Arbeitsplan `docs/claude/BETA_V5_WORKPLAN.md`
(nur den jeweiligen WP-Abschnitt lesen).

Weiterentwicklung: Dominiks Entscheidung, Wortlaut in `.github/PR_TRIAGE_POLICY.md`
(Feste Produktentscheidungen, Landing-Basis).

#### Inhalte und Design

- Preise und Checkout-Ziele nur aus `shared/pricing.ts`. Preise, Steuer-/Rechtstexte und Claims: Einzel-Freigabe.
- Design-DNA: Hard-Edge (90-Grad-Kanten, Sovereign Grid 40px), Monospace für technische Daten.
  Risk-/Statusfarben semantisch getrennt von Brand-Akzenten.
- Alte Landing-Dateien sind kein Löschbeleg. Vor Cleanup Importgraph, Tests, Registries und
  Vorschau-Routen prüfen. `npm run check:dead` liefert nur Kandidaten.
- Nur betroffene Dateien ändern, kleiner PR, keine Repo-weiten Refactors.

#### Prüfungen

`npm run lint`, `npm test`, `npm run build`, `npm run check:landing-claims`, bei Routen `npm run check:sitemap`.

#### Eskalation

`src/App.tsx`, Hero- und Landing-Komponenten sind Hotspots: offene PRs prüfen, seriell mergen.
Merge deployt heute automatisch auf Cloudflare Pages → Deploy-Freigabe nötig.

### Profil Voice Runtime

Ebene 3. Gilt zusätzlich zu `AGENTS.md`, lockert nichts davon.
Jede Änderung an Policy, Tool-Rechten, Session-Zustand, Kill-Switch oder Einwilligung
ist Security-Arbeit → zusätzlich `security.md`.

#### Pfade

Schreiben: `apps/agent-runtime/**` (Quelle `src/`, Tests `test/`, `README.md`).
Pflichtlektüre: `apps/agent-runtime/README.md`, bei Voice-Builder-Arbeit
`docs/architecture/vertical-voice-agent-builder.md` (falls vorhanden).

#### Prüfungen

```bash
cd apps/agent-runtime && npm run typecheck && npm test
```

CI: `Backend Services CI` → Job `apps/agent-runtime`. Läuft das lokal nicht vollständig
(fehlende Pakete, Stubs, andere Versionen), Ergebnis als `TEILWEISE` melden.

#### Sicherheitsanforderungen

- Mandant, Agent, Tool-Grant, Zähler, Rate-Limit, Kill-Switch und Einwilligung kommen aus
  dem serverseitigen Session-Zustand, nie aus dem Request-Body (SEC-01, SEC-05).
- Kill-Switch vor jeder Entscheidung und vor dem Executor frisch lesen; Lesefehler = gestoppt.
- Unverifizierte Einwilligung = abgelehnt.
- Schreibende Tools bleiben gesperrt, bis die Prüfung atomar mit dem Schreibzugriff erfolgt.
  Keine Env- oder Konfigurationsschalter, die das umgehen.
- Jede Entscheidung erzeugt Evidence an derselben Request-ID.

#### Eskalation

Push auf `main` unter `apps/agent-runtime/**` deployt heute automatisch auf den VPS
(`.github/workflows/deploy-agent-runtime-vps.yml`). Merge = Deploy → Deploy-Freigabe nötig.
Persistenz-Änderungen (neue Spalten, RPCs) → `database.md`, Migration nur einzeln freigegeben.

### Profil Security

Ebene 3. Gilt zusätzlich zu `AGENTS.md`, lockert nichts davon.
Security-PR-Definition und Freigabe: `.github/PR_TRIAGE_POLICY.md`. Jeder Security-PR braucht
eine Einzel-Freigabe.

#### Pfade

Nur die im Auftrag genannten Auth-, Policy-, Gateway-, RLS- oder Secret-relevanten Dateien.
Kennzeichnung: Titel `fix(security)`/`feat(security)` oder Label `security`.

#### Prüfliste vor jeder sicherheitsrelevanten Änderung

| Punkt | Frage |
|---|---|
| Trust Boundary | Welche Eingaben kommen von Client, Provider, anderem Prozess? |
| Authentifizierung | Wer ist der Aufrufer, wie belegt? |
| Autorisierung | Serverseitig, je Mandant und Agent, nicht über feste IDs? |
| Tenant-Isolation | Kann ein Mandant Daten eines anderen lesen oder schreiben? |
| Tool-Rechte | Grant aus der Session, begrenzt durch den Katalog? |
| Session-Lifecycle | Was passiert bei Abbruch, Neustart, mehreren Instanzen? |
| Kill-Switch | Frisch gelesen, vor Entscheidung und Ausführung? |
| Einwilligung | Verifiziert oder abgelehnt? |
| Rate-Limits | Serverseitig gezählt, vor dem Await reserviert? |
| Replay | Request-ID gebunden, einmalig verbraucht? |
| Race Conditions | Was liegt zwischen Prüfung und Ausführung? |
| Idempotenz | Doppelter Call = kein doppelter Effekt? |
| Audit/Evidence | Jede Entscheidung im Prüfpfad, an derselben ID? |
| Fail-closed | Jeder Fehlerpfad lehnt ab? |

#### Prüfmuster aus SEC-01 und SEC-05 (zusammengeführt in PR #1994)

- Rechte nie aus dem Request-Body oder einer festen Agent-ID ableiten (SEC-01).
- Zustand (Zähler, Kill-Switch, Einwilligung) nur serverseitig (SEC-05).
- Nur vorher angemeldete Calls entscheiden; Anmeldung einmalig verbrauchen (Replay).
- Entscheidung an Request-ID und kanonische Argumente des angemeldeten Calls binden.
- Zwischen letzter Prüfung und Executor kein Await; schreibende Aktionen gesperrt, solange
  die Prüfung nicht in derselben Transaktion liegt.
- Sperren strukturell absichern (AST-Guard statt Regex), mit Negativnachweis.

#### Prüfungen

Negativtests, die ohne den Fix scheitern (gegengeprüft), plus die Prüfungen des betroffenen
Profils. CodeQL läuft nur für PRs gegen `main`: gestapelte PRs vor der Merge-Freigabe auf `main` umstellen.

#### Eskalation

Bestätigte Lücke außerhalb des Auftrags: dokumentieren, eigener Security-PR, nicht nebenbei fixen.
Keine Details zu offenen Lücken in öffentliche Texte über das Nötige hinaus.

### Profil Database (Supabase, RLS, Migrationen, Edge Functions)

#### Pfade

Schreiben: `supabase/migrations/**` (nur neue Dateien), `supabase/functions/**`.
Dateien unter `supabase/migrations/`, die schon auf `main` liegen, nie ändern.

#### Regeln

- Jede Migration: Einzel-Freigabe, nie gebündelt, nie parallel zu anderen Migrationen oder offenen Rebases.
- Append-only, eindeutiger Timestamp nach der letzten Datei auf `main` (`npm run migrate:rename` bei Kollision).
- Keine destruktiven Schritte (`DROP`, Datenlöschung, Typverengung) ohne ausdrückliche Freigabe.
- RLS-Änderungen sind Security-Änderungen → `security.md`.
- Service-Role nur in Edge Functions.

#### Produktionswirkung

Ein Push auf `main` unter `supabase/migrations/**` oder `supabase/functions/**` führt heute
automatisch `supabase db push --include-all` bzw. den Functions-Deploy aus
(`.github/workflows/deploy.yml`). Merge = Produktionsmigration. `automerge` ist für diese PRs gesperrt.

#### Prüfungen

`npm run check:migration-collisions`, `npm run check:edge-syntax`, `npm run check:edge-refs`,
`npm run check:function-acls`, `npm run test:db` (lokale Test-DB, Voraussetzungen siehe `scripts/test-db/`).
CI: `ci.yml` Job `Migration validation`, `migration-collision.yml`, `migration-drift.yml`.

### Profil DevOps (CI, Build, Deploy, Monitoring)

#### Pfade

`.github/workflows/**`, `deploy/**`, `scripts/` (Deploy-, Release- und Prüfskripte), `wrangler.toml`,
`workers/**/wrangler.jsonc`.

#### Regeln

- Änderung an einem Workflow mit Produktionswirkung, an Secrets-Zugriff, Environments,
  Branch-Schutz oder Auto-Merge: Einzel-Freigabe, als eigenes Paket.
- Kein Workflow-Dispatch für Deploy-, Migrations- oder Lösch-Workflows ohne Einzel-Freigabe.
- Notfallpfad `npm run release:merge` (pusht direkt auf `main` und deployt): nur mit Einzel-Freigabe.
- Prüfungen nicht abschwächen: kein `continue-on-error`, kein Entfernen von Required Checks,
  kein `|| true` um Tests.

#### Produktionspfade

Inventar, Risiken und Zielkonzept: `docs/ARCHITECTURE_CURRENT.md` → „Deployment-Governance“.
Kurz: Pages, Supabase (DB und Functions), VPS-Runtime und drei Workers deployen heute bei
Push auf `main` ohne Environment-Freigabe.

#### Prüfungen

YAML-Struktur lokal parsen, `npm run check:context`, bei Skripten deren Tests.
Wirkung erst nach Merge sichtbar: Plan mit Rollback vorlegen, bevor die Freigabe erteilt wird.

### Profil QA (Tests, Regressionen, E2E, Sicherheitsnachweise)

#### Pfade

`test/**`, `tests/e2e/**`, `apps/*/test/**`, Test-Konfigurationen.

#### Teststufen

| Stufe | Befehl | Belegt |
|---|---|---|
| Syntax | `npm run check:edge-syntax` | Edge Functions parsen |
| Typecheck | `npm run lint`, App: `npm run typecheck` | Typen des ganzen Projekts |
| Unit | `npm test`, App: `npm test` | Logik |
| Integration/DB | `npm run test:db` | RLS, Migrationen gegen Test-DB |
| Security-Regression | Negativtests im betroffenen Paket | Lücke bleibt geschlossen |
| E2E | `npm run test:e2e` | Nutzerfluss im Browser |
| Deploy-Smoke | Job `smoke-test` in `deploy-cloudflare-pages.yml` | Nur Pages nach Deploy |

#### Regeln

- Ein gefilterter Typecheck ist kein Typecheck-Erfolg. Stubs, fehlende Pakete oder andere
  Versionen → `TEILWEISE`.
- Fehlende Abhängigkeiten nicht selbst installieren; Setup der Cloud-Umgebung oder CI nutzen
  (`docs/claude/CONTEXT_POLICY.md`).
- Nie Tests überspringen, deaktivieren oder in Quarantäne setzen, um grün zu werden.
- „Flaky“ ist keine Ursache. Höchstens ein Re-Run zur Bestätigung.
- Für Fixes: Fehler zuerst reproduzieren, dann denselben Check grün zeigen.
- Cloudflare-Preview belegt nicht die Runtime; Runtime-Nachweis nur über `Backend Services CI`.

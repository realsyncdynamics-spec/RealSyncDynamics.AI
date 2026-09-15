# Ökosystem-Zusammenführung — vertikale Integration

**Status**: `proposed` · **Ebene**: cross · **Stand**: 2026-09-08
**Geltung**: Richtungsdokument. Implementierungsfragen bleiben bei `CLAUDE.md`
und `docs/architecture/target-architecture.md`. Dieses Dokument entscheidet
**was System of Record ist** und **in welcher Reihenfolge** parallele
Produkte, Repos und Einstiege zusammengeführt werden — nicht, wie einzelne
Views umgebaut werden.

**Kurzfassung**: RealSync hat kein Ökosystem-Problem aus Mangel. Es hat ein
Ökosystem-Problem aus **parallelen Identitäten**. GitHub, Vercel-Geister und
die Live-Domain erzählen drei verschiedene Firmen. Vertikale Integration
heißt nicht „alles in ein Repo schieben“. Sie heißt: **eine Identität, eine
Control Plane, eine Entscheidung, ein Nachweis** — und alles andere ist
Ausführung oder Archiv.

---

## 0. Urteil

Die Zusammenführung ist nötig. Ein Big-Bang-Merge der GitHub-Repos wäre der
falsche Schnitt.

Gemessen am 2026-09-08 gegen die GitHub-Org `realsyncdynamics-spec` (13
öffentliche Repos), gegen HTTP-Header von `realsyncdynamicsai.de` und gegen
den Baum von `RealSyncDynamics.AI` (`main`):

1. **Ein kanonisches Produkt existiert bereits**: dieses Repo, Vite/React-SPA,
   Supabase EU, Cloudflare Pages, Domain `realsyncdynamicsai.de`.
2. **Zwölf Schwester-Repos existieren daneben.** Fünf davon tragen noch
   Vercel-Homepages. Alle fünf antworten mit `DEPLOYMENT_NOT_FOUND`. Sie sind
   keine zweiten Produkte. Sie sind **öffentliche Leichen**.
3. **Ein zweites Agent-OS läuft parallel** (`realsync-agent-os`, zuletzt
   2026-09-04, Homepage `realsync.io`, eigener Postgres/Redis/Cloud-Run-Stack).
   Das ist der einzige lebende Konkurrent zur Runtime in *diesem* Repo.
4. **Die Live-Domain ist nicht das Inventar.** `App.tsx` trägt ~479
   Routen-Pfade. Die Sitemap listet 116 URLs. `/os/*`, `/app/*`,
   `/unified-entry/*`, `/flow/*`, `/demo-*` und öffentliche Landings sind
   weiterhin parallele Einstiege in dasselbe Mandantenkonto.
5. Die Zielarchitektur (`target-architecture.md`, fünf Ebenen) ist **schon
   die Integrationsachse**. Was fehlt, ist der Mut, tote Äste abzuschneiden
   und lebende Äste an *eine* Entscheidungsschicht zu hängen.

Wer „Ökosystem“ als Monorepo-Fusion liest, importiert Next.js/Vercel-Muster
in ein Repo, das beides ausdrücklich verbietet, und eine zweite Datenbank in
ein Produkt, das Mandantentrennung als nicht verhandelbar führt. Das wäre
keine Integration. Das wäre Drift mit Git-History.

---

## 1. Messung

Methode: GitHub-API gegen `realsyncdynamics-spec` (Listen + Repo-Metadaten +
README-Köpfe), HTTP-HEAD/GET gegen die genannten Hosts, Dateibaum und
Routenzählung in diesem Repo. Die HTML-Inhalte von
`realsyncdynamicsai.de` sind aus dieser Umgebung **nicht** lesbar —
Cloudflare liefert `403` mit `cf-mitigated: challenge`. Aussagen zur
Live-Seite stützen sich deshalb auf Repo, Sitemap, Header und zuvor
dokumentierte Produktionsmessungen, nicht auf ein gecrawltes DOM.

### 1.1 GitHub — Org `realsyncdynamics-spec`

Die Org `realsyncdynamics` existiert nicht. SDK-README und ältere Docs
zeigen noch auf `github.com/realsyncdynamics/…`. Das ist ein Namensbruch:
Crawler und Partner landen im Leeren.

| Repo | Letzter Push | Homepage / Claim | Befund |
|---|---|---|---|
| **`RealSyncDynamics.AI`** | 2026-09-08 | *(homepage leer)* | **System of Record.** Vite 6 · React 19 · Supabase EU · Cloudflare Pages. |
| `realsync-agent-os` | 2026-09-04 | `realsync.io` — „EU-AI-Act-konformes Agenten-SaaS“, Playbooks, eigener Stack | **Lebender Parallel-Runtime.** Node · Postgres 16 · Redis · Cloud Run · Terraform. Letzter Commit dokumentiert Billing-Ausfall. |
| `realsync-platform` | 2026-05-01 | `realsync-platform.vercel.app` · Next.js 15 · Domain `realsyncdynamics.de` | Tot auf Vercel (`DEPLOYMENT_NOT_FOUND`). README beschreibt Deploy auf Vercel **gegen dasselbe Live-Supabase-Projekt**. Das widerspricht der Vercel-Sperre *und* der Secret-Regel dieses Repos. |
| `creator-os` | 2026-05-16 | `creator-os-beta-nine.vercel.app` | Tot. |
| `realsyncdynamics-website` | 2026-05-16 | `realsyncdynamics-website.vercel.app` | Tot. Kein README. |
| `realsync-ads` | 2026-04-09 | `realsync-ads.vercel.app` | Tot. Social-Publisher, parallel zu `src/core/social-orchestrator`. |
| `digital-optimus` | 2026-04-09 | `digital-optimus.vercel.app` | Tot. Electron-Screen-Agent, eigene `do_*`-Tabellen. |
| `realsync-dynamics` | 2026-03-20 | „Zentrale Multi-App Plattform“ | Vorgänger. Kein README. |
| `RealSyncOptimusAgent` | 2026-03-21 | Next.js 14, Grok/Perplexity/Claude, Pinecone | Prototyp eines persönlichen Agenten. Nicht an `/app` angebunden. |
| `paperclip` | 2026-04-04 | Fork `paperclip.ing` | Fremdes OSS. Kein Produktbestandteil. |
| `powershell-infra` | 2026-03-30 | Server-Remoting | Betriebs-Skript, kein SaaS. |
| `RealSync-Bildung` | 2026-04-29 | — | Leer (`size: 1`). |
| `realsyncdynamic.ai.gooogle-studio-` | 2026-08-07 | „rsd.googleai studio.ai“ | Leer (`size: 1`). Tippfehler im Namen. |

Vercel-Homepages, gemessen 2026-09-08: alle fünf genannten `.vercel.app`-Hosts
antworten `404` / `x-vercel-error: DEPLOYMENT_NOT_FOUND`. `realsync.io`
antwortet `200` mit einem Lander-Redirect (`window.location.href="/lander"`)
— das ist keine Produktfläche. `realsyncdynamics.de` war in dieser Messung
nicht erreichbar (leere Antwort).

### 1.2 Dieses Repo — schon ein Ökosystem *im* Baum

```text
RealSyncDynamics.AI/
├── src/                         Vite-SPA  (kanonische Fläche)
├── supabase/                    Edge Functions + Migrations  (kanonisches Backend)
├── apps/agent-runtime           Node-Agent-Runtime
├── apps/mcp-server              MCP-Governance-Server
├── services/openclaw-agent
├── services/realsync-runtime-core
├── services/realsync-evidence-runtime
├── services/playwright-scanner
├── platform/                    Next.js + Python, eigener Compose-Stack,
│                                laut README „in ein eigenes Repo kopierbar“
└── packages/sdk · evidence-chain · siteos-core
```

Dazu kommen **drei Kunden-Schalen** für dieselbe Anmeldung:

| Schale | Einstieg | Realität |
|---|---|---|
| Governance OS | `/app/*` | Kanonisch. Shell + Dashboard + Assistent (seit 2026-09-08: `/assistant` und `/dashboard` aliasen hierher). |
| Enterprise-OS | `/os` · `/os/app/*` | Zweite App-Schale, eigener Login-Pfad. |
| Funnel / Demo | `/unified-entry/*` · `/flow/*` · `/demo-*` | Erwerb und Simulation, nicht Runtime. |

Öffentlich: `/` (MainLanding, Design-Freeze), plus `/landing`,
`/realsync-landing`, Branchen-LPs, Tool-Doorways. Die Sitemap hat 116 Einträge;
der Router hat ein Vielfaches.

`platform/` ist die gefährlichste interne Parallele: sie *sieht aus* wie das
Produkt, spricht eine eigene DB an, nutzt Next.js und ist aus Root-CI
ausgenommen. Wer sie „integriert“, indem er sie nach `/app` spiegelt, baut
eine dritte Control Plane.

### 1.3 Live-Domain `realsyncdynamicsai.de`

Aus dieser Umgebung: Cloudflare Pages, Bot-Fight-Mode (`cf-mitigated:
challenge`). Das ist Betrieb, kein Produktbefund — verhindert aber die
Behauptung, die Live-HTML sei hier nachgelesen.

Was *im Repo* für die Domain gilt und damit nach dem nächsten Deploy gilt:

- Kanonischer anonymer Einstieg: `/audit` → `gdpr_audits` (Entscheid
  2026-08-23, `docs/product/canonical-funnel-decision.md`).
- Kanonischer Workspace: `/app/dashboard` hinter `AppGate`.
- Aliase `/assistant`, `/dashboard`, `/command-center` → `/app/dashboard`
  (PR zur Workspace-Vereinigung, 2026-09-08).
- `/os/*` bleibt ein zweiter sichtbarer Produktkörper.

---

## 2. Kritik — warum „zusammenlegen“ meist scheitert

**Das Produkt ist nicht untergebaut. Es ist überzählt.**

Dieselbe Zusage („EU-Governance, Agenten, Creator-Schutz, Ads, Audit“) steht
in mehreren Repos, mehreren Frameworks und mehreren Clouds. Der Kunde kann
das nicht als Ökosystem lesen. Er liest es als Unentschlossenheit.

Vier konkrete Brüche, die eine naive Fusion verschlimmern würde:

1. **Identitätsbruch.** Org `realsyncdynamics-spec`, Domain
   `realsyncdynamicsai.de`, Sibling-README `realsyncdynamics.de`, Agent-OS
   `realsync.io`, SDK-Links auf eine nicht existierende Org
   `realsyncdynamics`. Ein Ökosystem hat *einen* öffentlichen Namen.
2. **Runtime-Bruch.** Dieses Repo: Supabase + Edge Functions + PDP (noch
   Shadow). `realsync-agent-os`: eigener Postgres, Cloud Run, OpenClaw,
   Playbooks. `apps/agent-runtime` + `services/openclaw-agent` +
   `platform/governance_backend` sind *weitere* Agenten-Steuerungen im
   kanonischen Baum. Vier Execution-Ebenen, eine Zusage „der PDP entscheidet“.
3. **Hosting-Bruch.** Dieses Repo verbietet Vercel. Die Schwester-Repos sind
   darauf gebaut. Ein Merge würde die verbotene Abhängigkeit physikalisch
   in den Hauptbaum holen.
4. **Wahrheitsbruch.** `realsync-platform` dokumentiert denselben Live-Projekt-
   Identifier wie Produktion und einen Vercel-Deploy-Pfad dorthin. Für ein
   Produkt, das Prüfpfad und Residenz zusagt, ist ein öffentliches
   Parallel-Frontend gegen dieselbe Datenbank ein Governance-Befund — auch
   wenn das Deployment tot ist. Der Code und die Anleitung existieren weiter.

Die Zielarchitektur sagt bereits: Customer Experience spricht nie direkt mit
Infrastruktur; die Governance Engine entscheidet; Agenten führen nur nach
Verdikt aus. **Heute kann ein Agent in einem Sibling-Repo entscheiden, ohne
dass dieses Repo es je sieht.** Das ist die eigentliche Integrationslücke,
nicht fehlende UI.

---

## 3. Was System of Record ist — und was nicht

| Schicht (Zielarchitektur) | System of Record | Darf nicht SoR sein |
|---|---|---|
| 1 Customer Experience | `realsyncdynamicsai.de` + `/app` in diesem Repo | Vercel-Apps, `/os/app` als Dauer-Parallel, `platform/nextjs_frontend` |
| 2 Control Plane | `tenants` · Assets · Entitlements in Live-Supabase dieses Repos | Zweite Postgres in `realsync-agent-os` oder `platform/` |
| 3 Governance Engine | `governance-decide` / PDP in `supabase/functions/_shared/pdp` | Lokale Policy-Engines in Python-`platform/` oder Agent-OS, die *lockern* dürfen |
| 4 Agent / Automation | Execution hinter dem PDP: Edge Functions, `apps/agent-runtime`, Cron | Eigenständige SaaS-Playbooks mit eigener Abrechnung auf `realsync.io` |
| 5 Infrastructure | Kunden-Systeme; Beobachtung zurück in Evidence | Ein zweites „Source of Truth“-Dashboard über dieselben Systeme |

**Regel:** Ein Artefakt wird integriert, indem es eine der fünf Ebenen
*erfüllt* und die darunterliegende *ruft*. Es wird nicht integriert, indem
sein UI nach `src/pages/` kopiert wird.

---

## 4. Vertikale Integrationsachse

Die Achse ist die Produktkette aus `target-architecture.md`, nicht die
Git-Org-Liste:

```text
Identität (Tenant · Session · Entitlement)
    → Beobachtung (Asset · Audit · Connector)
        → Entscheidung (PDP · Policy Pack · Approval)
            → Nachweis (Evidence · Prüfpfad · Hold)
                → Ausführung (Agent · Workflow · Channel)
                    → Oberfläche (/app, ein Shell)
```

Jeder Schritt hängt am vorigen. Ein Agent ohne PDP ist kein Modul, sondern
ein unkontrollierter Aktor. Ein Dashboard ohne Evidence ist Dekoration. Eine
Landing ohne `/audit` → `/app` ist ein zweiter Trichter.

`/assistant` und `/dashboard` auf `/app/dashboard` zu legen war **Schritt 6
dieser Achse, nicht Schritt 1.** Die Schale ist vereinigt; die Runtime
dahinter ist es noch nicht.

---

## 5. Plan — in dieser Reihenfolge, nicht andersherum

Keine Kalenderangaben. Ein Schritt gilt als erledigt, wenn das Abnahmekriterium
gegen Produktion *oder* gegen den explizit benannten Archiv-Zustand gemessen
ist — nicht wenn ein Repo umbenannt wurde.

### Schritt 0 — Namensraum einfrieren (kein Code)

Abnahme:

- Genau eine öffentliche Produkt-URL: `https://realsyncdynamicsai.de`
- Genau ein GitHub-Produktrepo mit gesetzter Homepage auf diese URL
- Org-Anzeige und Impressum nennen denselben Rechtsträger
- `realsync.io` und `realsyncdynamics.de` entweder 301 hierher oder bewusst
  geparkt *ohne* Produktclaim

Ohne diesen Schritt bleibt jede technische Fusion unsichtbar, weil der Markt
weiter drei Domains sieht.

### Schritt 1 — Geister archivieren (GitHub, kein Merge)

Abnahme:

- Repos ohne laufendes Deployment und ohne einzigartigen Vertrag werden
  **archiviert**, nicht gemergt: `creator-os`, `realsyncdynamics-website`,
  `realsync-ads`, `digital-optimus`, `realsync-dynamics`,
  `RealSyncOptimusAgent`, `RealSync-Bildung`,
  `realsyncdynamic.ai.gooogle-studio-`
- `paperclip`: Fork-Beziehung belassen oder löschen; nicht in den Produktbaum
- `realsync-platform`: archivieren **nach** Prüfung, ob Vercel-Env noch auf
  das Live-Supabase-Projekt zeigt. Falls ja: Keys rotieren, Vercel-Projekt
  kappen. Das ist ein Sicherheits-Schritt, kein Aufräumen.
- README/SDK-Links auf `github.com/realsyncdynamics/…` auf die existierende
  Org umbiegen oder als tot markieren

Kein Code aus diesen Repos wird in `src/` kopiert, bevor Schritt 3 sagt,
*welche Fähigkeit* fehlt. Die Wahrscheinlichkeit, dass dort etwas Unique
lebt, das `/app` nicht schon hat, ist gering und muss *bewiesen* werden.

### Schritt 2 — Eine Kundenschale (dieser Baum)

Abnahme:

- Ein auth-gegateter Arbeitsraum: `/app/*` hinter `GovernanceBrowserShell`
- `/assistant` · `/dashboard` · `/command-center` bleiben Aliase (bereits
  entschieden)
- `/os` und `/os/app/*` werden Alias oder bewusstes Enterprise-Theme
  **derselben** Shell — nicht eine zweite App
- `/unified-entry/*` und `/flow/*` enden in `/app/dashboard`, nicht in einem
  dritten Home
- Öffentliche Tür bleibt `/` plus `/audit`. Weitere Landings dürfen werben,
  dürfen aber keinen zweiten Workspace öffnen

Das ist Routing und Shell, kein Redesign. Design-Freeze der Startseite bleibt.

### Schritt 3 — Eine Beobachtung, ein Asset (Datenvertrag)

Abnahme ist der bestehende Contract in `asset-lifecycle-contract.md`:

- `governance_assets` ist das Objekt
- `gdpr_audits` bleibt der anonyme Scan (`canonical-funnel-decision.md`)
- Claim hebt den Scan auf ein Asset; danach Observation, nicht „Scan fertig“
- Kein dritter Scan-Datensatz, keine zweite Asset-Tabelle aus einem
  Sibling-Repo

Solange SiteOS, Audit, Website-Governance und Agent-OS verschiedene Objekte
für „die Website des Kunden“ führen, ist vertikal nichts integriert.

### Schritt 4 — Eine Entscheidung (PDP aus Shadow in den Weg)

Abnahme:

- Jeder Ausführungspfad (Publish, Bot, Agent-Runtime, M365-Reaktion, CI/CD-
  Gate in `platform/`) ruft **dieselbe** `governance-decide`-Semantik
- Shadow-Log ist auswertbar (`pdp_shadow_readiness`) *bevor* ein Schalter
  auf `enforce` geht
- Kein Pfad darf lockern, was der PDP sperrt
- `realsync-agent-os`-Playbooks dürfen erst angeschlossen werden, wenn sie
  diesen Vertrag rufen — nicht wenn sie „auch Governance“ auf der Website
  behaupten

Ohne Schritt 4 ist jede Agenten-Fusion ein Compliance-Rückschritt.

### Schritt 5 — Eine Ausführungsschicht (Agenten als PEP, nicht als Produkt)

Abnahme:

- Execution lebt in *diesem* Repo: Edge Functions + `apps/agent-runtime` +
  Cron, dessen **letzter Lauf grün** ist (`cron.job_run_details`, nicht nur
  `cron.job`)
- `realsync-agent-os` wird entweder (a) zum Worker hinter dem PDP dieses
  Repos, mit Mandant aus *unserem* `tenants`, oder (b) archiviert. Ein
  drittes „oder beides vermarkten“ ist ausgeschlossen
- `platform/governance_backend` bleibt Experiment, bis es denselben PDP
  *verschärfend* ruft; es wird nicht die öffentliche `/app`
- OpenClaw, n8n, Cloud Run sind Infrastruktur der Ebene 5/4, keine eigenen
  Marken

Der Billing-Ausfall, den `realsync-agent-os` selbst dokumentiert, ist ein
Argument *gegen* Parallelbetrieb, nicht für Eile beim Anschluss.

### Schritt 6 — Oberfläche folgt der Kette, nicht umgekehrt

Erst wenn 2–5 halten:

- Assistent, Bots, WhatsApp, Voice sind Kanäle derselben Governance-AI
- Reports und Evidence-Export lesen dieselbe Kette
- Marketplace verkauft Module der Control Plane, keine Deep-Links in tote
  Vercel-Apps

Der Assistent-Dashboard-Schnitt (2026-09-08) gehört hierher und ist
**erledigt**, sobald er auf `main` liegt. Er darf nicht als Ökosystem-
Integration missverstanden werden.

---

## 6. Bewusste Nicht-Schritte

| Nicht tun | Warum |
|---|---|
| Alle Repos in dieses Monorepo mergen | Zieht Next.js, Vercel-Config und zweite Datenbanken in einen Vite-Baum |
| `platform/` zum öffentlichen Frontend machen | Root-CI kennt sie nicht; Next.js ist hier kein Zielstack |
| `realsync.io` als zweite Produktmarke führen | Spaltet Suche, Impressum und Trust |
| Agent-OS-Playbooks vor PDP-Anschluss vermarkten | Behauptet Runtime-Governance, ohne die Engine dieses Repos |
| Weitere Branchen-LPs als Einstieg in eigene Dashboards | Wiederholt den `/assistant` vs `/dashboard`-Fehler eine Ebene höher |
| „Ökosystem“ als Navigation mit 20 gleichwertigen Kacheln | Das ist ein Verzeichnis, keine vertikale Integration |
| Design der eingefrorenen Startseite anfassen | Freigabepflicht; löst keinen der Brüche |

---

## 7. Erster ausführbarer Schnitt (nach Freigabe)

Nur das, und in dieser Reihenfolge. Jeder Punkt ist eine eigene, kleine
Änderung — kein Sammel-PR.

1. **GitHub-Hygiene (Org):** Homepage von `RealSyncDynamics.AI` auf
   `https://realsyncdynamicsai.de` setzen. Tote Vercel-Repos archivieren,
   nachdem `realsync-platform` auf Restzugriff zum Live-Projekt geprüft wurde.
2. **Domain-Hygiene:** Entscheiden: 301 von `realsync.io` /
   `realsyncdynamics.de` → kanonische Domain, oder explizites Parken ohne
   Claim. Nicht offen lassen.
3. **Schale:** `/os/app/*` auf die `GovernanceBrowserShell` von `/app`
   zurückführen oder hart als Alias dokumentieren und routen. Kein drittes
   Theme-Framework.
4. **Runtime-Anschluss, nicht Merge:** `realsync-agent-os` gegen den PDP-
   Vertrag dieses Repos lesen. Ergebnis ist ein kurzes Gutachten: Worker
   oder Archiv. Kein Code-Import in dem Schritt.

Punkt 1 und 2 sind Betreiberakte (GitHub-UI, DNS). Dieser Baum kann sie nicht
allein vollziehen. Punkt 3 und 4 sind PRs in *diesem* Repo bzw. ein
Lesegutachten des Sibling-Repos.

---

## 8. Verhältnis zu bestehenden Dokumenten

| Dokument | Rolle nach dieser Messung |
|---|---|
| `target-architecture.md` | Bleibt die Ebenen- und Produkt-SSoT. Dieses Dokument liefert den *äußeren* Schnitt (Repos, Domains, parallele Runtimes). |
| `canonical-funnel-decision.md` | Bleibt der Einstiegsvertrag (`/audit`, `gdpr_audits`). |
| `asset-lifecycle-contract.md` | Bleibt der Objektvertrag für Schritt 3. |
| `governance-os-enforcement-plan.md` | Bleibt der PDP-Schalterplan für Schritt 4. |
| `agent-manager-roadmap.md` / `agent-os.md` | Beschreiben interne Agenten-*dieses* Repos. `realsync-agent-os` ist dort nicht das SoR. |
| `CLAUDE.md` | Bleibt Ist-Zustand. Sobald Schritt 0–1 vollzogen sind, gehören Org-Name, Homepage und „kein Vercel-Sibling gegen Live-DB“ hierher nachgezogen. |

---

## 9. Abnahmeformel

Ein Ökosystem ist integriert, wenn für einen Mandanten gilt:

> Dieselbe Sitzung sieht denselben Tenant, dieselben Assets, dasselbe
> Verdikt und denselben Nachweis — unabhängig davon, ob der Mensch über
> `/audit`, `/app`, WhatsApp oder einen Agenten gekommen ist.

Solange GitHub, Vercel-READMEs oder `/os` eine zweite Antwort auf dieselbe
Frage geben, ist die Zusammenführung nicht fertig. Eine größere `src/`-Tree
allein ändert daran nichts.

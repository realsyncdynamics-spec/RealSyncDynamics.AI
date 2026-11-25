# Konsolidierung Agentenarchitektur — Bestandsprüfung und Plan

**Stand:** 25.11.2026 · Koordination: CHIEF · lesende Prüfung, keine Merges, keine Deploys.
Befundstatus: **BESTÄTIGT** (selbst geprüft, Beleg genannt) · **TEILWEISE** · **OFFEN** · **BLOCKIERT**.

## 0. Kernbefunde

| # | Befund | Status | Beleg |
|---|---|---|---|
| K1 | Kein offener PR trägt die Rollen in das zentrale Register `packages/ai-os-core` ein. Das Register kennt nur die fünf Betriebsrollen `development`, `compliance`, `infrastructure`, `business-ops`, `knowledge`. Die zehn Rollen leben nur in `.claude/agents/*.md` und `docs/agent-memory/roles.md`. | BESTÄTIGT | `packages/ai-os-core/src/agents.ts:17-121`, `types.ts` `AgentId`; `git diff --stat` aller Agenten-PRs |
| K2 | #2440 ist ein Integrationszweig und enthält #2416, #2436, #2434, #2420, #2425 vollständig. Alle neun Agentendateien und `roles.md` in #2440 sind byte-gleich mit #2436. | BESTÄTIGT | `git merge-base --is-ancestor`, Blob-Vergleich `git rev-parse <ref>:<pfad>` |
| K3 | Reihenfolge #2436 → #2416 per Squash erzeugt add/add-Konflikte in `deputy.md`, `nova.md`, `roles.md`. Auflösung ist in `roles.md` vorab festgelegt (Fassung #2436). | BESTÄTIGT | `git merge-tree` main+#2436 ← #2416 |
| K4 | #2450 und #2451 definieren je ein **zweites, konkurrierendes** Agentenset (alle 9 Dateien add/add-Konflikt gegen #2440) und lockern Rechte (`Bash` für DEPUTY/NOVA/FLOW in #2450; `Write/Edit` für 6 Rollen in #2451). | BESTÄTIGT | Frontmatter-Vergleich, `git merge-tree` |
| K5 | #2416/#2440 verschieben `npm install`/`npm ci` von `permissions.deny` (main) nach `permissions.ask` und ändern die CLAUDE.md-Regel „Kein `npm install` durch Agenten“. Das ist eine **Lockerung**. | BESTÄTIGT | `.claude/settings.json` main vs. #2440; Hook-Probe: `npm install left-pad` → Exit 0 |
| K6 | Der P0-Fix „Bash-Hook gegen 16 Umgehungen“ (`8a18cb9`) liegt nur in #2440, nicht in #2416. Wird #2416 allein gemergt, landet der Hook v2 mit bekannten Umgehungen auf `main`. | BESTÄTIGT | `git branch -r --contains 8a18cb9` → nur #2440 |
| K7 | CI überspringt Drafts (`.github/workflows/ci.yml:31,88,101`). #2416, #2440, #2450 sind Drafts: `unit`, `build`, `gates` übersprungen; auf dem Head von #2440 fehlt auch CodeQL. | BESTÄTIGT | GitHub-Check-Runs je Head |
| K8 | Rollenwiderspruch VIO: Zielbild sagt „Visuelle Qualitätsprüfung“, Repo (#2436/#2440, #2443 „VIO-01a“) definiert VIO als **Voice-Agent** (`apps/agent-runtime`). Visuelle Prüfung (Playwright/Screenshots) hat heute keine Rolle. | BESTÄTIGT | `vio.md` `description`; `roles.md` |
| K9 | Drei Statusskalen im Umlauf: `GEPLANT…LIVE·BLOCKIERT` (#2416), `implementiert/getestet/bereitgestellt/produktiv verifiziert` (#2451, Nutzerpräferenz), `BESTÄTIGT/TEILWEISE/OFFEN/BLOCKIERT` (dieser Auftrag), dazu `live/preview/coming-soon` (Produktstatus). | BESTÄTIGT | Dateien genannt |
| K10 | Zwei Wissensablagen: `docs/ai-os/` (technisch über `KNOWLEDGE_ROOT` im Gateway erzwungen) und `docs/agent-memory/` (#2416). | BESTÄTIGT | `packages/ai-os-core/src/gateway.ts` `KNOWLEDGE_ROOT` |

## 1. PR-Matrix

| PR | Inhalt | Head · Draft · hinter main | Konflikt gegen main | CI auf Head | Scope / Rechte | Entscheidung | Status |
|---|---|---|---|---|---|---|---|
| #2451 | 10 Agenten + Skill `realsync-agent-core` + `docs/ai-os/agenten-team.md` | `4c761d2` · geschlossen | — | letzte CI grün (laut Bericht, nicht geprüft) | lockert Rechte (K4) | geschlossen lassen; Inhalte gesichert in `sicherung-pr-2451.md` | BESTÄTIGT |
| #2436 | 9 Agentendateien + `roles.md` (10 Dateien, Markdown) | `6e94e35` · kein Draft · 2 | konfliktfrei | voll grün inkl. `unit`, `build`, `gates`, CodeQL, E2E | nur lesende Rollen + REA; Deploy-Wirkung: keine (nur `.claude/`, `docs/`) | zuerst abnehmen; **DEPUTY: NACHBESSERN** (§1a) | TEILWEISE |
| #2416 | Hook `guard-bash` v2, `settings.json`, `auto-merge.yml` stillgelegt, CLAUDE.md-CHIEF-Abschnitt, DEPUTY/NOVA 3b | `0985d33` · Draft · 2 | konfliktfrei allein; **add/add** nach #2436 | `unit/build/gates` übersprungen (Draft); CodeQL, E2E grün | Workflow-Änderung (Freigabe), Lockerung K5, Hook ohne P0-Fix K6 | nach #2436; vorher K5 rückgängig, Konflikte per Merge von `main` lösen | TEILWEISE |
| #2440 | #2416 + #2436 + #2434 + Phase 3d: `guard-write-scope`, `guard-network`, 194 Hook-Negativtests, `test:hooks`, Radar | `f32d8c5` · Draft · 2 | konfliktfrei allein | nur `Build SPA` + Pages; `unit`, `gates`, CodeQL fehlen | Lockerung K5 enthalten; sonst nur Verschärfungen | nach #2416; Ready-for-Review für volle CI | TEILWEISE |
| #2450 | zweites Agentenset inkl. `chief.md` + Claude-5.5-Preise in `shared/model-prices.ts` + Standardmodell AI-Gateway | `9ca598a` · Draft · 1 | konfliktfrei gegen main; 9× add/add gegen #2440 | `unit/build` übersprungen; CodeQL grün | lockert Rechte (K4); Gateway-Änderung hat Produktionswirkung (Edge Function) | Agententeil verwerfen; Modellpreise + Gateway als eigener PR | BESTÄTIGT |
| #2438 | `docs/agent-memory/organisation.md` (JARVIS-Ebene), K4a-Portfolio | `9d062ff` · kein Draft · 2 | konfliktfrei | nicht abgefragt | nur Doku; JARVIS als Ebene über CHIEF (GEPLANT) | nach #2440 prüfen, gegen Register abgleichen | OFFEN |
| #2423–#2432 | Einzel-PRs je Agent + `roles` | Draft · 3 | — | nicht abgefragt | vollständig in #2436 (teils ältere Fassung) | nach Merge #2436 als überholt schließen (Freigabe) | BESTÄTIGT |
| #2434, #2420 | REA-Radar | Draft/kein Draft · 2–3 | — | nicht abgefragt | vollständig in #2440 | nach Merge #2440 als überholt schließen (Freigabe) | BESTÄTIGT |

### 1a. Unabhängige Abnahme #2436 durch DEPUTY

Ausgeführt als Subagent mit `deputy.md` (Fassung #2436) als verbindlicher Anweisung, nur Read/Grep/Glob.
Die Datei `deputy.md` selbst hat CHIEF geprüft (keine Selbstabnahme): kein Befund.
**Urteil: NACHBESSERN.** Kriterien 2–6 erfüllt (nur REA schreibt, ATLAS nur Web, VIO/NOVA/DEPUTY
lesend, niemand delegiert, keine Lockerung gegenüber `main`, keine Secrets/Preise).

| Nr | Schwere | Befund | Korrektur | Status |
|---|---|---|---|---|
| F1 | hoch | `rea.md:3,82-100`, `atlas.md:3` verweisen auf `/rea-radar` und `docs/rea/*`; beides fehlt auf dem Head (kommt erst mit #2434/#2440) | Radar-Dateien mitliefern oder Verweise bis #2440 als GEPLANT kennzeichnen | BESTÄTIGT (CHIEF nachgeprüft) |
| F2 | mittel | `roles.md:62-72` ordnet Skills anders zu als `skills.ts` (`agent`-Feld); Brücke Rolle → `AgentId` fehlt | Register als einzige Quelle festhalten, je Rolle `AgentId` nennen (→ §5) | TEILWEISE |
| F3 | mittel | MIRA „GETESTET“ mit alter Werkzeugliste (WebSearch); ATLAS-Wiederholung A1 ohne Ergebnis | MIRA auf IMPLEMENTIERT; A1-Ergebnis nennen | OFFEN |
| F4 | mittel | Belege „GETESTET (Probe 3c)“ nur in Texten der Einzel-PRs | Probe-Tabellen in #2436 übernehmen oder Status senken | OFFEN |
| F5 | niedrig | veraltete Branch-Bezüge (`nova.md:41-43`, `roles.md:16-21,92`) | nach Merge aktualisieren | OFFEN |
| F6 | niedrig | `vio.md:24` nennt `guard-write-scope.mjs` (nur #2440) | „noch nicht auf `main`“ ergänzen | OFFEN |

Folgerung: #2436 allein hinterlässt auf `main` tote Verweise. Das stützt die Alternative in §6.

Nicht geprüft (kein Agentenbezug im Diff-Stat): übrige offene PRs (#2452, #2449, #2448, #2447,
#2446, #2445, #2443, #2441, #2437, #2435, #2433, #2422, #2419, …).

## 2. Agentenmatrix (Basis: Fassung #2436/#2440)

Erzwungen = durch `tools`/`disallowedTools`, Hooks oder Gateway technisch durchgesetzt. Regel = nur Text.

| Rolle | Zuständigkeit | Modell | Erlaubte Tools | Verbotene Tools | Lesen / Schreiben | Delegation | Technisch erzwungen |
|---|---|---|---|---|---|---|---|
| CHIEF | Orchestrierung, führt Befehle/MCP für lesende Rollen aus, eskaliert | Sitzungsmodell | alle | Deny-Liste `settings.json` | R/W | einzige delegierende Instanz | Tiefe 1 (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`), Bash-/Netz-Hooks, Deny-Liste; **keine Agentendatei** (Absicht) |
| DEPUTY | unabhängige Abnahme | opus | Read, Grep, Glob | Agent, Write, Edit, NotebookEdit, Bash, WebFetch, WebSearch | R | nein | ja (Tools) |
| NOVA | Security, Governance, Datenschutz | sonnet | Read, Grep, Glob | wie DEPUTY | R | nein | ja (Tools) |
| REA | Engineering, einziger Schreiber | Sitzungsmodell | Read, Grep, Glob, Edit, Write, Bash | Agent | R/W (eigener Branch) | nein | Tools ja; Pfadgrenzen nein (nur Hooks gegen Merge/Deploy/Voice) |
| ATLAS | Web-Recherche | sonnet | WebSearch, WebFetch | Agent, Read, Grep, Glob, Edit, Write, Bash, NotebookEdit | nur Web | nein | ja (Tools) + `guard-network` |
| VIO | Voice-Runtime (Repo) / Ziel: visuelle QA → **E1** | sonnet | Read, Grep, Glob | Agent, Edit, Write, Bash, NotebookEdit, Web | R | nein | ja (Tools); Schreibgrenze `apps/agent-runtime` vorbereitet |
| MOTION | Medienpläne, erzeugt nichts | sonnet, `permissionMode: plan` | Read, Grep, Glob | wie VIO | R | nein | ja (Tools) |
| MIRA | Marketing/SEO/Akquise (Ziel: Markt & Strategie) | sonnet | Read, Grep, Glob | wie VIO | R | nein | ja (Tools) |
| DATA | Finanzen/Pricing lesend (Ziel: Datenanalyse) | sonnet | Read, Grep, Glob | wie VIO | R | nein | ja (Tools) |
| FLOW | Workflows, Cron, Prozesse | sonnet | Read, Grep, Glob | wie VIO | R | nein | ja (Tools) |

| Rolle | Erforderliche MCP | Pflichtskills | Fachskills | Freigabegrenzen |
|---|---|---|---|---|
| CHIEF | GitHub (Sitzung); optional Supabase/Stripe/Cloudflare nur lesend und in #2440 gesperrt | `aios-agent-core` (neu, E2) | `aios-knowledge-update`, `aios-documentation-update` | alles aus `AGENTS.md` → Freigaben |
| DEPUTY | keine (Diff/Ausgaben kommen von CHIEF) | `aios-agent-core` | `aios-pr-review`, `aios-release-readiness` | Urteil ≠ Merge-Freigabe |
| NOVA | keine | `aios-agent-core` | `aios-security-audit`, `aios-compliance-verification` | keine Fixes |
| REA | keine (Git/CLI) | `aios-agent-core`, `rea` | `aios-ci-failure-analysis`, `aios-code-quality-audit`, `aios-dashboard-review` | Freigabematrix `rea.md`; kein Merge/Deploy/Migration |
| ATLAS | keine (WebSearch/WebFetch); Tavily nur über CHIEF | `aios-agent-core` | — | keine kostenpflichtigen Abfragen |
| VIO | keine; Twilio/Vapi/Retell/ElevenLabs gesperrt | `aios-agent-core` | — | keine echten Anrufe, keine Nummernkäufe |
| MOTION | keine; Higgsfield/Canva/ElevenLabs nur über CHIEF mit Einzelfreigabe | `aios-agent-core` | — | Kosten je Job freigeben |
| MIRA | keine; Metricool/GA/GSC nicht vorhanden | `aios-agent-core` | — | Claims nur aus `implementation-status.ts` |
| DATA | keine; Stripe nur über CHIEF, in #2440 gesperrt | `aios-agent-core` | `aios-business-report` | nie Preise ändern |
| FLOW | keine | `aios-agent-core` | — | Workflow-Änderung nur per REA + Freigabe |

Regel für alle: Kein Agent hat MCP-Werkzeuge in `tools`. Fehlt ein MCP-Server, startet der Agent
trotzdem; der Bedarf wird als Übergabe an CHIEF gemeldet (erfüllt „blockiert keinen Agentenstart“).

### 2a. Prüfung der Durchsetzbarkeit durch NOVA (Stand #2440 @ `f32d8c5`)

Ausgeführt als Subagent mit `nova.md` als verbindlicher Anweisung, nur Read/Grep/Glob.
**NOVA-Status: BLOCKIERT** (Lockerung N4, drei P1). CHIEF hat die Kernbefunde per Hook-Probe nachgeprüft.

| Grenze | Mechanismus | Durchsetzung |
|---|---|---|
| Nur REA schreibt | `tools`/`disallowedTools` der 9 Agenten | **teilweise**: gilt für die 9 Dateien; CHIEF, eingebaute `general-purpose`- und Plugin-Agenten schreiben weiter |
| ATLAS nur Web | `atlas.md:4-5` | erzwungen |
| VIO, NOVA, DEPUTY lesend | Frontmatter | erzwungen |
| Nur CHIEF delegiert | `disallowedTools: Agent` + `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` | teilweise (Wirkung der Variable unbelegt) |
| Kein Merge / Deploy | `permissions.deny` + `guard-bash` | **teilweise** (Umgehungen N1, N5) |
| Keine Migration | Regel `rea.md:41`; nur `supabase db push` gesperrt | Regel |
| Guard-Dateien geschützt | keiner | **nur Regel** (N3) |
| Serverseitiges AI-OS-Gateway | `gateway.ts:21-69` | erzwungen, gilt nur für `ai-os-control`, nicht für Claude-Code-Agenten |

| ID | P | Befund | Status |
|---|---|---|---|
| N1 | P1 | Merge-Sperre umgehbar: `gh api graphql … mergePullRequest`, `node <datei>`, MCP `mcp__github__merge_pull_request` nicht in `deny` | BESTÄTIGT (Probe: Exit 0; `deny`-Liste gelesen) |
| N2 | P1 | „Nur REA schreibt“ nicht erzwungen für eingebaute/Plugin-Agenten (`guard-write-scope.mjs:24` lässt alle außer `vio` durch) | BESTÄTIGT (Code) |
| N3 | P1 | `.claude/hooks/**` und `settings.json` für REA/CHIEF beschreibbar → Selbstabschaltung der Guards | BESTÄTIGT (Code) |
| N4 | P2 | Lockerung `deny` → `ask` für `npm install`/`npm ci` | BESTÄTIGT (= K5) |
| N5 | P2 | Deploy-Umgehung: `gh api …/dispatches`, `npm run-script release:merge` | BESTÄTIGT (Probe: Exit 0) |
| N6 | P2 | Hook-Absturz (Exit ≠ 2) blockiert nicht | OFFEN (Annahme, Hook-Doku prüfen) |
| N7 | P2 | „Hook-Tests nicht in CI“ | **widerlegt**: `vitest.config` `include: test/**/*.test.ts` → `test/security/claude-hooks.test.ts` läuft im `unit`-Job (bei Drafts übersprungen) |
| N8 | P3 | Wirkung von `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` unbelegt | OFFEN |
| N9 | P3 | 6 Alt-Spezifikationen `*-agent.md` ohne Frontmatter würden alle Werkzeuge erben, falls geladen | OFFEN |
| N10 | P3 | REA hat Web per `curl` (Probe `curl https://example.com` → Exit 0) | BESTÄTIGT |

Folgerung: Die Rollengrenzen der neun Fachagenten sind technisch erzwungen. Merge-, Deploy- und
Selbstschutz-Grenzen sind es nur teilweise. Maßgeblich bleibt deshalb serverseitig: Ruleset auf
`main` (Pflicht-Review, kein Bypass) und Environment `production` (#2336/#2452) — nicht prüfbar aus
dieser Sitzung → OFFEN.

## 3. MCP-Matrix (Sitzung 25.11.2026)

| Dienst | Status | Prüfung | Befundstatus |
|---|---|---|---|
| GitHub (Sitzungs-MCP `mcp__github__*`) | verbunden und funktionsfähig | in dieser Prüfung genutzt (PR-Liste, Check-Runs) | BESTÄTIGT |
| GitHub (Plugin `plugin:github:github`) | vorhanden, nicht funktionsfähig | Verbindungsfehler „Authorization header badly formatted“ | BESTÄTIGT |
| Supabase (`mcp__Supabase__*`) | verbunden (gelistet), nicht funktionsgetestet; bietet Schreibwerkzeuge | in #2440 per `deny` gesperrt | TEILWEISE |
| Stripe, ElevenLabs | verbunden (gelistet) | in #2440 gesperrt (`deny`, `guard-network`) | TEILWEISE |
| Cloudflare | `Cloudflare_Developer_Platform` gelistet (vom Anbieter als veraltet markiert); Plugin braucht Anmeldung | nicht getestet | TEILWEISE |
| Google Drive/Docs/Sheets/Gmail/Calendar, Canva, Figma, Higgsfield, HubSpot, Tavily, Linear, Notion, Slack | verbunden (gelistet), nicht funktionsgetestet | nur Kontoinhaber-Sitzung | TEILWEISE |
| Playwright | vorhanden als Bibliothek (kein MCP) | laut Umgebung vorinstalliert, nicht ausgeführt | TEILWEISE |
| Browser Use (Plugin) | verbunden | nicht getestet | TEILWEISE |
| Chrome DevTools MCP | nicht vorhanden | nicht in der Werkzeugliste | BESTÄTIGT |
| Context7 | nicht vorhanden | nicht in der Werkzeugliste | BESTÄTIGT |
| Sentry | als SDK im Code (`src/main.tsx`), DSN-Aktivierung unbelegt; **kein MCP** | `docs/audit/02_CLAIMS_REALITY_MATRIX.md:156` | BESTÄTIGT |
| Metricool | nicht vorhanden | nicht in der Werkzeugliste | BESTÄTIGT |
| Vapi, Retell | nicht vorhanden; zusätzlich per `guard-network` gesperrt | Hook-Probe WebFetch `api.vapi.ai` → Exit 2 | BESTÄTIGT |
| Twilio | nur Doku-Plugin (Suche); CLI gesperrt | — | BESTÄTIGT |
| Memory-System (RealSync) | nicht vorhanden; Ersatz `docs/ai-os/` per PR | — | BESTÄTIGT |
| Task Management (RealSync) | nicht vorhanden; Ersatz GitHub Issues/PRs (Linear gelistet, ungenutzt) | — | BESTÄTIGT |
| Evidence Vault (`apps/mcp-server`, nur lesend) | implementiert, nicht deployt: `mcp-api-key-manager` scheitert am Edge-Function-Kontingent | `docs/MCP_GOVERNANCE_SERVER.md:38` | BESTÄTIGT |
| Agentenregister (`packages/ai-os-core`) | implementiert (Code-Register, kein MCP), ohne die zehn Rollen | K1 | BESTÄTIGT |
| `.mcp.json` | leer (Regel) | Datei gelesen | BESTÄTIGT |

## 4. Skill-Matrix

| Skill | Ort | Register-Agent (`skills.ts`) | Rolle (#2440) | Status |
|---|---|---|---|---|
| `aios-pr-review` | `.claude/skills/` | development | DEPUTY | vorhanden |
| `aios-release-readiness` | ″ | infrastructure | DEPUTY | vorhanden |
| `aios-security-audit` | ″ | infrastructure | NOVA | vorhanden |
| `aios-compliance-verification` | ″ | compliance | NOVA | vorhanden |
| `aios-ci-failure-analysis`, `aios-code-quality-audit`, `aios-dashboard-review` | ″ | development | REA | vorhanden |
| `aios-business-report` | ″ | business-ops | DATA | vorhanden |
| `aios-knowledge-update`, `aios-documentation-update` | ″ | knowledge | CHIEF | vorhanden |
| `rea` (Befehl `/rea`, Agent `rea`) | `.claude/agents`, `.claude/commands` | — | REA | vorhanden |
| `/rea-radar` | `.claude/commands/rea-radar.md` | — | CHIEF → ATLAS → REA | in #2440 |
| `aios-agent-core` (20 Regeln dedupliziert → 8 neu + Verweise) | neu | alle | alle | GEPLANT (E2) |

Lücke: `SkillDefinition.agent` erlaubt genau eine Betriebsrolle; ein Kernskill für alle braucht ein
Feld `agents: 'all'` oder Rollenliste.

## 5. Konsolidierungsplan — ein Register für zehn Rollen

Grundsatz: `packages/ai-os-core` bleibt das einzige Register. Die fünf Betriebsrollen bleiben
(Command Center, Routinen, Gateway und Tests hängen daran). Die zehn Rollen kommen als
**Ausführungsrollen** in dieselbe Datei und werden auf Betriebsrollen abgebildet.

1. `types.ts`: `ExecutionRoleId` (10 Werte) und `ExecutionRole` mit `claudeAgentFile`, `model`,
   `tools`, `disallowedTools`, `permissionMode`, `writeScope`, `canDelegate`, `opsRoles`
   (→ `AgentId`), `skills`, `mcp` (je Server: `required|optional` + Status aus §3), `approvalLimits`,
   `enforcement` (`tools|hook|gateway|rule`).
2. `agents.ts`: `EXECUTION_ROLES` neben `AGENTS`. Abbildung: REA, DEPUTY → `development`;
   NOVA → `compliance`, `infrastructure`; DATA → `business-ops`; FLOW → `infrastructure` (lesend);
   CHIEF → alle lesend + `knowledge`; ATLAS, VIO, MOTION, MIRA → keine Gateway-Aktionen.
3. Drift-Test (technische Durchsetzung): ein Unit-Test liest das Frontmatter aller
   `.claude/agents/*.md` und vergleicht es mit `EXECUTION_ROLES`. Invarianten im Test:
   nur `rea` hat `Edit|Write|Bash`; `atlas` hat nur `WebSearch|WebFetch`; niemand außer CHIEF
   hat `Agent`; kein `mcp__*` in `tools`; `settings.json` enthält die Deny-Einträge von `main`
   (verhindert künftige Lockerungen wie K5).
4. Gateway: `GatewayRequest` optional um `executionRoleId` erweitern; Erlaubnis = Schnittmenge der
   `allowedActions` ihrer `opsRoles`, für alle außer REA/CHIEF ohne `write`.
5. Kernskill `aios-agent-core` anlegen und in `skills.ts` registrieren (`sicherung-pr-2451.md` §3).
6. `roles.md` wird danach aus dem Register erzeugt oder verweist nur noch darauf.

Umsetzung: REA, eigener Branch, **erst nach Merge von #2440** (sonst Parallelarbeit an denselben
Dateien). Abnahme DEPUTY, Rechteprüfung NOVA.

## 6. Empfohlene Merge-Reihenfolge (jede Stufe mit Einzel-Freigabe)

1. **#2436** — volle CI grün, konfliktfrei. Vorher Branch per Merge von `main` aktualisieren (2 Commits).
2. **#2416** — vorher: (a) Merge von `main`, add/add zugunsten #2436 lösen; (b) `npm install`/`npm ci`
   zurück nach `deny`, CLAUDE.md-Zeile wiederherstellen (K5); (c) P0-Fix `8a18cb9` aus #2440
   übernehmen oder #2416 direkt mit #2440 zusammen mergen (K6); (d) Ready for Review → volle CI.
   Workflow-Änderung `auto-merge.yml` ist freigabepflichtig.
3. **#2440** — vorher N1, N3, N5 durch REA schließen (GraphQL-Merge, `node <datei>`, Dispatch-API,
   `npm run-script` im Hook sperren; `mcp__github__merge_pull_request` in `deny`; Edit/Write auf
   `.claude/**` für Subagenten sperren), N4 = K5 rückgängig; dann Merge von `main`, Ready for Review,
   volle CI inkl. `test/security/claude-hooks.test.ts`, Neuprüfung NOVA + DEPUTY.
4. #2423–#2432, #2434, #2420, #2425 als überholt schließen (Freigabe „PR schließen“).
5. Register-PR nach §5 (neu, REA).
6. #2450 aufteilen: Agententeil verwerfen; Modellpreise + Gateway-Standardmodell als eigener PR
   (Preise gegen Anbieterseite belegen; Edge-Function-Deploy = Produktionswirkung, Freigabe).
7. #2438 gegen das Register prüfen (JARVIS-Ebene ohne zweite Agentenstruktur).

Alternative zu 1–3: nur #2440 mergen (enthält alles, konfliktfrei) und #2436/#2416 als überholt
schließen. Weniger Konfliktarbeit, aber ein großer Review (30 Dateien, +2147) und Abweichung von der
Inhaberentscheidung.

## 7. Offene Entscheidungen der Unternehmensleitung

| ID | Frage | Empfehlung |
|---|---|---|
| E1 | VIO = Voice (Repo-Stand) oder visuelle Qualitätsprüfung (Zielbild)? | VIO bleibt Voice (Produktfokus AI Receptionist, #2443); visuelle QA als Prüfpunkt von DEPUTY mit Playwright-Ausgaben durch CHIEF |
| E2 | Kernskill-Name und Ort | `aios-agent-core` im bestehenden Muster |
| E3 | Eine Wissensablage | `docs/ai-os/` (technisch erzwungen); `docs/agent-memory/` nach `docs/ai-os/agenten/` |
| E4 | Eine Statusskala für Agentenberichte | Produkt: `live/preview/coming-soon`; Arbeit: `implementiert/getestet/bereitgestellt/produktiv verifiziert`; Befunde: `BESTÄTIGT/TEILWEISE/OFFEN/BLOCKIERT` |
| E5 | `npm install` für Agenten: `deny` (main) oder `ask` (#2416)? | `deny` behalten |

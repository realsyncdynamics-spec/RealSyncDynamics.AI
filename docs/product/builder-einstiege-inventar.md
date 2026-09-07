# Veraltungs-Inventar der Builder-Einstiege

**Gemessen am 2026-09-07** gegen `origin/main` @ `9587905` (der Arbeitsbaum ist
dort code-identisch; nur `CLAUDE.md` weicht ab). Produktionsstand der Edge
Functions per Management-API gegen `ebljyceifhnlzhjfyxup`.

**Reines Lesen.** Nichts gelöscht, nichts geändert, kein Aufräum-PR.
Löschvorschläge erst nach Freigabe des Eigentümers.

> **Herkunft dieses Dokuments**: Erstellt am 2026-09-07 auf eine kurze
> Zustimmung, die der Eigentümer nachträglich ausdrücklich als **nicht
> autorisiert** festgestellt hat. Der **Inhalt** ist mit der Owner-Freigabe vom
> selben Tag zur Weiterverwendung freigegeben; die **Herkunft** bleibt als
> unautorisiert vermerkt.

**Methode**: Ein Grep-Treffer ist **kein** Beleg. Für jeden Eintrag wird die
Routing-Frage gestellt — dieselbe Lehre wie bei den vier statt fünf Consumern
des Einstiegs am selben Tag. Maßgeblich ist der Importgraph ab `src/main.tsx`,
so wie ihn `test/routing/pages-reachable.test.ts` verfolgt, nicht das Vorkommen
eines Namens in `App.tsx`.

---

## 1. Übersicht

| # | Gegenstand | Geroutet | Lebender Aufrufer | Gebaut & ausgeliefert | Tests | Status |
|---|---|---|---|---|---|---|
| 1 | `platform/nextjs_frontend/app/builder/page.tsx` | — (eigene App) | nein | nur `docker compose`, lokal | keine | **VERALTET** + Befund §3 |
| 2 | `src/unified-entry/pages/BuildStudioPage.tsx` | ja, `/build` | ja (2) | ja | ja (2) | **AKTIV** |
| 3 | `src/pages/WowWebsitePreview.tsx` | nein | nein | nein | nur Waisen-Test | **VERALTET** |
| 4 | `src/pages/WebsiteTransformationFlow.tsx` | mittelbar, `/handwerk-website` | ja (1, verdeckt) | ja | ja (2) | **AKTIV**, verdeckt |
| 5 | `supabase/functions/siteos/handlers/builder.ts` | Endpunkt `builder` | ja (2) | ja, `siteos` v12 | ja | **AKTIV** |
| 6 | `supabase/functions/siteos/index.ts` | Router, 11 Endpunkte | ja | ja, v12 seit 2026-09-06 13:42 UTC | ja | **AKTIV** |
| 7 | `supabase/functions/siteos/handlers/anonymous.ts` | 4 Endpunkte | ja (`/build`) | ja (im Deploy enthalten) | ja | **AKTIV**, Kommentar veraltet §4.1 |
| 8 | Route `/builder` → `/build` | ja | ja | ja | — | **AKTIV**, Namenskollision §4.2 |
| 9 | Builder-/Preview-Routen in `src/App.tsx` | siehe §2 | teils | ja | teils | gemischt |
| 10 | `docs/product/ap11-aufraeumen.md` | — | referenziert (2) | — | — | **AKTIV** |
| 11 | `docs/runbooks/frontend-backend-gap.md` | — | referenziert (1, CI) | — | — | **AKTIV** als Runbook, Zahlen veraltet §4.3 |
| 12 | `docs/SITEOS_ARCHITECTURE.md` | — | referenziert (5) | — | — | **AKTIV** |

---

## 2. Einzelbefunde

### 1 · `platform/nextjs_frontend/app/builder/page.tsx` — VERALTET, und ein Befund

| Frage | Antwort | Beleg |
|---|---|---|
| Geroutet? | Nicht in der SPA. Eigene Next.js-App mit eigenem Router | eigene `package.json`, `app/`-Verzeichnis |
| Lebender Aufrufer? | **Nein.** Die SPA spricht diesen Stack nirgends an | `grep "builder.localhost\|/api/v1/builder\|8001\|8002" src/` → **0 Treffer** |
| Gebaut & ausgeliefert? | **Nein**, außer lokal per `docker compose`. Traefik-Host ist `app.localhost` | `platform/docker-compose.yml:109-127` |
| In CI/Deploy? | **Nein** | `grep -rln nextjs_frontend .github/` → **kein Treffer**; ebenso `deploy/ infra/ docker/ scripts/` |
| Tests? | **Keine** | `grep -rln nextjs_frontend test/ tests/ e2e/` → keiner |
| Alter | **ein einziger Commit**, `02f2727`, 2026-08-17 | `git log -- platform/nextjs_frontend/` |

Inhaltlich: 129 Zeilen, vier fest codierte englische Sektionen
(„Make your digital operation trustworthy."), Palettenauswahl, Geräteumschalter,
und ein `fetch` auf `${BUILDER_URL}/api/v1/builder/create-spec` mit
`target_stack: 'nextjs_supabase'`, `models: ['claude-3-5-sonnet']`. Kein
Blueprint, kein Publish Gate, keine Compliance-Ableitung, kein Prüfpfad.

### 2 · `BuildStudioPage` — AKTIV

Route `/build` (`App.tsx:1168`), dazu drei Weiterleitungen: `/builder`,
`/unified-entry`, `/unified-entry/build`. Lebende Aufrufer:
`GovernanceChatSidebar.tsx:87,132` („Neue Website erstellen") und
`SiteOsClaimView.tsx:157,183`. Tests:
`test/siteos/claim-moves-not-rebuilds.test.ts`,
`test/siteos/preview-presentation.test.ts`.

### 3 · `WowWebsitePreview.tsx` — VERALTET

Nicht in `App.tsx`. Einziger Importeur ist
`src/unified-entry/pages/WowPreviewEntryPage.tsx` — **die selbst nicht
geroutet ist**. Beide stehen ausdrücklich in `KNOWN_UNREACHABLE` von
`test/routing/pages-reachable.test.ts` („Variante der Builder-Vorschau ohne
Route." / „Einstiegsvariante der Builder-Vorschau, ohne Route.").

Da sie im Importgraph ab `main.tsx` nicht vorkommen, landen sie **nicht im
Bündel** — sie kosten keine Auslieferung, nur Pflege. Das ist dieselbe Klasse
wie die 52 Dateien aus AP11 (`docs/product/ap11-aufraeumen.md`); dort ist
`WowPreviewEntryPage` bereits als bewusst stehengelassen vermerkt (Z. 82).

> Zusammenhang mit #1257: `WowPreviewEntryPage` ist der **einzige** Erzeuger
> von `?domain=`, `?variant=` und `?auditId=` für den Einstieg. Weil sie nicht
> geroutet ist, haben diese drei Parameter heute keinen lebenden Aufrufer.

### 4 · `WebsiteTransformationFlow.tsx` — AKTIV, aber verdeckt

Steht nicht in `App.tsx` und ist trotzdem erreichbar, über **zwei
Wiederausfuhren**:

```text
/handwerk-website  →  KmuWebsiteLanding  →  WebsiteBuilderLanding
                                            (= export { WebsiteTransformationFlow ... })
                                         →  WebsiteTransformationFlow
```

`App.tsx:151,628`; `src/pages/WebsiteBuilderLanding.tsx:1` ist eine
Ein-Zeilen-Wiederausfuhr. Der Test warnt genau davor, hier nach Namen zu
urteilen. Ruft `siteos/discover`, `siteos/runtime-scan`, `siteos/builder`.

**Einordnung**: kein Veraltungsfall, aber ein zweiter Builder-Einstieg neben
`/unified-entry/transformation` und `/build` — mit eigener Oberfläche auf
demselben Backend. Ob `/handwerk-website` als Branchen-Landingpage bestehen
bleiben soll, ist eine Produktfrage, keine Aufräumfrage.

### 5–7 · Die `siteos`-Function — AKTIV

`siteos` läuft in Produktion als **v12, ACTIVE, `verify_jwt: true`**, zuletzt
2026-09-06 13:42:58 UTC (Management-API, 188 Functions insgesamt). Der Router
registriert elf Endpunkte: `agents`, `builder`, `discover`, `runtime-scan`,
`publish-gate`, `publish-approve`, `build-anon`, `refine-anon`, `session`,
`claim` (`index.ts:47-60`).

`builder` wird aus der SPA über `siteOsApi.ts:181` gerufen — aus
`PreviewSelectionPage` (`/unified-entry/transformation`, `/app/siteos/builder`)
und aus `WebsiteTransformationFlow`.

### 8 · `/builder` → `/build`

`App.tsx:1164`, Bestand aus `main`. Nach dem Merge von #1254 steht daneben
`/builder/:slug` als Workspace. Beide Routen können koexistieren
(react-router wählt die spezifischere), aber der Pfadname trägt dann zwei
Bedeutungen: **ohne** Slug „geh zum anonymen Erstbau", **mit** Slug „öffne den
Workspace dieses Projekts". Siehe §4.2.

### 9 · Builder- und Preview-Routen in `src/App.tsx`

| Route | Ziel | Status |
|---|---|---|
| `/build` | `BuildStudioPage` | AKTIV |
| `/builder` | → `/build` | AKTIV (Weiterleitung) |
| `/unified-entry`, `/unified-entry/build` | → `/build` | AKTIV (Weiterleitungen) |
| `/unified-entry/transformation` | `PreviewSelectionPage` | AKTIV — Gegenstand von #1257 |
| `/app/siteos/builder` | **dieselbe** `PreviewSelectionPage` | AKTIV |
| `/unified-entry/preview` | `DashboardPreviewPage` in `UnifiedEntryShell` | AKTIV — **verlinkt den Einstieg nie** |
| `/preview` | `PublicWorkspacePreview` | AKTIV, aber **kein** Builder: statische Kachelschau des Workspace, 0 `siteos`-Aufrufe |
| `/unified-entry/scan`, `/entscheidung`, `/trial-offer`, `/register`, `/onboarding`, `/success` | Flow-Schritte | AKTIV |
| `/scan` | → `/audit` | AKTIV (Weiterleitung, §10-Freigabe 2026-08-23) |

### 10–12 · Die drei Dokumente

- **`ap11-aufraeumen.md`** (106 Z., zuletzt 2026-09-05, #1205): beschreibt den
  durchgeführten Aufräumstand; referenziert aus `CLAUDE.md` und
  `implementierungsplan-paketmodell.md`. **AKTIV**, Inhalt deckt sich mit dem
  hier Gemessenen (die Waisen stehen dort namentlich).
- **`frontend-backend-gap.md`** (330 Z., zuletzt 2026-08-19): **AKTIV als
  Runbook**, referenziert aus `.github/workflows/k1-slots-freigeben.yml`. Die
  Zahlen darin sind überholt — siehe §4.3.
- **`SITEOS_ARCHITECTURE.md`** (544 Z., zuletzt 2026-09-04): **AKTIV**,
  meistreferenziertes der drei (5 Stellen, darunter `CLAUDE.md` und die
  Zielarchitektur).

---

## 3. Befund: `platform/` ist ein zweiter Stack

**Ja — und zwar dreifach.** Gemessen, nicht geschlossen:

| Achse | Hauptprodukt | `platform/` |
|---|---|---|
| **Frontend** | Vite 6 + React 19 SPA, `dist/` → Cloudflare Pages | **Next.js 15.1.3** + React 19, eigene `package.json`, eigenes `tsconfig.json`, eigenes `Dockerfile`, `next build` |
| **Backend** | Supabase Edge Functions (Deno) | **Python/FastAPI**: `builder_orchestrator` (8001), `governance_backend` (8002) |
| **Deployment** | GitHub Actions → `wrangler pages deploy` | **Traefik + docker compose**, Hosts `app.localhost`, `builder.localhost`, `rsd.localhost` |

Das steht gegen die Vorgabe des Eigentümers vom 2026-09-07: *„Ausdrücklich
NICHT gewollt: … zweiter Backend-Stack, zweiter Auth-Stack, zweiter
Deployment-Stack."* — und `platform/nextjs_frontend` ist zusätzlich ein
zweiter **Frontend**-Stack, der in dieser Aufzählung nicht einmal vorkam.

**Was den Befund mildert**: Der Stack ist eingezäunt. `CLAUDE.md` §7 sagt
ausdrücklich, dass `platform/` „weder von der Root-package.json noch vom
Root-npm noch in den Root-CI/CD-Workflows verwaltet" wird; das ist gemessen
richtig. Er läuft nirgends in Produktion, er wird von keiner CI gebaut, und
die SPA ruft ihn nie. Er ist damit kein aktiver Doppelbau, sondern ein
**ruhender**.

**Was den Befund nicht mildert**: Ein zweiter Builder mit eigenem
Datenmodell, ohne Blueprint, ohne Publish Gate, ohne Compliance-Ableitung und
ohne Prüfpfad ist genau die Architektur, die der Masterauftrag ausschließt —
unabhängig davon, ob er gerade läuft. Solange er im Repository steht,
beschreiben `README.md`, `MONOREPO.md`, `CLAUDE.md` §7 und
`docs/ARCHITECTURE_CURRENT.md` ihn als Teil des Produkts („Builder-Cockpit +
Governance-UI"). Wer danach baut, baut am zweiten Stack weiter.

**Gemeldet, nicht aufgeräumt.** Der Eigentümer entscheidet, ob
`platform/nextjs_frontend` (a) bleibt und in der Doku ausdrücklich als
Nebenprojekt außerhalb der Zielarchitektur gekennzeichnet wird, (b) auf die
beiden Python-Dienste reduziert wird, oder (c) ganz entfällt. Kein Vorschlag
wird ohne diese Entscheidung umgesetzt.

---

## 4. Drei Nebenbefunde aus derselben Messung

### 4.1 Ein Kommentar behauptet, was nicht mehr stimmt

`src/features/siteos/buildSession.ts:22` sagt: *„Die Endpunkte des anonymen
Pfads sind noch nicht ausgerollt."* Gemessen sind `build-anon`, `refine-anon`,
`session` und `claim` seit `86640cf` (2026-08-23) im Router registriert und
mit `siteos` v12 am 2026-09-06 deployt.

**Kein Verhalten ist falsch**: `startBuild()` probiert den Server und fällt
nur bei `result.kind === 'not_deployed'` in den lokalen Modus. Der Rückfall
heilt sich also selbst. Falsch ist nur die Prosa — und mit ihr die Erwartung
der nächsten Sitzung. Der Kommentar sagt außerdem, der Rückfall „gehört dann
entfernt", was jetzt zu prüfen wäre.

**Nicht gemessen** ist, ob der Serverpfad in Produktion tatsächlich
durchläuft; das hieße, die Function aufzurufen. **UNKNOWN.**

Betroffen ist mittelbar die §10-Freigabe vom 2026-08-31 (Abzeichen „Nur
lokal — nicht übernehmbar", gesperrter Übernehmen-Knopf): Sie war
ausdrücklich als Übergang gedacht. Ob der Übergang vorbei ist, entscheidet
der Eigentümer — hier nur gemeldet.

### 4.2 `/builder` trägt nach #1254 zwei Bedeutungen

`/builder` (ohne Slug) leitet nach `/build`, dem **anonymen Erstbau**;
`/builder/:slug` ist der **Workspace eines bestehenden Projekts**. Das ist
technisch widerspruchsfrei, aber ein Kunde, der `/builder` von Hand eintippt,
landet im Neubau statt in seiner Projektliste. Kein Fehler, eine
Benennungsfrage — festgehalten, weil sie nach dem Merge sichtbar wird.

### 4.3 Das Gap-Runbook nennt Zahlen von vor drei Wochen

`frontend-backend-gap.md` führt „180 im Repository, 100 deployt, 80 nicht
deployt, davon 32 vom Frontend aufgerufen" (Erhebung 2026-08-17). Gemessen am
2026-09-07 sind **188** Functions in Produktion. Das Dokument sagt das selbst
(„Diese Datei ist ein Runbook, kein Statusbericht. Die Zahlen unten veralten —
die Anleitung nicht."), also ist es kein Fehler, sondern ein Hinweis: Wer die
Zahl übernimmt statt neu zu messen, liegt um Wochen daneben.

---

## 5. Was dieses Inventar **nicht** belegt

- Ob eine der als VERALTET geführten Dateien gelöscht werden **soll** — das
  ist eine Entscheidung, kein Messergebnis.
- Ob `platform/` irgendwo außerhalb dieses Repositories betrieben wird
  (VPS, anderer Host). Von hier nicht messbar: **UNKNOWN**.
- Ob der anonyme Serverpfad in Produktion antwortet (§4.1): **UNKNOWN**.
- Ob Links auf `/unified-entry/transformation` außerhalb des Repositories
  existieren (E-Mail-Vorlagen, Anzeigen): **UNKNOWN** — dieselbe offene Frage
  wie in der Bedingungs-Matrix zu #1257.

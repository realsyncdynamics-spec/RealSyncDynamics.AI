# Wer liefert realsyncdynamicsai.de aus? — Messung statt Vermutung

**Gemessen am 2026-09-06**, `main` @ `dce3278`. Anlass: Ein Screenshot der
GitHub-Deployments-Ansicht zeigte zwei rote Einträge — `Preview –
real-sync-dynamics-ai` und `Production – real-sync-dynamics-ai` — und damit den
Verdacht, die Website laufe auf einem älteren Stand als `main`
(„Deployment-Drift"). Der Verdacht ist widerlegt. Der Weg dorthin ist hier
festgehalten, weil er sich wiederholen wird.

---

## 1. Ergebnis vorweg

| Frage | Antwort | Methode |
|---|---|---|
| Wer liefert aus? | **Cloudflare Pages** | `server: cloudflare`, Cloudflare-IPs |
| Welcher Commit ist live? | **`dce3278` = `main` HEAD** | Check-Run + Asset-Fingerabdruck, §3 |
| Ist Vercel noch Deployment-Layer? | **Nein**, seit 2026-07-28 tot | GitHub-Deployments-API, §2 |
| Warum ist „Production" rot? | Karteileiche von Vercel, sechs Wochen alt | §2 |
| Parallele Pipelines? | **Nein** — alle anderen sind `workflow_dispatch` | §4 |
| Deployt GitHub Actions? | **Nein** — Job wird übersprungen | §4 |

**Es gibt keinen Deployment-Drift.** Abweichungen zwischen Website und
Erwartung sind daher im Code zu suchen, nicht in der Auslieferung.

---

## 2. Die roten Deployments sind Vercel-Karteileichen

Das Repository ist öffentlich, die Deployments-API also ohne Token lesbar:

```bash
curl -s "https://api.github.com/repos/realsyncdynamics-spec/RealSyncDynamics.AI/deployments?per_page=100"
```

Alle vier Environments stammen von `vercel[bot]`:

| Environment | Einträge | Zeitraum |
|---|---|---|
| `Preview – real-sync-dynamics-ai` | 372 | 2026-06-30 → **2026-07-28** |
| `Production – real-sync-dynamics-ai` | 93 | 2026-06-30 → **2026-07-23** |
| `accurate-possibility / production` | 18 | 2026-06-30 → 2026-07-02 |
| `romantic-fulfillment / production` | 17 | 2026-07-01 → 2026-07-02 |

Der Status des jüngsten Eintrags lautet `failure` mit dem Hinweis
„run this Vercel CLI command". Das **letzte Production-Deployment liegt auf dem
2026-07-23** — sechs Wochen vor dieser Messung.

Entscheidend ist, was **fehlt**: Es gibt keinen einzigen neueren Eintrag. Die
Cloudflare-Git-Integration schreibt keine GitHub-Deployments, sondern
**Check-Runs** (§3). Die Deployments-Ansicht wird deshalb nie aktualisiert und
bleibt dauerhaft auf dem letzten Vercel-Stand stehen — rot, weil Vercel zuletzt
scheiterte, und für immer rot, weil niemand mehr hineinschreibt.

`deploy/cloudflare-pages/README.md` sagt es in Zeile 3 ausdrücklich:
**„Ersetzt Vercel."** Das Vercel-Konto führt heute null Projekte.

> **Die Lehre**: Eine rote Deployment-Ansicht belegt nicht, dass die
> Auslieferung kaputt ist. Sie belegt, was das **zuletzt schreibende** System
> gemeldet hat. Wer das schreibende System abgelöst hat, ohne die Environments
> zu entfernen, hinterlässt eine Warnleuchte, die nichts mehr misst. Vor jeder
> Deutung: Datum des letzten Eintrags prüfen.

---

## 3. Der Deploy-Beleg steht in den **Checks**, nicht in den Deployments

Der schnellste und direkteste Nachweis. Auf `main` @ `dce3278` stehen zwei
Check-Runs mit beinahe demselben Namen — und sie sagen Gegenteiliges:

| Check-Run | App | Ergebnis | Abgeschlossen |
|---|---|---|---|
| `Deploy to Cloudflare Pages` | GitHub Actions | **skipped** | 13:40:19 UTC |
| `Cloudflare Pages` | **Cloudflare Workers and Pages** | **success** | **13:39:59 UTC** |

Der zweite ist der echte Deploy: Er stammt von der Cloudflare-GitHub-App, nicht
von Actions, und sein `details_url` zeigt ins Pages-Dashboard des Projekts
`realsyncdynamics-ai`. Der Merge lag um 13:37 UTC — **die Auslieferung erfolgte
zwei Minuten später.**

```bash
curl -s "https://api.github.com/repos/realsyncdynamics-spec/RealSyncDynamics.AI/commits/<sha>/check-runs?per_page=100" \
  | python3 -c "import json,sys; [print(c.get('conclusion'), '|', (c.get('app') or {}).get('name'), '|', c['name']) for c in json.load(sys.stdin)['check_runs']]"
```

**Das ist die Auflösung des ganzen Falls.** Die Cloudflare-Git-Integration
meldet sich als *Check-Run*, nicht als *Deployment*. Deshalb bleibt die
Deployments-Ansicht auf dem letzten Vercel-Stand stehen, obwohl seither
hunderte Male ausgeliefert wurde — die beiden Systeme schreiben in
verschiedene Register.

> **Die Verwechslungsgefahr ist eingebaut**: Auf demselben Commit steht
> „Deploy to Cloudflare Pages" (übersprungen) direkt neben „Cloudflare Pages"
> (erfolgreich). Wer den ersten liest, hält den Deploy für ausgefallen; wer den
> zweiten liest, sieht ihn. Der Name allein trägt hier nicht — die **App**
> entscheidet.

---

## 4. Gegenprobe über den Asset-Fingerabdruck

Der Check-Run aus §3 sagt, dass Cloudflare deployt hat — er sagt nicht, **was**
am Ende ausgeliefert wird. Ein Cache, eine Regel oder eine fremde Custom Domain
könnte dazwischenstehen. Diese Gegenprobe misst deshalb das tatsächlich
Ausgelieferte, und sie braucht keinen Cloudflare-Token: Die Content-Hashes von
Vite hängen am Bundle-Inhalt, also am Quellstand.

```bash
curl -s https://realsyncdynamicsai.de | grep -oE '(src|href)="/assets/[^"]+"'
npx vite build && ls dist/assets/ | grep -E '^(index-|vendor-)'
```

| Asset | Live | Lokal aus `dce3278` |
|---|---|---|
| `index-6HQzBrmI.js` | ✓ | ✓ |
| `index-BIIF-fRM.css` | ✓ | ✓ |
| `vendor-recharts-DmdzjC1a.js` | ✓ | ✓ |
| `vendor-supabase-MXLzAwek.js` | ✓ | ✓ |

Vier unabhängige Übereinstimmungen, darunter App-Code **und** CSS.

**Warum das den Stand festnagelt**: Der letzte Commit, der `src/` berührt, ist
`870ab68` — er kam mit dem Merge von PR #1135 am 2026-09-06 um 13:37 UTC nach
`main`. Der ausgelieferte Build trägt diesen Stand, kann also **nicht älter als
dieser Merge** sein — deckungsgleich mit dem Check-Run aus §3, der den Deploy
auf 13:39:59 UTC datiert.

Der Vergleich ist auch ohne die `VITE_*`-Secrets gültig — sie fließen nicht in
diese Chunk-Hashes ein. Genau deshalb taugen sie als Commit-Fingerabdruck.

---

## 5. Der Deploy-Pfad — und zwei Befunde

Der einzige automatische Frontend-Deploy ist die **Cloudflare-Git-Integration**
(im Dashboard konfiguriert, `npm run build`). Alle konkurrierenden Workflows
(`deploy-frontend-production`, `deploy-frontend-vps*`, `docker-deploy`,
`cloudflare-domain-cutover`) laufen ausschließlich auf `workflow_dispatch`.

### Befund 1 — ein grüner Deploy-Workflow, der nicht deployt

`.github/workflows/deploy-cloudflare-pages.yml` meldet für `main` @ `dce3278`
`conclusion: success`. Die Jobs dieses Laufs (34036663058):

| Job | Ergebnis |
|---|---|
| Build SPA | success |
| **Deploy to Cloudflare Pages** | **skipped** |
| **Smoke test live routes** | **skipped** |

Beide hängen an `if: needs.build.outputs.cf_ready == 'true'`, und `cf_ready` ist
`false`, weil `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` nicht gesetzt
sind. Das ist so **gewollt** — der Workflow tritt bewusst hinter die
Git-Integration zurück (siehe `wrangler.toml` und
`docs/runbooks/cloudflare-actions-deploy-cutover.md`).

Die Zusage stimmt trotzdem nicht: Ein Lauf namens „Deploy to Cloudflare Pages"
mit grünem Haken sagt dem Leser, es sei deployt worden. Gebaut wurde nur.
Dieselbe Klasse wie die Befunde in CLAUDE.md §5 — grün heißt nicht, was es zu
heißen scheint.

### Befund 2 — der Smoke-Test kann per Konstruktion nicht fehlschlagen

Der übersprungene Smoke-Test prüft `/ /pricing /audit /governance-runtime /app`
auf HTTP 200. `public/_redirects` endet aber auf `/*  /index.html  200` —
gegengeprüft:

```
/gibt-es-garantiert-nicht-xyz123   →   HTTP 200
```

Jede beliebige URL antwortet mit 200. Der Test würde also auch dann grün
melden, wenn sämtliche Routen fehlten. Er müsste am Inhalt prüfen (etwa am
`<title>` oder an einem routen-eigenen Marker), nicht am Statuscode.

Nebenwirkung außerhalb von CI: Eine unbekannte URL liefert 200 mit der
Startseite — ein Soft-404, den Suchmaschinen indexieren können.

Beide Befunde sind hier **gemeldet, nicht behoben** (CLAUDE.md §14). Sie
berühren die Auslieferung nicht.

---

## 6. Vorgehen bei der nächsten Deployment-Frage

1. **Wer liefert aus?** `curl -sI https://realsyncdynamicsai.de | grep server`
2. **Wie alt ist die rote Anzeige?** Datum des letzten Eintrags je Environment
   über die Deployments-API — vor jeder Deutung.
3. **Hat Cloudflare deployt?** Check-Runs des Commits — der Eintrag der App
   „Cloudflare Workers and Pages", **nicht** der gleichnamige Actions-Job.
4. **Welcher Commit ist live?** Wenn der Check-Run nicht reicht: Asset-Hashes
   gegen `npx vite build` aus dem fraglichen Commit.
5. **Hat der Actions-Workflow deployt?** Nicht den Lauf ansehen, sondern die
   **Jobs**. `skipped` bei grünem Lauf ist der Normalfall dieses Repos.
6. **Erst danach** Routing, Plan-Taxonomie, Onboarding, Billing.

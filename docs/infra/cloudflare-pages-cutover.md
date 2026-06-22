# Cloudflare-Pages-Cutover & 404-Analyse — realsyncdynamicsai.de

Stand: 2026-06-22 · Branch: `claude/cloudflare-deploy`

## 1. Symptom

`https://realsyncdynamicsai.de/` liefert **HTTP 404** (Apex), Deep-Links
ebenfalls. Vorher (2026-06-05, dokumentiert in `deploy-pages.yml`) lieferte die
Domain `HTTP 200`, `server: GitHub.com` über GitHub Pages.

## 2. Root-Cause-Analyse (verifiziert per Live-Checks)

| Check | Ergebnis | Bedeutung |
| --- | --- | --- |
| `curl -I https://realsyncdynamicsai.de/` | `HTTP 404/500`, `server: cloudflare`, `cf-ray`, `cache-control: no-store` | DNS zeigt **nicht mehr** auf GitHub Pages, sondern proxied auf Cloudflare (104.21.x / 172.67.x). |
| `curl https://realsyncdynamics-ai.pages.dev/` | `HTTP 200` | Das Cloudflare-Pages-Projekt **existiert** und liefert die Root aus. |
| `curl https://realsyncdynamics-ai.pages.dev/landing` | `HTTP 404` | Der **SPA-Fallback (`_redirects`) ist im Production-Deployment nicht aktiv** — Deep-Links brechen. |
| `curl https://<branch>.realsyncdynamics-ai.pages.dev/` | `HTTP 200` | Branch-Previews (Cloudflare Git-Integration) funktionieren. |
| Cloudflare Worker `realsyncdynamics` | `return new Response("Hello world")` | Platzhalter-Worker, **nicht** auf der Apex-Route → nicht die 404-Ursache. |
| `public/_redirects` auf `main` | `/* /index.html 200` ✓ vorhanden | SPA-Fallback ist im Repo korrekt; das Production-Deployment ist also veraltet/ohne `_redirects` gebaut. |

**Zwei Ursachen:**

1. **Apex nicht an Pages gebunden.** `realsyncdynamicsai.de` ist proxied über
   Cloudflare, aber die **Custom Domain ist nicht im Pages-Projekt
   `realsyncdynamics-ai` registriert** (und auf keiner Worker-Route). Cloudflare
   hat nichts auszuliefern → Edge-404/500.
2. **Stale Production-Deployment.** Das aktuelle Pages-Production-Deployment
   honoriert `_redirects` nicht (Deep-Links → 404), obwohl `main` die Datei
   enthält. Ein frischer Build aus `main` behebt das.

## 3. Was in diesem Branch vorbereitet ist

- `.github/workflows/deploy-cloudflare-pages.yml` — CI-Deploy der SPA nach
  Cloudflare Pages. **Secret-gated**: überspringt sich sauber (Warnung, kein
  roter Build), solange Secrets fehlen. Baut frisch inkl. `_redirects`/`_headers`/
  `404.html` und verifiziert deren Vorhandensein → behebt Ursache (2).
- `public/_redirects` (`/* /index.html 200`), `public/_headers`,
  `public/404.html` — bereits im Repo, im `dist/`-Build verifiziert vorhanden.
- `wrangler.toml` — vorhanden (Legacy-Pages-Format `[build.upload] dir = "dist"`).
  Funktioniert mit der bestehenden Git-Integration; bewusst nicht angefasst.

## 4. Benötigte Secrets (NICHT im Repo — bitte als GitHub Repo-Secrets setzen)

| Secret | Zweck | Hinweis |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Pages-Deploy via wrangler | Token-Scope: *Account → Cloudflare Pages → Edit* |
| `CLOUDFLARE_ACCOUNT_ID` | Ziel-Account | `deb7c1635d0ca94143256fc2feb98d4a` (aus Pages-Deploy-Log) |
| `VITE_SUPABASE_URL` *(optional)* | Build-Env | sonst Offline/Demo-Build |
| `VITE_SUPABASE_ANON_KEY` *(optional)* | Build-Env | public anon key |
| `VITE_SENTRY_DSN` *(optional)* | Monitoring | — |

## 5. Manuelle Schritte (Cloudflare-Dashboard — nicht per CI automatisierbar)

Behebt Ursache (1):

1. Cloudflare → Pages → Projekt **`realsyncdynamics-ai`** → **Custom domains**.
2. `realsyncdynamicsai.de` **und** `www.realsyncdynamicsai.de` hinzufügen.
3. Cloudflare aktualisiert die DNS-Records des Pages-Projekts automatisch
   (proxied). Production-Branch des Projekts = `main` sicherstellen.
4. Nach Bindung verifizieren:
   ```
   curl -sI https://realsyncdynamicsai.de/        # erwartet: HTTP 200
   curl -sI https://realsyncdynamicsai.de/landing # erwartet: HTTP 200 (SPA-Fallback)
   ```

## 6. Reihenfolge bis Livegang (GitHub Pages bleibt parallel)

1. Repo-Secrets setzen (Abschnitt 4).
2. Workflow `Deploy to Cloudflare Pages` manuell via `workflow_dispatch` triggern
   → frisches Production-Deployment mit aktivem `_redirects`.
3. Pages-Deployment auf `*.pages.dev` prüfen: Root **und** Deep-Link = 200.
4. Custom Domain im Dashboard binden (Abschnitt 5).
5. Apex `realsyncdynamicsai.de` verifizieren = 200.
6. **Erst dann** GitHub Pages deaktivieren: `public/CNAME` entfernen und
   `deploy-pages.yml` archivieren/abschalten. (Noch NICHT in diesem Branch —
   GitHub Pages bleibt bis zur verifizierten Cloudflare-Production aktiv.)

## 7. Notfall-Rollback (sofort wieder live, falls nötig)

Apex-DNS in Cloudflare zurück auf GitHub Pages, **DNS-only (grau)**:
`A @ 185.199.108.153/109.153/110.153/111.153`. GitHub-Pages-Pipeline
(`deploy-pages.yml`) ist unverändert funktionsfähig.

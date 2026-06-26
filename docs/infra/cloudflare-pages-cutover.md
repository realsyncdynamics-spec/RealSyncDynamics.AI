# Cloudflare-Pages-Cutover & 404-Analyse — realsyncdynamicsai.de

Stand: 2026-06-22 · Branch: `claude/cloudflare-deploy`

## 1. Symptom

`https://realsyncdynamicsai.de/` liefert **HTTP 404** (Apex), Deep-Links
ebenfalls. Vorher (2026-06-05, dokumentiert in `deploy-pages.yml`) lieferte die
Domain `HTTP 200`, `server: GitHub.com` über GitHub Pages.

## 1b. Live-Baseline vor Cutover (gemessen 2026-06-23 02:07 UTC)

Momentaufnahme unmittelbar vor der Domain-Bindung — als Referenzzustand:

| URL | Ergebnis | Befund |
| --- | --- | --- |
| `realsyncdynamicsai.de` (+ `/pricing`, `/audit`, `/app`) | **HTTP 500**, `server: cloudflare`, `cf-cache-status: DYNAMIC`, leerer Body | **Kein 404, sondern 500** — auf der Apex *läuft* etwas und wirft einen Fehler. Signatur eines aktiven, fehlerhaften **Workers** → die Worker-Route `realsyncdynamicsai.de/*` (Platzhalter `realsyncdynamics`) ist die **aktive** 500-Ursache, nicht nur die fehlende Pages-Bindung. |
| `www.realsyncdynamicsai.de` | **HTTP 301 → Apex**, Header `via: varnish`, `x-served-by: cache-chi…`, `x-github-request-id` | **`www` hängt noch an GitHub Pages / Fastly.** DNS ist gemischt: Apex auf Cloudflare (kaputt), `www` auf GitHub Pages (funktioniert, dient als Fallback). |
| `realsyncdynamics-ai.pages.dev` | **HTTP 200** | Pages-Projekt selbst ist gesund. |

**Konsequenzen für den Cutover:**
1. **P0-3 (Worker-Route entfernen) ist kritisch, nicht optional** — eine
   Worker-Route auf `realsyncdynamicsai.de/*` kann **Vorrang vor der
   Pages-Custom-Domain** behalten; sonst greift die Bindung (P0-2) evtl. nicht.
2. **`www` muss mit umziehen** — Custom Domain für **Apex *und* `www`** binden.
3. **GitHub Pages erst zuletzt abschalten** — solange `www`/GitHub Pages noch
   200 liefert, ist es das einzige funktionierende Fallback.

## 2. Root-Cause-Analyse (verifiziert per Live-Checks)

| Check | Ergebnis | Bedeutung |
| --- | --- | --- |
| `curl -I https://realsyncdynamicsai.de/` | `HTTP 404/500`, `server: cloudflare`, `cf-ray`, `cache-control: no-store` | DNS zeigt **nicht mehr** auf GitHub Pages, sondern proxied auf Cloudflare (104.21.x / 172.67.x). |
| `curl https://realsyncdynamics-ai.pages.dev/` | `HTTP 200` | Das Cloudflare-Pages-Projekt **existiert** und liefert die Root aus. |
| `curl https://realsyncdynamics-ai.pages.dev/landing` | `HTTP 404` (Body = `404.html`) | Deep-Links liefern 404; die `_redirects`-200-Rewrite greift **nicht**. |
| `curl https://<branch>.realsyncdynamics-ai.pages.dev/` | `HTTP 200` | Branch-Previews (Cloudflare Git-Integration) funktionieren. |
| `curl https://claude-cloudflare-deploy.<…>.pages.dev/landing` | `HTTP 404` | **Auch ein frischer Build MIT `_redirects` liefert 404** — widerlegt „stale deployment". |
| `curl …/landing` Body | `public/404.html` = JS-Shim `location.replace('/?_path='+path)` | Deep-Links funktionieren im Browser nur über den **spa-github-pages-404-Hack** (404 + Client-Redirect), nicht über `_redirects`. |
| Cloudflare Worker `realsyncdynamics` | `return new Response("Hello world")` | Platzhalter-Worker, **nicht** auf der Apex-Route → nicht die 404-Ursache. |

**Zwei Ursachen:**

1. **Apex nicht an Pages gebunden (Production-Blocker).** `realsyncdynamicsai.de`
   ist proxied über Cloudflare, aber die **Custom Domain ist nicht im Pages-Projekt
   `realsyncdynamics-ai` registriert** (und auf keiner Worker-Route). Cloudflare
   hat nichts auszuliefern → Edge-404/500.
2. **`_redirects`-200-Rewrite greift auf diesem Pages-Projekt nicht (sekundär,
   SEO).** `public/_redirects` (`/* /index.html 200`) ist im Build vorhanden,
   wird auf Cloudflare Pages aber **nicht** angewandt — empirisch verifiziert: ein
   frischer Branch-Preview MIT `_redirects` liefert Deep-Links weiterhin als 404.
   Statt der 200-Rewrite serviert Cloudflare die `public/404.html` (JS-Redirect-
   Shim aus der GitHub-Pages-Ära). Browser landen letztlich im SPA, aber mit
   HTTP-404-Status + Redirect-Hop (schlecht für Crawler/Social-Previews).
   **Ein frischer Build allein behebt das NICHT** — Ursache liegt in der Pages-
   Projekt-Konfiguration (vermutlich die mitgelieferte `404.html` bzw. das
   Build-Output-/SPA-Setting), die nur im Cloudflare-Dashboard prüfbar ist.

## 3. Deploy-Pipeline auf `main` (via #671)

- `.github/workflows/deploy-cloudflare-pages.yml` — **liegt seit #671 auf `main`**
  (dieses Dokument ändert den Workflow NICHT). Verhalten: bei Push auf `main`
  (bzw. `workflow_dispatch`) läuft `npm run lint` → `npm run build`
  (`VITE_BASE=/`) → Prerender → SPA-Fallback (`cp index.html 404.html` + Routen
  aus `sitemap.xml`) → Deploy via `cloudflare/pages-action@v1` → Smoke-Test gegen
  `https://realsyncdynamicsai.de`.
  ⚠ **Nicht secret-gated**: ohne `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`
  schlägt der Deploy-Schritt fehl, und der Smoke-Test ist rot, solange die
  Custom Domain nicht gebunden ist (404). Reihenfolge in Abschnitt 6 beachten.
  ⚠ Liefert ein reproduzierbares Production-Deployment, behebt aber Ursache (2)
  NICHT allein — siehe Abschnitt 2.
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
   curl -sI https://realsyncdynamicsai.de/landing # heute: 404 (404.html-Shim), Ziel: 200
   ```

## 5b. Saubere Deep-Link-200 (Ursache 2 — Pages-SPA-Config)

Damit Deep-Links echte `HTTP 200` liefern statt `404 + JS-Redirect`:

1. Im Cloudflare-Pages-Dashboard das **Build-Output-Directory** prüfen (muss `dist`
   sein, damit `_redirects` im Root liegt).
2. Test: **`public/404.html` entfernen** und neu deployen. Hypothese: die
   mitgelieferte `404.html` verhindert, dass Cloudflare die `_redirects`-200-Rewrite
   als Catch-all nutzt. Ohne `404.html` sollte `/* /index.html 200` greifen.
3. Verifizieren: `curl -sI …pages.dev/landing` → `HTTP 200`.
4. Bleibt es bei 404, ist im Pages-Projekt das **SPA-/Framework-Preset** zu prüfen.

(Dieser Schritt ist im Repo NICHT vorausgeändert, weil `404.html` auf GitHub Pages
gebraucht wird — siehe Rollback. Erst nach erfolgreichem Cloudflare-Test entfernen.)

## 6. Reihenfolge bis Livegang (GitHub Pages bleibt parallel)

1. Repo-Secrets setzen (Abschnitt 4).
2. Workflow `Deploy to Cloudflare Pages` manuell via `workflow_dispatch` triggern
   → frisches, reproduzierbares Production-Deployment.
3. Custom Domain im Dashboard binden (Abschnitt 5) → Apex = 200.
4. Deep-Link-200 herstellen (Abschnitt 5b) und prüfen.
5. Apex `realsyncdynamicsai.de` Root **und** Deep-Link verifizieren = 200.
6. **Erst dann** GitHub Pages deaktivieren: `public/CNAME` entfernen und
   `deploy-pages.yml` archivieren/abschalten. (Noch NICHT in diesem Branch —
   GitHub Pages bleibt bis zur verifizierten Cloudflare-Production aktiv.)

## 7. Notfall-Rollback (sofort wieder live, falls nötig)

Apex-DNS in Cloudflare zurück auf GitHub Pages, **DNS-only (grau)**:
`A @ 185.199.108.153/109.153/110.153/111.153`. GitHub-Pages-Pipeline
(`deploy-pages.yml`) ist unverändert funktionsfähig.

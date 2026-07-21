# Hosting-Konsolidierung: nur noch Cloudflare Pages

Stand: 2026-06-25 · Entscheidung: **Cloudflare Pages ist das einzige
Frontend-Hosting** für `realsyncdynamicsai.de`.

## Warum

Die Domain wurde zeitweise von **vier konkurrierenden Targets** bedient — die
Wurzel des „nichts ändert sich"-Problems (siehe
`apex-still-on-github-pages-2026-06-25.md`):

| Target | Zustand vor Konsolidierung |
|---|---|
| **Cloudflare Pages** `realsyncdynamics-ai` | ✅ aktueller Build — **Zielzustand** |
| GitHub Pages (Fastly) | serviert eingefrorenen Apex-Build (23.06.) |
| Vercel `real-sync-dynamics-ai` | zeitweise Error/Ready (flaky) |
| Vercel `real-sync-dynamics-ai-9ue5` | Ready |
| Vercel `real-sync-dynamics-ai-remu` | Error (`rootDirectory: services/realsync-runtime-core`) |

Mehrere auto-deployende Projekte auf demselben Repo erzeugen widersprüchliche
PR-Status, verbrauchen Build-Minuten und verschleiern, welcher Build „live" ist.

## Repo-seitig bereits erledigt (dieser PR)

- `vercel.json` **entfernt** — keine Vercel-Build-Config mehr im Repo.
- `deploy/cloudflare/README.md` (Proxy-vor-GH-Pages) als **DEPRECATED** markiert.
- Traefik-Router `kodee-apex` (301 → github.io) **deaktiviert**.
- Stale `deploy-pages.yml`-Referenz in `tracker-db-update.yml` korrigiert.

## Repo-seitiger Vercel-Kill-Switch (Update 2026-07-01)

Der geblockte Vercel-Account (`realsynchost`) erzeugte weiterhin **rote
PR-Status-Checks** („Account is blocked" / „Deployment has failed"), die den
Merge über `mergeable_state: unstable` blockierten. Anders als das reine
*Löschen* von `vercel.json` respektiert die Vercel-Git-Integration die
**explizite** Einstellung im Repo:

```json
// vercel.json (Repo-Root)
{ "git": { "deploymentEnabled": false } }
```

Damit erstellt Vercel für Pushes/PRs **keine Deployments und keine
Commit-Status mehr** — der rote Check verschwindet, ohne Dashboard-Zugriff.

> **Scope:** Eine Root-`vercel.json` wird nur von Projekten mit
> `rootDirectory = <Repo-Root>` gelesen — also den beiden Frontend-Duplikaten
> `real-sync-dynamics-ai` und `real-sync-dynamics-ai-9ue5`. Das Backend-Projekt
> `-remu` (`rootDirectory = services/realsync-runtime-core`) liest eine andere
> Config-Datei und bleibt **unberührt**. Frontend-Hosting bleibt allein
> **Cloudflare Pages**.

Der Dashboard-seitige Disconnect (unten) bleibt der saubere Endzustand; der
Kill-Switch ist die Repo-Absicht bis dahin.

> **Update 2026-07-21 (PR #844):** Der Kill-Switch ist jetzt **committed** —
> `vercel.json` mit `{ "git": { "deploymentEnabled": false } }` liegt sowohl
> im **Repo-Root** (deckt die beiden Frontend-Projekte `real-sync-dynamics-ai`
> und `real-sync-dynamics-ai-9ue5`, `rootDirectory = Repo-Root`) als auch in
> **`services/realsync-runtime-core/`** (deckt das Backend-Projekt, dessen
> `rootDirectory = services/realsync-runtime-core` ist — das war die einzige
> auf PRs failende Vercel-Deployment). Frontend bleibt allein Cloudflare Pages;
> `realsync-runtime-core` ist ein Fastify-Server (NATS/Postgres/Redis) und
> gehört auf den **VPS-Stack**, nicht auf Vercel oder Cloudflare Pages. Greift
> nur, solange der Vercel-Account nicht *geblockt* ist (sonst Account-Level-
> Status vor Config — dann bleibt nur der Disconnect unten).

> **Befund 2026-07-01 (PR #750):** Solange der Vercel-Account **geblockt**
> ist, greift der Kill-Switch **nicht** — Vercel postet den Status
> „Account is blocked" auf **Account-Ebene**, *bevor* die Projekt-Config /
> `vercel.json` gelesen wird. Der rote PR-Check verschwindet also erst mit
> dem **Disconnect unten** (oder wenn der Account entsperrt wird; dann greift
> zusätzlich der Kill-Switch). Der PR bleibt trotzdem mergebar:
> `mergeable_state` ist `unstable` (nicht `blocked`), sofern die
> „Vercel …"-Checks nicht als *required* in der Branch-Protection stehen.

## Dashboard-seitig nötig (endgültiger Disconnect)

Die drei Vercel-Projekte sind über die **Vercel-Git-Integration** verbunden, nicht
über Repo-Dateien — `vercel.json` zu *löschen* stoppt sie **nicht** (siehe
Kill-Switch oben für die Repo-Lösung). Für den endgültigen Disconnect manuell:

### Vercel (Account `realsynchost`)
Für **jedes** der drei Projekte (`real-sync-dynamics-ai`,
`real-sync-dynamics-ai-9ue5`, `real-sync-dynamics-ai-remu`):
1. Vercel → Project → **Settings → Git → Disconnect** (trennt das Auto-Deploy
   + die PR-Kommentare), **oder** das Projekt löschen, falls nicht anderweitig
   gebraucht.
2. Alternativ Git-Integration nur für dieses Repo entfernen:
   Vercel → Account/Team → **Settings → Git → Repositories**.

> Hinweis `-remu`: `rootDirectory = services/realsync-runtime-core` — falls dieser
> Service bewusst auf Vercel laufen soll, NICHT trennen; dann ist es kein
> Frontend-Duplikat, sondern ein eigenständiger Backend-Deploy. Vorher klären.

**Konkret für die roten PR-Checks (Stand PR #750):** Die beiden failenden
Status stammen aus den Frontend-Projekten `real-sync-dynamics-ai` und
`real-sync-dynamics-ai-9ue5`. Diese beiden trennen (Disconnect) genügt, damit
kein „Vercel …"-Check mehr auf PRs erscheint. `-remu` nur nach obiger Klärung.

**Verifizieren nach dem Disconnect:** Neuen Commit auf einen offenen PR pushen
(oder PR neu öffnen) und prüfen, dass unter *Checks* keine „Vercel …"-Kontexte
mehr auftauchen — nur noch GitHub Actions + Cloudflare Pages.

### GitHub Pages
1. GitHub → Repo → **Settings → Pages → Source = None** (deaktivieren).
2. DNS in Cloudflare: Apex-A-Records auf `185.199.108–111.153` und
   `www`-CNAME auf `*.github.io` **entfernen** (Schritte im Cutover-Runbook).

### Cloudflare Pages = einzige Quelle
1. Pages → `realsyncdynamics-ai` → **Custom domains:** `realsyncdynamicsai.de`
   **und** `www` binden (Status **Active**), Production-Branch = `main`.
2. **Caching → Purge Everything**.
3. Verifizieren — Apex muss denselben JS-Hash wie `pages.dev` und **keine**
   `via: varnish`-Header liefern:
   ```bash
   npm run diagnose:domain
   SMOKE_STRICT_APEX=1 npm run smoke:production
   ```

## Endzustand

```
realsyncdynamicsai.de  ──►  Cloudflare Pages (realsyncdynamics-ai, Branch main)
www.realsyncdynamicsai.de ─►  (301/Alias auf Apex, via Pages Custom Domain)

GitHub Pages:  aus
Vercel:        getrennt (ggf. -remu als separater Backend-Service behalten)
```

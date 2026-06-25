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

## Dashboard-seitig nötig (nicht per Repo automatisierbar)

Die drei Vercel-Projekte sind über die **Vercel-Git-Integration** verbunden, nicht
über Repo-Dateien — `vercel.json` zu löschen stoppt sie **nicht**. Manuell:

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

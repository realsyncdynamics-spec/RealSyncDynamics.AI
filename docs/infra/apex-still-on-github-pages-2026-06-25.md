# Befund: Apex serviert weiter den alten GitHub-Pages-Build — 2026-06-25

Stand: 2026-06-25 · Messung aus Container-Edge (Colo IAD) · ergänzt
`REALSYNC_DOMAIN_EDGE_DIAGNOSIS.md` (23.06.) und
`docs/infra/cloudflare-pages-cutover.md` (22.–23.06.)

## Ergebnis in einem Satz

Die ~30 Commits der letzten drei Tage sind **vollständig im Repo und sauber nach
`realsyncdynamics-ai.pages.dev` deployt** — aber die Domain
`realsyncdynamicsai.de` liefert sie nicht aus, weil der **Apex weiterhin am alten
GitHub-Pages-Origin hängt** und einen auf den **23. Juni eingefrorenen Build**
ausspielt. Es ist **kein** Code-/Funktions-Chaos, sondern eine **nicht vollzogene
Custom-Domain-Bindung** in Cloudflare.

## Was sich seit dem 23.06. geändert hat

Die frühere Diagnose (23.06.) sah den Apex auf **HTTP 500** (fehlerhafte
Worker-Route). Heute (25.06.) ist daraus ein **HTTP 200** geworden — aber ein 200,
der die **falsche, alte Seite** ausliefert. Der Zustand ist also *scheinbar*
besser (kein 500 mehr), de facto aber unverändert kaputt: die Live-Domain zeigt
nicht den aktuellen Stand.

## Beweis: zwei verschiedene Builds laufen parallel

| | `realsyncdynamics-ai.pages.dev` (NEU) | `realsyncdynamicsai.de` (Live) |
|---|---|---|
| JS-Build-Hash | `/assets/index-B96JMMoL.js` | `/assets/index-DhsfhZ06.js` — **anderer Build** |
| Server-Signatur | nur `server: cloudflare` | `via: 1.1 varnish` · `x-served-by: cache-iad-*` · `x-cache: HIT` |
| `last-modified` | aktuell | **`Tue, 23 Jun 2026 15:25:54 GMT`** — eingefroren |
| `cache-control` | `public, max-age=0, must-revalidate` (Pages) | `max-age=600` (GH-Pages/Fastly) |

`via: varnish` + `x-served-by: cache-*` + `x-cache: HIT` ist die **Fastly-Signatur**.
**GitHub Pages läuft über Fastly; Cloudflare Pages erzeugt diese Header nie.**
Der unterschiedliche JS-Hash beweist: es sind **zwei verschiedene Artefakte** —
der Live-Apex ist nicht der aktuelle Build.

## Aktiver Pfad (Split-Brain)

```
realsyncdynamicsai.de
   │
   ▼  Cloudflare-Proxy (orange)        server: cloudflare, cf-cache-status: DYNAMIC
   │
   ▼  Origin = GitHub Pages / Fastly   via: varnish, last-modified 23.06.  ← FALSCH
        (gh-pages-Artefakt, eingefroren seit Abschalten des Pages-Workflows)

   SOLL:  Cloudflare-Proxy → Pages-Projekt realsyncdynamics-ai (= pages.dev)
```

Kein aktiver CI-Workflow aktualisiert GitHub Pages mehr (`deploy-pages.yml`
wurde in #679 entfernt) — deshalb friert der GH-Pages-Build auf dem 23. Juni ein,
während `main`/pages.dev weiterläuft.

## Repo-Landminen, die den Cutover sabotieren (in diesem Commit adressiert)

1. **`deploy/cloudflare/README.md`** beschrieb exakt den kaputten Zustand:
   Cloudflare-Proxy **vor** GitHub Pages (A-Records auf GH-Pages-IPs
   `185.199.108–111.153`, `www → github.io`). Wer dieser Legacy-Anleitung folgt,
   stellt das Split-Brain **wieder her**. → als DEPRECATED markiert, verweist nun
   auf den Pages-Pfad.
2. **`deploy/ollama-traefik/docker-compose.yml`** — Traefik-Router `kodee-apex`
   macht einen **harten 301 vom Apex/`www` auf `realsyncdynamics-spec.github.io`**.
   Aktuell dormant (DNS umgeht den VPS), aber eine scharfe Falle, sobald DNS je
   auf den VPS zeigt. → deaktiviert.

## Fix (Cloudflare-Dashboard — nicht per CI/Code automatisierbar)

1. **Pages → Projekt `realsyncdynamics-ai` → Custom domains:**
   `realsyncdynamicsai.de` **und** `www` binden, Status muss **Active** sein.
2. **DNS → Records:** Apex-A-Records auf GitHub-Pages-IPs
   (`185.199.108–111.153`) und `www`-CNAME auf `*.github.io` **entfernen**;
   Cloudflare setzt beim Domain-Binden automatisch die Pages-Records (proxied).
3. **Worker Routes:** keine Route `realsyncdynamicsai.de/*` darf greifen.
4. **Caching → Purge Everything** (eingefrorenes Fastly-/Edge-Artefakt rauswerfen).
5. Verifizieren — der Apex muss danach **denselben JS-Hash wie pages.dev** und
   **keine `varnish`-Header** mehr liefern:
   ```bash
   npm run diagnose:domain
   SMOKE_STRICT_APEX=1 npm run smoke:production
   curl -sI https://realsyncdynamicsai.de/ | grep -iE 'via|x-served|last-modified'
   # erwartet: KEINE via:varnish / x-served-by-Zeile mehr
   ```

## Notfall-Rollback

Unverändert gemäß `docs/infra/cloudflare-pages-cutover.md` §7 — Apex-DNS
zurück auf GitHub-Pages-IPs (DNS-only). GitHub Pages dient bis zum verifizierten
Cutover als funktionierendes Fallback und darf erst **nach** Punkt 5 abgeschaltet
werden.

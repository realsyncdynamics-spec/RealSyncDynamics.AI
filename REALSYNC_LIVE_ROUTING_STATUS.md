# RealSyncDynamics.AI — Live Routing Status

> Stand: 2026-06-23 · nach Merge **PR #674** (`public/404.html` entfernt) · Branch `claude/magical-wright-5aat5k`

## Kurzfassung (TL;DR)

- **`*.pages.dev` ist vollständig gesund.** Alle geprüften Routen liefern `200` + HTML, inkl. `/audit` und `/audit/`.
- **Die Custom-Domain `realsyncdynamicsai.de` liefert auf JEDER Route `HTTP 500`** (leerer Body, `cf-cache-status: DYNAMIC`). Das betrifft `/`, `/pricing`, `/audit`, `/login`, `/app` — **nicht nur `/audit`**.
- **Ursache liegt NICHT im Repo / nicht in React-Router / nicht in `/audit`.** Der `/audit`-Screen ist eine statische Landing-Page mit abgesichertem Mount-Fetch (`.catch(() => null)` + Fallback) und lädt auf `pages.dev` sauber.
- **Ursache ist das Cloudflare-Custom-Domain-Routing** (Split-Brain): Die Custom-Domain serviert nicht aus dem gesunden Pages-Projekt. → Fix im Cloudflare-Dashboard, siehe **[CLOUDFLARE_DOMAIN_FIX.md](./CLOUDFLARE_DOMAIN_FIX.md)**.

## Route-Matrix (live verifiziert)

| Route | `realsyncdynamics-ai.pages.dev` | `realsyncdynamicsai.de` |
|---|---|---|
| `/` | **200** HTML | **500** |
| `/pricing` | **200** HTML | **500** |
| `/pricing/` | **200** HTML | **500** |
| `/audit` | **200** HTML | **500** |
| `/audit/` | **200** HTML | **500** |
| `/login` | **200** HTML | **500** |
| `/app` | **200** HTML | **500** |

Erzeugt mit `npm run smoke:production` (siehe `scripts/smoke-production-routing.mjs`). 7/14 OK, 7 Base-Deltas.

### Header-Signatur des Fehlers

`pages.dev/audit`:
```
HTTP/2 200
content-type: text/html; charset=utf-8
server: cloudflare
```

`realsyncdynamicsai.de/` (und alle anderen Routen):
```
HTTP/2 500
server: cloudflare
cf-cache-status: DYNAMIC
content-length: 0      ← leerer Body, kein Origin-Header (kein Fastly/Pages-Marker)
```

Der leere `500 / DYNAMIC` ohne Origin-Header bedeutet: Der Request stirbt **an der Cloudflare-Edge**, bevor er das gesunde Pages-Projekt erreicht.

## `/pricing` vs `/pricing/` und `/audit` vs `/audit/`

- Auf `pages.dev` verhalten sich beide Varianten identisch (`200` HTML) — der SPA-Catch-all (`/* /index.html 200`) greift.
- Auf der Custom-Domain ist der Vergleich aktuell nicht aussagekräftig, weil **alles** `500` liefert. Slash-Verhalten kann erst nach dem Domain-Fix sauber bewertet werden.
- Cloudflare Pages normalisiert Trailing-Slashes selbst; ein evtl. beobachteter `/pricing` → `/pricing/`-Redirect ist Pages-Default und **unkritisch**, solange das Ziel `200` liefert.

## Was im Repo geprüft wurde (Ergebnis: sauber)

| Prüfpunkt | Datei | Befund |
|---|---|---|
| SPA-Catch-all | `public/_redirects` | ✅ `/* /index.html 200` vorhanden |
| Headers | `public/_headers` | ✅ vorhanden, unkritisch |
| Build-Output | `wrangler.toml` (`dir = dist`) | ✅ Pages-Build OK (pages.dev beweist es) |
| Pages Functions | `functions/` | ✅ nicht vorhanden → kann keinen 500 erzeugen |
| `/audit`-Route | `src/App.tsx:302` → `AuditLanding` | ✅ existiert |
| `/audit`-Mount-Fetch | `src/pages/AuditLanding.tsx:267` | ✅ `/tracker-db-version.json`, `.catch(() => null)` + Fallback, **kein Crash** |
| Worker im Repo | — | nur Stub-Worker `realsyncdynamics` (`return new Response("Hello world")` → 200, kann **keinen** 500 erzeugen) |

> Hinweis: Lokaler Branch enthält `public/404.html` und `public/CNAME` noch — das ist der Stand **vor** dem PR-#674-Merge auf `main`. Beide sind für den Custom-Domain-500 irrelevant.

## Was Cloudflare-seitig offen ist

Der 500 ist ein reines Domain-Binding-Problem. Abzuarbeiten im Dashboard (Details in **CLOUDFLARE_DOMAIN_FIX.md**):

1. Custom-Domain `realsyncdynamicsai.de` muss auf **dasselbe** Pages-Projekt zeigen wie `realsyncdynamics-ai.pages.dev`.
2. Alte **Worker-Route** auf `realsyncdynamicsai.de/*` (falls vorhanden) entfernen — sie überschreibt sonst die Pages-Auslieferung.
3. **DNS** der Apex prüfen (proxied CNAME/Flattening auf das Pages-Projekt).
4. **SSL/TLS**-Modus prüfen (Full bzw. Full (strict), kein Origin-Mismatch).
5. **Cache purgen** und Deployment neu triggern.

## Verifikationsbefehle

```bash
# Repo-Smoke (beide Bases, Tabelle + Split-Brain-Vergleich)
npm run smoke:production

# Playwright-Live-Smoke (Default gegen pages.dev; nach Domain-Fix gegen Custom-Domain)
PROD_SMOKE=1 npx playwright test e2e/production-routing.spec.ts
PROD_SMOKE=1 PROD_BASE=https://realsyncdynamicsai.de npx playwright test e2e/production-routing.spec.ts

# Manuell
for b in https://realsyncdynamics-ai.pages.dev https://realsyncdynamicsai.de; do
  for r in / /pricing /pricing/ /audit /audit/ /login /app; do
    printf "%s%-11s " "$b" "$r"; curl -sS -o /dev/null -w "%{http_code}\n" "$b$r";
  done
done
```

## MVP-Produktionsreife

- **Funktional/Inhaltlich:** ✅ Die App ist live und vollständig über `realsyncdynamics-ai.pages.dev` erreichbar (alle Routen 200).
- **Öffentlicher Funnel über die Marken-Domain:** ❌ **noch nicht** — `realsyncdynamicsai.de` liefert `500`. Erst nach dem Cloudflare-Domain-Fix ist der öffentliche Funnel sauber.

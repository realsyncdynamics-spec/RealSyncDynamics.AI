# Domain-Umzug realsyncdynamicsai.de → Pages-Projekt `realsyncdynamics-ai`

Stand: 18.11.2026 · Status: **vorbereitet, nicht ausgeführt** · Ausführung nur mit Einzel-Freigabe
(Domain-Umzug = Produktionswirkung, `AGENTS.md` → Freigaben).

Ziel: Die Hauptdomain liefert dasselbe Deployment wie `realsyncdynamics-ai.pages.dev`.
Startseite ist danach die Startseite v3 aus diesem Repo (Entscheidung 15.11.2026,
PR #2305). Die bisherige, eigenständige Startseite (Claude-Design-Export, separates
Projekt `realsyncdynamics-website`) wird von der Domain genommen, aber nicht gelöscht.

Vorgänger-Runbook (Juni, GitHub-Pages-Ablösung): `docs/infra/cloudflare-pages-cutover.md`.
Automatisierte Domain-Bindung: Workflow `cloudflare-domain-cutover.yml` (nur `workflow_dispatch`).

## 1. Ist-Zustand (gemessen 18.11.2026)

| Prüfung | Ergebnis | Bedeutung |
|---|---|---|
| `curl -I https://realsyncdynamicsai.de/` | 200, ~5,7 MB HTML, Titel „… Governance OS, Voice Agent, Landingpage Builder“ | Eigenständige Startseite, **nicht** aus diesem Repo |
| `/login`, `/welcome`, `/app/dashboard`, `/build`, `/impressum`, `/contact-sales`, `/kontakt` | 302 → `realsyncdynamics-ai.pages.dev/…` | Besucher verlässt die Domain |
| `/ueber-uns`, `/legal/impressum`, `/gibt-es-nicht`, `/demo-tour/dashboard` | 200 mit der Startseite | Fallback des fremden Deployments |
| `/robots.txt`, `/sitemap.xml` | `text/html` | SEO-Fehler |
| `www.realsyncdynamicsai.de` | 301 → Apex, `server: cloudflare` | `www` hängt bereits an Cloudflare |
| DNS Apex + `www` | Cloudflare-Proxy (104.21.31.200 / 172.67.179.238) | Zone liegt bei Cloudflare |
| `voice.realsyncdynamicsai.de` | CNAME `realsyncdynamics-spec.github.io` | **Nicht Teil des Umzugs**, bleibt unverändert |
| Cloudflare-Worker `realsyncdynamics` | `return new Response("Hello world")` | Nicht die Quelle der Startseite |

Welches Cloudflare-Objekt die Domain heute bedient (vermutlich ein zweites
Pages-Projekt mit eigener `_redirects`, Indiz: 302 = Pages-Default), ist nur im
Dashboard sichtbar → Schritt 3.1.

## 2. Voraussetzungen (vor dem Umzug)

- [ ] **PR #2305 gemergt** und Production-Deploy von `main` auf `realsyncdynamics-ai` grün.
      Sonst erscheint nach dem Umzug `LandingV6` statt v3.
- [ ] Prüfung auf `https://realsyncdynamics-ai.pages.dev` (nicht nur Preview) nach Abschnitt 5 grün.
- [ ] Supabase Auth → URL Configuration: `https://realsyncdynamicsai.de/**` in den Redirect-URLs
      (Magic Link nutzt `window.location.origin`, siehe `src/pages/LoginPage.tsx`).
      `pages.dev` dort **belassen** (Rückfallweg).
- [ ] Turnstile-Widget: Hostname `realsyncdynamicsai.de` in der Widget-Konfiguration erlaubt.
- [ ] Stripe: Rückkehr-URLs zeigen auf die Hauptdomain (Checkout/Portal) — kurz prüfen.
- [ ] Zeitfenster mit wenig Verkehr; Ausführender hat Zugriff auf Cloudflare-Dashboard
      (Pages + DNS der Zone `realsyncdynamicsai.de`).
- [ ] Momentaufnahme der alten Startseite sichern (HTML liegt im Projekt
      `realsyncdynamics-website`; zusätzlich `curl -s https://realsyncdynamicsai.de/ > alt-startseite.html`).

## 3. Umzug (Cloudflare-Dashboard)

### 3.1 Heutige Bindung finden und notieren (Rückfallweg)

- [ ] Workers & Pages → jedes Projekt → **Custom domains**: welches Projekt hält
      `realsyncdynamicsai.de` und `www.realsyncdynamicsai.de`? Namen notieren.
- [ ] Workers & Pages → Workers → **Routes** der Zone: gibt es eine Route
      `realsyncdynamicsai.de/*`? Wenn ja: Worker-Name notieren (Worker-Routen haben
      Vorrang vor Pages-Custom-Domains).
- [ ] DNS → Records für `@` und `www` notieren (Typ, Ziel, Proxy-Status).
- [ ] Rules (Redirect Rules / Page Rules / Bulk Redirects) der Zone auf Einträge
      prüfen, die `/login` usw. auf `pages.dev` umleiten → notieren.

### 3.2 Domain lösen

- [ ] Im alten Projekt (aus 3.1) `realsyncdynamicsai.de` und `www.…` unter
      Custom domains **entfernen**. Projekt selbst **nicht löschen**.
- [ ] Eine eventuelle Worker-Route `realsyncdynamicsai.de/*` entfernen
      (Worker nicht löschen).
- [ ] Redirect-/Page-Rules auf `pages.dev` deaktivieren (nicht löschen).

### 3.3 Domain binden

- [ ] Pages-Projekt **`realsyncdynamics-ai`** → Custom domains →
      `realsyncdynamicsai.de` **und** `www.realsyncdynamicsai.de` hinzufügen.
      Production-Branch = `main`.
      Alternativ: Workflow `Cloudflare Domain Cutover (one-shot)` per `workflow_dispatch`
      (bindet beide Domains, setzt proxied CNAMEs auf `realsyncdynamics-ai.pages.dev`,
      purged den Cache). **`voice.` bleibt unberührt** (der Workflow fasst nur Apex/`www` an).
- [ ] Warten bis Status „Active“ (SSL-Zertifikat ausgestellt).
- [ ] Cache der Zone purgen (Caching → Purge Everything).

`www` → Apex: Regel steht schon in `public/_redirects`
(`https://www.realsyncdynamicsai.de/* https://realsyncdynamicsai.de/:splat 301`),
greift sobald `www` am Projekt hängt.

## 4. Nicht anfassen

- `voice.realsyncdynamicsai.de` (GitHub Pages), Mail-Records (MX, SPF, DKIM, DMARC),
  `chat.` und andere Subdomains.
- Das alte Projekt `realsyncdynamics-website` (nur Domain lösen, nicht löschen —
  es ist der Rückfallweg).
- Supabase-Projekt und Edge Functions.

## 5. Abnahme direkt nach dem Umzug

```bash
for u in / /login /welcome /ueber-uns /legal/impressum /impressum /contact-sales /kontakt /robots.txt /sitemap.xml /gibt-es-nicht /demo-tour/dashboard /app/dashboard /app/voice /build; do printf '%-22s ' "$u"; curl -s -o /dev/null -w '%{http_code} %{content_type} -> %{redirect_url}\n' "https://realsyncdynamicsai.de$u"; done
```

Erwartung (identisch zur Preview von #2305, gemessen 18.11.):

| Pfad | Erwartet |
|---|---|
| `/` | 200 HTML, Titel „Websites, KI-Agenten und Automatisierungen …“ |
| `/login`, `/welcome`, `/app/*`, `/build`, `/demo-tour/dashboard` | 200 HTML (SPA), **kein** Redirect auf `pages.dev` |
| `/ueber-uns`, `/legal/impressum`, `/impressum`, `/contact-sales` | 200, eigener Titel |
| `/kontakt` | 301 → `https://realsyncdynamicsai.de/contact-sales` |
| `/robots.txt` | 200 `text/plain`, enthält `Sitemap: https://realsyncdynamicsai.de/sitemap.xml` |
| `/sitemap.xml` | 200 `application/xml` |
| `/gibt-es-nicht` | **404** „Seite nicht gefunden“ |
| `https://www.realsyncdynamicsai.de/ueber-uns` | 301 → `https://realsyncdynamicsai.de/ueber-uns` |
| `https://voice.realsyncdynamicsai.de/` | 200, unverändert |

Zusätzlich:

- [ ] Asset-Hash gleich: `curl -s https://realsyncdynamicsai.de/ | grep -oE '/assets/index-[^"]+\.js'`
      = derselbe Befehl gegen `realsyncdynamics-ai.pages.dev`.
- [ ] `SMOKE_STRICT_APEX=1 node scripts/smoke-production-routing.mjs` grün.
- [ ] Im Browser (ausgeloggt): `/app/dashboard` → `/welcome?next=%2Fapp%2Fdashboard`,
      Login per Magic Link → Rückkehr auf `/app/dashboard` **auf der Hauptdomain**.
- [ ] Startseite: Scan-Formular rendert, Chat-/Voice-Widget lädt, keine Konsolenfehler.
      **Keine echten Leads absenden.**
- [ ] Search Console: Sitemap neu einreichen.

## 6. Rückfallweg (unter 5 Minuten)

1. Pages-Projekt `realsyncdynamics-ai` → Custom domains → Apex und `www` entfernen.
2. Im alten Projekt (Name aus 3.1) Apex und `www` wieder hinzufügen; ggf. Worker-Route
   und Redirect-Rules aus 3.1/3.2 wieder aktivieren.
3. DNS-Records auf den in 3.1 notierten Stand zurücksetzen.
4. Cache purgen, `curl -I https://realsyncdynamicsai.de/` → wieder die alte Startseite.

Rückfall auf Code-Ebene (Domain bleibt am Repo-Projekt): `LandingV6` bleibt laut #2305
unter `/design/landing-v6` erhalten; ein Revert von #2305 stellt sie auf `/` zurück.

## 7. Bekannte Restpunkte (nicht Teil des Umzugs)

- Nicht vorgerenderte Routen (`/login`, `/welcome`, `/app/*`, `/build`, `/demo-tour/*`)
  liefern im Roh-HTML Titel und Canonical der Startseite; erst nach JavaScript stimmen
  sie (gerendert: `/login` = canonical `/login`, `noindex`). Für Crawler ohne JS
  bleibt das ein Canonical auf `/`.
- `/welcome` und die `/app/*`-Weiterleitung rendern `index, follow`; `/login` ist `noindex`.
- Header der Startseite v3: Build · Automate · Govern · Preise · Fragen · Anmelden (`/welcome`)
  — die 7-Punkte-Navigation der alten Startseite ist dort nicht enthalten.

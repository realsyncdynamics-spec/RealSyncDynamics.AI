# Live-Routing-Status — realsyncdynamicsai.de

> ## ⏱️ UPDATE 2026-06-25 — der HTTP-500 ist WEG; neuer Befund: DNSSEC-Kette unvollständig
>
> Die Messung weiter unten (Stand 2026-06-23, „Apex liefert überall 500") ist
> **überholt**. Aktuell verifiziert (live `curl` + DoH):
>
> | Prüfpunkt | 2026-06-23 (alt) | 2026-06-25 (aktuell) |
> |---|---|---|
> | Apex `/` | ❌ 500 | ✅ **200** `text/html` |
> | Apex `/pricing/`, `/audit` | ❌ 500 | ✅ **200** |
> | `www` | — | ✅ 301 → Apex |
> | Ausliefernder Origin | (Cloudflare Pages, defekt) | ⚠️ **GitHub Pages** hinter Cloudflare-Proxy (`x-github-request-id`, `via: 1.1 varnish`) |
> | DNSSEC | — | ⚠️ Zone **signiert** (DNSKEY + gültige RRSIG), aber **kein DS bei DENIC** → `AD=false` |
>
> **Was das bedeutet:**
> 1. Die Domain ist **live erreichbar** (200 auf allen geprüften Routen). Die
>    Cloudflare-Pages-Bindung aus `CLOUDFLARE_DOMAIN_FIX.md` ist **nicht mehr** der
>    aktive Pfad — der Apex wird derzeit von **GitHub Pages** bedient. Die im
>    Workflow `deploy-cloudflare-pages.yml` beschriebene Migration GitHub Pages →
>    Cloudflare Pages ist also **halbfertig** (NS bei Cloudflare, Origin noch GitHub Pages).
> 2. Das Screenshot-Symptom **`DNS_LOOKUP_FAILED`** ist **kein** Server-500 und **kein**
>    Repo-Fehler, sondern ein Resolver-seitiger Auflösungsfehler. Hauptverdacht:
>    **unvollständige DNSSEC-Kette** — die Zone publiziert Signaturen, aber beim
>    `.de`-Registrar (DENIC, via Hostinger) fehlt der **DS-Record**. Validierende
>    Resolver (viele Mobilfunk-Carrier) liefern bei einem fehlenden/abweichenden
>    DS zeitweise `SERVFAIL` → Browser zeigt `DNS_LOOKUP_FAILED`. Aktuell löst die
>    Domain weltweit auf (insecure, `AD=false`), d. h. der Zustand ist *funktionierend
>    aber latent fragil*.
>
> **Nächste Aktion (Dashboard/Registrar, NICHT per Repo lösbar):**
> - DNSSEC begradigen: in Cloudflare den DS-Record holen und **exakt** bei Hostinger
>   (.de-Registrar) hinterlegen — **oder** DNSSEC in Cloudflare deaktivieren, damit
>   die Zone keine Signaturen mehr publiziert. **Nicht** halb-aktiviert lassen.
>   Verifikation: `https://dnsviz.net/d/realsyncdynamicsai.de/dnssec/`
> - Hosting-Ziel festlegen: Apex entweder bewusst auf **GitHub Pages** (aktuell) **oder**
>   **Cloudflare Pages** (Workflow-Ziel) binden — nur an **einer** Stelle.
> - Automatische Prüfung: `npm run diagnose:domain` enthält jetzt einen DNSSEC-/DS-Check
>   (Abschnitt „DNSSEC-/DS-Konsistenz").
>
> ---
> _Historischer Stand 2026-06-23 (überholt, zur Nachverfolgung erhalten):_

## TL;DR

- **`realsyncdynamics-ai.pages.dev` ist vollständig sauber** — alle geprüften Routen liefern `200 + text/html`, inkl. `/audit` und `/audit/`.
- **`realsyncdynamicsai.de` (Custom Domain) liefert auf JEDER Route `HTTP 500`** — `/` genauso wie `/audit`. Es ist **kein** `/audit`-spezifisches Problem.
- Die Ursache liegt **nicht im Repository**, sondern in der **Cloudflare-Custom-Domain-/Edge-Konfiguration**. Siehe `CLOUDFLARE_DOMAIN_FIX.md`.

## Gemessene Route-Matrix (verifiziert per `npm run smoke:production`)

### `realsyncdynamics-ai.pages.dev` — ✅ erforderlich, alle OK
| Route | Status | Content-Type | Ergebnis |
|---|---|---|---|
| `/` | 200 | text/html | OK |
| `/pricing` | 200 | text/html | OK |
| `/pricing/` | 200 | text/html | OK |
| `/audit` | 200 | text/html | OK |
| `/audit/` | 200 | text/html | OK |
| `/login` | 200 | text/html | OK |
| `/app` | 200 | text/html | OK |

### `realsyncdynamicsai.de` — ❌ alle FAIL
| Route | Status | `cf-cache-status` | Body | Ergebnis |
|---|---|---|---|---|
| `/` | 500 | DYNAMIC | leer | FAIL |
| `/pricing` | 500 | DYNAMIC | leer | FAIL |
| `/pricing/` | 500 | DYNAMIC | leer | FAIL |
| `/audit` | 500 | DYNAMIC | leer | FAIL |
| `/audit/` | 500 | DYNAMIC | leer | FAIL |
| `/login` | 500 | DYNAMIC | leer | FAIL |
| `/app` | 500 | DYNAMIC | leer | FAIL |

> Hinweis zu einer abweichenden Fremd-Momentaufnahme: Es kursierte ein Stand, wonach
> der Apex `/` und `/pricing` ausliefert und nur `/audit` scheitert („Cache miss").
> Das ließ sich **per direktem `curl` nicht reproduzieren** — der Apex ist von hier aus
> auf allen Routen uniform `500`. Mögliche Erklärung: zwischenzeitlich flackernde/teil-
> propagierte Domain-Bindung oder ein Cache-/Edge-Layer, der je nach PoP unterschiedlich
> antwortet. Maßgeblich ist die reproduzierbare `curl`-Messung oben.

## Repo-Befund (Ursache hier ausgeschlossen)

| Prüfpunkt | Ergebnis |
|---|---|
| `public/_redirects` | `/*  /index.html  200` ✓ vorhanden (SPA-Catch-all) |
| `public/404.html` | entfernt (PR #674) ✓ |
| `wrangler.toml` | `pages_build_output_dir = "dist"` — reine statische Pages-Ausgabe |
| `functions/` · `_worker.js` | **nicht vorhanden** → kein dynamischer Worker/SSR im Repo |
| Route `/audit` | `<Route path="/audit" element={<AuditLanding />} />` (lazy) — liefert auf pages.dev 200 |

**Schlussfolgerung:** Da `/audit` auf `pages.dev` einwandfrei lädt, sind React-Router,
Lazy-Loading und SPA-Fallback korrekt. Der Apex-500 entsteht **vor** der SPA, am
Cloudflare-Edge — die Anfrage erreicht den React-Code nie. Ein Code-/Komponenten-Fix
für `/audit` würde das Symptom nicht treffen.

## `/pricing` vs `/pricing/` und `/audit` vs `/audit/`

Auf `pages.dev` liefern beide Varianten direkt `200` (kein erzwungener Trailing-Slash-
Redirect, kein Statusunterschied). Ein abweichendes Slash-Verhalten ist ausschließlich
auf dem Apex denkbar und wäre dann ebenfalls ein Cloudflare-Zonen-/Rules-Artefakt, kein
Repo-Thema. Das Smoke-Script erfasst Redirect-Ziele und macht solche Unterschiede sichtbar.

## Verifikationsbefehle

```bash
npm run smoke:production           # pages.dev erforderlich, Apex advisory
SMOKE_STRICT_APEX=1 npm run smoke:production   # nach Domain-Bindung: Apex blockierend

# Roh:
curl -I https://realsyncdynamics-ai.pages.dev/audit
curl -I https://realsyncdynamicsai.de/audit
```

## Offen (Cloudflare-Dashboard, nicht per Repo lösbar)
Custom Domain `realsyncdynamicsai.de` sauber an das Pages-Projekt `realsyncdynamics-ai`
binden bzw. konkurrierende Worker-Route/Cache entfernen — Schritt-für-Schritt in
`CLOUDFLARE_DOMAIN_FIX.md`.

## MVP-Produktionsfähigkeit
- Über `pages.dev`: **ja** — vollständig funktionsfähig.
- Über `realsyncdynamicsai.de`: **nein**, solange der Apex-500 besteht. Ein einziger
  Dashboard-Schritt (Domain-Bindung) trennt den aktuellen Zustand vom Livegang.

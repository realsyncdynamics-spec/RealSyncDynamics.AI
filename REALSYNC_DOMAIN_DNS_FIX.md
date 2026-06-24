# Domain-Fix — realsyncdynamicsai.de: `ERR_NAME_NOT_RESOLVED` (Apex = NXDOMAIN)

Stand: 2026-06-24 · Symptom im Browser: **`net::ERR_NAME_NOT_RESOLVED`** auf
`https://realsyncdynamicsai.de/` („Webseite nicht verfügbar").

> **Zustandsänderung gegenüber den älteren Diagnosen.** `CLOUDFLARE_DOMAIN_FIX.md`
> und `REALSYNC_DOMAIN_EDGE_DIAGNOSIS.md` beschreiben den vorherigen Zustand
> **`Apex = HTTP 500`** (Worker-/Binding-Split-Brain). Dieser ist **vorbei** — der
> Apex liefert keinen 500 mehr, weil er **gar nicht mehr aufgelöst** wird: der
> A/AAAA-Record für `@` fehlt komplett (NXDOMAIN). Vermutlich wurde beim Versuch,
> den 500 zu beheben, die Pages-Custom-Domain-Bindung bzw. der Apex-Record
> entfernt — zurück blieb ein Apex **ohne jeden DNS-Eintrag**.

## Ergebnis in einem Satz
Die **Apex-Domain hat keinen DNS-Record** (→ `ERR_NAME_NOT_RESOLVED`), und **`www`
zeigt noch auf das alte GitHub Pages**, das per `301` ausgerechnet auf den toten
Apex weiterleitet. Der **Soll-Origin** (Cloudflare Pages, `realsyncdynamics-ai.pages.dev`)
ist gesund. Es ist ein **DNS-/Domain-Bindungs-Problem in Cloudflare, kein Repo-Fehler.**

## Gemessen (2026-06-24)
```
# Apex — kein DNS-Record:
getent ahosts realsyncdynamicsai.de            → (leer / NXDOMAIN)

# www — Cloudflare-Proxy-IPs, aber Origin noch GitHub Pages:
getent ahosts www.realsyncdynamicsai.de        → 104.21.31.200, 172.67.179.238 (Cloudflare)
curl -I https://www.realsyncdynamicsai.de/      → HTTP/2 301  location: https://realsyncdynamicsai.de/
                                                  server: cloudflare
                                                  x-github-request-id: …   via: 1.1 varnish
                                                  x-served-by: cache-iad…  x-fastly-request-id: …
   ↑ GitHub-Pages-/Fastly-Signatur → www-Origin ist NOCH GitHub Pages, nicht Cloudflare Pages.

# Soll-Origin — gesund:
getent ahosts realsyncdynamics-ai.pages.dev    → 172.66.44.153, 172.66.47.103 (Cloudflare Pages)
curl -I https://realsyncdynamics-ai.pages.dev/  → HTTP/2 200  content-type: text/html
                                                  strict-transport-security: max-age=31536000; …
```

## Ziel-Architektur (bestätigt, aus `deploy/cloudflare-pages/README.md`)
```
Cloudflare Nameserver → Cloudflare DNS → Cloudflare Pages (Projekt „realsyncdynamics-ai")
   ├─ Apex  realsyncdynamicsai.de       (proxied, Custom Domain → Active)
   └─ www   www.realsyncdynamicsai.de   (proxied, Custom Domain → Active; weg von GitHub Pages)
```
Beide Hostnamen müssen **identisch zu `realsyncdynamics-ai.pages.dev` (200)** antworten.

---

## Fix (Cloudflare-Dashboard — Account-Aktion, bewusst nicht automatisiert)

> Diese Schritte erfordern Cloudflare-Account-/Dashboard-Zugriff (Zone
> `realsyncdynamicsai.de` + Pages-Projekt `realsyncdynamics-ai`). Sie lassen sich
> nicht aus dem Repo heraus ausführen — eine DNS-/Domain-Bindung ist eine
> Account-Aktion. **Nur** den nativen Cloudflare-Pfad nutzen — **nicht** über
> Drittanbieter (Entri/`goentri.com`, Canva, Rebrandly).

### 1. Apex als Pages-Custom-Domain (neu) binden — behebt den NXDOMAIN
1. Cloudflare → **Workers & Pages** → Projekt **`realsyncdynamics-ai`** → **Custom domains**.
2. **Set up a domain** → `realsyncdynamicsai.de` → **Activate**.
   - Cloudflare legt den **Apex-DNS-Record automatisch an** (proxied, oranger Cloud)
     und bindet ihn an das Pages-Projekt. Genau dieser Record fehlt aktuell.
3. Warten bis Status **Active** (nicht „Pending/Verifying/Error" stehen lassen).

### 2. `www` von GitHub Pages auf Cloudflare Pages umstellen
`www` löst zwar auf, liefert aber noch GitHub Pages (301 → toter Apex). Umstellen:
1. Im selben Pages-Projekt → **Custom domains** → **Set up a domain** → `www.realsyncdynamicsai.de` → **Activate**.
2. **DNS → Records**: den alten **`www`-CNAME auf `*.github.io`** (GitHub Pages) **entfernen** —
   sonst bleibt der alte Origin aktiv. Den von Pages erzeugten `www`-Record belassen.

### 3. DNS-Records gegenprüfen (DNS → Records)
- `@` (Apex): genau **ein** von der Pages-Bindung erzeugter, **proxied** Record. Kein manueller
  A/AAAA auf GitHub-Pages-IPs (`185.199.108–111.153`), Vercel oder Worker.
- `www`: **proxied**, auf Cloudflare Pages — **kein** `github.io`-CNAME mehr.
- `TXT`/SPF (`…hostinger.com`) **stehen lassen** (nur Mail, unkritisch).
- Nameserver = `*.ns.cloudflare.com`.

### 4. Split-Brain ausschließen (falls nach Bindung noch Fehler statt sauberem 200)
- **Worker-Routes**: keine Route `realsyncdynamicsai.de/*` / `…/audit*` auf einen
  Platzhalter-Worker (das war die 500-Ursache im Vorzustand).
- **Andere/alte Pages-Projekte**: `realsyncdynamicsai.de` darf **nur** in
  `realsyncdynamics-ai` als Custom Domain stehen.
- **Rules** (Redirect/Configuration/Cache/Origin/Transform): nichts, das Apex/`www` abfängt.

### 5. SSL/TLS + Cache
- **SSL/TLS → Overview → Full (strict)**; **Always Use HTTPS = On**.
- **Caching → Configuration → Purge Everything** (stale Edge-Artefakte ausschließen).
- Pages → **Deployments** → letztes `main`-Deployment → **Retry** (oder leerer `main`-Commit).

---

## Verifikation (nach den Schritten)
```bash
# DNS muss jetzt auflösen:
getent ahosts realsyncdynamicsai.de            # → Cloudflare-Proxy-IPs, NICHT mehr leer

# Beide Hostnamen müssen 200 liefern, identisch zu pages.dev:
curl -I https://realsyncdynamicsai.de/
curl -I https://www.realsyncdynamicsai.de/     # → 200 (KEIN 301 mehr, KEINE github/fastly-Header)
curl -I https://realsyncdynamics-ai.pages.dev/ # Referenz: 200

# Repo-Diagnose-/Smoke-Tooling:
npm run diagnose:domain                          # voller Header-/Body-Report beide Bases
SMOKE_STRICT_APEX=1 npm run smoke:production      # nach Bindung: Apex blockierend
```
**Erwartung danach:** Apex löst auf · `www` und Apex liefern `HTTP/2 200`,
`content-type: text/html`, mit HSTS-Header · keine GitHub-Pages-/Fastly-Header mehr.

## Reihenfolge / wahrscheinlichste Lösung
**Schritt 1** (Apex als Pages-Custom-Domain neu binden) behebt den eigentlichen
Browser-Fehler `ERR_NAME_NOT_RESOLVED`, weil dabei der fehlende Apex-DNS-Record
automatisch angelegt wird. **Schritt 2** beseitigt den verbleibenden Halb-Migrations-Zustand
(`www` noch auf GitHub Pages). Schritte 4–5 nur, falls nach der Bindung noch ein
500/Fehler statt sauberem 200 auftritt.

## Querverweise
- `deploy/cloudflare-pages/README.md` — Pages-Projekt + Custom-Domain-Setup (Soll-Zustand)
- `CLOUDFLARE_DOMAIN_FIX.md` · `REALSYNC_DOMAIN_EDGE_DIAGNOSIS.md` — Vorzustand (Apex = 500)
- `scripts/diagnose-domain-routing.mjs` — `npm run diagnose:domain`

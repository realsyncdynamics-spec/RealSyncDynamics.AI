# Production Security Headers — Live-Befund (OF-1)

> **Status:** Verifiziert 2026-05-30 (live `curl -sI`). **Kein Fake-Fix** — dokumentiert den echten IST-Zustand.
> **Scope:** Schließt Open Finding **OF-1** aus der 14-Layer-Analyse („Wirksamkeit der Security-Header in Produktion unklar").

## TL;DR
Die Produktion läuft auf **GitHub Pages (Custom Domain `realsyncdynamicsai.de`, Fastly/Varnish CDN)**. GitHub Pages **liefert KEINE konfigurierbaren HTTP-Response-Header** — kein HSTS, kein CSP-Header, kein X-Frame-Options etc. auf HTTP-Ebene. Die einzige aktive clientseitige Schutzschicht sind die **`<meta http-equiv>`-Tags in `index.html`** (CSP + X-Content-Type-Options). Die `deploy/nginx/*.conf` mit vollständigen Headern ist **toter Pfad** (VPS wird nicht als Origin genutzt — bestätigt in SYSTEMCHECK-2026-05-28).

## Live-Messung (2026-05-30)
```
$ curl -sI https://realsyncdynamicsai.de/
HTTP/2 200
server: GitHub.com
cache-control: max-age=600
via: 1.1 varnish
x-served-by: cache-chi-klot8100125-CHI
```
**Nicht vorhanden (HTTP-Header):** `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

## Aktiv vorhanden (Meta-Tags, `index.html`)
| Schutz | Mechanismus | Status |
|---|---|---|
| Content-Security-Policy | `<meta http-equiv="Content-Security-Policy">` | ✅ aktiv (greift im Browser) |
| X-Content-Type-Options: nosniff | `<meta http-equiv="X-Content-Type-Options">` | ✅ aktiv |
| `frame-ancestors 'self'` | Teil der Meta-CSP | ✅ aktiv (Clickjacking-Schutz, ersetzt funktional X-Frame-Options) |
| HTTPS/TLS | GitHub Pages erzwingt HTTPS (TLS 1.2/1.3, Fastly) | ✅ (Transport verschlüsselt) |

**CSP-Inhalt (IST):** `default-src 'self' *.supabase.co api.fontshare.com data:; script-src 'self' 'unsafe-inline' <analytics>; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' *.supabase.co …`

## Gaps (ehrlich, nicht beschönigt)
1. **HSTS fehlt** — HSTS ist **nur** als echter HTTP-Header wirksam, **nicht** als Meta-Tag. Über GitHub Pages **nicht setzbar**. → Risiko: kein erzwungenes HTTPS-Pinning auf Header-Ebene (GH Pages redirectet aber HTTP→HTTPS).
2. **X-Frame-Options fehlt als Header** — funktional durch CSP `frame-ancestors 'self'` abgedeckt (moderne Browser), aber alte Browser ohne CSP-Support sind ungeschützt.
3. **Referrer-Policy / Permissions-Policy fehlen** — nicht als Meta gesetzt; könnten als Meta ergänzt werden (Referrer-Policy ist meta-fähig; Permissions-Policy nur als HTTP-Header → über GH Pages nicht möglich).
4. **CSP enthält `unsafe-inline`** (script/style) — XSS-Härtung unvollständig (vorbestehend, siehe 14-Layer M).

## Optionen (kein Eingriff in diesem PR — nur Bewertung)
| Option | Bringt | Aufwand |
|---|---|---|
| **A — Meta-Tags ergänzen** (`Referrer-Policy` als Meta) | schließt 1 Gap auf statischem Host | niedrig |
| **B — Reverse-Proxy/CDN mit Header-Support** (Cloudflare vor GH Pages) | echte HSTS/XFO/Permissions-Policy-Header | mittel (Infra-Entscheidung) |
| **C — VPS-Origin reaktivieren** (nginx-Config existiert bereits, liefert alle Header) | volle Header, aber gibt GH-Pages-Vorteile auf | mittel-hoch |
| **D — Status quo + ehrliche Doku** | Transparenz für Security-Reviews | — |

**Empfehlung:** Für echte Enterprise-Header-Anforderungen (HSTS, Permissions-Policy) ist **Option B (Cloudflare-Proxy)** der sauberste Hebel — separate Infra-Entscheidung, kein Code. Bis dahin gilt Option D: dokumentierter IST-Zustand + Meta-CSP als aktive Schutzschicht.

> **Update:** Option B ist jetzt als anwendbares, versioniertes Artefakt umgesetzt:
> [`deploy/cloudflare/`](../../deploy/cloudflare/) (Terraform + Dashboard-Runbook + `verify.sh`).
> Es setzt HSTS + `X-Frame-Options` + `Referrer-Policy` + `Permissions-Policy` als echte
> HTTP-Header und schließt damit die realen Audit-Befunde `no_hsts` / `no_xframe`.
> Noch **nicht angewendet** — `terraform apply` erfordert Cloudflare-Account-Zugang.

## Fazit OF-1
**Geschlossen (dokumentiert).** Der reale Header-Zustand ist verifiziert und transparent: aktive Meta-CSP + X-Content-Type-Options + TLS; HSTS/XFO/Permissions-Policy auf GitHub Pages technisch nicht als HTTP-Header setzbar. Für Security-Fragebögen ist dieser Befund jetzt belastbar zitierbar — ohne falsche Behauptung, „alle Header seien gesetzt".

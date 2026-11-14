# Befund: Apex liefert ein eingefrorenes Dokument — 2026-11-14

Stand: 2026-11-14 · Messung aus Container-Edge (Colo IAD/ORD/YYZ) ·
**ersetzt die Diagnose in** `apex-still-on-github-pages-2026-06-25.md`

## Ergebnis in einem Satz

`realsyncdynamicsai.de` liefert weiterhin **nicht** den deployten Build — die
Ursache ist aber **nicht mehr die vom 25.06.**: der GitHub-Pages/Fastly-Origin ist
verschwunden. Heute antwortet die Apex mit **einem einzigen, eingefrorenen
5.699.744-Byte-Dokument für fast jeden Pfad**, während drei Slugs per Redirect
**von der Marken-Domain weg** auf `realsyncdynamics-ai.pages.dev` zeigen.

## Herkunftsnachweis

Pipelines sind grün und aktuell — das Problem liegt ausschließlich am Edge:

- `Deploy to Cloudflare Pages` #3681 · success · `0e94717` (= `main` HEAD am 09.11.)
- `realsyncdynamics-ai.pages.dev` liefert den aktuellen Build; der Asset-Hash
  wanderte zwischen 09.11. und 14.11. von `index-v7q17Blt.js` auf
  `index-CseJttin.js`, die Apex blieb unverändert.

### Messung (GET mit Redirect-Folge, inhaltsbasiert klassifiziert)

`ALT` = Antwort enthält `__bundler`-Markup · `BUILD` = Antwort enthält `id="root"`

| Pfad | Bytes | Inhalt | URL nach Redirect |
|---|---|---|---|
| `/` | 5.699.744 | **ALT** | Apex |
| `/pricing` | 183.968 | BUILD | **`pages.dev/pricing`** |
| `/pricing/` | 5.699.744 | **ALT** | Apex |
| `/audit` | 18.250 | BUILD | **`pages.dev/audit`** |
| `/audit/` | 5.699.744 | **ALT** | Apex |
| `/login` | 122.256 | BUILD | **`pages.dev/login`** |
| `/app` | 5.699.744 | **ALT** | Apex |
| `/security` | 5.699.744 | **ALT** | Apex |
| `/assets/index-CseJttin.js` | 5.698.630 | **ALT** | Apex |

## Was sich gegenüber dem 25.06. geändert hat

| | 25.06. | 14.11. |
|---|---|---|
| Origin-Signatur | `via: 1.1 varnish`, `x-served-by: cache-iad-*`, `x-cache: HIT` | **keine** (0 Treffer) |
| `last-modified` | `Tue, 23 Jun 2026 15:25:54 GMT` | **nicht gesetzt** |
| Ausgeliefert | älterer Vite-Build (anderer JS-Hash) | **`__bundler`-Dokument, kein Vite-Build** |
| Header | `cache-control: max-age=600` (Fastly) | `cf-cache-status: DYNAMIC`, `max-age=0` |

Damit sind **Punkt 1 und 2 des dortigen Fixes gegenstandslos**: es gibt keine
A-Records auf `185.199.108–111.153` mehr zu entfernen, und GitHub Pages ist als
Fallback weg — der im Juni dokumentierte **Notfall-Rollback existiert nicht mehr**.

## Aktiver Blocker

`cf-cache-status: DYNAMIC` **ohne** das `s-maxage=86400`, das das Pages-Projekt auf
`pages.dev` setzt, plus ein Catch-all über alle Pfade inklusive `/assets/*.js`:
das ist die Signatur einer vorgeschalteten Worker-/Redirect-Regel, nicht des
Pages-Projekts. Dazu passt der Worker `realsyncdynamics`
(Tag `727038e34f594668be9d57bd30d34d96`, zuletzt geändert **2026-06-08**).

Das ist **Punkt 3** des Juni-Fixes („keine Route `realsyncdynamicsai.de/*` darf
greifen") — jetzt der einzige verbliebene. Eine Custom-Domain-Bindung allein
behebt es nicht: eine greifende Worker-Route verdeckt das Pages-Projekt
unabhängig vom DNS.

Gleiche Konsequenz für `cloudflare-domain-cutover.yml`: der Workflow löscht nur
Records, die auf GitHub Pages bzw. `github.io`/`pages.dev` zeigen, und bindet die
Domain. Beides adressiert den heutigen Zustand nicht. Er ist zudem genau **einmal**
gelaufen (25.06., `failure` nach 9 s) — `CLOUDFLARE_API_TOKEN` ist in Actions
weiterhin nicht gesetzt.

## Auswirkung

Startseite und `/app` sind das eingefrorene Dokument; Assets werden als dieses
HTML ausgeliefert, sodass die SPA von der Apex aus nicht booten kann. Die drei
funktionierenden Slugs funktionieren nur, indem sie den Nutzer **auf
`*.pages.dev` umleiten** — die Marken-Domain bleibt dabei nicht in der Adresszeile.

## Nächste Schritte (Cloudflare-Dashboard, nicht aus CI möglich)

1. **Workers & Pages → Routes:** Route(n) auf `realsyncdynamicsai.de/*` entfernen
   oder auf das Pages-Projekt umhängen. Vorher prüfen, was der Worker
   `realsyncdynamics` sonst bedient.
2. **Rules → Redirects:** die Regeln entfernen, die `/pricing`, `/audit`, `/login`
   auf `pages.dev` umleiten — eine korrekt gebundene Domain braucht sie nicht.
3. **Pages → `realsyncdynamics-ai` → Custom domains:** Apex und `www` als
   **Active** verifizieren.
4. **Caching → Purge Everything.**

### Verifikation

```bash
npm run diagnose:domain
SMOKE_STRICT_APEX=1 npm run smoke:production
# Erwartet: Apex liefert denselben Asset-Hash wie pages.dev,
# /assets/*.js mit content-type application/javascript (nicht text/html),
# und kein Redirect der Apex auf *.pages.dev.
```

## Nicht geprüft

Welche Route bzw. Regel konkret greift, ist von außen nicht feststellbar; die
verfügbare Cloudflare-Schnittstelle (als deprecated markiert) liefert weder
Worker-Routes noch Pages-Custom-Domains. Punkte 1–4 sind Produktionsänderungen an
Domain und DNS und damit nach `AGENTS.md` einzelfreigabepflichtig — hier bewusst
nicht ausgeführt.

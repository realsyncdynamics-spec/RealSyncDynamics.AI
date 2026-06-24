# Domain-/Edge-Diagnose — realsyncdynamicsai.de vs pages.dev

Stand: 2026-06-23 · Tool: `npm run diagnose:domain` (`scripts/diagnose-domain-routing.mjs`)

## Ergebnis in einem Satz
`realsyncdynamics-ai.pages.dev` wird **Pages-direkt** sauber ausgeliefert (alle Routen
`200`), während `realsyncdynamicsai.de` über die **Cloudflare-Zonen-/Edge-Schicht** läuft
und dort auf **allen** Routen `HTTP 500` erzeugt. Es ist ein **Edge-/Domain-Level-Split-Brain**,
kein React-Router-/Repo-Fehler.

## Gemessene Header (GET und HEAD, identisch)

### pages.dev — ✅ alle Routen
```
status=200  content-type=text/html; charset=utf-8  server=cloudflare
cf-cache-status= (nicht gesetzt)   cache-control=public, max-age=0, must-revalidate
```
Gilt für `/ /pricing /pricing/ /audit /audit/ /login /app` — HEAD wie GET.

### apex realsyncdynamicsai.de — ❌ alle Routen
```
status=500  content-type=(leer)  content-length=0  server=cloudflare
cf-cache-status=DYNAMIC   cache-control=(nicht gesetzt)
```
Gilt für `/ /pricing /pricing/ /audit /audit/ /login /app` — HEAD wie GET. Leerer Body.

## Warum das ein Edge-/Domain-Problem ist (und kein React-Router-Fehler)

1. **`/audit` lädt auf pages.dev mit 200** (HEAD + GET). Wäre der React-Router/Lazy-Import
   defekt, wäre `/audit` auch dort kaputt. Ist er nicht.
2. **Der Apex-500 ist uniform** über alle 7 Routen — ein Routen-spezifischer Code-Fehler
   würde nicht ausnahmslos jede URL identisch treffen.
3. **Header-Signatur unterscheidet sich systematisch:**
   - pages.dev: **kein** `cf-cache-status`, dafür `cache-control` → klassische **Pages-Direkt-Auslieferung**.
   - apex: **`cf-cache-status: DYNAMIC`**, kein `cache-control`, leerer 500-Body → die Anfrage
     traversiert die **Zonen-CDN-/Worker-Schicht** und trifft dort einen Handler, der 500 wirft.
   Eine korrekt an das Pages-Projekt gebundene Custom Domain würde **identisch zu pages.dev**
   antworten (gleiche Header, 200). Tut sie nicht → die Bindung ist nicht sauber/aktiv, oder
   eine andere Zonen-Komponente fängt den Hostnamen ab.
4. Der 500-Body ist **leer** (`content-length: 0`) → kein Cloudflare-Branded-Error,
   kein App-Stacktrace. Konsistent mit „Edge-Handler erreicht, liefert aber nichts Gültiges".

## Zur widersprüchlichen Messung („Root/Pricing teils erreichbar, /audit Cache-miss")
Von hier (Colo ORD) sind **alle** Apex-Routen 500. Eine Fremdmessung sah Root/Pricing teils
mit Inhalt und nur `/audit` als „Cache miss". Beides zusammen **bestätigt die Split-Brain-These**:
ein instabiler/teil-propagierter Bindungs- oder Cache-Zustand liefert je nach Edge-PoP und
Cache-Key unterschiedliche Resultate. Das ist **kein** stabiles, weltweit konsistentes
Custom-Domain-Verhalten — und genau das muss zuerst behoben werden.

## Repo-Status (bestätigt — Ursache hier ausgeschlossen)
| Prüfpunkt | Ergebnis |
|---|---|
| `public/404.html` entfernt | ✓ (PR #674) |
| `public/_redirects` vorhanden | ✓ |
| `/*  /index.html  200` | ✓ |
| `/audit`-Route existiert | ✓ `<Route path="/audit" element={<AuditLanding />} />` |
| `/audit` im Production-Build | ✓ — `realsyncdynamics-ai.pages.dev/audit` (= deployter `main`-Build) liefert 200 |
| `/audit` auf pages.dev | ✓ 200 (HEAD + GET) |
| `functions/` · `_worker.js` | nicht vorhanden → kein dynamischer Worker/SSR im Repo |

## Zu prüfende Cloudflare-Komponenten (Dashboard, Account `deb7c163…`)
Reihenfolge nach Wahrscheinlichkeit:

1. **Pages → Projekt `realsyncdynamics-ai` → Custom domains**
   - Ist `realsyncdynamicsai.de` gebunden und Status **Active**? (Nicht „Error/Pending".)
   - Falls in Error → entfernen und neu hinzufügen. `www` ebenso prüfen.
2. **Worker Routes / alte Worker** (Split-Brain-Hauptverdacht wegen `cf-cache-status: DYNAMIC`)
   - Keine Route `realsyncdynamicsai.de/*`, `realsyncdynamicsai.de/audit*`, `*.realsyncdynamicsai.de/*`
     darf auf einen Worker (z. B. Platzhalter `realsyncdynamics` „Hello world") zeigen.
   - Verdächtig: Eine Worker-Route, die 500 wirft, würde genau diese DYNAMIC-500-Signatur erzeugen.
3. **Alte/zweite Pages-Projekte** — `realsyncdynamicsai.de` als Custom Domain woanders registriert? → entfernen.
4. **DNS → Records** — Apex/`www` proxied auf Cloudflare-Pages; **kein** manueller A/AAAA/CNAME
   auf Vercel/Worker/Fremd-Origin. SPF-TXT (`…hostinger.com`) stehen lassen.
5. **Rules** — Redirect Rules · Configuration Rules · Cache Rules · Origin Rules · Transform Rules:
   nichts, das den Apex/`…/audit` abfängt oder auf einen toten Origin leitet.
6. **SSL/TLS** — Modus **Full (strict)**; **Always Use HTTPS** an; Trailing-Slash-Regeln prüfen.
7. **Caching → Purge Everything** (500 kam mit `cache=DYNAMIC` — stale Artefakte ausschließen).
8. **Pages → Deployments → letztes `main`-Deployment → Retry** (oder leerer `main`-Commit).
9. Danach erneut: `SMOKE_STRICT_APEX=1 npm run smoke:production` und `npm run diagnose:domain`.

## Verifikation
```bash
npm run diagnose:domain                          # voller Header-/Body-Report beide Bases
npm run smoke:production                          # pages.dev erforderlich, Apex advisory
SMOKE_STRICT_APEX=1 npm run smoke:production      # nach Bindung: Apex blockierend
```

## Fazit
- **Repo sauber?** Ja.
- **pages.dev sauber?** Ja, vollständig.
- **Apex kaputt?** Ja — uniform 500, Edge-/Zonen-Schicht.
- **Fehler im Repo oder Cloudflare?** **Cloudflare** (Custom-Domain-Binding / Worker-Route / Cache).
- **Zwingende Dashboard-Schritte?** Schritte 1–2 oben sind die heißesten Kandidaten; 7–8 zum Abschluss.

Solange `realsyncdynamicsai.de` standort-/routenabhängig 500/Cache-miss liefert, ist Arbeit an
Buttons, Checkout oder Audit-Backend zweitrangig — zuerst die Domain-Edge-Schicht stabilisieren.

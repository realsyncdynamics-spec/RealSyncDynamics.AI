# Cloudflare-Domain-Fix — realsyncdynamicsai.de (HTTP 500 → 200)

Ziel-Architektur (bestätigt):
`Cloudflare Nameserver → Cloudflare DNS → Cloudflare Pages (realsyncdynamics-ai) → realsyncdynamicsai.de`

Symptom: `realsyncdynamicsai.de` liefert auf **allen** Routen `HTTP 500`
(`cf-cache-status: DYNAMIC`, leerer Body), während `realsyncdynamics-ai.pages.dev`
alle Routen mit `200` ausliefert. Das ist ein **Edge-/Domain-Bindungs-Problem**, kein
Repo-Problem (Repo-Befund: siehe `REALSYNC_LIVE_ROUTING_STATUS.md`).

> Diese Schritte erfordern Cloudflare-Dashboard-Zugriff. Sie sind bewusst NICHT
> automatisiert — eine Domain-/DNS-Bindung ist eine Account-Aktion.
> **Ausschließlich** den nativen Pfad nutzen — **nicht** über Drittanbieter
> (Entri/`goentri.com`, Canva, Rebrandly).

## 1. Pages-Custom-Domain prüfen/binden (häufigste Ursache)
1. Cloudflare → **Workers & Pages** → Projekt **`realsyncdynamics-ai`** → Tab **Custom domains**.
2. Steht `realsyncdynamicsai.de` dort?
   - **Nicht vorhanden** → **Set up a domain** → `realsyncdynamicsai.de` → **Activate**. Danach `www` wiederholen.
   - **Vorhanden, aber Status ≠ „Active"** (Error/Pending/Verifying) → **entfernen und neu hinzufügen**. Ein in Error hängender Eintrag erzeugt genau diesen 500.
3. **Production branch** des Projekts = `main` sicherstellen (Settings → Builds & deployments).

## 2. Split-Brain ausschließen — zeigt der Apex auf DIESES Projekt?
Es darf **nur ein** Cloudflare-Service den Hostnamen bedienen.
1. **Andere Pages-Projekte** prüfen: Ist `realsyncdynamicsai.de` versehentlich als Custom
   Domain in einem **anderen** Pages-Projekt registriert? Falls ja → dort entfernen,
   nur in `realsyncdynamics-ai` belassen.
2. **Worker-Routes** prüfen: Workers & Pages → **Worker `realsyncdynamics`** (Platzhalter
   „Hello world") → Settings → **Domains & Routes**. Es darf **keine** Route wie
   `realsyncdynamicsai.de/*` oder `realsyncdynamicsai.de/audit*` existieren. Falls doch →
   **Route entfernen** (oder den Platzhalter-Worker löschen, wenn ungenutzt).
3. Zone → **Rules → Overview**: keine alte **Redirect-/Rewrite-Rule** auf `…/audit*` o. Ä.

## 3. DNS prüfen
Cloudflare → **DNS → Records**:
- `@` (Apex) und `www`: proxied (oranger Cloud), kein **manueller** A/AAAA/CNAME, der
  nicht von der Pages-Bindung stammt. Manuelle Dummy-Records blockieren die Pages-Domain
  → entfernen. `TXT` (SPF `…hostinger.com`) **stehen lassen** (nur Mail, unkritisch).
- Nameserver müssen `*.ns.cloudflare.com` sein (sind sie: `clyde`/`bella`).

## 4. SSL/TLS
Cloudflare → **SSL/TLS → Overview**: Modus **Full (strict)**. Für Pages-Origins korrekt;
„Flexible" kann mit dem Pages-HTTPS zu Schleifen/Fehlern führen.

## 5. Cache leeren + Deployment neu triggern
1. Zone → **Caching → Configuration → Purge Everything** (der 500 kam mit `cache=DYNAMIC`;
   ein Purge schließt stale Edge-Artefakte aus).
2. Pages-Projekt → **Deployments** → letztes `main`-Deployment → **Retry deployment**
   (oder leeren Commit auf `main` pushen).

## 6. Verifikation (nach den Schritten)
```bash
curl -I https://realsyncdynamicsai.de/
curl -I https://realsyncdynamicsai.de/pricing
curl -I https://realsyncdynamicsai.de/pricing/
curl -I https://realsyncdynamicsai.de/audit
curl -I https://realsyncdynamicsai.de/audit/

# Gesamtmatrix inkl. Apex blockierend:
SMOKE_STRICT_APEX=1 npm run smoke:production
```
Erwartung danach: alle Routen `HTTP/2 200`, `content-type: text/html`, identisch zu
`realsyncdynamics-ai.pages.dev`.

## Reihenfolge / wahrscheinlichste Lösung
In ~90 % löst **Schritt 1** (Custom Domain fehlt oder hängt in „Error" → neu binden) das
Problem. Bleibt es nach Bindung + Cache-Purge bei 500, ist es **Schritt 2** (konkurrierende
Worker-Route / Fremd-Pages-Projekt auf demselben Hostnamen).

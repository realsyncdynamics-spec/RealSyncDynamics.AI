# Cloudflare-Domain-Fix — realsyncdynamicsai.de (HTTP 500 → 200)

> ## ⏱️ UPDATE 2026-06-25 — HTTP-500 behoben; diese Anleitung ist GRÖSSTENTEILS überholt
>
> Der unten beschriebene **uniforme HTTP-500** existiert **nicht mehr**. Live verifiziert:
> `realsyncdynamicsai.de/` und Deep-Links (`/pricing/`, `/audit`) liefern **HTTP 200**.
>
> **Wichtig — die Ziel-Architektur unten stimmt nicht mehr mit dem Live-Zustand überein:**
> Der Apex wird aktuell **nicht** von Cloudflare Pages, sondern von **GitHub Pages**
> hinter dem Cloudflare-Proxy bedient (Header `x-github-request-id`, `via: 1.1 varnish`).
> Die Schritte 1–2 unten (Cloudflare-Pages-Custom-Domain neu binden) treffen den aktuellen
> Pfad daher **nicht**. Vor weiterer Arbeit zuerst entscheiden, ob der Apex bewusst auf
> **GitHub Pages** (Ist-Zustand) oder auf **Cloudflare Pages** (Ziel laut
> `deploy-cloudflare-pages.yml`) laufen soll — und nur **eine** Quelle binden.
>
> **Aktuelles offenes Problem ist nicht der 500, sondern DNSSEC** (Ursache des
> `DNS_LOOKUP_FAILED`-Screenshots): Die Zone ist DNSSEC-**signiert** (DNSKEY + gültige
> RRSIG), aber beim `.de`-Registrar (DENIC, via Hostinger) fehlt der **DS-Record**
> (`AD=false`). Solange das so ist, kann ein fehlender/abweichender DS bei
> validierenden Resolvern zeitweise `SERVFAIL` → `DNS_LOOKUP_FAILED` erzeugen.
>
> ### Korrektur-Schritte (statt Schritt 1–2 unten)
> 1. **DNSSEC begradigen (zuerst):** Cloudflare → **DNS → Settings → DNSSEC** → DS-Record
>    kopieren und **exakt** bei **Hostinger (.de-Registrar) → Domain → DNSSEC** hinterlegen.
>    Wenn DNSSEC nicht gewünscht ist: in Cloudflare **deaktivieren** (Zone hört auf zu
>    signieren). **Nicht** halb-aktiviert lassen. Prüfen: `https://dnsviz.net/d/realsyncdynamicsai.de/dnssec/`
> 2. **Hosting-Ziel binden:** Apex an genau **eine** Quelle (GitHub Pages *oder* Cloudflare
>    Pages) binden; konkurrierende Bindungen/Worker-Routen entfernen (Schritt 2 unten bleibt
>    als Split-Brain-Checkliste gültig).
> 3. **Verifikation:** `npm run diagnose:domain` (jetzt inkl. DNSSEC-/DS-Check) und die
>    `curl`-Matrix in Abschnitt 6.
>
> Die Schritte 3–6 unten (DNS-Records, SSL/TLS Full(strict), Cache-Purge, Verifikation)
> bleiben als allgemeine Cloudflare-Hygiene gültig.
>
> ---
> _Historischer Stand (HTTP-500-Diagnose, überholt — zur Nachverfolgung erhalten):_

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

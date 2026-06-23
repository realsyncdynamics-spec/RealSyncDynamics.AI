# Cloudflare Domain Fix — `realsyncdynamicsai.de` liefert HTTP 500

> Ziel: Die Custom-Domain `realsyncdynamicsai.de` soll **identisch** zum gesunden
> `realsyncdynamics-ai.pages.dev` ausliefern (alle Routen `200` + HTML).
>
> Befund (siehe `REALSYNC_LIVE_ROUTING_STATUS.md`): `*.pages.dev` ist sauber,
> die **Custom-Domain liefert auf JEDER Route `500`** (leerer Body,
> `cf-cache-status: DYNAMIC`, kein Origin-Header). Der Request stirbt an der
> Cloudflare-Edge, bevor er das Pages-Projekt erreicht → **reines
> Domain-Binding-Problem, nicht im Repo lösbar.**

Die folgenden Schritte sind **im Cloudflare-Dashboard** auszuführen (nicht im Code).
Reihenfolge einhalten; nach jedem größeren Schritt mit den curl-Befehlen unten verifizieren.

## 1. Pages-Projekt öffnen
- Cloudflare Dashboard → **Workers & Pages** → Projekt **`realsyncdynamics-ai`**.
- Sicherstellen, dass das **letzte Production-Deployment „Success"** ist (nicht „Failed"/„Building").

## 2. Custom Domain prüfen / neu binden
- Projekt → Tab **Custom domains**.
- `realsyncdynamicsai.de` muss dort gelistet und im Status **`Active`** sein.
  - Status **`Error` / `Initializing` / `Pending`** → genau das verursacht den 500.
  - Lösung: Domain **entfernen** und über **„Set up a custom domain"** neu hinzufügen. Cloudflare legt dann den korrekten (proxied) DNS-Eintrag automatisch an.
- Kontrolle: Die Domain darf **nicht** an einem anderen/alten Pages-Projekt hängen. Genau **ein** Projekt darf `realsyncdynamicsai.de` beanspruchen — und zwar `realsyncdynamics-ai`.

## 3. Alte Worker-Routes prüfen (häufigste 500-Ursache)
- Dashboard → **Workers & Pages** → Zone `realsyncdynamicsai.de` → **Settings → Domains & Routes** bzw. **Workers Routes**.
- Suchen nach Routes wie:
  - `realsyncdynamicsai.de/*`
  - `*realsyncdynamicsai.de/*`
  - `realsyncdynamicsai.de/audit*`
- Jede Worker-Route, die die Apex (oder `/audit`) abfängt und auf einen Worker zeigt, der wirft / leer antwortet, erzeugt diesen `500`.
- **Aktion:** Solche Routes **löschen** (oder deaktivieren), damit Pages wieder ausliefert.
  - Hinweis: Es existiert ein Stub-Worker `realsyncdynamics` (`return new Response("Hello world")`). Der liefert zwar 200, gehört aber **nicht** vor die Domain — falls er per Route gebunden ist, Route entfernen.

## 4. DNS prüfen
- Dashboard → Zone `realsyncdynamicsai.de` → **DNS → Records**.
- Apex `realsyncdynamicsai.de`:
  - Bei Pages-Custom-Domain wird i. d. R. ein **CNAME** (geflattet) auf das Pages-Projekt gesetzt, **Proxied (oranger Cloud)**.
  - **Keine** veralteten `A`/`AAAA`-Einträge (z. B. alte GitHub-Pages-IPs `185.199.108–111.153`) und **keine** CNAMEs auf andere Ziele danebenstehen lassen — solche Reste verursachen Split-Brain.
- `www` darf weiterhin auf sein Ziel zeigen; relevant für den Funnel ist die Apex.

## 5. SSL/TLS-Modus prüfen
- Dashboard → Zone → **SSL/TLS → Overview**.
- Empfohlen für Pages: **Full** oder **Full (strict)**. Ein falscher Modus (z. B. „Flexible" gegen ein HTTPS-Origin oder Strict gegen ein nicht passendes Zertifikat) kann 5xx erzeugen.

## 6. Cache purgen
- Dashboard → Zone → **Caching → Configuration → Purge Everything**.
- Hintergrund: Der 500 hat `cf-cache-status: DYNAMIC` (also nicht aus Cache), aber nach dem Fix kann ein „Purge Everything" alte Fehlobjekte / `Cache miss`-Artefakte sicher ausräumen.

## 7. Deployment neu triggern
- Pages-Projekt → **Deployments** → letztes Production-Deployment → **Retry deployment**
  (oder leeren Commit auf `main` pushen, der die GitHub-Action `deploy-cloudflare-pages.yml` startet).

## 8. curl-Verifikation (nach dem Fix)

```bash
# Beide Bases müssen jetzt identisch 200 liefern:
for r in / /pricing /pricing/ /audit /audit/; do
  echo "== $r =="
  curl -sS -o /dev/null -w "pages.dev : %{http_code}\n" https://realsyncdynamics-ai.pages.dev$r
  curl -sS -o /dev/null -w "custom    : %{http_code}\n" https://realsyncdynamicsai.de$r
done

# Oder komfortabel:
npm run smoke:production          # erwartet: 14/14 OK, 0 Base-Deltas
```

Erwartetes Ergebnis nach dem Fix: **Beide Spalten `200`**, `npm run smoke:production` meldet **0 Base-Deltas**.

## Checkliste

- [ ] Pages-Projekt `realsyncdynamics-ai` hat erfolgreiches Production-Deployment
- [ ] `realsyncdynamicsai.de` als Custom Domain **Active** an genau diesem Projekt
- [ ] Keine alte Worker-Route auf `realsyncdynamicsai.de/*` oder `/audit*`
- [ ] DNS Apex = proxied CNAME auf Pages, keine veralteten A/AAAA-Reste
- [ ] SSL/TLS = Full / Full (strict)
- [ ] Cache „Purge Everything" ausgeführt
- [ ] Deployment neu getriggert
- [ ] `npm run smoke:production` → 14/14 OK, 0 Deltas

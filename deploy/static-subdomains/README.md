# Static Sub-Domains — `cdn` / `preview` / `schemas`

Single nginx-Container hinter dem bestehenden Host-Traefik. Bringt drei
Static-Hosting-Routes online:

| Sub-Domain                          | Verwendung                                 | Cache               |
|-------------------------------------|--------------------------------------------|---------------------|
| `cdn.realsyncdynamicsai.de`         | Public CDN (Consent-SDK, JS/CSS-Bundles)   | immutable für `/v{N}/`, 5 min sonst |
| `preview.realsyncdynamicsai.de`     | Rebuild-Workflow-Previews (Phase 2)        | `no-store`, `noindex` |
| `schemas.realsyncdynamicsai.de`     | JSON-Schema-Dokumente (`$id`-Targets)      | ETag, 1 h           |

## 1. DNS-Records setzen (Hostinger-Panel)

Drei zusätzliche `A`-Records auf den VPS:

```
cdn       A    187.77.89.1     TTL 300
preview   A    187.77.89.1     TTL 300
schemas   A    187.77.89.1     TTL 300
```

Verifizieren (Resolver Cloudflare, umgeht lokales DNS-Caching):

```bash
for sub in cdn preview schemas; do
  echo -n "$sub.realsyncdynamicsai.de → "
  dig +short "$sub.realsyncdynamicsai.de" @1.1.1.1
done
```

Erwartet: jede Zeile gibt `187.77.89.1` zurück.

## 2. VPS-Disk-Layout anlegen

```bash
sudo mkdir -p /srv/realsyncdynamicsai/{cdn,preview,schemas}
sudo chown -R www-data:www-data /srv/realsyncdynamicsai
sudo chmod -R 0755 /srv/realsyncdynamicsai
```

Empfohlene Pfad-Struktur:

```
/srv/realsyncdynamicsai/
├── cdn/
│   └── consent/
│       └── v1/                          ← /v{N}/ → immutable Cache
│           ├── consent.js
│           └── consent.css              (falls separates Stylesheet gewünscht)
├── schemas/
│   ├── annex-iii/v1.json
│   ├── tracker-registry/v1.json
│   └── ai-info/v1.json
└── preview/
    └── <rebuild_id>/
        ├── index.html
        ├── llms.txt
        ├── api/ai-info.json
        └── assets/…
```

`cdn/consent/v1/` ist im Repo unter `deploy/static-subdomains/content/cdn/`
versioniert (gespiegelt aus `public/sdk/cookie-consent.js`). Schema-Dokumente
für `schemas/` werden separat geschrieben — die `$id`-URLs im Code zeigen
aktuell auf noch nicht existierende Files; das ist legal nach
JSON-Schema-Spec, aber Tooling, das den `$id` resolvet, scheitert.
Follow-up: pro `$id` ein passendes Schema-Dokument anlegen.

## 3. Stack hochfahren

```bash
cd deploy/static-subdomains
cp .env.example .env
# TRAEFIK_NETWORK + TRAEFIK_CERT_RESOLVER an Werte aus
# deploy/ollama-traefik/.env angleichen — beides muss exakt übereinstimmen.

docker compose up -d
docker compose logs -f static-assets
```

Traefik forderts die LE-Certs automatisch an, sobald die ersten HTTPS-Hits
auf die drei Hosts kommen (HTTP-01-Challenge geht über entrypoint `web`,
das bei deinem Host-Traefik bereits konfiguriert ist).

## 4. Content befüllen

Initiales Content-Set aus dem Repo synchronisieren:

```bash
# vom Repo-Root, lokal
rsync -avz --delete \
  deploy/static-subdomains/content/cdn/ deploy:/srv/realsyncdynamicsai/cdn/
```

`schemas/` ist initial leer — die Schema-Dokumente werden in einem
Follow-up-PR authored. `preview/` wird vom Rebuild-Workflow zur Laufzeit
befüllt und bleibt ebenfalls initial leer.

## 5. Smoke-Test

```bash
# Health
curl -sI https://cdn.realsyncdynamicsai.de/healthz | head -3
curl -sI https://schemas.realsyncdynamicsai.de/healthz | head -3
curl -sI https://preview.realsyncdynamicsai.de/healthz | head -3

# Schema (sollte Content-Type application/schema+json liefern)
curl -sI https://schemas.realsyncdynamicsai.de/annex-iii/v1.json | grep -i content-type

# CORS-Preflight für cdn (sollte Access-Control-Allow-Origin: * liefern)
curl -s -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -I https://cdn.realsyncdynamicsai.de/consent/v1/consent.js | grep -i access-control
```

## Optional: Consent-SDK auf `cdn` migrieren

Der Rebuild-Workflow injiziert das Consent-SDK aktuell von der Apex
(`realsyncdynamicsai.de/sdk/cookie-consent.js`). Wenn du auf `cdn.*`
migrieren willst:

1. SDK nach `/srv/realsyncdynamicsai/cdn/consent/v1/consent.js` kopieren
   (idealerweise aus der CI heraus, nicht manuell — Versionsskew vermeiden).
2. `supabase/functions/_shared/website-rebuild/inject-consent.ts` von
   `realsyncdynamicsai.de/sdk/cookie-consent.js` auf
   `cdn.realsyncdynamicsai.de/consent/v1/consent.js` umstellen.
3. Apex-SDK-Pfad als Compatibility-Shim stehen lassen (alte Embeds laufen
   weiter), oder per 301-Redirect ins `cdn` umleiten.

Solange `cdn.*` keinen DNS-Eintrag hat, bleibt die Apex-Variante der einzige
funktionsfähige Pfad.

## Rollback

```bash
cd deploy/static-subdomains
docker compose down
# Disk-Inhalte bleiben unter /srv/realsyncdynamicsai/ erhalten —
# manuell entfernen wenn gewünscht.
```

DNS-Einträge können im Hostinger-Panel zurückgenommen werden; Traefik gibt
die LE-Certs nach 90 Tagen automatisch frei (oder explizit per
`acme.json`-Cleanup).

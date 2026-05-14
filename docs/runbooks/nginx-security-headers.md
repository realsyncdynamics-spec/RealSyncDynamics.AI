# Hostinger Nginx — Security Headers installieren

Adressiert Befunde **1 (HSTS)** und **4 (X-Frame-Options)** aus
`docs/compliance/findings-2026-05-14.md`. Einmaliger manueller Schritt
auf dem Hostinger-VPS, danach in `realsyncdynamicsai.de` HTTP-Antworten
permanent vorhanden.

## Pre-Check

```bash
curl -I https://realsyncdynamicsai.de | grep -iE 'strict-transport|x-frame|permissions-policy|referrer|x-content'
```

Vor dem Patch: nur `referrer-policy` + `x-content-type-options` aus den
`<meta>`-Equivalenten in `index.html`. HSTS, X-Frame-Options,
Permissions-Policy fehlen.

## Install

SSH auf den VPS (`ssh root@187.77.89.1`):

```bash
# 1. Snippet aus dem Repo in nginx-snippets ablegen
sudo cp /var/www/realsyncdynamicsai.de/repo/infra/nginx/security-headers.conf \
        /etc/nginx/snippets/realsync-security-headers.conf

# 2. Includes im vhost-Block aktivieren (in /etc/nginx/sites-available/realsyncdynamicsai.de):
#    server {
#        listen 443 ssl http2;
#        server_name realsyncdynamicsai.de;
#        ...
#        include /etc/nginx/snippets/realsync-security-headers.conf;
#        ...
#    }
sudo nano /etc/nginx/sites-available/realsyncdynamicsai.de   # include-Zeile vor der `location / { ... }` einfügen

# 3. Syntax-Check + reload
sudo nginx -t && sudo systemctl reload nginx
```

## Verifikation

```bash
curl -I https://realsyncdynamicsai.de
```

Erwartete neue Header:

```
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-frame-options: SAMEORIGIN
x-content-type-options: nosniff
permissions-policy: accelerometer=(), camera=(), geolocation=(), ...
referrer-policy: strict-origin-when-cross-origin
```

## HSTS-Preload-Liste

Wenn die Site eine Weile mit `preload` läuft (alle Sub-Domains HTTPS-only,
mindestens 1 Jahr `max-age`):

1. https://hstspreload.org/ → Domain einreichen
2. Chromium/Firefox-Listen aktualisieren sich nach Review (~Wochen)
3. Danach kommt jeder Besucher direkt mit HTTPS, ohne dass der Server
   den HSTS-Header zurücksenden muss.

## Rollback

```bash
sudo rm /etc/nginx/snippets/realsync-security-headers.conf
sudo nano /etc/nginx/sites-available/realsyncdynamicsai.de   # include-Zeile entfernen
sudo nginx -t && sudo systemctl reload nginx
```

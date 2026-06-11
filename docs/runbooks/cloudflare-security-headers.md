# Cloudflare vor GitHub Pages — Security-Header aktivieren

Adressiert die Befunde **F1 (HSTS)**, **F2 (X-Frame-Options)**,
**F8 (echte CSP)** und **Permissions-/Referrer-Policy** aus dem
Tiefentest-Bericht 2026-05-29.

## Warum diese Variante

`realsyncdynamicsai.de` läuft aktuell auf **GitHub Pages**. GitHub Pages
erlaubt keine Custom-HTTP-Header. Die `<meta http-equiv>`-Fallbacks in
`index.html` sind funktional limitiert (kein HSTS, kein X-Frame-Options).

**Cloudflare als Reverse-Proxy vor GitHub Pages** schließt die Lücke,
ohne den Hosting-Stack zu wechseln. Kein neuer Build, keine Migration.

- DNS bleibt unter Cloudflare-Verwaltung
- TLS bleibt von GitHub Pages (Let's Encrypt auf Custom Domain)
- Cloudflare setzt zusätzlich HSTS + Security-Header per Transform-Rule
- Kostenlos auf dem Free-Plan

## Pre-Check

```bash
curl -I https://realsyncdynamicsai.de | grep -iE 'strict-transport|x-frame|permissions-policy|content-security-policy'
```

Erwartung vor Setup: alle vier Header fehlen.

## Setup (einmalig, ~20 min)

### 1. Cloudflare-Account + Zone

1. Account auf <https://dash.cloudflare.com/sign-up> (kostenlos, EU-Region).
2. **Add a Site** → `realsyncdynamicsai.de` eingeben, Free-Plan auswählen.
3. Cloudflare scannt bestehende DNS-Records — bitte gegen aktuellen
   DNS-Provider abgleichen, nichts überschreiben was Cloudflare nicht erkennt.
4. Wesentliche Records (für GitHub Pages):
   - `A`/`AAAA` für `@` → GitHub Pages IPs (185.199.108.153 … 111.153)
   - `CNAME` `www` → `<user>.github.io`
   - Alle MX/TXT-Records (E-Mail, DKIM, SPF, DMARC) **unverändert übernehmen**
5. Proxy-Status (Wolke): **orange (Proxied)** für `@` und `www`.
   E-Mail-Records (`MX`, SPF/DKIM/DMARC) bleiben **grau (DNS only)**.

### 2. Nameserver umstellen

Cloudflare zeigt zwei Nameserver wie `xxx.ns.cloudflare.com`. Diese im
DNS-Panel des aktuellen Registrars (z. B. Hostinger, Strato, GoDaddy)
als neue Nameserver eintragen.

Propagation: 1–24 h. `dig ns realsyncdynamicsai.de` zeigt nach Switch
die Cloudflare-NS.

### 3. SSL/TLS-Modus

Cloudflare-Dashboard → `realsyncdynamicsai.de` → **SSL/TLS → Overview**.

- Mode: **Full** (NICHT „Flexible", das brichtet GitHub-Pages-TLS).
- **Edge Certificates → Always Use HTTPS**: ON.
- **Edge Certificates → HSTS** unten (siehe Schritt 4).

### 4. HSTS aktivieren (Befund F1)

**SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS)** → **Enable HSTS**:

- **Max Age**: `12 months` (entspricht `max-age=31536000`).
- **Apply HSTS policy to subdomains (includeSubDomains)**: ON.
- **Preload**: erst aktivieren, wenn sicher ist, dass auch alle
  Sub-Domains HTTPS-only sind. Für jetzt: OFF.
- **No-Sniff Header**: ON (entspricht `X-Content-Type-Options: nosniff`).

Bestätigen.

### 5. Transform-Rule für die übrigen Header (Befunde F2/F8 + Permissions/Referrer)

Cloudflare-Dashboard → **Rules → Transform Rules → Modify Response Header → Create rule**.

- **Rule name**: `realsyncdynamics-security-headers`
- **When incoming requests match**: `Hostname` equals `realsyncdynamicsai.de`
  (optional: zusätzlich `OR www.realsyncdynamicsai.de`).
- **Then → Modify response header**: füge die folgenden Einträge per
  „Set static" hinzu (Action: `Set`):

| Header-Name | Wert |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()` |
| `Content-Security-Policy` | siehe nächster Abschnitt |

`Strict-Transport-Security` **nicht** hier setzen — Cloudflare verwaltet
ihn ab Schritt 4 selbst.

Speichern + **Deploy**.

### 6. CSP-Wert (Befund F8)

Die aktuell im `index.html` per `<meta>` gesetzte CSP enthält
`'unsafe-inline'` und externe Tracker-Hosts. Cloudflare-CSP übernimmt
denselben Wert als HTTP-Header und macht sie wirksam (CSP kann via
HTTP-Header Mechanismen wie `frame-ancestors`, die Meta nicht
unterstützt). Wert eintragen:

```
default-src 'self' https://*.supabase.co https://api.fontshare.com data:;
script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com https://www.google-analytics.com https://*.tiktok.com https://snap.licdn.com;
style-src 'self' 'unsafe-inline' https://api.fontshare.com;
img-src 'self' data: https:;
font-src 'self' https://*.fontshare.com data:;
connect-src 'self' https://*.supabase.co https://*.fontshare.com https://www.google-analytics.com https://*.tiktok.com;
frame-ancestors 'self';
base-uri 'self';
form-action 'self';
```

**Härter machen (F8-Folge-PR):** `'unsafe-inline'` aus `script-src`
entfernen, sobald alle Inline-Scripts via Nonce/Hash signiert sind.
Aktuell wäre der Browser sonst broken — Härtung in eigenem PR.

### 7. Verify

```bash
./scripts/check-security-headers.sh https://realsyncdynamicsai.de
```

Erwartet (alle MUST-Header `[OK]`):

```
[OK]  strict-transport-security: max-age=31536000; includeSubDomains
[OK]  x-frame-options: SAMEORIGIN
[OK]  x-content-type-options: nosniff
[OK]  referrer-policy: strict-origin-when-cross-origin
[OK]  permissions-policy: accelerometer=(), camera=(), ...
[OK]  content-security-policy: default-src 'self' ...
```

## Dauerüberwachung

`.github/workflows/security-headers-check.yml` läuft täglich gegen
Produktion und schlägt fehl, wenn ein Pflicht-Header fehlt oder einen
abweichenden Wert hat. Bei Cloudflare-Konfig-Drift (z. B. jemand
deaktiviert die Transform-Rule) entsteht ein Failure-Issue.

## Rollback

Falls Cloudflare im Notfall raus muss:

1. **DNS → SSL/TLS → Edge Certificates → HSTS** auf `Disabled` setzen
   *(sonst bleibt HSTS in Browsern für die volle Max-Age erhalten)*.
2. Cloudflare-Wolken auf grau (DNS only) stellen.
3. Nameserver beim Registrar zurück auf den vorherigen DNS-Provider.

**Warnung:** HSTS-Preload (Schritt 4) ist **NICHT** trivial
rückgängig zu machen. Daher bewusst zunächst NICHT aktivieren.

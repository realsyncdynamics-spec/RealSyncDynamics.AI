# Cloudflare-Proxy vor dem VPS — echte Security-Header

> **Zweck:** Setzt zusätzliche HTTP-Response-Header und schließt damit die
> zwei **realen** Audit-Befunde aus dem `gdpr-audit`-Scan:
>
> | Audit-Befund | Header | Mechanismus hier |
> |---|---|---|
> | `no_hsts` | `Strict-Transport-Security` | SSL/TLS-Setting (HSTS) |
> | `no_xframe` | `X-Frame-Options` | Response-Header-Transform-Rule |
>
> Kontext & Begründung: [`docs/security/production-headers.md`](../../docs/security/production-headers.md) (Open Finding **OF-1**, „Option B"). Werte konsistent zu [`deploy/nginx/realsyncdynamicsai.de.conf`](../nginx/realsyncdynamicsai.de.conf).

## Infrastruktur-Übersicht

- **Domain:** `realsyncdynamicsai.de`
- **Nameserver:** `bella.ns.cloudflare.com` / `clyde.ns.cloudflare.com`
  (DNS-Zone liegt vollständig bei Cloudflare, nicht mehr bei Hostinger)
- **Cloudflare:** DNS + Proxy + Security-Layer (HSTS, Transform-Rules)
- **Origin:** Hostinger-VPS `72.61.89.191`, ausgeliefert via nginx
  (siehe [`deploy/README.md`](../README.md) und
  [`deploy/nginx/realsyncdynamicsai.de.conf`](../nginx/realsyncdynamicsai.de.conf))

GitHub Pages ist **kein** produktiver Origin mehr.

---

## Voraussetzungen (einmalig, im Cloudflare-Dashboard)

1. **Domain in Cloudflare aufnehmen** (`realsyncdynamicsai.de`) — Nameserver
   beim Registrar (Hostinger) sind bereits auf Cloudflare umgestellt.
2. **DNS-Records auf den VPS zeigen lassen — jeweils _proxied_ (oranger Cloud-Icon):**
   - A-Record `@` → `72.61.89.191`
   - A-Record `www` → `72.61.89.191`
3. **SSL/TLS-Modus = „Full"** (Dashboard → SSL/TLS → Overview), sobald auf
   dem VPS ein gültiges TLS-Zertifikat (certbot) für `realsyncdynamicsai.de`
   + `www` vorliegt — sonst „Full" ohne „strict" zwischenzeitlich.
   ⚠️ NICHT „Flexible" — sonst Redirect-Schleife mit dem nginx-HTTPS-Redirect.

> Solange die Records **nicht proxied** sind (graue Wolke), greifen weder
> Transform Rules noch HSTS — dann bleiben `no_hsts`/`no_xframe` bestehen.

---

## Anwenden — Variante A: Terraform (empfohlen, reproduzierbar)

```bash
cd deploy/cloudflare
cp terraform.tfvars.example terraform.tfvars   # zone_id eintragen
export CLOUDFLARE_API_TOKEN=<token>            # Zone:Settings-Edit + Transform-Rules-Edit

terraform init
terraform plan      # Review: 1 zone_settings_override + 1 ruleset
terraform apply
```

Erzeugt:
- `cloudflare_zone_settings_override.security` — HSTS (`max-age=31536000;
  includeSubDomains; preload`), `always_use_https`, `nosniff`.
- `cloudflare_ruleset.security_headers` — `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

### Provider-Version
Die Configs nutzen **v4-Syntax** (`cloudflare/cloudflare ~> 4.40`). Bei
Provider **v5** heißen die Ressourcen anders (`cloudflare_zone_setting` statt
`cloudflare_zone_settings_override`); Pin in `main.tf` dann anpassen.

---

## Anwenden — Variante B: Dashboard-Klickpfad (ohne Terraform)

**HSTS:** SSL/TLS → Edge Certificates → **HTTP Strict Transport Security
(HSTS)** → Enable:
- Max Age: `12 months` · Include subdomains: ✅ · Preload: ✅ · No-Sniff: ✅
- Außerdem: **Always Use HTTPS** = On.

**Übrige Header:** Rules → **Transform Rules** → *Modify Response Header* →
„Create rule", `If incoming requests match… = All incoming requests`, dann
*Set static* je Header:
| Header | Wert |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

> Cloudflare lässt `Strict-Transport-Security` **nicht** als Transform-Rule
> zu — dafür ist zwingend die HSTS-Einstellung oben zuständig.

---

## Verifizieren

```bash
./verify.sh                                   # default: https://realsyncdynamicsai.de
# oder explizit:
./verify.sh https://realsyncdynamicsai.de
```
Grün hier = die Header liegen live an = ein erneuter `/audit`-Scan zeigt
**kein** `no_hsts` und **kein** `no_xframe` mehr. Erwarteter Score danach:
~100/100 (die übrigen vier Befunde waren bereits Engine-Falsch-Positive,
behoben in der `gdpr-audit`-Engine).

---

## CSP-Hinweis (bewusst kein Header hier)

`index.html` liefert eine wirksame `<meta http-equiv="Content-Security-Policy">`.
Ein zusätzlicher CSP-**Header** würde mit der Meta-CSP zur **restriktivsten
Schnittmenge** kombiniert → Risiko blockierter Assets. Wenn die Meta-CSP
künftig entfernt wird, kann in `main.tf` ein `Content-Security-Policy`-Header
(inkl. `frame-ancestors 'self'`) ergänzt werden — dann ist `X-Frame-Options`
sogar redundant.

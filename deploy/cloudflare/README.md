# Cloudflare-Proxy vor GitHub Pages — echte Security-Header

> ## ⛔ DEPRECATED (Stand 2026-06-25) — NICHT mehr anwenden
>
> Diese Anleitung beschreibt den **Legacy-Pfad** „Cloudflare-Proxy **vor**
> GitHub Pages" (Apex-A-Records auf GitHub-Pages-IPs `185.199.108–111.153`,
> `www → *.github.io`). Genau diese Konfiguration ist die **Ursache des
> aktuellen Split-Brains**: Die Live-Domain serviert dadurch weiter einen
> eingefrorenen GitHub-Pages-Build, während der aktuelle Stand auf
> `realsyncdynamics-ai.pages.dev` liegt. Wer diese Records (re-)setzt, **stellt
> das Problem wieder her.**
>
> **Maßgeblich ist stattdessen:**
> - Deploy: [`deploy/cloudflare-pages/README.md`](../cloudflare-pages/README.md)
>   + `.github/workflows/deploy-cloudflare-pages.yml`
> - Cutover/Fix: [`docs/infra/cloudflare-pages-cutover.md`](../../docs/infra/cloudflare-pages-cutover.md)
>   und [`docs/infra/apex-still-on-github-pages-2026-06-25.md`](../../docs/infra/apex-still-on-github-pages-2026-06-25.md)
>
> Die Security-Header (HSTS, `X-Frame-Options`) werden im Pages-Setup über
> `public/_headers` ausgeliefert — kein Proxy-vor-GH-Pages nötig. Der restliche
> Text bleibt nur noch zu Referenzzwecken erhalten.

> **Zweck:** Setzt die HTTP-Response-Header, die GitHub Pages prinzipiell
> nicht liefern kann, und schließt damit die zwei **realen** Audit-Befunde
> aus dem `gdpr-audit`-Scan:
>
> | Audit-Befund | Header | Mechanismus hier |
> |---|---|---|
> | `no_hsts` | `Strict-Transport-Security` | SSL/TLS-Setting (HSTS) |
> | `no_xframe` | `X-Frame-Options` | Response-Header-Transform-Rule |
>
> Kontext & Begründung: [`docs/security/production-headers.md`](../../docs/security/production-headers.md) (Open Finding **OF-1**, „Option B"). Werte konsistent zu [`deploy/nginx/realsyncdynamicsai.de.conf`](../nginx/realsyncdynamicsai.de.conf).

GitHub Pages liefert **keine** konfigurierbaren Header. HSTS und
`X-Frame-Options` wirken **nur** als echte HTTP-Header (nicht als `<meta>`).
Ein Cloudflare-Proxy vor GitHub Pages ist der sauberste Hebel ohne den
GitHub-Pages-Workflow aufzugeben.

---

## Voraussetzungen (einmalig, im Cloudflare-Dashboard)

1. **Domain in Cloudflare aufnehmen** (`realsyncdynamicsai.de`) und die
   Nameserver beim Registrar auf die von Cloudflare zugewiesenen umstellen.
2. **DNS-Records auf GitHub Pages zeigen lassen — jeweils _proxied_ (oranger Cloud-Icon):**
   - Apex `realsyncdynamicsai.de` → vier A-Records auf die GitHub-Pages-IPs:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www` → `CNAME` auf `<org-oder-user>.github.io`
3. **SSL/TLS-Modus = „Full"** (Dashboard → SSL/TLS → Overview).
   ⚠️ NICHT „Flexible" — das erzeugt mit dem GitHub-Pages-HTTPS-Redirect eine
   Redirect-Schleife.
4. Die Datei [`public/CNAME`](../../public/CNAME) (= `realsyncdynamicsai.de`)
   bleibt unverändert — GitHub Pages braucht sie weiterhin.

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

## DNSSEC aktivieren

> Voraussetzung: Domain nutzt bereits die **Cloudflare-Nameserver** (siehe
> Voraussetzungen oben, Punkt 1). Liegt die Domain noch (auch teilweise) bei
> den DNS-Servern des Registrars (z. B. Hostinger), kann Cloudflare DNSSEC
> nicht aktivieren — dann zuerst vollständig auf Cloudflare-DNS migrieren.

### Schritt 1 — DNSSEC in Cloudflare aktivieren

```bash
cd deploy/cloudflare
terraform apply   # erzeugt cloudflare_zone_dnssec.dnssec
terraform output dnssec_ds_record
terraform output dnssec_key_tag
terraform output dnssec_algorithm
terraform output dnssec_digest_type
terraform output dnssec_digest
```

Alternativ im Dashboard: **DNS → DNSSEC → Enable DNSSEC**.

Der Status springt danach auf:

> „Pending while we wait for the DS to be added at your registrar"

Das ist **erwartet** — Cloudflare hat die Schlüssel erzeugt, der DS-Record
fehlt aber noch beim Registrar.

### Schritt 2 — DS-Record beim Registrar hinterlegen

Im Registrar-Interface (z. B. Hostinger → Domain → DNS/DNSSEC) den DS-Record
mit den o.g. Werten (Key Tag, Algorithm, Digest Type, Digest) eintragen.

### Schritt 3 — Propagation abwarten

Nach korrektem DS-Eintrag wechselt der Status üblicherweise innerhalb von
**15 Minuten bis 24 Stunden** von `Pending` auf `Active`.

### Troubleshooting

| Symptom | Ursache | Fix |
|---|---|---|
| Status bleibt `Pending` > 24h | DS-Record fehlt/falsch beim Registrar | Werte aus `terraform output` mit Registrar-Eintrag abgleichen |
| Cloudflare bietet DNSSEC gar nicht an | Domain liegt noch (teilweise) bei Registrar-DNS | DNSSEC deaktivieren, Domain vollständig zu Cloudflare migrieren, Nameserver umstellen, danach erneut aktivieren |
| Seite nach DNSSEC-Aktivierung nicht erreichbar | DS-Record falsch eingetragen (Validierungsfehler) | DS-Record beim Registrar löschen, mit korrekten Werten neu eintragen |

## CSP-Hinweis (bewusst kein Header hier)

`index.html` liefert eine wirksame `<meta http-equiv="Content-Security-Policy">`.
Ein zusätzlicher CSP-**Header** würde mit der Meta-CSP zur **restriktivsten
Schnittmenge** kombiniert → Risiko blockierter Assets. Wenn die Meta-CSP
künftig entfernt wird, kann in `main.tf` ein `Content-Security-Policy`-Header
(inkl. `frame-ancestors 'self'`) ergänzt werden — dann ist `X-Frame-Options`
sogar redundant.

# Cloudflare Phase B — Operator-Runbook

> **Phase A (Nameserver-Cutover) ist abgeschlossen** (live seit 2026-06-14).  
> NS: `bella.ns.cloudflare.com` / `clyde.ns.cloudflare.com` ✅  
> Apex A-Record: `172.67.179.238`, `104.21.31.200` (Cloudflare Anycast, proxied) ✅  
> Traffic-Flow: Browser → Cloudflare Edge → GitHub Pages (Fastly) ✅  
>
> Dieses Runbook deckt die ausstehenden Schritte (Phase B) ab.

---

## Status-Übersicht (Stand 2026-06-14, live verifiziert)

| Schritt | Status | Nachweise |
|---|---|---|
| Nameserver auf Cloudflare | ✅ Done | `NS realsyncdynamicsai.de → bella/clyde.ns.cloudflare.com` |
| Apex A-Record (proxied) | ✅ Done | A → `172.67.179.238`, `104.21.31.200` |
| www → Redirect auf Apex | ✅ Done | `HEAD https://www.realsyncdynamicsai.de/ → 301` |
| HSTS (`Strict-Transport-Security`) | ❌ Fehlt | kein Header in `curl -sI https://realsyncdynamicsai.de/` |
| X-Frame-Options | ❌ Fehlt | kein Header |
| Referrer-Policy / Permissions-Policy | ❌ Fehlt | kein Header |
| SSL/TLS-Modus = Full | ⚠ unbekannt | im Dashboard prüfen |
| MX-Records | ❌ Fehlt | `ENODATA` — E-Mail nicht konfiguriert |
| CAA-Records | ❌ Fehlt | `ENODATA` |
| DNSSEC | ❌ Offen | DS-Record bei Hostinger eintragen (nach CF-Aktivierung) |

---

## Schritt 1 — SSL/TLS-Modus auf „Full" setzen

**Cloudflare Dashboard** → Deine Zone `realsyncdynamicsai.de` → **SSL/TLS → Overview**  
→ Modus auf **Full** setzen (NICHT Flexible — erzeugt Redirect-Loop mit GitHub Pages HTTPS).

> „Full (strict)" ist ebenfalls möglich, da GitHub Pages ein gültiges Zertifikat
> für die Custom Domain ausstellt.

---

## Schritt 2 — HSTS + Security-Header (Terraform — empfohlen)

Die Terraform-Konfiguration ist bereits vollständig vorbereitet unter
`deploy/cloudflare/main.tf` + `deploy/cloudflare/README.md`.

```bash
cd deploy/cloudflare
cp terraform.tfvars.example terraform.tfvars
# zone_id eintragen (Cloudflare Dashboard → Deine Zone → Overview → Zone ID)

export CLOUDFLARE_API_TOKEN=<token>
# Benötigte Token-Berechtigungen:
#   Zone → Zone Settings: Edit
#   Zone → Transform Rules: Edit
# Token erstellen: dash.cloudflare.com → Profile → API Tokens → Create Token

terraform init
terraform plan    # prüfen: 1 zone_settings_override + 1 ruleset
terraform apply
```

Was `terraform apply` setzt:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `always_use_https = on`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**Verifizieren nach Apply:**
```bash
./deploy/cloudflare/verify.sh
# oder manuell:
curl -sI https://realsyncdynamicsai.de/ | grep -iE "strict-transport|x-frame|referrer|permissions"
```

Erwartetes Ergebnis nach Apply: `npm run qa:governance` → 5/6 (Tracker-Consent bleibt offen).

---

## Schritt 2 alternativ — Dashboard-Klickpfad (ohne Terraform)

Falls kein API-Token verfügbar:

**HSTS:**
Cloudflare Dashboard → SSL/TLS → **Edge Certificates** → HTTP Strict Transport Security (HSTS) → Enable:
- Max Age: `12 months`
- Include subdomains: ✅
- Preload: ✅
- No-Sniff: ✅

Außerdem: **Always Use HTTPS** = On (gleiche Seite).

**Übrige Header:**
Dashboard → **Rules → Transform Rules** → Modify Response Header → Create rule:
- Bedingung: _All incoming requests_
- Action: _Set static_

| Header | Wert |
|---|---|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |

> Cloudflare blockiert `Strict-Transport-Security` als Transform Rule — nur via HSTS-Setting oben möglich.

---

## Schritt 3 — MX-Records (falls E-Mail gewünscht)

Aktuell keine MX-Records gesetzt (`ENODATA`). Falls `@realsyncdynamicsai.de`
für E-Mail genutzt werden soll, MX-Records im Cloudflare DNS-Panel eintragen.

Beispiel für Google Workspace:
```
MX  realsyncdynamicsai.de  ASPMX.L.GOOGLE.COM    priority 1
MX  realsyncdynamicsai.de  ALT1.ASPMX.L.GOOGLE.COM  priority 5
...
```
Für andere Provider: entsprechende MX-Werte des Providers verwenden.

Ergänzend SPF-TXT-Record:
```
TXT  realsyncdynamicsai.de  "v=spf1 include:<provider> ~all"
```

---

## Schritt 4 — CAA-Records (Zertifikats-Pinning)

Empfohlen, um unautorisierten Zertifikats-Ausstellungen vorzubeugen:

```
CAA  realsyncdynamicsai.de  0 issue "letsencrypt.org"
CAA  realsyncdynamicsai.de  0 issue "pki.goog"          # falls Google-Cert
CAA  realsyncdynamicsai.de  0 issuewild ";"              # wildcard blocken
```

Im Cloudflare DNS-Panel als CAA-Record-Typ hinzufügen.

---

## Schritt 5 — DNSSEC

**Im Cloudflare Dashboard:**
Dashboard → Deine Zone → **DNS → Settings** → DNSSEC → Enable

Cloudflare zeigt danach einen **DS-Record** (Key-Tag, Algorithm, Digest-Type, Digest).

**Bei Hostinger eintragen:**
Hostinger-Panel → Domains → `realsyncdynamicsai.de` → DNS/Nameserver → DNSSEC →
DS-Record-Werte aus Cloudflare eintragen.

> Propagation: bis zu 24–48h. Danach mit Online-DNSSEC-Analyser prüfen
> (z.B. dnsviz.net oder dnssec-analyzer.verisignlabs.com).

---

## Schritt 6 — Tracker-Consent (offener Governance-Befund)

`npm run qa:governance` meldet auch nach Phase B noch ein FAIL:
```
✗ cookie-scan · keine nicht-konformen Tracker ohne Consent-Manager
  → 1 Tracker ohne Consent-Gating: TikTok Pixel (consent_manager_detected=false)
```

**Ursache:** `index.html` CSP referenziert `analytics.tiktok.com` in `script-src`/`connect-src`.
Kein Consent-Manager (z.B. Cookiebot, CookiePro) aktiv.

**Fix-Optionen:**
1. Consent-Manager integrieren (Cookiebot o.ä.) — TikTok Pixel lädt erst nach Zustimmung.
2. TikTok Pixel vollständig entfernen, wenn kein aktiver Marketing-Use-Case.

Dies ist ein eigenständiger DSGVO/ePrivacy-Befund und kein Cloudflare-DNS-Thema.

---

## Finale Verifikation

Nach Abschluss aller Schritte:

```bash
# Security-Header live
curl -sI https://realsyncdynamicsai.de/ | grep -iE "strict-transport|x-frame|referrer|permissions"

# QA Governance (erwartet 5/6 nach Phase B, 6/6 nach Tracker-Consent-Fix)
npm run qa:governance

# DNS-Record-Check
node -e "require('dns').resolveNs('realsyncdynamicsai.de',(e,a)=>console.log(a))"
node -e "require('dns').resolve4('realsyncdynamicsai.de',(e,a)=>console.log(a))"
```

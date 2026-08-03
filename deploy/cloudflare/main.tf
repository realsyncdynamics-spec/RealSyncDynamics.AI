/**
 * Cloudflare-Proxy vor GitHub Pages — echte HTTP-Security-Header.
 *
 * Schließt die zwei realen (kein-Engine-Artefakt) Audit-Befunde, die GitHub
 * Pages prinzipiell nicht setzen kann:
 *   - `no_hsts`   → Strict-Transport-Security (HSTS)
 *   - `no_xframe` → X-Frame-Options (Clickjacking)
 *
 * Hintergrund: docs/security/production-headers.md (OF-1) empfiehlt genau
 * diesen Weg (Option B). GitHub Pages liefert keine konfigurierbaren
 * Response-Header; ein Cloudflare-Proxy davor schon.
 *
 * WICHTIG — HSTS:
 *   Cloudflare BLOCKIERT das Setzen von `Strict-Transport-Security` über
 *   Transform Rules. HSTS wird ausschließlich über die dedizierte
 *   SSL/TLS-Einstellung (`security_header`) aktiviert — daher unten in
 *   `cloudflare_zone_settings_override`, nicht im Ruleset.
 *
 * Provider: cloudflare/cloudflare ~> 4.x (v4-Syntax). Für v5 siehe README.
 *
 * Dieses Artefakt ist reviewbar versioniert, wird aber NICHT automatisch
 * angewendet — `terraform apply` erfordert Cloudflare-Account-Zugang
 * (zone_id + API-Token mit Zone-Edit-Rechten). Siehe README.md.
 */

terraform {
  required_version = ">= 1.5"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}

provider "cloudflare" {
  # API-Token via Env: export CLOUDFLARE_API_TOKEN=...
  # Scope: Zone → Zone Settings:Edit, Zone → Transform Rules:Edit
}

# ── 1) HSTS + Always-HTTPS (zone-weite SSL/TLS-Settings) ──────────────────
# HSTS lässt sich NUR hier setzen, nicht via Transform Rule.
resource "cloudflare_zone_settings_override" "security" {
  zone_id = var.cloudflare_zone_id

  settings {
    always_use_https = "on"
    # SSL „full" reicht (GitHub Pages liefert gültiges Zertifikat für die
    # Custom Domain). „strict" ist möglich, wenn das Cert sauber validiert.
    ssl = "full"

    security_header {
      enabled            = true
      max_age            = 31536000 # 1 Jahr
      include_subdomains = true
      preload            = true
      nosniff            = true
    }
  }
}

# ── 1b) DNSSEC aktivieren ──────────────────────────────────────────────
# Erzeugt die DNSSEC-Schlüssel der Zone. Cloudflare zeigt den Status danach
# als "Pending while we wait for the DS to be added at your registrar" —
# das ist erwartet. Der DS-Record (siehe outputs.tf) muss zusätzlich manuell
# beim Registrar (z. B. Hostinger) hinterlegt werden; das kann Terraform
# nicht automatisieren. Details: README.md, Abschnitt "DNSSEC aktivieren".
resource "cloudflare_zone_dnssec" "dnssec" {
  zone_id = var.cloudflare_zone_id
}

# ── 2) Übrige Security-Header (Response-Header-Transform-Ruleset) ─────────
# Werte spiegeln deploy/nginx/realsyncdynamicsai.de.conf für Konsistenz.
resource "cloudflare_ruleset" "security_headers" {
  zone_id = var.cloudflare_zone_id
  name    = "Security response headers"
  kind    = "zone"
  phase   = "http_response_headers_transform"

  rules {
    ref         = "set_security_headers"
    description = "Header, die GitHub Pages nicht setzen kann (XFO/Referrer/Permissions/XCTO)"
    expression  = "true" # alle Responses dieser Zone
    action      = "rewrite"

    action_parameters {
      headers {
        name      = "X-Frame-Options"
        operation = "set"
        value     = "SAMEORIGIN"
      }
      headers {
        name      = "X-Content-Type-Options"
        operation = "set"
        value     = "nosniff"
      }
      headers {
        name      = "Referrer-Policy"
        operation = "set"
        value     = "strict-origin-when-cross-origin"
      }
      headers {
        name      = "Permissions-Policy"
        operation = "set"
        value     = "camera=(), microphone=(), geolocation=()"
      }
      # CSP hier NICHT gesetzt — aber aus einem anderen Grund als früher
      # dokumentiert. Der alte Kommentar sagte, die <meta>-CSP in index.html
      # sei ausreichend. Das gilt so nicht mehr:
      #
      #   - Der Live-Pfad ist Cloudflare Pages, und der liefert seit dem
      #     DSGVO-Hotfix einen echten CSP-Header aus `public/_headers`
      #     (am Deployment per curl verifiziert).
      #   - `frame-ancestors` war im <meta> ohnehin nie wirksam: die Direktive
      #     wird dort per Spezifikation ignoriert. Genau deshalb kam der
      #     Header dazu.
      #
      # Diese Datei beschreibt einen anderen Pfad: einen Cloudflare-Proxy vor
      # GitHub Pages. Wird der jemals aktiviert, MUSS die CSP hier ergänzt
      # werden — `public/_headers` wird ausschließlich von Cloudflare Pages
      # ausgewertet, GitHub Pages kann keine Header setzen.
      #
      # Beim Ergänzen: Meta-CSP und Header-CSP inhaltlich identisch halten
      # (plus `frame-ancestors`). Beide werden zur restriktivsten Schnittmenge
      # kombiniert; abweichende Policies blockieren sonst Assets. Siehe
      # README.md und COMPLIANCE_AUDIT_2026-07.md (M-3).
    }
  }
}

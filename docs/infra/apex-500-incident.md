# Incident: Produktions-Apex `realsyncdynamicsai.de` → HTTP 500 (P0)

Stand: 2026-06-23 · Status: **diagnostiziert, Fix erfordert Cloudflare-Zone-Zugriff**

## Symptom
- `https://realsyncdynamicsai.de/` (alle Pfade) → **HTTP 500**, leerer Body,
  `server: cloudflare`, `cf-cache-status: DYNAMIC`, `cf-ray: …` (kein GitHub-Header).
- `https://www.realsyncdynamicsai.de/` → **HTTP 301** → Apex, mit
  `x-github-request-id`, `via: 1.1 varnish`, `x-served-by: cache-*`, `x-cache: HIT`.
- `https://realsyncdynamics-ai.pages.dev/` → **HTTP 200** (gesund).

## Diagnose (gesichert)
1. **`www` = GitHub Pages direkt** (Fastly-Header) → DNS-only / grey cloud → gesund.
2. **Apex = Cloudflare-Proxy** (orange cloud), 500 **am Edge** — die Antwort
   erreicht GitHub Pages gar nicht (keine GitHub-/Fastly-Header, leerer Body).
3. **Terraform** (`deploy/cloudflare/`) managt **nur** Zone-Settings (`ssl="full"`,
   HSTS, Always-HTTPS) + Header-Transform-Ruleset — **nicht** die DNS-Records.
   Die A-Records werden **manuell** im Dashboard gepflegt → Drift möglich.
4. Im Account existiert ein **Worker `realsyncdynamics`** (erstellt 2026-06-08),
   Inhalt nur `return new Response("Hello world")`. Würde er den Apex *direkt*
   bedienen, käme `200 "Hello world"` — es kommt aber `500` leer. Der Worker ist
   also **nicht der Live-Handler**, aber zeitlich/namentlich verdächtig (dangling
   Route/Custom-Domain-Konflikt).

**Wahrscheinlichste Ursache:** Der Apex-Hostname ist am Cloudflare-Edge
mehrdeutig/kaputt gebunden — eine der folgenden Konstellationen erzeugt 500 mit
leerem Body bei `server: cloudflare`:
- Apex als **Worker-Route / Custom-Domain** für `realsyncdynamics` gebunden, in
  Fehlzustand; **oder**
- Apex als **Pages-Custom-Domain** (`realsyncdynamics-ai`) in SSL-pending/
  Konflikt-Zustand, während die A-Records auf GitHub Pages zeigen; **oder**
- fehlerhafte **Single-Redirect-/Transform-Rule** auf dem Apex.

(Nicht weiter eingrenzbar ohne Zone-/Routes-/Pages-Sicht — die hier verfügbaren
Cloudflare-MCP-Tools decken nur Workers/D1/KV/R2 ab, kein DNS/Routes/Pages.)

## Remediation-Runbook (Cloudflare-Dashboard-Zugriff nötig)

### Sofort-Wiederherstellung (Minuten, Verfügbarkeit > Header)
1. DNS → Apex `realsyncdynamicsai.de` auf die GitHub-Pages-IPs setzen und **auf
   DNS-only (grey cloud) schalten**:
   `185.199.108.153 · 185.199.109.153 · 185.199.110.153 · 185.199.111.153`
   → umgeht Proxy/Worker/Pages, Apex trifft GitHub Pages direkt wie `www` → 500 weg.
2. GitHub Pages: Custom Domain = `realsyncdynamicsai.de`, „Enforce HTTPS" aktiv
   (public/CNAME ist bereits korrekt gesetzt).

### Root-Cause-Fix (orange cloud + Security-Header behalten)
Am Apex-Hostname der Reihe nach prüfen/bereinigen:
1. **Workers → Routes / Triggers** des Workers `realsyncdynamics`: Binding auf
   `realsyncdynamicsai.de/*` bzw. Custom-Domain entfernen (Platzhalter darf den
   Apex nicht besitzen). Ungenutzten Worker ggf. löschen.
2. **Pages → realsyncdynamics-ai → Custom domains**: Apex nicht (oder nur valide)
   attachen — wenn der Apex aus GitHub Pages bedient wird, hier **nicht** attachen.
3. **Rules → Redirect/Transform Rules**: keine fehlerhafte Regel auf dem Apex.
4. A-Records = GitHub-Pages-IPs, **proxied (orange)**, **SSL/TLS = Full**.
5. `terraform apply` in `deploy/cloudflare/` (Zone-Settings + Header-Ruleset).

### Verifikation
```bash
curl -sI https://realsyncdynamicsai.de/        # erwartet: HTTP/2 200
bash deploy/cloudflare/verify.sh               # erwartet: alle 5 Security-Header ✅
```

## Bezug Audit-Engine
`deploy/cloudflare/verify.sh` spiegelt die gdpr-audit-Checks `no_hsts`/`no_xframe`.
Nach dem Fix verschwinden diese Befunde im `/audit`-Re-Scan.

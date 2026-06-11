# DNS-Inventar realsyncdynamicsai.de — Pre-Cloudflare-Migration

**Stand:** 2026-05-29 · **Quelle:** DNS-over-HTTPS via 1.1.1.1 (Cloudflare-Resolver, ungebiased gegenüber Ziel) · **Status:** Read-only Erhebung, keine Konfigurationsänderungen

## Zweck

Vollständiges, prüfbares Inventar der aktiven DNS-Records, **bevor** der
Nameserver-Wechsel von Hostinger-Parking-DNS auf Cloudflare durchgeführt
wird. Verhindert versehentlichen Mail-Verlust und SPF/DKIM/DMARC-Bruch.

## Aktueller Stand

### Apex `realsyncdynamicsai.de`

| Typ | TTL | Wert | Zweck |
|---|---|---|---|
| A | 14400 | 185.199.108.153 | GitHub Pages Edge |
| A | 14400 | 185.199.109.153 | GitHub Pages Edge |
| A | 14400 | 185.199.110.153 | GitHub Pages Edge |
| A | 14400 | 185.199.111.153 | GitHub Pages Edge |
| AAAA | — | (keine) | GitHub Pages liefert IPv6 nur über `www`-CNAME |
| NS | 86400 | `hermes.dns-parking.com.` | Hostinger DNS-Parking-NS |
| NS | 86400 | `artemis.dns-parking.com.` | Hostinger DNS-Parking-NS |
| MX | 14400 | `5 mx1.hostinger.com.` | Mail-Primary |
| MX | 14400 | `10 mx2.hostinger.com.` | Mail-Secondary |
| TXT (SPF) | 3600 | `v=spf1 include:_spf.mail.hostinger.com include:_spf.reach.hostinger.com ~all` | Mail-Versand legitimieren |
| CAA | — | **keine** | ⚠️ alle CAs dürfen Zertifikate ausstellen |
| SOA | 3600 | `hermes.dns-parking.com. dns.hostinger.com. 2026052801 …` | Zone-Authority |

### `www.realsyncdynamicsai.de`

| Typ | TTL | Wert |
|---|---|---|
| CNAME | 14400 | `realsyncdynamics-spec.github.io.` |
| A (via CNAME) | 3600 | 185.199.108-111.153 |

### Mail-Verifikation

| Name | Typ | Wert | Befund |
|---|---|---|---|
| `_dmarc` | TXT | `v=DMARC1; p=none` | ⚠️ **p=none ohne `rua=`/`ruf=`** — kein Schutz, keine Reports |
| `_domainkey` | TXT | leer | (nicht zu erwarten — kein DKIM auf Wildcard-Selektor) |
| `default._domainkey` | TXT | leer | DKIM-Selektor nicht aktiv |
| `google._domainkey` | TXT | leer | kein Google-Workspace |
| `hostingermail._domainkey` | TXT | leer | Hostinger-Standard-Selektor leer — DKIM-Status unklar |
| `hostingermail1._domainkey` | TXT | leer | dito |

**DKIM-Status nicht abschließend prüfbar via Public-DNS** — Hostinger
nutzt evtl. einen abweichenden Selektor (z. B. `hostinger`, `selector1`,
`mail`). Muss vor NS-Wechsel in der Hostinger-Konsole verifiziert werden,
sonst gehen DKIM-Signaturen nach Cloudflare-Cutover verloren.

### Aktive Sub-Domains

| Name | Typ | Wert |
|---|---|---|
| `autodiscover` | CNAME | `autodiscover.mail.hostinger.com.` → A 34.120.251.119 |

Probiert ohne Treffer: `app`, `api`, `admin`, `staging`, `dev`, `test`,
`auth`, `mail`, `imap`, `smtp`, `ftp`, `vpn`.

→ **Nur EINE aktive Mail-Subdomain** (`autodiscover`). Migrations-Risiko entsprechend klein.

## Kritische Befunde

| # | Befund | Schweregrad | Handlung |
|---|---|---|---|
| 1 | DMARC `p=none` ohne `rua=`/`ruf=` | hoch | Quick-Fix: `p=quarantine; rua=mailto:dmarc-reports@realsyncdynamicsai.de` |
| 2 | Kein CAA-Record | mittel | Empfehlung: `realsyncdynamicsai.de. CAA 0 issue "letsencrypt.org"` + `issuewild ";"` |
| 3 | DKIM-Selektor unbekannt | hoch (für Migration!) | In Hostinger-Konsole prüfen: welcher Selektor liefert DKIM? Wert exportieren |
| 4 | TTL 14400 (4 h) auf Apex/MX | informativ | Vor Cutover auf 300 senken (1 h vorher) für rascheres Rollback |

## Vorgesehene Cloudflare-Migration (Reihenfolge)

> **Vorab nichts ändern.** Reihenfolge strikt durchhalten.

1. **DMARC reparieren (vor allem anderen)**
   - Aktuell ist `p=none` ohne Reports — kein Schutz, kein Insight
   - Variante A (vorsichtig): `p=none; rua=mailto:dmarc@realsyncdynamicsai.de; ruf=mailto:dmarc@realsyncdynamicsai.de; fo=1`
   - Variante B (Härtung): `p=quarantine; rua=…; pct=10` (10 % Quarantäne als Sanftstart)
   - **Ausführungsort:** Hostinger-DNS-Panel — DMARC TXT-Record bearbeiten

2. **DKIM-Selektor identifizieren**
   - In Hostinger → E-Mail → DKIM-Konfiguration → Selektor + Public-Key notieren
   - Falls kein DKIM aktiv: jetzt aktivieren, Public-Key in Hostinger-DNS als TXT eintragen

3. **TTL-Reduktion (24 h vor Cutover)**
   - Apex A, www CNAME, MX, SPF, DMARC, autodiscover, DKIM-TXT → TTL auf 300
   - Erlaubt schnelles Rollback bei Problemen

4. **CAA-Record setzen (vor Cutover)**
   - `realsyncdynamicsai.de. CAA 0 issue "letsencrypt.org"`
   - `realsyncdynamicsai.de. CAA 0 issuewild ";"`
   - Lock-In auf Let's Encrypt (GitHub Pages + Cloudflare-Edge nutzen LE)

5. **Cloudflare-Zone anlegen, Records importieren**
   - Account anlegen (Free-Plan)
   - Domain `realsyncdynamicsai.de` hinzufügen
   - Records aus diesem Inventar 1:1 importieren:
     - 4× A `@` (GitHub Pages) — **Proxy: orange (Proxied)**
     - 1× CNAME `www` (GitHub Pages) — **Proxy: orange (Proxied)**
     - 2× MX — **Proxy: grau (DNS only)** — Mail darf nicht proxied werden
     - 1× SPF TXT — DNS only
     - 1× DMARC TXT — DNS only
     - 1× DKIM TXT (Selektor aus Schritt 2) — DNS only
     - 1× CNAME `autodiscover` — DNS only
     - 2× CAA — DNS only
   - SSL/TLS-Mode: **Full** (NICHT Flexible)

6. **Cloudflare-Preview testen vor NS-Switch**
   - Cloudflare-spezifische Test-Hostnames nutzen (Cloudflare-Doku)
   - `dig @<cloudflare-test-ns> realsyncdynamicsai.de` gegen die neue Zone
   - HTTPS-Antwort auf GitHub-Pages-Origin prüfen
   - Erst dann den Nameserver-Wechsel beim Domain-Registrar einleiten

7. **Nameserver wechseln**
   - Beim Registrar (vermutlich Hostinger) NS auf die zwei Cloudflare-NS umstellen
   - Propagation 1-24 h — in dieser Zeit beide Zonen synchron halten (TTL 300 hilft)

8. **Mail-Test nach Cutover**
   - Test-Mail an externe Adresse (Gmail/Outlook) senden, Header prüfen:
     - SPF: `pass` für mx1.hostinger.com
     - DKIM: Signatur valide, Selektor erkannt
     - DMARC: `pass`
   - Spoof-Test: gefälschten Absender simulieren, DMARC `quarantine` muss greifen

9. **Erst danach: Cloudflare-Security-Features aktivieren**
   - HSTS via Cloudflare-Konsole (Runbook PR #472)
   - Transform-Rule für Security-Header (HTTP-Header statt nur Meta)
   - WAF Managed Rules
   - Bot Fight Mode
   - Rate-Limit für `/auth/*` und Edge-Function-Aufrufe via Cloudflare-Worker oder als geplante Anwendung

## Rollback-Plan

Bei kritischem Mail- oder DNS-Problem nach Cutover:
1. Cloudflare-Wolken auf grau (DNS only) setzen → eliminiert Proxy
2. Falls Mail betroffen: Nameserver beim Registrar **sofort zurück** auf Hostinger-NS
3. TTL 300 sorgt für Recovery in ≤ 5 min nach Registrar-Update
4. **HSTS NICHT aktivieren bevor Mail/Cutover stabil ist** (HSTS Preload ist irreversibel)

## Was dieses Dokument NICHT macht

- Keine Konfigurationsänderung vorgenommen
- Keine Cloudflare-Zone angelegt
- Keine TTLs angepasst
- Keine DMARC-Reparatur ohne explizite Freigabe

Status: **Inventur abgeschlossen, Migrations-Reihenfolge dokumentiert,
keine produktive Aktion ausgelöst.**

# DNS-Konfiguration Mail Vorlage

**Zweck:** Anleitung zur DNS-Konfiguration für Deployment

---

## Betreff

DNS-Konfiguration für [PROJEKTNAME] - [UMGEBUNG]

---

## Email-Body

```
Hallo [NAME],

bitte konfigurieren Sie die Domain [DOMAIN] gemäß den Anforderungen der Zielplattform.

### Zielplattform

- [ ] Cloudflare Pages
- [ ] GitHub Pages
- [ ] Andere: [SPEZIFIZIEREN]

### Konfigurationsanleitung

#### Für Cloudflare Pages:

1. Domain in Cloudflare Dashboard hinzufügen
2. DNS-Records gemäß Cloudflare Pages Anleitung konfigurieren
3. CNAME-Flattening wird von Cloudflare automatisch gehandhabt
4. SSL/TLS auf "Full (Strict)" setzen

#### Für GitHub Pages:

1. CNAME-File im Repository-Root erstellen mit Inhalt: [DOMAIN]
2. A-Records für @ (Root-Domain) auf GitHub Pages IP-Adressen setzen:
   - 185.199.108.153
   - 185.199.109.153
   - 185.199.110.153
   - 185.199.111.153
3. CNAME-Record für www auf [USERNAME].github.io setzen

#### Wichtig:

> **Hinweis:** Root-Domain als CNAME ist nicht bei jedem DNS-Provider möglich.
> Viele Provider unterstützen CNAME am Apex nicht und erfordern A/AAAA Records.
> Cloudflare löst dies intern über CNAME Flattening.

### Verifizierung

Nach der Konfiguration bitte:

1. DNS-Propagation prüfen (kann bis zu 48 Stunden dauern)
2. Domain-Zugriff testen
3. SSL-Zertifikat verifizieren
4. Bestätigung an [DEINE E-MAIL] senden

### Zeitrahmen

- Konfiguration bis: [DATUM]
- Verifizierung bis: [DATUM]

Bei Fragen stehen wir gerne zur Verfügung.

Vielen Dank!

Beste Grüße,
[DEIN NAME]
[DEINE POSITION]
```

---

## Anpassungsnotizen

1. **Technische Korrektheit:** Die Anweisung wurde von "bitte CNAME auf @ setzen" zu einer plattformspezifischen Anleitung geändert, da CNAME am Apex nicht von allen Providern unterstützt wird.
2. **Plattform-spezifisch:** Separate Anleitungen für Cloudflare Pages und GitHub Pages.
3. **Hinweis hinzugefügt:** Expliziter Hinweis zu den Einschränkungen von CNAME am Apex.
4. **Verifizierung:** Klare Schritte zur Überprüfung der Konfiguration.

---

## Variablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| [NAME] | Name des Empfängers | "Max Mustermann" |
| [PROJEKTNAME] | Name des Projekts | "RealSyncDynamics.AI" |
| [UMGEBUNG] | Umgebung | "Production" |
| [DOMAIN] | Domain-Name | "realsyncdynamics.ai" |
| [USERNAME] | GitHub Username | "realsyncdynamics-spec" |
| [DATUM] | Datum im Format YYYY-MM-DD | "2026-08-15" |
| [DEINE E-MAIL] | Deine E-Mail-Adresse | "support@realsyncdynamics.ai" |
| [DEIN NAME] | Dein Name | "Dominik Seed" |
| [DEINE POSITION] | Deine Position | "Lead Engineer" |

---

## Provider-spezifische Hinweise

### Cloudflare
- Unterstützt CNAME Flattening am Apex
- Automatische SSL-Zertifikatsverwaltung
- DNS-Propagation meist innerhalb von Minuten

### GitHub Pages
- Erfordert A-Records für Root-Domain
- CNAME für www-Subdomain
- SSL-Zertifikate werden automatisch von GitHub bereitgestellt

### Andere Provider
- Prüfen, ob CNAME am Apex unterstützt wird
- Falls nicht: A/AAAA Records verwenden
- SSL-Zertifikat manuell oder über Provider konfigurieren

---

**Version:** 1.0  
**Letzte Aktualisierung:** 2026-07-29  
**Verantwortlich:** Engineering Team

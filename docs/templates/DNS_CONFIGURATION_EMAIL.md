# DNS-Konfiguration-E-Mail-Vorlage

**Zweck**: Anleitung zur Domain-Konfiguration für Cloudflare Pages oder GitHub Pages
**Verwendung**: Kopieren, anpassen, an den zuständigen DNS-Administrator senden

---

## Betreff
Anfrage: DNS-Konfiguration für [Domain-Name] - RealSyncDynamics.AI Deployment

## E-Mail-Inhalt

```text
Hallo [Name],

bitte konfigurieren Sie die Domain [Domain-Name, z.B. realsyncdynamicsai.de] gemäß den Anforderungen der Zielplattform.

### Zielplattform
- [ ] Cloudflare Pages
- [ ] GitHub Pages
- [ ] Andere: [bitte angeben]

### Wichtige Hinweise

**WICHTIG**: Root-Domain als CNAME ist **nicht bei jedem DNS-Provider möglich**.

- **Cloudflare**: Unterstützt CNAME Flattening am Apex (Root-Domain)
- **Andere Provider**: Verwenden Sie A/AAAA Records für die Root-Domain
- **www-Subdomain**: Kann immer als CNAME konfiguriert werden

### Konfiguration für Cloudflare Pages

1. **Custom Domain hinzufügen**
   - In Cloudflare Dashboard: Pages → [Ihr Projekt] → Custom domains
   - Domain: [Domain-Name] eingeben

2. **DNS-Records erstellen** (automatisch oder manuell)
   - **Für Root-Domain (Apex)**:
     - Typ: CNAME (wenn Cloudflare als DNS-Provider)
     - Name: @ oder [Domain-Name]
     - Wert: [Ihr-Projekt].pages.dev
     - Proxy-Status: Proxied (Orange Cloud)
   - **Für www-Subdomain**:
     - Typ: CNAME
     - Name: www
     - Wert: [Ihr-Projekt].pages.dev
     - Proxy-Status: Proxied (Orange Cloud)

3. **SSL-Zertifikat**
   - Wird automatisch von Cloudflare bereitgestellt (1-5 Minuten)
   - Modus: Full (strict)
   - Always Use HTTPS: Aktiviert

### Konfiguration für GitHub Pages

1. **Custom Domain in GitHub konfigurieren**
   - Repository Settings → Pages → Custom domain
   - Domain: [Domain-Name] eingeben

2. **DNS-Records erstellen**
   - **Für Root-Domain (Apex)**:
     - Typ: A
     - Name: @ oder [Domain-Name]
     - Wert: 185.199.108.153
     - Wert: 185.199.109.153
     - Wert: 185.199.110.153
     - Wert: 185.199.111.153
   - **Für www-Subdomain**:
     - Typ: CNAME
     - Name: www
     - Wert: [Ihr-Benutzername].github.io

3. **CNAME-Datei** (optional für www)
   - Erstellen Sie eine Datei `CNAME` im Root oder docs-Verzeichnis
   - Inhalt: [Domain-Name]

### Verifikation

Nach der Konfiguration bitte prüfen:
- [ ] Domain zeigt auf die richtige Seite
- [ ] SSL-Zertifikat ist gültig (keine Warnungen im Browser)
- [ ] HTTP → HTTPS Redirect funktioniert
- [ ] www → Root-Domain Redirect funktioniert (falls gewünscht)

Bitte bestätigen Sie, sobald die Konfiguration abgeschlossen ist, damit wir mit dem Deployment fortfahren können.

Bei Fragen oder Problemen stehe ich gerne zur Verfügung.

Vielen Dank!

Beste Grüße,
[Dein Name]
[Deine Rolle]
RealSyncDynamics.AI
```

---

## Anpassungshinweise

1. **Plattform auswählen**: Cloudflare Pages ODER GitHub Pages (nicht beide)
2. **Domain-Name**: Immer die tatsächliche Domain angeben
3. **Provider prüfen**: Vor dem Senden prüfen, ob der DNS-Provider CNAME am Apex unterstützt
4. **Projekt-Name**: Den tatsächlichen Cloudflare/GitHub Pages Projekt-Namen verwenden

## Technische Referenz

- [Cloudflare Pages Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [GitHub Pages Custom Domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [CNAME Flattening (Cloudflare)](https://blog.cloudflare.com/introducing-cname-flattening/)

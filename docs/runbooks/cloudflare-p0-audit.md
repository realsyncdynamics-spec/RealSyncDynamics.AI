# P0-A – Cloudflare Pages: lesende Produktionszuordnung prüfen

**Status:** Werkzeug vorbereitet, **kein** Nachweis für eine produktive Freigabe.
**Ticket:** [#2348](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/issues/2348)
**Sicherheitsgrenze:** Keine Schreiboperationen, kein Deployment, kein Voice-Schalter, keine Provider-/Audioverbindung.

## Bestehenden Bestand nutzen

Zuerst den bestehenden Pages-Projektpfad `realsyncdynamics-ai` prüfen; keine zweite Plattform aufbauen.
`scripts/diagnose-domain-routing.mjs` bleibt ein öffentliches HTTP-Diagnosewerkzeug, ersetzt aber keine Cloudflare-Dashboard-/API-Aussage.
Der frühere Voice-API-Prüfentwurf [PR #2358](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2358) wurde im Zuge der Repo-Bereinigung geschlossen und ist **nicht** Teil dieses PR. Der Produktions-Workflow bleibt wegen [PR #2336](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2336) unangetastet.

## Berechtigungen (Cloudflare API token, nur Lesen)

Ein **zeitlich begrenztes** API-Token mit möglichst engem Zugriff auf den zu prüfenden Account/die Zone verwenden:

- Account / Cloudflare Pages: Read
- Zone: Read
- DNS: Read
- Workers Routes: Read (sofern verfügbar)

Keine Edit-/Write-Berechtigung, kein globaler API-Key. Niemals Token, ungefilterte API-Antworten oder Screenshots mit Secrets im GitHub-Issue hinterlegen. Die abgefragten Permissions müssen auf die konkrete Cloudflare-Konfiguration abgestimmt werden.

## Lokal ausführen

Node.js 20 oder neuer, Netzwerkzugang zu `api.cloudflare.com`:

```bash
export CLOUDFLARE_ACCOUNT_ID='<Cloudflare-Account-ID>'
read -rs -p "Cloudflare Read-only API Token: " CLOUDFLARE_API_TOKEN; echo
export CLOUDFLARE_API_TOKEN

node --test scripts/cloudflare-p0-evidence.test.mjs
node scripts/cloudflare-p0-evidence.mjs

unset CLOUDFLARE_API_TOKEN
```

Der Report enthält ausschließlich ausgewählte Metadaten: Production-Branch, kanonisches Deployment (nur als Kandidat), Custom-Domain-Status, DNS-Ziele, getrennte DNS-only-Klassifizierung der Voice-Subdomain und Worker-Routen-Kandidaten. Das Token wird nicht ausgegeben. Ein fehlender Berechtigungsnachweis erscheint als `*_READ_UNAVAILABLE` und wird **nicht** als DNS- oder Plattformausfall interpretiert.

Die Prüfung sendet **nur GET** an die Cloudflare-API. Selbst bei vollständig befüllten Feldern lautet das Ergebnis immer `NOT_PRODUCTION_APPROVED`, da diese Daten **keine** öffentliche HTTP- oder Audio-Abnahme ersetzen.

## DNS-only-Sonderfall: `voice.realsyncdynamicsai.de`

**Nutzerseitiger DNS-Befund (27.11.2026), noch nicht per Cloudflare-API belegt:** `voice` zeigt als DNS-only-CNAME (graue Wolke) auf GitHub Pages. Das ist **kein** Cloudflare-Pages-Production-Endpunkt und darf nicht als Ausfall markiert werden, wenn Cloudflare-Zonen-HTTP-Analytik für diesen Host keine Zugriffe anzeigt.

Der Prüfbericht fragt `voice` deshalb separat ab und klassifiziert den Host anhand des tatsächlichen DNS-CNAMEs:

- `GITHUB_PAGES_DNS_ONLY`: **Nur** CNAME mit `proxied=false` und Ziel `*.github.io`.
- `DNS_ONLY_EXTERNAL_ORIGIN_UNVERIFIED`: DNS-only-CNAME mit anderem Ziel; externer Dienst ist nicht näher bestätigt.
- `CLOUDFLARE_PROXY_CANDIDATE`: CNAME mit `proxied=true`; Cloudflare-Proxy möglich, aber funktionierende TLS-/HTTP-Route ungeprüft.
- `NON_CNAME_ORIGIN_UNVERIFIED` / `UNVERIFIED`: kein belastbarer Zuordnungsnachweis.

**Kein automatischer DNS-Wechsel.** Cloudflare DNS-only liefert selbst keine HTTP-WAF, kein CDN-Caching und keine Cloudflare-HTTP-Analytik; daraus lässt sich aber nicht ableiten, dass GitHub Pages keinen eigenen Plattformschutz hat. Eine Proxy-Umstellung benötigt gesonderte Owner-Freigabe, Rückfallplan und Cloudflare-SSL-/GitHub-Pages-Zertifikatstests. Ein GitHub-Pages-CNAME-Check ist **keine** Verifizierung der tatsächlichen Inhalte oder externen JavaScript-Aufrufe.

**Bereits im RealSync-Repository belegte Ressourcen (Code-Referenzen, kein aktueller Netzwerk-Scan):**
- `https://voice.realsyncdynamicsai.de/onboarding.html` als externer Link in `src/components/landing/company/companyProducts.ts` und `src/pages/product-entry-points/PhonebotStartPage.tsx`.
- MP3-Beispiele unter `/audio/handwerk.mp3?v=grok1`, `/audio/kfz.mp3?v=grok1`, `/audio/gastronomie.mp3?v=grok1`, `/audio/hausverwaltung.mp3?v=grok1` in `src/components/landing/company/CompanyDemos.tsx`.
- `src/product/implementation-status.ts` bewertet das externe Onboarding nur als Preview und verweist auf den historischen HTTP-200-Befund vom 03.11.2026; **kein Live-Voice-/Checkout-Nachweis**.

Ein vollständiger Ressourcen- und Drittanbieter-Scan muss die ausgelieferte Seite mit Browser-Netzwerkprotokoll, Requests, CSP, externen Skripten, Cookies, Form-Zielen und erreichbaren MP3-Dateien untersuchen. Ohne echten HTTP-Zugriff dürfen weder „keine externen Anbieter“ noch „alles sicher“ bescheinigt werden.

## Zweiter, unabhängiger Nachweis: öffentliche Routen

Auf einem Prüfgerät mit funktionierender Namensauflösung die drei Hosts separat prüfen:

```bash
for host in realsyncdynamicsai.de www.realsyncdynamicsai.de realsyncdynamics-ai.pages.dev; do
  for path in / /api/company-voice /api/company-voice/live; do
    echo "=== https://${host}${path}"
    curl -sS -D - -o /dev/null --max-time 15 "https://${host}${path}"
  done
done
```

**GET-Body-Typisierung zusätzlich separat prüfen**, ohne Secrets oder personenbezogene Daten zu protokollieren: `/api/company-voice` muss JSON-Fakten liefern; `/api/company-voice/live` bei ausgeschaltetem Feature `503` JSON mit `LIVE_VOICE_DISABLED` und bei eingeschalteter Funktion ohne WebSocket-Upgrade `426` JSON mit `UPGRADE_REQUIRED`. Ein SPA-HTML-Fallback darf nicht als API-Erfolg durchgehen. `HEAD` ist advisory, nicht das Go-Live-Kriterium.

## Abnahme vor irgendeinem Cutover

1. **Production-Projekt** und `production_branch` mit einem kanonischen **production**-Deployment und exakt nachvollziehbarem Commit abgleichen; `voice` ausdrücklich nicht als Pages-Production-Host behandeln, wenn der DNS-only-Nachweis vorliegt. Eine Branch-Preview ist kein Live-Beweis.
2. Apex und `www`: Custom Domains und DNS-Einträge auf denselben Production-Pfad prüfen; konkurrierende Worker-Routen mit dem Cloudflare-Dashboard klären, nicht automatisch löschen.
3. HTTP-GET/HEAD, Redirects, Content-Type, CF-Ray und die beiden Voice-API-Typen auf allen drei Hosts unabhängig testen.
4. Bestehende [#2336](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/pull/2336)-Änderungen und eventuelle Wiederaufnahme von #2358 vor einem späteren Merge koordinieren.
5. Cloudflare Production KV-Binding `COMPANY_VOICE_LIVE_KV`, serverseitiger `XAI_API_KEY`, xAI-Kostenlimit, Datenschutz und echter Audio-E2E gehören zu **P0-C**, nicht zu diesem Werkzeug.

**Owner-Gate:** Kein Merge und kein produktiver Schalter/DNS-/Worker-Eingriff ohne ausdrückliche gesonderte Freigabe. Dieses Prüfwerkzeug hat keine Cloudflare-Zugangsdaten eingebaut und führt keine Live-Abfragen während CI aus.

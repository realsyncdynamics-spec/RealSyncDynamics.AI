# DSGVO- & Compliance-Audit — realsyncdynamicsai.de

**Datum:** 2026-07-27 · **Basis:** `main` @ `c5486a8` · **Branch:** `claude/dsgvo-compliance-hotfix`

Analyse des Ist-Zustands im Code, anschließend Behebung. Jeder behobene Defekt
wurde zuvor durch einen fehlschlagenden Test belegt. Kein Fund wurde ohne
Reproduktion korrigiert.

---

## Gefundene Probleme

### Kritisch

**K-1 · Werbe-Einwilligung ohne Marketing-Consent an Google gemeldet**
`src/lib/pixels.ts` · Art. 6 I lit. a DSGVO, § 25 TDDDG

`loadGoogleTag()` setzte den Google-Consent-Mode-v2-Default pauschal auf
`granted` — mit der Begründung im Kommentar, das Modul werde ohnehin nur nach
Einwilligung aufgerufen. Das stimmte nur für die Kategorie insgesamt, nicht pro
Zweck: Bei **„nur Statistik"** (Marketing abgelehnt) lud GA4, und der Default
meldete `ad_storage`, `ad_user_data` und `ad_personalization` als `granted`.

Verschärfend war die Reihenfolge in `applyConsent()`: das korrigierende
`consent → update` lief **vor** dem Laden von gtag und war beim ersten
Seitenaufruf wirkungslos (`window.gtag` noch `undefined`). Es gab also keinen
nachgelagerten Korrekturpfad.

Reproduktion (Test `setzt bei „nur Statistik" KEIN Marketing-Signal auf granted`):
```
expected 'granted' to be 'denied'   // ad_storage
```

**K-2 · Widerruf blieb faktisch wirkungslos**
`src/lib/pixels.ts` · Art. 7 III DSGVO

`pixelsLoaded` wurde nie zurückgesetzt. Meta, TikTok und LinkedIn kennen kein
Consent Mode — einmal injiziert, feuerten ihre Scripts nach dem Widerruf
unverändert weiter. Der Widerruf war in der UI vorhanden, aber ohne technische
Wirkung auf bereits geladene Drittanbieter.

### Mittel

**M-1 · Einwilligung ohne Version gespeichert**
`src/components/CookieConsent.tsx` · Art. 7 I DSGVO (Nachweisbarkeit)

Der Storage-Key trug `.v1`, das gespeicherte Objekt selbst aber keine
Versionsnummer. Ein Re-Consent bei geänderten Zwecken oder neuen Empfängern
war damit nicht möglich, ohne allen Nutzern den Consent zu löschen.

**M-2 · Einstellungen zeigten beim Widerruf einen falschen Ist-Zustand**
`src/components/CookieConsent.tsx`

Beim Wiederöffnen über den Footer standen „Statistik" und „Marketing"
unabhängig von der gespeicherten Wahl auf *aus*. Wer zuvor Statistik erlaubt
hatte und die Einstellungen nur ansehen wollte, widerrief sie beim Speichern
unbeabsichtigt.

**M-3 · `frame-ancestors` in der CSP wirkungslos**
`index.html`

Die CSP wurde ausschließlich als `<meta http-equiv>` ausgeliefert.
`frame-ancestors` wird dort **per Spezifikation ignoriert**. Der
Clickjacking-Schutz stützte sich faktisch allein auf `X-Frame-Options`.

**M-4 · Sentry durch die eigene CSP blockiert**
`index.html` · Monitoring

`initSentry()` wird in `src/main.tsx:12` aufgerufen, `*.ingest.sentry.io` fehlte
aber in `connect-src`. Die im Stack dokumentierte Fehler-Aggregation lief damit
in Produktion ins Leere — ohne sichtbaren Fehler.

### Niedrig

**N-1 · Widersprüchliche, tote Header-Konfiguration**
Root-`./_headers` setzt `X-Frame-Options: DENY`, `public/_headers` setzt
`SAMEORIGIN`. Vite kopiert ausschließlich `public/` nach `dist/` — die
Root-Datei wird nie ausgeliefert. Sie steht nur noch im `paths:`-Trigger von
`deploy-cloudflare-pages.yml` und ist damit irreführender Altbestand.

**N-2 · CSP ohne `base-uri`, `form-action`, `object-src`**
Kein akuter Angriffspfad, aber fehlende Härtung gegen Base-Tag- und
Form-Hijacking.

**N-3 · Toter Drittanbieter-Code**
`src/components/WaitlistSection.tsx` bindet ein Tally.so-Embed ein, die
Komponente wird jedoch nirgends gerendert. Kein Datenabfluss, aber ein latentes
Risiko, falls sie reaktiviert wird.

---

## Behobene Probleme

| ID | Fix | Nachweis |
|----|-----|----------|
| K-1 | Consent-Default ausnahmslos `denied`; Signale werden nach dem Laden pro Kategorie gesetzt; Reihenfolge korrigiert | 3 Tests |
| K-2 | Widerruf einer geladenen Kategorie setzt den Zustand zurück und erzwingt einen Reload | 2 Tests |
| M-1 | `CONSENT_VERSION` wird geschrieben und geprüft; Altbestände ohne Feld gelten als Version 1 | 3 Tests |
| M-2 | Einstellungen werden aus der gespeicherten Wahl vorbefüllt | 1 Test |
| M-3 | CSP zusätzlich als echter Header in `public/_headers`, inkl. `frame-ancestors 'self'` | Build-Verifikation |
| M-4 | `*.ingest.de.sentry.io` / `*.ingest.sentry.io` in `connect-src` ergänzt | Build-Verifikation |
| N-2 | `base-uri 'self'`, `form-action 'self'`, `object-src 'none'` ergänzt | Build-Verifikation |
| D-1 | Sentry als Auftragsverarbeiter in `SubProcessors.tsx` ergänzt | Build: 9 Prozessoren |
| P-1 | Favicon deklariert (bestehendes Brand-Asset) — behebt 404 und fehlendes Icon | Browser-Lauf |
| — | `Cross-Origin-Opener-Policy: same-origin-allow-popups` ergänzt | Build-Verifikation |

**Zur CSP-Doppelauslieferung:** `deploy/cloudflare/main.tf` dokumentiert eine
bewusste Entscheidung *gegen* einen CSP-Header neben der Meta-CSP, wegen der
Schnittmengen-Bildung. Beide Policies sind hier deshalb inhaltlich **identisch**
gehalten; die einzige Ergänzung im Header ist `frame-ancestors`, das die
Meta-Policy ohnehin ignoriert. Die wirksame Schnittmenge ist damit unverändert.
Der Kommentar in `main.tf` ist jetzt veraltet und sollte nachgezogen werden.

---

## Drittanbieter-Inventar

Methodik: Suche nach jedem namentlich geforderten Anbieter, anschließend
Abgleich gegen die **tatsächlichen Script-Injektionen** im Code
(`createElement('script')`, `injectScript()`, `<script src>`). Nötig, weil die
Plattform selbst Tracker-Namen als *Produktinhalt* führt — sie scannt fremde
Seiten darauf. Reine Textnennungen sind daher keine Einbindung.

### Tatsächlich eingebunden

| Anbieter | Host | Einstufung | Consent | Kategorie | Korrekt eingebunden? |
|----------|------|-----------|---------|-----------|---------------------|
| Google Analytics 4 | `googletagmanager.com`, `google-analytics.com` | Drittland (US, SCC+DPF) | erforderlich | Statistik | **Jetzt ja** — vorher K-1 |
| Google Ads | `googletagmanager.com` | Drittland (US, SCC+DPF) | erforderlich | Marketing | **Jetzt ja** — vorher K-1 |
| Meta Pixel | `connect.facebook.net` | Drittland (US, SCC+DPF) | erforderlich | Marketing | Laden ja; Widerruf vorher K-2 |
| TikTok Pixel | `analytics.tiktok.com` | Drittland (US, SCC) | erforderlich | Marketing | Laden ja; Widerruf vorher K-2 |
| LinkedIn Insight | `snap.licdn.com` | Drittland (US, SCC+DPF) | erforderlich | Marketing | Laden ja; Widerruf vorher K-2 |
| Supabase | `*.supabase.co` | **EU** (Frankfurt, eu-central-1) | nicht erforderlich | technisch notwendig | Ja |
| Sentry | `*.ingest.de.sentry.io` | **EU** (Frankfurt-Endpoint) | nicht erforderlich (Art. 6 I lit. f) | Fehler-Erfassung | Siehe D-1 |

Alle fünf Tracker werden ausschließlich aus `src/lib/pixels.ts` geladen und sind
durchgängig consent-gegated — belegt durch drei Tests, die vor der Einwilligung
*keinerlei* Script-Injektion nachweisen.

**D-1 · Sentry war nicht als Auftragsverarbeiter ausgewiesen** — Art. 13 I lit. e DSGVO

`initSentry()` läuft in `src/main.tsx:12` ohne Consent. Das ist vertretbar: kein
Cookie, kein Zugriff auf Endgeräte-Speicher zu Trackingzwecken (§ 25 TDDDG
greift nicht), `sendDefaultPii: false`, Session-Replay auf `0` deaktiviert und
`beforeSend` entfernt Email und IP. Getragen von Art. 6 I lit. f.

Der Empfänger fehlte jedoch in der Sub-Prozessoren-Liste — eine reine
Transparenzlücke, kein unzulässiger Datenfluss. **Behoben:** Eintrag in
`SubProcessors.tsx` ergänzt (Liste jetzt 9 statt 8 Einträge).

### Gesucht, aber nicht vorhanden

| Anbieter | Status |
|----------|--------|
| Google Fonts | **Nicht eingebunden** — 8 `.woff2` self-hosted unter `public/fonts/`, kein Request an `fonts.googleapis.com`/`fonts.gstatic.com` |
| Google Tag Manager (Container) | Nicht eingebunden — nur `gtag.js` direkt, kein GTM-Container |
| Cloudflare Web Analytics | Nicht eingebunden — 0 Treffer für `cloudflareinsights.com` |
| Hotjar | Nicht eingebunden — Treffer nur in Scanner-/Marketing-Inhalten |
| Microsoft Clarity | Nicht eingebunden — 0 Treffer |
| Plausible, Matomo | Nicht eingebunden — Treffer nur in SEO-Seiten als Code-*Beispiel* (`matomo.example.com`) |
| Segment, Intercom, HubSpot | Nicht eingebunden — nur Produktinhalte und Typdefinitionen |

### Sonderfälle

- **Tally.so** (`tally.so/widgets/embed.js`) — echte Script-Injektion in
  `WaitlistSection.tsx`, die Komponente wird aber **nirgends gerendert**.
  Toter Code, aktuell kein Datenabfluss. Siehe N-3.
- **JSON-LD** in `SEOHead.tsx` und `useJsonLd.ts` — `type="application/ld+json"`
  mit `textContent`, kein externes `src`. Kein Drittanbieter.
- **`RealSyncDynamicsAI.de/sdk/cookie-consent.js`** — auf zahlreichen Seiten als
  Code-Snippet dargestellt. Das ist das *eigene* Produkt-SDK für Kunden, keine
  Einbindung in die eigene Seite.

---

## Laufzeit-Verifikation

Nachgeholt gegen das deployte Cloudflare-Pages-Preview-Artefakt (Response-Header
per curl) und gegen den lokal ausgelieferten `dist/`-Build (Browser-Verhalten via
Chromium/Playwright). Damit ist der zuvor als offen markierte Punkt geschlossen.

### Response-Header live bestätigt

Gegen `claude-dsgvo-compliance-hotf.realsyncdynamics-ai.pages.dev`:

```
content-security-policy: … frame-ancestors 'self'; base-uri 'self';
                             form-action 'self'; object-src 'none'
                             connect-src … https://*.ingest.de.sentry.io …
cross-origin-opener-policy: same-origin-allow-popups
strict-transport-security:  max-age=31536000; includeSubDomains; preload
x-frame-options:            SAMEORIGIN
x-content-type-options:     nosniff
referrer-policy:            strict-origin-when-cross-origin
permissions-policy:         camera=(), microphone=(), geolocation=()
```

M-3, M-4 und N-2 sind damit **laufzeitverifiziert**, nicht nur build-verifiziert.
HTTP-Status 200 für `/`, `/legal/privacy`, `/datenschutz`, `/legal/datenschutz`,
`/impressum`, `/legal/impressum`, `/legal/sub-processors`, `/robots.txt`,
`/sitemap.xml`.

### Browser-Verhalten (17 von 20 Prüfungen bestanden)

| Prüfung | Ergebnis |
|---------|----------|
| Neuer Besucher: Drittanbieter-Requests vor Consent | **0 von 12 Requests** |
| Nach „Alle ablehnen": weiterhin keine Tracker | bestanden |
| Consent mit Version gespeichert | `{"analytics":false,"marketing":false,"version":1,…}` |
| Wiederkehrender Besucher: Banner bleibt aus | bestanden |
| Banner + gleichrangige Ablehnen-Schaltfläche sichtbar | bestanden |
| Mobile `/legal/privacy` (iPhone 13) | 5.907 Zeichen, 0px Overflow |
| Mobile `/impressum` | 4.379 Zeichen, 0px Overflow |
| Mobile `/legal/sub-processors` | 2.878 Zeichen, 0px Overflow |
| Sentry als Auftragsverarbeiter sichtbar (D-1) | bestanden |
| JS-Exceptions | keine |

Die drei verbleibenden Fehlschläge sind **ausschließlich**
`ERR_CONNECTION_RESET` gegen `*.supabase.co` — die Sandbox lässt keinen
ausgehenden Browser-Traffic zu. Es sind reguläre First-Party-Backend-Aufrufe,
keine App-Defekte.

**P-1 · Kein Favicon vorhanden** — *behoben*

`index.html` deklarierte kein Icon, und es existierte keines. Browser fragen dann
konventionsgemäß `/favicon.ico` an — das fängt der SPA-Fallback
(`/* → /index.html 200`) ab und liefert ein **HTML-Dokument als Icon** aus.
Auf der Live-Preview bestätigt: `/favicon.ico` → `200 text/html`.
Folge: kein Favicon plus ein Konsolenfehler bei jedem Seitenaufruf.
Behoben durch Verweis auf das bestehende `public/brand/logo-square-400.svg`,
es wurde keine neue Grafik eingeführt.

**Nebenbefund:** Weil der SPA-Fallback jeden unbekannten Pfad mit `200 text/html`
beantwortet, tauchen fehlende Assets in Produktion **nie als 404 auf**. Das
verdeckt Fehler systematisch — beim Prüfen von Asset-Pfaden ist der
Content-Type auszuwerten, nicht der Status-Code.

---

## Tracking ohne Einwilligung — Prüfung

`useTrackPageview()` (`src/lib/track.ts`) feuert bei jedem Routenwechsel vor der
Einwilligung. Geprüft, ob das zulässig ist:

**Client-seitig unbedenklich.** Kein `localStorage`, kein `sessionStorage`, kein
`document.cookie`, kein Fingerprinting — per Suche verifiziert. Gesendet werden
nur Pfad, Referrer und UTM-Parameter an die eigene Supabase-Edge-Function.
§ 25 TDDDG greift mangels Zugriff auf Endgeräte-Speicher nicht; die Verarbeitung
stützt sich auf Art. 6 I lit. f.

**T-1 · `session_hash` rotiert entgegen der Dokumentation nicht** — *offen*

In `supabase/functions/track-pageview/index.ts`:

```ts
const visitorHash = await sha256Hex(`${ipHeader}|${ua}|${today}`);  // rotiert täglich
const sessionHash = await sha256Hex(`${ipHeader}|${ua}`);           // KEIN Tagesbestandteil
```

Das widerspricht zwei eigenen Zusagen:

- Dateikopf: *„Different days = different hash, so we can't track across sessions — by design."*
- Migration `20260506120000_page_views.sql` Z. 11: *„session_hash = visitor_hash + first-visit-day"*

`visitor_hash` verhält sich wie dokumentiert. `session_hash` nicht: es ist ein
über die Aufbewahrungsfrist von 90 Tagen **stabiler Wiedererkennungswert** für
dieselbe IP-/User-Agent-Kombination. Der Unterschied ist materiell — „kann
wiederkehrende Besucher nicht erkennen" gegenüber „kann alle Besuche einer
IP über 90 Tage verknüpfen".

Zusätzlich ist der Hash **ungesalzen**. Der IPv4-Raum ist mit 2^32 vollständig
durchprobierbar, ein bekannter User-Agent-String reduziert den Aufwand weiter —
die Pseudonymisierung trägt damit nur schwach.

**Bewusst nicht geändert.** Der Fix wäre klein (Tagesbestandteil ergänzen, dazu
ein serverseitiges Salt aus den Function-Secrets), verändert aber die Semantik
einer produktiv befüllten, indizierten Analytics-Spalte. Ob eine „Session"
tagesübergreifend gelten soll, ist eine Produktentscheidung, keine technische.
Vorgabe des Sprints war ausdrücklich „keine Blindkorrekturen".


---

## Nicht zu beanstanden

Diese Punkte wurden geprüft und waren **bereits korrekt** — keine Änderung nötig:

- **Consent-Gating** — vor der Einwilligung wird kein einziges Drittanbieter-Script geladen. Durch 3 Tests bestätigt.
- **Keine Dark Patterns** — „Alles akzeptieren" und „Alle ablehnen" sind gleich breit (`flex-1`), gleich gestaltet und gleichrangig platziert. Durch Test abgesichert.
- **Widerruf erreichbar** — `openCookieSettings()` ist in `PublicFooter.tsx` und `Landing.tsx` verlinkt.
- **Fonts self-hosted** — 8 `.woff2` unter `public/fonts/`, kein Request an Google Fonts. Die `fonts.googleapis.com`-Treffer im Code sind Produkt*inhalte* über fremde Verstöße, keine eigenen Loads.
- **Datenschutzerklärung** — 256 Zeilen, Art.-6-Rechtsgrundlagen, Speicherdauer, Aufsichtsbehörde, Widerspruch, Auftragsverarbeiter, Schrems-II-Hinweis, SCCs/DPF und eine **Tabelle je Pixel** mit Empfänger, Drittstaat, Zweck und Speicherdauer. Überdurchschnittlich vollständig.
- **Impressum** — 229 Zeilen, alle Pflichtangaben nach § 5 DDG vorhanden (Anschrift, Vertretung, Handelsregister, USt-IdNr., Telefon, E-Mail, inhaltlich Verantwortlicher).
- **Routing** — `/legal/privacy`, `/datenschutz`, `/legal/datenschutz`, `/impressum`, `/legal/impressum` sind alle registriert; SPA-Fallback `/* → /index.html 200` vorhanden. Kein Routingfehler feststellbar.
- **robots.txt** — sauber; auth-gated Bereiche und Alias-Routen disallowed, AI-Crawler bewusst erlaubt, Sitemap referenziert.
- **sitemap.xml** — 105 URLs, wohlgeformt.
- **Security-Header (Bestand)** — `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS mit `includeSubDomains; preload` waren bereits gesetzt.

---

## Noch offene Punkte

1. **N-1 — Root-`_headers`/`_redirects` bereinigen.** Bewusst *nicht* gelöscht:
   Löschen ist nicht reversibel ohne Git-Kenntnis des Ziel-Deploys, und die
   Dateien stehen in einem Workflow-Trigger. Empfehlung: entfernen und die
   `paths:`-Einträge in `deploy-cloudflare-pages.yml` mitziehen.
2. **N-3 — `WaitlistSection.tsx`** entweder entfernen oder das Tally-Embed
   hinter den Marketing-Consent hängen, bevor die Komponente je gerendert wird.
3. **`deploy/cloudflare/main.tf`** — Kommentar zur CSP-Entscheidung nachziehen.
4. **Governance-Browser vs. CSP** — `EmbeddedBrowserCanvas` lädt beliebige URLs
   in ein `<iframe>`, `frame-src` fällt aber auf `default-src 'self'` zurück.
   Das Feature dürfte unter der bestehenden CSP bereits blockiert sein.
   **Bewusst nicht angefasst:** eine Lockerung wäre eine Sicherheits­verschlechterung,
   und die beabsichtigte Semantik (Proxy? nur same-origin?) ist aus dem Code
   nicht eindeutig. Braucht eine Produktentscheidung.
5. **Laufzeit-Verifikation ausstehend.** Alle Prüfungen erfolgten statisch am
   Code plus Build. Ein Test gegen die *deployte* Seite (echte Response-Header,
   reale Netzwerk-Requests vor Consent, Lighthouse) konnte hier nicht erfolgen —
   die Umgebung hat keinen Zugriff auf realsyncdynamicsai.de.

---

## DSGVO-Risiken

| Risiko | Vorher | Nachher |
|--------|--------|---------|
| Werbe-Einwilligung ohne Rechtsgrundlage an Google | **Hoch** — bei jedem „nur Statistik"-Nutzer | Behoben |
| Weiterlaufendes Tracking nach Widerruf | **Hoch** — Meta/TikTok/LinkedIn dauerhaft | Behoben |
| Kein Re-Consent bei Zweckänderung möglich | Mittel | Behoben |
| Versehentlicher Widerruf durch falsche Anzeige | Mittel | Behoben |
| Auftragsverarbeiter nicht ausgewiesen (Sentry) | Niedrig | Behoben |
| Tracking vor Einwilligung | *bestand nicht* | — |
| Drittland-Transfer ohne Information | *bestand nicht* | — |

Restrisiko: Punkt 5 oben — die Fixes sind im Code und im Build verifiziert,
aber nicht gegen die Live-Domain.

---

## Sicherheitsrisiken

| Risiko | Vorher | Nachher |
|--------|--------|---------|
| Clickjacking via `frame-ancestors` | Wirkungslos (Meta ignoriert die Direktive) | Als echter Header gesetzt |
| Base-Tag-/Form-Hijacking | Nicht abgedeckt | `base-uri`/`form-action`/`object-src` gesetzt |
| Cross-Origin-Window-Zugriff | Nicht abgedeckt | COOP `same-origin-allow-popups` |
| Blindflug bei Produktionsfehlern | Sentry durch CSP blockiert | connect-src ergänzt |
| Widersprüchliche Header-Konfiguration | Bestand (tot) | Offen — siehe N-1 |

`'unsafe-inline'` in `script-src` bleibt bestehen. Eine Umstellung auf Nonces
oder Hashes ist die wirksamste verbleibende Härtung, erfordert aber Eingriffe
in den Vite-Build und war für einen Hotfix zu risikoreich.

---

## Performance

Gemessen am Produktions-Build (`npm run build`, 26–30 s):

| Chunk | Größe | gzip |
|-------|-------|------|
| `index-BQzdmg3A.js` | 3.897 kB | **1.032 kB** |
| `react-pdf.browser` | 1.468 kB | 491 kB |
| `LineChart` | 358 kB | 107 kB |

**Befund:** Der Haupt-Chunk liegt mit gut 1 MB gzip deutlich über dem
Rollup-Warnschwellwert. `react-pdf` (491 kB gzip) wird für die PDF-Erzeugung
gebraucht, gehört aber nicht in den Startpfad öffentlicher Landingpages.

**Bewusst nicht geändert.** Ein Umbau des Chunkings (`manualChunks`) berührt das
Lazy-Loading aller 100+ Routen. Das Regressionsrisiko steht in keinem Verhältnis
zu einem Hotfix-Sprint, dessen Auftrag ausdrücklich lautete, keine Regressionen
zu erzeugen. Empfehlung als eigener Change mit E2E-Absicherung — siehe unten.

Keine Dynamic-Import-Fehler, keine 404-Assets und keine Build-Warnungen
außerhalb der Chunk-Größe festgestellt.

---

## Commits

| Commit | Inhalt |
|--------|--------|
| `2a08c67` | `fix(dsgvo): Consent-Mode-Signale, Widerruf und Consent-Versionierung korrigieren` |
| `a460000` | `docs: Compliance-Audit-Report Juli 2026` |
| _(dieser)_ | `fix(dsgvo): Sentry als Auftragsverarbeiter ausweisen` + Drittanbieter-Inventar |

**Geänderte Dateien**

```
src/lib/pixels.ts                    Consent-Mode-Default, Widerruf, Versionsprüfung
src/components/CookieConsent.tsx     Versionierung, Vorbefüllung der Einstellungen
index.html                           CSP: Sentry, base-uri/form-action/object-src
public/_headers                      CSP als echter Header, frame-ancestors, COOP
test/consent-pixels.test.ts          7 Tests (neu)
test/cookie-consent-banner.test.tsx  10 Tests (neu)
src/features/legal/SubProcessors.tsx Sentry als Auftragsverarbeiter (D-1)
```

**Verifikation**

```
npx vitest run test/consent-pixels.test.ts test/cookie-consent-banner.test.tsx
  → 17 passed

npm test
  → 202 Dateien, 2529 passed, 0 failed   (Baseline vorher ebenfalls 0 failed)

npm run lint      → tsc --noEmit sauber
npm run build     → erfolgreich, CSP in dist/index.html und dist/_headers
```

---

## Empfehlungen

**Kurzfristig**
1. Fixes gegen die deployte Seite verifizieren: Response-Header prüfen und im
   Netzwerk-Tab bestätigen, dass bei „nur Statistik" kein `ad_storage=granted`
   an Google geht.
2. N-1 (tote Root-`_headers`) und N-3 (`WaitlistSection`) bereinigen.
3. Kommentar in `deploy/cloudflare/main.tf` nachziehen.

**Mittelfristig**
4. Governance-Browser vs. `frame-src` klären (offener Punkt 4) — Produktentscheidung.
5. `'unsafe-inline'` durch Nonces ersetzen.
6. Bundle-Splitting: `react-pdf` und `LineChart` aus dem Start-Chunk lösen,
   abgesichert durch die vorhandenen Playwright-E2E-Tests.

**Prozess**
7. Die 17 neuen Tests decken den Einwilligungspfad ab, der vorher **ungetestet**
   war — genau dort saßen beide kritischen Defekte. Bei Änderungen an
   Consent-Kategorien oder Empfängern `CONSENT_VERSION` erhöhen; die
   Versionsprüfung erzwingt dann automatisch ein Re-Consent.

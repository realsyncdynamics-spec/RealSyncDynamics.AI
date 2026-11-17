# Selbstaudit: Cookie-Banner und Consent (17.11.2026)

**Prüfgegenstand:** Cookie-Banner und Einwilligung auf `https://realsyncdynamicsai.de`
und der App-Origin `https://realsyncdynamics-ai.pages.dev`.
**Repo-Stand:** `ec56f87` (`main`, 17.11.2026)
**Art der Prüfung:** nur lesend. Es wurden kein Formular abgeschickt, keine Konten angelegt
und weder Code noch Konfiguration oder Deployment geändert.

---

## 1. Kurzfazit: GELB

Die Einwilligung **im Repo-Code** funktioniert. Auf `pages.dev` gehen vor der Entscheidung und
nach „Alle ablehnen“ nur Requests an die eigene Origin. Erst nach „Alles akzeptieren“ geht ein
Pageview an Supabase. „Ablehnen“ ist gleich groß wie „Akzeptieren“, und der Google Consent Mode
steht per Default auf `denied`.

Rot ist das Ergebnis nicht, gelb aber schon, aus vier Gründen:

1. **Die Live-Startseite stammt nicht aus diesem Repo.** `realsyncdynamicsai.de` liefert ein
   5,7 MB großes, gebündeltes Einzel-HTML ohne Quelle im Repo. Dort fehlen **CSP und
   X-Frame-Options**. Die Sicherheits-Header aus `public/_headers` greifen nur auf `pages.dev`.
2. **Auf der Apex-Domain läuft Cloudflare Web Analytics ohne Banner.** Das ist nach eigener
   Einordnung einwilligungsfrei (cookieless, Art. 6 Abs. 1 lit. f). Die Datenschutzerklärung
   beschreibt es aber nicht, nur die Sub-Prozessoren-Seite nennt es.
3. **Es gibt keinen sichtbaren Weg zum Widerruf.** Startseite und Datenschutzerklärung haben
   keinen Link „Cookie-Einstellungen“. Die Datenschutzerklärung verspricht aber den Widerruf
   „jederzeit über das Cookie-Banner“.
4. **Das Wort „anonym“ stimmt nicht, und die Einwilligung wird nicht nachgewiesen.** Die
   Statistik ist pseudonym, nicht anonym. Einwilligungen liegen nur im `localStorage` des
   Browsers und landen in keinem Audit-Log und keinem Evidence-Vault.

---

## 2. Befundtabelle

Schwere: **Hoch** = Sicherheits- oder Rechtsrisiko, zeitnah beheben · **Mittel** =
Dokumentations- oder Nachweislücke mit Rechtsbezug · **Niedrig** = Verbesserung · **Info** =
neutral oder positiv.

| Nr. | Befund | Schwere | Evidenz | Empfehlung |
|---|---|---|---|---|
| 1 | Auf der Apex-Domain fehlen Sicherheits-Header: kein `Content-Security-Policy`, kein `X-Frame-Options`, `Strict-Transport-Security: max-age=15552000` (180 Tage, ohne `includeSubDomains`/`preload`). Auf `pages.dev` sind alle Header aus dem Repo aktiv. | **Hoch** | `curl -I https://realsyncdynamicsai.de/` (17.11.2026, 17:58 UTC): nur `x-content-type-options`, `permissions-policy`, `referrer-policy`, `strict-transport-security: max-age=15552000`. `curl -I https://realsyncdynamics-ai.pages.dev/`: CSP, `x-frame-options: SAMEORIGIN`, HSTS 1 Jahr mit preload. Soll: `public/_headers:2`, `:8`, `:27`. | Die Apex-Auslieferung über dasselbe Pages-Projekt laufen lassen oder dort gleichwertige Header setzen (Cloudflare Transform Rule oder `_headers` im Apex-Projekt). Danach mit `curl -I` gegenprüfen. **Nicht ohne Freigabe umgesetzt.** |
| 2 | Die Live-Startseite ist nicht aus dem Repo nachvollziehbar. Live kommt ein Einzel-HTML mit `__bundler/manifest` (eingebettete Fonts, Three.js, Texturen). Im Repo gibt es keine Quelle dafür. Laut Repo wäre die Startseite `LandingV6`. Damit decken Code-Review und CI nicht ab, was live läuft. | **Hoch** | `curl https://realsyncdynamicsai.de/` → 5.699.744 Byte, 29× `__bundler`. `grep -r "__bundler/manifest"` im Repo: 0 Treffer. `src/App.tsx:543` (`<Route path="/" element={<LandingV6 />} />`). Kein Route/Custom-Domain-Eintrag für die Apex in `wrangler*.toml` gefunden. | Herkunft klären (welches Pages-Projekt oder welcher Worker die Apex bedient) und die Quelle ins Repo holen oder dort dokumentieren. Bis dahin gilt: Aussagen zur Startseite lassen sich nicht aus dem Code belegen. |
| 3 | Zwei Origins. Die Apex leitet `/datenschutz`, `/impressum`, `/login`, `/pricing` und `/audit` per **302** auf `realsyncdynamics-ai.pages.dev` weiter. Login, Datenschutzerklärung und Einwilligung liegen damit auf der `pages.dev`-Domain. Die Einwilligung gilt pro Origin. | Mittel | `curl -I` → `location: https://realsyncdynamics-ai.pages.dev/datenschutz` usw. Nebenbefund: `/robots.txt` und `/sitemap.xml` liefern auf der Apex HTML statt Text/XML. | Eine kanonische Origin für App und Rechtstexte, die eigene Domain. Falls die Weiterleitung bleibt: 301 statt 302 und in der Datenschutzerklärung nennen. |
| 4 | Cloudflare Web Analytics läuft auf der Apex beim ersten Aufruf ohne Banner: Skript von `static.cloudflareinsights.com` plus `POST /cdn-cgi/rum`. Die Datenschutzerklärung nennt Cloudflare nur als Hosting-Empfänger, nicht Web Analytics mit Zweck und Rechtsgrundlage. | Mittel | Playwright, Szenario `apex-A`: `GET static.cloudflareinsights.com/beacon.min.js/…`, `POST realsyncdynamicsai.de/cdn-cgi/rum` mit Feldern `location, pageloadId, nt, timingsV2, memory, firstPaint, siteToken, …`. Keine Cookies, kein Storage. `src/features/legal/PrivacyPolicy.tsx:99-102`. Genannt nur in `src/features/legal/SubProcessors.tsx:73-81`. Eigene Vorgabe: `public/_headers:17-19` („Beides steht noch aus“). | Abschnitt „Reichweitenmessung Cloudflare Web Analytics“ in die Datenschutzerklärung aufnehmen: Zweck, Art. 6 Abs. 1 lit. f, cookieless, Empfänger Cloudflare Inc. (USA), Transfergrundlage. Rechtstext ist **freigabepflichtig**. |
| 5 | Kein sichtbarer Widerruf. Der Banner lässt sich über `openCookieSettings()` wieder öffnen, aber Startseite (`LandingV6`) und Datenschutzerklärung binden das nicht ein. Die Datenschutzerklärung sagt: „jederzeit über das Cookie-Banner widerrufen“. | Mittel | Laufzeit `pages.dev/` und `/datenschutz`: einziger Link mit „Cookie“ ist „Cookie-Pflichten“, ein Inhaltslink. Code: `openCookieSettings` nur in `src/enterprise-os/layout/PublicFooter.tsx:97` und im Alt-Landing `src/pages/Landing.tsx:640`. Reset nur eingeloggt: `src/features/settings/SettingsView.tsx:236`. Versprechen: `PrivacyPolicy.tsx:205`. | Link „Cookie-Einstellungen“ in den Footer der Startseite und in die Datenschutzerklärung (Art. 7 Abs. 3 DSGVO: Widerruf so einfach wie Erteilung). |
| 6 | „Anonym“ ist sachlich falsch. Der Banner nennt Statistik „Anonyme Nutzung“, die Datenschutzerklärung GA4 „anonymisiert“. `track-pageview` speichert HMAC-Hashes aus IP, User-Agent und Tag plus Land. Das ist **pseudonym**, also personenbezogen. Die eigene Pageview-Statistik (`page_views`) und `marketing-event` stehen gar nicht in der Datenschutzerklärung. | Mittel | `src/components/CookieConsent.tsx:168`. `PrivacyPolicy.tsx:249`. `supabase/functions/track-pageview/index.ts:41-49`, `:60`, `:64-74`. Laufzeit `pages-C`: `POST …/functions/v1/track-pageview`, Body-Felder `['path']`. | Wording auf „pseudonymisiert“ ändern. Pageview-Statistik und Funnel-Events mit Speicherdauer in die Datenschutzerklärung aufnehmen. Text ist **freigabepflichtig** (Claims/Recht). |
| 7 | Einwilligung ohne Nachweis. Die Entscheidung liegt nur im `localStorage` (`realsync.cookie-consent.v1`). Es gibt weder Server-Log noch Audit-Eintrag noch Evidence-Vault-Eintrag. Das passt nicht zum eigenen Governance-Versprechen (Consent, Audit-Log, Evidence-Vault), und Art. 7 Abs. 1 DSGVO verlangt Nachweisbarkeit. | Mittel | `src/components/CookieConsent.tsx:90-102` (nur `localStorage.setItem`, Zeile 96). Keine Tabelle oder Function für Website-Consent-Logs gefunden (`grep consent_log\|cookie_consent` in `supabase/functions`, `supabase/migrations`). Laufzeit `pages-B`/`pages-C`: nur `localStorage`-Eintrag, kein Request. | Pseudonymen Consent-Beleg serverseitig ablegen (Version, Kategorien, Zeitstempel, zufällige Beleg-ID, ohne IP im Klartext). Das ist eine Migration und eine neue Function, also **freigabepflichtig**. |
| 8 | Das „Stand“-Datum der Datenschutzerklärung ist dynamisch und zeigt immer das heutige Datum. Es belegt damit keinen tatsächlichen Änderungsstand. | Niedrig | `PrivacyPolicy.tsx:29` (`new Date().toISOString()`). Laufzeit `/datenschutz`: „Stand 2026-11-17“. | Festes Datum oder Version pflegen und bei Änderungen erhöhen, gekoppelt an `CONSENT_VERSION`. |
| 9 | Abschnitt 9 „Cookies“ ist unvollständig. Genannt ist nur das „Session-Cookie für Login“. Vor der Einwilligung werden zusätzlich gesetzt: Cookie `rsd_csrf` (Secure, SameSite=Strict, nicht httpOnly, ca. 12 h) sowie `localStorage` `rsd.flow.state.v1`, `rsd_governance_environment` und später der Consent-Eintrag. Ohne Einwilligung zulässig (§ 25 Abs. 2 TDDDG), aber nicht dokumentiert. | Niedrig | Laufzeit `pages-A`: Cookie `rsd_csrf`, `localStorage`-Keys wie genannt, Inhalte ohne Kennungen. `PrivacyPolicy.tsx:191-197`. | Cookie- und Storage-Tabelle (Name, Zweck, Dauer, Rechtsgrundlage) in Abschnitt 9. |
| 10 | Die Apex-HTML enthält `preconnect` zu `fonts.googleapis.com`/`fonts.gstatic.com`, obwohl die Fonts eingebettet sind. Für Three.js und Globus-Texturen ist `cdn.jsdelivr.net` als Fallback hinterlegt. Im Test wurde keiner dieser Requests beobachtet. | Niedrig | Apex-HTML, Byte-Offset ca. 5.477.452 (`<link rel="preconnect" …>`) und ca. 5.619.478 / 5.621.021 (jsDelivr-Fallback). Playwright `apex-A`: 0 Requests an diese Hosts. Ein Preconnect-Socket erscheint nicht als Request, deshalb ist ein Verbindungsaufbau zu Google **Annahme**. | `preconnect` und CDN-Fallbacks entfernen (Google Fonts: IP-Übermittlung an Google, vgl. LG München I, 20.01.2022, 3 O 17493/20). |
| 11 | Das Voice-Widget nutzt die Web-Speech-API des Browsers. In Chrome verarbeitet Google die Audiodaten. Der Hinweistext im Widget sagt das, die Datenschutzerklärung nicht. | Niedrig | `/company-voice/widget.js`, Konstante `NOTICE`. Das Widget selbst macht keine Netzwerk-Requests (kein `fetch`/`WebSocket`). Verarbeitung durch Google ist **Annahme** (bekanntes Chrome-Verhalten, im Test nicht beobachtet, Mikrofon nicht ausgelöst). | Kurzen Abschnitt „Spracheingabe im Browser“ in die Datenschutzerklärung aufnehmen. |
| 12 | Das Consent-Gating im Repo-Code funktioniert. Vor der Entscheidung und nach „Ablehnen“ gibt es nur Same-Origin-Requests. Nach „Akzeptieren“ nur `track-pageview`. Kein Marketing-Pixel lädt. Consent Mode Default `denied`. „Ablehnen“ ist gleich groß wie „Akzeptieren“. Schließen (X) zählt als „nur notwendig“. | Info (positiv) | Playwright `pages-A`: 19/19 Requests an `pages.dev`. `pages-B`: 191/191 an `pages.dev`. `pages-C`: dazu 2× `POST …supabase.co/functions/v1/track-pageview`. Code: `src/lib/pixels.ts:138-143`, `:215-235`. `CookieConsent.tsx:140-151`, `:187-191`. | Beibehalten. Szenarien A/B/C als E2E-Test absichern, falls noch nicht vorhanden. |
| 13 | Die beiden `track-pageview`-Requests endeten im Test mit `net::ERR_ABORTED`. Wahrscheinlich hat die Navigation `keepalive` abgebrochen. Ob der Eintrag gespeichert wurde, ist nicht geprüft. | Info | `result-pages.json`, Feld `failed` (Szenario `pages-C`). | Separat prüfen (Function-Logs, Zeilenzähler in `page_views`). Nur lesend, aber mit Projektzugriff. |
| 14 | Secrets-Scan der ausgelieferten Bundles: keine Secrets gefunden. Der Supabase-Schlüssel `sb_publishable_…` steht in der Apex-HTML und im SPA-Bundle. Er ist öffentlich vorgesehen, Schutz kommt über RLS. Keine Source-Maps (`.map` → 404). 19 `console.log`/`console.debug` in 3 Bundles. | Info | 167 JS-Dateien von `pages.dev` plus Apex-HTML und Widget, Muster für Stripe-, Anthropic-, OpenAI-, Supabase-Secret-, GitHub-, Slack-Keys und JWT. Treffer `service_role` = Redaktions-Regex in `LandingV6-*.js`. Treffer `AIza…` = Base64-Bilddaten in der Apex-HTML. Fundorte publishable Key: Apex-HTML (Kontaktformular-Code), SPA-Bundle. | Keine Pflicht-Aktion. Optional: `console.*` im Prod-Build entfernen. |
| 15 | Die CSP auf `pages.dev` erlaubt `connect-src http://127.0.0.1:11434 http://localhost:11434` (Ollama lokal) und `style-src 'unsafe-inline'`. | Niedrig | `public/_headers:27`. | Nur behalten, wenn `eu_local` im Browser wirklich gebraucht wird. Sonst entfernen. |

---

## 3. Drittanbieter und Empfänger

„Beobachtet“ = im Browser-Test als Request gesehen. „Code“ = nur im Quelltext belegt.
„Annahme“ = nicht belegt.

| Domain / Endpunkt | Anbieter | Zweck | Datenkategorien | Zeitpunkt | Status | Ort |
|---|---|---|---|---|---|---|
| `realsyncdynamicsai.de`, `realsyncdynamics-ai.pages.dev` | Cloudflare, Inc. (Hosting/CDN) | Auslieferung | IP, User-Agent, URL, Request-Metadaten | jeder Aufruf | beobachtet | Annahme: global, Sitz USA |
| `static.cloudflareinsights.com`, `…/cdn-cgi/rum` | Cloudflare, Inc. | Web Analytics (cookieless) | IP (Transport), URL, Ladezeiten, Speicher- und Paint-Metriken, Site-Token | Apex, **sofort, ohne Einwilligung** | beobachtet | USA (Annahme) |
| `ebljyceifhnlzhjfyxup.supabase.co/functions/v1/track-pageview` | Supabase | Pageview-Statistik | Pfad (Client). Serverseitig IP+UA → HMAC-Hash pro Tag, Land, Referrer ohne Query, UTM | nach Einwilligung „Statistik“ | beobachtet | Frankfurt laut Datenschutzerklärung (Region nicht technisch geprüft) |
| `…supabase.co/functions/v1/marketing-event` | Supabase | Funnel-Events | Event-Name, bereinigte Metadaten | nach Einwilligung „Statistik“ oder „Marketing“ bei Funnel-Schritten | Code (`src/lib/marketingAnalytics.ts`) | wie oben |
| `…supabase.co/functions/v1/sales-lead` | Supabase | Kontaktformular der Apex-Seite | Kontaktdaten aus dem Formular | beim Absenden | Code (Apex-HTML). Nicht ausgelöst, weil nur lesend geprüft wurde | wie oben |
| `connect.facebook.net`, `analytics.tiktok.com`, `googletagmanager.com`, `snap.licdn.com` | Meta, TikTok, Google, LinkedIn | Marketing-Pixel, GA4 | Kennungen, Events | nur nach Einwilligung **und** gesetzter `VITE_*`-ID | Code. **Nicht beobachtet** nach „Alles akzeptieren“, IDs vermutlich nicht gesetzt (Annahme) | USA/EU |
| `*.ingest(.de).sentry.io` | Functional Software (Sentry) | Fehler-Monitoring | Fehlerdaten | nur mit `VITE_SENTRY_DSN` | Code (`src/lib/sentry.ts:9`), nicht beobachtet | EU-Endpunkt möglich |
| `fonts.googleapis.com`, `fonts.gstatic.com` | Google | nur `preconnect` | ggf. IP beim Verbindungsaufbau | Apex | Code. Verbindung = Annahme | USA |
| `cdn.jsdelivr.net` | jsDelivr (Fastly/Cloudflare) | Fallback für Three.js/Texturen | IP | nur wenn eingebettete Ressource fehlt | Code, nicht beobachtet | global |
| Web Speech API (Browser) | Google (Chrome) | Spracheingabe Voice-Widget | Audio | nach Klick auf Mikrofon | Annahme | USA |

**Daten außerhalb EU/EWR:** Belegt ist ein Request an Cloudflare-Infrastruktur
(`static.cloudflareinsights.com`). Dass Cloudflare die Daten in den USA verarbeitet, ist eine
**Annahme**, die vertraglich zu prüfen ist (DPA, DPF-Zertifizierung). Weitere US-Empfänger
(Google, Meta, TikTok, LinkedIn) kommen nur nach Einwilligung, Konfiguration oder Mikrofon-Nutzung
in Frage und wurden im Test nicht beobachtet.

---

## 4. Abgleich mit der Datenschutzerklärung

Quelle: `src/features/legal/PrivacyPolicy.tsx`, live unter
`https://realsyncdynamics-ai.pages.dev/datenschutz`.

**Stimmt:**
- Einwilligungspflicht für Pixel und Analytics und deren Rechtsgrundlage (Abschnitt 10).
  Technisch so umgesetzt (Befund 12).
- Cloudflare, Supabase, Stripe und KI-Anbieter sind als Empfänger genannt (Zeilen 99-102).
- Die Sub-Prozessoren-Seite nennt Cloudflare Web Analytics und Sentry
  (`SubProcessors.tsx:73-101`).

**Fehlt:**
- Cloudflare Web Analytics als eigene Verarbeitung mit Zweck und Rechtsgrundlage (Befund 4).
- Eigene Pageview-Statistik (`track-pageview`/`page_views`) mit Hash-Verfahren und
  Speicherdauer (Befund 6).
- Funnel-Events (`marketing-event`).
- Cookie- und Storage-Tabelle: `rsd_csrf`, `rsd.flow.state.v1`, `rsd_governance_environment`,
  `realsync.cookie-consent.v1` (Befund 9).
- Spracheingabe über Web Speech API (Befund 11).
- Kontaktformular der Apex-Seite (`sales-lead`). Zu prüfen im Audit „Kontaktformular“.
- Hinweis, dass Login und Rechtstexte auf `realsyncdynamics-ai.pages.dev` laufen (Befund 3).

**Stimmt nicht:**
- „Stand“-Datum ist dynamisch (Befund 8).
- „anonymisiert“ (GA4-Zeile) und „Anonyme Nutzung“ (Banner) (Befund 6).
- „Widerruf jederzeit über das Cookie-Banner“: Auf Startseite und Datenschutzseite gibt es
  keinen Zugang dazu (Befund 5).

**Widerspruch Doku/Code:** `docs/qa/produktions-akzeptanz.md` §5.4 sagt, die
Datenschutzerklärung nenne Cloudflare „überhaupt nicht“. Der aktuelle Code nennt Cloudflare
als Empfänger (Zeile 99). Offen bleibt nur Web Analytics. Die Doku ist veraltet.

---

## 5. Offene Fragen und Annahmen

**Offene Fragen:**
1. Welches Cloudflare-Projekt oder welcher Worker bedient `realsyncdynamicsai.de`, und wo liegt
   die Quelle des gebündelten HTML? Wer hat die 302-Weiterleitungen angelegt?
2. Sind die `VITE_*`-Pixel-IDs im Produktions-Build bewusst leer?
3. Wird `page_views` tatsächlich beschrieben (Befund 13)? Ist `PAGEVIEW_HASH_SALT` gesetzt?
4. Gibt es einen AVV/DPA mit Cloudflare für Web Analytics? `public/_headers:18-19` nennt das
   als offen.
5. Soll die Apex-Seite eigene Rechtstexte bekommen, oder bleibt die Weiterleitung auf `pages.dev`?

**Annahmen (nicht belegt):**
- Cloudflare verarbeitet Analytics-Daten in den USA.
- Ein `preconnect` zu Google Fonts baut im echten Browser eine Verbindung auf.
- Chrome überträgt Web-Speech-Audio an Google.
- Supabase-Projekt `ebljyceifhnlzhjfyxup` liegt in Frankfurt (laut Datenschutzerklärung, nicht
  technisch geprüft).

**Belegt (Auszug):** Header beider Origins, Request-Listen der Szenarien A/B/C, Cookies und
Storage vor und nach der Entscheidung, Code-Stellen mit Zeilennummern, Ergebnis des
Secrets-Scans.

---

## 6. Prüfpfad (Methode und Werkzeuge)

- **REA:** In dieser Session nicht verbunden. Die Werkzeugsuche nach „REA“ fand kein passendes
  Werkzeug. Ersatzweise verwendet:
  - **Playwright 1.63.0 / Chromium 153** (headless, `de-DE`, 1366×900)
  - `curl` für Header, Weiterleitungen und Bundles
  - `grep`/Python für Code- und Bundle-Analyse
- **Szenarien je Origin:**
  - A: Erstaufruf ohne Entscheidung, 4 s warten
  - B: „Alle ablehnen“, danach Navigation auf `/preise`
  - C: „Alles akzeptieren“, danach Navigation auf `/preise`
  - Erfasst: alle Requests (Host, Pfad, Query- und Body-Feldnamen, keine Werte), Cookies,
    `localStorage`, `sessionStorage`, Script-Tags.
- **Apex:** Nur Szenario A möglich, weil dort kein Banner existiert.
- **Secrets-Scan:** 167 JS-Dateien von `pages.dev`, Apex-HTML und `widget.js`. Werte wurden nicht
  ausgegeben.
- **Nicht geprüft:** Login-Flow, eingeloggte Bereiche, Absenden des Kontaktformulars,
  Mikrofon-Nutzung, Supabase-Logs und -Tabellen, Cloudflare-Dashboard.
- **Rohdaten:** Lagen nur temporär im Session-Scratchpad und sind nicht Teil des Repos.

---

## 7. Status

- **Ergebnis:** GELB. 2× Hoch (Header auf der Apex, Herkunft der Live-Startseite), 5× Mittel,
  5× Niedrig, 3× Info.
- **Prüfumfang:** TEILWEISE. Consent-Feature auf beiden Origins zur Laufzeit und im Code
  geprüft. Backend-Persistenz und Verträge nicht geprüft.
- **Blocker:**
  - REA nicht verfügbar.
  - Kein Zugriff auf die Cloudflare-Konfiguration der Apex-Domain.
  - Kein lesender Supabase-Zugriff für die Prüfung von `page_views` in dieser Session.
- **Nächster Schritt:**
  1. Befund 1 und 2 klären: Woher kommt die Apex-Seite? Header angleichen.
  2. Danach Rechtstext-Paket für Befund 4, 5, 6, 8, 9 und 11 als **ein** Draft-PR zur Freigabe.

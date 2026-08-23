# Öffentlicher Scan-Trichter — Landingpage → Scan → Ergebnis → Konto → Marketplace

**Stand**: 2026-08-23
**Bezug**: Auftrag „RealSyncDynamics.AI — Landingpage / Scan / Dashboard / Marketplace Refactor"
**Vorgänger**: `docs/product/modular-product-experience.md` (Phasen 2–6),
`docs/product/reality-matrix.md` (Phase 0, Messung)

Dieses Dokument beschreibt den **umgesetzten** Zustand. Wo etwas fehlt, steht
das ausdrücklich da — nicht als Absicht formuliert, sondern als Lücke benannt.

---

## 1. Der Grundsatz

> Der Kunde sieht **vor** dem Bezahlen einen echten Nutzen. Bezahlt wird
> anschliessend für Umsetzung, Überwachung und Erweiterung.

Daraus folgt die Reihenfolge:

```
Startseite  →  /scan  →  /scan/ergebnis  →  Registrierung  →  /app/*  →  /app/marketplace
   ↑             ↑            ↑                   ↑                          ↑
Vertrauen    Adresse      Wow-Moment          Übernahme                Monetarisierung
```

Es gibt genau **einen** primären Einstieg. Die übrigen Fähigkeiten der
Plattform bleiben auf der Startseite erklärt, aber nicht als gleichwertige
Handlungsaufforderung (Auftrag §24/§25).

---

## 2. Was **nicht** neu gebaut wurde — und warum das der Kern ist

Der Auftrag verlangt in §26 und §34 ausdrücklich eine Bestandsaufnahme vor
jeder Änderung und verbietet, eine Architektur zu erfinden, wo eine
funktionierende existiert. Die Bestandsaufnahme ergab:

| Baustein | Zustand | Konsequenz |
|---|---|---|
| Analyse-Engine über acht Dimensionen | **vorhanden** — `analyzeObservation()` in `packages/siteos-core/src/analysis/observation.ts`, mit Rechtsbezügen je Befund | wiederverwendet, **nicht** angefasst |
| Scoring mit Gewichten und Prüfpfad-Tauglichkeit | **vorhanden** — `computeScores()` in `packages/siteos-core/src/scoring/scores.ts` | wiederverwendet, Gewichte unverändert |
| Anonymer Prüfpfad + Kontingent | **vorhanden** — `anon_chat_runs`, `reserveAnonAudit()`, `checkAnonRateLimit()`; die Operation `start_audit_scan` existierte bereits | wiederverwendet |
| Anonyme Zeile ohne `tenant_id` + Übernahme | **vorhanden als Muster** — `siteos_anonymous_builds` (Migration 20260822180000) | Muster übernommen |
| Registrierung → Onboarding → Dashboard | **vorhanden** — `/unified-entry/register` … `/unified-entry/success` | wiederverwendet, nicht nachgebaut |
| Entitlements, Stripe, Pläne | **vorhanden** — `tenant_entitlements()`, `stripe-checkout`, `shared/pricing.ts` | wiederverwendet |
| Modulkatalog `BOOKABLE_MODULES` | **vorhanden** (Phase 1) | trägt jetzt den Marketplace |

**Neu ist damit nur der Zugang**, nicht die Analyse: derselbe Prüfstand, ohne
Anmeldung, für eine fremde Domain.

Das ist der Grund, warum die Änderung trotz ihres Umfangs klein bleibt — die
eigentliche Arbeit lag darin, das Vorhandene zu finden.

---

## 3. Die Analyse

### 3.1 Acht Prüfdimensionen, sechs Kundenkategorien

Die Engine rechnet auf acht Dimensionen; der Bericht zeigt sechs Kategorien.
Die Abbildung steht an genau einer Stelle
(`supabase/functions/_shared/public-scan/report.ts`, `CATEGORY_DIMENSIONS`):

| Kundenkategorie | Prüfdimensionen |
|---|---|
| DSGVO & Datenschutz | `gdpr`, `tdddg` |
| EU AI Act | `eu-ai-act` |
| SEO & Auffindbarkeit | `seo` |
| Barrierefreiheit | `accessibility` |
| Sicherheit | `security` |
| Technik & Nutzererlebnis | `performance`, `content` |

`test/public-scan/report.test.ts` prüft, dass **jede** Dimension in genau
einer Kategorie landet. Ohne diesen Test verschwände ein Befund lautlos aus
dem Bericht, sobald `siteos-core` eine Dimension ergänzt.

Der Gesamtscore ist `computeScores().health` — der bereits gewichtete Index,
keine zweite Rechnung daneben.

### 3.2 Was der öffentliche Scan zusätzlich erkennt

`analyzeObservation()` prüft eine **eigene** Site; zwei Dinge fehlen dort für
eine fremde (`supabase/functions/_shared/public-scan/detectors.ts`):

1. **KI-Einsatz muss erkannt werden, bevor er beurteilt werden kann.** Die
   SiteOS-Analyse bekommt `expectsAiDisclosure` von aussen gesetzt — bei einer
   fremden Seite gibt es niemanden, der das setzen könnte. Erkannt werden
   deshalb KI-Dienste (API-Endpunkte, SDK-Spuren) und Chat-Widgets; erst
   daraus entsteht der Befund nach Art. 50 EU AI Act.
2. Signale, die im Kundengespräch den Ausschlag geben: fremd geladene
   Schriften (Google Fonts — LG München I, 3 O 17493/20), Analyse-Werkzeuge
   ohne Einwilligungs-Werkzeug, Formulare ohne Datenschutz-Hinweis, fehlende
   Viewport-Angabe, `noindex` auf der Startseite, erkannte Technologie.

Alle Zusatzbefunde nutzen **bestehende** Dimensionen. Die Gewichte in
`scoring/scores.ts` bleiben damit unangetastet — SiteOS-Monitoring und
öffentlicher Scan teilen sich die Messlatte, ohne einander zu verschieben.

### 3.3 Die Sprachregel

Der Bericht entsteht ohne Mandat und ohne Kenntnis der Verarbeitungsvorgänge.
Er darf **niemals** Konformität zusichern.

- verboten: „Website ist DSGVO-konform"
- zulässig: „Keine offensichtlichen Probleme erkannt", „Potenzielle Risiken erkannt"

Das steht nicht als Bitte im Kommentar, sondern als Test
(`test/public-scan/report.test.ts`, Abschnitt „Sprachregel"): Er prüft jede
Urteilsstufe gegen ein Verbotsmuster und stellt sicher, dass der
Haftungshinweis in **jedem** Bericht steht — auch in einem makellosen.

Ergänzend meldet der Bericht `coverage: 'limited'`, wenn der Abruf kaum
auswertbares HTML lieferte. Ohne diesen Zustand läse sich eine misslungene
Messung als makelloses Ergebnis — der gefährlichste Fehler dieser Seite.

---

## 4. Sicherheit

### 4.1 SSRF

Der Endpunkt ruft eine Adresse ab, die ein **nicht angemeldeter** Besucher
bestimmt. `supabase/functions/_shared/public-scan/target.ts` lässt
ausschliesslich http/https auf öffentliche Hosts über die Standard-Ports zu;
abgelehnt werden interne Zonen, Adressliterale aus privaten Bereichen,
Zugangsdaten in der URL und Hostnamen ohne Punkt.

Zwei Befunde aus der Testarbeit, die sonst niemand mehr nachvollziehen könnte:

- **IPv4-gemappte IPv6-Adressen werden vom Parser in Hex umgeschrieben.**
  `[::ffff:169.254.169.254]` wird zu `[::ffff:a9fe:a9fe]`. Eine Prüfung, die
  nur die gepunktete Schreibweise kennt, lässt genau die Cloud-Metadaten-
  Adresse durch. Der erste Entwurf tat das; der Test fand es.
- **Oktal-, Hex- und Ganzzahlschreibweisen löst der WHATWG-Parser selbst
  auf.** `0177.0.0.1`, `0x7f.0.0.1`, `2130706433` und `127.1` kommen alle als
  `127.0.0.1` an. Eine eigene Erkennung wäre nicht nur überflüssig, sie würde
  öffentliche Adressen fälschlich sperren (`010.0.0.1` → `8.0.0.1`).

Bekannte Grenze, ausdrücklich nicht geschlossen: **DNS-Rebinding**. Dafür
müsste der Host vor dem Abruf aufgelöst und die Verbindung an die geprüfte
Adresse gebunden werden. Die Schranke senkt die Angriffsfläche, ersetzt aber
keine Netzsegmentierung.

### 4.2 Menge und Zeit

Der Abruf liest **streamend** und bricht bei der Obergrenze ab
(`observe.ts`). `response.text()` würde die vollständige Antwort in den
Speicher ziehen — eine Datei von einem Gigabyte hinter einer harmlos
aussehenden Adresse wäre damit ein Denial-of-Service gegen die eigene
Funktion. Der Test dazu füttert einen **endlosen** Strom; ohne Abbruch liefe
er nicht durch.

Dazu: 12 s Zeitgrenze, 4 Scans je Minute und IP-Hash in eigenem Zählerraum.

### 4.3 Mandantentrennung und Zugriff

`public_site_scans` (Migration `20260826000000`) trägt `tenant_id NULL` bis
zur Übernahme.

- **Vor der Übernahme**: kein Weg über PostgREST. Die SELECT-Policy verlangt
  `tenant_id IS NOT NULL`; eine anonyme Zeile erfüllt sie nie. Erreichbar ist
  sie nur über die Edge Function mit service_role, und die verlangt die
  Scan-Kennung (UUIDv4, 122 Bit Zufall). Es gibt keine Auflistung und keine
  Aufzählbarkeit — damit ist die Forderung aus §28 des Auftrags erfüllt, dass
  eine Kennung nicht genügt, um *beliebige* fremde Berichte zu holen.
- **Nach der Übernahme**: gewöhnliche Mandantentrennung über
  `is_tenant_member()`.

Die Übernahme (`public-site-scan/claim`) löst den Mandanten aus dem **Token**
des Aufrufers auf, nie aus dem Anfragekörper. Sie ist idempotent und schliesst
über ein bedingtes `UPDATE … WHERE tenant_id IS NULL` das Rennen zweier
gleichzeitiger Übernahmen aus.

### 4.4 Datenminimierung

Kein HTML der geprüften Seite wird gespeichert (Art. 5 Abs. 1 lit. c DSGVO) —
nur die abgeleiteten Befunde, Kennzahlen und erkannten Technologien. Die IP
liegt als Hash vor. Nicht übernommene Scans verfallen nach sieben Tagen
(Art. 5 Abs. 1 lit. e DSGVO).

---

## 5. Marketplace

`/app/marketplace` zeigt die neun `BOOKABLE_MODULES` mit ihrem **tatsächlichen**
Zustand. Die Zustandsermittlung liegt als reine Funktion in
`src/features/market/moduleCatalog.ts` und ist getestet — ein „aktiv", hinter
dem nichts steht, wäre schlimmer als gar kein Marketplace.

- Aktiv ist ein Modul nur, wenn **alle** seine `unlocks` im Plan liegen
  (`hasModule()`, nie ein Vergleich von Plan-Namen).
- Ein Modul ohne `unlocks` (`ai_frontend`) gilt nie als aktiv — sonst hätte
  `every()` auf der leeren Menge es bei jedem Kunden als vorhanden angezeigt.

### Was hier bewusst fehlt

**Ein Kaufweg je Modul.** Der modulare Checkout (Phase 5) verlangt ein eigenes
Stripe-Price-Objekt je Modul; die gibt es nicht, und `stripe-checkout` nimmt
ausschliesslich einen `plan_key` entgegen. Statt eines Knopfes „Aktivieren",
den niemand einlöst, nennt jede Karte den Plan, über den das Modul heute
erreichbar ist. Das ist die Regel aus `CLAUDE.md` §14: kein Element
vortäuschen, das nichts tut.

Aus demselben Grund kennt `ServiceStatus` nur `active` und `available` statt
der sechs Zustände aus §13 des Auftrags. `pending` und `cancelled` entstehen
erst mit dem modularen Checkout, `preview` erst mit Testzugängen je Modul. Ein
Zustand, den niemand erzeugen kann, ist kein Zustand, sondern eine Behauptung.

---

## 6. Deployment-Zustand

`public-site-scan` liegt im Repository und ist **nicht gemessen deployt**. Der
Slug steht deshalb in `UNBACKED_CALLERS`, nicht in `PRODUCTION_EDGE_FUNCTIONS`
— jene Liste ist eine Messung gegen das Live-Projekt, und ein Verzeichnis im
Repository ist keine.

Bis zum Deploy zeigt `/scan` den `EdgeFunctionAvailabilityNotice`. Er
verschwindet durch das Deployment, nicht durch einen weiteren Commit.

**Nach dem Deploy sind drei Dinge zu tun:**

1. `supabase functions list` gegen das Live-Projekt messen.
2. `public-site-scan` aus `UNBACKED_CALLERS` nach `PRODUCTION_EDGE_FUNCTIONS`
   verschieben, `EDGE_FUNCTIONS_OBSERVED_MAX` und
   `PRODUCTION_EDGE_FUNCTIONS_MEASURED_AT` mitziehen.
3. Migration `20260826000000_public_site_scans.sql` anwenden.

`test/backend/edge-function-contract.test.ts` erzwingt Schritt 2: Ein Eintrag
in `UNBACKED_CALLERS`, der inzwischen deployt ist, lässt den Test rot werden.

---

## 7. Offene Punkte

Benannt statt übergangen (`CLAUDE.md` §14).

| # | Punkt | Warum offen |
|---|---|---|
| 1 | **Modularer Checkout** | Braucht Stripe-Price je Modul. Vorbedingung: die Preiskalkulation (`MODULE_PRICING_STATUS = 'provisional'`). |
| 2 | **Scan im Dashboard sichtbar** | Der übernommene Scan liegt in `public_site_scans` und ist über RLS lesbar, hat aber noch keine eigene Dashboard-Fläche. Bis dahin ist die Übernahme korrekt, aber unsichtbar. |
| 3 | **Frontend Modernizer als geführter Ablauf** | §14/§15 des Auftrags (Stilwahl, Referenz-Upload, Vorschau, Freigabe) ist nicht umgesetzt. Der bestehende SiteOS-Pfad deckt Teile ab; der Publish Gate muss davor stehen. |
| 4 | **Doppelter Abrufcode** | `siteos/handlers/runtime-scan.ts` enthält eine eigene `observe()`-Fassung mit derselben Aufgabe wie `_shared/public-scan/observe.ts`. Bewusst nicht zusammengeführt: Das hätte einen produktiven SiteOS-Pfad angefasst, ohne dass der Auftrag es verlangt. Zusammenführen ist ein sauberer Folgeschritt. |
| 5 | **`production-edge-functions.ts` ist gegenüber `CLAUDE.md` veraltet** | Die Datei nennt „177 im Repository, 103 in Produktion" (Messung 2026-08-19); `CLAUDE.md` §5 nennt eine Messung vom 2026-08-22 mit 177/177. Beide können nicht stimmen. **Vor der nächsten Aussage zum Produktionsstand neu messen** — die Datei selbst mahnt genau das an. |
| 6 | **WhatsApp-Agent** | Weiterhin ohne Tabelle und ohne Edge Function (Reality Matrix). Der Marketplace führt das Modul, weist es aber nie als aktiv aus. |
| 7 | **Drei anonyme Scan-Pfade nebeneinander** | Siehe §7.1. Braucht eine Entscheidung des Eigentümers, keine stille Angleichung. |

### 7.1 Der wichtigste offene Punkt: drei Scan-Pfade

Nach dieser Änderung führen **drei** Wege zu einem anonymen Scan:

| Weg | Analyse | Persistenz | Übernahme ins Konto |
|---|---|---|---|
| `/audit` | `gdpr-audit` | `gdpr_audits` (159 Zeilen live) | **Schema vorhanden, kein Schreiber** |
| `/unified-entry/scan` | `cookie-scan` | keine — die Kennung `urlscan-<Zeitstempel>` ist erfunden | nicht möglich |
| `/scan` *(neu)* | `siteos-core`, acht Dimensionen | `public_site_scans` | **funktioniert** |

**Gemessen, nicht vermutet** (2026-08-23):

- `gdpr_audits` trägt seit Migration `20260811020648_pilot_activation` die
  Spalten `user_id`, `tenant_id` und `claimed_at`, samt Index
  `idx_gdpr_audits_unclaimed` und Kommentaren, die genau den Übergang
  „anonym → tenant-eigen" beschreiben.
- Eine Suche über `supabase/functions/` und `src/` nach einem Schreiber auf
  `claimed_at` liefert **keinen einzigen Treffer**. Die Übernahme war
  vorgesehen und ist nie gebaut worden.

**Warum hier trotzdem eine eigene Tabelle entstanden ist**: `gdpr_audits`
hält das Ergebnis einer DSGVO-Prüfung. Der öffentliche Scan liefert einen
Bericht über sechs Kategorien aus acht Dimensionen — eine andere Nutzlast mit
anderer Struktur. Sie in `gdpr_audits` zu pressen hätte zwei verschiedene
Analysen in einer Tabelle vermischt.

**Was das nicht rechtfertigt**: drei Pfade dauerhaft nebeneinander. Die
Entscheidung, welcher bleibt, gehört dem Eigentümer und nicht einem stillen
Refactoring. Drei Möglichkeiten, ohne Empfehlung vorab:

1. `/audit` behält die DSGVO-Tiefe, `/scan` wird der Breiten-Einstieg — dann
   braucht `/audit` den fehlenden Claim-Schreiber (das Muster dafür liegt
   jetzt in `public-site-scan/claim`).
2. `/scan` löst `/audit` ab — dann wird `/audit` zur Weiterleitung und die
   alte Seite entfernt (`CLAUDE.md` §14: „Abgelöstes benennen").
3. `/unified-entry/scan` fällt weg — es ist der einzige Pfad ohne jede
   Persistenz und damit der schwächste der drei.

Unabhängig von der Entscheidung ist der dritte Punkt der billigste: Ein Scan,
dessen Ergebnis niemand behalten kann, erzeugt keinen Nutzen, der eine
Registrierung trägt.

---

## 8. Regeln für das Weiterbauen

- Befund-Codes und Scoring-Gewichte sind **versionsrelevant**. Neue Codes
  ergänzen ist frei; umbenennen oder Gewichte ändern nicht.
- `PUBLIC_SCAN_ENGINE_VERSION` bei jeder inhaltlichen Änderung der Auswertung
  hochzählen — sonst sind zwei Berichte verschiedener Stände nicht
  vergleichbar.
- Die Sprachregel aus §3.3 ist nicht verhandelbar.
- Keine Berechtigung über Plan-Namen — nur `hasModule()`, `hasPermission()`,
  `limitOf()`.
- Neue anonyme Pfade: Prüfpfad zuerst, dann Kontingent, dann Zielprüfung, dann
  Arbeit. Wer erst arbeitet und danach protokolliert, hat die Lücke im
  Prüfpfad genau dort, wo sie am meisten stört.

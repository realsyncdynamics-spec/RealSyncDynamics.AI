# Free-Scan-Recovery — Ausfall, Vertrag, Wiederherstellung

**Erhoben und behoben am**: 2026-08-30
**Betroffen**: `/audit` — der kanonische anonyme Einstieg
(`docs/product/canonical-funnel-decision.md` §1)
**Messgrundlage**: Repository `main`, Live-Projekt `RealSyncDynamicsLive`
(`ebljyceifhnlzhjfyxup`, eu-central-1, PostgreSQL 17), Edge-Function-Version 46
über die Management-API, alle 159 Zeilen in `gdpr_audits`

Dieses Dokument hält **Gemessenes** fest. Wo etwas nicht geprüft werden
konnte, steht das ausdrücklich da — nicht eine plausible Vermutung.

---

## 1. Der Befund

`supabase/functions/gdpr-audit/index.ts` rief sechs Funktionen auf, die
nirgends definiert waren:

| Aufruf | Zeile (vorher) | Wirkung |
|---|---|---|
| `fetchWithTimeout(url, 10_000)` | im `try` | gefangen → `fetch_error` gesetzt |
| `concat(chunks)` | im `try` | gefangen |
| **`runChecks(...)`** | **ausserhalb jedes `try`** | **`ReferenceError` → HTTP 500** |
| `scanSubpages(...)` | danach | nie erreicht |
| `extractFacts(...)` | danach | nie erreicht |
| `scoreReport(...)` | danach | nie erreicht |

Die Datei endete nach dem `Deno.serve`-Block mit der Überschrift
`// ─── Heuristik-Checks ───` und sonst nichts.

**Das galt nicht nur im Repository, sondern auch in Produktion.** Der Abruf
der deployten Function-Version 46 lieferte denselben abgeschnittenen Inhalt.

### Wirkung

Jeder `POST /functions/v1/gdpr-audit` lief durch die Eingabevalidierung, den
Rate-Limit-Check und den Abruf der Zielseite — und starb dann an
`runChecks is not defined`. Der Aufrufer bekam HTTP 500.

### Beleg in den Daten

```
select count(*), max(created_at) from gdpr_audits;
→ 159 | 2026-08-11 15:58:10+00
```

Der abgeschnittene Stand kam am **2026-08-16** ins Repository (`7cfc199`,
217 Zeilen, als Neuanlage — die Datei war also nie vollständig in dieser
History). Seither: **null Audits**. Der Ausfall blieb **18 Tage** unbemerkt.

> Der freie Scan ist der Kopf des Trichters. Stand er still, stand das
> Produkt still: kein Report, kein Lead, kein Anlass für Registrierung.

---

## 2. Warum es niemand bemerkt hat

`tsconfig.json` führt in `exclude`:

```
"supabase/functions"
```

`npm run lint` ist `tsc --noEmit`. Es hat damit **keine einzige** der 178
Edge Functions je typgeprüft. Ein undefinierter Bezeichner in einer
Deno-Function ist für die einzige statische Prüfung des Repositories
unsichtbar.

`pre-deploy-check.yml` prüft Konfigurations-Einträge, Migrations-Zeitstempel
und Dateinamen — nicht den Inhalt der Funktionskörper. `deploy.yml` deployt,
ohne zu typprüfen: Ein Bündel mit undefiniertem Bezeichner ist syntaktisch
gültig und wird anstandslos ausgeliefert.

### Ein Gate gibt es — es kann diesen Fall nur nicht sehen

`npm run check:edge-syntax` (in `ci.yml`, jede `supabase/functions/*/index.ts`)
existiert und lief auch über die abgeschnittene Datei. Es ist **bewusst ein
reiner Parse-Check**, kein Typecheck; der Skriptkopf begründet das: Deno-
Specifier (`jsr:`, `npm:`) und das globale `Deno` kann `tsc` ohne Deno-libs
nicht auflösen.

Eine Datei, die `runChecks(...)` aufruft, ohne dass `runChecks` existiert, ist
**syntaktisch einwandfrei**. Der Parser hat nichts zu beanstanden — und hatte
recht.

**Die Lücke liegt oberhalb des Syntax-Gates, nicht daneben.** Niemand prüft, ob
ein aufgerufener Bezeichner überhaupt existiert. Das ist die eigentliche
Lehre — nicht die abgeschnittene Datei, und auch nicht ein vergessener Check.

Bemerkenswert: Der Kopf von `check-edge-function-syntax.mjs` dokumentiert einen
Vorfall derselben Familie vom 2026-08-02 — ein unvollständiger `Deno.serve(`
blockierte den gesamten Deploy, 73 von 168 Functions erreichten wochenlang die
Produktion nicht. Das Gate entstand als Antwort darauf. Es deckt die
Syntax-Ebene ab; die Referenz-Ebene blieb offen.

### Eingelöst: das Referenz-Gate

`deno check` über `supabase/functions/**/index.ts` via `denoland/setup-deno`,
als zweite Stufe **neben** dem bestehenden Syntax-Gate — nicht als Ersatz.
Gerade `deno check` ist das passende Werkzeug, weil es genau die Specifier
auflöst, an denen `tsc` scheitert und deretwegen der Parse-Check bewusst auf
Syntax beschränkt wurde.

Bewusst **nicht** in diesem Commit: Deno steht in dieser Arbeitsumgebung nicht
zur Verfügung, ein ungetesteter CI-Schritt über 178 Funktionen wäre eine
Behauptung statt einer Absicherung. Zu erwarten ist ausserdem, dass er beim
ersten Lauf über Altbestand rot wird — das gehört eingeplant, nicht
überrascht entdeckt.

---

## 3. Der wiederhergestellte Vertrag

Der Originalcode ist **nicht auffindbar** — weder in der Git-History noch im
Deployment. Die Wiederherstellung ist deshalb eine **Rekonstruktion aus dem
gemessenen Verhalten**, kein wiedergefundenes Original.

Grundlage: `test/fixtures/gdpr-audit-production-contract.json`. Die Fixture
stammt aus der Produktionsdatenbank und wird **nicht** aus dem Code erzeugt;
der Code wird gegen sie geprüft.

### 3.1 Was gemessen ist

| Bestandteil | Herkunft |
|---|---|
| 26 Befund-Codes, Severities, Titel, Normbezüge | `jsonb_array_elements(issues)` über alle 159 Audits |
| Detailtexte | längster beobachteter Text je Code |
| Scoring-Gewichte | **exakt zurückgerechnet**, siehe 3.2 |
| Severity-Stufe des Berichts | höchste vorkommende Stufe, `pass` bei null Befunden |
| Welche Regeln je erschienen | genau drei, siehe 3.3 |

### 3.2 Scoring — ohne Rest zurückgerechnet

```
score = max(0, 100 − 25·critical − 12·high − 6·medium − 2·low − 0·info)
```

Diese Formel passt **ohne einen einzigen Rest** auf alle 27
unterschiedlichen Severity-Kombinationen der 159 Audits — von
(0,0,0,1,0)→98 über (1,1,2,0,0)→51 bis (3,1,1,2,·)→3.

`info` wiegt null: Ein Hinweis, der nichts zu tun gibt (`no_og_tags`,
`scan_coverage_limited`), darf den Score nicht drücken.

### 3.3 Doppelbefunde — der Fehler, den die Fixture aufgedeckt hat

Von den 14 Regeln der Rule Engine erschienen in 159 Audits nur **drei** je
als `rule:`-Befund:

| Regel | Vorkommen | Heuristik-Entsprechung |
|---|---|---|
| `COOKIE_BANNER_DARK_PATTERN` | 47× | keine |
| `AI_ACT_LIMITED_RISK_CHATBOT` | 14× | keine |
| `MISSING_AVV_REFERENCE` | 1× | keine |
| `MISSING_PRIVACY_POLICY` | **0×** | `no_privacy_link` (18×) |
| `MISSING_IMPRESSUM` | **0×** | `no_imprint_link` (11×) |
| `GA4_WITHOUT_CONSENT` | **0×** | `tracker_no_consent` (23×) |
| `META_PIXEL_WITHOUT_CONSENT` | **0×** | `tracker_no_consent` |

Das Muster ist eindeutig: Der produktive Scanner hat **denselben Sachverhalt
nie zweimal berichtet**.

Die erste Fassung der Rekonstruktion tat genau das. Das ist kein
Schönheitsfehler, sondern Scoring: Ein doppelt gemeldeter fehlender
Datenschutz-Link kostet 2 × 25 statt 25 Punkte. Jeder Bericht mit fehlendem
Pflicht-Link wäre 25 bis 50 Punkte schlechter ausgefallen als vor dem
Ausfall — bei identischer Website, ohne dass jemand die Verschärfung
beschlossen hätte.

Behoben durch `RULE_HEURISTIC_OVERLAP` in `_shared/audit-checks.ts`.

### 3.4 Benannte Lücke: Google Fonts

`GOOGLE_FONTS_EMBEDDED` feuerte in **keinem** der 159 Audits — obwohl extern
eingebundene Google Fonts zu den häufigsten Einbindungen im Netz gehören.
Der produktive Scanner hat den Fakt `asset.google_fonts.dynamic` also nie
gesetzt.

Die Rekonstruktion setzt ihn deshalb **bewusst nicht**. Ihn zu setzen hiesse,
nahezu jedem künftigen Bericht einen zusätzlichen `medium`-Befund
hinzuzufügen, den es vorher nicht gab — eine Verschärfung, getarnt als
Wiederherstellung.

Das ist eine **benannte Lücke des Vertrags**, kein Versehen. Wer sie
schliesst, entscheidet damit eine Produktfrage. Das gehört entschieden,
nicht nebenbei mitgeliefert.

### 3.5 Was nicht rekonstruierbar war

Regexe, Schwellwerte und die Reihenfolge der Prüfungen. Sie sind aus Titel,
Detailtext und Normbezug **abgeleitet**, nicht das Original.

Deshalb steht `AUDIT_ENGINE_VERSION` jetzt auf `2026.08.1` (vorher
`2026.05.1`): Ergebnisse über diese Versionsgrenze hinweg sind vergleichbar
**mit Vorbehalt**, nicht stillschweigend dasselbe.

---

## 4. Was geprüft ist — und was nicht

`test/edge/gdpr-audit-contract.test.ts`, 32 Tests:

- Scoring reproduziert **alle 27** historischen Kombinationen exakt
- Befund-Vokabular ist **geschlossen**: kein Code, den Produktion nie lieferte
- Severity-Semantik je Code unverändert
- Unterdrückung der Doppelbefunde greift genau bei den vier Regeln ohne
  eigenes Vorkommen und bei keiner der drei berichteten
- Fakten-Pfade zur Rule Engine sind festgenagelt (Umbenennen schaltet eine
  Regel stumm, ohne dass etwas bricht)
- High-Risk- und Prohibited-Fakten bleiben ungesetzt — am HTML einer
  Startseite nicht beobachtbar
- CSP-Allowlist gilt nicht als geladener Tracker (die alte 28/100-Regression)
- § 5 TMG wird ausserhalb DE/AT/CH auf `info` herabgestuft
- Der Bericht sichert keine Konformität zu

### Nicht geprüft

**Ein Replay auf Byte-Ebene.** `gdpr_audits` speichert `fetched_html_bytes`
— eine Länge, nicht das HTML. Die historischen Seiten haben sich seither
geändert; ein erneuter Abruf prüfte die Website von heute gegen einen Score
von damals und bewiese nichts über die Rekonstruktion.

Belastbar prüfbar ist der **Vertrag**: Vokabular, Severity-Semantik,
Scoring, Berichtsstruktur. Nicht die Frage, ob eine bestimmte Domain am
2026-06-14 exakt 51 Punkte bekommen hätte. Das steht hier, damit niemand die
Abdeckung für grösser hält als sie ist.

---

## 3a. Zwei Rekonstruktionen — und wie sie aufgelöst wurden

Derselbe Ausfall wurde **zweimal unabhängig behoben**: `2305e3f` (auf `main`
gemergt und seit dem 2026-08-30 live) und diese Arbeit. Beide zogen die Logik
in ein testbares Modul — derselbe Instinkt, unabhängig gefasst.

Der Unterschied liegt in der Grundlage. `2305e3f` entstand **ohne** die
Produktionsdaten und leitete das Vokabular aus Code und Regelwerk ab. Gemessen
gegen die 159 historischen Audits:

| | |
|---|---|
| Erfundene Codes (nie in Produktion) | **12** — `no_impressum_link`, `tracking_without_consent`, `site_unreachable`, `hosting_undisclosed`, `dynamic_google_fonts`, … |
| Verlorene Codes (Produktion lieferte sie) | **19** — darunter **alle sieben** Unterseiten-Prüfungen |
| Severity-Abweichung | `no_privacy_link` live `high` statt `critical` |

`sub_imprint_no_legal_form` allein erschien in **62 von 159** Audits als
`critical`. Ohne die Unterseiten-Ebene fallen pro betroffener Seite 25 bis 50
Punkte Abzug weg: Dieselbe Website bekommt ein deutlich besseres Ergebnis, ohne
dass jemand die Lockerung beschlossen hätte.

### Der stille Fehler: die Rule Engine schwieg

Schwerer als das Vokabular wiegt ein Fehler, den man im Code nicht sieht.
`extractFacts` gab die Fakten als **flache Punkt-Schlüssel** zurück:

```js
{ 'consent.banner.detected': true }
```

`getFact()` in `_shared/rules/evaluator.ts` zerlegt den Pfad aber an den
Punkten und läuft durch **verschachtelte** Objekte. Nachgerechnet:

```
flach  → getFact(f,'consent.banner.detected') = undefined
nested → getFact(f,'consent.banner.detected') = true
```

Jede Regelbedingung wurde damit gegen `undefined` geprüft und schlug fehl. Die
**gesamte Rule Engine — 14 Regeln, DSGVO und EU AI Act — hat geschwiegen**,
ohne dass etwas bricht oder ein Log etwas meldet.

Beleg in den Daten: Von den 159 historischen Audits trugen **61** einen
`rule:`-Befund (`COOKIE_BANNER_DARK_PATTERN` 47×,
`AI_ACT_LIMITED_RISK_CHATBOT` 14×). Die drei Audits vom 2026-08-31: **keinen
einzigen**.

Festgenagelt in `test/edge/gdpr-audit-checks.test.ts` — einmal auf die Form
(keine flachen Schlüssel) und einmal auf die Wirkung (`evaluateAll` feuert
tatsächlich).

### Der Entscheid

Vom Eigentümer am 2026-08-31: **Struktur von `2305e3f`, Vertrag aus der
Messung.** Die Dateistruktur (`gdpr-audit/checks.ts`, netzfrei und aus Vitest
testbar) wird weitergeführt; Vokabular, Severities und Gewichte kommen aus der
Fixture. Die Funktionen tragen beide Namensschemata, damit `index.ts` und die
dort entstandenen Tests weitgehend unverändert bleiben.

---

## 4a. Sicherheitsbefund: ReDoS im geteilten Scan-Code

CodeQL meldete auf dem Recovery-PR **eine hohe Sicherheitslücke**
(`polynomial ReDoS`). Sie lag **nicht** in der Rekonstruktion, sondern in
`_shared/tracker-detection.ts` — bestehendem Code, den der Scanner seit
jeher aufruft.

Beide Funktionen liefen über Ausdrücke der Form:

```
<meta[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>
```

`[^>]` matcht auch `h`, `t`, `p`. Die Maschine hat an jeder Fundstelle die
Wahl, wie viel der Quantor frisst und wo das Literal beginnt — und probiert
alle Aufteilungen durch.

**Gemessen** auf `'<meta '.repeat(60_000)` (360 kB, kein einziges `>`, also
nur Fast-Treffer):

| | vorher | nachher |
|---|---|---|
| `stripPolicyDeclarations` | **8 815 ms** | < 5 ms |
| `effectiveCspValue` | **9 233 ms** | < 5 ms |

Das ist über einen **öffentlichen, nicht authentifizierten** Endpunkt
erreichbar (`/audit`, `cookie-scan`) und mit einer einzigen präparierten
Seite auslösbar. Der Scan liest bis zu 1 MB fremdes HTML — die Eingabe ist
per Definition nicht vertrauenswürdig.

### Was der Zwischenschritt gelehrt hat

Die erste Fassung der Rekonstruktion begrenzte die Quantoren
(`[^>]{0,600}` statt `[^>]*`). Der Laufzeittest ergab: **17 322 ms** — kaum
besser. Eine Obergrenze am Quantor deckelt nur, wie teuer eine einzelne
Fundstelle wird, **nicht ihre Anzahl**. Bei 60 000 Fundstellen à 600
Rückverfolgungsschritten bleibt es untragbar.

Erst der Verzicht auf den Wildcard-Quantor löst es. `_shared/html-tags.ts`
isoliert Tags mit einem `indexOf`-Durchlauf — jedes Zeichen wird höchstens
konstant oft betrachtet, ein Dokument ohne `>` bricht sofort ab. Attribute
werden danach auf der **kurzen, isolierten** Zeichenkette gelesen, wo
Rückverfolgung folgenlos ist.

Der Befund wäre ohne Laufzeitmessung nicht aufgefallen: Die begrenzte
Fassung sah im Code korrekt aus. Deshalb messen die Tests jetzt Zeit, nicht
nur Ergebnisse — `test/edge/tracker-detection.test.ts` und
`test/edge/gdpr-audit-contract.test.ts`.

### Nebenwirkung: zwei Fehler weniger

Die Umstellung liest Attribute unabhängig von ihrer Reihenfolge. Der alte
Ausdruck verlangte `content` **nach** `http-equiv` und übersah deshalb
`<meta content="…" http-equiv="Content-Security-Policy">`. Ausserdem zählt
`-report-only` jetzt korrekt **nicht** als durchgesetzter CSP — ein
Report-Only-CSP meldet, erzwingt aber nichts. Beides ist mit Tests
festgenagelt.

### Zweiter CodeQL-Befund: `</script >` als falsch-negativer Befund

CodeQL meldete auf derselben Datei zusätzlich `Bad HTML filtering regexp`.
`visibleText` entfernte Skripte über `<script[\s\S]*?<\/script>` — und
`</script >` ist ein **gültiges** End-Tag: HTML erlaubt Leerraum vor dem `>`.

Der Ausdruck verfehlt es, das Element bleibt stehen, und beim
anschliessenden Entfernen der Tags landet der **Skript-Inhalt im sichtbaren
Text**. Belegt am 2026-08-30:

```html
<p>Wir uebermitteln Daten in die USA.</p>
<script>var hinweis = "auf Basis der Standardvertragsklauseln";</script >
```

Der String aus dem Skript zählte als Seiteninhalt und unterdrückte
`sub_privacy_third_country_no_legal_basis`. Die Seite bekam „alles in
Ordnung" gemeldet, obwohl die Rechtsgrundlage nirgends im Dokument steht.
Dieselbe Mechanik liess eine Ziffernfolge im Skript als Telefonnummer im
Impressum durchgehen.

**Das ist die gefährlichste Fehlerrichtung, die dieses Produkt haben kann.**
Ein falsch-positiver Befund kostet Vertrauen; ein falsch-negativer gibt
einem Kunden eine Entwarnung, auf die er sich verlässt — bei einem Produkt,
das ausdrücklich keine Konformität zusichert, aber Beobachtungen belastbar
melden soll.

Behoben durch `stripElement` in `_shared/html-tags.ts`: Öffnung und
Schliessung werden per `indexOf` gesucht und der ganze Bereich
herausgeschnitten — unabhängig von Leerraum und Schreibweise. Fehlt das
End-Tag, wird bis zum Dokumentende geschnitten, genau wie im Browser.

### Offen: dasselbe Muster in `scan-coverage.ts`

`_shared/scan-coverage.ts:54` trägt in `visibleTextLength` denselben
Ausdruck (`<script[\s\S]*?<\/script>`) und damit denselben Fehler. CodeQL
hat ihn nicht gemeldet, weil die Datei in diesem PR nicht geändert wurde.

Die Auswirkung dort ist eine andere, aber verwandte: Skript-Inhalt zählt zur
sichtbaren Textlänge, und die entscheidet, ob eine Seite als
`coverage: 'limited'` markiert wird. Eine JavaScript-Shell mit viel
Skript-Code kann so als `'full'` durchgehen — der Bericht verschweigt dann,
dass der Scan nur das Grundgerüst gesehen hat.

**Bewusst nicht in diesem PR behoben**: nicht gemeldet, nicht Teil der
Wiederherstellung, und die Datei hat eigene Tests, die eine Änderung
begleiten sollten. Der Einzeiler wäre `stripElement(html, 'script')` analog
zu oben.

---

## 5. Kein zweiter Stack

Geprüft und wiederverwendet, nicht nachgebaut:

| Baustein | Zustand | Umgang |
|---|---|---|
| Rule Engine `_shared/rules/*` | vorhanden | unverändert aufgerufen |
| `jurisdiction.ts`, `tracker-detection.ts`, `scan-coverage.ts`, `ai-disclosure-check.ts` | vorhanden | unverändert aufgerufen |
| Tracker-Registry | vorhanden | Nadeln abgeglichen |
| `gdpr_audits` als kanonischer Datensatz | vorhanden | unverändert |
| `audit_share_get` RPC, `/audit/result/:auditId` | vorhanden | unberührt |
| `AuditResultView`, CTA-Kontext | vorhanden | **unberührt** |
| E-Mail-Drip, PDF, `/onboarding/:scanId` | vorhanden | unberührt |

Neu ist **eine** Datei mit den Prüf-Heuristiken. Kein zweiter Scan-Pfad,
kein zweiter Report, kein zweiter Datensatz, keine Migration.

### Offener Befund: der Claim-Writer fehlt weiterhin

`gdpr_audits` trägt `user_id`, `tenant_id` und `claimed_at`. Gemessen am
2026-08-30:

```
select count(*), count(claimed_at), count(tenant_id) from gdpr_audits;
→ 159 | 0 | 0
```

**Nichts schreibt diese Spalten.** Die Treffer auf `claimed_at` im
Repository gehören sämtlich zu `siteos_anonymous_builds` — einer anderen
Tabelle. Damit bestätigt sich `canonical-funnel-decision.md` §1: Dem
`/audit`-Pfad fehlt der Claim-Writer, und die Kette
`Report → Auth → Tenant → Audit Claim` bricht nach dem Report ab.

Das war **in der Wiederherstellung bewusst nicht behoben** — eine eigene
Vertragsentscheidung, kein Bestandteil des Recovery.

> ✅ **Geschlossen am 2026-08-31**: `supabase/functions/audit-claim/` schreibt
> die Spalten jetzt. Muster, Vertrauensmodell und offene Punkte:
> `docs/product/audit-claim.md`.

---

## 6. Reihenfolge der weiteren Arbeit

```
SCAN → REPORT → BUILD → AUTOMATE → GOVERN
  ↑        ↑
  |        └── Claim-Writer fehlt (§5) — nächster Schritt
  └── wiederhergestellt (dieser Commit)
```

Der Scan ist der Eingangspunkt, nicht der Anlass, einen zweiten Trichter
daneben zu bauen. BUILD, AUTOMATE und GOVERN schliessen an, sobald der
Scan-/Report-Vertrag wieder belastbar ist.

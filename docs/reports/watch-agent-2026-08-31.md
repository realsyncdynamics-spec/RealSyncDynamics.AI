# Watch Agent — Wochenbericht 2026-08-31

**Quelle**: Watch Agent, automatisierter Abgleich der öffentlichen Seiten von
`realsyncdynamicsai.de` und dreier Regulierungsquellen, Montag 2026-08-31, 08:00
Europe/Berlin.
**Gegenprüfung**: 2026-09-01 im Repository, `main` @ `be9330b`.
**Zweck**: Dieser Bericht ist die **Baseline**. Der Watch Agent hat ausdrücklich
vermerkt, dass ohne Vorbericht keine Deltas belegbar sind — ab hier gibt es einen
Vergleichsstand.

---

## 1. Lage laut Watch Agent

Alle geprüften Kernseiten erreichbar, vollständige Inhalte, keine Ausfälle.
Positionierung als Governance OS für DSGVO und EU AI Act unverändert. Preise
stabil (Starter 79 €, Growth 249 €, Enterprise 1.249 € / Monat, je 14 Tage Test).
Datenschutzerklärung mit Stand 2026-08-30. Produktseiten Claude Code Optimizer
und Handwerk-Website online und konsistent. Auf den Regulierungsseiten keine
neuen produktrelevanten Fristen gegenüber dem bekannten AI-Act-Zeitplan;
Transparenzpflichten und GPAI-Regeln greifen bereits, High-Risk folgt.

**Keine kritischen oder hohen Änderungen von außen festgestellt.**

Die Gegenprüfung im Repository fällt anders aus als die Außensicht: Vier der
fünf Handlungsempfehlungen führen auf belegbare Befunde, zwei davon auf
Falschaussagen auf Verkaufs- bzw. Rechtsseiten. Die Außensicht konnte das nicht
sehen — eine Seite, die erreichbar ist und plausibel aussieht, ist damit noch
nicht richtig.

---

## 2. Gegenprüfung der Handlungsempfehlungen

Gemessen, nicht hergeleitet (§5 CLAUDE.md). Jede Zeile mit Fundstelle.

| # | Empfehlung des Watch Agent | Ergebnis der Messung |
|---|---|---|
| 1 | Privacy-Seite (Stand 2026-08-30) gegen interne Änderungsprotokolle abgleichen | **Befund B-1** — das Datum ist kein Änderungsdatum, sondern immer der heutige Tag |
| 2 | Sub-Prozessoren-Liste bei Bedarf aktualisieren | **Befund B-2** — dieselbe Mechanik, verschärft durch das Versprechen „laufend dokumentiert" |
| 3 | Pricing-Seite auf Plan-Namen (Agency) und Add-on-Preise prüfen | **Befund B-3** — Add-on-Verfügbarkeit war hart codiert und für WhatsApp genau verkehrt herum; Add-on-Preis (99 €) dagegen korrekt |
| 4 | BFDI-Empfehlungen zu Cookie-Bannern (13.08.2026) berücksichtigen | **Befund B-4** — der Scanner erkannte CMPs und Tracker, prüfte aber keine gleichwertige Ablehnen-Option; am 2026-09-01 nachgerüstet, am 2026-09-04 in den Dienst gezogen, der wirklich gerufen wird (B-7, B-8) |
| 5 | AI-Act-Transparenzpflichten in Claims und Scan-Logik absichern | Am 2026-09-04 nachgeholt und **erledigt**: Scan-Logik arbeitet (14 historische Treffer); die uneinheitliche Artikelnummer (B-6) ist geprüft und auf Art. 50 vereinheitlicht |

Zusätzlich geprüft, weil CLAUDE.md §5 es vor jeder eigenen Messung verlangt
(„Sieh in den Actions-Tab"):

| Guard | Letzter Lauf auf `main` | Stand |
|---|---|---|
| Migration Drift Guard | 2026-09-01 | grün |
| Edge Function Drift Guard | 2026-08-31 | grün — rot am 2026-08-29 und 2026-08-30, seit dem Nachziehen von `onboarding-orchestrator` wieder grün |
| Function ACL Drift Guard | 2026-08-31 | grün |

Die in CLAUDE.md §5 beschriebene Drift ist damit geschlossen und bestätigt sich
in den Läufen. Kein offener Guard-Befund.

---

## 3. Befunde

### B-1 · Datenschutzerklärung trägt jeden Tag das Datum von heute

`src/features/legal/PrivacyPolicy.tsx:29`

```tsx
<div className="…">Stand {new Date().toISOString().slice(0, 10)}</div>
```

Das „Stand"-Datum wird beim Rendern aus der Systemzeit erzeugt. Es sagt nichts
darüber aus, wann die Erklärung zuletzt geändert wurde — es sagt nur, wann
jemand die Seite geöffnet hat. Der Watch Agent hat am 2026-08-30 folgerichtig
„Stand 2026-08-30" gesehen; am 2026-09-01 stünde dort 2026-09-01, ohne dass ein
Wort am Text anders wäre.

**Warum das mehr ist als ein Schönheitsfehler**: Empfehlung 1 des Watch Agent —
„gegen interne Änderungsprotokolle abgleichen" — ist mit diesem Feld nicht
erfüllbar. Ein Betroffener kann nicht erkennen, welche Fassung er gelesen hat,
und wir können im Streitfall nicht belegen, welche Fassung wann galt. Für ein
Produkt, das Prüfpfad und Nachvollziehbarkeit verkauft, ist ein
selbstdatierendes Rechtsdokument ein Governance-Befund, unabhängig davon, wie
korrekt der Inhalt daneben ist.

Betrifft die Routen `/datenschutz`, `/legal/datenschutz` und `/legal/privacy`.

**Beim Fixen fiel eine Verschärfung auf, die von außen wie Sorgfalt aussah**:
Beide Seiten werden prerendert (`npm run build:full`, 90 Seiten). `new Date()`
lief damit nicht im Browser des Besuchers, sondern **zur Build-Zeit** — das
Datum stand fest und war das Datum des letzten Produktions-Deploys. Der Watch
Agent sah „Stand 2026-08-30" also nicht, weil er die Seite an diesem Tag
geöffnet hat, sondern weil an diesem Tag zuletzt gebaut wurde. Das sieht nach
einem gepflegten Änderungsdatum aus und ist keines: Jeder Deploy — auch einer,
der eine Landingpage-Farbe ändert — datiert die Datenschutzerklärung neu.

### B-2 · Sub-Prozessoren-Liste, dieselbe Mechanik — mit ausdrücklichem Versprechen

`src/features/legal/SubProcessors.tsx:134`

```tsx
Stand: {new Date().toISOString().slice(0, 10)} · Änderungen werden hier
laufend dokumentiert. Wesentliche Änderungen werden Workspace-Ownern per
Email avisiert (Art. 28 Abs. 2 DSGVO).
```

Hier steht das automatische Datum unmittelbar neben der Zusage, Änderungen
würden dokumentiert und avisiert. Das Datum erweckt den Eindruck einer
gepflegten Liste und ist zugleich der einzige Beleg dafür — ein Beleg, der sich
täglich selbst erneuert, auch wenn die Liste seit Monaten unverändert ist.
Empfehlung 2 des Watch Agent („bei Bedarf aktualisieren") lässt sich ohne echtes
Änderungsdatum nicht beantworten: Man sieht der Seite nicht an, ob Bedarf
besteht.

Art. 28 Abs. 2 DSGVO knüpft Widerspruchsrechte an die Mitteilung von
Änderungen. Eine Liste ohne belastbares Änderungsdatum trägt diese Zusage nicht.

### B-3 · Add-on-Verfügbarkeit auf der Preisseite ist hart codiert — und für WhatsApp falsch herum

`src/components/pricing/GovernanceBotsSection.tsx:225`

```tsx
<div className="text-[10px] text-silver-500 italic">
  Für Growth, Agency, Enterprise und Partner
</div>
```

Diese Zeile steht **innerhalb** von `BOT_ADDONS.map(...)` und wird damit unter
**jedem** Add-on ausgegeben, unabhängig davon, für welche Pläne es tatsächlich
buchbar ist. Der Grund liegt eine Ebene tiefer: `src/config/pricing.ts:382`
bildet `BOT_ADDONS` über `toBotAddOn` ab, und diese Funktion lässt das Feld
`availableFor` weg. Die Komponente *kann* die Verfügbarkeit gar nicht anzeigen,
also steht dort ein fester Satz.

Die Folgen, gegen `shared/pricing.ts` gemessen:

| Add-on | `availableFor` in der SSoT | Anzeige auf `/pricing` |
|---|---|---|
| WhatsApp (99 €) | `['starter']` | „Für Growth, Agency, Enterprise und Partner" |
| Response Pack | `['growth', 'enterprise']` | „Für Growth, Agency, Enterprise und Partner" |

Bei WhatsApp ist die Aussage **genau invers**: Der einzige Plan, der das Add-on
buchen kann, wird nicht genannt, und genannt werden Pläne, die den Kanal
bereits enthalten. Das ist derselbe Fehler, den AP2 in der Datenschicht
ausdrücklich behoben hat — der Kommentar dazu steht in `shared/pricing.ts` direkt
über `availableFor: ['starter']` („Genau verkehrt herum"). Die Preisseite zeigt
weiter den Zustand von vor der Korrektur.

Dazu die Plan-Namen, nach denen der Watch Agent gefragt hat: Agency und Partner
sind seit AP2 stillgelegt (`availability: 'legacy'`) und werden hier als
buchbares Ziel genannt.

**Nicht** betroffen und ausdrücklich geprüft:
- Der Add-on-Preis ist korrekt — `shared/pricing.ts:1080` führt WhatsApp mit
  `priceEur: 99`, deckungsgleich mit der Marketplace-Kachel aus dem
  AP2-Umbau.
- Die Agency-Nennungen in der FAQ von `src/features/billing/PricingPage.tsx`
  (Zeilen 275–288) sind **richtig so**: Sie richten sich an Bestandskunden und
  sagen ausdrücklich, dass Agency nicht mehr neu verkauft wird. Kein Befund.
- `src/components/pricing/GovernanceModuleMatrix.tsx` und
  `unified/UnifiedPricingGrid.tsx` nennen Agency nur in Code-Kommentaren, die
  die AP2-Entscheidung erklären. Kein Befund.

### B-4 · Cookie-Scan erkennt Banner, aber nicht deren Rechtskonformität

`supabase/functions/cookie-scan/index.ts`, `supabase/functions/cookie-scan-deep/index.ts`,
`services/playwright-scanner/src/scanner.ts`

Vorhanden ist eine belastbare Grundlage: 16 CMP-Anbieter werden erkannt
(Cookiebot, Usercentrics, Borlabs, Klaro, OneTrust, CookieYes, Real Cookie
Banner, iubenda, consentmanager, CCM19, Cookie Information, OneTrust/cookielaw,
Didomi, TrustArc, Sourcepoint, Osano), Tracking-Cookies werden nach Mustern klassifiziert und
Third-Party-Cookies vor Einwilligung erkannt.

Nicht vorhanden: eine Prüfung der **Gestaltung** des Banners. Eine Suche nach
`reject|ablehnen|decline|deny|gleichwertig` über alle drei Dateien liefert
keinen Treffer. Der Scan beantwortet damit „gibt es ein Banner und setzt die
Seite vorher Tracker?", nicht „darf dieses Banner so aussehen?".

> **Korrektur vom 2026-09-04 — dieser Absatz war zu weit gefasst.** Die drei
> genannten Dateien (`cookie-scan`, `cookie-scan-deep`, Playwright-Scanner)
> stimmen. Der **Audit-Pfad** war aber nicht darunter, und dort gibt es sehr
> wohl eine Prüfung: `gdpr-audit/checks.ts:168` führt `hasEqualRejectOption`
> und setzt daraus den Fakt `consent.banner.reject_button_equal_prominence`.
> Ich habe drei Dateien durchsucht und über „den Scanner" gesprochen. Das ist
> derselbe Fehler wie beim `/realsync-landing`-Punkt: aus einem Ausschnitt auf
> das Ganze geschlossen.
>
> Die Sache wird dadurch nicht harmloser, sondern anders — und schlechter.
> Siehe **B-5**.

Genau letzteres ist der Kern der BFDI-Empfehlungen vom 13.08.2026 und der
gefestigten Rechtsprechung zu § 25 TDDDG: Eine Ablehnen-Option muss auf der
ersten Ebene und in gleicher Deutlichkeit wie die Zustimmung erreichbar sein.
Eine Seite kann also alle heutigen Prüfungen bestehen und trotzdem
abmahnfähig sein — was für ein Produkt, dessen Einstieg der kostenlose Scan ist,
die unangenehmere Hälfte des Versprechens betrifft.

**Das ist ein Produktbefund, kein Fehler**: Die Erweiterung ist Arbeit, keine
Korrektur.

**Am 2026-09-01 gebaut.** Neu ist `services/playwright-scanner/src/consent-banner.ts`:
Der Deep-Scan sammelt die Schaltflächen des Banners aus dem DOM und bewertet sie
gegen drei Fragen — gibt es überhaupt ein Banner, steht die Ablehnung auf der
ersten Ebene, und ist sie ebenso deutlich wie die Zustimmung. Befund-Codes
`CB_NO_BANNER_DETECTED` (niedrig), `CB_NO_REJECT_ON_FIRST_LAYER` (hoch),
`CB_REJECT_LESS_PROMINENT` (mittel), jeder mit Rechtsgrundlage im Befund selbst.

Drei Entscheidungen dabei, die nicht selbstverständlich sind:

- **Der Score bleibt unberührt.** Die Gewichte sind versionsrelevant: Flössen
  die neuen Befunde ein, bekäme jede früher gescannte Seite still ein anderes
  Ergebnis, ohne dass sich an ihr etwas geändert hat. Das Modul misst und
  berichtet; ob daraus Punkte werden, ist eine eigene Entscheidung.
- **Nur der Deep-Scan.** Die leichte Variante als Edge Function holt HTML und
  kann Flächen und berechnete Stile nicht messen. Sie lässt das Feld weg statt
  zu raten — `consent_banner` ist deshalb optional.
- **Erst der Container, dann die Schaltflächen.** „Alle Knöpfe der Seite
  einsammeln" hätte jeden Navigationslink „Einstellungen" und jedes „OK" in
  einem beliebigen Dialog zum Consent-Element gemacht — die Seite bekäme einen
  Befund für ein Banner, das sie nicht hat.

Die heikelste Stelle ist die Reihenfolge der Klassifikation: „Nur notwendige
Cookies akzeptieren" enthält *akzeptieren* und ist trotzdem die Ablehnung. Wer
zuerst auf Zustimmung prüft, meldet ausgerechnet den Bannern „keine Ablehnung
vorhanden", die es richtig machen. `test/scanner/consent-banner.test.ts` deckt
das ab (12 Fälle); gegengeprobt: Dreht man die Reihenfolge um, fällt der Test.

**Nebenbefund, dogfooding**: Unser eigenes Banner
(`src/components/CookieConsent.tsx`) erfüllt den Maßstab bereits — „Alles
akzeptieren" und „Alle ablehnen" teilen sich Klassen und `flex-1`, mit einem
Kommentar, der auf BfDI, Art. 7 Abs. 3 DSGVO und § 25 TDDDG verweist. Wir
haben also praktiziert, was wir nicht gemessen haben. Der Testfall
„lässt ein gleichwertiges Banner ohne Befund durch" ist danach gebaut.

---

### B-5 · Ein Fakt verspricht eine Messung, die nicht stattfindet · 2026-09-04

`supabase/functions/gdpr-audit/checks.ts:168` und `_shared/rules/gdpr.json`

Der Audit-Pfad setzt den Fakt `consent.banner.reject_button_equal_prominence`.
Dahinter steht:

```ts
export function hasEqualRejectOption(html: string): boolean {
  return /alle\s{0,3}ablehnen|nur\s{0,3}(technisch\s{0,3})?notwendige|ablehnen|
          reject\s{0,3}all|decline\s{0,3}all|deny\s{0,3}all|essential\s{0,3}only/i.test(html);
}
```

Das ist ein Test darauf, ob das **Wort** irgendwo im HTML vorkommt. Über
Fläche, Ebene, Farbe oder Stil sagt er nichts — er *kann* nichts darüber
sagen, weil er nur eine Zeichenkette sieht.

Verbraucht wird der Fakt von `COOKIE_BANNER_DARK_PATTERN`, und dort steht,
was der Kunde zu lesen bekommt:

| | |
|---|---|
| Titel | „Cookie-Banner ohne gleichberechtigten Reject-Button" |
| Beschreibung | „Banner zeigt prominenten Accept-All-Button ohne **sichtbar gleichwertigen** Reject-All-Button" |
| Normen | DSGVO Art. 7 · TTDSG § 25 · BfDI 2024 Guidelines |
| Schwere | medium |

**Der Befund ist nicht die fehlende Prüfung, sondern die Differenz zwischen
Zusage und Messung.** Ein Banner mit „Alles akzeptieren" als großem Knopf und
„Ablehnen" als grauem Link in der zweiten Ebene — der Lehrbuchfall, nach dem
die Regel benannt ist — enthält das Wort und wird deshalb als **konform**
gewertet. Gemeldet wird nur der Fall „gar keine Ablehnung im Markup". Das ist
die schwächere Messung unter der stärkeren Überschrift.

Eine fehlende Prüfung ist als Lücke erkennbar. Eine, die unter falschem Namen
läuft, sieht aus wie Abdeckung — und niemand sucht mehr danach.

**Das Gewicht dieser Stelle**: `COOKIE_BANNER_DARK_PATTERN` ist die
meistgefeuerte Regel des Produkts. Der Kommentar in `checks.ts` hält an den
159 historischen Audits fest: 47 Treffer, mehr als jede andere Regel.

#### Nachtrag vom 2026-09-04: Der Befund war schärfer, als hier zuerst stand

Zwei Dinge kamen bei der Umsetzung ans Licht und ändern die Bewertung.

**Erstens: Der Kommentar über der Funktion wusste es bereits.** Wörtlich stand
dort: „Konservativ: Wir können aus statischem HTML keine Pixel messen. Gewertet
wird deshalb allein, ob eine Ablehnen-Option **überhaupt** im Markup steht.
Fehlt sie, ist Gleichrangigkeit ausgeschlossen — das ist die Richtung, in der
die Aussage belastbar ist."

Die Überlegung ist vollständig und richtig. Der Code folgte ihr nur zur
Hälfte: Er gab den Wert in **beide** Richtungen zurück, und der Fakt wurde in
beide gelesen. Das ist kein Denkfehler, sondern eine nicht zu Ende geführte
Implementierung — und deshalb umso leichter zu übersehen.

**Zweitens: Die Messung gab es schon einmal.** `worker/src/detectors/consent.ts`
misst die Prominenz richtig — Accept- und Reject-Knopf werden über
`getBoundingClientRect()` verglichen, Höhe ±20 %, Breite ≥ 50 %. Der Worker ist
laut CLAUDE.md §2 „Legacy-Jobs (deprecated → Edge Functions + Cron)".

Damit ist B-5 keine fehlende Funktion, sondern eine **Regression**: Beim Umzug
in die Edge Function trat eine Wortsuche an die Stelle einer echten Messung —
unter demselben Faktnamen. Der Name blieb korrekt, die Deckung dahinter
verschwand. Genau deshalb fällt so etwas nicht auf.

#### Was am 2026-09-04 geändert wurde

Freigegeben nach §10.3 („Deep-Scan misst, Text angleichen"). Umgesetzt ist der
Teil, der ohne neue Annahmen tragfähig ist:

`gdpr-audit/checks.ts` beantwortet die Frage jetzt **asymmetrisch**, so wie der
Kommentar es immer schon vorgezeichnet hat:

| Fall | vorher | jetzt |
|---|---|---|
| kein Banner | `false` | `false` |
| Banner ohne Ablehnen-Option | `false` | `false` |
| Banner mit Ablehnen-Option | **`true`** | **`undefined`** |

`COOKIE_BANNER_DARK_PATTERN` feuert bei `equals false` — die Regel greift also
in **exakt denselben Fällen** wie vorher. Kein Ergebnis ändert sich, keine
Vergleichbarkeit mit den 159 historischen Audits geht verloren. Weg fällt
allein die unbelegte Behauptung im dritten Fall.

`hasEqualRejectOption` heißt jetzt `hasRejectOption` — sie prüft Vorkommen, und
so heißt sie auch. Der exportierte Alias `hasEqualRejectButton` bleibt als
Modul-Oberfläche bestehen, mit Hinweis.

**Der Test, der die Falschbehauptung festschrieb**, hieß „erkennt eine
gleichrangige Ablehnen-Option" und erwartete `true` für den Text
`Alle akzeptieren · Alle ablehnen` — ohne Knopf, ohne Größe, ohne Stil. Er
prüfte damit ab, dass der Fehler bestehen bleibt. Jetzt heißt er „behauptet
keine Gleichrangigkeit, wenn nur das Wort dasteht".

#### Was ausdrücklich **nicht** umgesetzt ist

Die zweite Hälfte der Freigabe — „der Deep-Scan speist den Fakt" — ist so nicht
machbar. Die Leitung, die ich dabei vorausgesetzt hatte, existiert nicht:
siehe **B-7**.

### B-6 · Dieselbe Pflicht, zwei Artikelnummern · 2026-09-04

Das ist die Antwort auf Empfehlung 5, soweit sie messbar war.

Die Transparenzpflicht „Nutzer müssen wissen, dass sie mit einer KI
interagieren" wird im Repo an zwei verschiedene Normen gehängt:

| Artikel | Wo | Beispiele |
|---|---|---|
| **Art. 50** | die zentralen, neueren Quellen | `shared/reality-decision.ts:227`, `shared/pricing.ts:1427`, `shared/onboarding.ts:88`, `src/rules/annex-iii.json`, `AiActRiskInventoryView`, `aiActRiskInventoryApi` |
| **Art. 52** | Regelwerk und ältere Oberflächen | `rules/ai-act.json` (beide Zwillinge), `ai-disclosure-check.ts`, `AuditCopilotPanel.tsx:282`, `AssistentQuickChatModal.tsx:212`, `RiskCenterView.tsx:282/284/384`, `EvidenceVaultView.tsx:134`, `LegalMethodology.tsx:99/189`, `enterprise-os/mock/data.ts:462`, `ROADMAP.md`, `SCANNER-TEST-GUIDE.md` |

Beides kann nicht stimmen. Der Widerspruch ist **innerhalb einer einzigen
Regel** belegbar: `shared/reality-decision.ts` beschreibt den Befund
`rule:AI_ACT_LIMITED_RISK_CHATBOT` mit „Transparenzpflicht nach **Art. 50**" —
und in der Definition derselben Regel steht `"norms": ["AI Act Art. 52"]`.

**Wofür Art. 50 spricht**, ohne dass man mir das glauben muss:

- In derselben Datei `ai-act.json` trägt die GPAI-Regel **Art. 53** und
  verweist auf **Art. 55** für Modelle mit systemischem Risiko. Das ist die
  Nummerierung der **verabschiedeten** Verordnung (EU) 2024/1689. In dieser
  Zählung ist Art. 50 die Transparenzpflicht und Art. 52 das Verfahren zur
  Einstufung von GPAI-Modellen mit systemischem Risiko — also etwas ganz
  anderes.
- Art. 52 für Transparenz ist die Nummerierung des **Kommissionsentwurfs von
  2021**. Die Datei mischt damit zwei Zählungen.
- `annex-iii.json` stammt aus **demselben Commit** (`a67ae2c`, 2026-08-19) und
  nummeriert durchgehend nach der Endfassung (`Art. 5(1)(f)`, `Art. 50`).

**Wo das besonders unangenehm ist**: `AuditCopilotPanel.tsx` und
`AssistentQuickChatModal.tsx` sind unsere **eigenen** Transparenzhinweise —
genau die Offenlegung, die die Norm verlangt. Sie nennen dabei die falsche
Norm. Und `LegalMethodology.tsx` ist die Seite, auf der wir unsere
Prüfmethodik offenlegen.

#### Geprüft am 2026-09-04, dann korrigiert

Der Eigentümer hat nach §10.3 mit **„Ja — erst prüfen, dann korrigieren"**
entschieden. Die Prüfung ist erfolgt, bevor eine Zeile geändert wurde.

**Was die Prüfung ergeben hat:**

| Artikel | Amtliche Überschrift | Inhalt |
|---|---|---|
| **Art. 50** | „Transparency Obligations for Providers and Deployers of Certain AI Systems" | Abs. 1: Personen müssen „informed that they are interacting with an AI system" werden |
| **Art. 52** | „Procedure" | Verfahren zur Einstufung von GPAI-Modellen mit systemischem Risiko |

Entscheidend war ein struktureller Beleg: **Kapitel IV der Verordnung besteht
aus genau einem Artikel — Artikel 50**, und die Kapitelüberschrift ist
wortgleich mit der Artikelüberschrift. Damit ist ausgeschlossen, dass die
Transparenzpflicht anderswo im Kapitel steht.

**Was ich nicht belegen konnte, und das gehört dazu**: Der Volltext auf
EUR-Lex ließ sich nicht auswerten — das Dokument ist zu groß und bricht beim
Abruf mitten in den Erwägungsgründen ab, in der deutschen wie in der
englischen Fassung. Die Bestätigung stammt daher aus einer Quelle, die den
amtlichen Text wiedergibt (AI-Act-Explorer, Artikel- und Kapitelseite),
zusammen mit der inneren Evidenz des Repos. Für eine Korrektur, die Nummern
angleicht, trägt das. Wer die Zitate in einem Rechtsstreit braucht, sollte
sie einmal am Amtsblatt selbst nachschlagen.

**Was geändert wurde**: 17 Stellen in elf Dateien, von `Art. 52` auf
`Art. 50` — Regelwerk (beide Zwillinge), `ai-disclosure-check.ts`, unsere
eigenen KI-Hinweise in `AuditCopilotPanel` und `AssistentQuickChatModal`,
`RiskCenterView`, `EvidenceVaultView`, `LegalMethodology`, die Mock-Daten und
zwei Dokumentationsdateien.

**Nicht geändert**: Die Regel-`id` `AI_ACT_LIMITED_RISK_CHATBOT`, `severity`
und `conditions` — Befund-Codes und Gewichte sind versionsrelevant, und an
der Sache ändert eine korrigierte Normangabe nichts. Ebenso bleibt
`version: 2026.05.0`: Das Verhalten der Regel ist unverändert.

**Nachgezogen**: `updated_at` dieser einen Regel steht jetzt auf `2026-09-04`
statt `2026-05-07`. Es wäre schief, in einem Bericht ein selbstdatierendes
„Stand" zu beanstanden (B-1/B-2) und im selben Zug ein Änderungsdatum stehen
zu lassen, das die eigene Änderung verschweigt.

### B-7 · Zwei Playwright-Scanner, ein Vertrag, der nicht passt · 2026-09-04

Aufgefallen beim Versuch, B-5 zu Ende zu bringen. Der Deep-Scan sollte den
Prominenz-Fakt aus der echten Messung speisen. Das geht nicht, und der Grund
ist ein eigener Befund.

**Es gibt zwei Playwright-Scanner im Repo:**

| | `services/playwright-scanner` | `deploy/playwright-scanner` |
|---|---|---|
| Antwort | `{ ok, meta, cookies, trackers, forms, consent_banner, score, … }` | `{ ok, url, scanned_at, cookies, cookie_count, trackers_detected, consent_manager, … }` (snake_case) |
| Endpunkte | `/scan` | `/scan/full`, `/scan/consent-timing`, `/scan/screenshot` |
| zuletzt berührt | 2026-09-01 (B-4) | 2026-08-19 |

`supabase/functions/cookie-scan-deep/index.ts` deklariert intern ein
`PlaywrightScanResult` mit `requests`, `preConsentRequests`, `consentTimingMs`,
`screenshot`, `crawledUrls` — das ist die Form von **`deploy/`**, nicht die von
`services/`. Beide teilen sich lediglich `url`, und selbst `cookies` haben
verschiedene Felder.

**Zwei Folgen, beide unangenehm:**

1. **Meine B-4-Arbeit hängt möglicherweise am falschen Dienst.**
   `consent-banner.ts` liegt in `services/playwright-scanner` — dem Dienst, den
   `cookie-scan-deep` nach dieser Deklaration **nicht** anspricht. Die Messung
   ist gebaut, getestet und CI-grün, erreicht aber vielleicht keinen
   Produktionspfad. Das gehört zu B-4 dazu und steht deshalb hier, nicht in
   einer Fußnote.
2. **`types.ts` verspricht eine Synchronität, die es nicht gibt.** Im Kopf der
   Datei steht: „Request/Response-Interfaces — synchronisiert mit cookie-scan
   Edge Function … Bei Schema-Änderungen IMMER beide Seiten anpassen." Die
   beiden Seiten sind heute nicht synchron. Der Kommentar liest sich wie eine
   Zusicherung und ist keine.

#### Aufgelöst am 2026-09-04 — der Vault war die falsche Frage

Ich hatte hier geschrieben, die Antwort stehe im Supabase Vault und sei aus dem
Repo nicht ablesbar. Das war voreilig. Sie **ist** ablesbar, und zwar am
Endpunkt:

| | |
|---|---|
| `cookie-scan-deep` ruft auf | `POST ${PLAYWRIGHT_SCANNER_URL}/scan/full` |
| `deploy/playwright-scanner` bedient | `/health` · **`/scan/full`** · `/scan/consent-timing` · `/scan/screenshot` |
| `services/playwright-scanner` bedient | `/health` · `/scan` |

**Damit ist die Sache entschieden, ganz ohne Vault**: Was auch immer unter
`PLAYWRIGHT_SCANNER_URL` läuft, es muss `deploy/playwright-scanner` sein —
stünde dort der andere Dienst, liefe jeder Deep-Scan in einen 404. Welcher Host
im Vault steht, ändert daran nichts.

**Und `services/playwright-scanner` hat keinen Aufrufer.** Gesucht über das
ganze Repo, ausgenommen sein eigenes Verzeichnis: keine Edge Function, kein
Workflow, keine fremde Compose-Datei spricht ihn an. Was auf ihn zeigt, ist
sein Eintrag in der Backend-CI (`npm run typecheck`), sein Ausschluss in
`tsconfig.json`, mein Test und mein eigener Kommentar. Er bringt eine eigene
`docker-compose.yml` und eine systemd-Unit mit, könnte also irgendwo laufen —
aber nichts in diesem Repo redet mit ihm.

#### Was das für B-4 bedeutet — und das ist unangenehm

**`consent-banner.ts` liegt im Dienst, den niemand aufruft.** Die Messung ist
gebaut, getestet, CI-grün — und auf keinem Pfad erreichbar, der von diesem Repo
ausgeht. Genau der Fall, den CLAUDE.md §14 beim Namen nennt: „fertiger Code,
den niemand erreichen kann, ist verschwendete Arbeit."

Ich habe beim Bauen von B-4 den Dienst am Namen gewählt
(`services/playwright-scanner` klingt nach *dem* Scanner) und nicht geprüft,
wer ihn ruft. Dasselbe Muster wie bei den beiden früheren Fehlern in diesem
Bericht: aus dem Naheliegenden geschlossen, statt gemessen.

**Der Weg zur Auflösung ist damit klar benannt, aber nicht beschritten**: Die
Prominenz-Messung gehört in `deploy/playwright-scanner/server.ts` — den Dienst
am `/scan/full`-Endpunkt —, und von dort über `cookie-scan-deep` in den Fakt.
Das ist eine Ergänzung an einem Produktionsdienst und wirft zugleich die Frage
auf, ob `services/playwright-scanner` überhaupt bestehen bleiben soll. Beides
gehört entschieden, nicht nebenbei gemacht — vorgelegt.

> **Am 2026-09-04 umgesetzt — und der zweite Halbsatz war falsch.** Die
> Messung liegt jetzt in `deploy/playwright-scanner` (siehe unten). Der Weg
> „über `cookie-scan-deep` in den Fakt" führt dagegen nirgendwohin:
> `cookie-scan-deep` erzeugt keine Fakten, und `gdpr-audit`, das sie erzeugt,
> hat keinen Browser. Einzelheiten in B-9 und in der Korrektur darunter.

#### Nachtrag 2026-09-04: Diese Tabellenzeile stand hier zuerst falsch

In der Spalte `deploy/` stand ursprünglich
`{ url, cookies, requests, preConsentRequests, consentTimingMs, screenshot, crawledUrls }`.
Das ist **nicht**, was der Dienst antwortet — das ist, was `cookie-scan-deep`
zu bekommen *glaubt*. Ich habe die Deklaration des Aufrufers für die Antwort
des Aufgerufenen gehalten und beides nicht gegeneinander gelesen. Am
2026-09-04 an `scanFull()` nachgesehen: Die echte Antwort ist snake_case und
enthält **keines** dieser Felder. Daraus folgt B-9.

### B-8 · Der einzige Playwright-Dienst mit Aufrufern ließ sich nie bauen · 2026-09-04

Aufgefallen beim Umsetzen von B-7. Bevor die Messung in
`deploy/playwright-scanner` einziehen konnte, war zu klären, wie dieser Dienst
überhaupt gebaut wird. Antwort: gar nicht.

| Blocker | Befund |
|---|---|
| `RUN npm ci` | ohne `package-lock.json` im Verzeichnis — `npm ci` bricht ausdrücklich ab, wenn keiner da ist |
| `COPY server.ts tsconfig.json ./` | **`tsconfig.json` hat es in diesem Verzeichnis nie gegeben.** `git log --all --name-only` über den Pfad listet fünf Dateien, keine davon ist es. Docker bricht bei einer fehlenden COPY-Quelle hart ab |
| `RUN npx tsc --noEmit 2>/dev/null \|\| true` | prüft nichts: Fehler werden verworfen, und nach `npm ci --omit=dev` war `tsc` gar nicht installiert |
| `package.json` → `build: esbuild src/server.ts` | es gibt kein `src/` — die Datei liegt flach im Verzeichnis. Auch `main` zeigte auf `dist/server.js` |
| CI | `backend-services-ci.yml` deckt `services/**`, `worker/**`, `apps/**` ab — **`deploy/**` nicht.** Der Dienst mit den Aufrufern war in keiner Prüfung, der ohne Aufrufer in einer |

Das Verzeichnis stammt vollständig aus einem einzigen Commit (`a67ae2c`,
#1095, 2026-08-19) und ist seither unberührt. `docker compose up --build`
hätte an Tag eins abgebrochen. Dass es niemandem auffiel, hat einen Grund und
der ist der eigentliche Befund: **`audit-monitor-cron` fällt still zurück.**
`if (!PW_URL) return scanWithFetch(domain)` — ohne Scanner-URL scannt der Cron
eben mit `fetch`, ohne Fehler, ohne Log, ohne Unterschied im Ergebnistyp. Ein
Dienst, dessen Ausfall der Aufrufer stillschweigend überspielt, fehlt niemandem.

**Behoben, weil es Voraussetzung für B-7 war** — und weil §14 dafür keinen
Ermessensspielraum lässt:

- `tsconfig.json` neu, `strict` samt `noUncheckedIndexedAccess`. Der bestehende
  `server.ts` besteht ihn unverändert — es fehlte die Prüfung, nicht die Qualität.
- `package-lock.json` erzeugt und eingecheckt, damit `npm ci` trägt.
- `package.json`: Pfade auf die Wirklichkeit (`server.ts`, `server.js`),
  `typecheck`-Skript ergänzt.
- Dockerfile: `npm ci` mit devDependencies (esbuild wird zum Bauen gebraucht),
  danach `npm prune --omit=dev`; der als Prüfung getarnte `|| true`-Aufruf ist
  entfallen — die echte Prüfung läuft jetzt in der CI.
- `backend-services-ci.yml` deckt `deploy/playwright-scanner` mit
  `npm run typecheck && npm run build` ab.

Gesichert durch `test/scanner/consent-banner-twin.test.ts`: Der Test liest die
`COPY`-Zeilen des Dockerfiles und prüft, dass jede genannte Datei existiert.
Genau dieser Fehler — Verweis auf eine Datei, die es nicht gibt — kann damit
nicht wiederkommen.

### B-7 umgesetzt: Die Messung liegt jetzt im Dienst, der gerufen wird

`deploy/playwright-scanner/consent-banner.ts` ist ein **byte-gleicher
Zwilling** von `services/playwright-scanner/src/consent-banner.ts`.
`server.ts` sammelt die Schaltflächen aus dem DOM und liefert `consent_banner`
in **beiden** Endpunkten, die ein Banner sehen können: `/scan/full` und
`/scan/consent-timing`.

**Warum ein Zwilling und kein Import.** Die beiden Dienste sind getrennte
Build-Kontexte; das Dockerfile kopiert nur aus dem eigenen Verzeichnis. Ein
Import über die Grenze wäre lokal grün und im Image kaputt. Der Zwilling folgt
dem Muster, das dieses Repo bereits für `ai-act.json` verwendet — und wie dort
hält ein Test die Gleichheit fest, weil ein Zwilling ohne Gleichheitsprüfung
keine Kopie ist, sondern eine Abweichung mit Anlaufzeit.

**In `/scan/consent-timing` wird vor dem Klick gemessen.** Nach „Alles
akzeptieren" ist das Banner weg, und „gleiche Deutlichkeit" ist eine Aussage
über die erste Ebene.

**Additiv, ausdrücklich**: `consent_banner` ist ein zusätzlicher Schlüssel.
Kein bestehendes Feld wurde umbenannt oder entfernt, damit
`audit-monitor-cron` — der einzige Aufrufer, der heute funktioniert —
unberührt weiterläuft.

**Wirksam wird das erst nach einem Redeploy.** `deploy/playwright-scanner`
läuft per `docker compose` auf dem VPS hinter Traefik, nicht über
`deploy.yml`. Ein Commit ändert dort nichts, solange das Image nicht neu
gebaut wird. Das ist keine Nebenbemerkung: Es ist der Unterschied zwischen
„im Repo behoben" und „in Produktion behoben", und dieser Bericht besteht zur
Hälfte aus genau dieser Unterscheidung.

### B-9 · Der Deep-Scan kann nicht funktionieren — drei Verträge, keine zwei passen · 2026-09-04

Der Rest von B-7 lautete: „von dort über `cookie-scan-deep` in den Fakt".
Beim Umsetzen zeigte sich, dass dieser Satz **an zwei Stellen falsch** ist.

**Erstens ist `cookie-scan-deep` selbst kaputt.** Es deklariert intern
`PlaywrightScanResult` mit `requests`, `preConsentRequests`, `crawledUrls`,
`consentTimingMs`, `screenshot` und liest sie ungeprüft:

```ts
const annotated = pwData.requests.map((r) => ({ … }));   // Zeile 389
```

`/scan/full` liefert keines dieser Felder. `pwData.requests` ist `undefined`,
`.map` wirft, der äußere `catch` macht daraus **HTTP 500**. Und zwar bei jedem
Aufruf, nicht in einem Randfall.

**Zweitens ist die öffentliche Route darüber ebenfalls falsch verdrahtet.**
`/consent-timing` und `/tools/consent-timing` (beide in `App.tsx`, öffentlich,
ohne Auth) rufen `cookie-scan-deep` mit `{ scan_type: 'consent_timing' }` —
ein Feld, das die Function nicht kennt; sie liest `scan_depth`. Danach prüft
die Seite `if (!resp.ok || !data.ok) throw` — und `DeepScanResult` enthält
**kein** `ok`. Selbst ein geglückter Scan endete in der Fehleranzeige.

| Ebene | erwartet | bekommt |
|---|---|---|
| `ConsentTimingAnalysis.tsx` | `{ ok, requests_before_consent, violations, score, … }` | `DeepScanResult` ohne `ok` |
| `cookie-scan-deep` | `{ requests, preConsentRequests, crawledUrls, consentTimingMs }` | snake_case-Zusammenfassung ohne diese Felder |
| `deploy/playwright-scanner` `/scan/full` | — | genau diese Zusammenfassung |

Zum Vergleich, und das ist der Beleg dafür, welcher Dienst wirklich läuft:
`audit-monitor-cron` liest `d.trackers_detected`, `d.cookie_count`,
`d.consent_manager?.detected` und schickt den Header `x-api-key` — alles
passgenau zu `deploy/playwright-scanner`. Ein Aufrufer trifft den Vertrag, der
andere nicht.

**Nicht behoben, vorgelegt.** Die Reparatur ist keine Kleinigkeit und kein
Ermessen: Sie legt fest, welche der drei Formen die kanonische ist, ändert die
Antwort einer bestehenden Edge Function und das Verhalten einer bestehenden
öffentlichen Seite (§10.3). Sie entscheidet außerdem, ob `gdpr_audits`
künftig `scan_type: 'deep'`-Zeilen mit einer Bewertung bekommt, die dort noch
nie gelaufen ist — und Bewertungsgewichte sind nach §1 versionsrelevant.

### Korrektur zu B-7: `cookie-scan-deep` führt gar nicht zum Fakt

Auch der zweite Teil des Satzes war falsch, und diesmal grundsätzlich.
`consent.banner.reject_button_equal_prominence` wird an genau einer Stelle
erzeugt: `gdpr-audit/checks.ts:718`. `gdpr-audit` holt das HTML per `fetch`
und **hat keinen Browser** — es ruft weder `cookie-scan-deep` noch einen
Playwright-Dienst, an keiner Zeile.

`cookie-scan-deep` wiederum berührt die Regel-Engine überhaupt nicht; es
erzeugt keine Fakten, sondern eigene `issues`.

Damit steht die Sache anders, als ich sie am 2026-09-04 aufgeschrieben habe:
Der Fakt lässt sich **nicht** über `cookie-scan-deep` speisen. Der Weg müsste
sein, dass `gdpr-audit` eine browser-gestützte Eingabe erhält — also selbst
den Scanner ruft. Das ist eine Änderung an dem Pfad, aus dem alle 159
historischen Audits stammen, und würde Ergebnisse ändern, wo heute
`undefined` steht. Nach §1 versionsrelevant, also eine Entscheidung, keine
Umsetzung.

**Bis dahin bleibt B-5 richtig, wie es ist**: Der Fakt sagt `undefined` statt
`true`, weil eine Wortsuche Gleichrangigkeit nicht belegen kann. Das ist keine
Übergangslösung, die auf B-7 wartet — es ist die zutreffende Aussage, solange
der Pfad, der es messen könnte, nicht angeschlossen ist.

### Was an Empfehlung 5 in Ordnung ist

Damit der Bericht nicht nur Befunde nennt: Die Transparenzprüfung **arbeitet**.
`extractFacts` in `gdpr-audit/checks.ts:711` setzt `ai_use_case.is_chatbot` und
`ai_use_case.disclosure_visible`, die Regel `AI_ACT_LIMITED_RISK_CHATBOT` ist
in den 159 historischen Audits **14-mal** gefeuert. Sie ist keine Attrappe.

Bemerkenswert und ausdrücklich richtig ist auch, was dort **nicht** gesetzt
wird: die Fakten der High-Risk- und Prohibited-Regeln. Ob ein Unternehmen KI im
Recruiting einsetzt, ist aus dem HTML seiner Startseite nicht beobachtbar; ein
geratener Wert erzeugte einen `critical`-Befund ohne Grundlage. Der Kommentar
sagt das und begründet es. Genau so gehört es gemacht.

**Klein, aber gemessen**: Die Anbieter-Erkennung in `ai-disclosure-check.ts`
sucht unter anderem nach `claude-[23]` und `gpt-[34]`. Aktuelle Modellnamen
fallen aus diesen Mustern heraus. Betrifft nur den Erkennungspfad über
Modellzeichenketten — die Endpunkte (`api.anthropic.com`, `api.openai.com`)
greifen weiter.

## 4. Was daraufhin geändert wurde

B-1 bis B-3 betreffen sichtbaren Text bzw. eine backend-gebundene Anzeige auf
bestehenden Seiten. Nach §10.3 CLAUDE.md gilt dafür Fragepflicht — auch dann,
wenn die Änderung eine Korrektur und keine Gestaltung ist. Die Freigabe vom
2026-08-30 („Legacy-Pläne auf die verkäuflichen Stufen umstellen") deckt B-3
inhaltlich, gilt aber nach der ausdrücklichen Regel „Ein ‚Ja' zu einer früheren
Änderung gilt nicht für die nächste" nicht automatisch weiter.

Vorgelegt und am 2026-09-01 mit **Ja** beantwortet (Eintrag in CLAUDE.md §10):

| Befund | Frage | Antwort | Umgesetzt |
|---|---|---|---|
| B-1 / B-2 | Festes Änderungsdatum statt `new Date()` | **Ja** | `LAST_UPDATED = '2026-08-19'` in beiden Dateien, mit Kommentar, wann es mitzuziehen ist |
| B-3 | Verfügbarkeit aus `availableFor` ableiten | **Ja** | `toBotAddOn` reicht die Plannamen durch, die Preisseite formatiert sie |
| B-5 | Deep-Scan misst, Text angleichen (2026-09-04) | **Ja** | Fakt jetzt asymmetrisch, Funktion umbenannt, Test korrigiert — **ohne Ergebnisänderung**. Zweite Hälfte blockiert durch B-7 |
| B-6 | Artikelnummer erst prüfen, dann korrigieren (2026-09-04) | **Ja** | Geprüft (Kapitel IV = nur Art. 50), danach 17 Stellen in elf Dateien auf Art. 50 gezogen |

Der Umfang war ausdrücklich auf diese beiden Punkte begrenzt: keine Farben,
kein Grid, keine Typografie, keine Sektionsreihenfolge, keine weitere Zeile
Text.

**Das Datum 2026-08-19 ist gemessen, nicht gewählt.** Es ist der letzte Commit,
der den Inhalt beider Seiten tatsächlich geändert hat (`#1095`). Der spätere
Commit vom 2026-08-27 auf `SubProcessors.tsx` hat „Emails" zu „E-Mails"
korrigiert und die Liste der Sub-Prozessoren nicht angerührt — eine
Rechtschreibkorrektur ist keine Änderung der Liste, und genau das steht jetzt
auch im Kommentar über der Konstante.

B-4 ist keine Änderung an Bestehendem, sondern eine Ergänzung — nach §10.2 frei.
Am 2026-09-01 umgesetzt, Einzelheiten oben im Befund. Kein bestehender Text,
kein bestehendes Verhalten und keine Punktzahl wurden dabei angefasst.

**B-7 und B-8, umgesetzt am 2026-09-04.** Beides Ergänzungen bzw. Reparaturen
an einer Build-Kette, die nie funktioniert hat — kein sichtbarer Text, keine
Oberfläche, kein Verhalten einer laufenden Funktion:

| Was | Vorher | Nachher |
|---|---|---|
| `deploy/playwright-scanner/consent-banner.ts` | — | byte-gleicher Zwilling, Gleichheit per Test gesichert |
| `consent_banner` in `/scan/full` und `/scan/consent-timing` | — | neu, additiv; bestehende Schlüssel unverändert |
| `tsconfig.json` im Dienst | existierte nie | `strict` + `noUncheckedIndexedAccess`, grün ohne Codeänderung |
| `package-lock.json` | fehlte, `npm ci` brach ab | erzeugt und eingecheckt |
| `package.json` | `main`/`build` zeigten auf `src/server.ts` und `dist/` | auf die tatsächlichen Pfade, `typecheck` ergänzt |
| Dockerfile | `COPY … tsconfig.json` auf eine Datei, die es nie gab; `tsc … \|\| true` als Scheinprüfung | COPY nur auf vorhandene Dateien; Bundle-Build, danach `npm prune`; Typecheck in der CI |
| `backend-services-ci.yml` | `deploy/**` in keiner Prüfung | `deploy/playwright-scanner` mit `typecheck && build` in der Matrix |

**B-9 ist nicht umgesetzt** und gehört ausdrücklich nicht in diese Tabelle —
siehe den Befund oben.

---

## 5. Offen für den nächsten Bericht

- **Empfehlung 5 ist am 2026-09-04 nachgeholt** und steht jetzt als B-6 und als
  Abschnitt „Was an Empfehlung 5 in Ordnung ist" in §3. Ergebnis: Die Scan-Logik
  trägt, die Normzitate tragen nicht.

  **Nicht erledigt ist damit die Claim-Prüfung im engeren Sinn.** Gemessen habe
  ich die Normzitate und die Scan-Logik. Ob die Verkaufstexte auf den rund 25
  Seiten mit AI-Act-Bezug inhaltlich decken, was das Produkt leistet — das ist
  eine eigene Durchsicht und weiterhin **nicht gemessen**.
- **`/realsync-landing` war kein offener Punkt — die Zeile war mein Fehler.**
  Hier stand zunächst, die Seite führe „weiterhin fünf Plan-Karten mit hart
  codierten Preisen, inklusive Agency und Partner". Das war schon beim
  Schreiben falsch. Am 2026-09-04 am Code gemessen:
  `src/marketing/landing/RealSyncDynamicsLanding.tsx` führt **vier** Karten
  (Free Audit · Starter · Growth · Enterprise), die Beträge kommen aus
  `planById('starter').price.monthlyEur` bzw. Growth, die Agency-Karte ist
  entfallen — mit Kommentar an Ort und Stelle —, Enterprise steht auf „Auf
  Anfrage".

  **Wie das passiert ist, und warum es hierher gehört**: Ich habe den Punkt
  aus CLAUDE.md §10 übernommen, wo er als offen geführt war, statt ihn zu
  messen. Genau das, wogegen dieser Bericht an drei anderen Stellen
  argumentiert — und der Beleg dafür, dass „steht in der Doku" kein Ersatz
  für eine Messung ist, auch dann nicht, wenn die Doku die eigene ist.
- **B-9 ist die größte offene Sache dieses Berichts** und braucht eine
  Entscheidung, keine Umsetzung: Welche der drei Formen im Deep-Scan-Pfad ist
  die kanonische? Davon hängt ab, ob `/consent-timing` — eine öffentliche,
  verlinkte Route — wieder etwas anderes zeigt als eine Fehlermeldung.
- **Ob `services/playwright-scanner` bestehen bleiben soll**, ist weiterhin
  offen. Seit dem 2026-09-04 hat er einen Zwilling seines einzigen
  produktrelevanten Moduls im Dienst, der wirklich läuft. Entfernen greift in
  Bestehendes ein (§10.3) und wird deshalb nicht nebenbei gemacht.
- **Der Redeploy des Scanner-Containers** ist ein Betreiberschritt. Solange er
  nicht läuft, ist B-7/B-8 im Repo behoben und in Produktion nicht.
- **Free-Tarif bei Supabase** bleibt der bekannte, unveränderte Befund: keine
  täglichen Backups, kein Point-in-Time-Recovery, kein SLA. Unabhängig von
  dieser Woche.

## 6. Für den Watch Agent selbst

Zwei Beobachtungen aus dem Abgleich, damit der nächste Lauf mehr findet:

1. **„Stand"-Daten auf Rechtsseiten taugen nicht als Änderungssignal**, solange
   B-1/B-2 offen sind. Ein Delta dort bedeutet nichts. Nach dem Fix bedeutet es
   etwas — dann ist es das wertvollste Signal des ganzen Berichts.
2. **Erreichbarkeit und Vollständigkeit sind nicht Richtigkeit.** Alle drei
   Befunde auf Verkaufs- und Rechtsseiten standen auf Seiten, die der Lauf als
   stabil und konsistent gemeldet hat. Wo eine Aussage gegen eine Quelle im Repo
   prüfbar ist — Preise, Plan-Namen, Add-on-Verfügbarkeit gegen
   `shared/pricing.ts` —, ist der Abgleich gegen die Quelle aussagekräftiger als
   der Abgleich gegen die Vorwoche.

---

*Nächster Lauf: Montag, 2026-09-07. Dieser Bericht ist ab dann die Baseline.*

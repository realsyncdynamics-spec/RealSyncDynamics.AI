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
| 4 | BFDI-Empfehlungen zu Cookie-Bannern (13.08.2026) berücksichtigen | **Befund B-4** — der Scanner erkennt CMPs und Tracker, prüft aber keine gleichwertige Ablehnen-Option |
| 5 | AI-Act-Transparenzpflichten in Claims und Scan-Logik absichern | Kein neuer Befund in dieser Sitzung; nicht abschließend geprüft, siehe §5 |

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

Genau letzteres ist der Kern der BFDI-Empfehlungen vom 13.08.2026 und der
gefestigten Rechtsprechung zu § 25 TDDDG: Eine Ablehnen-Option muss auf der
ersten Ebene und in gleicher Deutlichkeit wie die Zustimmung erreichbar sein.
Eine Seite kann also alle heutigen Prüfungen bestehen und trotzdem
abmahnfähig sein — was für ein Produkt, dessen Einstieg der kostenlose Scan ist,
die unangenehmere Hälfte des Versprechens betrifft.

**Das ist ein Produktbefund, kein Fehler**: Die Erweiterung ist Arbeit, keine
Korrektur. Sie gehört in die Planung, nicht in diesen Bericht.

---

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

Der Umfang war ausdrücklich auf diese beiden Punkte begrenzt: keine Farben,
kein Grid, keine Typografie, keine Sektionsreihenfolge, keine weitere Zeile
Text.

**Das Datum 2026-08-19 ist gemessen, nicht gewählt.** Es ist der letzte Commit,
der den Inhalt beider Seiten tatsächlich geändert hat (`#1095`). Der spätere
Commit vom 2026-08-27 auf `SubProcessors.tsx` hat „Emails" zu „E-Mails"
korrigiert und die Liste der Sub-Prozessoren nicht angerührt — eine
Rechtschreibkorrektur ist keine Änderung der Liste, und genau das steht jetzt
auch im Kommentar über der Konstante.

B-4 ist keine Änderung an Bestehendem, sondern eine Ergänzung — nach §10.2 frei,
aber vom Umfang her ein eigener Arbeitsschritt. Nicht in dieser Sitzung.

---

## 5. Offen für den nächsten Bericht

- **Empfehlung 5 nicht abschließend geprüft**: Ob die Produkt-Claims die bereits
  geltenden AI-Act-Transparenzpflichten korrekt abbilden, ist eine inhaltliche
  Prüfung sämtlicher Claim-Flächen und war in dieser Sitzung nicht leistbar.
  Nicht als „in Ordnung" verbuchen — als „nicht gemessen".
- **`/realsync-landing`** führt weiterhin fünf Plan-Karten mit hart codierten
  Preisen im JSX, inklusive Agency und Partner. Bereits in CLAUDE.md §10 als
  offen vermerkt, gehört zu AP10. Der Watch Agent prüft diese Route nicht — sie
  stand nicht in der Liste der Kernseiten.
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

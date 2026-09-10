# Revenue Funnel P0 — Scan → Empfehlung → Angebot → Kontext

**Stand**: 2026-08-29
**Bezug**: Auftrag „REALSYNC DYNAMICS.AI — IMPLEMENTIERUNG P0 REVENUE FUNNEL"
**Vorgelagert**: `docs/product/canonical-funnel-decision.md` (Einstieg und
Datensatz), `docs/architecture/canonical-builder-target-matrix.md` (Träger-Builder,
gemessene Befund→Schritt-Matrix), `docs/product/capability-matrix.md` (Route und
Backend je Modul)

Dieses Dokument beschreibt den **umgesetzten** Zustand. Was fehlt, steht als
Lücke da, nicht als Absicht.

---

## 1. Was vorher da war

Der Trichter war an der Oberfläche vollständig und in der Sache leer.

| Baustein | Zustand vorher |
|---|---|
| `/audit` → Befunde → `gdpr_audits` | vorhanden, produktiv (159 Zeilen live) |
| `/onboarding/:auditId` → `/recommendation/:auditId` | vorhanden, verlinkt aus `AuditLanding` und `AuditResultView` |
| `findingClassifier.ts` — Befund → Governance-Dimension | vorhanden, getestet, in Benutzung |
| `recommendationEngine.ts` — Dimensionen → **Plan** | vorhanden, in Benutzung |
| `shared/onboarding.ts` — Q&A → Plan **und Module** | vorhanden, **ohne einen einzigen Aufrufer ausserhalb der Tests** |
| `BOOKABLE_MODULES` + `moduleCatalog.ts` | vorhanden, trägt `/app/marketplace` |
| `checkoutHrefForPlan()` → `/checkout/:planKey` → `stripe-checkout` | vorhanden, produktiv |
| `/build` — SiteOS-Builder, anonym | vorhanden, produktiv |

**Die Lücke war nicht der Plan, sondern das Modul.** `Recommendation` trug
`recommendedPlan`, `reasoning`, `urgencyLevel`, `nextSteps` — und kein einziges
buchbares Modul. Der Kunde bekam nach dem Reality Report eine Paketempfehlung,
aber keine Antwort auf „was tut ihr gegen *meinen* Befund".

Die zweite Lücke war der Zusammenhang: `auditId`, `domain`, Plan und
Modulauswahl reisten ausschliesslich im Router-State (`navigate(..., { state })`).
Der überlebt keinen Reload, keinen geteilten Link, keine Anmeldung und keine
Rückkehr von Stripe.

---

## 2. Was geändert wurde

### 2.1 Eine kanonische Empfehlung — keine dritte Engine

`src/core/onboarding/canonicalRecommendation.ts` **ruft beide vorhandenen
Logiken auf** und legt fest, was in keiner von beiden stand: welches buchbare
Modul ein konkreter Befund nach sich zieht.

```
Befunde ──► classifyAllFindings()        (bestehend, unverändert)
        └─► generateRecommendation()     (bestehend, unverändert) ──► Plan, Begründung, Dringlichkeit
Q&A     ──► recommendFromAnswers()       (bestehend, unverändert) ──► ergänzende Module, darf den Plan nur anheben
                       │
                       ▼
            CanonicalRecommendation      (neu — die Verdrahtung, nicht die Rechnung)
```

**Rangfolge, nicht verhandelbar**: Der Scan führt, die Q&A ergänzt. Ein Modul
aus den Antworten überschreibt nichts, was die Befunde bereits begründet haben;
ein Modul aus den Befunden verschwindet nicht, weil eine Frage anders
beantwortet wurde. `test/onboarding/canonical-recommendation.test.ts` hält das
fest.

### 2.2 Befund → Modul: worauf die Zuordnung beruht

Zwei Schichten, beide belegt statt geschätzt:

**Erstens, Befund-Codes.** `REBUILD_FIXABLE_CODES` enthält genau die Codes, denen
die **gemessene** Matrix in `canonical-builder-target-matrix.md` §3 (26 Codes über
159 Audits) einen Schritt der `rebuild-website`-Pipeline zuordnet. Wer einen
solchen Befund hat, bekommt `ai_frontend` vorgeschlagen — mit den auslösenden
Kennungen als Beleg an der Angebotszeile.

Bewusst **nicht** enthalten: `fetch_failed`. Die Matrix nennt ihn als
Abbruchbedingung — ein Neubau auf dieser Grundlage baut aus nichts. Was ein
Abbruch ist, darf kein Verkaufsargument werden. Der Test hält das fest.

**Zweitens, Dimensionen** als Auffangnetz für Codes, die in keiner gemessenen
Liste stehen (neue Regeln). Die Einteilung läuft über die **bestehende**
Klassifikation aus `findingClassifier.ts`; es entsteht keine zweite Einteilung
von Befunden.

`team_collaboration` und `api_integration` haben absichtlich kein Modul: Beides
sind Plan-Eigenschaften, keine Verkaufseinheit. Sie erzeugen eine **Massnahme**
statt eines Kaufvorschlags — der Teil des Angebots, an dem nichts zu verdienen
ist, und ohne den der Rest unglaubwürdig wäre.

**Automation aus dem Scan** gibt es in genau einem Fall:
`rule:AI_ACT_LIMITED_RISK_CHATBOT` belegt, dass auf der Seite bereits ein
KI-Dialog **ohne** Art.-50-Hinweis läuft. Das ist kein „vielleicht mal ein Bot",
sondern ein ungeregelter Kanal — dafür steht `website_chat` als geregelter
Ersatz. Alle übrigen Kanäle sind Selbstauskunft und kommen aus der Q&A, nie aus
dem Scan.

### 2.3 Preise

Kein Betrag entsteht in der neuen Schicht. `priceEur`, `priceModel`,
`usageNote` und `name` werden unverändert aus `BOOKABLE_MODULES` übernommen; die
Monatsbasis rechnet `monthlyBaseTotalEur()` aus der Pricing-SSoT. Der Test
vergleicht jede Angebotszeile gegen `bookableModuleById()`.

### 2.4 Ehrlichkeit über den Kaufweg

Zwei Dinge werden getrennt benannt, weil sie zwei verschiedene Fragen sind:

| Feld | Frage | Quelle |
|---|---|---|
| `purchase` | Kann der Kunde das **kaufen**? | `cheapestPlanFor()` — trägt ein wählbarer Plan alle `unlocks`? |
| `entryRoute` | Kann der Kunde das **erreichen**? | Capability-Matrix §1 — Route mit deploytem Backend |

`ai_frontend` ist der Fall, an dem sich die Trennung bewährt: `unlocks: []`,
also kein Plan, der es freischaltet → `purchase: 'coming_soon'`. Erreichbar ist
es trotzdem, über `/build` → `entryRoute` gesetzt. Die Karte sagt beides:
„Einzelbuchung folgt" **und** „Vorschau bauen". Ein Knopf, der nichts tut, wäre
falsch (`CLAUDE.md` §14) — ein verschwiegener Weg, den es gibt, ebenso.

`booking` bekommt keine Route: Backend vorhanden, App-Route nicht (Capability-Matrix).
Es wird deshalb gar nicht erst empfohlen.

### 2.5 Der Trichter-Kontext überlebt jetzt die Anmeldung

`src/core/onboarding/funnelContext.ts` hält `auditId`, `domain`, empfohlenen
Plan, Modulauswahl und Umsetzungspfad in der Sitzung fest — dieselbe Begründung
wie bei `src/unified-entry/productTrack.ts`: Bis zur Registrierung existiert
kein Mandant, unter dem sich das speichern liesse. **Keine Migration**, weil der
kanonische Datensatz `gdpr_audits` bleibt.

Regeln, die der Test festhält:
- Die URL gewinnt vor der Sitzung — ein geteilter Link bleibt reproduzierbar.
- Ein Wechsel der `auditId` setzt neu auf, statt Fremdes weiterzutragen.
- `withAuditContext()` **ergänzt** ein Ziel, statt es neu zusammenzusetzen —
  sonst gingen `source` und `pilot` aus `checkoutHrefForPlan()` verloren.
- Ein unbekannter Plan-Key aus der Sitzung wird verworfen, nicht durchgereicht.

### 2.6 Scan-Kontext im Builder

`/build` nimmt jetzt `?audit_id=` und `?domain=` entgegen: Der Einstieg zeigt,
für welche Domain gebaut wird, und die Beschreibung startet mit einem
erkennbaren Anfang statt leer. **Ohne diese Parameter ändert sich nichts** — der
Builder bleibt der freie Prompt-Einstieg, der er war. Es entsteht kein zweiter
Builder.

### 2.7 Nebenbefund mit Fix: `shared/onboarding.ts` liess die Suite rot

Die Frage-Kennung `id: 'scale'` verstösst gegen das Namensverbot aus
`test/config/pricing-no-legacy-names.test.ts`. Der Test war auf `main`
(`95cd8d7`) **rot** — nachgeprüft gegen den unveränderten Baum. Umbenannt in
`domains`. Ein Namensverbot, das Ausnahmen sammelt, hört auf, eines zu sein.

---

## 3. Geänderte Dateien

| Datei | Art |
|---|---|
| `src/core/onboarding/canonicalRecommendation.ts` | **neu** — kanonische Struktur, Befund→Modul, Angebotszeilen |
| `src/core/onboarding/funnelContext.ts` | **neu** — Audit/Domain/Plan/Module über Weiterleitungen |
| `test/onboarding/canonical-recommendation.test.ts` | **neu** — 17 Fälle |
| `test/onboarding/funnel-context.test.ts` | **neu** — 10 Fälle |
| `src/hooks/useGovernanceOnboarding.ts` | erweitert — liefert `reality` und `canonicalRecommendation` |
| `src/pages/GovernanceOnboarding.tsx` | erweitert — hält den Kontext fest, reicht die Empfehlung weiter |
| `src/pages/GovernanceRecommendation.tsx` | erweitert — Sektion „Deine Empfehlung", Kontext im Checkout-Ziel |
| `src/unified-entry/pages/BuildStudioPage.tsx` | erweitert — nimmt Scan-Kontext entgegen |
| `src/features/market/MarketplaceView.tsx` | erweitert — markiert die aus dem Scan empfohlenen Dienste |
| `shared/onboarding.ts` | Frage-Kennung `scale` → `domains` |

**Keine Migration. Keine neue Route. Keine neue Preisquelle. Keine neue Edge Function.**

Bestehende Routen unverändert: `/audit`, `/onboarding/:scanId`,
`/recommendation/:scanId`, `/checkout/:planKey`, `/build`, `/app/marketplace`.
Betroffene DB-Strukturen: **keine** — gelesen wird `gdpr_audits` über den
bestehenden Weg, geschrieben wird nichts Neues.

---

## 4. Tests

| Lauf | Ergebnis |
|---|---|
| `npm run lint` (`tsc --noEmit`) | grün |
| `npm run build` (inkl. Prerender) | grün, 89 Seiten gerendert, 0 fehlgeschlagen |
| `npm test` | **275 Dateien, 3642 Tests grün**, 21 übersprungen |

Neu abgedeckt, entlang §12 des Auftrags: Scan → Empfehlung · Befund → Modul ·
Website-Befund → `ai_frontend` · DSGVO-Befund → `governance_core` · KI-Befund →
`advanced_ai_governance` · erkannter Chat → `website_chat` · kein Kanal ohne
Beleg · `fetch_failed` kein Neubau-Argument · Q&A ergänzt statt ersetzt · Plan
wird angehoben, nie gesenkt · Preise identisch mit der SSoT · `ai_frontend` als
noch nicht buchbar ausgewiesen · `auditId` und `domain` überleben Weiterleitungen.

---

## 5. Offene Punkte — nachgemessen am 2026-09-06

> **Dieser Abschnitt war überholt und ist ersetzt.** Die erste Fassung stammt
> vom 2026-08-29 und nannte sechs offene Punkte. Vier davon sind seither
> geschlossen worden — nicht in diesem PR, sondern in den nachfolgenden
> Arbeiten. Ein Dokument, das Erledigtes als Blocker führt, schickt die nächste
> Sitzung hinter Gespenstern her; deshalb steht hier der gemessene Stand und
> darunter, was die alte Fassung behauptet hat.
>
> **Methode**: Repo gegen `origin/main` (`dce3278`), Produktion über die
> Management-API gegen `RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`),
> Zeilenzahlen über `count(*)`.

### 5.1 ~~`gdpr-audit/index.ts` unvollständig~~ — **erledigt**

Die alte Fassung war zum Zeitpunkt ihrer Messung richtig: Am 2026-08-29 hatte
`index.ts` 217 Zeilen und rief sechs Funktionen auf, die nirgends definiert
waren. **Die Diagnose war jedoch unvollständig.** Die Datei war nicht
abgeschnitten — es fehlte die Datei, aus der sie importiert.

Gemessen am 2026-09-06 gegen die deployte Fassung (v51, ACTIVE):

| Datei | Repo (`dce3278`) | Produktion | Vergleich |
|---|---|---|---|
| `gdpr-audit/index.ts` | 367 Zeilen | 367 Zeilen | **byte-identisch** |
| `gdpr-audit/checks.ts` | 830 Zeilen | 830 Zeilen | **byte-identisch** |

`checks.ts` trägt `runChecks`, `extractFacts` und `scoreReport` sowie die
Befund-Codes und die Score-Formel. `index.ts` importiert sie über einen
Mehrzeilen-Import (`from './checks.ts'`), den eine `grep`-Prüfung auf
`^import` nicht sieht — das war der Grund, warum die erste Messung die Kopplung
übersah und auf „abgeschnitten" schloss.

Geschlossen durch `2305e3f` (Rekonstruktion), `1307d48` (Google-Fonts-Erkennung
am Host verankert) und #1167 (Free-Scan-Vertrag wiederhergestellt).

**Lehre**: Eine fehlende Definition beweist nur, dass sie *hier* fehlt — nicht,
dass sie verloren ist. Vor dem Schluss „Datei abgeschnitten" den vollständigen
Importblock lesen, nicht nur die Zeilen, die mit `import` beginnen.

### 5.2 ~~Der Mandant bekommt die Empfehlung nicht~~ — **erledigt, aber unbenutzt**

Der Weg existiert und ist der richtige: Die Empfehlung wird **nicht** als
abgeleitetes Artefakt gespeichert, sondern aus dem kanonischen Datensatz neu
gerechnet. `NextBestActionCard` löst den anstehenden Claim aus, liest die
geclaimte `gdpr_audits`-Zeile über RLS und ruft `recommendForProfile()` darauf
auf. Damit gibt es weiterhin genau eine Rechenvorschrift, und der Kontext hängt
am Audit statt an einer Sitzung.

**Aber**: In Produktion ist dieser Pfad noch nie gelaufen (siehe 5.3). Die
Karte zeigt heute für jeden Mandanten nichts.

### 5.3 ~~Audit Claim fehlt~~ — **gebaut und deployt, in Produktion nie ausgeführt**

`supabase/functions/audit-claim/` existiert, ist deployt (v3, ACTIVE,
`verify_jwt = true`) und claimt atomar über `.is('claimed_at', null)`. Die
Autorisierung läuft wie vorgesehen über die verifizierte E-Mail.

Gemessen am 2026-09-06:

| Messung | Wert |
|---|---|
| `gdpr_audits` gesamt | **173** (2026-08-23: 159) |
| davon `claimed_at is not null` | **0** |
| davon `tenant_id is not null` | **0** |
| `subscriptions` | 6 |
| `entitlement_grants` | 0 |

**Was das heisst und was nicht.** Der Writer ist vorhanden und erreichbar; die
Zahl 0 belegt nur, dass niemand die Kette Audit → Registrierung → Dashboard
vollständig durchlaufen hat, seit sie existiert. Bei 6 Abos insgesamt ist das
kein Widerspruch. **Ob der Pfad funktioniert, ist damit weder bewiesen noch
widerlegt** — er ist ungetestet gegen die Wirklichkeit.

Der nächste Schritt ist deshalb kein Neubau, sondern **ein Durchlauf**: ein
echter Audit mit E-Mail, dieselbe E-Mail als Konto, Dashboard öffnen, danach
`claimed_at` messen. Erst wenn diese Zeile ungleich 0 ist, trägt der Trichter.

### 5.4 P1 — Modularer Checkout — **unverändert offen**

`stripe-checkout` nimmt weiterhin ausschliesslich `tenant_id`, `plan_key`,
`return_url` und `pilot` entgegen (v74, am Quelltext geprüft). Solange das so
ist, führt jedes Modul über den Plan, und `purchase: 'coming_soon'` bleibt für
`ai_frontend` die richtige Aussage. Vorbedingung ist die Preiskalkulation
(`MODULE_PRICING_STATUS = 'provisional'`), nicht die Oberfläche.

### 5.5 P1 — `tenant-audit` hängt weiter nicht im Kundenpfad — **unverändert offen**

`scan_runs` = **0**, `findings` = **0**, `monitoring_sources` = **0**
(gemessen 2026-09-06). Der einzige Aufrufer bleibt
`src/features/governance/scans/scansApi.ts`; im Trichter selbst wird die
Function nicht angestossen. Die Empfehlung rechnet deshalb aus
`gdpr_audits.issues`, nicht aus der Governance-Pipeline — was heute richtig
ist, weil die Pipeline im Kundenpfad nicht läuft.

### 5.6 ~~Publish Gate vor dem SiteOS-Publish~~ — **erledigt**

Existiert seit `20260822120000_siteos_publish_gate.sql`:
`packages/siteos-core/src/publish/gate.ts` (Kern),
`supabase/functions/siteos/handlers/publish-gate.ts` (Handler),
angebunden über `src/features/siteos/siteOsApi.ts`.

Die Aussage in §2.4, `entryRoute` führe „auf Bauen und Ansehen, nicht auf
Ausliefern", bleibt davon unberührt: Sie beschreibt, was `ai_frontend` als
**Kaufweg** bietet, nicht ob ein Publish-Gate existiert.


## 6. Regeln für das Weiterbauen

- **Keine vierte Empfehlungslogik.** Wer Befund→Modul ändert, ändert
  `REBUILD_FIXABLE_CODES` oder `DIMENSION_MODULE` — nicht die Struktur daneben.
- **Neue Befund-Codes gehören in die gemessene Liste**, nicht in eine zweite.
  Wer einen Code aufnimmt, ohne dass er in einem Audit vorkommt, verkauft gegen
  eine Vermutung.
- **`entryRoute` nur für Routen, die es gibt.** Die Quelle ist die
  Capability-Matrix, nicht die Absicht.
- **Kein Betrag in dieser Schicht.** Preise ausschliesslich aus
  `shared/pricing.ts`.
- **Der Scan führt, die Q&A ergänzt.** Eine Antwort darf einen Plan anheben und
  Module hinzufügen — nie etwas entfernen, das ein Befund trägt.

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

## 5. Was **nicht** integriert werden konnte

### 5.1 P0 — `supabase/functions/gdpr-audit/index.ts` ist im Repository unvollständig

**Gemessen, nicht vermutet.** Die Datei hat 217 Zeilen und ruft sechs
Funktionen auf, die weder in ihr definiert noch importiert sind:

| Bezeichner | definiert | importiert | aufgerufen |
|---|---|---|---|
| `runChecks` | nein | nein | ja (Z. 126) |
| `scanSubpages` | nein | nein | ja (Z. 127) |
| `extractFacts` | nein | nein | ja (Z. 131) |
| `scoreReport` | nein | nein | ja (Z. 156) |
| `fetchWithTimeout` | nein | nein | ja (Z. 105) |
| `concat` | nein | nein | ja (Z. 119) |

Die Datei endet mit der Überschrift `// ─── Heuristik-Checks ───` und **nichts
danach**. Vier Importe (`isLikelyGermanJurisdiction`, `stripPolicyDeclarations`,
`effectiveCspValue`, `detectAIDisclosure`) werden im verbleibenden Rumpf nie
benutzt — sie gehörten zum abgeschnittenen Teil.

`git log --follow` zeigt genau einen Commit für diese Datei (`7cfc199`,
2026-08-16, „feat(landing): make approved governance hero the live homepage",
217 Zeilen hinzugefügt). Sie wurde also **bereits abgeschnitten eingecheckt**
und nie ergänzt. In Produktion läuft eine vollständige Fassung — die Function
ist deployt und `gdpr_audits` hat 159 Zeilen. Repository und Produktion gehen an
dieser Stelle auseinander.

**Warum hier nicht repariert wurde**: Die fehlenden ~200 Zeilen enthalten die
Befund-Codes, die Severity-Zuordnung und die Score-Formel. Befund-Codes sind
laut `CLAUDE.md` versionsrelevant und laut `public-scan-funnel.md` §8 nicht
frei erfindbar. Sie zu rekonstruieren hiesse, die Messgrundlage des gesamten
Trichters zu raten — genau das, was §10 des Auftrags ausschliesst.

**Was zu tun ist**: Die deployte Fassung aus dem Live-Projekt zurückholen
(`supabase functions download gdpr-audit`) und als Ganzes einchecken. Danach
prüfen, ob die Codes der Live-Fassung mit der Liste in
`canonical-builder-target-matrix.md` §3 übereinstimmen — sie ist heute die
einzige belastbare Quelle für die tatsächlich vorkommenden Kennungen und trägt
deshalb auch `REBUILD_FIXABLE_CODES`.

### 5.2 P0 — Der Mandant bekommt die Empfehlung nicht (Akzeptanzkriterium I)

Der Trichter-Kontext liegt in der Sitzung. Damit überlebt er Reload, Anmeldung
und Stripe-Rückkehr im selben Tab — **aber er erreicht die Datenbank nie**. Nach
einem Tab-Wechsel ist er weg, und kein Mandant trägt seine Empfehlung.

Das ist bewusst offen: Ein Schreiber bräuchte entweder eine Spalte auf
`gdpr_audits` oder eine eigene Tabelle, und die Vorbedingung dafür ist der
**Audit Claim**, den `canonical-funnel-decision.md` §3.1 als einzigen echten
Neubau der Kette benennt und der ebenfalls noch fehlt. Eine Empfehlung an einem
Audit festzumachen, der dem Mandanten nicht zugeordnet ist, wäre die falsche
Reihenfolge.

### 5.3 P0 — Audit Claim fehlt weiterhin

Unverändert gegenüber `canonical-funnel-decision.md` §3.1: 159 Zeilen in
`gdpr_audits`, davon 0 mit `tenant_id`, 0 mit `claimed_at`. Der Einhängepunkt
existiert (`src/pages/Welcome.tsx` liest `sessionStorage['rsd_pending_audit']`
und verwirft die Kennung nach einem Consent-Eintrag). Der neue Kontext liegt
unter einem **eigenen** Schlüssel (`rsd.funnel.context`) und lässt
`rsd_pending_audit` unangetastet — der Claim kann beide lesen, wenn er gebaut
wird.

### 5.4 P1 — Modularer Checkout

`stripe-checkout` nimmt ausschliesslich einen `plan_key`. Solange das so ist,
führt jedes Modul über den Plan, und `purchase: 'coming_soon'` bleibt für
`ai_frontend` die richtige Aussage. Vorbedingung ist die Preiskalkulation
(`MODULE_PRICING_STATUS = 'provisional'`), nicht die Oberfläche.

### 5.5 P1 — `tenant-audit` hängt weiter nicht im Kundenpfad

`scan_runs` und `findings` sind unverändert leer. Die Empfehlung rechnet
deshalb aus `gdpr_audits.issues` über den Router-State, nicht aus der
Governance-Pipeline. Das ist heute richtig, weil die Pipeline im Kundenpfad
nicht läuft — und es ist der Grund, warum Schritt 2 der Reihenfolge aus
`canonical-funnel-decision.md` §6 als Nächstes ansteht.

### 5.6 P1 — Publish Gate vor dem SiteOS-Publish

Unverändert offen (`CLAUDE.md` §14, `reality-matrix.md`): Der Builder hat keinen
Publish-Handler und kein Gate. `entryRoute` führt deshalb auf Bauen und
Ansehen, nicht auf Ausliefern.

---

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

# RealSync – Preise

**Stand:** 27.10.2026 · **Quelle:** `main` @ `c9a7da6`
**Zweck:** Projektwissen für claude.ai. Teil A beschreibt, was die Live-Website heute zeigt. Teil B fasst Vorschläge zusammen, die **nicht** live sind.
**Regel:** Wenn Code und Doku sich widersprechen, gilt der Code. Die Widersprüche stehen unter A.6.

---

## TEIL A – Aktuelle Preise (live)

### A.1 Wo die Wahrheit steht

| Ebene | Datei | Rolle |
|---|---|---|
| Preis-SSoT | `shared/pricing.ts` | einzige Quelle für Preise, Limits, Features, Add-ons und Steuermodus |
| Frontend-Projektion | `src/config/pricing.ts` | leitet Tiers ab (`SELLABLE_PRICING_TIERS`, `tierPriceLabel()`) und enthält keine eigenen Preise |
| Startseite `/` (Landing v6) | `src/components/landing/v6/useLandingV6.ts` | zeigt die Karten Starter, Growth, Agency und Enterprise aus der SSoT, plus Beta-Logik |
| Preisseite `/pricing` | `src/features/billing/PricingPage.tsx` | Free-Audit-Karte plus `SELLABLE_PRICING_TIERS`; `/preise` leitet hierher weiter |
| Beta-Schalter | `src/config/beta.ts` | blendet „kostenlos bis …“ ein und leitet den Checkout um |
| Steuerhinweis | `shared/pricing.ts` → `PRICING_TAX_MODE = 'EU_STANDARD'` | Netto-Preise, B2B |

### A.2 Preistabelle (Listenpreise laut SSoT)

**MwSt.:** Alle Beträge sind **netto**. Bei den Preisen steht wörtlich: *„Angebot nur für Unternehmer (B2B) – alle Preise zzgl. gesetzlicher Umsatzsteuer.“* Bruttobeträge weist die Website nicht aus. Für den Fall des Steuermodus `EXEMPT` gibt es zusätzlich einen Kleinunternehmer-Text nach § 19 UStG, der derzeit **nicht** aktiv ist.

| Plan | Preis monatlich / jährlich | netto/brutto | Zielgruppe | Kern-Kontingente / Features | Trial/Beta-Hinweis |
|---|---|---|---|---|---|
| **Free Audit** | 0 € / – | – | Einstieg ohne Account | 1 Domain, 1 Audit-Bericht/Monat, 0,5 GB Evidence, 1 Sitz, kein Bot. Scan mit Governance Score, Top-3-Risiken, PDF-Kurzbericht. SiteOS nur als Preview. | kostenlos, kein Account nötig |
| **Starter** | 79 € / 790 € *(Jahrespreis nicht buchbar)* | netto zzgl. USt. | ein Unternehmen, Governance-Fundament | 1 Bot (500 Antworten, Website), 1 Domain, 1 SiteOS-Site, 1 Sitz, 25 Automationsläufe, 2 GB Evidence, 2 Berichte/Monat, kein API-Zugang. Policy Packs DSGVO und EU AI Act, Evidence Vault, Audit-Export (PDF/JSON). Monitoring: *Coming Soon*. | 14 Tage Test · **Beta: 0 €** bis 31.01.2027, Listenpreis durchgestrichen |
| **Growth** ⭐ *Empfohlen* | 249 € / 2.490 € *(nicht buchbar)* | netto zzgl. USt. | Teams mit einem Mandanten | 2 Bots (2.000 Antworten; Website, WhatsApp, Telegram), 3 Domains, 3 Sites, 5 Sitze, 100 Automationsläufe, 5.000 API-Calls, 3 API-Keys, 10 Bulk-Jobs, 10 GB, 12 Berichte/Monat. Dazu ISO 27001, Risk Register, Policy Engine, API, Webhooks, Scheduler und Provenance. Drift-Monitoring: *Coming Soon*. | 14 Tage Test · **Beta: 0 €** bis 31.01.2027 |
| **Agency** | 699 € / 6.900 € *(nicht buchbar)* | netto zzgl. USt. | Agenturen mit mehreren Kunden | 10 Bots (10.000 Antworten, alle Kanäle inkl. Voice), 10 Domains, 10 Sites, 15 Sitze, 500 Automationsläufe, 50.000 API-Calls, 10 Keys, 50 GB, 50 Berichte/Monat. Dazu NIS2 (TISAX nur Roadmap), White-Label-Berichte, Bulk-CSV-Scans, n8n und Kodee *(Preview)*. Nur **1** Mandant. | kein Trial, monatlich kündbar · **Beta: 0 €** bis 31.01.2027 |
| **Enterprise** | **„Auf Anfrage“** *(interner Listenpreis in `shared/pricing.ts`: 1.249 €/Monat, wird öffentlich nicht gezeigt; Owner-Vorgabe 1.498 € liegt nur in offenen PRs #1995/#1999)* | – | Konzerne, bis 5 Organisationen | 20 Bots (50.000 Antworten), 25 Domains, 50 Sitze, 250.000 API-Calls, 200 GB, 200 Berichte/Monat. Multi-Tenant-Dashboard, SSO *(Coming Soon)*, SLA nach Vereinbarung. Laut Vertrag gilt: `-1` heißt, der Vertrag begrenzt. | kein Self-Service-Trial, Kontakt über Sales, nicht Teil der Beta |
| **Governance Launch** | **349 € einmalig** | netto zzgl. USt. | Ersteinrichtung für einen Anwendungsfall | 1 Domain, 1 Bot (1.000 Antworten), 3 Sitze, 5 GB, 5 Berichte, 10 Automationsläufe. DSGVO-Pack ist eingerichtet. SiteOS-Publish ist nicht enthalten. Steht nicht auf der Abo-Leiter. | kein Trial; liegt nicht im `/pricing`-Raster, steht aber im JSON-LD und im Transformation-Flow |
| *Partner* (legacy) | *intern 1.999 € / 19.000 €* | – | Reseller (bis 50 Mandanten) | stillgelegt (`availability: 'legacy'`). Bestandsabos laufen weiter, neu buchen kann man ihn nicht. | wird nicht angezeigt |

**Jahresabrechnung:** Für **alle** Pläne gilt `yearlyCheckoutUnavailable: true`. Der Owner hat am 2026-09-01 entschieden, vorerst keine Jahres-Abos zu verkaufen. Die Website blendet deshalb keinen Jahrespreis ein, `/pricing` zeigt *„Jährlich · Coming Soon“*. Die Jahresbeträge oben sind interne Listenpreise nach der Regel „12 zum Preis von 10“.

**Weitere Regeln aus dem Code:**
- Ein Betrag darf nur öffentlich stehen, wenn der Kaufpfad ihn auch einlöst (`tierPriceLabel()`, `npm run check:offer-prices`).
- Bezahlung per Karte oder SEPA-Lastschrift über Stripe. Price-IDs stehen nie im Frontend, sie werden serverseitig aufgelöst.
- Die Trust-Zeile lautet: *„Free Audit kostenlos · 14 Tage kostenlos testen · Monatlich kündbar · Keine Setup-Gebühren · Made in Germany“*.
- Runtime Credits gibt es nur als Shadow-Rating und internen Stub. Sie sind **nicht verkäuflich** und haben keinen Preis.

### A.3 Beta-Schalter (`src/config/beta.ts`)

| Schalter | Wert heute | Wirkung auf die Preisanzeige |
|---|---|---|
| `VITE_BETA_PHASE` (Build-Env) | nicht gesetzt, also **an** | `BETA.active`: Beta-Banner, Checkout-Umleitung für Starter, Growth und Agency auf `/welcome?beta=1…` (Ausnahme `?purchase=1`), Hinweise in der App |
| `BETA.publicOffer` | `true` (Owner-Entscheidung vom 21.10.2026: bleibt an bis zur gesonderten Freigabe) | Landing v6 zeigt bei Starter, Growth und Agency **0 €** mit durchgestrichenem Listenpreis und *„kostenlos bis 31. Januar 2027“*. CTA: „Kostenlos testen“. |
| `BETA.endsLabel` | „31. Januar 2027“ | reiner Anzeigetext, keine Logik |
| `BETA.testPlan` | `growth` | Umfang, den Beta-Tester testen dürfen |

- **`VITE_BETA_PHASE=off`:** Überall erscheinen wieder die Listenpreise. Starter und Growth zeigen „14 Tage kostenlos testen · monatlich kündbar“, Agency „monatlich kündbar“. Der Checkout geht wieder an Stripe.
- **`publicOffer = false` (bei aktiver Beta):** Die Listenpreise erscheinen, die Checkout-Umleitung und bestehende Beta-Zugänge bleiben aber erhalten.
- **Claims vs. Runtime:** Dass Beta-Mandanten serverseitig wirklich Growth-Funktionen bekommen, regelt der Entitlement-Pfad (WP-3). Bis dahin verspricht die UI nur „kostenlos testen“.
- Enterprise ist von der Beta nicht betroffen und bleibt „Auf Anfrage“.

### A.4 Add-ons (monatlich, netto; SSoT `ADDONS`, Doku `docs/product/addon-booking.md`)

| Add-on | Preis | Angeboten für (`availableFor`) | Gewährt (additiv zum Plan) |
|---|---|---|---|
| WhatsApp | 99 € zzgl. WhatsApp-Konversationsgebühren | **Starter** (ab Growth enthalten) | WhatsApp-Kanal, 500 Konversationen/Monat |
| Response Pack | 49 € | Growth | +5.000 Bot-Antworten/Monat (verfallen am Monatsende) |
| Voice | 150 € zzgl. 0,25 €/Minute | Growth | Voice-Kanal, IVR, Human Handoff, 500 Minuten |
| Compliance Pack | 149 € | Growth | erweitertes Evidence, Report-Export, +100 Compliance-Exporte |
| Agency Bot Pack | 199 € | Growth | +5 Governance-Bots |
| White Label | 299 € | Growth | White-Label-Reports und -Dashboard, eigene Domain |

- Kontingente werden **addiert**: Growth mit Response Pack ergibt 7.000 Antworten. Boolesche Rechte werden vereinigt.
- Was ein Bestandskunde buchen darf, steht in `plan.addons`. Agency und Enterprise behalten so ihre Add-on-Listen.
- **Buchbarkeit:** Laut `addon-booking.md` §3 (Stand 2026-09-01) ist ein Add-on erst buchbar, wenn je Add-on ein wiederkehrender Stripe-Price eingetragen ist (Betreiberschritt mit Owner-Freigabe). Bis dahin zeigt „Mein Plan“ *„Buchung folgt“*. Ob das inzwischen erledigt ist, lässt sich aus dem Repo nicht prüfen.
- Daneben gibt es **buchbare Module** (`BOOKABLE_MODULES`, Status `provisional` = Testwerte, keine kalkulierten Preise): Governance Core 79 € (Pflicht), AI Frontend 49 €, Website Chat 39 € + Verbrauch, Voice Bot 99 € + Verbrauch, WhatsApp Bot 99 € + Gebühren, Terminbuchung 29 €, Advanced AI Governance 149 €, weitere Domain 19 €/Stück, weiteres Unternehmen 49 €/Stück. Sichtbar sind sie im Marketplace (`/app/marketplace`), nicht auf der Preisseite.

### A.5 Kontingente – welche Quelle gilt (`docs/product/kanonische-kontingente.md`, Owner-Entscheid vom 25.08. und 31.08.2026)

| Planart | Kanonische Quelle |
|---|---|
| Self-Service (Free, Starter, Growth, Agency) | `plan.limits` in `shared/pricing.ts`, also die öffentliche Preisseite |
| Vertrag (Enterprise, `availability: 'contract'`) | **der Vertrag**. Im System steht `-1` für „das System begrenzt nicht, der Vertrag tut es“ (Option A). Für Verträge mit Obergrenze bräuchte es Option B (Tenant-Overrides). |
| Technische Entitlements (`PLAN_ENTITLEMENTS`, `product_entitlements`) | werden abgeleitet und sind **nie** selbst die Wahrheit |

Grace Period: Wenn eine Zahlung fehlschlägt, bleiben die Rechte 7 Tage aktiv (`past_due`). Danach fallen sie auf Free-Niveau zurück. Daten werden dabei nicht gelöscht.

### A.6 Abweichungen (Code gewinnt)

1. **`/pricing` ignoriert das Beta-Angebot.** Die Landing zeigt für Starter, Growth und Agency „0 € bis 31.01.2027“. `/pricing` zeigt dieselben Pläne mit Listenpreis und „14 Tage kostenlos testen“. Die CTAs dort führen über `/checkout/...` trotzdem in die Beta-Registrierung. Anzeige und Kaufweg passen also nicht zusammen.
2. **Agency-Status.** `zielzustand-paketmodell.md`, `implementierungsplan-paketmodell.md` (AP2.2) und `kanonische-kontingente.md` führen Agency als stillgelegt. Im Code ist Agency seit der Landing-Referenz 2026-09 wieder `self_service` (699 €). Mehrere Code-Kommentare sind ebenfalls veraltet: Der `AddOn.availableFor`-Kommentar nennt Agency „stillgelegt“, der Kommentar zu `SELLABLE_PRICING_TIERS` nennt „Starter, Growth und Enterprise“.
3. **Agency hat keine angebotenen Add-ons.** Kein Add-on führt `agency` in `availableFor`. Buchbar sind sie für Agency nur über `plan.addons`.
4. **Voice hat zwei Preise:** 150 € als Add-on, 99 € als Modul. Die Abweichung ist im Code benannt (`MODULE_ADDON_PRICE_DIVERGENCE`) und bleibt bewusst offen, bis die Telefonie-Kosten kalkuliert sind.
5. **Zielgruppen der Add-ons:** `zielzustand-paketmodell.md` §5 nennt Voice und Response Pack für Starter und Growth, der Code nur Growth. Der Entscheidungsbericht (E.1) nennt für WhatsApp „ab Growth“, der Code nach AP2 nur Starter.
6. **Monitoring:** Die Zielzustands-Doku setzt „monatliche Überwachung ab Starter, täglich + Drift ab Growth“ als verdrahtet voraus. Die Live-Feature-Listen kennzeichnen beides als *Coming Soon*.
7. **Trial-Text:** Die Trust-Zeile sagt pauschal „14 Tage kostenlos testen“. Agency und Enterprise haben aber `trialDays: 0`. Die Fußnote der Preisseite stellt das richtig.
8. **`/pricing/whatsapp`** pflegt 79 € und 249 € als Literale in der Komponente statt sie aus der SSoT zu lesen. Die erfundenen 1.249 € für Enterprise sind entfernt, dort steht jetzt „Auf Anfrage“.
9. **Pricing-Rollout-Plan:** Er meldet `UnifiedPricingGrid` als geliefert. Im Repo liegt unter `src/components/pricing/unified/` nur `UnifiedPlanCard.tsx`.

---

## TEIL B – Vorgeschlagenes neues Preismodell – ENTWURF

> ⚠️ ENTWURF – nicht beschlossen, nicht live, nicht kommunizieren.

Die folgenden Dokumente sind Vorschläge, Analysen oder Pläne. Wo eine Entscheidung gefallen und umgesetzt ist, steht sie bereits in Teil A. Hier steht nur, was darüber hinausgeht oder noch offen ist.

### B.1 Übersicht der Vorschläge

| Dokument | Datum / Status | Kernaussage |
|---|---|---|
| `docs/product/plan-consolidation-proposal.md` | 23.08.2026 · **Vorschlag, nicht umgesetzt** | Free + 2 Kernpakete + Modul-Store, siehe B.2 |
| `docs/product/pricing-packaging-entscheidungsbericht.md` | 24.08.2026 · **Analyse, kein Code** | Leiter behalten und bereinigen, Core + Add-on auf der bestehenden Kette. Widerspricht der Owner-Vorgabe „max. 3 bezahlte Pakete“. |
| `docs/product/zielzustand-paketmodell.md` | 24.08.2026 · **Konzept**, Preise teils mit PROPOSED markiert | drei bezahlte Stufen (Starter, Growth, Enterprise), Agency/Partner entfallen als Self-Service, ein Vokabular (Entitlement-Keys), WhatsApp-Modell B, 7 Tage Grace Period |
| `docs/product/implementierungsplan-paketmodell.md` | 24.08.2026, Umsetzungsstand 01.09.2026 | AP1–AP11. Fünf Owner-Entscheidungen sind umgesetzt, siehe B.3. **AP5 (Stripe-Prices für Add-ons) ist offen.** |
| `docs/product/PRICING_ROLLOUT_PLAN.md` | „Q3 2026 – Phase 1“ | **kein Preismodell**, sondern ein UI-Refactor (einheitliche Karten-Komponenten). Extern ist keine Ankündigung vorgesehen. |
| `docs/product/pricing-governance.md` | verbindliches Regelwerk, laufend gepflegt | SSoT-Kette, sechs Pläne in `PLAN_ORDER`, Einmalprodukte, die Regel „Betrag nur mit Kaufpfad“, Stripe-Abgleich. Nennt selbst keine Zahlen. |

### B.2 Konsolidierungsvorschlag (23.08.2026) – offen

```
FREE (0 €) · STARTER (= Governance Core) · BUSINESS (= Growth + Advanced AI Governance)
      + Dashboard-Modul-Store (Chat, Voice, WhatsApp, Booking, AI Frontend, Domain, Unternehmen)
      + ENTERPRISE auf Anfrage (White-Label, Multi-Tenant, SLA, Partner-Konditionen)
```
- „Ein Kanal, ein Preis“: Die Add-ons Voice, WhatsApp und Response Pack sollen zugunsten der Module stillgelegt werden.
- Migrationspfad: Zuerst Kosten kalkulieren, dann `PLAN_ORDER` verkleinern, Bestandskunden per Grandfathering mitnehmen, alte Stripe-Prices archivieren statt löschen.
- **Offen:** der Name „Business“ (Arbeitstitel; „Scale“ ist untersagt), ob Advanced AI Governance fest im Paket oder als Modul kommt, Umgang mit Agency-Bestandskunden und **die Preispunkte**. Der Vorschlag nennt bewusst keine neuen Beträge.

### B.3 Entschieden vs. offen

**Entschieden und umgesetzt** (Owner, 24.08.–01.09.2026):
- WhatsApp kostet 99 € als Starter-Add-on und ist in Growth enthalten. Der zweite Preis von 39 € ist entfallen.
- `policy.packs` gibt es ab Starter.
- Die sechs Keys der Fremdleiter (bronze, silver, gold, enterprise_public) werden stillgelegt, nicht gelöscht.
- Grace Period: 7 Tage.
- Die erfundenen 1.249 € für „Enterprise WhatsApp“ sind gestrichen.
- Enterprise-Add-ons werden nicht mehr angeboten (`availableFor` = nur Growth).
- Keine Jahres-Abos bis auf Weiteres (01.09.2026).
- Enterprise-Kontingente: Option A (`-1` = Vertrag begrenzt).

**Später revidiert:** Die Stilllegung von Agency aus AP2.2 gilt nicht mehr. Agency ist seit 2026-09 wieder Self-Service.

**Offen:**
1. Drei bezahlte Pakete (Owner-Vorgabe vom 23.08.) oder Leiter behalten (Empfehlung des Entscheidungsberichts)? Live sind heute faktisch vier Karten: Starter, Growth, Agency, Enterprise.
2. Konsolidierung nach B.2 und ihre Preispunkte: nicht entschieden.
3. Modulpreise sind `provisional`. Sie müssen aus Infrastrukturkosten (Telefonie, STT/TTS, LLM-Token, WhatsApp-Gebühren, Scan-Laufzeit) rückwärts kalkuliert werden.
4. Voice kostet 99 € als Modul und 150 € als Add-on. Das klärt sich erst mit der Kalkulation.
5. AP5: Für das Anlegen echter Stripe-Prices je Add-on fehlt die Owner-Freigabe.
6. Ruht die Überwachung während der Grace Period oder läuft sie weiter? Die Doku empfiehlt „ruhen“.
7. Runtime Credits: Erst den Verbrauch messen, dann Inklusivmenge, Paketgröße, Preis und Margin-Floor festlegen. Bis dahin gibt es keine SKU.
8. Ende der Beta bzw. `BETA.publicOffer = false` braucht eine gesonderte Owner-Freigabe.

### B.4 Platzhalter: Preismodell AI Employee Platform (aus Pivot-Strategie)

> Wird nach Einfügen des Pivot-Prompts (01-strategie.md) befüllt.

| Paket | Preis | Abrechnungseinheit (z. B. pro KI-Mitarbeiter/Monat) | enthaltene Governance | offen |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

---

## Quellen

- `shared/pricing.ts`: Preis-SSoT (`PLANS`, `ADDONS`, `BOOKABLE_MODULES`, `MODULE_PRICING_STATUS`, `RUNTIME_CREDIT_PACK_STUBS`, `PRICING_TAX_MODE`, `PRICING_TRUST_NOTE`)
- `src/config/pricing.ts`: Frontend-Projektion (`SELLABLE_PRICING_TIERS`, `tierPriceLabel()`)
- `src/components/landing/v6/useLandingV6.ts`: Preisdarstellung der Startseite `/`
- `src/features/billing/PricingPage.tsx`: `/pricing`
- `src/features/billing/CheckoutPage.tsx`: Beta-Umleitung im Checkout
- `src/config/beta.ts`: Beta-Schalter
- `src/pages/WhatsAppPricingPage.tsx`: `/pricing/whatsapp`
- `src/i18n/handoff.ts`: Trust- und Trial-Texte auf `/pricing`
- `index.html`: JSON-LD-Offers
- `docs/product/addon-booking.md`
- `docs/product/kanonische-kontingente.md`
- `docs/product/zielzustand-paketmodell.md`
- `docs/product/plan-consolidation-proposal.md`
- `docs/product/pricing-packaging-entscheidungsbericht.md`
- `docs/product/implementierungsplan-paketmodell.md`
- `docs/product/PRICING_ROLLOUT_PLAN.md` (`docs/PRICING_ROLLOUT_PLAN.md` existiert nicht)
- `docs/product/pricing-governance.md`

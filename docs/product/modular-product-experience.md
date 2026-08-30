# Modulare Product Experience — Analyse, Entscheidungen, Migrationsplan

**Status**: Phase 1 umgesetzt, Phasen 2–14 offen
**Bezug**: Master-Prompt „Modulare Product Experience" (§§1–26)
**Leitsatz**: **Compliance ist das Fundament, das Frontend ist optional,
AI- und Business-Funktionen sind Module.**

Dieses Dokument ist die verbindliche Spezifikation des Umbaus und bleibt
bestehen, bis der Umbau abgeschlossen ist. Die **gemessene** Bestandsaufnahme
steht in `docs/product/reality-matrix.md` (Phase 0) — bei Widerspruch gilt
die Messung. Es ersetzt keine Aussage aus
`CLAUDE.md`; wo es widerspricht, gilt `CLAUDE.md`.

---

## 1. Ist-Zustand — was bereits existiert

Der Master-Prompt fordert in §23/§26 ausdrücklich eine Bestandsaufnahme
**vor** jeder Änderung. Ergebnis:

| Baustein | Zustand | Ort |
|---|---|---|
| Kostenloser Scan ohne Account | **vorhanden** | `supabase/functions/cookie-scan`, aufgerufen aus `ScanEntryPage` |
| Trichter Scan → Vorschau → Registrierung → Onboarding → Erfolg | **vorhanden** | `src/unified-entry/`, Routen `/unified-entry/*` |
| Frontend-Erzeugung (Brief → Blueprint → Template → Render) | **vorhanden** | `packages/siteos-core`, `docs/SITEOS_ARCHITECTURE.md` |
| Governance Runtime (Scan, Policy Engine, Evidence, Risk, Audit, API) | **vorhanden** | `supabase/functions/`, `src/features/governance/` |
| Preis- und Berechtigungsmodell als SSoT | **vorhanden** | `shared/pricing.ts` (+ Deno-Zwilling, Drift-Test) |
| Stripe-Abo und Einmalkauf | **vorhanden** | Edge Functions, `entitlement_grants`, `subscriptions` |
| Mandantentrennung über RLS | **vorhanden** | `tenant_id` auf jeder Geschäftstabelle |
| Multi-Company (mehrere Unternehmen je Konto) | **fehlt** | ein User → genau ein Tenant (`CLAUDE.md` §11) |
| Booking Engine | **fehlt** | keine Tabellen, kein Service |
| Modularer Checkout (Core + zubuchbare Module) | **fehlt** | Checkout kennt nur Pläne und Add-ons |
| Weiche „behalten vs. modernisieren" | **umgesetzt in Phase 1** | siehe §3 |

### Der eigentliche Befund

Der bestehende Trichter war ein **Website-Umbau-Trichter**. Die Einstiegsseite
fragte „Welche Website sollen wir neu bauen?", der Scan führte unmittelbar in
die Gestaltungsauswahl, und wer ausschliesslich Compliance wollte, hatte
keinen Ausgang. Das steht dem Produktgrundsatz entgegen: Governance muss
unabhängig davon funktionieren, ob jemand sein Frontend anfassen will.

Das ist keine Preis- und keine Oberflächenfrage, sondern die
Architekturentscheidung des Umbaus. Sie wurde deshalb zuerst umgesetzt.

---

## 2. Begriffsklärung — drei Dinge, die nicht dasselbe sind

`shared/pricing.ts` führt jetzt drei benachbarte Begriffe. Sie werden
regelmässig verwechselt; die Unterscheidung ist verbindlich:

| Begriff | Was es ist | Preis? | Beispiel |
|---|---|---|---|
| `ModuleDefinition` / `ModuleId` | eine **Fähigkeit** der Runtime | nein | `evidence_vault` |
| `AddOn` / `AddOnId` | ein **Zusatz innerhalb der Plan-Leiter** | ja, plan-gebunden | `voice` (150 €) |
| `BookableModule` / `BookableModuleId` | eine **Verkaufseinheit des modularen Checkouts** | ja, plan-unabhängig | `voice_bot` (99 € + Verbrauch) |

Berechtigungen werden weiterhin **ausschliesslich** über `hasModule()`,
`hasPermission()` und `limitOf()` entschieden. Ein `BookableModule` schaltet
über sein Feld `unlocks` Fähigkeiten frei — der Kaufweg ändert nichts daran,
wie Zugriff geprüft wird.

### Offener Konflikt: doppelte Preise für denselben Kanal

Voice und WhatsApp existieren jetzt zweimal — als Add-on innerhalb der
Plan-Leiter und als eigenständiges Modul, mit unterschiedlichen Beträgen
(Voice 150 € vs. 99 €, WhatsApp 99 € vs. 39 €). Das ist auf Dauer kein
haltbarer Zustand.

Die Auflösung gehört in die Preiskalkulation (§5), nicht in eine
stillschweigende Angleichung im Code. Bis dahin ist die Abweichung in
`MODULE_ADDON_PRICE_DIVERGENCE` **deklariert** und über
`test/config/bookable-modules.test.ts` festgenagelt: Wer einen der beiden
Preise ändert, muss die Entscheidung bewusst treffen.

---

## 3. Phase 1 — umgesetzt

### 3.1 Modulkatalog in der SSoT

`shared/pricing.ts` (additiv, kein bestehender Export geändert):

- `ProductTrack` = `keep_frontend` | `modernize_frontend` — zwei
  **gleichwertige** Pfade, kein Auf-/Abstieg, jederzeit wechselbar.
- `BOOKABLE_MODULES` — neun Verkaufseinheiten: `governance_core` (Pflicht),
  `ai_frontend`, `website_chat`, `voice_bot`, `whatsapp_bot`, `booking`,
  `advanced_ai_governance`, `additional_domain`, `additional_company`.
- `modulesForTrack()`, `monthlyBaseTotalEur()`, `hasUsageBasedModules()`,
  `normalizeModuleSelection()`.
- Der Deno-Zwilling `supabase/functions/_shared/pricing.generated.ts` ist
  über `npm run sync:pricing` nachgezogen; der Drift-Test bleibt grün.

Zwei Regeln sind als Test abgesichert, nicht nur als Kommentar:

1. **Ohne Frontend-Umbau entfällt genau ein Modul** — `ai_frontend`. Chat,
   Voice, WhatsApp und Terminbuchung bleiben buchbar, weil sie über
   Snippet, SDK oder API auch auf einem fremden Frontend laufen. Deshalb
   steht `requiresFrontend` bei keinem anderen Modul auf `true`.
2. **Module mit echten Drittkosten sind verbrauchsabhängig gekennzeichnet**
   (`flat_plus_usage`): Voice (Telefonie, STT/TTS), WhatsApp
   (Konversationsgebühren), Website Chat (LLM-Token). `monthlyBaseTotalEur()`
   liefert bewusst nur den Festanteil — eine Oberfläche, die eine Endsumme
   verspricht, muss `hasUsageBasedModules()` mitprüfen und den Verbrauch
   getrennt ausweisen.

### 3.2 Entscheidungsseite nach dem Scan

Neue Route `/unified-entry/entscheidung` (`PathChoicePage`). Sie zeigt das
Scan-Ergebnis und stellt beide Wege gleichwertig nebeneinander — keiner ist
als „empfohlen" markiert, keiner ist optisch grösser, die Governance-Karte
steht zuerst.

- Option A → `/unified-entry/register?track=keep_frontend`
- Option B → `/unified-entry/preview?track=modernize_frontend` (bestehende
  Gestaltungsauswahl), danach ebenfalls Registrierung

### 3.3 Pfad-Persistenz

`src/unified-entry/productTrack.ts`. Die Wahl fällt **vor** der
Registrierung — es gibt zu diesem Zeitpunkt keinen Mandanten, unter dem sie
gespeichert werden könnte. Sie liegt deshalb bis zum Anlegen des Kontos in
`sessionStorage` und reist über den Query-Parameter `track`.

Bewusst `sessionStorage`, nicht `localStorage`: eine Trichter-Entscheidung,
keine dauerhafte Einstellung. Alle Lesepfade behandeln Speicher und URL als
Nutzereingabe — beschädigter JSON, unbekannte Modul-IDs und manipulierte
Pfadwerte fallen weg, statt in den Checkout zu laufen.

### 3.4 Was in Phase 1 bewusst **nicht** geändert wurde

Der Design-Freeze (`CLAUDE.md` §10) erlaubt Ergänzungen ohne Rückfrage,
verlangt aber für jede Änderung an bestehendem Text, Button oder
backend-gebundener Funktion eine Freigabe. Deshalb:

- Die Einstiegsseite `/unified-entry/scan` ist **unverändert**. Ihr Text
  („Welche Website sollen wir neu bauen?") und ihr Ziel nach dem Scan
  (`/unified-entry/preview`) bleiben, wie sie sind.
- Die Weiche ist stattdessen **additiv** erreichbar: auf der Vorschauseite
  über einen neu ergänzten Ausgang „Bestehende Website behalten → nur
  Governance".
- **Offene Freigabe**: Damit die Weiche der Regelfall wird — Scan → Weiche
  statt Scan → Gestaltungsauswahl — müssen Ziel und Überschrift der
  Einstiegsseite geändert werden. Das ist eine Text- und Funktionsänderung
  nach §10.3 und wartet auf eine Entscheidung. Solange sie aussteht, bleibt
  der Umbau-Trichter der Standardweg und die Weiche ein Nebenausgang.

---

## 4. Auswirkungen auf Datenbank, API und Stripe

Noch **nicht** umgesetzt — hier steht, was die folgenden Phasen brauchen.

### Datenbank (additiv, RLS-pflichtig)

> **Korrigiert nach der Messung.** Ein früherer Stand dieses Abschnitts nannte
> eine Tabelle `tenant_modules` für aktive Module. Das war falsch: die
> Entitlement-Ebene existiert bereits vollständig
> (`products` → `product_entitlements` → `entitlements`, dazu
> `entitlement_grants` und `subscriptions`). Eine eigene Modul-Tabelle wäre
> eine zweite Wahrheit daneben. Module werden stattdessen als `products`-Zeile
> plus `product_entitlements` abgebildet. Beleg und Details:
> `docs/product/reality-matrix.md` §3.

| Tabelle | Zweck | Phase |
|---|---|---|
| `tenant_product_track` | gewählter Pfad je Mandant, mit Historie | 3 |
| *(keine neue Modul-Tabelle)* | Module über `products` + `product_entitlements` | 5 |
| `companies` | mehrere Unternehmen je Konto | 13 |
| `booking_*` (Location, Employee, Service, Break, Holiday, Vacation, BookingRule) — ergänzt die vorhandenen `availability_rules` / `appointments`, die heute am `bot_id` statt am Unternehmen hängen | Booking Engine | 9 |

Jede Tabelle mit `tenant_id UUID NOT NULL REFERENCES tenants(id)`, RLS
aktiviert, Migration additiv. Multi-Company (Phase 13) berührt die Annahme
„ein User → ein Tenant" aus `CLAUDE.md` §11 und ist deshalb die
risikoreichste Phase — sie gehört ans Ende, nicht an den Anfang.

### API

Bestehende Endpunkte werden wiederverwendet. Fehlt einer, wird er
**dokumentiert und als fehlende Verbindung markiert** (§8 des
Master-Prompts) — nicht durch eine destruktive Änderung ersetzt.

Neu nötig: Modul-Aktivierung/-Deaktivierung, Slot-Berechnung der Booking
Engine, Unternehmenswechsel.

### Stripe

Stripe bleibt die Quelle der Wahrheit für Abo, Preise, Zyklus, Status und
Rechnung. Für den modularen Checkout braucht jedes `BookableModule` ein
eigenes Price-Objekt; verbrauchsabhängige Module zusätzlich ein metered
Price. Die Auflösung läuft weiterhin serverseitig über
`public.products.default_for_plan_key` — Price-IDs gehören nicht in
`shared/pricing.ts`. Webhook-Verarbeitung bleibt idempotent.

---

## 5. Offene Entscheidung: die Modulpreise

Die Beträge in `BOOKABLE_MODULES` sind **Testwerte**, ausdrücklich markiert
über `MODULE_PRICING_STATUS = 'provisional'` und durch einen Test
festgehalten. Sie sind bewusst nicht festgezurrt.

Vor der Freigabe müssen sie aus den tatsächlichen Infrastrukturkosten
rückwärts kalkuliert werden:

| Modul | Kostentreiber |
|---|---|
| Voice Bot | Telefonieminuten, Speech-to-Text, Text-to-Speech |
| Website Chat | LLM-Token je Konversation |
| WhatsApp Bot | Konversationsgebühren von Meta |
| Governance Core | Scan-Laufzeit, Speicher im Evidence Vault |
| Weitere Domain | Scan-Frequenz × Domains |

Ohne diese Rechnung verkauft ein intensiver Voice-Kunde die Marge auf. Die
Struktur (`flat` vs. `flat_plus_usage` vs. `per_unit`) ist bereits so
angelegt, dass die Kalkulation nur noch Beträge einsetzen muss.

Ebenfalls offen: der Betrieb läuft laut `CLAUDE.md` §5 auf Supabase-Plan
`free` — ohne tägliche Backups, ohne Point-in-Time-Recovery, ohne SLA. Für
ein Produkt, das Prüfpfad und Evidence-Hash-Ketten zusagt, ist das ein
eigener Governance-Befund und sollte vor dem Verkauf zusätzlicher Module
geklärt sein.

---

## 6. Phasenplan

| # | Phase | Zustand |
|---|---|---|
| 1 | Produkt-/Routing-Struktur, Modulkatalog, Weiche | **umgesetzt** |
| 2 | Free-Scan-Flow ausrichten | **umgesetzt 2026-08-23** — Freigabe erteilt (`CLAUDE.md` §10), siehe unten |
| 3 | Registrierung: Pfad und Scan-Ergebnis dem Konto zuordnen | **Scan-Ergebnis umgesetzt**, Pfad (`ProductTrack`) weiterhin offen |
| 4 | Pricing Engine: Auswahl-UI auf `BOOKABLE_MODULES` | **teilweise** — `/app/marketplace` zeigt den Katalog mit echtem Zustand; die Auswahl-UI für den Checkout fehlt (Phase 5) |
| 5 | Stripe Checkout modular (Core + Module, metered für Verbrauch) | offen — Vorbedingung: Preiskalkulation |
| 6 | Dashboard-Navigation nach §9 | **teilweise** — Marketplace ergänzt, Restumbau offen |

### Nachtrag 2026-08-23 — die Freigabe aus §3.4 ist erteilt

Der Eigentümer hat die CTA-Hierarchie der Startseite ausdrücklich angewiesen
(Auftrag „Landingpage / Scan / Dashboard / Marketplace Refactor", §2 und §24).
Damit ist die in §3.4 und in `reality-matrix.md` §5.1 offene Entscheidung
beantwortet. Umfang und Wortlaut der Freigabe stehen in `CLAUDE.md` §10 unter
„Erteilte Freigaben".

Umgesetzt wurde allerdings **nicht** „Scan → Weiche", sondern ein eigener
öffentlicher Trichter: `/scan` → `/scan/ergebnis` → Registrierung. Der Grund
ist der Produktgrundsatz aus dem Auftrag: Der Kunde soll **vor** dem Bezahlen
einen echten Nutzen sehen, und dafür braucht er zuerst ein vollständiges
Ergebnis — nicht sofort eine Wegentscheidung. Die Weiche
(`/unified-entry/entscheidung`) bleibt bestehen und erreichbar; sie ist
weiterhin der Einstieg des Build-Trichters, nur nicht mehr das, was die
Startseite bewirbt.

Einzelheiten: `docs/product/public-scan-funnel.md`.
| 7 | Modul-Aktivierung und Feature Gating (`subscription.active && module.enabled`) | offen |
| 8 | Frontend Builder: Content Inventory → Mapping → Preview → Approval → Publish | offen |
| 9 | Booking Engine (Datenmodell + Slot-Berechnung) | offen |
| 10 | Chatbot an die Booking Engine (Bot erfindet keine Termine) | offen |
| 11 | Voice an dieselbe Engine (keine zweite Terminlogik) | offen |
| 12 | Bots und Websites als Assets in der Governance Runtime | offen |
| 13 | Multi-Company | offen |
| 14 | Testing | laufend |

**Reihenfolge-Regel aus `CLAUDE.md` §14**: Der Publish Gate muss **vor** dem
ersten SiteOS-Publish-Pfad stehen. Phase 8 darf nicht vor dem Gate ausgeliefert
werden.

---

## 7. Regeln, die beim Weiterbauen gelten

- Bestehende Backend-Funktionen werden **integriert, nicht ersetzt** (§23).
- Keine Preise ausserhalb von `shared/pricing.ts`; danach `npm run sync:pricing`.
- Kein Zugriff über Plan-Namen — nur `hasPermission()`, `hasModule()`, `limitOf()`.
- Der Produktpfad ist **keine Berechtigung**. Er sagt, was der Kunde vorhat,
  nicht, was er darf.
- Bots fragen die Booking Engine. Sie erfinden keine Termine und halten keine
  eigene Terminlogik.
- Migrationen additiv, RLS aktiviert, Mandantentrennung geprüft.
- Design-Freeze: hinzufügen frei, ändern nur nach Rückfrage, Design gar nicht.

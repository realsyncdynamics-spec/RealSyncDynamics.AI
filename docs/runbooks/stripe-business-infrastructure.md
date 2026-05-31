# Stripe Business Infrastructure — Operator-Runbook

Vollständige Einrichtung des Stripe-Accounts (`support@realsyncdynamicsai.de`)
als **produktionsfähige B2B-SaaS-Billing- und Finance-Infrastruktur** für
RealSyncDynamics.AI — nicht nur Checkout, sondern der gesamte Lebenszyklus:

> **Kauf → Zahlung → Rechnung → Steuer → Buchhaltung → Reporting → Abo-Verwaltung → Nachweis**

Dieses Runbook ist **reine Operator-Doku (kein App-Code)**. Es wird im
Stripe-Dashboard ausgeführt. Secrets werden nie in dieses Repo committet.

## Annahmen & Entscheidungs-Branches

Zwei Fakten verzweigen den Aufbau:

| Entscheidung | Branch A (Default-Annahme) | Branch B |
|---|---|---|
| **Steuerstatus** | Regelbesteuerung mit USt-IdNr. → Stripe Tax aktiv | Kleinunternehmer §19 UStG → **keine USt.**, Stripe Tax aus, Rechnung mit §19-Hinweis |
| **Zielkunden** | B2B EU + international → Reverse-Charge + OSS relevant | rein national B2C → nur DE-USt. |

Dieses Runbook ist auf **Branch A (Regelbesteuerung, B2B-SaaS, EU + international)**
geschrieben; abweichende Schritte für Branch B sind markiert.

---

## 1. Business-Profil

**Pfad:** Einstellungen → *Unternehmen* → *Unternehmensdetails*

- [ ] **Rechtsform & registrierter Name** exakt wie im Handelsregister
- [ ] **Öffentlicher Unternehmensname** (Checkout/Rechnung/Kartenabrechnung): „RealSyncDynamics.AI"
- [ ] **Geschäftsadresse** (eingetragener Sitz)
- [ ] **USt-IdNr. / Steuernummer** hinterlegt  · *(Branch B: nur Steuernummer)*
- [ ] **Support:** support@realsyncdynamicsai.de, Telefon, Support-URL, Impressum-Link
- [ ] **Statement Descriptor** (z. B. `RSDYNAMICS.AI`) — gegen „Was ist diese Abbuchung?"-Disputes
- [ ] **AVV/DPA mit Stripe** geprüft & im Prüfpfad / Auftragsverarbeiter-Verzeichnis abgelegt (DSGVO)

## 2. Branding (Dashboard-only)

**Pfad:** Einstellungen → *Branding*

- [ ] **Logo** + **Icon** hochgeladen
- [ ] **Akzentfarbe** = Security-Blue `#0052FF`; Grund Obsidian `#0A0A0B` / Titanium `#E2E2E2`
- [ ] Wirkung verifiziert auf Checkout, Customer Portal, Rechnungs-PDF, E-Mail-Beleg

## 3. Bankkonto & Auszahlungen

**Pfad:** Einstellungen → *Bankkonten und Währung* / *Payouts*

- [ ] **EUR-Geschäftskonto** (EU-IBAN) als Auszahlungsziel
- [ ] **Payout-Schedule** wöchentlich oder monatlich, fixer Tag (erleichtert Kontoabstimmung)
- [ ] **Auszahlungswährung** EUR

## 4. Zahlungsmethoden

**Pfad:** Einstellungen → *Zahlungsmethoden*

- [ ] **Karten** (Visa/Mastercard/Amex)
- [ ] **SEPA-Lastschrift** (DACH-B2B-Standard, niedrige Gebühr; Mandat + längeres Settlement beachten)
- [ ] **Apple Pay / Google Pay** (Conversion, kostenlos)
- [ ] **Dynamische Zahlungsmethoden** aktiv (Stripe blendet pro Land passende ein)
- [ ] **SCA / 3D Secure** aktiv (EU-Pflicht; via Payment Intents automatisch)

## 5. Steuer — Stripe Tax

**Pfad:** Einstellungen → *Tax*

> **Branch B (Kleinunternehmer §19):** Diesen Abschnitt überspringen. Stripe Tax
> **nicht** aktivieren; Rechnungen ohne USt-Ausweis, Pflichthinweis
> „Gemäß §19 UStG wird keine Umsatzsteuer berechnet." in der Fußzeile (Schritt 6).

- [ ] **Stripe Tax aktiviert**
- [ ] **Herkunftsadresse** (Unternehmenssitz) gesetzt
- [ ] **Steuerregistrierungen** eingetragen: DE + alle Länder mit Registrierung; für EU-B2C **OSS (One-Stop-Shop)** hinterlegt
- [ ] **Steuerverhalten der Preise** = „exklusiv/netto" (B2B-Standard) — konsistent mit allen `Prices`
- [ ] **USt-IdNr.-Erfassung im Checkout** aktiv → Stripe validiert via VIES, wendet **Reverse-Charge** bei gültiger B2B-USt-IdNr. automatisch an (0 % + Hinweis „Steuerschuldnerschaft des Leistungsempfängers")
- [ ] **Produkt-Steuerkategorie** je Produkt = „Software as a Service / digitale Dienstleistung"

> **Steuerberater-Gate:** *Wo* registriert werden **muss** (Umsatzschwellen,
> OSS-Anmeldung beim BZSt, US-Sales-Tax-Nexus) ist eine steuerliche Entscheidung.
> Stripe **berechnet**, **meldet aber nicht automatisch an**. Registrierungen mit
> dem Steuerberater klären, dann in Stripe eintragen.

## 6. Rechnungen / Invoicing

**Pfad:** Einstellungen → *Rechnungen*

- [ ] **Automatische Rechnungserstellung für Abos** aktiv (PDF + Hosted Invoice Page)
- [ ] **Rechnungsnummern** mit Präfix, **lückenlos fortlaufend** (z. B. `RSD-2026-`) — gesetzliche Pflicht (DE)
- [ ] **§14-UStG-Pflichtangaben** vollständig: Name/Adresse beider Parteien, USt-IdNr./Steuernummer, Datum + Nummer, Leistungsbeschreibung, Netto/Steuersatz/Steuerbetrag, ggf. Reverse-Charge- bzw. §19-Hinweis
- [ ] **Fußzeile** mit Pflichttext, Bankverbindung, Geschäftsführer/HRB
- [ ] **Sprache/Währung** DE/EUR Default, EN für international
- [ ] **Zahlungsziel** (z. B. 14 Tage netto) + automatische Erinnerungen

## 7. Customer Portal — Self-Service-Abo-Verwaltung

**Pfad:** Einstellungen → *Billing* → *Kundenportal*

- [ ] **Tarifwechsel** (Upgrade/Downgrade) + erlaubte Prices
- [ ] **Kündigung** (sofort/Periodenende) + optional Kündigungsgrund (Churn-Insight)
- [ ] **Zahlungsmethode aktualisieren**
- [ ] **Rechnungs-/Zahlungshistorie** + PDF-Download
- [ ] **Rechnungsadresse / USt-IdNr.** pflegbar
- [ ] **Rechtstext-Links** (AGB/Datenschutz) hinterlegt

→ App-seitig erzeugt `supabase/functions/stripe-portal` die Portal-Session.

## 8. Abo-/Billing-Verhalten

**Pfad:** Einstellungen → *Billing* → *Abonnements*

- [ ] **Proration** an (anteilige Verrechnung bei Tarifwechsel)
- [ ] **Trial-Phasen** + Verhalten bei Trial-Ende ohne Zahlungsmethode
- [ ] **Abrechnungszyklus-Anker** (Kaufdatum vs. Monatserster) festgelegt
- [ ] **Steuer-/Prorations-Recalculation** bei Mengenänderung

## 9. Dunning / Revenue Recovery

**Pfad:** Einstellungen → *Billing* → *Revenue Recovery*

- [ ] **Smart Retries** aktiv (ML-optimierte Wiederholungen)
- [ ] **E-Mails** bei fehlgeschlagener Zahlung + ablaufender Karte
- [ ] **Retry-Zeitplan** + Endverhalten (kündigen/pausieren/überfällig) definiert
- [ ] **Hosted-Update-Link** in Dunning-Mails (Selbst-Aktualisierung der Karte)

## 10. Buchhaltung & Revenue Recognition

**Pfad:** Reports → *Revenue Recognition*

- [ ] **Revenue Recognition** aktiv (periodengerechte Ertragsrealisierung, v. a. bei Jahres-Vorauszahlung)
- [ ] **Buchungsperioden** mit Geschäftsjahr abgeglichen
- [ ] **Payout-Reconciliation-Report** genutzt (Auszahlung ↔ enthaltene Transaktionen/Gebühren)
- [ ] **Steuerberater-Export** etabliert (siehe Anhang DATEV)

## 11. Reporting & Kennzahlen

**Pfad:** Reports

- [ ] **Financial Reports / Balance** (Brutto/Netto, Gebühren, Steuern, Auszahlungen)
- [ ] **Billing-Dashboard**: MRR/ARR/Churn, neue/erweiterte/verlorene Abos
- [ ] **Tax Reports** je Periode/Land (USt-Voranmeldung, OSS)
- [ ] optional **Stripe Sigma** für Custom-SQL-Reporting

## 12. Betrugsschutz — Radar

**Pfad:** Einstellungen → *Radar*

- [ ] Radar aktiv; Basis-Regeln (Review bei hohem Score, Block bei mehreren 3DS-Fehlern)
- [ ] 3D Secure für EU-Karten erzwungen (SCA)

## 13. Test → Live Cutover

- [ ] Alles zuerst im **Test-Modus** durchgespielt (Checkout mit `4242 4242 4242 4242`)
- [ ] **Live-only/separat** gepflegt: Business-Profil, Branding, Bankkonto, Tax-Registrierungen
- [ ] **Webhook-Secrets** (Test/Live getrennt) → Supabase Vault `STRIPE_WEBHOOK_SECRET`
- [ ] **KYC abgeschlossen** → Live-Auszahlungen frei

---

## Zusammenspiel mit dem Repo

| Lebenszyklus | Dashboard (dieses Runbook) | Repo |
|---|---|---|
| Produkte/Prices/Webhook | Zahlungsmethoden, Branding | `scripts/stripe-setup.mjs` (idempotent) |
| Checkout | Schritt 4/5/6 | `supabase/functions/stripe-checkout` (resolved via `public.products`) |
| Abo-Verwaltung | Schritt 7 | `supabase/functions/stripe-portal` |
| Webhook-Verarbeitung | Schritt 13 | `supabase/functions/stripe-webhook` |
| Nutzungsabrechnung | Metered Billing | `supabase/functions/stripe-meter-sync` |

Siehe auch: [`stripe-automated-setup.md`](./stripe-automated-setup.md) (Tool für
Produkte/Prices/Webhook) und [`stripe-rebuild-managed-setup.md`](./stripe-rebuild-managed-setup.md).

---

## Anhang — Buchhaltung: Stripe → Steuerberater / DATEV

Ziel: monatlicher, prüfsicherer Übergang von Stripe in die Finanzbuchhaltung.

**Was wo herkommt:**
- **Erlöse + USt + Reverse-Charge:** Stripe *Tax Reports* + Rechnungs-Export (jede Rechnung hat Nummer, Netto, Steuersatz, -betrag).
- **Stripe-Gebühren:** als Aufwand zu buchen — aus *Balance/Financial Report* (Gebühren werden pro Transaktion ausgewiesen).
- **Auszahlungen:** *Payout-Reconciliation-Report* ordnet jede Bank-Auszahlung den enthaltenen Transaktionen **und** Gebühren zu → Brücke Bankkonto ↔ Stripe-Saldo.
- **Periodengerechte Erlöse:** *Revenue Recognition* (bei Jahresabos).

**Übergabe-Optionen (mit Steuerberater abstimmen):**
1. **Manuell/monatlich:** Stripe-Reports als CSV exportieren, Steuerberater mappt nach SKR03/04.
2. **DATEV-Connector:** Drittanbieter (z. B. via Marketplace) synchronisiert Stripe-Belege automatisch in DATEV.
3. **n8n-Automatisierung (EU-lokal, passt zum Stack):** monatlicher Workflow zieht Stripe-Reports per API, normalisiert sie auf das mit dem Steuerberater vereinbarte Schema und legt sie revisionssicher ab (Evidence-Vault) → jeder Lauf wird in `workflow_runs` geloggt (Prüfpfad).

**Wichtig:** Welche Konten/Steuerschlüssel verwendet werden (SKR, Reverse-Charge-
Schlüssel, OSS) ist eine **steuerberatende** Entscheidung — dieses Runbook liefert
die Datenquellen, nicht die Kontierung.

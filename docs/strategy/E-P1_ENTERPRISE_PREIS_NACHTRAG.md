# Nachtrag E-P1: Enterprise-Preis 1.498 €/Monat

Stand: 26.10.2026, nachgeprüft am 28.10.2026 · Code-Basis `main@d08abd6`

**Status: historische Entscheidungsvorlage und Arbeitsauftrag (28.10.2026).** Dieser Nachtrag ändert keine Preise und keine
Produktfunktionen. Er gibt keinen Merge, keinen Deploy und keine Stripe-Änderung frei.

Bezug: `docs/strategy/MASTERPLAN_2026-2027.md`, §5 und §8 (E-P1), seit #2011 auf `main`. Der Nachtrag
steht in einer eigenen Datei und ändert den Masterplan nicht.
Umsetzung: `.claude/commands/wp14-enterprise-price-1498.md` (WP14).

**Aktualisierung 03.11.2026 (`main@ae1019c`):** Die SSoT enthält inzwischen Enterprise `monthlyEur: 1_498`, `purchaseMode: 'checkout'`, `availability: 'self_service'` und `PRICING_TAX_MODE = 'EXEMPT'` (Änderung #2157). Der Listenpreis wird im Code ohne zusätzliche Umsatzsteuerberechnung nach § 19 UStG geführt. Produktiver Checkout und Stripe-Live-Price-Zuordnung sind **nicht verifiziert**. Die ursprüngliche Ist-Tabelle und offenen Entscheidungsfragen dokumentieren den historischen Stand vom 28.10., keine aktuellen technischen Freigaben.

---

## 1. Zielwert

Vorgabe des Owners: **Enterprise 1.498 €/Monat** (im aktuellen Modus `EXEMPT` ohne zusätzliche USt-Berechnung). Laut #1995 per Self-Service-Checkout
buchbar, ohne Testphase, nicht Teil der Beta, ohne öffentlichen Jahrespreis.

## 2. Historischer Ist-Stand (28.10.2026; siehe Aktualisierung oben)

| Quelle | Wert | Beleg |
|---|---|---|
| SSoT auf `main` | `monthlyEur: 1_249`, `priceOnRequest: true`, `purchaseMode: 'inquiry'`, `availability: 'contract'` | `shared/pricing.ts` (Enterprise-Block) |
| Checkout auf `main` | Enterprise gesperrt (`ENTERPRISE_SELF_SERVICE_BLOCKED` → `ENTERPRISE_CONTRACT_ONLY`) | `supabase/functions/stripe-checkout/index.ts` |
| Öffentliche Anzeige auf `main` | „Preis auf Anfrage“ | `index.html` (JSON-LD), `public/llms.txt`, `src/config/seo.ts` |
| Feste Produktentscheidung (Policy) | „1.249 € ist die höchste Stufe und die einzige Quelle“, dazu ein Hinweis nach § 19 UStG | `.github/PR_TRIAGE_POLICY.md` (Stand 27.09.2026), `AGENTS.md` (Absatz zur Triage-Policy) |
| Steuermodus auf `main` (28.10.) | historisch `EU_STANDARD`; seit #2157 im Code `EXEMPT`. `tax_behavior = exclusive` bedeutet im EXEMPT-Modus nicht, dass USt hinzugerechnet wird. | `shared/pricing.ts`, `supabase/functions/_shared/checkout-tax.ts` |
| Umsetzung 1.498 € | nur in offenen PRs: #1995 (SSoT, Checkout, Kontingente, Anzeige), #1999 (restliche Texte, Beta-Abgrenzung) | siehe WP14 |

**Nicht selbst geprüft:** Stripe-Live-Objekte und die Prod-Tabelle `public.products`. Die Angaben dazu
(aktuelle Enterprise-Price `price_1USabS…`, Kandidat `prod_UxG9V9clbqV7qw`, 0 Enterprise-Abos) stammen
aus #1995 bzw. dem Masterplan §5 und werden in WP14 erneut verifiziert.

## 3. Widersprüche, die E-P1 auflöst

1. **Policy und Vorgabe.** Die Triage-Policy schreibt 1.249 € als feste Entscheidung fest, die Vorgabe lautet
   1.498 €. Solange die Policy nicht angepasst ist, verstößt ein Merge von #1995 formal gegen sie.
2. **Anfrage und Self-Service.** Auf `main` ist Enterprise Vertragsware, #1995 macht es selbst buchbar.
3. **Steuerhinweis (aktualisiert am 03.11.).** Die frühere Beschreibung `EU_STANDARD` und „netto zzgl. USt“
   ist durch #2157 für den aktuellen Code überholt: `PRICING_TAX_MODE = 'EXEMPT'`. Preishinweise sollen
   auf § 19 UStG verweisen und keine zusätzliche Umsatzsteuer ankündigen. `tax_behavior = exclusive` an einer
   Stripe-Price-ID allein aktiviert keine Steuerberechnung; die Checkout-Konfiguration ist maßgeblich.
   Ob die Kleinunternehmerregelung steuerrechtlich anwendbar ist, bleibt eine getrennte Prüfung.
   Produktive Landing-, `/pricing`-, Stripe- und Rechnungsstände sind nicht bestätigt.

## 4. Zu bestätigen (Owner)

| Nr. | Frage | Vorschlag laut Vorgabe |
|---|---|---|
| E-P1a | Enterprise-Monatspreis | 1.498 €/Monat; derzeit `EXEMPT` ohne zusätzliche USt (§ 19 UStG) |
| E-P1b | Kaufweg | Self-Service-Checkout plus „Enterprise anfragen“ als Kontaktweg |
| E-P1c | Testphase / Beta | keine Testphase, nicht Teil der Beta |
| E-P1d | Jahrespreis | kein öffentlicher Jahrespreis, kein Jahres-Checkout |
| E-P1e | Stripe-IDs | Owner liefert Live-Price-ID (149800 Cent, EUR, monatlich, `exclusive`) und Product-ID |
| E-P1f | Bestandskunden | Vor dem Merge erneut zählen. Gibt es Verträge zu 1.249 €, gesondert entscheiden. |
| E-P1g | Policy-Text | `.github/PR_TRIAGE_POLICY.md` und `AGENTS.md` nach dem Merge in einem eigenen Docs-PR auf 1.498 € und den geltenden Steuerhinweis angleichen |
| E-P1h | Bot-Kostenbremse bei Self-Service | Seit #2049 hat Enterprise kein Tarifprofil, Werte werden nur ausdrücklich gesetzt. Festlegen, wer die Werte für Minuten und Euro bei einem Self-Service-Kauf setzt und wann. Sonst sind die Bot-Kanäle nach dem Kauf gesperrt. |

## 5. Was daraus folgt

- Bis E-P1 bestätigt ist: Keine Arbeit an #1995/#1999 über Konfliktlösung hinaus. Der Masterplan nennt
  weiterhin keinen Enterprise-Betrag (§5).
- Nach der Bestätigung: WP14 ausführen. Merge, Prod-Migration und Deploy erhalten jeweils ein eigenes GO.
- Entscheidungsdatum und Name werden hier nachgetragen, sobald die Bestätigung vorliegt:
  - Bestätigt am: _offen_
  - Bestätigt durch: _offen_

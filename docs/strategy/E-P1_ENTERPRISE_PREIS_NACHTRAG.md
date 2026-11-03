# Nachtrag E-P1: Enterprise-Preis 1.498 €/Monat netto

Stand: 03.11.2026 · Code-Basis `main@54105e4` · ersetzt die Fassung vom 26./28.10.2026 (#2014)

**Status: Entscheidungsvorlage.** Dieser Nachtrag ändert keine Preise und keine Produktfunktionen.
Er gibt keinen Merge, keinen Deploy, keine Migration und keine Stripe-Änderung frei.

Bezug: `docs/strategy/MASTERPLAN_2026-2027.md` §5/§8 (E-P1). Umsetzung und Abgleich:
`.claude/commands/wp14-enterprise-price-1498.md` (WP14).

---

## 1. Zielwert

**Enterprise 1.498 €/Monat netto**, Self-Service-Checkout, ohne Testphase, nicht Teil der Beta,
kein öffentlicher Jahrespreis, kein Jahres-Checkout. „Enterprise anfragen“ bleibt als Kontaktweg.

## 2. Was sich seit der Fassung vom 28.10. geändert hat

| PR | Ergebnis | Folge für E-P1 |
|---|---|---|
| #1999 | **Gemergt am 29.10.2026.** Enthält die Umsetzung von 1.498 € inkl. Live-Price | Der Preis steht auf `main`. Die alte Annahme „nur in offenen PRs“ gilt nicht mehr. |
| #1995 | **Geschlossen ohne Merge am 01.11.2026** | Kein Arbeitsbranch mehr. Inhalte sind über #1999 auf `main` gelangt. |
| #2128 | **Offen (Draft), Freigabe Owner 02.11.2026:** Steuermodus `EXEMPT` (§ 19 UStG), „netto“ und „zzgl. USt“ entfernen | Steht im Widerspruch zum Wort „netto“ im Zielwert, siehe §4. |

## 3. Ist-Stand (belegt im Code, `main@54105e4`)

| Ebene | Wert | Beleg |
|---|---|---|
| SSoT | `monthlyEur: 1_498`, `purchaseMode: 'checkout'`, `availability: 'self_service'`, `yearlyCheckoutUnavailable: true`, `netPriceLabel: true`, kein `priceOnRequest` | `shared/pricing.ts` (Enterprise-Block) |
| Checkout-Schalter | `ENTERPRISE_CHECKOUT_PRICE_WIRED = true`; gesperrt ist nur noch `enterprise_yearly` | `shared/pricing.ts`, `supabase/functions/stripe-checkout/index.ts` |
| Stripe-Erwartung | `taxBehavior: 'exclusive'`, `productId.live: 'prod_UxG9V9clbqV7qw'` | `supabase/functions/stripe-checkout/price-match.ts` |
| Katalog-Migrationen | `20261029150000` (Katalog 1.498), `…150100` (Kontingente), `…150200` (Spiegel), `…150300` (Live-Price `price_1UVxUrREjTWueUcGuSjqctMH`) | `supabase/migrations/` |
| Steuermodus | `PRICING_TAX_MODE = 'EU_STANDARD'` | `shared/pricing.ts` |
| Öffentliche Anzeige | 1.498 €/Monat netto in JSON-LD, `llms.txt`, `seo.ts` | `index.html`, `public/llms.txt`, `src/config/seo.ts` |

**Live gelesen am 03.11.2026** (nur `GET`): `https://realsyncdynamicsai.de/llms.txt` und JSON-LD der
Startseite zeigen Enterprise mit 1.498 €.

**Nicht selbst geprüft:** Stripe-Live-Objekte, ob die vier Migrationen auf Prod angewendet sind,
die Prod-Tabellen `products`/`product_entitlements`/`subscriptions` und ob eine Enterprise-Checkout-Session
tatsächlich erzeugt wird. Die Angabe „Price live verifiziert 2026-10-29“ stammt aus Code-Kommentaren
und dem Commit von #1999.

## 4. Offene Widersprüche

1. **Steuer: „netto“ gegen § 19 UStG.** `main` rechnet mit `EU_STANDARD`, die Stripe-Price ist
   `exclusive`. #2128 stellt auf `EXEMPT` um und entfernt „netto“. Ohne `automatic_tax` zahlt der Kunde dann
   1.498 € ohne USt-Ausweis. Der Betrag bleibt gleich, die Bezeichnung „netto“ entfällt. Die steuerliche
   Einordnung ist eine Owner- bzw. Beraterfrage. Erst danach steht fest, ob der Zielwert „1.498 € netto“
   oder „1.498 € (keine USt nach § 19 UStG)“ heißt.
2. **Triage-Policy veraltet.** `.github/PR_TRIAGE_POLICY.md` (Z. 69, Stand 29.10.) sagt „Enterprise
   öffentlich ‚Auf Anfrage‘, bis eine echte Live-Stripe-Price-/Product-ID existiert“. Laut Code existieren
   beide IDs, die Anzeige nennt 1.498 €.
3. **Self-Service und Anfrage gleichzeitig.** `src/config/seo.ts:543` sagt „Buchung derzeit auf Anfrage über
   den Vertrieb“, die SSoT sagt `self_service`. `ctaLabel` lautet „Enterprise anfragen“.
4. **Bot-Kostenbremse.** Enterprise hat bewusst kein Tarifprofil (`20261028100000`, `20261030130000`).
   Ein Self-Service-Kauf erzeugt einen Alarm in `bot_usage_plan_alerts` und keine nutzbaren Werte, bis
   jemand sie setzt. Ohne festgelegten Schritt bleiben die Bot-Kanäle eines Käufers gesperrt.
5. **Veraltete Dokumente.** Masterplan §5/§8 (1.249 €), `docs/claude/BETA_V5_WORKPLAN.md` Z. 81 (1.249 €),
   Kommentar in `.github/workflows/ci.yml` Z. 79 (1.249 €).

## 5. Zu bestätigen (Owner)

| Nr. | Frage | Vorschlag |
|---|---|---|
| E-P1a | Enterprise-Monatspreis | 1.498 € (Betrag unverändert) |
| E-P1b | Kaufweg | Self-Service-Checkout, „Enterprise anfragen“ als zusätzlicher Kontaktweg |
| E-P1c | Testphase / Beta | keine Testphase, nicht Teil der Beta (so auf `main`) |
| E-P1d | Jahrespreis | kein öffentlicher Jahrespreis, kein Jahres-Checkout (so auf `main`) |
| E-P1e | Stripe-IDs | `price_1UVxUrREjTWueUcGuSjqctMH` / `prod_UxG9V9clbqV7qw` lesend gegenprüfen (149800, EUR, Monat, `exclusive`, aktiv) |
| E-P1f | Bestandskunden | Enterprise-Abos zum alten Preis lesend zählen. Falls vorhanden, gesondert entscheiden. |
| E-P1g | Policy-Text | `.github/PR_TRIAGE_POLICY.md` Z. 69 und die Dokumente aus §4.5 in einem eigenen Docs-PR angleichen |
| E-P1h | Bot-Kostenbremse | Festlegen, wer Minuten- und Euro-Werte bei einem Self-Service-Kauf setzt und bis wann |
| **E-P1i** | **Steuerbezeichnung** | **Vor allem anderen entscheiden:** `EU_STANDARD` („netto zzgl. USt“) oder `EXEMPT` (#2128). Davon hängt jeder Anzeigetext ab. |

## 6. Was daraus folgt

- WP14 ist kein Umsetzungsauftrag mehr, sondern ein **Nachabgleich** des gemergten Stands (siehe WP14).
- Bis E-P1i entschieden ist, wird kein Anzeigetext mit „netto“ geändert oder neu eingeführt.
- Merge, Prod-Migration, Deploy und Stripe-Änderungen erhalten jeweils ein eigenes GO.
- Bestätigung:
  - Bestätigt am: _offen_
  - Bestätigt durch: _offen_

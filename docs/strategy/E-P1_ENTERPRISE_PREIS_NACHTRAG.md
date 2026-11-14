# Nachtrag E-P1: Enterprise-Preis 1.498 €/Monat

Stand: 14.11.2026 · Code-Basis `main@fce3719` · ersetzt die Fassung vom 26./28.10.2026 (#2014)

**Status: Entscheidungsvorlage.** Dieser Nachtrag ändert keine Preise und keine Produktfunktionen.
Er gibt keinen Merge, keinen Deploy, keine Migration und keine Stripe-Änderung frei.

Bezug: `docs/strategy/MASTERPLAN_2026-2027.md` §5/§8 (E-P1). Abgleich:
`.claude/commands/wp14-enterprise-price-1498.md` (WP14).

---

## 1. Zielwert

**Enterprise 1.498 €/Monat**, Self-Service-Checkout, ohne Testphase, nicht Teil der Beta,
kein öffentlicher Jahrespreis, kein Jahres-Checkout. „Enterprise anfragen“ bleibt als Kontaktweg.
Der Steuerzusatz richtet sich nach `PRICING_TAX_MODE` (seit #2157: § 19 UStG, siehe §4).

## 2. Was sich seit der Fassung vom 28.10. geändert hat

| PR | Ergebnis | Folge für E-P1 |
|---|---|---|
| #1999 | **Gemergt am 29.10.2026**, Umsetzung von 1.498 € inkl. Live-Price | Der Preis steht auf `main`. |
| #1995 | **Geschlossen ohne Merge am 01.11.2026** | Kein Arbeitsbranch mehr. |
| #2157 | **Gemergt am 03.11.2026** (Owner-Freigabe, Produktionsdeploy laut Commit): `PRICING_TAX_MODE = 'EXEMPT'`, Hinweis „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“, Enterprise `netPriceLabel: false` | Der Steuerstatus ist im Code entschieden. „Netto“ entfällt. |
| #2128 | Geschlossen ohne Merge am 08.11.2026 | Inhalt über #2157 erledigt. |

## 3. Ist-Stand (belegt im Code, `main@fce3719`)

| Ebene | Wert | Beleg |
|---|---|---|
| SSoT | `monthlyEur: 1_498`, `purchaseMode: 'checkout'`, `availability: 'self_service'`, `trialDays: 0`, `yearlyCheckoutUnavailable: true`, `netPriceLabel: false`, kein `priceOnRequest` | `shared/pricing.ts` (Enterprise-Block) |
| Checkout-Schalter | `ENTERPRISE_CHECKOUT_PRICE_WIRED = true`; gesperrt ist nur `enterprise_yearly` | `shared/pricing.ts`, `supabase/functions/stripe-checkout/index.ts` |
| Stripe-Erwartung | `taxBehavior: 'exclusive'`, `productId: { live: 'prod_UxG9V9clbqV7qw', test: null }` | `supabase/functions/stripe-checkout/price-match.ts` |
| Katalog-Migrationen | `20261029150000` (Katalog), `…150100` (Kontingente), `…150200` (Spiegel), `…150300` (Live-Price `price_1UVxUrREjTWueUcGuSjqctMH`) | `supabase/migrations/` |
| Steuermodus | `PRICING_TAX_MODE = 'EXEMPT'`; Checkout ohne `automatic_tax` | `shared/pricing.ts`, `supabase/functions/_shared/checkout-tax.ts` |
| Öffentliche Anzeige (Repo) | „1.498 €/Monat“ mit § 19-Hinweis | `public/llms.txt`, `src/config/seo.ts`, `index.html` |

**Live gelesen am 14.11.2026** (nur `GET`):
- `https://realsyncdynamics-ai.pages.dev/llms.txt`: „Enterprise: 1.498 €/Monat“ und der § 19-Hinweis.
- `https://realsyncdynamicsai.de/` und `/llms.txt` liefern eine andere HTML-Seite ohne Preisangabe,
  `/pricing` leitet auf `realsyncdynamics-ai.pages.dev/pricing` weiter. Was auf der Hauptdomain
  ausgeliefert wird, ist außerhalb dieses Nachtrags zu klären.

**Nicht selbst geprüft:** Stripe-Live-Objekte, ob die vier Migrationen auf Prod angewendet sind,
die Prod-Tabellen `products`/`product_entitlements`/`subscriptions`, ob eine Enterprise-Checkout-Session
tatsächlich erzeugt wird.

## 4. Offene Widersprüche

1. **Stripe-Price `exclusive` unter § 19.** Die Live-Price ist `tax_behavior = exclusive`. Ohne
   `automatic_tax` hat das laut #2128/#2157 keine Wirkung; der Kunde zahlt 1.498 € ohne USt-Ausweis.
   Abos, die noch unter `EU_STANDARD` angelegt wurden, behalten ihr `automatic_tax`. Bestand lesend prüfen.
2. **Triage-Policy veraltet, jetzt doppelt.** `.github/PR_TRIAGE_POLICY.md` Z. 69 sagt „regelbesteuert,
   netto zzgl. 19 % USt“, „Enterprise öffentlich ‚Auf Anfrage‘“ und „der frühere §-19-Hinweis gilt nicht
   mehr“. Alle drei Aussagen widersprechen dem Code.
3. **Self-Service und Anfrage gleichzeitig.** `src/config/seo.ts:543` sagt „Buchung derzeit auf Anfrage über
   den Vertrieb“, die SSoT sagt `self_service`. `ctaLabel` lautet „Enterprise anfragen“.
4. **Testmodus ohne Produkt.** `productId.test` ist `null`. Ob ein Enterprise-Checkout im Stripe-Testmodus
   damit überhaupt möglich ist oder bewusst mit `PRODUCT_NOT_CONFIGURED` abbricht, ist offen. Davon hängt
   ab, wie eine Checkout-Session ohne Abschluss nach einem Deploy geprüft werden kann.
5. **Bot-Kostenbremse.** Enterprise hat bewusst kein Tarifprofil (`20261028100000`, `20261030130000`).
   Ein Self-Service-Kauf erzeugt einen Alarm in `bot_usage_plan_alerts` und keine nutzbaren Werte, bis
   jemand sie setzt.
6. **Veraltete Dokumente.** Masterplan §5/§8 (1.249 €), `docs/claude/BETA_V5_WORKPLAN.md` Z. 81 (1.249 €),
   Kommentar in `.github/workflows/ci.yml` Z. 79 (1.249 €).

## 5. Zu bestätigen (Owner)

| Nr. | Frage | Stand / Vorschlag |
|---|---|---|
| E-P1a | Monatspreis | 1.498 € (umgesetzt mit #1999) |
| E-P1b | Kaufweg | Self-Service-Checkout plus „Enterprise anfragen“ als Kontaktweg; Texte nach §4.3 angleichen |
| E-P1c | Testphase / Beta | keine Testphase, nicht Teil der Beta (umgesetzt) |
| E-P1d | Jahrespreis | kein öffentlicher Jahrespreis, kein Jahres-Checkout (umgesetzt) |
| E-P1e | Stripe-IDs | `price_1UVxUrREjTWueUcGuSjqctMH` / `prod_UxG9V9clbqV7qw` lesend gegenprüfen; Testmodus-Produkt nach §4.4 klären |
| E-P1f | Bestandskunden | Enterprise-Abos und Abos mit `automatic_tax` lesend zählen; bei Treffern gesondert entscheiden |
| E-P1g | Policy-Text | `.github/PR_TRIAGE_POLICY.md` Z. 69 und die Dokumente aus §4.6 in einem eigenen Docs-PR angleichen |
| E-P1h | Bot-Kostenbremse | Festlegen, wer Minuten- und Euro-Werte bei einem Self-Service-Kauf setzt und bis wann |
| E-P1i | Steuerstatus | **Im Code entschieden durch #2157 (§ 19 UStG).** Hier nur noch formal bestätigen. |

## 6. Was daraus folgt

- WP14 ist kein Umsetzungsauftrag, sondern ein **Nachabgleich** des gemergten Stands.
- Kein Text führt „netto“ oder „zzgl. USt“ für Enterprise wieder ein, solange `PRICING_TAX_MODE = 'EXEMPT'` gilt.
- Merge, Prod-Migration, Deploy und Stripe-Änderungen erhalten jeweils ein eigenes GO.
- Bestätigung:
  - Bestätigt am: _offen_
  - Bestätigt durch: _offen_

# Nachtrag E-P1: Enterprise-Preis 1.498 €/Monat

Stand: 03.11.2026 · Code-Basis `main@54105e4` · ersetzt die Fassung aus #2014 (26./28.10.)

**Status: Entscheidungsvorlage.** Dieser Nachtrag ändert keine Preise, Steuermodi oder
Produktfunktionen. Er gibt keinen Merge, keinen Deploy und keine Stripe-Änderung frei.
Abgleich: `.claude/commands/wp14-enterprise-price-1498.md` (WP14).
Bezug: `docs/strategy/MASTERPLAN_2026-2027.md` §5/§8 (dort noch Stand vor #1999).

## 1. Zielwert

Vorgabe des Owners: **Enterprise 1.498 €/Monat netto**, Self-Service-Checkout, ohne Testphase,
nicht Teil der Beta, ohne öffentlichen Jahrespreis.

## 2. Ist-Stand (belegt)

| Quelle | Wert | Beleg |
|---|---|---|
| SSoT | `monthlyEur: 1_498`, `purchaseMode: 'checkout'`, `availability: 'self_service'`, `trialDays: 0`, `yearlyCheckoutUnavailable: true`, `netPriceLabel: true` | `shared/pricing.ts` |
| Checkout | Monatsplan freigeschaltet (`ENTERPRISE_CHECKOUT_PRICE_WIRED = true`), Jahresplan gesperrt | `shared/pricing.ts`, `supabase/functions/stripe-checkout/index.ts` |
| Stripe-Erwartung | Live-Produkt `prod_UxG9V9clbqV7qw`, `tax_behavior` exclusive; Code-Kommentar „Live verifiziert 2026-10-29 (Dominik Go #1999)“ | `supabase/functions/stripe-checkout/price-match.ts` |
| Katalog | Migration setzt `price_1UVxUrREjTWueUcGuSjqctMH` in place | `supabase/migrations/20261029150300_enterprise_live_price_1498.sql` |
| Umsetzung | #1999 gemergt am 29.10. (`70b0329`); #1995 am 01.11. ohne Merge geschlossen | GitHub, `git log` |
| Live-Anzeige | „1.498 €/Monat netto“ | `https://realsyncdynamicsai.de/llms.txt`, abgerufen 03.11. |
| Steuermodus `main` | `PRICING_TAX_MODE = 'EU_STANDARD'` | `shared/pricing.ts` |
| Steuermodus offen | #2128 (Draft): `EXEMPT` nach § 19 UStG, „netto“ entfällt; Freigabe laut PR-Text 02.11. | #2128 |
| Policy | „Enterprise öffentlich ‚Auf Anfrage‘, bis eine echte Live-Stripe-Price-/Product-ID existiert“; „seit 15.10. regelbesteuert“ | `.github/PR_TRIAGE_POLICY.md` Z. 69 |

**Nicht selbst geprüft:** Stripe-Live-Objekte, Prod-Tabelle `public.products`, angewendete
Prod-Migrationen, Edge-Deploy-Stand von `stripe-checkout`, Anzahl Enterprise-Abos. Das prüft
WP14 lesend.

## 3. Offene Widersprüche

1. **Steuerstatus (neu, vorrangig).** Ziel, SSoT, Stripe-Price und Live-Anzeige sagen „netto“
   bzw. `exclusive`. #2128 stellt auf § 19 UStG um: kein USt-Ausweis, kein „netto“. Beides
   gleichzeitig ist nicht zulässig. Der Betrag 1.498 € ist davon unberührt, die Bedeutung aber
   nicht: Unter § 19 ist 1.498 € der Endpreis.
2. **Policy-Text.** `PR_TRIAGE_POLICY.md` nennt Enterprise noch „Auf Anfrage“; die Bedingung dafür
   (Live-IDs) ist laut Code erfüllt. Zusätzlich hängt der Satz „regelbesteuert“ an Punkt 1.
3. **Kaufweg in Texten.** `/contact-sales` sagt „Buchung derzeit auf Anfrage über den Vertrieb“,
   der Checkout ist aber freigeschaltet. `ctaLabel` lautet „Enterprise anfragen“.
4. **Bot-Kostenbremse.** Enterprise hat bewusst kein Tarifprofil. Seit `20261030130000` gibt es
   statt stiller Sperre einen Alarm zur manuellen Konfiguration. Wer konfiguriert und bis wann,
   ist nicht festgelegt.
5. **Alte Beträge in Doku.** 1.249 € in `docs/claude/BETA_V5_WORKPLAN.md`, `ci.yml`-Kommentar und
   Masterplan §5/§8.

## 4. Zu bestätigen (Owner)

| Nr. | Frage | Stand / Vorschlag |
|---|---|---|
| E-P1a | Monatspreis 1.498 € | umgesetzt (#1999); formale Bestätigung hier eintragen |
| E-P1b | Kaufweg | Self-Service-Checkout plus Kontaktweg; Texte nach Punkt 3 angleichen |
| E-P1c | Testphase / Beta | keine Testphase, nicht Beta (umgesetzt) |
| E-P1d | Jahrespreis | kein öffentlicher Jahrespreis, kein Jahres-Checkout (umgesetzt) |
| E-P1e | Stripe-IDs | laut Code geliefert; WP14 verifiziert lesend |
| E-P1f | Bestandskunden zu 1.249 € | Anzahl lesend ermitteln; bei Treffern gesondert entscheiden |
| E-P1g | Policy-Text | eigener Docs-PR nach E-P1i |
| E-P1h | Bot-Kostenbremse bei Self-Service | Zuständigkeit und Frist für die manuelle Konfiguration festlegen |
| **E-P1i** | **Steuerstatus der Anzeige** | Entweder Regelbesteuerung („1.498 €/Monat netto zzgl. USt“, #2128 nicht mergen) oder § 19 UStG („1.498 €/Monat“, Hinweis § 19, #2128 nach Prüfung). Steuerliche Einordnung durch Owner/Berater. |

## 5. Was daraus folgt

- WP14 ist ein Nachabgleich, keine Neuumsetzung. Bis E-P1i entschieden ist, werden keine Texte
  mit Steuerzusatz geändert.
- Jede Korrektur ist ein eigener kleiner PR mit eigenem GO. Merge und Deploy bleiben getrennt.
- Bestätigung:
  - Bestätigt am: _offen_
  - Bestätigt durch: _offen_

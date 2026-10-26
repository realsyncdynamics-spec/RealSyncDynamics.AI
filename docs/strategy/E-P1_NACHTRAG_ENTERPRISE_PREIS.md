# E-P1 Nachtrag: Enterprise-Preis 1.498 €/Monat netto

Stand: 26.10.2026 · Code-Basis `main@5c3e718` · Bezug: Owner-Entscheidung **E-P1** im Masterplan
(`docs/strategy/MASTERPLAN_2026-2027.md` §5 und §8, offener PR #2011).

Status: **Arbeitsauftrag und Entscheidungsvorlage.** Dieses Dokument ändert keinen Preis, keine
Produktfunktion, keine Stripe-Konfiguration und keine Policy. Umsetzung: WP14
(`.claude/commands/wp14-enterprise-price-alignment.md`).

---

## 1. Zielvorgabe

Enterprise kostet **1.498 €/Monat netto** (zzgl. gesetzlicher Umsatzsteuer, B2B). Dieser Betrag soll in
SSoT, Stripe, Checkout, Entitlements und jeder öffentlichen Anzeige übereinstimmen.

## 2. Ist-Stand je Schicht (belegt)

| Schicht | Wert | Beleg |
|---|---|---|
| SSoT | 1.249 €/Monat, `priceOnRequest: true`, `purchaseMode: 'inquiry'`, `availability: 'contract'` | `shared/pricing.ts` (Enterprise-Eintrag) |
| Stripe (Repo-Mapping) | `price_1USabS…`, kommentiert „1.249 € / Monat (nur Vertrag, kein Self-Service)“ | `supabase/migrations/20261020130000_stripe_live_net_exclusive_price_ids.sql` |
| Stripe (Produktion) | Produkt „Enterprise (inquiry · no self-service checkout)“ | read-only-Abgleich laut #2011 §5 |
| Checkout | gesperrt: `ENTERPRISE_SELF_SERVICE_BLOCKED` → `ENTERPRISE_CONTRACT_ONLY` | `supabase/functions/stripe-checkout/index.ts` |
| Entitlements | Enterprise-Kontingente teils `-1` (Vertrag) | `shared/pricing.ts` (`PLAN_ENTITLEMENTS`, Kommentar an `limits.sites`) |
| Öffentliche Anzeige | „Preis auf Anfrage“; JSON-LD ohne `price`; `llms.txt` „Preis auf Anfrage“ | `src/config/seo.ts`, `public/llms.txt`, `src/i18n/handoff.ts` |
| Steuermodus | `PRICING_TAX_MODE = 'EU_STANDARD'` (netto, zzgl. USt) | `shared/pricing.ts` |
| Regelwerk | „Enterprise-Preis: 1.249 € ist die höchste Stufe und die einzige Quelle“, dazu Hinweis nach § 19 UStG | `.github/PR_TRIAGE_POLICY.md` (Abschnitt feste Produktentscheidungen) |

**Vorhandene Umsetzung (nicht gemergt):**

- **#1995** `feat/enterprise-stripe-1498`: SSoT auf 1.498 €, Self-Service-Checkout mit Preisprüfung gegen
  die SSoT, endliche Kontingente (drei additive Migrationen), Runbook und Migrationsvorlage.
  Merge-Konflikt mit `main`. Verifizierte Stripe-Price-ID und Produkt-ID fehlen.
- **#1999** (gestapelt auf #1995, Draft): Anzeige „1.498 €/Monat netto“ auf allen öffentlichen Seiten,
  Beta nur für Starter, Growth und Agency. Merge-Konflikt mit `main`.

Weitere Enterprise-Preisarbeit ist in den offenen PRs nicht sichtbar. #2009 und #2011 nennen den Betrag nur
als offene Entscheidung.

## 3. Was der Owner entscheiden muss

| # | Frage | Optionen | Folge |
|---|---|---|---|
| A | Gilt 1.498 €/Monat netto verbindlich? | ja · nein (bleibt 1.249 €) | bei „nein“ entfällt WP14, #1995/#1999 schließen |
| B | Wie wird Enterprise gekauft? | Self-Service-Checkout (#1995) · weiter nur Vertrag mit festem Listenpreis · beides | bestimmt, ob `ENTERPRISE_CONTRACT_ONLY` fällt |
| C | Stripe-Objekte | neue Live-Price `149800` Cent, EUR, monatlich, `tax_behavior = exclusive`; Produkt-ID bestätigen (Kandidat im Repo: `prod_UxG9V9clbqV7qw`) | IDs liefert der Owner, Agenten legen nichts in Stripe an |
| D | Kontingente | endlich wie in #1995 (u. a. KI-Kosten 250 €/Monat) · `-1` beibehalten | bei „endlich“ drei Migrationen mit separatem GO |
| E | Bestandskunden | laut #1995 live 0 Enterprise-Abos; vor Umsetzung erneut prüfen | bei Bestand: Preisänderung nur für neue Sessions |
| F | Triage-Policy | Zeile „1.249 €“ auf 1.498 € netto ändern; veralteten Hinweis zu § 19 UStG entfernen | eigener Docs-PR durch den Owner, sonst widersprechen sich Policy und SSoT |

Jahrespreis bleibt außen vor: `yearlyCheckoutUnavailable` gilt weiter, 14.980 € ist nur ein interner Listenwert.

## 4. Auffälligkeiten (Prüfbefunde, nicht Teil von WP14)

- **Steuerhinweis:** `src/i18n/handoff.ts` (`pricingFoot` DE/EN) und die Triage-Policy nennen noch
  § 19 UStG, die SSoT steht auf `EU_STANDARD`. #1999 fasst `pricingFoot` an. Ob das die Fundstelle
  vollständig bereinigt, ist beim Abschluss von #1999 zu prüfen.
- **AGENTS.md** verweist auf „Enterprise 1.249 € als höchste Stufe“ in der Policy. Das wird mit Entscheid F mit angepasst.

## 5. Reihenfolge nach Entscheid

1. Owner beantwortet A–F (mindestens A, B, C).
2. WP14-Session: #1995 auf `main` bringen, IDs eintragen, CI grün auf dem PR-Head.
3. Separates GO: Migrationen anwenden, Merge #1995.
4. WP14-Session (Fortsetzung): #1999 auf `main` bringen, Anzeige prüfen, Merge mit GO.
5. Owner: Triage-Policy und AGENTS.md angleichen (F).
6. Deploy nur mit separater Freigabe.

## 6. Abnahme E-P1

E-P1 gilt als erledigt, wenn SSoT, Stripe-Price, Checkout-Verhalten, Entitlements, öffentliche Anzeige
und Triage-Policy denselben Betrag und denselben Kaufweg nennen und die CI auf `main` grün ist.

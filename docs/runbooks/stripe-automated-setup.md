# Stripe Setup — automatisiert (idempotentes Cutover-Tool)

Automatisiert die per API machbaren Teile des Stripe-Setups: **Produkte**,
**Prices** und **Webhook-Endpoint**. Dasselbe Tool läuft identisch gegen
TEST und LIVE — Idempotenz über `metadata.plan_key` (Produkt), `lookup_key`
(Price) und `url` (Webhook). Es ersetzt die manuellen Schritte „Produkte
anlegen", „Webhook verdrahten" und „`products`-Tabelle mit echten Price-IDs
befüllen" aus [`stripe-rebuild-managed-setup.md`](./stripe-rebuild-managed-setup.md).

Tool: [`scripts/stripe-setup.mjs`](../../scripts/stripe-setup.mjs)
Tarif-Config (Single Source of Truth): [`scripts/stripe-plans.json`](../../scripts/stripe-plans.json)

## Was automatisiert ist — und was bewusst manuell bleibt

| Schritt | Automatisiert? |
|---|---|
| Produkte + Prices anlegen | ✅ `stripe-setup.mjs` |
| Webhook-Endpoint + Events | ✅ `stripe-setup.mjs` |
| `public.products` mit echten Price-IDs seeden | ✅ `--sql` Ausgabe |
| Account-Erstellung + KYC | ❌ manuell (regulatorisch) |
| Stripe Tax / Steuersätze | ❌ manuell (Steuer-Gate) |
| API-Keys generieren | ❌ Dashboard, bleibt beim Operator |
| Branding (Logo/Farben) | ❌ Dashboard |

## Voraussetzungen

```bash
npm install                       # installiert u. a. das stripe-SDK (devDependency)
```

Secret-Keys werden **nie committet**, sondern via `.env` / Umgebung gesetzt
(getrennt pro Modus, mit Fallback):

```bash
# .env  (gitignored)
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_SECRET_KEY_LIVE=sk_live_...
# Fallback für beide Modi: STRIPE_SECRET_KEY=...

# Webhook-Ziel-URL: explizit oder aus SUPABASE_URL abgeleitet (+ /functions/v1/stripe-webhook)
SUPABASE_URL=https://<project-ref>.supabase.co
```

Das Tool verweigert einen Lauf, wenn Key-Präfix und `--mode` nicht
zusammenpassen (`sk_test_`↔`test`, `sk_live_`↔`live`).

## Flags

```
--mode test|live      Ziel-Modus (default: test)
--dry-run             nichts schreiben, nur anzeigen
--sql                 products-Seed-SQL ausgeben (stdout)
--mapping-md          Mapping-Tabelle als Markdown ausgeben (stdout)
--confirm-live        Pflicht für schreibende LIVE-Läufe (Sicherheits-Gate)
--no-webhook          Webhook-Schritt überspringen
--webhook-url <url>   Webhook-Ziel-URL überschreiben
--plans <pfad>        alternative Plan-Config
```

Log-Spur geht auf **stderr**, `--sql`/`--mapping-md` auf **stdout** — so
lässt sich die Ausgabe sauber in eine Datei pipen.

## Cutover-Flow

```
1. Account + KYC + Tax            → manuell (einmalig)
2. STRIPE_SECRET_KEY_TEST in .env → Operator
3. npm run stripe:setup -- --mode test --dry-run     → prüfen
4. npm run stripe:setup -- --mode test               → TEST anlegen
   ⇒ Webhook-Secret wird ausgegeben → in Supabase als STRIPE_WEBHOOK_SECRET
5. products-Seed übernehmen:
   npm run stripe:setup -- --mode test --sql > /tmp/seed-test.sql
   → im Supabase-SQL-Editor ausführen
6. TEST-Checkout validieren (Karte 4242 4242 4242 4242)
7. STRIPE_SECRET_KEY_LIVE in .env → Operator
8. npm run stripe:setup -- --mode live --dry-run                → prüfen
9. npm run stripe:setup -- --mode live --confirm-live           → LIVE anlegen
   ⇒ Live-Webhook-Secret → Supabase
10. npm run stripe:setup -- --mode live --confirm-live --sql > /tmp/seed-live.sql
    → im Supabase-SQL-Editor ausführen
```

## Beispiel-Ausgaben

Mapping-Tabelle:

```bash
npm run stripe:setup -- --mode test --mapping-md
```

products-Seed-SQL (idempotent, `ON CONFLICT DO NOTHING`):

```bash
npm run stripe:setup -- --mode test --sql
```

## Hinweise zur Idempotenz

- **Produkt** wird über `metadata['plan_key']` gesucht; existiert es, wird es
  wiederverwendet.
- **Price** wird über `lookup_key` aufgelöst. Stripe-Prices sind unveränderlich:
  weicht Betrag/Intervall ab, legt das Tool einen neuen Price an und überträgt
  den `lookup_key` (`transfer_lookup_key`), der alte Price wird archiviert.
- **Webhook** wird über die URL gefunden; fehlende Events werden ergänzt.
  Das Signing-Secret ist nur bei **Neuanlage** abrufbar — bei bestehendem
  Endpoint im Dashboard nachschauen.
- **Sentinel-Pläne** (`free`, `enterprise`) erzeugen keinen Stripe-Call,
  sondern nur eine `products`-Seed-Zeile mit `internal_default_*`, damit
  `stripe-checkout` nicht gegen die Stripe-API läuft.

## Tarife ändern

Nur [`scripts/stripe-plans.json`](../../scripts/stripe-plans.json) editieren
(Beträge in Cent). Ein erneuter Lauf ist sicher wiederholbar. Für
Einmalzahlungen (z. B. Rebuild-Tarife) das Feld `interval` weglassen — der
`lookup_key` wird dann `<plan_key>` statt `<plan_key>_monthly`.

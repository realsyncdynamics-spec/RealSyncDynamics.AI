# Stripe Setup — Rebuild & Managed Tiers (M1 Pilot)

Schritt-für-Schritt-Anleitung für die Aktivierung der DSGVO-Website-as-a-Service-Tarife im Stripe-Dashboard und Verdrahtung in der Plattform-DB.

**Vorbedingung:** Stripe-Account aktiv, EU-Region, AVV mit Stripe unterzeichnet (Standard im Dashboard verfügbar).

## Tarif-Matrix (Soll-Zustand)

| Tarif | plan_key | Preis | Modus | Stripe-Price-ID-Platzhalter |
|---|---|---|---|---|
| Website Audit (one-off) | `website_audit` | 249 € | one_time | `internal_default_website_audit` |
| Website Rebuild Basic | `rebuild_1500` | 1.500 € | one_time | `internal_default_rebuild_1500` |
| Website Rebuild Pro | `rebuild_2500` | 2.500 € | one_time | `internal_default_rebuild_2500` |
| Website Rebuild Premium | `rebuild_4000` | 4.000 € | one_time | `internal_default_rebuild_4000` |
| Website Managed (1 Site) | `managed_99` | 99 €/Monat | recurring | `internal_default_managed_99` |
| Website Managed Pro (3 Sites) | `managed_249` | 249 €/Monat | recurring | `internal_default_managed_249` |

## Schritt 1 — Produkte im Stripe-Dashboard anlegen

Pro Tarif:

1. Stripe-Dashboard → Products → Add product
2. **Name** wie in Tarif-Matrix oben
3. **Description** kurz und klar (z. B. „Quick-Scan + Befund-PDF + 30-Min-Call")
4. **Pricing model**:
   - Audit, Rebuild × 3: `One time`
   - Managed × 2: `Recurring · Monthly`
5. **Currency**: EUR
6. **Tax behavior**: Inclusive (Brutto) — empfohlen für DACH-KMU-Kunden
7. **Save** → Stripe vergibt eine Price-ID im Format `price_1A2B3C…`
8. Notiere die ID pro Tarif für Schritt 3

## Schritt 2 — Webhook-Konfiguration prüfen

Vorhandener Webhook (`stripe-webhook` Edge-Function) reicht — er handelt
`customer.subscription.*` und `checkout.session.completed`. Für one-time
Audits/Rebuilds verarbeitet `checkout.session.completed` den Käufer-Tenant.

Verify im Stripe-Dashboard → Developers → Webhooks:
- Endpoint: `https://<supabase-project>.supabase.co/functions/v1/stripe-webhook`
- Subscribed events:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `checkout.session.completed`

Falls Endpoint fehlt: anlegen, Signing Secret kopieren, in Supabase Vault
unter `STRIPE_WEBHOOK_SECRET` speichern.

## Schritt 3 — Plattform-DB updaten

Nach Erstellung der 6 Produkte in Stripe (echte Price-IDs in der Hand)
folgende SQL im Supabase SQL Editor ausführen:

```sql
-- 1. Entitlement-Keys (idempotent)
INSERT INTO public.entitlements (key, kind, description) VALUES
    ('website.audit_oneoff',      'feature', 'Quick-audit one-off (Audit-Tier)'),
    ('website.rebuild',           'feature', 'Site rebuild project (Rebuild-Tier)'),
    ('website.managed_hosting',   'feature', 'Managed EU hosting (Managed-Tier)'),
    ('website.audit_runs_yearly', 'limit',   'Re-audit runs per year (Managed-Tier)'),
    ('website.managed_sites',     'limit',   'Concurrent managed sites under tenant')
ON CONFLICT (key) DO NOTHING;

-- 2. Produkte mit echten Stripe-Price-IDs (PLACEHOLDERS ERSETZEN!)
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key) VALUES
    ('price_REAL_AUDIT_ID_HIER',     'Website Audit',           'website_audit'),
    ('price_REAL_REBUILD_BASIC_ID',  'Website Rebuild Basic',   'rebuild_1500'),
    ('price_REAL_REBUILD_PRO_ID',    'Website Rebuild Pro',     'rebuild_2500'),
    ('price_REAL_REBUILD_PREMIUM',   'Website Rebuild Premium', 'rebuild_4000'),
    ('price_REAL_MANAGED_99_ID',     'Website Managed',         'managed_99'),
    ('price_REAL_MANAGED_249_ID',    'Website Managed Pro',     'managed_249')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- 3. Plan → Feature/Limit-Matrix
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('website_audit', 'website.audit_oneoff',      1),
    ('rebuild_1500',  'website.rebuild',           1),
    ('rebuild_2500',  'website.rebuild',           1),
    ('rebuild_4000',  'website.rebuild',           1),
    ('managed_99',    'website.managed_hosting',   1),
    ('managed_99',    'website.managed_sites',     1),
    ('managed_99',    'website.audit_runs_yearly', 2),
    ('managed_249',   'website.managed_hosting',   1),
    ('managed_249',   'website.managed_sites',     3),
    ('managed_249',   'website.audit_runs_yearly', 4)
)
INSERT INTO public.product_entitlements (product_id, entitlement_key, value)
SELECT p.id, pd.ent_key, pd.val
FROM plan_def pd
JOIN public.products p ON p.default_for_plan_key = pd.plan_key
WHERE NOT EXISTS (
    SELECT 1 FROM public.product_entitlements pe
    WHERE pe.product_id = p.id AND pe.entitlement_key = pd.ent_key
);
```

## Schritt 4 — Frontend-Checkout prüfen

`stripe-checkout` Edge-Function resolved Plan-Keys über die `products`-Tabelle.
Ein erster Test:

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/stripe-checkout" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{ "plan_key": "managed_99", "success_url": "https://realsyncdynamicsai.de/welcome", "cancel_url": "https://realsyncdynamicsai.de/dsgvo-website" }'
```

Erwartete Response: `{ "url": "https://checkout.stripe.com/pay/cs_..." }`.
Wenn `400 plan_key not found`: Schritt 3 nicht ausgeführt oder Price-ID
falsch — prüfe `select * from public.products where default_for_plan_key = 'managed_99'`.

## Schritt 5 — UI-Verlinkung

Aktuelle UI verlinkt von der Pricing-Preview-Karte „Komplett-Service" auf
`/dsgvo-website`. Diese Page hat ihre eigenen 3-Paket-Cards (Audit / Rebuild /
Managed) — diese müssen `useStripeCheckout(plan_key)`-Hook (oder den
`createCheckoutSession`-Helper) nutzen, um die Stripe-Session zu starten.

Für M1-Pilot reicht es, wenn die Cards weiterhin auf `/contact-sales`
verlinken, bis ein Self-Service-Audit-Flow live ist. Self-Service-Checkout für
Audit-Tier (€249) als Folge-PR sobald die Edge-Function-Wiring steht.

## Schritt 6 — Verifikations-Checkliste

- [ ] 6 Stripe-Produkte angelegt, Price-IDs notiert
- [ ] Webhook-Endpoint subscribed auf 4 Events
- [ ] SQL aus Schritt 3 ausgeführt (ohne `price_REAL_*` Platzhalter!)
- [ ] Smoke-Test-Checkout-Session für `managed_99` returnt 200
- [ ] `select count(*) from public.product_entitlements where entitlement_key like 'website.%';` zeigt **10** Zeilen
- [ ] Erster Test-Checkout auf Stripe-Test-Mode-Karte 4242 4242 4242 4242 erfolgreich

## Folge-Schritte (nicht M1-blockend)

- Variable Pricing für Rebuild (Stripe „Custom Price" pro Session, nicht Festpreis-Tiers)
- Stripe-Coupons für Pilot-Discount (z. B. 30 % auf erste 3 Monate Managed)
- Steuersatz-Konfiguration mit Stripe Tax (eingehende Preise korrekt brutto/netto je nach Käufer-Land)

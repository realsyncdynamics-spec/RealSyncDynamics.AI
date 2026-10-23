-- Live Stripe catalog (acct_1TYVIyREjTWueUcG, livemode) — Netto-Preise.
--
-- Dominik 2026-10-20: umsatzsteuerpflichtig, Preise netto zzgl. USt, Angebot
-- nur für Unternehmer (§ 14 BGB). Die bisherigen UEm*-Preise (Migration
-- 20260913000000) sind tax_behavior=inclusive (brutto). Stripe erlaubt keinen
-- Wechsel von tax_behavior an einem bestehenden Preis; deshalb wurden am
-- 20.10.2026 sechs neue Preise mit tax_behavior=exclusive auf denselben
-- Produkten und mit denselben Beträgen angelegt (metadata.price_semantics =
-- net_exclusive_de). Stripe Tax schlägt die USt auf.
--
-- Umstellung in place: Die products-Zeile behält ihre id und damit alle
-- product_entitlements; nur stripe_price_id wechselt. Keine Stripe-Objekte
-- hier. Idempotent: Eine bereits umgestellte Zeile trifft kein WHERE mehr.
-- Die alten Preise werden in Stripe erst nach dem Deploy archiviert.

-- Starter 79 € / Monat
UPDATE public.products SET stripe_price_id = 'price_1USabFREjTWueUcGDg9wod9W'
 WHERE stripe_price_id = 'price_1UEmHiREjTWueUcGX2cfEi25';

-- Growth 249 € / Monat
UPDATE public.products SET stripe_price_id = 'price_1USabNREjTWueUcGu814PvJc'
 WHERE stripe_price_id = 'price_1UEmHmREjTWueUcGiCQMB8H4';

-- Agency 699 € / Monat
UPDATE public.products SET stripe_price_id = 'price_1USabPREjTWueUcGbaNG5WeB'
 WHERE stripe_price_id = 'price_1UEmHoREjTWueUcGqeO4LGud';

-- Enterprise 1.249 € / Monat (nur Vertrag, kein Self-Service)
UPDATE public.products SET stripe_price_id = 'price_1USabSREjTWueUcGzUEzTaie'
 WHERE stripe_price_id = 'price_1UEmHqREjTWueUcG0oqZkb5O';

-- Partner 1.999 € / Monat (Legacy-Bestand)
UPDATE public.products SET stripe_price_id = 'price_1USabUREjTWueUcGk8ao5bWw'
 WHERE stripe_price_id = 'price_1UEmHsREjTWueUcGFlIItOiz';

-- Governance Launch 349 € einmalig
UPDATE public.products SET stripe_price_id = 'price_1USabjREjTWueUcG45xZUZgM'
 WHERE stripe_price_id = 'price_1UEmHtREjTWueUcGhjY7Gvhp';

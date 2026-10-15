-- VAT-Umstellung (Regelbesteuerung, Entscheidung 2026-10-15): public.products auf
-- NEUE tax-exklusive Stripe-Preise umstellen.
--
-- BEWUSST KEINE MIGRATION (liegt nicht unter supabase/migrations): erst ausführen,
-- wenn die Preise in Stripe LIVE angelegt sind (legal-review/VAT-UMSTELLUNG-STRIPE.md)
-- und die Platzhalter ersetzt sind. Der Guard bricht ab, solange ein Platzhalter drinsteht.
-- Rückweg: alte IDs (Kommentar je Zeile) wieder eintragen.

begin;

do $$
begin
  if 'STRIPE_PRICE_STARTER_MONTHLY_EXCL' not like 'price\_%'
     or 'STRIPE_PRICE_GROWTH_MONTHLY_EXCL' not like 'price\_%'
     or 'STRIPE_PRICE_AGENCY_MONTHLY_EXCL' not like 'price\_%' then
    raise exception 'Platzhalter nicht ersetzt — neue Stripe-Preis-IDs (price_...) eintragen';
  end if;
end $$;

-- alt: price_1UEmHiREjTWueUcGX2cfEi25 → neu 7900 EUR/Monat, tax_behavior=exclusive
update public.products set stripe_price_id = 'STRIPE_PRICE_STARTER_MONTHLY_EXCL'
 where default_for_plan_key = 'starter' and stripe_price_id = 'price_1UEmHiREjTWueUcGX2cfEi25';
-- alt: price_1UEmHmREjTWueUcGiCQMB8H4 → neu 24900
update public.products set stripe_price_id = 'STRIPE_PRICE_GROWTH_MONTHLY_EXCL'
 where default_for_plan_key = 'growth' and stripe_price_id = 'price_1UEmHmREjTWueUcGiCQMB8H4';
-- alt: price_1UEmHoREjTWueUcGqeO4LGud → neu 69900
update public.products set stripe_price_id = 'STRIPE_PRICE_AGENCY_MONTHLY_EXCL'
 where default_for_plan_key = 'agency' and stripe_price_id = 'price_1UEmHoREjTWueUcGqeO4LGud';

-- enterprise / partner / governance_launch: nicht angefasst (offene Fragen, siehe Doku).

select default_for_plan_key, stripe_price_id from public.products
 where default_for_plan_key in ('starter','growth','agency') order by 1;
commit;

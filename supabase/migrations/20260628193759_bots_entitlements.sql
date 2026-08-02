-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02), Option A.
-- 1:1 aus supabase_migrations.schema_migrations, Version 20260628193759.
-- Gehoert zu Bots-Feature B (bot_agents / orders / appointments / …), das
-- ausser in der Prod-History nirgends mehr existierte. Kein Anwendungscode
-- referenziert B. Siehe docs/runtime/PRODUCTION_BLOCKERS.md, Blocker 2.

insert into public.entitlements (key, description, kind)
select v.key, v.description, v.kind
from (values
  ('bots.chat',                      'Chat-Assistent (Termin/Bestellung/FAQ)', 'boolean'),
  ('bots.appointments',              'Terminbuchung per Assistent',            'boolean'),
  ('bots.orders',                    'Bestellannahme per Assistent',           'boolean'),
  ('limit.bot_voice_minutes_monthly','Telefon-Assistent: Minuten/Monat',       'limit')
) as v(key, description, kind)
where not exists (select 1 from public.entitlements e where e.key = v.key);

insert into public.product_entitlements (product_id, entitlement_id, value)
select p.id, e.id, 1
from public.products p
cross join public.entitlements e
where p.default_for_plan_key in ('growth','agency','scale','enterprise')
  and e.key in ('bots.chat','bots.appointments','bots.orders')
  and not exists (
    select 1 from public.product_entitlements pe
    where pe.product_id = p.id and pe.entitlement_id = e.id
  );

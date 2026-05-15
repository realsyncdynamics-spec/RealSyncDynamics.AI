-- Security-Lint Cleanup — Round 2. Addresses the remaining five WARN
-- function_search_path_mutable findings from Supabase's database
-- linter. Follows the convention established by
-- 20260516200000_security_lint_cleanup.sql: pin search_path to ''
-- so the functions cannot be hijacked by a search_path injection
-- from a privileged caller.
--
-- Four of the five functions only touch NEW.* and call pg_catalog
-- builtins (now(), RAISE, coalesce, convert_to). pg_catalog is
-- always implicitly searched first regardless of search_path, so
-- empty is sufficient. fn_inventory_apply_movement already
-- schema-qualifies public.inventory_stock_levels, so it is also
-- safe with an empty search_path.
--
-- tg_evidence_event_chain is the only function that needs body
-- changes: it references the unqualified `ai_evidence_events`
-- table and the pgcrypto `digest()` function (which lives in the
-- `extensions` schema on Supabase). We re-create it with both
-- references qualified, then pin search_path to ''.

ALTER FUNCTION public.handle_updated_at()             SET search_path = '';
ALTER FUNCTION public.fn_inventory_touch_updated_at() SET search_path = '';
ALTER FUNCTION public.fn_tax_touch_updated_at()       SET search_path = '';
ALTER FUNCTION public.fn_inventory_apply_movement()   SET search_path = '';

CREATE OR REPLACE FUNCTION public.tg_evidence_event_chain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
declare
  prev_record record;
  payload bytea;
  tenant_lock_key text;
begin
  if new.event_hash is not null then
    return new;
  end if;

  tenant_lock_key := 'evidence_chain:' || coalesce(new.tenant_id::text, 'global');
  perform pg_advisory_xact_lock(hashtextextended(tenant_lock_key, 0));

  select event_hash, chain_index
  into prev_record
  from public.ai_evidence_events
  where (tenant_id is not distinct from new.tenant_id)
    and event_hash is not null
  order by chain_index desc
  limit 1;

  new.prev_hash := prev_record.event_hash;
  new.chain_index := coalesce(prev_record.chain_index, 0) + 1;

  payload :=
       coalesce(new.prev_hash, ''::bytea)
    || convert_to(new.id::text, 'UTF8')
    || convert_to(coalesce(new.created_at::text, now()::text), 'UTF8')
    || convert_to(new.event_type, 'UTF8')
    || convert_to(new.event_summary, 'UTF8')
    || convert_to(coalesce(new.evidence::text, '{}'), 'UTF8');

  new.event_hash := extensions.digest(payload, 'sha256');

  return new;
end;
$function$;

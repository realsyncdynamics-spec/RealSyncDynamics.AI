-- The Stripe webhook remains the authority for payment and entitlement.
-- This trigger only mirrors a successful Governance Launch grant into the
-- funnel ledger, so payment cannot be counted from a browser success page.
create or replace function public.record_transformation_paid_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  digest text;
  event_uuid uuid;
begin
  if new.source <> 'one_time_purchase'
     or new.plan_key <> 'governance_launch'
     or new.status <> 'active'
     or new.purchase_reference is null then
    return new;
  end if;

  -- Stable UUID derived from the immutable Stripe Checkout Session reference.
  -- This keeps retries/upserts idempotent without treating analytics as billing authority.
  digest := md5('transformation_paid:' || new.purchase_reference);
  event_uuid := (
    substr(digest, 1, 8) || '-' ||
    substr(digest, 9, 4) || '-' ||
    substr(digest, 13, 4) || '-' ||
    substr(digest, 17, 4) || '-' ||
    substr(digest, 21, 12)
  )::uuid;

  insert into public.transformation_events (
    event_id,
    event_name,
    occurred_at,
    tenant_id,
    price_cohort,
    currency,
    amount_cents,
    metadata
  )
  values (
    event_uuid,
    'transformation_paid',
    coalesce(new.updated_at, now()),
    new.tenant_id,
    'reference_349',
    upper(new.currency)::text,
    new.amount_total_cents,
    jsonb_build_object('source', 'entitlement_grant', 'checkout_session', new.purchase_reference)
  )
  on conflict (event_id) do nothing;

  return new;
end;
$$;

drop trigger if exists entitlement_grant_transformation_paid on public.entitlement_grants;
create trigger entitlement_grant_transformation_paid
after insert or update of status, purchase_reference, amount_total_cents, currency, updated_at
on public.entitlement_grants
for each row
execute function public.record_transformation_paid_event();

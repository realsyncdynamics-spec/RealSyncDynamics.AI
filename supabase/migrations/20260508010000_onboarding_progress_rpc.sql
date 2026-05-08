-- Welcome-wizard progress RPC: lets the authenticated user advance their own
-- onboarding row's step / api_key_id / domain_connected without granting a
-- broad UPDATE policy on the table. The original row is created by the
-- stripe-webhook (service_role); this function only mutates the four
-- progress fields and verifies the caller's email matches the row's email.
--
-- Why an RPC over a column-narrowed UPDATE policy:
--   - Postgres RLS can't restrict which columns are updated within a single
--     UPDATE — only what rows. A function-level allow-list is the cleanest
--     way to keep amount_cents / stripe_session_id / email immutable from
--     the client.
--   - SECURITY DEFINER bypasses RLS for the targeted update; the inner
--     email check provides the per-user authorization.

create or replace function public.update_onboarding_progress(
    p_step             int,
    p_api_key_id       uuid default null,
    p_domain_connected text default null
)
returns table (id uuid, step int, completed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_email text;
begin
    -- Resolve the calling user's email from auth.users — auth.uid() returns
    -- the JWT subject (uuid), which we join into auth.users.
    select u.email into v_user_email
    from auth.users u
    where u.id = auth.uid();

    if v_user_email is null then
        raise exception 'unauthenticated' using errcode = '42501';
    end if;

    if p_step < 1 or p_step > 4 then
        raise exception 'step out of range (1..4)' using errcode = '22023';
    end if;

    return query
    update public.customer_onboarding
       set step             = p_step,
           api_key_id       = coalesce(p_api_key_id, api_key_id),
           domain_connected = coalesce(p_domain_connected, domain_connected),
           completed_at     = case when p_step >= 4 then now() else completed_at end
     where email = v_user_email
    returning customer_onboarding.id, customer_onboarding.step, customer_onboarding.completed_at;
end;
$$;

revoke all on function public.update_onboarding_progress(int, uuid, text) from public;
grant execute on function public.update_onboarding_progress(int, uuid, text) to authenticated;

comment on function public.update_onboarding_progress(int, uuid, text) is
    'Allow the authenticated user to advance their own customer_onboarding row''s wizard state. Updates are scoped to (step, api_key_id, domain_connected, completed_at); other columns remain controlled by the stripe-webhook. Returns one row per match (zero rows if no onboarding row exists for the user''s email).';

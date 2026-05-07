-- Customer Onboarding nach Stripe-Checkout (Phase Onboarding-Flow).
--
-- Track-State pro checkout.session.completed: Setup-Wizard-Fortschritt,
-- API-Key-Generation, Snippet-Download.

create table if not exists public.customer_onboarding (
  id                  uuid primary key default gen_random_uuid(),
  stripe_session_id   text not null unique,
  email               text not null,
  product_label       text,
  amount_cents        bigint,
  currency            text default 'EUR',
  mode                text,                          -- payment | subscription
  step                int not null default 1,        -- 1=account, 2=apikey, 3=snippet, 4=done
  api_key_id          uuid,                          -- references api_keys(id) once generated
  domain_connected    text,                          -- domain user entered in wizard
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_customer_onboarding_email
  on public.customer_onboarding(email);
create index if not exists idx_customer_onboarding_session
  on public.customer_onboarding(stripe_session_id);

-- RLS: nur service-role schreibt (Stripe-Webhook), Owner liest via session-id
alter table public.customer_onboarding enable row level security;

drop policy if exists "onboarding_service_all" on public.customer_onboarding;
create policy "onboarding_service_all"
  on public.customer_onboarding for all
  to service_role
  using (true) with check (true);

-- Auth-User mit gleicher Email darf seinen eigenen Onboarding-State lesen
drop policy if exists "onboarding_owner_read" on public.customer_onboarding;
create policy "onboarding_owner_read"
  on public.customer_onboarding for select
  to authenticated
  using (
    email = (select email from auth.users where id = auth.uid())
  );

-- Update-Trigger für updated_at
create or replace function public.customer_onboarding_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists trg_customer_onboarding_updated on public.customer_onboarding;
create trigger trg_customer_onboarding_updated
  before update on public.customer_onboarding
  for each row execute function public.customer_onboarding_set_updated_at();

comment on table public.customer_onboarding is
  'Customer Onboarding nach Stripe-Checkout. step 1=account / 2=apikey / 3=snippet / 4=done. Welcome-Email wird vom stripe-webhook bei checkout.session.completed gesendet.';

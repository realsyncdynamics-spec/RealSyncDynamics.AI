-- Pricing-v2 funnel ledger.
-- Deliberately separate from billing authority: this records product economics,
-- while Stripe/webhook/entitlement tables remain authoritative for access.
create table if not exists public.transformation_events (
  event_id uuid primary key,
  event_name text not null check (event_name in (
    'preview_started',
    'preview_completed',
    'transformation_cta_clicked',
    'checkout_started',
    'transformation_paid',
    'transformation_completed',
    'core_activated',
    'capability_activated',
    'capacity_expanded'
  )),
  occurred_at timestamptz not null,
  anonymous_id text,
  tenant_id uuid,
  project_id uuid,
  transformation_id uuid,
  price_cohort text not null check (price_cohort in ('reference_349', 'launch_249', 'not_applicable')),
  currency text check (currency is null or currency = 'EUR'),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transformation_events_occurred_at_idx
  on public.transformation_events (occurred_at desc);
create index if not exists transformation_events_name_cohort_idx
  on public.transformation_events (event_name, price_cohort);
create index if not exists transformation_events_tenant_idx
  on public.transformation_events (tenant_id, occurred_at desc);

alter table public.transformation_events enable row level security;

-- Writes must go through a trusted server-side path. No direct client INSERT policy.
-- Tenant reads are restricted to their own rows; anonymous funnel rows are not
-- exposed through this table to end users.
create policy "transformation_events_tenant_read"
  on public.transformation_events
  for select
  using (tenant_id is not null and tenant_id = auth.uid());

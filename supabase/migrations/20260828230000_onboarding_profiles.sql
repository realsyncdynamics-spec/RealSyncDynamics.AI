-- Onboarding-Profil je Tenant. Keine Preise in dieser Tabelle.
-- RLS analog bestehender Tenant-Tabellen. Service-Role nur in Edge Functions.

create table if not exists public.onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists onboarding_profiles_tenant_user
  on public.onboarding_profiles (tenant_id, user_id);

alter table public.onboarding_profiles enable row level security;

drop policy if exists onboarding_profiles_tenant_select on public.onboarding_profiles;
create policy onboarding_profiles_tenant_select
  on public.onboarding_profiles
  for select
  using (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'tenant_id', ''));

drop policy if exists onboarding_profiles_tenant_write on public.onboarding_profiles;
create policy onboarding_profiles_tenant_write
  on public.onboarding_profiles
  for all
  using (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'tenant_id', ''))
  with check (tenant_id::text = coalesce(current_setting('request.jwt.claims', true)::json->>'tenant_id', ''));

create table if not exists public.workstore_listings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null,
  title text not null,
  description text not null default '',
  entitlement_keys text[] not null default '{}',
  default_policies text[] not null default '{}',
  install_manifest jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

insert into public.workstore_listings (slug, kind, title, description, entitlement_keys, install_manifest)
values (
  'support-agent',
  'agent',
  'AI Customer Support Agent',
  'Agent + Wissen + Website-Chat + Handoff + Art. 50 + Evidence.',
  array['bots.chat', 'bots.enabled', 'bots.human_handoff'],
  '{"channels":{"web":"test","whatsapp":"off"},"art50":true}'::jsonb
)
on conflict (slug) do nothing;

-- RSD: persönlicher, rollenabhängiger Workspace-Start nach dem bestehenden
-- Audit → Welcome → Activation. Kein zweiter Registrierungs-Assistent.
-- Speicherung ausschließlich pro (Tenant, User), keine fremden Fortschritte.
create table if not exists public.workspace_onboarding_state (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  focus text not null default 'none'
    check (focus in ('none', 'governance', 'voice', 'builder', 'creative', 'landing', 'optimizer')),
  completed_steps text[] not null default array[]::text[]
    check (completed_steps <@ array['profile','team','focus','first-result','review']::text[]),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists idx_workspace_onboarding_state_user
  on public.workspace_onboarding_state(user_id);
alter table public.workspace_onboarding_state enable row level security;

create policy "workspace_onboarding_select_own"
  on public.workspace_onboarding_state for select to authenticated
  using ((select auth.uid()) = user_id and public.is_tenant_member(tenant_id));
create policy "workspace_onboarding_insert_own"
  on public.workspace_onboarding_state for insert to authenticated
  with check ((select auth.uid()) = user_id and public.is_tenant_member(tenant_id));
create policy "workspace_onboarding_update_own"
  on public.workspace_onboarding_state for update to authenticated
  using ((select auth.uid()) = user_id and public.is_tenant_member(tenant_id))
  with check ((select auth.uid()) = user_id and public.is_tenant_member(tenant_id));

revoke all on public.workspace_onboarding_state from anon;
grant select, insert, update on public.workspace_onboarding_state to authenticated;
comment on table public.workspace_onboarding_state is
  'Self-reported onboarding progress per tenant and user. Not a technical release or automated provisioning signal.';

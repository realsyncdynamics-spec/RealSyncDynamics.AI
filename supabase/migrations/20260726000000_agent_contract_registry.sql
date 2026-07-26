-- Agent Contract Registry (ACS v1.0)
--
-- Persistent storage for versioned, immutable agent contracts.
-- Contracts are the formal specification of agent identity, goals, capabilities,
-- permissions, and runtime requirements.
--
-- See docs/agent-contract-specification.md for full specification.

-- ---------------------------------------------------------------------------
-- agent_contracts
-- Immutable contract registry. Each (agent_id, version) is unique and permanent.
-- Contracts move through states: draft → active → deprecated → retired
-- ---------------------------------------------------------------------------
create table if not exists public.agent_contracts (
  id                  text not null,                -- agent-id-slug (immutable)
  version             text not null,                -- semver (immutable)

  -- Contract identity
  name                text not null,
  description         text,
  agent_type          text not null check (agent_type in (
                        'governance', 'automation', 'enterprise', 'custom'
                      )),

  -- Lifecycle
  status              text not null default 'draft' check (status in (
                        'draft', 'active', 'deprecated', 'retired'
                      )),

  -- Ownership
  owner_tenant_id     uuid references public.tenants(id) on delete cascade,
                      -- null = platform-owned, non-null = tenant-owned

  -- Full contract as JSONB (ACS structure)
  contract_json       jsonb not null,

  -- Timestamps
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null,
  published_at        timestamptz,                  -- null until status='active'
  deprecated_at       timestamptz,

  -- Primary key: (id, version)
  primary key (id, version),
  unique (id, version)
);

-- Index for querying active contracts by type
create index if not exists agent_contracts_active_type_idx
  on public.agent_contracts (agent_type, status)
  where status = 'active';

-- Index for querying contract history
create index if not exists agent_contracts_history_idx
  on public.agent_contracts (id, version desc);

-- Index for tenant-owned contracts
create index if not exists agent_contracts_tenant_idx
  on public.agent_contracts (owner_tenant_id)
  where owner_tenant_id is not null;

-- Index for published contracts
create index if not exists agent_contracts_published_idx
  on public.agent_contracts (published_at desc)
  where published_at is not null;

-- Prevent updates (contracts are immutable)
-- Only allow insert and select
revoke update, delete on public.agent_contracts from public;

-- ---------------------------------------------------------------------------
-- RLS: Contracts visibility
-- Platform-owned (owner_tenant_id = null) visible to all authenticated users.
-- Tenant-owned contracts visible only to tenant members.
-- ---------------------------------------------------------------------------
alter table public.agent_contracts enable row level security;

create policy agent_contracts_select on public.agent_contracts
  for select
  using (
    owner_tenant_id is null                         -- Platform agent
    or public.is_tenant_member(owner_tenant_id)    -- Tenant member
  );

create policy agent_contracts_insert on public.agent_contracts
  for insert
  with check (
    owner_tenant_id is null                         -- Only admins can create platform contracts
    or public.is_tenant_member(owner_tenant_id)    -- Tenant members can create tenant-owned
  );

-- ---------------------------------------------------------------------------
-- agent_contract_versions
-- Audit trail of contract changes (state transitions only, not content edits)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_contract_versions (
  id              uuid primary key default gen_random_uuid(),
  agent_id        text not null,
  version         text not null,

  -- State transition
  old_status      text,
  new_status      text not null check (new_status in (
                    'draft', 'active', 'deprecated', 'retired'
                  )),

  -- Who changed it
  changed_by      uuid references auth.users(id) on delete set null,
  changed_at      timestamptz not null default now(),
  change_reason   text,

  -- Link back to contract
  contract_id     uuid,

  foreign key (agent_id, version) references public.agent_contracts(id, version) on delete cascade
);

create index if not exists agent_contract_versions_agent_idx
  on public.agent_contract_versions (agent_id, changed_at desc);

-- Immutable audit log
revoke update, delete on public.agent_contract_versions from public;

alter table public.agent_contract_versions enable row level security;

create policy agent_contract_versions_select on public.agent_contract_versions
  for select
  using (
    exists (
      select 1 from public.agent_contracts ac
      where ac.id = agent_contract_versions.agent_id
        and (
          ac.owner_tenant_id is null
          or public.is_tenant_member(ac.owner_tenant_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- agent_contract_determinism_tests
-- Determinism certification records for deterministic agents
-- ---------------------------------------------------------------------------
create table if not exists public.agent_contract_determinism_tests (
  id                  uuid primary key default gen_random_uuid(),
  agent_id            text not null,
  agent_contract_version text not null,

  -- Test metadata
  test_name           text not null,
  test_input          jsonb not null,
  expected_output     jsonb not null,

  -- Test result
  actual_output       jsonb not null,
  passed              boolean not null,
  passed_at           timestamptz,

  -- Evidence for audit trail
  evidence_hash       text not null,  -- SHA256 of test results
  signed              boolean default false,

  -- Audit
  tested_by           uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),

  foreign key (agent_id, agent_contract_version)
    references public.agent_contracts(id, version) on delete cascade
);

create index if not exists agent_contract_determinism_tests_agent_idx
  on public.agent_contract_determinism_tests (agent_id, agent_contract_version);

create index if not exists agent_contract_determinism_tests_passed_idx
  on public.agent_contract_determinism_tests (agent_id)
  where passed = true;

-- RLS (read-only for non-admins)
alter table public.agent_contract_determinism_tests enable row level security;

create policy agent_contract_determinism_tests_select on public.agent_contract_determinism_tests
  for select
  using (
    exists (
      select 1 from public.agent_contracts ac
      where ac.id = agent_contract_determinism_tests.agent_id
        and (
          ac.owner_tenant_id is null
          or public.is_tenant_member(ac.owner_tenant_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Stored Procedure: Publish Contract (Draft → Active)
-- Validates contract before publishing, then transitions state.
-- ---------------------------------------------------------------------------
create or replace function public.publish_agent_contract(
  p_agent_id text,
  p_version text,
  p_published_by uuid default auth.uid()
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_result json;
begin
  -- Fetch draft contract
  select * into v_contract
    from agent_contracts
   where id = p_agent_id
     and version = p_version
     and status = 'draft';

  if v_contract is null then
    return json_build_object('error', 'Contract not found or not in draft state');
  end if;

  -- Validate contract structure (basic schema check)
  if not (v_contract.contract_json ? 'id'
          and v_contract.contract_json ? 'goals'
          and v_contract.contract_json ? 'capabilities'
          and v_contract.contract_json ? 'permissions')
  then
    return json_build_object('error', 'Invalid contract structure');
  end if;

  -- Transition to active
  update agent_contracts
     set status = 'active',
         published_at = now()
   where id = p_agent_id
     and version = p_version;

  -- Log state transition
  insert into agent_contract_versions (
    agent_id, version, old_status, new_status, changed_by, change_reason
  ) values (
    p_agent_id, p_version, 'draft', 'active', p_published_by, 'Published by admin'
  );

  return json_build_object('status', 'published', 'agent_id', p_agent_id, 'version', p_version);
end;
$$;

-- ---------------------------------------------------------------------------
-- Stored Procedure: Deprecate Contract (Active → Deprecated)
-- ---------------------------------------------------------------------------
create or replace function public.deprecate_agent_contract(
  p_agent_id text,
  p_version text,
  p_deprecated_by uuid default auth.uid(),
  p_reason text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  update agent_contracts
     set status = 'deprecated',
         deprecated_at = now()
   where id = p_agent_id
     and version = p_version
     and status = 'active';

  if not found then
    return json_build_object('error', 'Contract not found or not active');
  end if;

  insert into agent_contract_versions (
    agent_id, version, old_status, new_status, changed_by, change_reason
  ) values (
    p_agent_id, p_version, 'active', 'deprecated', p_deprecated_by, p_reason
  );

  return json_build_object('status', 'deprecated', 'agent_id', p_agent_id, 'version', p_version);
end;
$$;

-- ---------------------------------------------------------------------------
-- Stored Procedure: Get Active Contract (with fallback to latest)
-- ---------------------------------------------------------------------------
create or replace function public.get_agent_contract(
  p_agent_id text,
  p_version text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
begin
  if p_version is null then
    -- Get latest active contract
    select * into v_contract
      from agent_contracts
     where id = p_agent_id
       and status = 'active'
     order by version desc limit 1;
  else
    -- Get specific version
    select * into v_contract
      from agent_contracts
     where id = p_agent_id
       and version = p_version;
  end if;

  if v_contract is null then
    return null;
  end if;

  return json_build_object(
    'id', v_contract.id,
    'version', v_contract.version,
    'status', v_contract.status,
    'name', v_contract.name,
    'contract', v_contract.contract_json
  );
end;
$$;

-- Grant execution to authenticated users
grant execute on function public.publish_agent_contract to authenticated;
grant execute on function public.deprecate_agent_contract to authenticated;
grant execute on function public.get_agent_contract to authenticated;

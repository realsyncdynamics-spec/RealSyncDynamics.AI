-- Runtime Contract Specification (RCS) Extensions
--
-- Extends existing runtime_executions and runtime_approval_gates tables
-- to support ACS contract versioning, cost tracking, and approval workflows.
--
-- See docs/runtime-contract-specification.md for full specification.

-- ---------------------------------------------------------------------------
-- Extend runtime_executions with contract-aware fields
-- ---------------------------------------------------------------------------
alter table if exists public.runtime_executions
  add column if not exists agent_contract_version text,  -- Link to ACS
  add column if not exists tokens_input_tracked integer,
  add column if not exists tokens_output_tracked integer,
  add column if not exists estimated_cost_usd numeric(10, 6),
  add column if not exists trace_id uuid,                 -- Links to ESS events
  add column if not exists approved_at timestamptz,
  add column if not exists error_retriable boolean default false,
  add column if not exists error_retry_count integer default 0;

-- Add foreign key constraint for agent contract version
-- (Note: Cannot add FK to agent_contracts due to multi-column PK,
--  but we can add a check constraint and handle in application)

-- New index: queries by trace_id (ESS integration)
create index if not exists runtime_executions_trace_idx
  on public.runtime_executions (trace_id);

-- New index: queries by contract version
create index if not exists runtime_executions_contract_version_idx
  on public.runtime_executions (tenant_id, agent_id, agent_contract_version);

-- New index: approval gate queries
create index if not exists runtime_executions_approved_idx
  on public.runtime_executions (tenant_id, status)
  where status = 'awaiting_approval';

-- ---------------------------------------------------------------------------
-- Extend runtime_approval_gates with full gate lifecycle
-- ---------------------------------------------------------------------------
alter table if exists public.runtime_approval_gates
  add column if not exists trigger_name text,             -- e.g., 'production_change'
  add column if not exists requested_reason text,
  add column if not exists decision_timestamp timestamptz,
  add column if not exists approval_ttl_seconds integer,
  add column if not exists expires_at timestamptz;

-- Calculate expires_at for existing records (if any)
update public.runtime_approval_gates
  set expires_at = created_at + interval '1 hour' * (approval_ttl_seconds / 3600)
  where expires_at is null
    and created_at is not null
    and approval_ttl_seconds is not null;

-- New index: query pending approvals by expiry (for cron)
create index if not exists runtime_approval_gates_expiry_idx
  on public.runtime_approval_gates (expires_at)
  where status = 'pending';

-- New index: query by trigger (for policy enforcement)
create index if not exists runtime_approval_gates_trigger_idx
  on public.runtime_approval_gates (trigger_name)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- New Table: execution_costs
-- Track per-execution cost for metering & quota enforcement
-- ---------------------------------------------------------------------------
create table if not exists public.execution_costs (
  id              uuid primary key default gen_random_uuid(),
  execution_id    uuid not null references public.runtime_executions(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  -- Cost breakdown
  tokens_input    integer,
  tokens_output   integer,
  cost_input_usd  numeric(10, 8),
  cost_output_usd numeric(10, 8),
  total_cost_usd  numeric(10, 8),

  -- LLM provider info
  llm_provider    text,                                     -- 'anthropic', 'ollama', etc.
  llm_model       text,

  -- Metering
  billed_to       text,                                     -- 'tenant' or 'platform'
  invoice_id      uuid,                                     -- Reference to invoices table (created separately)

  created_at      timestamptz not null default now()
);

create index if not exists execution_costs_execution_idx
  on public.execution_costs (execution_id);

create index if not exists execution_costs_tenant_created_idx
  on public.execution_costs (tenant_id, created_at desc);

create index if not exists execution_costs_invoice_idx
  on public.execution_costs (invoice_id)
  where invoice_id is not null;

-- RLS: Tenant members can see their own execution costs
alter table public.execution_costs enable row level security;

create policy execution_costs_select on public.execution_costs
  for select
  using (public.is_tenant_member(tenant_id));

create policy execution_costs_insert on public.execution_costs
  for insert
  with check (public.is_tenant_member(tenant_id));

-- ---------------------------------------------------------------------------
-- New Table: execution_quotas
-- Track tenant quota usage for contract-defined monthly budgets
-- ---------------------------------------------------------------------------
create table if not exists public.execution_quotas (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  agent_id            text not null,
  agent_contract_version text,

  -- Quota settings
  monthly_budget_usd  numeric(10, 2),
  reset_date          date,                                 -- When quota resets (e.g., 1st of month)

  -- Usage tracking
  used_this_month_usd numeric(10, 8) default 0,
  remaining_usd       numeric(10, 8),

  -- Enforcement
  quota_exceeded_at   timestamptz,
  soft_limit_warned   boolean default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (tenant_id, agent_id, agent_contract_version)
);

create index if not exists execution_quotas_tenant_agent_idx
  on public.execution_quotas (tenant_id, agent_id);

create index if not exists execution_quotas_reset_idx
  on public.execution_quotas (reset_date)
  where quota_exceeded_at is null;

-- RLS: Tenant members can see their own quotas
alter table public.execution_quotas enable row level security;

create policy execution_quotas_select on public.execution_quotas
  for select
  using (public.is_tenant_member(tenant_id));

create policy execution_quotas_update on public.execution_quotas
  for update
  using (public.is_tenant_member(tenant_id));

-- ---------------------------------------------------------------------------
-- Stored Procedure: Check Quota (for pre-execution validation)
-- ---------------------------------------------------------------------------
create or replace function public.check_execution_quota(
  p_tenant_id uuid,
  p_agent_id text,
  p_agent_contract_version text,
  p_estimated_cost numeric default 0
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota record;
  v_remaining numeric;
begin
  -- Fetch or create quota record
  select * into v_quota
    from execution_quotas
   where tenant_id = p_tenant_id
     and agent_id = p_agent_id
     and agent_contract_version = p_agent_contract_version;

  if v_quota is null then
    -- No quota limit set (unlimited)
    return json_build_object('allowed', true, 'remaining_usd', null);
  end if;

  v_remaining := v_quota.monthly_budget_usd - v_quota.used_this_month_usd;

  if v_remaining < p_estimated_cost then
    return json_build_object(
      'allowed', false,
      'error', 'Monthly quota exceeded',
      'remaining_usd', v_remaining,
      'estimated_cost_usd', p_estimated_cost
    );
  end if;

  -- Warn at 80% usage
  if (v_quota.used_this_month_usd / v_quota.monthly_budget_usd) > 0.8 then
    return json_build_object(
      'allowed', true,
      'warning', 'Quota usage at 80%',
      'remaining_usd', v_remaining,
      'estimated_cost_usd', p_estimated_cost
    );
  end if;

  return json_build_object(
    'allowed', true,
    'remaining_usd', v_remaining,
    'estimated_cost_usd', p_estimated_cost
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Stored Procedure: Record Execution Cost
-- Called after execution completes to bill tenant quota
-- ---------------------------------------------------------------------------
create or replace function public.record_execution_cost(
  p_execution_id uuid,
  p_tenant_id uuid,
  p_tokens_input integer,
  p_tokens_output integer,
  p_cost_usd numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_execution record;
begin
  -- Fetch execution to get agent_id + contract_version
  select agent_id, agent_contract_version into v_execution
    from runtime_executions
   where id = p_execution_id;

  if v_execution is null then
    return json_build_object('error', 'Execution not found');
  end if;

  -- Insert cost record
  insert into execution_costs (
    execution_id, tenant_id, tokens_input, tokens_output,
    cost_input_usd, cost_output_usd, total_cost_usd
  ) values (
    p_execution_id, p_tenant_id, p_tokens_input, p_tokens_output,
    p_cost_usd * 0.7, p_cost_usd * 0.3, p_cost_usd
  );

  -- Update quota
  update execution_quotas
     set used_this_month_usd = used_this_month_usd + p_cost_usd,
         remaining_usd = monthly_budget_usd - (used_this_month_usd + p_cost_usd),
         updated_at = now()
   where tenant_id = p_tenant_id
     and agent_id = v_execution.agent_id
     and agent_contract_version = v_execution.agent_contract_version;

  return json_build_object('status', 'recorded', 'cost_usd', p_cost_usd);
end;
$$;

grant execute on function public.check_execution_quota to authenticated;
grant execute on function public.record_execution_cost to authenticated;

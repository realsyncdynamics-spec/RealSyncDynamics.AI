-- Runtime core tables (Phase 0).
--
-- Schema only. No cron, no worker, no edge functions wired here. The
-- application code in src/core/runtime/ owns the contracts; this migration
-- gives them persistent storage with strict tenant isolation.
--
-- See docs/architecture/agent-os.md sections 3.1, 3.2, 3.5.

-- ---------------------------------------------------------------------------
-- runtime_executions
-- One row per skill execution. Inputs/outputs are stored as hashes only;
-- raw payloads live in their respective stores (working memory, knowledge,
-- evidence vault) so this table stays bounded and PII-clean.
-- ---------------------------------------------------------------------------
create table if not exists public.runtime_executions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  agent_id        text not null,
  skill_id        text not null,
  status          text not null
                    check (status in (
                      'pending', 'running', 'awaiting_approval',
                      'completed', 'failed', 'cancelled'
                    )),
  input_hash      text not null,
  output_hash     text,
  error_code      text,
  idempotency_key text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists runtime_executions_tenant_started_idx
  on public.runtime_executions (tenant_id, started_at desc);

create index if not exists runtime_executions_skill_idx
  on public.runtime_executions (tenant_id, skill_id);

create index if not exists runtime_executions_status_idx
  on public.runtime_executions (status)
  where status in ('pending', 'running', 'awaiting_approval');

-- ---------------------------------------------------------------------------
-- runtime_approval_gates
-- Human-in-the-loop checkpoints. Each row blocks an execution from
-- transitioning out of awaiting_approval until decided.
-- ---------------------------------------------------------------------------
create table if not exists public.runtime_approval_gates (
  id               uuid primary key default gen_random_uuid(),
  execution_id     uuid not null references public.runtime_executions(id) on delete cascade,
  reason           text not null,
  risk_level       text not null
                     check (risk_level in ('low', 'medium', 'high', 'critical')),
  requested_action text not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'granted', 'denied', 'expired')),
  decided_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  decided_at       timestamptz
);

create index if not exists runtime_approval_gates_pending_idx
  on public.runtime_approval_gates (execution_id)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- runtime_events
-- Append-only audit/event log. Subscribers in Phase 3 consume via outbox
-- pattern; until then, this is the source of truth for replay.
-- ---------------------------------------------------------------------------
create table if not exists public.runtime_events (
  id           bigserial primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  execution_id uuid references public.runtime_executions(id) on delete cascade,
  agent_id     text,
  skill_id     text,
  name         text not null,
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);

create index if not exists runtime_events_tenant_time_idx
  on public.runtime_events (tenant_id, occurred_at desc);

create index if not exists runtime_events_execution_idx
  on public.runtime_events (execution_id)
  where execution_id is not null;

create index if not exists runtime_events_name_idx
  on public.runtime_events (tenant_id, name, occurred_at desc);

-- Make the event log truly append-only for non-superusers.
revoke update, delete on public.runtime_events from public;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.runtime_executions enable row level security;
alter table public.runtime_approval_gates enable row level security;
alter table public.runtime_events enable row level security;

-- Tenant membership is the consistent authorization check across the repo
-- (see public.is_tenant_member from 20260430180000_tenant_rls_and_webhook_events).
drop policy if exists runtime_executions_tenant_select on public.runtime_executions;
create policy runtime_executions_tenant_select
  on public.runtime_executions
  for select
  using (public.is_tenant_member(tenant_id));

drop policy if exists runtime_executions_tenant_insert on public.runtime_executions;
create policy runtime_executions_tenant_insert
  on public.runtime_executions
  for insert
  with check (public.is_tenant_member(tenant_id));

drop policy if exists runtime_executions_tenant_update on public.runtime_executions;
create policy runtime_executions_tenant_update
  on public.runtime_executions
  for update
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- Approval gates inherit the tenant scope of their parent execution.
drop policy if exists runtime_approval_gates_tenant_select on public.runtime_approval_gates;
create policy runtime_approval_gates_tenant_select
  on public.runtime_approval_gates
  for select
  using (
    exists (
      select 1
        from public.runtime_executions e
       where e.id = runtime_approval_gates.execution_id
         and public.is_tenant_member(e.tenant_id)
    )
  );

drop policy if exists runtime_approval_gates_tenant_insert on public.runtime_approval_gates;
create policy runtime_approval_gates_tenant_insert
  on public.runtime_approval_gates
  for insert
  with check (
    exists (
      select 1
        from public.runtime_executions e
       where e.id = runtime_approval_gates.execution_id
         and public.is_tenant_member(e.tenant_id)
    )
  );

drop policy if exists runtime_approval_gates_tenant_update on public.runtime_approval_gates;
create policy runtime_approval_gates_tenant_update
  on public.runtime_approval_gates
  for update
  using (
    exists (
      select 1
        from public.runtime_executions e
       where e.id = runtime_approval_gates.execution_id
         and public.is_tenant_member(e.tenant_id)
    )
  );

drop policy if exists runtime_events_tenant_select on public.runtime_events;
create policy runtime_events_tenant_select
  on public.runtime_events
  for select
  using (public.is_tenant_member(tenant_id));

drop policy if exists runtime_events_tenant_insert on public.runtime_events;
create policy runtime_events_tenant_insert
  on public.runtime_events
  for insert
  with check (public.is_tenant_member(tenant_id));

-- No update/delete policies on runtime_events: append-only by design.

comment on table public.runtime_executions is
  'Phase 0 runtime: one row per skill execution. See docs/architecture/agent-os.md.';
comment on table public.runtime_approval_gates is
  'Phase 0 runtime: human-in-the-loop gates blocking risky executions.';
comment on table public.runtime_events is
  'Phase 0 runtime: append-only audit/event log for replay and forensics.';

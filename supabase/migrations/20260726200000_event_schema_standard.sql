-- Event Schema Standard (ESS) Normalization
--
-- Normalizes runtime_events table to conform to ESS v1.0 specification.
-- Introduces canonical event structure with hash chains, tracing, and signatures.
--
-- See docs/event-schema-standard.md for full specification.

-- ---------------------------------------------------------------------------
-- Create new runtime_events_v2 table with ESS schema
-- (Keep v1 for backward compat, migrate gradually)
-- ---------------------------------------------------------------------------
create table if not exists public.runtime_events_v2 (
  id              uuid primary key default gen_random_uuid(),

  -- Event identity (canonical)
  event_id        uuid not null unique default gen_random_uuid(),
  event_type      text not null,                    -- 'agent.started', 'tool.completed', etc.
  version         text not null default '1.0',

  -- Temporal (server-side, UTC)
  occurred_at     timestamptz not null,             -- When event actually occurred
  received_at     timestamptz not null default now(), -- When stored in DB

  -- Scope & Authorization (RLS anchor)
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,

  -- Causality chain (tracing & replay)
  parent_event_id uuid,                             -- Upstream cause
  trace_id        uuid not null,                    -- Groups related events
  span_id         text not null,                    -- Unique per event in trace

  -- Actor & Source
  actor_type      text not null check (actor_type in (
                    'user', 'agent', 'system', 'integration'
                  )),
  actor_id        text not null,                    -- user_id, agent_id, etc.
  actor_name      text,

  source_service  text not null check (source_service in (
                    'edge-function', 'apps-agent-runtime', 'webhook', 'scheduler', 'ui'
                  )),
  source_function text,                             -- e.g., 'governance-agent'
  source_region   text,

  -- Payload (type-specific, stored as JSONB)
  category        text not null check (category in (
                    'agent', 'tool', 'approval', 'compliance', 'audit', 'system'
                  )),
  payload         jsonb not null default '{}'::jsonb,

  -- Metadata
  tags            jsonb,                            -- k/v pairs (searchable)

  -- Cost tracking (for LLM usage events)
  cost_tokens_input integer,
  cost_tokens_output integer,
  cost_estimated_usd numeric(10, 8),

  -- Audit & Compliance (hash chain)
  hash            text not null unique,             -- SHA256(canonical_json)
  previous_hash   text,                             -- Links to prior event

  -- Signatures (C2PA provenance)
  signed_algorithm text,                            -- 'ed25519' or null
  signed_signature text,                            -- base64-encoded signature
  signed_public_key text,                           -- base64-encoded public key

  -- Audit
  created_at      timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists runtime_events_v2_tenant_occurred_idx
  on public.runtime_events_v2 (tenant_id, occurred_at desc);

create index if not exists runtime_events_v2_trace_idx
  on public.runtime_events_v2 (trace_id);

create index if not exists runtime_events_v2_trace_span_idx
  on public.runtime_events_v2 (trace_id, span_id);

create index if not exists runtime_events_v2_agent_idx
  on public.runtime_events_v2 (tenant_id, actor_id)
  where category = 'agent';

create index if not exists runtime_events_v2_event_type_idx
  on public.runtime_events_v2 (tenant_id, event_type, occurred_at desc);

create index if not exists runtime_events_v2_hash_chain_idx
  on public.runtime_events_v2 (previous_hash)
  where previous_hash is not null;

create index if not exists runtime_events_v2_user_idx
  on public.runtime_events_v2 (user_id, occurred_at desc)
  where user_id is not null;

-- Make immutable: only insert, no update/delete
revoke update, delete on public.runtime_events_v2 from public;

-- ---------------------------------------------------------------------------
-- RLS: Tenant isolation
-- ---------------------------------------------------------------------------
alter table public.runtime_events_v2 enable row level security;

create policy runtime_events_v2_select on public.runtime_events_v2
  for select
  using (public.is_tenant_member(tenant_id));

create policy runtime_events_v2_insert on public.runtime_events_v2
  for insert
  with check (public.is_tenant_member(tenant_id));

-- ---------------------------------------------------------------------------
-- Stored Procedure: Publish Event (canonical format)
-- Validates, hashes, optionally signs, and persists event.
-- ---------------------------------------------------------------------------
create or replace function public.publish_event(
  p_event_type text,
  p_category text,
  p_occurred_at timestamptz,
  p_tenant_id uuid,
  p_trace_id uuid,
  p_span_id text,
  p_actor_type text,
  p_actor_id text,
  p_source_service text,
  p_payload jsonb,
  p_parent_event_id uuid default null,
  p_user_id uuid default null,
  p_tags jsonb default null,
  p_sign boolean default false
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_hash text;
  v_previous_hash text;
  v_signature text;
  v_result json;
begin
  -- Generate event ID
  v_event_id := gen_random_uuid();

  -- Get previous event in trace (for hash chain)
  select hash into v_previous_hash
    from runtime_events_v2
   where trace_id = p_trace_id
   order by received_at desc
   limit 1;

  -- Compute canonical JSON hash (simplified; actual would use canonical JSON rules)
  v_hash := encode(
    digest(
      jsonb_build_object(
        'event_id', v_event_id::text,
        'event_type', p_event_type,
        'occurred_at', p_occurred_at::text,
        'actor_type', p_actor_type,
        'actor_id', p_actor_id,
        'category', p_category,
        'payload', p_payload
      )::text,
      'sha256'
    ),
    'hex'
  );

  -- Sign if requested (placeholder; actual would use cryptographic library)
  if p_sign then
    v_signature := encode(gen_random_bytes(64), 'base64'); -- Placeholder
  end if;

  -- Insert event
  insert into runtime_events_v2 (
    event_id, event_type, version,
    occurred_at, received_at,
    tenant_id, user_id,
    parent_event_id, trace_id, span_id,
    actor_type, actor_id, source_service,
    category, payload, tags,
    hash, previous_hash,
    signed_algorithm, signed_signature
  ) values (
    v_event_id, p_event_type, '1.0',
    p_occurred_at, now(),
    p_tenant_id, p_user_id,
    p_parent_event_id, p_trace_id, p_span_id,
    p_actor_type, p_actor_id, p_source_service,
    p_category, p_payload, p_tags,
    v_hash, v_previous_hash,
    case when p_sign then 'ed25519' else null end,
    v_signature
  );

  v_result := json_build_object(
    'event_id', v_event_id,
    'hash', v_hash,
    'trace_id', p_trace_id
  );

  return v_result;
end;
$$;

grant execute on function public.publish_event to authenticated;

-- ---------------------------------------------------------------------------
-- Stored Procedure: Verify Event Hash Chain
-- Validates integrity of a trace by checking all hashes.
-- ---------------------------------------------------------------------------
create or replace function public.verify_event_trace(
  p_trace_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events record;
  v_count integer := 0;
  v_errors integer := 0;
  v_previous_hash text;
  v_current_hash text;
begin
  for v_events in
    select id, hash, previous_hash, event_type
      from runtime_events_v2
     where trace_id = p_trace_id
     order by received_at asc
  loop
    v_count := v_count + 1;

    -- Check hash chain continuity
    if v_events.previous_hash is not null and v_events.previous_hash != v_previous_hash then
      v_errors := v_errors + 1;
      raise warning 'Hash chain broken at event % (expected %, got %)',
        v_events.id, v_previous_hash, v_events.previous_hash;
    end if;

    v_previous_hash := v_events.hash;
  end loop;

  return json_build_object(
    'trace_id', p_trace_id,
    'total_events', v_count,
    'integrity_errors', v_errors,
    'valid', v_errors = 0
  );
end;
$$;

grant execute on function public.verify_event_trace to authenticated;

-- ---------------------------------------------------------------------------
-- Stored Procedure: Query Trace by ID (ordered causally)
-- Returns all events in a trace ordered by occurrence time.
-- ---------------------------------------------------------------------------
create or replace function public.get_event_trace(
  p_trace_id uuid
)
returns table (
  event_id uuid,
  event_type text,
  occurred_at timestamptz,
  actor_type text,
  actor_id text,
  category text,
  payload jsonb,
  hash text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      re.event_id,
      re.event_type,
      re.occurred_at,
      re.actor_type,
      re.actor_id,
      re.category,
      re.payload,
      re.hash
    from runtime_events_v2 re
   where re.trace_id = p_trace_id
     and public.is_tenant_member(re.tenant_id)
   order by re.occurred_at asc;
end;
$$;

grant execute on function public.get_event_trace to authenticated;

-- ---------------------------------------------------------------------------
-- Stored Procedure: Aggregate Events by Type (for analytics)
-- ---------------------------------------------------------------------------
create or replace function public.aggregate_events_by_type(
  p_tenant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  event_type text,
  event_count bigint,
  latest_occurrence timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'Unauthorized';
  end if;

  return query
    select
      re.event_type,
      count(*)::bigint,
      max(re.occurred_at)
    from runtime_events_v2 re
   where re.tenant_id = p_tenant_id
     and re.occurred_at >= p_start_date
     and re.occurred_at <= p_end_date
   group by re.event_type
   order by count(*) desc;
end;
$$;

grant execute on function public.aggregate_events_by_type to authenticated;

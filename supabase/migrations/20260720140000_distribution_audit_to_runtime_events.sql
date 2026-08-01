-- Distribution Audit Log → Runtime Events Integration (Phase 3)
-- Wires distribution_audit_log events to runtime_events table for cross-module
-- compliance trail and audit consolidation.

-- 1. Trigger function: Sync distribution audit log to runtime_events
create or replace function public.sync_distribution_audit_to_runtime()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_event_name text;
  v_payload jsonb;
begin
  -- Map audit event_type to runtime_events name format
  v_event_name := 'distribution_queue.' || NEW.event_type;

  -- Build payload with relevant context
  v_payload := jsonb_build_object(
    'queue_entry_id', NEW.queue_entry_id,
    'channel', NEW.channel,
    'message', NEW.message,
    'metadata', NEW.metadata,
    'audit_id', NEW.id,
    'audit_timestamp', NEW.created_at
  );

  -- Insert into runtime_events (append-only, for compliance trail)
  insert into public.runtime_events (
    tenant_id,
    agent_id,
    skill_id,
    name,
    payload,
    occurred_at
  ) values (
    NEW.tenant_id,
    'distribution-queue-worker',
    'social-orchestrator',
    v_event_name,
    v_payload,
    NEW.created_at
  );

  return NEW;
end;
$$;

-- 2. Enable trigger on distribution_audit_log inserts
drop trigger if exists trg_sync_audit_to_runtime on public.distribution_audit_log;
create trigger trg_sync_audit_to_runtime
  after insert on public.distribution_audit_log
  for each row
  execute function public.sync_distribution_audit_to_runtime();

-- 3. Helper: Bulk sync historical events (for backfill if needed)
create or replace function public.backfill_distribution_audit_to_runtime(
  p_since timestamptz default '2026-07-01'::timestamptz
)
returns table (
  synced_count int,
  first_event_id bigint,
  last_event_id bigint
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count int := 0;
  v_first_id bigint;
  v_last_id bigint;
begin
  with synced as (
    insert into public.runtime_events (tenant_id, agent_id, skill_id, name, payload, occurred_at)
    select
      dal.tenant_id,
      'distribution-queue-worker',
      'social-orchestrator',
      'distribution_queue.' || dal.event_type,
      jsonb_build_object(
        'queue_entry_id', dal.queue_entry_id,
        'channel', dal.channel,
        'message', dal.message,
        'metadata', dal.metadata,
        'audit_id', dal.id,
        'audit_timestamp', dal.created_at
      ),
      dal.created_at
    from public.distribution_audit_log dal
    where dal.created_at >= p_since
      and not exists (
        select 1 from public.runtime_events re
        where re.payload->>'audit_id' = dal.id::text
      )
    returning runtime_events.id
  )
  select
    count(*)::int,
    min(id),
    max(id)
  from synced
  into v_count, v_first_id, v_last_id;

  return query select v_count, v_first_id, v_last_id;
end;
$$;

revoke all on function public.backfill_distribution_audit_to_runtime(timestamptz) from public;
grant execute on function public.backfill_distribution_audit_to_runtime(timestamptz) to service_role;

-- 4. Comments
comment on function public.sync_distribution_audit_to_runtime() is
  'Automatically sync distribution_audit_log entries to runtime_events (append-only compliance trail).';
comment on function public.backfill_distribution_audit_to_runtime(timestamptz) is
  'Backfill historical distribution audit events to runtime_events. Call once if enabling after events already exist.';

-- 5. Informational: new events logged to both tables automatically
-- From now on:
--   INSERT into distribution_audit_log
--   → TRIGGER sync_distribution_audit_to_runtime
--   → INSERT into runtime_events (compliance trail)
--
-- To query unified audit log:
--   SELECT * FROM runtime_events WHERE name LIKE 'distribution_queue.%' AND tenant_id = ?

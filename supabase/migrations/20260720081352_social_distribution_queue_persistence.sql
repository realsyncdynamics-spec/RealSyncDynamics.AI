-- Social Distribution Queue Persistence via Postgres (Phase 3).
--
-- Enables the in-memory queue to be persisted across process restarts.
-- Uses LISTEN/NOTIFY for async job distribution to workers.
-- Atomic claim via FOR UPDATE SKIP LOCKED prevents duplicate processing.
--
-- Tables:
--   - distribution_queue_entries: Main queue (pending, approved, published, failed)
--   - distribution_dlq: Dead Letter Queue (failed after max retries)
--   - distribution_audit_log: Audit trail of all publish attempts

create extension if not exists "pgcrypto";

-- 1. Main Queue Table
create table if not exists public.distribution_queue_entries (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  post_id           text not null,
  channel           text not null,
  body              text not null,
  hashtags          text[] default '{}',
  approval_status   text not null default 'pending'
    check (approval_status in ('auto', 'pending', 'approved', 'rejected')),
  status            text not null default 'pending'
    check (status in ('pending', 'approved', 'auto', 'published', 'failed', 'rejected')),
  post_data         jsonb default '{}'::jsonb,  -- Full SocialPost for reconstruction
  enqueued_at       timestamptz not null default now(),
  decided_at        timestamptz,
  reviewer          text,
  published_at      timestamptz,
  external_id       text,
  attempts          int not null default 0,
  max_attempts      int not null default 3,
  last_error        text,
  next_retry_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_distribution_queue_tenant on public.distribution_queue_entries(tenant_id);
create index if not exists idx_distribution_queue_status on public.distribution_queue_entries(status, created_at);
create index if not exists idx_distribution_queue_retry on public.distribution_queue_entries(next_retry_at)
  where status = 'failed' and attempts < max_attempts;
create index if not exists idx_distribution_queue_published on public.distribution_queue_entries(published_at desc)
  where status = 'published';

-- 2. Dead Letter Queue (for entries exhausted all retries)
create table if not exists public.distribution_dlq (
  id                uuid primary key default gen_random_uuid(),
  queue_entry_id    uuid not null references public.distribution_queue_entries(id) on delete cascade,
  tenant_id         uuid not null,
  channel           text not null,
  final_error       text not null,
  attempts_made     int not null,
  failed_at         timestamptz not null default now(),
  moved_to_dlq_at   timestamptz not null default now()
);

create index if not exists idx_dlq_tenant on public.distribution_dlq(tenant_id);
create index if not exists idx_dlq_failed_at on public.distribution_dlq(failed_at desc);

-- 3. Audit Log (for compliance & debugging)
create table if not exists public.distribution_audit_log (
  id                uuid primary key default gen_random_uuid(),
  queue_entry_id    uuid references public.distribution_queue_entries(id) on delete set null,
  tenant_id         uuid not null,
  event_type        text not null
    check (event_type in ('enqueued', 'approved', 'rejected', 'publish_started', 'publish_success', 'publish_failed', 'retry_scheduled', 'dlq_moved')),
  channel           text,
  message           text,
  metadata          jsonb default '{}',
  created_at        timestamptz not null default now()
);

create index if not exists idx_audit_tenant on public.distribution_audit_log(tenant_id);
create index if not exists idx_audit_event_type on public.distribution_audit_log(event_type, created_at);
create index if not exists idx_audit_queue_entry on public.distribution_audit_log(queue_entry_id);

-- 4. RLS Policies (multi-tenant isolation)
alter table public.distribution_queue_entries enable row level security;
alter table public.distribution_dlq enable row level security;
alter table public.distribution_audit_log enable row level security;

-- Service role: full access
drop policy if exists "distribution_queue_service_write" on public.distribution_queue_entries;
create policy "distribution_queue_service_write"
  on public.distribution_queue_entries for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "distribution_dlq_service_write" on public.distribution_dlq;
create policy "distribution_dlq_service_write"
  on public.distribution_dlq for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "distribution_audit_service_write" on public.distribution_audit_log;
create policy "distribution_audit_service_write"
  on public.distribution_audit_log for all
  to service_role
  using (true)
  with check (true);

-- Authenticated users: can see entries for their tenant
drop policy if exists "distribution_queue_tenant_read" on public.distribution_queue_entries;
create policy "distribution_queue_tenant_read"
  on public.distribution_queue_entries for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.memberships where user_id = auth.uid())
  );

drop policy if exists "distribution_queue_tenant_insert" on public.distribution_queue_entries;
create policy "distribution_queue_tenant_insert"
  on public.distribution_queue_entries for insert
  to authenticated
  with check (
    tenant_id in (select tenant_id from public.memberships where user_id = auth.uid())
  );

-- 5. NOTIFY Trigger: wake up workers when new entries are queued
create or replace function public.distribution_queue_notify()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if NEW.status = 'pending' or NEW.status = 'auto' or NEW.status = 'approved' then
    perform pg_notify('distribution_queue_ready', json_build_object(
      'id', NEW.id,
      'channel', NEW.channel,
      'tenant_id', NEW.tenant_id,
      'status', NEW.status
    )::text);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_distribution_queue_notify on public.distribution_queue_entries;
create trigger trg_distribution_queue_notify
  after insert or update of status on public.distribution_queue_entries
  for each row execute function public.distribution_queue_notify();

-- 6. Helper: Atomic claim with exponential backoff
create or replace function public.distribution_queue_claim_next(p_channel text)
returns table (
  id uuid,
  tenant_id uuid,
  post_id text,
  channel text,
  body text,
  hashtags text[],
  status text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  -- Atomically claim the oldest pending/auto entry for this channel
  update public.distribution_queue_entries
     set status = 'approved',
         attempts = attempts + 1,
         updated_at = now()
   where id = (
     select dqe.id
       from public.distribution_queue_entries dqe
      where dqe.channel = p_channel
        and (
          (dqe.status = 'pending' and dqe.approval_status = 'AUTO')
          or (dqe.status = 'approved')
          or (dqe.status = 'failed'
              and dqe.attempts < dqe.max_attempts
              and (dqe.next_retry_at is null or dqe.next_retry_at <= now()))
        )
      order by created_at asc
      for update skip locked
      limit 1
   )
   returning distribution_queue_entries.id into v_id;

  if v_id is null then
    return;
  end if;

  return query
    select dqe.id, dqe.tenant_id, dqe.post_id, dqe.channel, dqe.body, dqe.hashtags, dqe.status
      from public.distribution_queue_entries dqe
     where dqe.id = v_id;
end;
$$;

revoke all on function public.distribution_queue_claim_next(text) from public;
grant execute on function public.distribution_queue_claim_next(text) to service_role;

-- 7. Helper: Mark as published
create or replace function public.distribution_queue_mark_published(
  p_id uuid,
  p_external_id text,
  p_published_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  update public.distribution_queue_entries
     set status = 'published',
         external_id = p_external_id,
         published_at = coalesce(p_published_at, now()),
         updated_at = now()
   where id = p_id;

  insert into public.distribution_audit_log (queue_entry_id, tenant_id, event_type, channel, message)
    select id, tenant_id, 'publish_success', channel, 'Published with external_id: ' || p_external_id
      from public.distribution_queue_entries
     where id = p_id;
end;
$$;

revoke all on function public.distribution_queue_mark_published(uuid, text, timestamptz) from public;
grant execute on function public.distribution_queue_mark_published(uuid, text, timestamptz) to service_role;

-- 8. Helper: Mark as failed with retry scheduling
create or replace function public.distribution_queue_mark_failed(
  p_id uuid,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_attempts int;
  v_max_attempts int;
  v_tenant_id uuid;
  v_channel text;
begin
  -- Get current state
  select attempts, max_attempts, tenant_id, channel
    into v_attempts, v_max_attempts, v_tenant_id, v_channel
    from public.distribution_queue_entries
   where id = p_id;

  -- If we've exhausted retries, move to DLQ
  if v_attempts >= v_max_attempts then
    update public.distribution_queue_entries
       set status = 'failed',
           last_error = p_error,
           updated_at = now()
     where id = p_id;

    insert into public.distribution_dlq (queue_entry_id, tenant_id, channel, final_error, attempts_made)
      values (p_id, v_tenant_id, v_channel, coalesce(p_error, 'Unknown error'), v_attempts);

    insert into public.distribution_audit_log (queue_entry_id, tenant_id, event_type, channel, message)
      values (p_id, v_tenant_id, 'dlq_moved', v_channel, 'Moved to DLQ after ' || v_attempts || ' attempts');
  else
    -- Schedule retry with exponential backoff
    update public.distribution_queue_entries
       set status = 'failed',
           last_error = p_error,
           next_retry_at = now() + (interval '1 second' * power(2, v_attempts)),
           updated_at = now()
     where id = p_id;

    insert into public.distribution_audit_log (queue_entry_id, tenant_id, event_type, channel, message)
      values (p_id, v_tenant_id, 'retry_scheduled', v_channel, 'Retry scheduled in ' || (2 ^ v_attempts) || 's');
  end if;
end;
$$;

revoke all on function public.distribution_queue_mark_failed(uuid, text) from public;
grant execute on function public.distribution_queue_mark_failed(uuid, text) to service_role;

-- 9. Comments
comment on table public.distribution_queue_entries is
  'Social orchestrator distribution queue (Phase 3). Persists queue state across process restarts. LISTEN/NOTIFY channel: distribution_queue_ready';
comment on table public.distribution_dlq is
  'Dead Letter Queue for entries that failed after max_attempts retries.';
comment on table public.distribution_audit_log is
  'Audit trail for all queue operations (enqueue, approve, publish, fail, dlq). Required for compliance & debugging.';

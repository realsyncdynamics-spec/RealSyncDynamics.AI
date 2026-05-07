-- Async-Audit-Job-Queue via Postgres LISTEN/NOTIFY (Phase 8 nach ARCHITECTURE.md).
--
-- Statt BullMQ + Redis nutzen wir Postgres-Native für v1: weniger Komponenten,
-- weniger Fehlerquellen, ohnehin alle Daten in Postgres. Migration zu
-- BullMQ erfolgt in Phase 9 wenn Throughput es rechtfertigt.

create extension if not exists "pgcrypto";

-- 1. Job-Queue-Tabelle
create table if not exists public.audit_jobs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  audit_id        uuid,                    -- nullable bis Worker neuen Audit-Record erstellt
  domain          text not null,
  status          text not null default 'queued'
    check (status in ('queued', 'running', 'success', 'failed', 'timeout', 'cancelled')),
  scan_options    jsonb not null default '{}'::jsonb,
  result_summary  jsonb,                   -- Score + Issue-Count + Methodology-Version
  error_message   text,
  attempts        int not null default 0,
  max_attempts    int not null default 3,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  next_retry_at   timestamptz,
  worker_id       text                     -- Hostname des Workers, der den Job hat
);

create index if not exists idx_audit_jobs_status_created on public.audit_jobs(status, created_at);
create index if not exists idx_audit_jobs_tenant on public.audit_jobs(tenant_id);
create index if not exists idx_audit_jobs_next_retry on public.audit_jobs(next_retry_at) where status = 'failed' and attempts < max_attempts;

-- 2. RLS
alter table public.audit_jobs enable row level security;

drop policy if exists "audit_jobs_tenant_read" on public.audit_jobs;
create policy "audit_jobs_tenant_read"
  on public.audit_jobs for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.memberships where user_id = auth.uid())
  );

drop policy if exists "audit_jobs_tenant_insert" on public.audit_jobs;
create policy "audit_jobs_tenant_insert"
  on public.audit_jobs for insert
  to authenticated
  with check (
    tenant_id in (select tenant_id from public.memberships where user_id = auth.uid())
  );

drop policy if exists "audit_jobs_service_write" on public.audit_jobs;
create policy "audit_jobs_service_write"
  on public.audit_jobs for all
  to service_role
  using (true)
  with check (true);

-- 3. NOTIFY-Trigger: bei jedem queued-Insert wird der Worker geweckt
create or replace function public.audit_jobs_notify_worker()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if NEW.status = 'queued' then
    perform pg_notify('audit_job_queued', json_build_object(
      'job_id', NEW.id,
      'domain', NEW.domain,
      'tenant_id', NEW.tenant_id,
      'attempts', NEW.attempts
    )::text);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_audit_jobs_notify on public.audit_jobs;
create trigger trg_audit_jobs_notify
  after insert or update of status on public.audit_jobs
  for each row execute function public.audit_jobs_notify_worker();

-- 4. Hilfsfunktion: Worker holt sich nächsten Job atomic (via FOR UPDATE SKIP LOCKED)
create or replace function public.audit_jobs_claim_next(p_worker_id text)
returns table (
  id uuid, tenant_id uuid, domain text, scan_options jsonb, attempts int
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_id uuid;
begin
  -- Atomic claim: nimmt den ältesten queued-Job, lockt ihn, markiert running
  update public.audit_jobs
     set status = 'running',
         started_at = now(),
         attempts = attempts + 1,
         worker_id = p_worker_id
   where id = (
     select aj.id
       from public.audit_jobs aj
      where aj.status = 'queued'
         or (aj.status = 'failed'
             and aj.attempts < aj.max_attempts
             and (aj.next_retry_at is null or aj.next_retry_at <= now()))
      order by created_at asc
      for update skip locked
      limit 1
   )
   returning audit_jobs.id into v_id;

  if v_id is null then
    return;
  end if;

  return query
    select aj.id, aj.tenant_id, aj.domain, aj.scan_options, aj.attempts
      from public.audit_jobs aj
     where aj.id = v_id;
end;
$$;

revoke all on function public.audit_jobs_claim_next(text) from public;
grant execute on function public.audit_jobs_claim_next(text) to service_role;

-- 5. Hilfsfunktion: Worker meldet Fertigstellung
create or replace function public.audit_jobs_complete(
  p_job_id uuid,
  p_status text,
  p_audit_id uuid default null,
  p_summary jsonb default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_status not in ('success', 'failed', 'timeout', 'cancelled') then
    raise exception 'invalid completion status %', p_status;
  end if;

  update public.audit_jobs
     set status = p_status,
         completed_at = now(),
         audit_id = coalesce(p_audit_id, audit_id),
         result_summary = coalesce(p_summary, result_summary),
         error_message = p_error,
         next_retry_at = case
           when p_status = 'failed' and attempts < max_attempts
             then now() + (interval '1 minute' * power(2, attempts))  -- exponential backoff
           else null
         end
   where id = p_job_id;
end;
$$;

revoke all on function public.audit_jobs_complete(uuid, text, uuid, jsonb, text) from public;
grant execute on function public.audit_jobs_complete(uuid, text, uuid, jsonb, text) to service_role;

comment on table public.audit_jobs is
  'Async-Audit-Job-Queue (ARCHITECTURE.md Phase 8). LISTEN/NOTIFY auf channel "audit_job_queued" weckt Worker. Atomic claim via FOR UPDATE SKIP LOCKED.';

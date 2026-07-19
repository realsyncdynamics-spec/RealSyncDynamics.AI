-- Social Distribution Queue — persistent queue for social publisher orchestration.
--
-- Stores QueueEntries for posts destined for LinkedIn, WordPress, Ghost, Email, Webhooks, etc.
-- Provides retry logic, audit trail, and Dead Letter Queue for failed publishes.

create extension if not exists "pgcrypto";

-- 1. Queue Entries Table — one per post-per-channel
create table if not exists public.distribution_queue_entries (
  id              text primary key,                        -- 'q_*' from JavaScript
  tenant_id       uuid not null,                           -- user/tenant identifier (auth.uid() in RLS context)
  social_event_id text not null,                           -- references social_events.id
  channel         text not null
    check (channel in ('linkedin.enterprise', 'linkedin.legal', 'instagram.reel', 'tiktok.fast', 'x.alert', 'wordpress.blog', 'ghost.blog', 'webhook.custom', 'email.newsletter')),
  post_body       text not null,
  post_hashtags   text[] default array[]::text[],
  status          text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'auto', 'published', 'failed')),
  approval_status text not null default 'REVIEW'
    check (approval_status in ('AUTO', 'REVIEW', 'BLOCKED')),
  reviewer        text,
  publish_attempts int not null default 0,
  max_publish_attempts int not null default 3,
  last_error_code text,
  last_error_message text,
  external_id     text,                                    -- ID from external platform (LinkedIn post ID, WordPress post ID, etc.)
  created_at      timestamptz not null default now(),
  decided_at      timestamptz,                             -- when reviewer approved/rejected
  published_at    timestamptz,                             -- when actually published
  next_retry_at   timestamptz,
  updated_at      timestamptz not null default now()
);

-- 2. Indexes for operational queries
create index if not exists idx_distribution_queue_tenant on public.distribution_queue_entries(tenant_id);
create index if not exists idx_distribution_queue_status_channel on public.distribution_queue_entries(status, channel);
create index if not exists idx_distribution_queue_retry on public.distribution_queue_entries(next_retry_at)
  where status = 'failed' and publish_attempts < max_publish_attempts;
create index if not exists idx_distribution_queue_pending on public.distribution_queue_entries(created_at DESC)
  where status = 'pending';

-- 3. RLS — multi-tenant isolation
alter table public.distribution_queue_entries enable row level security;

drop policy if exists "distribution_queue_tenant_read" on public.distribution_queue_entries;
create policy "distribution_queue_tenant_read"
  on public.distribution_queue_entries for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.memberships where user_id = auth.uid())
  );

drop policy if exists "distribution_queue_tenant_write" on public.distribution_queue_entries;
create policy "distribution_queue_tenant_write"
  on public.distribution_queue_entries for update
  to authenticated
  using (
    tenant_id in (select tenant_id from public.memberships where user_id = auth.uid())
  );

drop policy if exists "distribution_queue_service_all" on public.distribution_queue_entries;
create policy "distribution_queue_service_all"
  on public.distribution_queue_entries for all
  to service_role
  using (true)
  with check (true);

-- 4. Dead Letter Queue — for entries that exhausted retries
create table if not exists public.distribution_dlq (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  queue_entry_id  text not null,
  channel         text not null,
  error_code      text,
  error_message   text,
  retry_count     int not null,
  final_error_at  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_distribution_dlq_tenant on public.distribution_dlq(tenant_id);
create index if not exists idx_distribution_dlq_channel on public.distribution_dlq(channel);
create index if not exists idx_distribution_dlq_created on public.distribution_dlq(created_at DESC);

alter table public.distribution_dlq enable row level security;

drop policy if exists "distribution_dlq_tenant_read" on public.distribution_dlq;
create policy "distribution_dlq_tenant_read"
  on public.distribution_dlq for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.memberships where user_id = auth.uid())
  );

drop policy if exists "distribution_dlq_service_all" on public.distribution_dlq;
create policy "distribution_dlq_service_all"
  on public.distribution_dlq for all
  to service_role
  using (true)
  with check (true);

-- 5. Audit Logging — integration point with runtime_events for governance trails
create table if not exists public.distribution_audit_log (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  queue_entry_id  text not null,
  event_type      text not null
    check (event_type in ('enqueued', 'approved', 'rejected', 'publish_started', 'publish_success', 'publish_failed', 'dlq_entry_created')),
  actor_id        text,                                    -- reviewer or system
  channel         text not null,
  details         jsonb default '{}'::jsonb,              -- error details, external IDs, etc.
  created_at      timestamptz not null default now()
);

create index if not exists idx_distribution_audit_tenant on public.distribution_audit_log(tenant_id);
create index if not exists idx_distribution_audit_queue_entry on public.distribution_audit_log(queue_entry_id);
create index if not exists idx_distribution_audit_event_type on public.distribution_audit_log(event_type);

alter table public.distribution_audit_log enable row level security;

drop policy if exists "distribution_audit_tenant_read" on public.distribution_audit_log;
create policy "distribution_audit_tenant_read"
  on public.distribution_audit_log for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.memberships where user_id = auth.uid())
  );

drop policy if exists "distribution_audit_service_all" on public.distribution_audit_log;
create policy "distribution_audit_service_all"
  on public.distribution_audit_log for all
  to service_role
  using (true)
  with check (true);

-- 6. Helper functions (TODO: add in follow-up PR)
-- distribution_queue_enqueue: Insert with automatic audit logging
-- distribution_queue_mark_published: Update status and log external ID
-- distribution_queue_mark_failed: Handle retry logic and DLQ transitions

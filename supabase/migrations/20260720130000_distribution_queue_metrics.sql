-- Distribution Queue Metrics & Observability (Phase 3)
-- Provides real-time metrics for queue depth, latency, retry rates, and error trends.

-- 1. Queue Metrics View (aggregated stats per channel per tenant)
create or replace view public.vw_distribution_queue_metrics as
select
  tenant_id,
  channel,
  count(*) filter (where status = 'pending') as pending_count,
  count(*) filter (where status = 'approved') as approved_count,
  count(*) filter (where status = 'published') as published_count,
  count(*) filter (where status = 'failed') as failed_count,
  count(*) filter (where status = 'rejected') as rejected_count,
  count(*) as total_count,

  -- Latency metrics (in seconds)
  round(extract(epoch from (avg(published_at - enqueued_at) filter (where published_at is not null)))::numeric, 2) as avg_latency_seconds,
  round(extract(epoch from (percentile_cont(0.95) within group (order by published_at - enqueued_at) filter (where published_at is not null)))::numeric, 2) as p95_latency_seconds,

  -- Retry metrics
  avg(attempts) filter (where status = 'published') as avg_attempts_published,
  max(attempts) filter (where status = 'failed') as max_attempts_failed,
  round(100.0 * count(*) filter (where attempts > 1) / nullif(count(*), 0), 2) as retry_rate_percent,

  -- Error trends
  count(distinct last_error) filter (where status = 'failed') as distinct_error_types,

  now() as computed_at
from public.distribution_queue_entries
group by tenant_id, channel;

comment on view public.vw_distribution_queue_metrics is
  'Real-time aggregated metrics for distribution queue per tenant/channel. Includes depth, latency, retry rates, error trends.';

-- 2. Queue Error Frequency View (top errors per channel)
create or replace view public.vw_distribution_queue_errors as
select
  tenant_id,
  channel,
  last_error,
  count(*) as error_count,
  count(*) filter (where status = 'failed') as failed_entries,
  round(100.0 * count(*) / (select count(*) from public.distribution_queue_entries dqe2 where dqe2.tenant_id = dqe.tenant_id and dqe2.channel = dqe.channel)::numeric, 2) as error_percentage,
  max(updated_at) as last_occurrence,
  now() as computed_at
from public.distribution_queue_entries dqe
where last_error is not null
group by tenant_id, channel, last_error
order by error_count desc;

comment on view public.vw_distribution_queue_errors is
  'Error frequency analysis. Identifies most common failure reasons per channel.';

-- 3. Daily Metrics Table (time-series persistence for trending)
create table if not exists public.distribution_queue_daily_metrics (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  channel           text not null,
  metric_date       date not null,

  -- Daily counts
  enqueued_count    int default 0,
  approved_count    int default 0,
  published_count   int default 0,
  failed_count      int default 0,
  dlq_count         int default 0,

  -- Daily averages
  avg_latency_seconds numeric(10,2),
  avg_attempts      numeric(10,2),
  retry_rate_percent numeric(10,2),

  -- Success/Failure rates
  success_rate_percent numeric(10,2),
  permanent_bounce_count int default 0,
  complaint_count   int default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (tenant_id, channel, metric_date)
);

create index if not exists idx_daily_metrics_tenant on public.distribution_queue_daily_metrics(tenant_id, metric_date desc);
create index if not exists idx_daily_metrics_channel on public.distribution_queue_daily_metrics(channel, metric_date desc);

-- 4. Enable RLS
alter table public.distribution_queue_daily_metrics enable row level security;

drop policy if exists "daily_metrics_service_write" on public.distribution_queue_daily_metrics;
create policy "daily_metrics_service_write"
  on public.distribution_queue_daily_metrics for all
  to service_role
  using (true)
  with check (true);

-- 5. Helper: Compute and store daily metrics snapshot
create or replace function public.compute_daily_metrics(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
begin
  -- For each tenant/channel combination with activity in the date range
  for r in
    select distinct tenant_id, channel
      from public.distribution_queue_entries
     where created_at::date = p_date
  loop
    insert into public.distribution_queue_daily_metrics (
      tenant_id,
      channel,
      metric_date,
      enqueued_count,
      published_count,
      failed_count,
      avg_latency_seconds,
      avg_attempts,
      retry_rate_percent,
      success_rate_percent
    )
    select
      r.tenant_id,
      r.channel,
      p_date,
      count(*) filter (where created_at::date = p_date),
      count(*) filter (where published_at::date = p_date and status = 'published'),
      count(*) filter (where status = 'failed' and updated_at::date = p_date),
      round(extract(epoch from (avg(published_at - enqueued_at) filter (where published_at::date = p_date and status = 'published')))::numeric, 2),
      round(avg(attempts)::numeric, 2) filter (where published_at::date = p_date),
      round(100.0 * count(*) filter (where attempts > 1 and published_at::date = p_date) / nullif(count(*) filter (where published_at::date = p_date), 0), 2),
      round(100.0 * count(*) filter (where status = 'published' and published_at::date = p_date) / nullif(count(*) filter (where created_at::date = p_date), 0), 2)
    from public.distribution_queue_entries
    where tenant_id = r.tenant_id
      and channel = r.channel
    on conflict (tenant_id, channel, metric_date)
    do update set
      updated_at = now();
  end loop;
end;
$$;

revoke all on function public.compute_daily_metrics(date) from public;
grant execute on function public.compute_daily_metrics(date) to service_role;

-- 6. Helper: Get recent metrics for a tenant
create or replace function public.get_queue_metrics_recent(
  p_tenant_id uuid,
  p_days int default 7
)
returns table (
  channel text,
  metric_date date,
  enqueued_count int,
  published_count int,
  failed_count int,
  success_rate_percent numeric,
  avg_latency_seconds numeric
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return query
    select
      dqdm.channel,
      dqdm.metric_date,
      dqdm.enqueued_count,
      dqdm.published_count,
      dqdm.failed_count,
      dqdm.success_rate_percent,
      dqdm.avg_latency_seconds
    from public.distribution_queue_daily_metrics dqdm
    where dqdm.tenant_id = p_tenant_id
      and dqdm.metric_date >= current_date - (p_days || ' days')::interval
    order by dqdm.metric_date desc, dqdm.channel;
end;
$$;

revoke all on function public.get_queue_metrics_recent(uuid, int) from public;
grant execute on function public.get_queue_metrics_recent(uuid, int) to service_role;

comment on function public.compute_daily_metrics(date) is
  'Compute and persist daily queue metrics snapshot. Called nightly via cron.';
comment on function public.get_queue_metrics_recent(uuid, int) is
  'Retrieve recent daily metrics for a tenant (default 7 days). Used for dashboards/observability.';

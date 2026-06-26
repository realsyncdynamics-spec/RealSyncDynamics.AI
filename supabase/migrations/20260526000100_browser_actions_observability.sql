-- Browser Actions Observability
--
-- Tracking all browser-based governance actions (preview loads, scans, evidence generation)
-- for complete governance-runtime-logging with audit trail support.
--
-- Tables:
--   browser_actions    — each preview/scan/evidence action
--   evidence_events    — hash-based evidence correlation

-- ─── 1. browser_actions ──────────────────────────────────────────────────────

create table if not exists public.browser_actions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  actor_id         uuid,                    -- auth.users.id, nullable for system
  session_id       text not null,           -- browser session identifier

  -- Governance context
  workflow_id      uuid references public.workflows(id) on delete set null,
  run_id           uuid references public.workflow_runs(id) on delete set null,
  tool_name        text,                    -- e.g. 'scan', 'evidence_generate', 'preview_load'

  -- Action metadata
  browser_action   text not null check (browser_action in (
    'preview_load',
    'preview_error',
    'reload',
    'scan_start',
    'scan_complete',
    'evidence_generate',
    'open_external'
  )),

  status           text not null check (status in (
    'started',
    'completed',
    'failed',
    'blocked'
  )),

  url              text,                    -- target URL being previewed/scanned
  http_status      integer,                 -- HTTP status of the iframe load attempt

  -- Timing
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  duration_ms      integer,

  -- Evidence & Audit
  evidence_hash    text,                    -- SHA-256 of evidence payload
  evidence_size_bytes integer,

  -- Error handling
  error_message    text,
  error_code       text,

  -- Audit context
  browser_user_agent text,
  client_ip        text,

  -- Extensible metadata (GDPR-safe only)
  metadata         jsonb default '{}'::jsonb,

  created_at       timestamptz not null default now()
);

-- Indices for efficient querying
create index if not exists idx_browser_actions_tenant_time
  on public.browser_actions (tenant_id, started_at desc);

create index if not exists idx_browser_actions_session
  on public.browser_actions (session_id, started_at desc);

create index if not exists idx_browser_actions_workflow
  on public.browser_actions (workflow_id, started_at desc)
  where workflow_id is not null;

create index if not exists idx_browser_actions_actor
  on public.browser_actions (actor_id, started_at desc)
  where actor_id is not null;

create index if not exists idx_browser_actions_action_status
  on public.browser_actions (browser_action, status, started_at desc);

create index if not exists idx_browser_actions_evidence
  on public.browser_actions (evidence_hash)
  where evidence_hash is not null;

-- ─── 2. evidence_events (Enhanced for browser actions) ───────────────────────

-- Add browser_action_id foreign key to evidence_events if table exists
-- (it may not exist in all schema versions; soft-fail if table doesn't exist)
do $$
begin
  if to_regclass('public.evidence_events') is not null then
    alter table public.evidence_events
      add column if not exists browser_action_id uuid references public.browser_actions(id) on delete set null;

    create index if not exists idx_evidence_events_browser_action
      on public.evidence_events (browser_action_id)
      where browser_action_id is not null;
  end if;
end $$;

-- ─── 3. RLS Policies ─────────────────────────────────────────────────────────

alter table public.browser_actions enable row level security;

-- Tenant members can read browser actions from their tenant
drop policy if exists "browser_actions tenant-read" on public.browser_actions;
create policy "browser_actions tenant-read"
  on public.browser_actions for select
  using (public.is_tenant_member(tenant_id));

-- Service role (Edge Functions) can insert
-- Default RLS denies INSERT/UPDATE for regular users

-- ─── 4. View: browser_actions with correlation data ─────────────────────────

create or replace view public.browser_actions_with_context as
select
  ba.id,
  ba.tenant_id,
  ba.actor_id,
  ba.session_id,
  ba.browser_action,
  ba.status,
  ba.url,
  ba.duration_ms,
  ba.evidence_hash,
  ba.error_message,
  ba.started_at,
  ba.completed_at,

  -- Correlation
  wf.id as workflow_id,
  wf.title as workflow_name,
  wr.id as run_id,
  wr.status as run_status,

  -- User context (GDPR-safe denormalization)
  case
    when ba.actor_id is not null
    then (select count(1) from public.browser_actions where actor_id = ba.actor_id)
    else 0
  end as actor_action_count,

  -- Evidence trail
  (select count(1) from public.evidence_events where browser_action_id = ba.id) as evidence_count

from public.browser_actions ba
left join public.workflows wf on wf.id = ba.workflow_id
left join public.workflow_runs wr on wr.id = ba.run_id;

comment on view public.browser_actions_with_context is
  'Browser actions enriched with workflow, run, and evidence context for governance dashboards.';

-- ─── 5. Comments & Documentation ────────────────────────────────────────────

comment on table public.browser_actions is
  'Complete observability for browser-based governance actions (preview, scan, evidence). Audit trail with evidence correlation. Tenant-scoped RLS.';

comment on column public.browser_actions.browser_action is
  'Action type: preview_load, preview_error, scan_start, scan_complete, evidence_generate, open_external.';

comment on column public.browser_actions.evidence_hash is
  'SHA-256 of evidence payload for audit trail and deduplication.';

comment on column public.browser_actions.duration_ms is
  'Wall-clock milliseconds from started_at to completed_at. NULL while in progress.';

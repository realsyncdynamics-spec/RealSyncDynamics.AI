-- Agent Browser Sessions — autonomous agent browsing with policy enforcement
--
-- Tracks browser sessions initiated by AI agents, including:
--   - Agent identity + permissions
--   - Policy enforcement (URL whitelist, action types)
--   - Evidence collection (screenshots, HAR, custody)
--   - Audit trail (each action logged separately)
--
-- Integrates with:
--   ai_tool_runs       (for cost/quota tracking)
--   browser_actions    (for individual browser events)
--   evidence_vault     (for persistent evidence storage + C2PA)
--   ai_policies        (for governance rules)

-- ─── 1. Agent Browser Sessions ─────────────────────────────────────────────────

create table if not exists public.agent_browser_sessions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,

  -- Agent context
  agent_id         text not null,                -- e.g., 'hermes-01', 'compliance-bot-v2'
  agent_run_id     text references public.enterprise_agent_runs(id) on delete set null,
  tool_run_id      uuid references public.ai_tool_runs(id) on delete set null,

  -- Session metadata
  session_key      text not null unique,         -- UUID-based session identifier
  status           text not null check (status in (
    'pending',
    'initializing',
    'active',
    'completed',
    'failed',
    'blocked'
  )),

  -- Browsing context
  initial_url      text not null,
  current_url      text,
  referrer_url     text,

  -- Policy enforcement
  policy_id        uuid references public.ai_policies(id) on delete set null,
  policy_check_passed boolean,
  policy_violation_reason text,

  -- Session lifecycle
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  timeout_seconds  integer default 300,
  duration_ms      integer,

  -- Evidence collection
  screenshot_count integer default 0,
  har_log_hash     text,                        -- SHA-256 of HAR file
  evidence_items   integer default 0,           -- count of evidence items in vault

  -- Metadata (safe for governance audit)
  action_count     integer default 0,
  blocked_actions  integer default 0,
  metadata         jsonb default '{}'::jsonb,
  error_message    text,
  error_code       text,

  -- Audit trail
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_agent_browser_sessions_tenant
  on public.agent_browser_sessions (tenant_id, started_at desc);

create index if not exists idx_agent_browser_sessions_agent
  on public.agent_browser_sessions (agent_id, started_at desc);

create index if not exists idx_agent_browser_sessions_status
  on public.agent_browser_sessions (status);

create index if not exists idx_agent_browser_sessions_session_key
  on public.agent_browser_sessions (session_key);

create index if not exists idx_agent_browser_sessions_policy
  on public.agent_browser_sessions (policy_id)
  where policy_id is not null;

-- ─── 2. Agent Browser Actions ─────────────────────────────────────────────────
-- Fine-grained audit trail for each action within a session

create table if not exists public.agent_browser_actions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  session_id       uuid not null references public.agent_browser_sessions(id) on delete cascade,

  -- Action details
  action_type      text not null check (action_type in (
    'navigate',
    'click',
    'fill_form',
    'submit_form',
    'extract_data',
    'take_screenshot',
    'wait_for_element',
    'scroll',
    'get_page_title',
    'get_text_content',
    'evaluate_script'
  )),

  action_target    text,                        -- CSS selector, URL, element XPath
  action_value     text,                        -- input text, script code, etc.

  -- Execution
  status           text not null check (status in ('success', 'failed', 'blocked', 'timeout')),
  executed_at      timestamptz not null default now(),
  duration_ms      integer,

  -- Evidence from action
  screenshot_hash  text,                        -- SHA-256 if screenshot taken
  page_state       jsonb,                       -- {url, title, text_content_preview}
  extracted_data   jsonb,                       -- results from extract_data actions

  -- Policy enforcement
  policy_check_passed boolean,
  policy_reason    text,

  -- Error handling
  error_message    text,
  error_code       text,

  -- Metadata
  metadata         jsonb default '{}'::jsonb,

  created_at       timestamptz not null default now()
);

create index if not exists idx_agent_browser_actions_session
  on public.agent_browser_actions (session_id, executed_at desc);

create index if not exists idx_agent_browser_actions_tenant
  on public.agent_browser_actions (tenant_id, executed_at desc);

create index if not exists idx_agent_browser_actions_type
  on public.agent_browser_actions (action_type);

-- ─── 3. Agent Browser Policy Rules ────────────────────────────────────────────
-- Governance rules for which agents can browse which URLs

create table if not exists public.agent_browser_policies (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,

  -- Policy metadata
  name             text not null,
  description      text,
  enabled          boolean default true,

  -- Scope: which agents does this apply to?
  applies_to_agents text[] not null,            -- agent_id patterns (e.g., ['hermes-*', 'compliance-*'])

  -- URL restrictions
  allowed_domains  text[] default '{}',         -- ['example.com', 'api.*.com'] — null = all
  blocked_domains  text[] default '{}',         -- explicit blocklist
  allow_subdomains boolean default true,

  -- Action restrictions
  allowed_actions  text[] default '{}',         -- empty = all allowed
  blocked_actions  text[] default '{}',

  -- Risk controls
  require_approval boolean default false,       -- manual approval before browsing
  screenshot_every_action boolean default true,
  capture_har      boolean default false,
  max_concurrent_sessions integer default 5,
  max_session_duration_seconds integer default 600,

  -- Audit
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_agent_browser_policies_tenant_enabled
  on public.agent_browser_policies (tenant_id, enabled);

-- ─── 4. RLS Policies ──────────────────────────────────────────────────────────

alter table public.agent_browser_sessions enable row level security;
alter table public.agent_browser_actions enable row level security;
alter table public.agent_browser_policies enable row level security;

-- Tenant members can read their browser sessions and actions
drop policy if exists "agent_browser_sessions tenant-read" on public.agent_browser_sessions;
create policy "agent_browser_sessions tenant-read"
  on public.agent_browser_sessions for select
  using (public.is_tenant_member(tenant_id));

drop policy if exists "agent_browser_actions tenant-read" on public.agent_browser_actions;
create policy "agent_browser_actions tenant-read"
  on public.agent_browser_actions for select
  using (public.is_tenant_member(tenant_id));

drop policy if exists "agent_browser_policies tenant-read" on public.agent_browser_policies;
create policy "agent_browser_policies tenant-read"
  on public.agent_browser_policies for select
  using (public.is_tenant_member(tenant_id));

-- Service role can insert/update (Edge Functions)
-- Default RLS denies regular users from INSERT/UPDATE

-- ─── 5. View: Agent Browser Session Context ───────────────────────────────────

create or replace view public.agent_browser_sessions_with_context as
select
  abs.id,
  abs.tenant_id,
  abs.agent_id,
  abs.agent_run_id,
  abs.session_key,
  abs.status,
  abs.initial_url,
  abs.current_url,
  abs.policy_check_passed,
  abs.policy_violation_reason,
  abs.duration_ms,
  abs.action_count,
  abs.blocked_actions,
  abs.screenshot_count,
  abs.started_at,
  abs.completed_at,

  -- Policy context
  abp.name as policy_name,
  abp.require_approval,

  -- Action audit
  (select count(*) from public.agent_browser_actions
   where session_id = abs.id and status = 'blocked') as total_blocked_actions,

  -- Evidence stats
  abs.evidence_items

from public.agent_browser_sessions abs
left join public.agent_browser_policies abp on abp.id = abs.policy_id;

comment on view public.agent_browser_sessions_with_context is
  'Agent browser sessions enriched with policy and action audit context for governance dashboards.';

-- ─── 6. Comments & Documentation ──────────────────────────────────────────────

comment on table public.agent_browser_sessions is
  'Tracks autonomous agent browsing sessions. Integrates with ai_tool_runs for billing, browser_actions for events, evidence_vault for custody.';

comment on column public.agent_browser_sessions.session_key is
  'UUID-based session identifier for browser context isolation. Used to correlate with Playwright browser session.';

comment on column public.agent_browser_sessions.policy_check_passed is
  'Boolean result of policy enforcement check. If false, session may be blocked or require approval.';

comment on column public.agent_browser_sessions.har_log_hash is
  'SHA-256 of HTTP Archive (HAR) log for evidence chain. Stored separately in evidence_vault.';

comment on table public.agent_browser_actions is
  'Audit trail of individual browser actions (navigate, click, extract) performed by agent within a session.';

comment on column public.agent_browser_actions.screenshot_hash is
  'SHA-256 of screenshot taken during action. Full image stored in evidence_vault or S3.';

comment on column public.agent_browser_actions.page_state is
  'Snapshot of page state after action: URL, title, text content preview for audit trail.';

comment on table public.agent_browser_policies is
  'Governance rules determining which agents can browse which URLs and perform which actions.';

comment on column public.agent_browser_policies.applies_to_agents is
  'Agent ID patterns (e.g., ''hermes-*'', ''compliance-bot-v2''). Matched at runtime during policy check.';

comment on column public.agent_browser_policies.allowed_domains is
  'Whitelist of domains agent can browse. Empty array = no restriction. Supports wildcards (api.*.example.com).';

comment on column public.agent_browser_policies.allowed_actions is
  'Whitelist of action types permitted (navigate, click, extract_data, etc.). Empty = all allowed.';

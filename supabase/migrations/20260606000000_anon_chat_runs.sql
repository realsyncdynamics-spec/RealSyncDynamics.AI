-- anon_chat_runs — Security-Gate audit log for public/anon governance-agent path.
--
-- Context: governance-agent (supabase/functions/governance-agent/index.ts)
-- supports four anon operations (chat_anon, start_audit_scan, explain_finding,
-- generate_fix_snippet). The first triggers a real LLM call (potentially with
-- US-routing acknowledgement); the others return mock responses but still
-- consume rate-limit budget. Without an audit trail, the existing tenant-mode
-- audit() pathway is bypassed for every anon request — making cost,
-- US-routing, and abuse pattern reconstruction impossible.
--
-- This table provides the minimal audit substrate. runtime_events cannot be
-- reused as-is: its tenant_id column is NOT NULL (see 20260516300000_runtime_core.sql).
-- Adding NULL-tenant support there would broaden the runtime_events contract
-- beyond the kernel-v1 scope, so we keep anon telemetry in a dedicated table.
--
-- A follow-up (P2-impl-2 HMAC helper) will swap raw sha256(ip) for HMAC-keyed
-- subject_ref derivation, enabling DSGVO Art. 17 deletion of anon traces.

create table if not exists public.anon_chat_runs (
  id                      bigserial primary key,
  occurred_at             timestamptz not null default now(),
  -- Stable correlation token returned to no one; lets us join start/end
  -- updates and reconstruct request flow in incident review.
  request_id              uuid not null unique,
  op                      text not null,
  -- IP hash today is sha256(x-forwarded-for-first). Will become HMAC-keyed
  -- subject_ref after P2-impl-2; column name stays for forward-compat.
  ip_hash                 text not null,
  user_agent_hash         text,
  outcome                 text not null,
  -- LLM-specific (NULL for non-LLM tools)
  model                   text,
  input_tokens            int,
  output_tokens           int,
  acknowledge_us_routing  boolean,
  -- chat_anon-specific
  session_id              text,
  -- Optional joinable to runtime_events.correlation_id later
  correlation_id          uuid,
  -- Names of top-level body keys present (NEVER values — anti-leak)
  payload_keys            text[],
  error_code              text,
  duration_ms             int
);

-- Whitelists kept in sync with the dispatcher in
-- supabase/functions/governance-agent/index.ts (handleChatAnon, handleStartAuditScanAnon,
-- handleExplainFindingAnon, handleGenerateFixSnippetAnon).
alter table public.anon_chat_runs
  drop constraint if exists anon_chat_runs_op_check;
alter table public.anon_chat_runs
  add constraint anon_chat_runs_op_check
  check (op in (
    'chat_anon',
    'start_audit_scan',
    'explain_finding',
    'generate_fix_snippet'
  ));

alter table public.anon_chat_runs
  drop constraint if exists anon_chat_runs_outcome_check;
alter table public.anon_chat_runs
  add constraint anon_chat_runs_outcome_check
  check (outcome in (
    'pending',       -- reserved before work, never returned by completion path
    'success',
    'error',
    'rate_limited',
    'blocked'        -- audit-write-failure aside; reserved for future policy blocks
  ));

create index if not exists anon_chat_runs_time_idx
  on public.anon_chat_runs (occurred_at desc);

create index if not exists anon_chat_runs_ip_time_idx
  on public.anon_chat_runs (ip_hash, occurred_at desc);

create index if not exists anon_chat_runs_op_time_idx
  on public.anon_chat_runs (op, occurred_at desc);

-- Outcomes other than success are the high-signal incident-review surface.
create index if not exists anon_chat_runs_outcome_idx
  on public.anon_chat_runs (outcome, occurred_at desc)
  where outcome in ('error','rate_limited','blocked');

-- RLS deny-by-default. Service role bypasses RLS; that is the only writer.
-- No tenant-scoped read because there is no tenant. Future operator-read
-- pathway will be an RBAC-protected SECURITY DEFINER RPC, not a policy here.
alter table public.anon_chat_runs enable row level security;

drop policy if exists "anon_chat_runs service-role only" on public.anon_chat_runs;
create policy "anon_chat_runs service-role only"
  on public.anon_chat_runs for all
  using (false) with check (false);

comment on table public.anon_chat_runs is
  'Security-gate audit log for governance-agent anon path. Every anon request MUST produce a row before the handler may proceed. Service-role-only writes; no tenant read pathway.';

comment on column public.anon_chat_runs.request_id is
  'Generated server-side per request. Used to update outcome/tokens after work completes. Never echoed to the client.';

comment on column public.anon_chat_runs.ip_hash is
  'sha256 of x-forwarded-for[0] today. Will become HMAC-keyed subject_ref via P2-impl-2.';

comment on column public.anon_chat_runs.payload_keys is
  'Top-level body keys present in the request — for shape diagnostics. NEVER stores values.';

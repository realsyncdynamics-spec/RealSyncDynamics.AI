-- AI Governance Core — initial schema for AI Systems Registry,
-- Policy Engine, Evidence Vault, Runtime Telemetry and Retention.
--
-- Diese Datei buendelt vier urspruenglich getrennte Migrationen, die
-- alle den Versions-Prefix 20260510 trugen und deshalb von der Supabase
-- CLI als eine einzige Version interpretiert werden. Inhalt ist
-- vollstaendig idempotent (CREATE ... IF NOT EXISTS, ON CONFLICT DO
-- NOTHING, ALTER TABLE ADD COLUMN IF NOT EXISTS, DROP TRIGGER IF
-- EXISTS, CREATE OR REPLACE FUNCTION/VIEW), damit Re-Apply gegen ein
-- bereits teilweise migriertes Schema folgenlos bleibt.

-- ─── 1. Core tables (AI Systems Registry / Policy Engine / Evidence) ─────────

create table if not exists ai_systems (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  vendor text,
  model_name text,
  department text,
  owner_email text,
  purpose text,
  data_types text[] default '{}',
  ai_act_class text check (
    ai_act_class in ('minimal', 'limited', 'high', 'prohibited', 'unknown')
  ) default 'unknown',
  risk_score int default 0 check (risk_score >= 0 and risk_score <= 100),
  status text check (
    status in ('draft', 'active', 'under_review', 'approved', 'archived')
  ) default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ai_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  description text,
  severity text check (severity in ('low', 'medium', 'high', 'critical')) default 'medium',
  rule_type text check (
    rule_type in ('data_transfer', 'model_usage', 'human_review', 'logging_required', 'vendor_restriction')
  ) not null,
  condition jsonb default '{}',
  action text check (action in ('allow', 'warn', 'block', 'require_approval')) default 'warn',
  enabled boolean default true,
  created_at timestamptz default now()
);

create table if not exists ai_evidence_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  ai_system_id uuid references ai_systems(id) on delete set null,
  policy_id uuid references ai_policies(id) on delete set null,
  event_type text not null,
  event_summary text not null,
  risk_level text check (risk_level in ('info', 'low', 'medium', 'high', 'critical')) default 'info',
  evidence jsonb default '{}',
  created_at timestamptz default now()
);

alter table ai_systems enable row level security;
alter table ai_policies enable row level security;
alter table ai_evidence_events enable row level security;

create index if not exists ai_systems_tenant_id_idx        on ai_systems (tenant_id);
create index if not exists ai_policies_tenant_id_idx       on ai_policies (tenant_id);
create index if not exists ai_evidence_events_tenant_id_idx
  on ai_evidence_events (tenant_id, created_at desc);
create index if not exists ai_evidence_events_ai_system_id_idx
  on ai_evidence_events (ai_system_id);
create index if not exists ai_evidence_events_policy_id_idx
  on ai_evidence_events (policy_id);

-- ─── 2. Global demo policies (Policy Engine seed) ────────────────────────────

insert into ai_policies (
  id, tenant_id, name, description, severity, rule_type, action, condition, enabled
) values (
  '00000000-0000-0000-0000-00000000a001',
  null,
  'Keine personenbezogenen Daten an externe LLMs',
  'Personenbezogene oder besonders kategorisierte Daten (Art. 9 DSGVO) duerfen nicht an OpenAI, Anthropic, Google oder Perplexity uebertragen werden.',
  'critical',
  'data_transfer',
  'block',
  '{"data_classes": ["personal_data", "special_category"], "to_external_vendor": true}'::jsonb,
  true
)
on conflict (id) do nothing;

insert into ai_policies (
  id, tenant_id, name, description, severity, rule_type, action, condition, enabled
) values (
  '00000000-0000-0000-0000-00000000a002',
  null,
  'Human Review fuer High-Risk AI-Output',
  'Bei high- oder critical-risk Events ist eine dokumentierte menschliche Pruefung erforderlich, bevor das AI-Ergebnis Wirkung entfaltet.',
  'high',
  'human_review',
  'require_approval',
  '{"risk_levels": ["high", "critical"]}'::jsonb,
  true
)
on conflict (id) do nothing;

insert into ai_policies (
  id, tenant_id, name, description, severity, rule_type, action, condition, enabled
) values (
  '00000000-0000-0000-0000-00000000a003',
  null,
  'Audit-Log fuer Agent-Actions',
  'Agentische Aktionen (event_type=agent_action oder tool_call) werden im Evidence-Vault festgehalten und im Dashboard markiert.',
  'medium',
  'logging_required',
  'warn',
  '{"event_types": ["agent_action", "tool_call"]}'::jsonb,
  true
)
on conflict (id) do nothing;

-- ─── 3. Runtime telemetry (ai_runtime_events) ────────────────────────────────

create table if not exists ai_runtime_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  ai_system_id uuid references ai_systems(id) on delete set null,

  vendor text,
  model text,
  user_id text,
  team text,

  event_type text not null check (event_type in (
    'prompt_sent', 'response_received', 'agent_action',
    'file_upload', 'tool_call', 'session_start', 'session_end'
  )),
  prompt_category text check (prompt_category in (
    'code_generation', 'content_generation', 'classification',
    'summarization', 'translation', 'extraction', 'agent_action',
    'analysis', 'qa', 'unknown'
  )) default 'unknown',
  data_class text check (data_class in (
    'public', 'internal', 'confidential', 'personal_data', 'special_category', 'unknown'
  )) default 'unknown',

  risk_level text not null check (risk_level in (
    'info', 'low', 'medium', 'high', 'critical'
  )) default 'info',
  policy_status text check (policy_status in (
    'allowed', 'warned', 'blocked', 'requires_approval', 'logged'
  )) default 'logged',
  policy_id uuid references ai_policies(id) on delete set null,

  prompt_tokens int,
  response_tokens int,
  latency_ms int,

  metadata jsonb default '{}',

  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table ai_runtime_events enable row level security;

-- Patch CHECK constraint for tables created before 'unknown' was added to the
-- allowed data_class set. The Edge Function telemetry-ai-event defaults
-- missing data_class to 'unknown' (and clients pass it explicitly), so the
-- pre-existing constraint rejected real-world inserts.
alter table ai_runtime_events
  drop constraint if exists ai_runtime_events_data_class_check;
alter table ai_runtime_events
  add constraint ai_runtime_events_data_class_check
  check (data_class in (
    'public', 'internal', 'confidential', 'personal_data', 'special_category', 'unknown'
  ));

create index if not exists ai_runtime_events_tenant_idx
  on ai_runtime_events (tenant_id, occurred_at desc);
create index if not exists ai_runtime_events_ai_system_idx
  on ai_runtime_events (ai_system_id);
create index if not exists ai_runtime_events_vendor_idx
  on ai_runtime_events (tenant_id, vendor, occurred_at desc);
create index if not exists ai_runtime_events_risk_idx
  on ai_runtime_events (tenant_id, risk_level, occurred_at desc)
  where risk_level in ('high', 'critical');
create index if not exists ai_runtime_events_policy_status_idx
  on ai_runtime_events (tenant_id, policy_status, occurred_at desc)
  where policy_status in ('warned', 'blocked', 'requires_approval');

-- ─── 4. Evidence vault hash-chain + retention ────────────────────────────────

create extension if not exists pgcrypto;

alter table ai_evidence_events
  add column if not exists event_hash bytea,
  add column if not exists prev_hash bytea,
  add column if not exists chain_index bigint;

create index if not exists ai_evidence_events_chain_tip_idx
  on ai_evidence_events (tenant_id, chain_index desc)
  where event_hash is not null;

create or replace function tg_evidence_event_chain()
returns trigger
language plpgsql
as $$
declare
  prev_record record;
  payload bytea;
  tenant_lock_key text;
begin
  if new.event_hash is not null then
    return new;
  end if;

  tenant_lock_key := 'evidence_chain:' || coalesce(new.tenant_id::text, 'global');
  perform pg_advisory_xact_lock(hashtextextended(tenant_lock_key, 0));

  select event_hash, chain_index
  into prev_record
  from ai_evidence_events
  where (tenant_id is not distinct from new.tenant_id)
    and event_hash is not null
  order by chain_index desc
  limit 1;

  new.prev_hash := prev_record.event_hash;
  new.chain_index := coalesce(prev_record.chain_index, 0) + 1;

  payload :=
       coalesce(new.prev_hash, ''::bytea)
    || convert_to(new.id::text, 'UTF8')
    || convert_to(coalesce(new.created_at::text, now()::text), 'UTF8')
    || convert_to(new.event_type, 'UTF8')
    || convert_to(new.event_summary, 'UTF8')
    || convert_to(coalesce(new.evidence::text, '{}'), 'UTF8');

  new.event_hash := digest(payload, 'sha256');

  return new;
end;
$$;

drop trigger if exists ai_evidence_events_chain_tg on ai_evidence_events;
create trigger ai_evidence_events_chain_tg
  before insert on ai_evidence_events
  for each row
  execute function tg_evidence_event_chain();

create table if not exists ai_evidence_retention (
  tenant_id uuid primary key,
  retention_days int not null default 2555
    check (retention_days >= 30),
  hard_delete_after_days int not null default 3650
    check (hard_delete_after_days >= 90),
  policy_note text,
  updated_at timestamptz not null default now()
);

alter table ai_evidence_retention enable row level security;

create or replace view ai_evidence_retention_status as
select
  e.id,
  e.tenant_id,
  e.created_at,
  coalesce(r.retention_days, 2555) as retention_days,
  coalesce(r.hard_delete_after_days, 3650) as hard_delete_after_days,
  e.created_at + (coalesce(r.retention_days, 2555) || ' days')::interval as soft_delete_at,
  e.created_at + (coalesce(r.hard_delete_after_days, 3650) || ' days')::interval as hard_delete_at
from ai_evidence_events e
left join ai_evidence_retention r on r.tenant_id = e.tenant_id;

-- AI Governance Core — initial schema for AI Systems Registry,
-- Policy Engine and Evidence Vault.
--
-- Diese Tabellen sind das Datenfundament fuer das AI-Governance-OS.
-- Die /ai-governance-Page rendert in dieser Iteration noch statische
-- Demo-Daten aus src/features/ai-governance/demoData.ts — die Tabellen
-- sind vorhanden, damit Folge-PRs (Runtime-Telemetry, Policy-Enforcement,
-- Browser-Extension) dagegen schreiben koennen.
--
-- RLS ist auf allen Tabellen aktiv. Konkrete Policies werden in einem
-- Folge-Migration ergaenzt, sobald Auth-Gating greift. Bis dahin verbietet
-- RLS jeden Zugriff von anon/authenticated Rollen — nur Service-Role kann
-- die Tabellen lesen/schreiben (z.B. Edge-Functions).

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

-- Indexes fuer typische Queries (Tenant-Filter + Zeit-Range bei Audit-Trail).
create index if not exists ai_systems_tenant_id_idx        on ai_systems (tenant_id);
create index if not exists ai_policies_tenant_id_idx       on ai_policies (tenant_id);
create index if not exists ai_evidence_events_tenant_id_idx
  on ai_evidence_events (tenant_id, created_at desc);
create index if not exists ai_evidence_events_ai_system_id_idx
  on ai_evidence_events (ai_system_id);
create index if not exists ai_evidence_events_policy_id_idx
  on ai_evidence_events (policy_id);

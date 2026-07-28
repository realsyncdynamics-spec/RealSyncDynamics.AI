-- Schema-Skizze für das Governance-Backend (Supabase/Postgres).
--
-- Status: noch nicht aktiv genutzt — die Services laufen gegen einen
-- In-Memory-Store. Diese Datei definiert das Zielschema für den Umstieg.
--
-- Konvention (RealSyncDynamics): jede Tabelle mit Mandantenbezug hat
-- tenant_id + RLS-Policy. Service-Role-Zugriff ausschließlich aus Backends.

create extension if not exists "pgcrypto";

-- Registry: alle registrierten KI-Projekte ---------------------------------

create table if not exists governance_projects (
  project_id           text primary key,
  tenant_id            uuid not null default gen_random_uuid(),
  project_name         text not null,
  description          text not null default '',
  risk_tier            text not null check (risk_tier in ('minimal','limited','high','unacceptable')),
  required_gates       text[] not null default '{}',
  data_types           text[] not null default '{}',
  data_subjects        text[] not null default '{}',
  models               text[] not null default '{}',
  llm_provider         text,
  jurisdiction         text not null default 'eu',
  tags                 jsonb not null default '{}'::jsonb,
  status               text not null default 'registered'
                       check (status in ('registered','active','retired')),
  endpoint             text,
  deployment_timestamp timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_governance_projects_tenant on governance_projects(tenant_id);
create index if not exists idx_governance_projects_tier on governance_projects(risk_tier);

-- Prüfpfad: jede Gate-Entscheidung, unveränderlich --------------------------

create table if not exists governance_gate_checks (
  id           uuid primary key default gen_random_uuid(),
  project_id   text not null references governance_projects(project_id) on delete cascade,
  tenant_id    uuid not null,
  build_hash   text not null,
  status       text not null check (status in ('approved','warning','blocked')),
  severity     text check (severity in ('low','medium','high')),
  reason       text,
  remediation  text,
  artifacts    jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_gate_checks_project on governance_gate_checks(project_id, created_at desc);

-- Laufzeit-Telemetrie -------------------------------------------------------

create table if not exists governance_runtime_events (
  id            uuid primary key default gen_random_uuid(),
  project_id    text not null references governance_projects(project_id) on delete cascade,
  tenant_id     uuid not null,
  event_type    text not null,
  model_version text,
  region        text,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_runtime_events_project on governance_runtime_events(project_id, created_at desc);

-- RLS -----------------------------------------------------------------------
-- Jede Tabelle mandantengetrennt; Anwendungszugriff nur auf eigenen Tenant.

alter table governance_projects      enable row level security;
alter table governance_gate_checks   enable row level security;
alter table governance_runtime_events enable row level security;

-- TODO(RLS): tenant_id-Auflösung an das bestehende `tenants`-Mapping der
-- Hauptplattform angleichen (profiles.tenant_id statt auth.uid()-Direktvergleich).
create policy governance_projects_tenant_read on governance_projects
  for select using (tenant_id::text = current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id');

create policy gate_checks_tenant_read on governance_gate_checks
  for select using (tenant_id::text = current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id');

create policy runtime_events_tenant_read on governance_runtime_events
  for select using (tenant_id::text = current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id');

-- Schreibzugriff erfolgt ausschließlich über die Service-Role (Backends),
-- die RLS umgeht — deshalb bewusst keine INSERT/UPDATE-Policies für Nutzer.

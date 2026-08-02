-- Task-Graphen des Builder-Orchestrators.
--
-- Wiederholbar: Das Backend wendet die Migration bei jedem Start an.
--
-- Wichtige Entscheidung: Tasks liegen in **eigenen Zeilen**, nicht als ein
-- JSONB-Blob am Graphen. Der Scheduler führt Tasks nebenläufig aus; jede
-- schreibt nur ihren eigenen Status. Läge der ganze Graph in einer Spalte,
-- würde von zwei gleichzeitig fertig werdenden Coder-Tasks die zuletzt
-- schreibende die Statusänderung der anderen überschreiben (lost update).
-- Task-granulare Zeilen machen das Problem strukturell unmöglich, ohne dass
-- irgendwo gesperrt werden muss.

create extension if not exists "pgcrypto";

create table if not exists builder_task_graphs (
  project_id  text primary key,
  tenant_id   uuid not null,
  cancelled   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists builder_agent_tasks (
  project_id      text not null references builder_task_graphs(project_id) on delete cascade,
  task_id         text not null,
  tenant_id       uuid not null,
  agent_type      text not null,
  status          text not null default 'pending'
                  check (status in ('pending','running','completed','failed','blocked')),
  input           jsonb not null default '{}'::jsonb,
  output          jsonb,
  depends_on      text[] not null default '{}',
  attempt         integer not null default 0,
  max_attempts    integer not null default 3,
  timeout_seconds double precision not null default 120,
  idempotency_key text,
  otel_carrier    jsonb not null default '{}'::jsonb,
  -- Reihenfolge der Anlage, damit der Graph stabil zurückgelesen wird.
  position        bigserial,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (project_id, task_id)
);

create index if not exists idx_builder_tasks_project on builder_agent_tasks(project_id, position);
create index if not exists idx_builder_tasks_offen on builder_agent_tasks(project_id)
  where status in ('pending','running');

-- RLS -----------------------------------------------------------------------
-- Schreibzugriff läuft ausschließlich über die Service-Role, die RLS umgeht;
-- deshalb bewusst nur Lese-Policies.

alter table builder_task_graphs enable row level security;
alter table builder_agent_tasks enable row level security;

drop policy if exists builder_graphs_tenant_read on builder_task_graphs;
create policy builder_graphs_tenant_read on builder_task_graphs
  for select using (tenant_id::text = current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id');

drop policy if exists builder_tasks_tenant_read on builder_agent_tasks;
create policy builder_tasks_tenant_read on builder_agent_tasks
  for select using (tenant_id::text = current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id');

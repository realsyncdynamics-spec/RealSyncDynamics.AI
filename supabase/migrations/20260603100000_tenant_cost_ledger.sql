-- tenant_cost_ledger — P4-impl-1 of the Operational Governance Kernel RFC
-- (docs/architecture/runtime-kernel-rfc.md §P4.2).
--
-- NICHT Stripe-Billing. NICHT Invoice-Generation. Es ist internal
-- runtime-financial observability: wer was kostet, attribuiert pro
-- Agent / Flow / Tenant. Public Dashboards lesen NICHT diese Tabelle.
--
-- ADDITIVE. Neue Tabelle, eigene RLS, kein Eingriff in bestehende Schemas.
-- Writer (Cost-Writer in LLM-Provider-Wrappern) folgt in P4-impl-2.

create table if not exists public.tenant_cost_ledger (
  id              bigserial primary key,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  occurred_at     timestamptz not null default now(),
  -- Attribution
  agent_ref       text,
  flow_ref        text,
  trace_id        uuid,
  correlation_id  uuid,
  -- Cost-Dimension
  cost_kind       text not null
                    check (cost_kind in (
                      'llm_input', 'llm_output', 'storage_gb_hour',
                      'edge_invocation', 'webhook_egress', 'replay_simulation'
                    )),
  units           numeric(18,6) not null,
  unit_price_usd  numeric(12,8) not null,
  amount_usd      numeric(14,6) not null generated always as (units * unit_price_usd) stored,
  vendor          text,
  model_ref       text,
  -- Replay-Guard (RFC §P4.5): is_simulated=true Rows fließen NICHT in Cap-Aggregate
  is_simulated    boolean not null default false,
  replay_run_id   uuid,
  raw_metadata    jsonb default '{}'::jsonb,
  -- Invariante: is_simulated=true ⇒ replay_run_id muss gesetzt sein.
  -- is_simulated=false ⇒ replay_run_id muss NULL sein.
  constraint tenant_cost_ledger_replay_consistency_check check (
    (is_simulated = true and replay_run_id is not null)
    or (is_simulated = false and replay_run_id is null)
  )
);

-- Tenant-Timeline (Cost-Dashboard pro Tenant über Zeit).
create index if not exists tenant_cost_ledger_tenant_time_idx
  on public.tenant_cost_ledger (tenant_id, occurred_at desc);

-- Trace-Walk: Join zu runtime_events.trace_id für End-to-End-Kostenattribution
-- pro Flow.
create index if not exists tenant_cost_ledger_trace_idx
  on public.tenant_cost_ledger (trace_id)
  where trace_id is not null;

-- Agent-Attribution pro Tenant: welcher Agent hat in welchem Zeitraum
-- am meisten Kosten verursacht.
create index if not exists tenant_cost_ledger_agent_idx
  on public.tenant_cost_ledger (tenant_id, agent_ref, occurred_at desc);

-- Replay-Simulationen: separate Aggregation für Replay-Cost-Vergleiche
-- (Original ↔ Shadow). Partial Index — nur die simulierten Rows.
create index if not exists tenant_cost_ledger_simulated_idx
  on public.tenant_cost_ledger (replay_run_id)
  where is_simulated = true;

alter table public.tenant_cost_ledger enable row level security;

-- Tenant-Read: Nur Mitglieder des Tenants dürfen ihre Cost-Zeilen sehen.
drop policy if exists "tenant_cost_ledger tenant-read" on public.tenant_cost_ledger;
create policy "tenant_cost_ledger tenant-read"
  on public.tenant_cost_ledger for select
  using (public.is_tenant_member(tenant_id));

-- Insert blockiert für alle Rollen außer service-role.
-- service-role bypasst RLS per Default — d. h. nur Edge Functions mit
-- service-role-Key schreiben in den Ledger. Frontend-Code kann nicht.
drop policy if exists "tenant_cost_ledger service-role-write" on public.tenant_cost_ledger;
create policy "tenant_cost_ledger service-role-write"
  on public.tenant_cost_ledger for insert with check (false);

-- Updates und Deletes explizit verbieten — Ledger ist append-only.
-- Retention läuft über Partitionierung / Archive in einer späteren Phase.
drop policy if exists "tenant_cost_ledger no-update" on public.tenant_cost_ledger;
create policy "tenant_cost_ledger no-update"
  on public.tenant_cost_ledger for update using (false) with check (false);

drop policy if exists "tenant_cost_ledger no-delete" on public.tenant_cost_ledger;
create policy "tenant_cost_ledger no-delete"
  on public.tenant_cost_ledger for delete using (false);

comment on table public.tenant_cost_ledger is
  'Internal runtime-financial observability. Append-only. NOT Stripe billing. See runtime-kernel-rfc.md §P4.';

comment on column public.tenant_cost_ledger.cost_kind is
  'Cost dimension: llm_input/llm_output (tokens), storage_gb_hour, edge_invocation, webhook_egress, replay_simulation.';

comment on column public.tenant_cost_ledger.amount_usd is
  'Generated column = units * unit_price_usd. Stored for query speed and cap aggregates.';

comment on column public.tenant_cost_ledger.is_simulated is
  'True iff this row was produced by a shadow_replay run. Cap-aggregates MUST exclude is_simulated=true rows. See runtime-kernel-rfc.md §P4.5.';

comment on column public.tenant_cost_ledger.replay_run_id is
  'Set iff is_simulated=true. Joins with shadow_runtime_events for replay diff. NULL for live rows.';

comment on column public.tenant_cost_ledger.trace_id is
  'Joinable to runtime_events.trace_id for per-flow cost attribution.';

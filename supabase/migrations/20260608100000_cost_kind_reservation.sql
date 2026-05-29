-- P4-impl-3 — widen tenant_cost_ledger.cost_kind whitelist
-- (docs/architecture/runtime-kernel-rfc.md §P4.3 + §6 P4-impl-3)
--
-- cost_check_and_reserve (in 20260604000000_economic_intelligence.sql)
-- inserts a placeholder row with cost_kind='reservation' that
-- cost_writer_settle later updates to the actual cost_kind. The schema
-- created by 20260603100000_tenant_cost_ledger.sql (the parallel
-- P4-impl-1 migration) does NOT include 'reservation' in the
-- cost_kind CHECK whitelist, which causes every reserve() call to
-- fail with check_violation at runtime.
--
-- This migration widens the whitelist additively. The set of cost_kinds
-- the SUM-based cap-enforcement queries already understand is unchanged.
-- ADDITIVE — no data rewrite, only a constraint swap.

ALTER TABLE public.tenant_cost_ledger
    DROP CONSTRAINT IF EXISTS tenant_cost_ledger_cost_kind_check;

ALTER TABLE public.tenant_cost_ledger
    ADD CONSTRAINT tenant_cost_ledger_cost_kind_check CHECK (
        cost_kind IN (
            'llm_input', 'llm_output',
            'storage_gb_hour', 'edge_invocation',
            'webhook_egress', 'replay_simulation',
            'reservation'
        )
    );

COMMENT ON COLUMN public.tenant_cost_ledger.cost_kind IS
    'Cost dimension. ''reservation'' is a transient state inserted by '
    'cost_check_and_reserve and updated to the final dimension by '
    'cost_writer_settle (or swept by cost_sweep_expired_reservations '
    'after expires_at).';

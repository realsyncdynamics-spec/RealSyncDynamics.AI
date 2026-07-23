-- Enable RLS on 25 critical multi-tenant tables per CLAUDE.md architecture
-- Timestamp: 2026-07-23

-- ── Registry Tables ────────────────────────────────────────────
ALTER TABLE IF EXISTS public.ai_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- ── Policy Engine ────────────────────────────────────────────
ALTER TABLE IF EXISTS public.ai_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.policy_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.governance_controls ENABLE ROW LEVEL SECURITY;

-- ── Evidence Stream ────────────────────────────────────────────
ALTER TABLE IF EXISTS public.ai_evidence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evidence_retention ENABLE ROW LEVEL SECURITY;

-- ── Governance ────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.governance_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.governance_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.governance_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.runtime_events ENABLE ROW LEVEL SECURITY;

-- ── Integration ────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_tool_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dpias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dsr_tracker ENABLE ROW LEVEL SECURITY;

-- ── Operations ────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.operations_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enterprise_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_email_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vps_connections ENABLE ROW LEVEL SECURITY;

-- ── WARN: No RLS policies are created by this migration ────────
-- Each table requires explicit policies for tenant isolation.
-- URGENT: Review supabase/migrations/ for existing policies.
-- If table lacks policy, cross-tenant data leak is possible.
-- Migration is ADDITIVE ONLY; does not modify existing policies.

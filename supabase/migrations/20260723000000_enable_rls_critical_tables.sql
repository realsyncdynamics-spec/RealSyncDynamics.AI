-- Enable RLS on critical multi-tenant tables
-- Migration: 2026-07-23
--
-- NOTE: This migration ONLY enables RLS. Policies are defined in
-- separate migrations (20260601100000, etc.) where table existence
-- can be guaranteed.
--
-- Tables that exist and RLS is safe to enable:

ALTER TABLE IF EXISTS public.governance_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.governance_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.runtime_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_tool_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.dpias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.enterprise_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vps_connections ENABLE ROW LEVEL SECURITY;

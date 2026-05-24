-- LLM Query Quota + History — wires the existing entitlements model into the
-- governance-agent's chat path so per-tenant LLM quotas are enforced and every
-- successful chat run is recorded for the user/tenant to review.
--
-- Background
-- ----------
-- The existing entitlements resolver `public.tenant_entitlements(uuid)` already
-- returns the active feature/limit set per tenant, prefering Stripe-matched
-- products and falling back to plan_key defaults seeded in
-- 20260430200000_entitlements_normalization.sql. This migration:
--
--   1. Adds a new entitlement key  `limit.llm_queries_monthly`  (kind='limit').
--   2. Seeds bindings for ALL plan_keys, both the legacy bronze/silver/gold
--      block (still wired into entitlement seeds) and the marketing-facing
--      free/starter/growth/agency/scale/enterprise vocabulary used in
--      src/config/pricing.ts. -1 means unlimited (matches existing convention).
--   3. Creates a unified `public.llm_query_history` table covering both
--      tenant chat and anon chat, with deny-by-default RLS and read-own
--      policies. Anon rows are NEVER readable from a session — they are
--      operator-only via service_role.
--   4. Helper RPCs that the Edge Function calls before each chat:
--        - llm_quota_for_tenant(p_tenant_id uuid)      → int  (cap; -1 unlimited)
--        - llm_quota_used_for_tenant(p_tenant_id uuid) → int  (this calendar month)
--        - llm_quota_for_anon()                        → int  (constant 10)
--        - llm_quota_used_for_anon(p_ip_hash text)     → int  (this calendar month
--                                                              counted on anon_chat_runs)
--
-- No frontend / no Stripe / no new auth model touched. This is the DB and
-- RPC layer only; the governance-agent Edge Function wiring lives in its
-- own commit.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Entitlement key + seed bindings
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.entitlements (key, description, kind) VALUES
  ('limit.llm_queries_monthly', 'LLM-Anfragen pro Monat', 'limit')
ON CONFLICT (key) DO NOTHING;

-- Ensure rows exist in `products` for the marketing-facing plan keys defined
-- in src/config/pricing.ts. The legacy bronze/silver/gold rows were seeded
-- earlier; this is purely additive — production Stripe Price IDs replace
-- the sentinel `internal_default_*` values as plans go live.
INSERT INTO public.products (stripe_price_id, name, default_for_plan_key) VALUES
  ('internal_default_starter',    'Starter (default)',    'starter'),
  ('internal_default_growth',     'Growth (default)',     'growth'),
  ('internal_default_agency',     'Agency (default)',     'agency'),
  ('internal_default_scale',      'Scale (default)',      'scale'),
  ('internal_default_enterprise', 'Enterprise (default)', 'enterprise')
ON CONFLICT (stripe_price_id) DO NOTHING;

-- Bind the new entitlement to every existing plan_key.
-- Legacy keys (bronze/silver/gold/enterprise_public) carry forward to the
-- new marketing keys with matching budgets so existing customer tenants
-- on legacy plans don't break.
WITH plan_quotas(plan_key, monthly_quota) AS (VALUES
    ('free',              10),
    -- Marketing-facing tiers (src/config/pricing.ts)
    ('starter',          100),
    ('growth',           500),
    ('agency',            -1),
    ('scale',             -1),
    ('enterprise',        -1),
    -- Legacy tiers kept compatible
    ('bronze',           100),
    ('silver',           500),
    ('gold',              -1),
    ('enterprise_public', -1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, q.monthly_quota
FROM plan_quotas q
JOIN public.products p     ON p.default_for_plan_key = q.plan_key
JOIN public.entitlements e ON e.key = 'limit.llm_queries_monthly'
ON CONFLICT (product_id, entitlement_id) DO UPDATE
    SET value = EXCLUDED.value;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. llm_query_history — unified tenant + anon record
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.llm_query_history (
  id              BIGSERIAL PRIMARY KEY,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Scope. Exactly one of (tenant_id, session_id) MUST be non-null;
  -- the CHECK enforces that minimum.
  tenant_id       UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id)     ON DELETE SET NULL,
  session_id      TEXT,

  -- Provenance
  op              TEXT NOT NULL CHECK (op IN ('chat', 'chat_anon')),
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,

  -- Content. The full query is stored so the user can re-read it; the
  -- response_summary is truncated for the history-list UI so a long
  -- markdown response doesn't blow up the row size when the only use
  -- is "show me my last 50 questions and answers".
  query_text       TEXT NOT NULL,
  response_summary TEXT,

  -- Token accounting (best-effort; some providers return null)
  input_tokens    INTEGER,
  output_tokens   INTEGER,

  -- Joinable to anon_chat_runs.correlation_id (#393) and runtime_events.
  correlation_id  UUID,

  CONSTRAINT llm_query_history_scope_check
    CHECK (tenant_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS llm_query_history_tenant_ts_idx
  ON public.llm_query_history (tenant_id, occurred_at DESC)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS llm_query_history_user_ts_idx
  ON public.llm_query_history (user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS llm_query_history_session_ts_idx
  ON public.llm_query_history (session_id, occurred_at DESC)
  WHERE session_id IS NOT NULL;

COMMENT ON TABLE  public.llm_query_history IS
  'Unified per-query record of governance-agent chat runs. Used for user-facing history list and monthly quota counting.';
COMMENT ON COLUMN public.llm_query_history.response_summary IS
  'First ~280 chars of the LLM response. Full response NOT stored here — the conversation history (agent_sessions / clientHistory) carries the canonical full turn.';

-- RLS: deny-by-default plus narrow read-own policies.
ALTER TABLE public.llm_query_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "llm_query_history tenant member read"   ON public.llm_query_history;
DROP POLICY IF EXISTS "llm_query_history user read own"        ON public.llm_query_history;
DROP POLICY IF EXISTS "llm_query_history service role bypass"  ON public.llm_query_history;

-- Tenant members can SELECT their own tenant's rows.
CREATE POLICY "llm_query_history tenant member read"
  ON public.llm_query_history FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = public.llm_query_history.tenant_id
        AND m.user_id = auth.uid()
    )
  );

-- A user can additionally see rows they personally created, even outside a
-- tenant context (e.g. an anon session that got promoted by login is rare
-- but harmless to support up-front).
CREATE POLICY "llm_query_history user read own"
  ON public.llm_query_history FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- Anon sessions cannot read anyone's history. Operator review of anon
-- traces happens via service_role; no anon SELECT policy is created.

-- Service-role bypasses RLS already — no explicit policy needed, but we
-- want INSERT/UPDATE/DELETE to be writeable only via Edge Functions
-- (which run as service_role). Authenticated users cannot mutate, by
-- absence of any FOR INSERT/UPDATE/DELETE policy.

GRANT SELECT ON public.llm_query_history TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Quota helper RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- Cap. -1 means unlimited; default when no entitlement row resolves is 10
-- (free fallback). Matches the resolver in tenant_entitlements().
CREATE OR REPLACE FUNCTION public.llm_quota_for_tenant(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value
       FROM public.tenant_entitlements(p_tenant_id)
      WHERE key = 'limit.llm_queries_monthly'
      LIMIT 1),
    10
  );
$$;

COMMENT ON FUNCTION public.llm_quota_for_tenant(UUID) IS
  'Returns the monthly LLM-query cap for a tenant. -1 = unlimited. Defaults to 10 (free) if no entitlement is bound.';

-- Used. Calendar-month aligned (UTC) so quota resets at month boundary.
CREATE OR REPLACE FUNCTION public.llm_quota_used_for_tenant(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
    FROM public.llm_query_history
   WHERE tenant_id = p_tenant_id
     AND occurred_at >= date_trunc('month', now() AT TIME ZONE 'UTC');
$$;

COMMENT ON FUNCTION public.llm_quota_used_for_tenant(UUID) IS
  'Count of chat runs for a tenant in the current calendar month (UTC).';

-- Anon cap is a constant for now. If we ever need per-IP plans for anon
-- (e.g. a "Pro-Trial" anon path), this function gets replaced with one
-- that reads from a per-ip table.
CREATE OR REPLACE FUNCTION public.llm_quota_for_anon()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 10; $$;

-- Anon usage is counted on the existing anon_chat_runs audit table
-- (#393), not on llm_query_history — that table is the security audit
-- trail and is the source of truth for IP-based rate limiting.
CREATE OR REPLACE FUNCTION public.llm_quota_used_for_anon(p_ip_hash TEXT)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
    FROM public.anon_chat_runs
   WHERE ip_hash = p_ip_hash
     AND op = 'chat_anon'
     AND outcome IN ('success', 'pending')
     AND occurred_at >= date_trunc('month', now() AT TIME ZONE 'UTC');
$$;

COMMENT ON FUNCTION public.llm_quota_used_for_anon(TEXT) IS
  'Count of successful or pending chat_anon runs for a given IP hash in the current calendar month. Used by the Edge Function to enforce the anon cap.';

REVOKE EXECUTE ON FUNCTION public.llm_quota_for_tenant(UUID)      FROM public;
REVOKE EXECUTE ON FUNCTION public.llm_quota_used_for_tenant(UUID) FROM public;
REVOKE EXECUTE ON FUNCTION public.llm_quota_for_anon()            FROM public;
REVOKE EXECUTE ON FUNCTION public.llm_quota_used_for_anon(TEXT)   FROM public;

GRANT EXECUTE ON FUNCTION public.llm_quota_for_tenant(UUID)      TO service_role;
GRANT EXECUTE ON FUNCTION public.llm_quota_used_for_tenant(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.llm_quota_for_anon()            TO service_role;
GRANT EXECUTE ON FUNCTION public.llm_quota_used_for_anon(TEXT)   TO service_role;
-- authenticated users may read their tenant's cap (UI displays
-- "X / 100 used this month"); the used-counter is also safe to expose
-- because RLS already restricts the underlying table to tenant members.
GRANT EXECUTE ON FUNCTION public.llm_quota_for_tenant(UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.llm_quota_used_for_tenant(UUID) TO authenticated;

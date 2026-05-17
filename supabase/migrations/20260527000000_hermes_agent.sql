-- HermesAgent — knowledge + future-research substrate.
--
-- The 6 tables that back the platform's "company memory + future
-- scout" agent. HermesAgent ingests public-source knowledge, runs
-- it through the FutureFishModel, detects market gaps, fires
-- simulations, and produces a daily brief.
--
-- All tables are tenant-scoped via memberships RLS (mirrors the
-- agent-os substrate pattern in 20260526000000_agent_os_substrate.sql).
-- System-level "platform" rows use the system tenant id.

BEGIN;

-- ── 1. hermes_knowledge_items ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hermes_knowledge_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  source_url        TEXT,
  source_type       TEXT NOT NULL
                      CHECK (source_type IN (
                        'eu_ai_act','dsgvo','regulator','saas_news','ai_news',
                        'github','product_hunt','hacker_news','reddit','linkedin',
                        'competitor','pricing','funding','legaltech','regtech','other'
                      )),
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL,
  raw_excerpt       TEXT,                     -- verbatim quote, ≤ 4 KiB
  topic             TEXT NOT NULL,
  tags              TEXT[] NOT NULL DEFAULT '{}',

  relevance_score   NUMERIC(3,2) NOT NULL DEFAULT 0.0
                      CHECK (relevance_score BETWEEN 0.0 AND 1.0),
  confidence_score  NUMERIC(3,2) NOT NULL DEFAULT 0.0
                      CHECK (confidence_score BETWEEN 0.0 AND 1.0),

  time_horizon      TEXT NOT NULL DEFAULT '6_months'
                      CHECK (time_horizon IN ('3_months','6_months','12_months','24_months')),
  market_area       TEXT NOT NULL DEFAULT 'compliance'
                      CHECK (market_area IN (
                        'compliance','ai','privacy','saas','enterprise',
                        'legaltech','regtech','fintech','marketing','other'
                      )),
  risk_level        TEXT NOT NULL DEFAULT 'medium'
                      CHECK (risk_level IN ('low','medium','high','critical')),
  opportunity_type  TEXT,                     -- 'product','distribution','pricing','automation'

  related_agents    TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','superseded','redacted','archived')),

  content_hash      TEXT NOT NULL,            -- SHA-256 of source_url + title for dedup

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_hermes_know_tenant_topic    ON public.hermes_knowledge_items(tenant_id, topic);
CREATE INDEX IF NOT EXISTS idx_hermes_know_tenant_relev    ON public.hermes_knowledge_items(tenant_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_hermes_know_tenant_tags     ON public.hermes_knowledge_items USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_hermes_know_tenant_horizon  ON public.hermes_knowledge_items(tenant_id, time_horizon);

COMMENT ON TABLE public.hermes_knowledge_items IS
  'HermesAgent daily knowledge captures. Deduped by (tenant_id, content_hash). Never overwrites — supersedes via status.';

-- ── 2. hermes_market_gaps ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hermes_market_gaps (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  problem                     TEXT NOT NULL,
  target_customer             TEXT NOT NULL,
  urgency                     TEXT NOT NULL DEFAULT 'medium'
                                CHECK (urgency IN ('low','medium','high','critical')),
  existing_solutions          JSONB NOT NULL DEFAULT '[]'::jsonb,
  why_existing_solutions_fail TEXT NOT NULL,
  automation_potential        NUMERIC(3,2) NOT NULL DEFAULT 0.0
                                CHECK (automation_potential BETWEEN 0.0 AND 1.0),
  revenue_potential           TEXT,                 -- '0-50k', '50-250k', '250k-1m', '1m+'
  moat_potential              TEXT,                 -- 'network','data','regulatory','timing','none'
  recommended_product_angle   TEXT NOT NULL,

  /** Linked back to the knowledge items + future signals that
   *  surfaced this gap. */
  evidence_item_ids           UUID[] NOT NULL DEFAULT '{}',
  evidence_signal_ids         UUID[] NOT NULL DEFAULT '{}',

  status                      TEXT NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open','validating','validated','dismissed','converted')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hermes_gaps_tenant ON public.hermes_market_gaps(tenant_id, status, created_at DESC);

-- ── 3. hermes_future_signals ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hermes_future_signals (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  title                       TEXT NOT NULL,
  description                 TEXT NOT NULL,
  source                      TEXT NOT NULL,          -- URL or system source
  signal_type                 TEXT NOT NULL
                                CHECK (signal_type IN (
                                  'weak','rising','regulatory','competitor',
                                  'customer_pain','technology','funding','platform_shift'
                                )),
  market_area                 TEXT NOT NULL DEFAULT 'compliance',
  time_horizon                TEXT NOT NULL DEFAULT '6_months'
                                CHECK (time_horizon IN ('3_months','6_months','12_months','24_months')),
  evidence                    TEXT[] NOT NULL DEFAULT '{}',

  /** Six FutureFishModel scores, all 0..1. */
  novelty_score               NUMERIC(3,2) NOT NULL CHECK (novelty_score      BETWEEN 0.0 AND 1.0),
  urgency_score               NUMERIC(3,2) NOT NULL CHECK (urgency_score      BETWEEN 0.0 AND 1.0),
  monetization_score          NUMERIC(3,2) NOT NULL CHECK (monetization_score BETWEEN 0.0 AND 1.0),
  defensibility_score         NUMERIC(3,2) NOT NULL CHECK (defensibility_score BETWEEN 0.0 AND 1.0),
  timing_score                NUMERIC(3,2) NOT NULL CHECK (timing_score       BETWEEN 0.0 AND 1.0),
  evidence_score              NUMERIC(3,2) NOT NULL CHECK (evidence_score     BETWEEN 0.0 AND 1.0),

  /** Weighted aggregate, 0..1. Computed deterministically by
   *  scoreFutureSignal() — never modified by clients directly. */
  future_opportunity_score    NUMERIC(3,2) NOT NULL CHECK (future_opportunity_score BETWEEN 0.0 AND 1.0),

  recommended_action          TEXT NOT NULL,
  /** Source knowledge item this signal was extracted from. */
  source_knowledge_id         UUID REFERENCES public.hermes_knowledge_items(id) ON DELETE SET NULL,

  status                      TEXT NOT NULL DEFAULT 'fresh'
                                CHECK (status IN ('fresh','watched','elevated','dismissed','converted')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hermes_signals_tenant_score
  ON public.hermes_future_signals(tenant_id, future_opportunity_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hermes_signals_tenant_type
  ON public.hermes_future_signals(tenant_id, signal_type);

COMMENT ON COLUMN public.hermes_future_signals.future_opportunity_score IS
  'Deterministic weighted aggregate of the six FutureFishModel dimensions. Never set by clients directly.';

-- ── 4. hermes_simulations ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hermes_simulations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  agent                       TEXT NOT NULL
                                CHECK (agent IN (
                                  'MarketSimulationAgent','RegulationSimulationAgent',
                                  'CompetitorSimulationAgent','CustomerPainSimulationAgent',
                                  'PricingSimulationAgent','ProductStrategyAgent',
                                  'RiskSimulationAgent','PromotionAgent','DecisionAgent'
                                )),
  scenario_name               TEXT NOT NULL,
  timeframe                   TEXT NOT NULL
                                CHECK (timeframe IN ('3_months','6_months','12_months','24_months')),
  assumptions                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_market_shift       TEXT NOT NULL,
  risks                       JSONB NOT NULL DEFAULT '[]'::jsonb,
  opportunities               JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_moves           JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence                  NUMERIC(3,2) NOT NULL DEFAULT 0.0
                                CHECK (confidence BETWEEN 0.0 AND 1.0),

  /** Either a signal or a market_gap kicked off this simulation. */
  triggered_by_signal_id      UUID REFERENCES public.hermes_future_signals(id) ON DELETE SET NULL,
  triggered_by_market_gap_id  UUID REFERENCES public.hermes_market_gaps(id)    ON DELETE SET NULL,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hermes_sim_tenant ON public.hermes_simulations(tenant_id, created_at DESC);

-- ── 5. hermes_daily_briefs ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hermes_daily_briefs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  brief_date                  DATE NOT NULL,            -- one brief per tenant per day
  top_5_signals               JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_3_market_gaps           JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_3_risks                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  competitor_moves            JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions_today   JSONB NOT NULL DEFAULT '[]'::jsonb,
  strategic_watchlist         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ideas_to_validate           JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_angles_for_promotion JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, brief_date)
);

CREATE INDEX IF NOT EXISTS idx_hermes_briefs_tenant_date
  ON public.hermes_daily_briefs(tenant_id, brief_date DESC);

-- ── 6. hermes_agent_handoffs ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hermes_agent_handoffs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  target_agent                TEXT NOT NULL,            -- PlanningAgent | PromotionAgent | ...
  task_kind                   TEXT NOT NULL,            -- 'roadmap_from_gap','content_from_trend', …
  context_summary             TEXT NOT NULL,
  payload                     JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_signal_id            UUID REFERENCES public.hermes_future_signals(id) ON DELETE SET NULL,
  source_market_gap_id        UUID REFERENCES public.hermes_market_gaps(id)    ON DELETE SET NULL,

  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','accepted','rejected','completed')),

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at                 TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hermes_handoff_tenant_status
  ON public.hermes_agent_handoffs(tenant_id, status, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────

ALTER TABLE public.hermes_knowledge_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_market_gaps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_future_signals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_simulations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_daily_briefs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hermes_agent_handoffs    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'hermes_knowledge_items','hermes_market_gaps','hermes_future_signals',
    'hermes_simulations','hermes_daily_briefs','hermes_agent_handoffs'
  ]) LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$s_member_select ON public.%1$s;
      CREATE POLICY %1$s_member_select ON public.%1$s
        FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = %1$s.tenant_id
              AND m.user_id   = auth.uid()
          )
        );
    $f$, t);
  END LOOP;
END $$;

-- Owners + admins can act on briefs / gaps / handoffs (acknowledge,
-- promote, dismiss). The agent itself runs with service_role for
-- writes.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'hermes_market_gaps','hermes_agent_handoffs'
  ]) LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$s_admin_update ON public.%1$s;
      CREATE POLICY %1$s_admin_update ON public.%1$s
        FOR UPDATE TO authenticated
        USING (
          EXISTS (SELECT 1 FROM public.memberships m
                  WHERE m.tenant_id = %1$s.tenant_id
                    AND m.user_id   = auth.uid()
                    AND m.role IN ('owner','admin'))
        );
    $f$, t);
  END LOOP;
END $$;

COMMIT;

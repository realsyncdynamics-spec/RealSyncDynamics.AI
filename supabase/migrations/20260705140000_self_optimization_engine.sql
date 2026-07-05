-- Self-Optimization Engine
--
-- Autonomous system that:
-- 1. Analyzes compliance patterns and trends
-- 2. Recommends specific optimizations
-- 3. Executes approved optimizations
-- 4. Tracks effectiveness via metrics
--
-- Recommendations include:
-- - Policy adjustments (stricter controls, simplified workflows)
-- - Risk mitigation strategies
-- - Audit frequency optimization
-- - Vendor management improvements
-- - Compliance framework alignments

BEGIN;

-- 1. Optimization recommendations (AI-generated)
CREATE TABLE IF NOT EXISTS public.optimization_recommendations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category        TEXT NOT NULL CHECK (category IN (
                        'policy_tightening',
                        'risk_mitigation',
                        'audit_optimization',
                        'vendor_management',
                        'framework_alignment',
                        'incident_response',
                        'evidence_retention'
                    )),
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    impact_score    INTEGER NOT NULL CHECK (impact_score >= 0 AND impact_score <= 100),
    implementation_effort INTEGER NOT NULL CHECK (implementation_effort >= 1 AND implementation_effort <= 5),
    estimated_savings_monthly DECIMAL(10, 2),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at     TIMESTAMPTZ,
    implemented_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_optimization_recs_tenant_status
    ON public.optimization_recommendations(tenant_id, status, created_at DESC);

-- 2. Optimization execution history
CREATE TABLE IF NOT EXISTS public.optimization_executions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id       UUID NOT NULL REFERENCES public.optimization_recommendations(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    execution_type          TEXT NOT NULL,
    changes_applied         JSONB NOT NULL DEFAULT '{}'::jsonb,
    rollback_snapshot       JSONB,
    status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
    error_message           TEXT,
    executed_by             UUID REFERENCES auth.users(id),
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimization_exec_tenant_recommendation
    ON public.optimization_executions(tenant_id, recommendation_id);

CREATE INDEX IF NOT EXISTS idx_optimization_exec_status
    ON public.optimization_executions(status, completed_at DESC);

-- 3. Optimization effectiveness metrics
CREATE TABLE IF NOT EXISTS public.optimization_metrics (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id            UUID NOT NULL REFERENCES public.optimization_executions(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    metric_key              TEXT NOT NULL,
    metric_name             TEXT NOT NULL,
    before_value            NUMERIC,
    after_value             NUMERIC,
    improvement_percent     NUMERIC,
    measurement_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimization_metrics_tenant_execution
    ON public.optimization_metrics(tenant_id, execution_id);

-- 4. RLS policies
ALTER TABLE public.optimization_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "optimization_recs_tenant_read"
    ON public.optimization_recommendations
    FOR SELECT
    USING (tenant_id = auth.jwt()->>'tenant_id');

CREATE POLICY "optimization_recs_service_all"
    ON public.optimization_recommendations
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "optimization_exec_tenant_read"
    ON public.optimization_executions
    FOR SELECT
    USING (tenant_id = auth.jwt()->>'tenant_id');

CREATE POLICY "optimization_exec_service_all"
    ON public.optimization_executions
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "optimization_metrics_tenant_read"
    ON public.optimization_metrics
    FOR SELECT
    USING (tenant_id = auth.jwt()->>'tenant_id');

CREATE POLICY "optimization_metrics_service_all"
    ON public.optimization_metrics
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- 5. Function to approve recommendation
CREATE OR REPLACE FUNCTION public.approve_optimization_recommendation(
    p_rec_id UUID,
    p_tenant_id UUID
)
RETURNS TABLE (
    id UUID,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.optimization_recommendations
    SET
        status = 'approved',
        approved_at = now()
    WHERE id = p_rec_id AND tenant_id = p_tenant_id
    RETURNING optimization_recommendations.id, optimization_recommendations.status
    INTO id, status;

    RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.approve_optimization_recommendation(UUID, UUID) IS
    'Approve a pending optimization recommendation for execution';

-- 6. Function to log execution start
CREATE OR REPLACE FUNCTION public.start_optimization_execution(
    p_rec_id UUID,
    p_tenant_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    execution_id UUID,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exec_id UUID;
BEGIN
    INSERT INTO public.optimization_executions (
        recommendation_id,
        tenant_id,
        execution_type,
        status,
        executed_by,
        started_at
    )
    SELECT
        p_rec_id,
        p_tenant_id,
        category,
        'in_progress',
        p_user_id,
        now()
    FROM public.optimization_recommendations
    WHERE id = p_rec_id AND tenant_id = p_tenant_id
    RETURNING public.optimization_executions.id INTO v_exec_id;

    RETURN QUERY SELECT v_exec_id, 'in_progress'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.start_optimization_execution(UUID, UUID, UUID) IS
    'Log the start of an optimization execution';

-- 7. Function to complete execution with metrics
CREATE OR REPLACE FUNCTION public.complete_optimization_execution(
    p_exec_id UUID,
    p_tenant_id UUID,
    p_metrics JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    execution_id UUID,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_metric JSONB;
BEGIN
    -- Mark execution as completed
    UPDATE public.optimization_executions
    SET
        status = 'completed',
        completed_at = now()
    WHERE id = p_exec_id AND tenant_id = p_tenant_id;

    -- Log metrics if provided
    IF p_metrics <> '{}'::jsonb THEN
        FOR v_metric IN SELECT jsonb_each(p_metrics)
        LOOP
            INSERT INTO public.optimization_metrics (
                execution_id,
                tenant_id,
                metric_key,
                metric_name,
                after_value
            )
            VALUES (
                p_exec_id,
                p_tenant_id,
                v_metric.key,
                v_metric.key,
                (v_metric.value->>'value')::NUMERIC
            )
            ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    RETURN QUERY
    SELECT p_exec_id, 'completed'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.complete_optimization_execution(UUID, UUID, JSONB) IS
    'Complete an optimization execution and log resulting metrics';

-- 8. Comments
COMMENT ON TABLE public.optimization_recommendations IS
    'AI-generated recommendations for tenant compliance optimizations';

COMMENT ON TABLE public.optimization_executions IS
    'History of executed optimizations with rollback capability';

COMMENT ON TABLE public.optimization_metrics IS
    'Metrics tracking effectiveness of optimizations (before/after comparisons)';

COMMIT;

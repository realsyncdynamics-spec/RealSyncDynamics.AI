-- MarketGapScanner — autonomes Daily-Research-System.
--
-- Architektur:
--   1. pg_cron triggert täglich market-scanner Edge Function
--   2. Function rotiert durch 12 Branchen (1 pro Tag, 12-Tage-Zyklus)
--   3. AI-Tool (Anthropic Claude direkt via _shared/providers.ts)
--      analysiert Branche → strukturiertes JSON
--   4. INSERT in market_gaps (Lücke + saas_solution + ceo_profile + scores)
--   5. Bei revenue_potential IN ('high','very_high'): auto-INSERT
--      in ceo_briefs für späteren PDF-Export
--   6. Frontend /market-gaps (admin-only) listet + filtert
--
-- Kein Multi-Tenant — das hier ist RealSync-internes Intel,
-- nicht Kunden-Daten. Zugriff via profiles.is_super_admin.

-- ─── 1. Super-Admin-Flag auf profiles ───────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_super_admin IS
    'Plattform-interne Admin-Berechtigung (RealSync-Team). Sieht /market-gaps + /admin/ceo-briefs.';

-- ─── 2. market_gaps ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_gaps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry            TEXT NOT NULL,
    sector              TEXT NOT NULL,
    job_category        TEXT NOT NULL,
    audience            TEXT NOT NULL CHECK (audience IN ('employer', 'employee', 'both')),
    gap_description     TEXT NOT NULL,
    saas_solution       TEXT NOT NULL,
    stripe_model        TEXT NOT NULL CHECK (stripe_model IN ('subscription', 'metered', 'one-time', 'marketplace')),
    tam_estimate        TEXT,
    urgency_score       INTEGER NOT NULL CHECK (urgency_score BETWEEN 1 AND 10),
    revenue_potential   TEXT NOT NULL CHECK (revenue_potential IN ('low', 'medium', 'high', 'very_high')),
    build_complexity    TEXT NOT NULL CHECK (build_complexity IN ('low', 'medium', 'high')),
    ceo_profile         TEXT,
    status              TEXT NOT NULL DEFAULT 'identified'
                        CHECK (status IN ('identified', 'validated', 'building', 'launched', 'rejected')),
    sources             JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_research        TEXT,
    ai_run_id           UUID,                    -- referenziert ai_tool_runs.id (no FK — runs cleanup-fähig)
    scanned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_gaps_industry_revenue ON public.market_gaps(industry, revenue_potential);
CREATE INDEX IF NOT EXISTS idx_market_gaps_urgency          ON public.market_gaps(urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_market_gaps_status           ON public.market_gaps(status);
CREATE INDEX IF NOT EXISTS idx_market_gaps_scanned          ON public.market_gaps(scanned_at DESC);

ALTER TABLE public.market_gaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_gaps super_admin_read"  ON public.market_gaps;
DROP POLICY IF EXISTS "market_gaps super_admin_write" ON public.market_gaps;

CREATE POLICY "market_gaps super_admin_read"
    ON public.market_gaps FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

CREATE POLICY "market_gaps super_admin_write"
    ON public.market_gaps FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

-- INSERT/DELETE nur über service_role (Edge Function market-scanner).

DROP TRIGGER IF EXISTS update_market_gaps_modtime ON public.market_gaps;
CREATE TRIGGER update_market_gaps_modtime
    BEFORE UPDATE ON public.market_gaps
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ─── 3. ceo_briefs ──────────────────────────────────────────────────────────
-- Auto-generiert von market-scanner für Lücken mit hohem Revenue-Potential.
CREATE TABLE IF NOT EXISTS public.ceo_briefs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_gap_id   UUID NOT NULL REFERENCES public.market_gaps(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    body_md         TEXT NOT NULL,                -- Markdown
    target_profile  TEXT,                         -- denormalisiertes ceo_profile
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'replied', 'archived')),
    sent_to_email   TEXT,
    sent_at         TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ceo_briefs_gap     ON public.ceo_briefs(market_gap_id);
CREATE INDEX IF NOT EXISTS idx_ceo_briefs_status  ON public.ceo_briefs(status);

ALTER TABLE public.ceo_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ceo_briefs super_admin_all" ON public.ceo_briefs;
CREATE POLICY "ceo_briefs super_admin_all"
    ON public.ceo_briefs FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

DROP TRIGGER IF EXISTS update_ceo_briefs_modtime ON public.ceo_briefs;
CREATE TRIGGER update_ceo_briefs_modtime
    BEFORE UPDATE ON public.ceo_briefs
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- ─── 4. research_runs (Audit jedes Daily-Runs) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.research_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry        TEXT,
    depth           TEXT NOT NULL DEFAULT 'deep' CHECK (depth IN ('surface', 'deep')),
    status          TEXT NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running', 'success', 'error', 'skipped')),
    gaps_found      INTEGER NOT NULL DEFAULT 0,
    briefs_created  INTEGER NOT NULL DEFAULT 0,
    duration_ms     INTEGER,
    error_code      TEXT,
    error_message   TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_research_runs_started ON public.research_runs(started_at DESC);

ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "research_runs super_admin_read" ON public.research_runs;
CREATE POLICY "research_runs super_admin_read"
    ON public.research_runs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
         WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

COMMENT ON TABLE public.market_gaps      IS 'AI-identifizierte Markt-Lücken. Schreibzugriff nur über Edge Function market-scanner.';
COMMENT ON TABLE public.ceo_briefs       IS 'Auto-generierte Briefs für CEO-Outreach bei high/very_high revenue-Lücken.';
COMMENT ON TABLE public.research_runs    IS 'Audit jedes market-scanner-Runs.';

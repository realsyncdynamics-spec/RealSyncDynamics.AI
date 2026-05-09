-- unknown_trackers — Auto-Discovery-Pipeline für noch nicht klassifizierte
-- 3rd-party Scripts die der cookie-scan auf Customer-Domains findet.
--
-- Workflow:
--   1. cookie-scan detected ein Script-Tag mit src=https://drittanbieter.com/script.js
--   2. Wenn nicht in tracker-registry.json: upsert in unknown_trackers (Counter +1)
--   3. Compliance-Lead reviewt wöchentlich (super_admin_read RLS), klassifiziert,
--      promoted zur registry, setzt reviewed=true + registry_id
--
-- Idempotent: ON CONFLICT(script_host) verlängert die Beobachtung statt
-- Duplikate zu schaffen.

CREATE TABLE IF NOT EXISTS public.unknown_trackers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_host     TEXT NOT NULL UNIQUE,           -- z.B. "fake-analytics.io"
    sample_url      TEXT NOT NULL,                  -- erstes Beispiel der vollen URL
    first_seen_on   TEXT NOT NULL,                  -- Customer-Domain wo zuerst gesehen
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    customer_domains TEXT[] NOT NULL DEFAULT '{}',  -- alle Domains wo gesehen (max 50, FIFO)
    suspected_category TEXT CHECK (suspected_category IN (
        'analytics', 'advertising', 'ux', 'consent_manager', 'cdn', 'other'
    )),
    suspected_risk  TEXT CHECK (suspected_risk IN ('low', 'medium', 'high', 'critical')),
    notes           TEXT,
    -- Review-State
    reviewed        BOOLEAN NOT NULL DEFAULT false,
    reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    -- Wenn promoted: ID des Registry-Eintrags (lose Verknüpfung — Registry ist JSON, nicht DB)
    registry_id     TEXT,
    -- Wenn explizit als 'no risk' / 'CDN whitelisted' markiert
    dismissed       BOOLEAN NOT NULL DEFAULT false,
    -- Timestamps
    first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unknown_trackers_unreviewed
    ON public.unknown_trackers(occurrence_count DESC) WHERE reviewed = false AND dismissed = false;
CREATE INDEX IF NOT EXISTS idx_unknown_trackers_last_seen
    ON public.unknown_trackers(last_seen_at DESC);

-- updated_at-Trigger
CREATE OR REPLACE FUNCTION public.tg_unknown_trackers_updated()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unknown_trackers_updated ON public.unknown_trackers;
CREATE TRIGGER unknown_trackers_updated
    BEFORE UPDATE ON public.unknown_trackers
    FOR EACH ROW EXECUTE FUNCTION public.tg_unknown_trackers_updated();

-- RPC für cookie-scan Edge-Function: incrementiert Counter + appended Domain.
-- Bewusst SECURITY DEFINER damit anon-Calls schreiben dürfen, aber NUR diese
-- spezifische Operation. Direct INSERT ist anon nicht möglich (RLS).
CREATE OR REPLACE FUNCTION public.report_unknown_tracker(
    p_script_host text,
    p_sample_url text,
    p_customer_domain text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_id uuid;
BEGIN
    -- Sanity: keine eigenen Hosts melden
    IF p_script_host LIKE '%realsyncdynamics%' THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.unknown_trackers (script_host, sample_url, first_seen_on, customer_domains)
    VALUES (
        p_script_host,
        p_sample_url,
        p_customer_domain,
        ARRAY[p_customer_domain]
    )
    ON CONFLICT (script_host) DO UPDATE SET
        occurrence_count = unknown_trackers.occurrence_count + 1,
        last_seen_at = now(),
        customer_domains = (
            SELECT ARRAY(
                SELECT DISTINCT unnest(unknown_trackers.customer_domains || ARRAY[EXCLUDED.first_seen_on])
                LIMIT 50
            )
        )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- RLS: super_admin sieht alles, anon kann nur via report_unknown_tracker schreiben
ALTER TABLE public.unknown_trackers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unknown_trackers_super_admin_read" ON public.unknown_trackers;
CREATE POLICY "unknown_trackers_super_admin_read"
    ON public.unknown_trackers FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

DROP POLICY IF EXISTS "unknown_trackers_super_admin_update" ON public.unknown_trackers;
CREATE POLICY "unknown_trackers_super_admin_update"
    ON public.unknown_trackers FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_super_admin = true
    ));

GRANT EXECUTE ON FUNCTION public.report_unknown_tracker(text, text, text)
    TO anon, authenticated, service_role;

COMMENT ON TABLE public.unknown_trackers IS
'Auto-Discovery von 3rd-party-Scripts die der cookie-scan auf Customer-Domains findet aber noch nicht in tracker-registry.json sind. Wöchentlicher Review-Workflow durch Compliance-Lead.';

COMMENT ON FUNCTION public.report_unknown_tracker(text, text, text) IS
'Public RPC fuer cookie-scan Edge-Function um unbekannte 3rd-party-Scripts zu loggen. Idempotent via ON CONFLICT — incrementiert Counter + appended Customer-Domain.';

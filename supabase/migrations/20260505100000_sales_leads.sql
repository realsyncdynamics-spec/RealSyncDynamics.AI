-- Sales-Leads-Tabelle für die /contact-sales-Form auf der Apex und /agencies.
-- Server-side INSERT-only via Edge Function (sales-lead) mit Service-Role.
-- SELECT nur für admin-Membership eines internen "realsync"-Tenants
-- (vorerst nur via execute_sql / SQL Editor; UI dafür kommt später).

CREATE TABLE IF NOT EXISTS public.sales_leads (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT,
    email        TEXT NOT NULL,
    company      TEXT,
    use_case     TEXT,
    message      TEXT,
    source       TEXT,                              -- utm-source / referrer / direct
    path         TEXT,                              -- welche Page das Form abgeschickt hat
    user_agent   TEXT,
    ip_hash      TEXT,                              -- SHA-256 Hash für Rate-Limit-Detection ohne PII
    status       TEXT NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'contacted', 'qualified', 'lost', 'won')),
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_leads_created      ON public.sales_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_leads_email        ON public.sales_leads(email);
CREATE INDEX IF NOT EXISTS idx_sales_leads_status_open  ON public.sales_leads(status) WHERE status IN ('new', 'contacted');

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

-- Default: niemand kann lesen/schreiben (Edge Function nutzt service_role und umgeht RLS).
-- Späteres Admin-Panel würde eine eigene Read-Policy für interne User bekommen.

DROP TRIGGER IF EXISTS update_sales_leads_modtime ON public.sales_leads;
CREATE TRIGGER update_sales_leads_modtime
    BEFORE UPDATE ON public.sales_leads
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

COMMENT ON TABLE public.sales_leads IS
    'Eingehende Sales-Anfragen aus den Landing-Pages. Edge Function sales-lead schreibt hier rein. SELECT/UPDATE über RLS gesperrt — Admin-Panel kommt später.';

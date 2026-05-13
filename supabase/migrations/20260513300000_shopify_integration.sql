-- Shopify Integration MVP — read-only storefront compliance scan.
--
-- Four tables:
--   shopify_shops          installed shop + encrypted access token
--   shopify_scan_runs      per-scan history with score + findings JSONB
--   shopify_drift_events   diffs between consecutive scans
--   shopify_webhooks       registered Shopify webhook subscriptions
--
-- Scopes are READ-ONLY by policy. The integration never writes back
-- to the customer's store. This is a hard product constraint and is
-- enforced in scope-string validation in supabase/functions/_shared/
-- shopify-oauth.ts as well.

CREATE TABLE IF NOT EXISTS public.shopify_shops (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  shop_domain             TEXT NOT NULL UNIQUE,
  access_token_encrypted  TEXT NOT NULL,
  scopes                  TEXT[] NOT NULL DEFAULT '{}',
  api_version             TEXT NOT NULL DEFAULT '2026-01',
  installed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uninstalled_at          TIMESTAMPTZ,
  status                  TEXT NOT NULL DEFAULT 'installed'
                          CHECK (status IN ('installed','uninstalled','error')),
  last_scan_at            TIMESTAMPTZ,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopify_shops_domain ON public.shopify_shops(shop_domain);
CREATE INDEX IF NOT EXISTS idx_shopify_shops_tenant ON public.shopify_shops(tenant_id, status);

CREATE TABLE IF NOT EXISTS public.shopify_scan_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES public.shopify_shops(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','completed','failed')),
  score         INT,
  summary       TEXT,
  findings      JSONB NOT NULL DEFAULT '[]',
  evidence      JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopify_scan_runs_shop
  ON public.shopify_scan_runs(shop_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shopify_drift_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES public.shopify_shops(id) ON DELETE CASCADE,
  scan_run_id   UUID REFERENCES public.shopify_scan_runs(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'medium'
                CHECK (severity IN ('low','medium','high','critical')),
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,
  evidence      JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','acknowledged','resolved')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopify_drift_events_shop
  ON public.shopify_drift_events(shop_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.shopify_webhooks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES public.shopify_shops(id) ON DELETE CASCADE,
  topic        TEXT NOT NULL,
  webhook_id   TEXT,
  status       TEXT NOT NULL DEFAULT 'registered'
               CHECK (status IN ('registered','failed','removed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopify_webhooks_shop ON public.shopify_webhooks(shop_id, topic);

DROP TRIGGER IF EXISTS trg_shopify_shops_updated_at ON public.shopify_shops;
CREATE TRIGGER trg_shopify_shops_updated_at BEFORE UPDATE ON public.shopify_shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.shopify_shops         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_scan_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_drift_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_webhooks      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopify_shops_service_all"    ON public.shopify_shops    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "shopify_scans_service_all"    ON public.shopify_scan_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "shopify_drift_service_all"    ON public.shopify_drift_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "shopify_webhooks_service_all" ON public.shopify_webhooks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "shopify_shops_tenant_read" ON public.shopify_shops
  FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

CREATE POLICY "shopify_scans_tenant_read" ON public.shopify_scan_runs
  FOR SELECT TO authenticated
  USING (shop_id IN (
    SELECT id FROM public.shopify_shops
    WHERE tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  ));

CREATE POLICY "shopify_drift_tenant_read" ON public.shopify_drift_events
  FOR SELECT TO authenticated
  USING (shop_id IN (
    SELECT id FROM public.shopify_shops
    WHERE tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())
  ));

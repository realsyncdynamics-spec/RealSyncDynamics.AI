-- Vendor Sub-Processor Inventory (PR #158).
-- Strukturierte Erfassung von Drittanbietern mit DPA-Status,
-- Transfer-Mechanismus (Art. 46 GDPR) und Asset-Verknüpfung.

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name TEXT NOT NULL,
  legal_name TEXT,
  country TEXT,
  website TEXT,
  privacy_policy_url TEXT,
  dpa_status TEXT NOT NULL CHECK (dpa_status IN ('none','requested','signed','expired','not_required')) DEFAULT 'none',
  dpa_signed_at TIMESTAMPTZ,
  dpa_expires_at TIMESTAMPTZ,
  transfer_mechanism TEXT CHECK (transfer_mechanism IN ('adequacy','scc','bcr','derogation','none','unknown')) DEFAULT 'unknown',
  data_types_processed TEXT[] DEFAULT '{}',
  processing_purposes TEXT[] DEFAULT '{}',
  sub_processors TEXT[] DEFAULT '{}',
  risk_level TEXT CHECK (risk_level IN ('low','medium','high','critical')) DEFAULT 'medium',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.asset_vendor_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.governance_assets(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('processor','sub_processor','controller','joint_controller')) DEFAULT 'processor',
  UNIQUE(asset_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendors_tenant ON public.vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_dpa ON public.vendors(dpa_status);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_vendor_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_service_all" ON public.vendors;
CREATE POLICY "vendors_service_all" ON public.vendors FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "asset_vendor_links_service_all" ON public.asset_vendor_links;
CREATE POLICY "asset_vendor_links_service_all" ON public.asset_vendor_links FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "vendors_tenant_read" ON public.vendors;
CREATE POLICY "vendors_tenant_read" ON public.vendors FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "asset_vendor_links_tenant_read" ON public.asset_vendor_links;
CREATE POLICY "asset_vendor_links_tenant_read" ON public.asset_vendor_links FOR SELECT TO authenticated
USING (asset_id IN (SELECT id FROM public.governance_assets WHERE tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid())));

DROP TRIGGER IF EXISTS trg_vendors_updated_at ON public.vendors;
CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

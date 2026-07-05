-- White-Label Branding API
--
-- Enables tenant admins to customize dashboard appearance, colors, logos, and fonts.
-- Supports both API (programmatic) and UI-based branding customization.

-- 1. Extend tenants table with additional branding fields
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS support_email TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS support_phone TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS support_url TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS favicon_url TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS footer_text TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS custom_css JSONB DEFAULT '{}'::jsonb;

-- 2. Create branding presets (color themes) for quick setup
CREATE TABLE IF NOT EXISTS public.branding_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  brand_colors JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_image_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branding_presets_public ON public.branding_presets(is_public);

COMMENT ON TABLE public.branding_presets IS 'Pre-designed color themes for quick branding setup';

-- 3. Seed default branding presets
INSERT INTO public.branding_presets (name, description, brand_colors, is_public)
VALUES
  (
    'Petrol Professional',
    'EU enterprise petrol + slate theme',
    '{"primary":"#0F766E","secondary":"#64748B","accent":"#06B6D4","background":"#F8FAFC","text":"#0F172A"}'::jsonb,
    true
  ),
  (
    'Security Blue',
    'Trust-focused security theme',
    '{"primary":"#0052FF","secondary":"#00D9FF","accent":"#FF6B35","background":"#F5F7FA","text":"#1A1A2E"}'::jsonb,
    true
  ),
  (
    'Minimal Monochrome',
    'Minimalist grayscale theme',
    '{"primary":"#1F2937","secondary":"#9CA3AF","accent":"#3B82F6","background":"#FFFFFF","text":"#111827"}'::jsonb,
    true
  )
ON CONFLICT (name) DO NOTHING;

-- 4. RLS Policies for branding presets
ALTER TABLE public.branding_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY branding_presets_public_read ON public.branding_presets
  FOR SELECT USING (is_public = true);

CREATE POLICY branding_presets_admin_all ON public.branding_presets
  FOR ALL TO service_role USING (true);

-- 5. Helper function: get branding by tenant_id
CREATE OR REPLACE FUNCTION public.get_tenant_branding(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_branding JSON;
BEGIN
  SELECT json_build_object(
    'tenant_id', id,
    'company_name', company_name,
    'custom_domain', custom_domain,
    'brand_colors', brand_colors,
    'custom_logo_url', custom_logo_url,
    'favicon_url', favicon_url,
    'support_email', support_email,
    'support_phone', support_phone,
    'support_url', support_url,
    'footer_text', footer_text,
    'custom_css', custom_css
  ) INTO v_branding
  FROM public.tenants
  WHERE id = p_tenant_id;

  RETURN v_branding;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_branding(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_branding(UUID) TO anon, authenticated, service_role;

-- 6. Helper function: get branding by custom_domain
CREATE OR REPLACE FUNCTION public.get_tenant_branding_by_domain(p_domain TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_branding JSON;
BEGIN
  SELECT json_build_object(
    'tenant_id', id,
    'company_name', company_name,
    'custom_domain', custom_domain,
    'brand_colors', brand_colors,
    'custom_logo_url', custom_logo_url,
    'favicon_url', favicon_url,
    'support_email', support_email,
    'support_phone', support_phone,
    'support_url', support_url,
    'footer_text', footer_text,
    'custom_css', custom_css
  ) INTO v_branding
  FROM public.tenants
  WHERE custom_domain = LOWER(p_domain);

  RETURN v_branding;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_branding_by_domain(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tenant_branding_by_domain(TEXT) TO anon, authenticated, service_role;

-- 7. Branding audit log (for compliance & rollback)
CREATE TABLE IF NOT EXISTS public.branding_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  change_type TEXT CHECK (change_type IN ('update', 'reset')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branding_audit_tenant_date ON public.branding_audit_log(tenant_id, created_at DESC);

COMMENT ON TABLE public.branding_audit_log IS 'Audit trail for all branding changes (compliance, rollback support)';

-- 8. RLS for branding audit log
ALTER TABLE public.branding_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY branding_audit_tenant_members_read ON public.branding_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = branding_audit_log.tenant_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY branding_audit_service_role_all ON public.branding_audit_log
  FOR ALL TO service_role USING (true);

-- 9. Trigger: log branding changes
CREATE OR REPLACE FUNCTION public.log_branding_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  v_old_values := jsonb_build_object(
    'company_name', OLD.company_name,
    'brand_colors', OLD.brand_colors,
    'custom_logo_url', OLD.custom_logo_url,
    'favicon_url', OLD.favicon_url,
    'support_email', OLD.support_email,
    'support_phone', OLD.support_phone,
    'support_url', OLD.support_url,
    'footer_text', OLD.footer_text,
    'custom_css', OLD.custom_css
  );

  v_new_values := jsonb_build_object(
    'company_name', NEW.company_name,
    'brand_colors', NEW.brand_colors,
    'custom_logo_url', NEW.custom_logo_url,
    'favicon_url', NEW.favicon_url,
    'support_email', NEW.support_email,
    'support_phone', NEW.support_phone,
    'support_url', NEW.support_url,
    'footer_text', NEW.footer_text,
    'custom_css', NEW.custom_css
  );

  -- Only log if branding fields changed
  IF v_old_values IS DISTINCT FROM v_new_values THEN
    INSERT INTO public.branding_audit_log (tenant_id, old_values, new_values, change_type)
    VALUES (NEW.id, v_old_values, v_new_values, 'update');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_tenant_branding_changes ON public.tenants;
CREATE TRIGGER log_tenant_branding_changes
  AFTER UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.log_branding_change();

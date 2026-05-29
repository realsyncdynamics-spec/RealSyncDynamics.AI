-- Tenant-Branding für White-Label-Reports — Agency- und Scale-Tiers.
--
-- Modell: eine Zeile pro Tenant in public.tenant_branding mit den
-- visuellen Override-Feldern. Wenn keine Zeile existiert ODER der
-- Tenant nicht das whitelabel.reports-Entitlement hat, fallen Reports
-- auf das Default-RealSyncDynamics-Branding zurück (handled in
-- supabase/functions/_shared/branding.ts).
--
-- Sicherheits-Modell:
--   - Service-Role: full access (Edge Functions, Branding-Resolver)
--   - Tenant-Owner/Admin: SELECT + INSERT + UPDATE auf eigenes Tenant
--   - Andere Tenant-Members: SELECT (damit die UI Preview zeigen kann)
--   - DELETE: nur service-role (Branding wird via UPDATE deaktiviert,
--     nicht gelöscht — Audit-Trail)
--
-- Farben: Hex-Codes als TEXT mit CHECK auf #RRGGBB-Format. Validierung
-- am Eingang ist sinnvoll, weil die Werte direkt in HTML inline gehen.
-- Logos: Storage-Pfade ins `documents`-Bucket (bestehender Bucket),
-- damit wir die existierenden RLS-Policies dafür wiederverwenden.

CREATE TABLE IF NOT EXISTS public.tenant_branding (
  tenant_id        UUID PRIMARY KEY
                   REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Anzeigename auf Reports + Dashboards (z.B. „Müller Compliance GmbH").
  -- Wenn NULL, wird tenants.name als Fallback verwendet.
  brand_name       TEXT,

  -- Storage-Pfad zum Logo im `documents`-Bucket
  -- (Konvention: branding/<tenant_id>/logo.<ext>). NULL = kein Logo.
  logo_storage_path TEXT,

  -- Primärfarbe für Akzente / Header-Strip. Default: RealSyncDynamics-Gelb.
  primary_color    TEXT
                   CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),

  -- Sekundär-/Akzentfarbe (z.B. für Score-Anzeige). Default: gleich primary.
  accent_color     TEXT
                   CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$'),

  -- Footer-Zeile statt „RealSyncDynamics.AI · EU-gehostet · …".
  -- Wenn NULL, bleibt der Default-Footer (mit kleinem „powered by"-Vermerk).
  footer_text      TEXT,

  -- Support-Adresse, an die Kunden des Tenants im Report verwiesen werden.
  support_email    TEXT
                   CHECK (support_email IS NULL OR support_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- Branding aktiv? Per Default true, sobald die Zeile existiert.
  -- Damit kann der Tenant Branding temporär ausschalten, ohne die
  -- konfigurierten Felder zu verlieren.
  enabled          BOOLEAN NOT NULL DEFAULT true,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_branding IS
  'Per-Tenant-Branding-Overrides für White-Label-Reports (Agency / Scale). Entitlement-Gate: whitelabel.reports.';

CREATE OR REPLACE FUNCTION public.tenant_branding_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tenant_branding_update_modtime ON public.tenant_branding;
CREATE TRIGGER tenant_branding_update_modtime
  BEFORE UPDATE ON public.tenant_branding
  FOR EACH ROW EXECUTE FUNCTION public.tenant_branding_set_updated_at();

-- RLS
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_branding member read" ON public.tenant_branding;
CREATE POLICY "tenant_branding member read"
  ON public.tenant_branding FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant_branding owner_admin write" ON public.tenant_branding;
CREATE POLICY "tenant_branding owner_admin write"
  ON public.tenant_branding FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.tenant_id = tenant_branding.tenant_id
         AND m.user_id   = auth.uid()
         AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "tenant_branding owner_admin update" ON public.tenant_branding;
CREATE POLICY "tenant_branding owner_admin update"
  ON public.tenant_branding FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.tenant_id = tenant_branding.tenant_id
         AND m.user_id   = auth.uid()
         AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.tenant_id = tenant_branding.tenant_id
         AND m.user_id   = auth.uid()
         AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "tenant_branding service-role full access" ON public.tenant_branding;
CREATE POLICY "tenant_branding service-role full access"
  ON public.tenant_branding FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.tenant_branding TO authenticated;
GRANT ALL                    ON public.tenant_branding TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- Resolver-RPC — liefert das effektive Branding für einen Tenant.
-- Berücksichtigt das whitelabel.reports-Entitlement (Tier-Gate) sowie
-- den enabled-Flag. Wenn kein Branding-Override greift, gibt die
-- Funktion eine Zeile mit ausschließlich NULL-Werten zurück — Caller
-- merkt das daran und nimmt seine Defaults.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tenant_branding_effective(p_tenant_id UUID)
RETURNS TABLE (
  tenant_id          UUID,
  whitelabel_active  BOOLEAN,
  brand_name         TEXT,
  logo_storage_path  TEXT,
  primary_color      TEXT,
  accent_color       TEXT,
  footer_text        TEXT,
  support_email      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH ent AS (
    SELECT (te.value > 0) AS has_whitelabel
    FROM public.tenant_entitlements(p_tenant_id) te
    WHERE te.key = 'whitelabel.reports'
    LIMIT 1
  ),
  br AS (
    SELECT * FROM public.tenant_branding WHERE tenant_id = p_tenant_id
  )
  SELECT
    p_tenant_id,
    COALESCE((SELECT has_whitelabel FROM ent), false)
      AND COALESCE((SELECT enabled FROM br), false) AS whitelabel_active,
    -- Nur ausliefern, wenn Entitlement + enabled. Sonst NULL → Caller-Defaults.
    CASE WHEN COALESCE((SELECT has_whitelabel FROM ent), false)
              AND COALESCE((SELECT enabled FROM br), false)
         THEN (SELECT brand_name FROM br) ELSE NULL END,
    CASE WHEN COALESCE((SELECT has_whitelabel FROM ent), false)
              AND COALESCE((SELECT enabled FROM br), false)
         THEN (SELECT logo_storage_path FROM br) ELSE NULL END,
    CASE WHEN COALESCE((SELECT has_whitelabel FROM ent), false)
              AND COALESCE((SELECT enabled FROM br), false)
         THEN (SELECT primary_color FROM br) ELSE NULL END,
    CASE WHEN COALESCE((SELECT has_whitelabel FROM ent), false)
              AND COALESCE((SELECT enabled FROM br), false)
         THEN (SELECT accent_color FROM br) ELSE NULL END,
    CASE WHEN COALESCE((SELECT has_whitelabel FROM ent), false)
              AND COALESCE((SELECT enabled FROM br), false)
         THEN (SELECT footer_text FROM br) ELSE NULL END,
    CASE WHEN COALESCE((SELECT has_whitelabel FROM ent), false)
              AND COALESCE((SELECT enabled FROM br), false)
         THEN (SELECT support_email FROM br) ELSE NULL END;
$$;

COMMENT ON FUNCTION public.tenant_branding_effective(UUID) IS
  'Liefert effektive Branding-Felder für einen Tenant. Felder sind nur dann gesetzt, wenn der Tenant das whitelabel.reports-Entitlement hat UND enabled=true. Sonst alle NULL.';

GRANT EXECUTE ON FUNCTION public.tenant_branding_effective(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_branding_effective(UUID) TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- Optional: tenant_id auf gdpr_audits, damit Reports einem zahlenden
-- Tenant zugeordnet werden können (für White-Label-Routing). NULL für
-- die Lead-Magnet-Submissions (anonym, kein Tenant).
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.gdpr_audits
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gdpr_audits_tenant_id
  ON public.gdpr_audits(tenant_id)
  WHERE tenant_id IS NOT NULL;

COMMENT ON COLUMN public.gdpr_audits.tenant_id IS
  'Owner-Tenant (nullable). NULL = anonymer Lead-Magnet-Submit. Gesetzt = Report kann White-Label-Branding via tenant_branding_effective() bekommen.';

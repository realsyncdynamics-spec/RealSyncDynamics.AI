-- Pilot-Aktivierung: Free Audit → 14-Tage-Pilot → Governance Runtime.
-- Entspricht Repo-Datei 20260811120000_pilot_activation.sql (PR #1010).
-- Ausschließlich additiv: keine Spalte, Tabelle oder Policy wird entfernt,
-- RLS bleibt überall aktiv.

-- ── 1. Audit-Ownership ──────────────────────────────────────────────────────
ALTER TABLE public.gdpr_audits
  ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_id UUID
    REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_gdpr_audits_user
  ON public.gdpr_audits(user_id);

CREATE INDEX IF NOT EXISTS idx_gdpr_audits_tenant
  ON public.gdpr_audits(tenant_id);

CREATE INDEX IF NOT EXISTS idx_gdpr_audits_unclaimed
  ON public.gdpr_audits(created_at)
  WHERE claimed_at IS NULL;

COMMENT ON COLUMN public.gdpr_audits.user_id IS
  'Der User, der den Audit beim Pilot-Start beansprucht hat. NULL = anonym.';
COMMENT ON COLUMN public.gdpr_audits.tenant_id IS
  'Der Tenant, dem der Audit gehört. NULL = anonym. Wird gemeinsam mit user_id und claimed_at gesetzt.';
COMMENT ON COLUMN public.gdpr_audits.claimed_at IS
  'Zeitpunkt des Übergangs anonym → tenant-eigen. Einmalig; ein zweiter Tenant kann denselben Audit nicht beanspruchen.';

-- ── 2. RLS — Tenant liest den eigenen, beanspruchten Audit ──────────────────
-- `tenant_id IS NOT NULL` explizit: is_tenant_member(NULL) liefert NULL, nicht
-- false — der Guard macht anonyme Zeilen unmissverständlich unsichtbar.
DROP POLICY IF EXISTS "gdpr_audits tenant_read" ON public.gdpr_audits;
CREATE POLICY "gdpr_audits tenant_read"
    ON public.gdpr_audits FOR SELECT
    USING (
      tenant_id IS NOT NULL
      AND public.is_tenant_member(tenant_id)
    );

-- ── 3. Blocker: subscriptions.stripe_customer_id war NOT NULL ───────────────
-- Der kartenlose 14-Tage-Pilot erzeugt bewusst KEINEN Stripe-Kunden; Stripe
-- kommt erst beim Upgrade über den Checkout ins Spiel.
ALTER TABLE public.subscriptions
  ALTER COLUMN stripe_customer_id DROP NOT NULL;

COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS
  'Stripe-Kunden-ID. NULL für kartenlose Trials/Pilots, die nie einen Stripe-Kunden erzeugen; wird beim Upgrade über den Checkout gesetzt.';

-- ── 4. Race-sicheres Monitoring-Enrollment ──────────────────────────────────
-- monitoring_sources hat keinen Unique-Constraint auf (tenant_id, url); ein
-- SELECT-dann-INSERT ist unter READ COMMITTED nicht sicher. Ein Transaktions-
-- Advisory-Lock serialisiert konkurrierende Aktivierungen derselben Domain,
-- ohne Schema oder Bestandsdaten anzufassen.
CREATE OR REPLACE FUNCTION public.pilot_enroll_monitoring_source(
  p_tenant_id UUID,
  p_url       TEXT,
  p_name      TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_tenant_id IS NULL OR p_url IS NULL OR length(btrim(p_url)) = 0 THEN
    RAISE EXCEPTION 'pilot_enroll_monitoring_source: tenant_id und url sind erforderlich';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('pilot_monitoring_source:' || p_tenant_id::text || ':' || p_url)
  );

  SELECT id INTO v_id
    FROM public.monitoring_sources
   WHERE tenant_id = p_tenant_id
     AND type = 'website'
     AND url = p_url
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE public.monitoring_sources
       SET status       = 'active',
           next_scan_at = LEAST(COALESCE(next_scan_at, now()), now()),
           updated_at   = now()
     WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.monitoring_sources
    (tenant_id, type, name, url, status, next_scan_at, scan_frequency)
  VALUES
    (p_tenant_id, 'website', COALESCE(NULLIF(btrim(p_name), ''), p_url),
     p_url, 'active', now(), 'daily')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pilot_enroll_monitoring_source(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_enroll_monitoring_source(UUID, TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.pilot_enroll_monitoring_source(UUID, TEXT, TEXT) IS
  'Idempotentes, race-sicheres Enrollment einer Domain in monitoring_sources. Serialisiert per pg_advisory_xact_lock über (tenant_id, url), weil die Tabelle keinen Unique-Constraint hat. Gibt die id der aktiven Quelle zurück.';

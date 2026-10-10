-- pilot_enroll_monitoring_source: vorhandene Quellen nicht mehr anfassen.
--
-- Anlass: Schritt 3 des Funnel-Entscheids („Domain Enrollment verdrahten",
-- docs/product/canonical-funnel-decision.md) ruft die Funktion aus dem
-- catalog-Schritt von `provision-tenant` auf. `provision-tenant` ist zugleich
-- der Status-Endpunkt des Tenant-Boots und wird wiederholt aufgerufen.
--
-- Die Fassung aus 20260811020648 hat bei einer schon vorhandenen Quelle
-- `status = 'active'` und `next_scan_at = now()` gesetzt. Jeder Status-Abruf
-- hätte damit
--   * einen sofortigen Scan ausgelöst (Kosten, Last auf die Ziel-Domain) und
--   * eine vom Kunden pausierte Quelle wieder aktiviert.
--
-- Ab hier legt die Funktion eine Quelle nur noch an, wenn es für
-- (tenant_id, url) keine gibt, und gibt sonst die vorhandene id unverändert
-- zurück. Status und Scan-Zeitplan gehören danach dem Kunden und dem
-- governance-monitoring-scheduler.
--
-- Signatur, Rechte und Advisory-Lock bleiben gleich. Kein Schema-, Daten- oder
-- RLS-Eingriff; `monitoring_sources` hatte beim Anlegen dieser Migration in
-- Produktion 0 Zeilen.

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

  -- monitoring_sources hat keinen Unique-Constraint auf (tenant_id, url).
  -- Der Lock serialisiert konkurrierende Aufrufe für dieselbe Domain desselben
  -- Tenants bis zum Transaktionsende.
  PERFORM pg_advisory_xact_lock(
    hashtext('pilot_monitoring_source:' || p_tenant_id::text || ':' || p_url)
  );

  SELECT id INTO v_id
    FROM public.monitoring_sources
   WHERE tenant_id = p_tenant_id
     AND type = 'website'
     AND url = p_url
   ORDER BY created_at
   LIMIT 1;

  IF v_id IS NOT NULL THEN
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
  'Legt eine Website-Quelle in monitoring_sources an, falls es für (tenant_id, url) noch keine gibt, und gibt sonst die vorhandene id unverändert zurück. Serialisiert per pg_advisory_xact_lock. Aufrufer: provision-tenant (catalog-Schritt).';

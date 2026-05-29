-- Tenant-Aktivierungs-Tracking — kanonische Quelle für die Aktivierungs-
-- Metrik des 90-Tage-Programms.
--
-- Aktivierung ist definiert als:
--   Erster Scan abgeschlossen UND mindestens ein Report exportiert.
--
-- Modell: eine Zeile pro Tenant in public.tenant_activation mit
-- nullable-Timestamps pro Meilenstein. Sobald BEIDE Meilensteine
-- gesetzt sind, wird activated_at automatisch auf den späteren der
-- beiden Zeitpunkte gesetzt — der Tenant gilt ab dann als „activated".
--
-- Befüllung passiert per DB-Trigger auf den Quell-Tabellen
-- (scan_runs, audit_evidence) — keine Edge-Function-Änderung nötig.
-- Trigger sind idempotent (nur First-Event capturen via COALESCE-NULL).
--
-- Vorteile dieses Designs:
--   - Triggers können nicht vergessen werden, wenn neue Code-Pfade
--     Scans / Reports erzeugen.
--   - Tabelle ist O(1)-lookup pro Tenant.
--   - Aggregationen (Aktivierungsrate / Kohorten) sind trivial.
--
-- Erweiterung später:
--   Weitere Meilensteine (z. B. „API-Key generiert", „Webhook konfiguriert")
--   bekommen jeweils eine neue Spalte + Trigger. Append-only-Stil.

-- ─────────────────────────────────────────────────────────────────────
-- 1. tenant_activation Tabelle
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_activation (
  tenant_id                   UUID PRIMARY KEY
                              REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_scan_completed_at     TIMESTAMPTZ,
  first_scan_run_id           UUID,
  first_report_exported_at    TIMESTAMPTZ,
  first_report_audit_id       UUID,
  activated_at                TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_activation IS
  'Aktivierungs-Meilensteine pro Tenant. activated_at = beide Pflicht-Meilensteine (Scan + Report) erfüllt.';
COMMENT ON COLUMN public.tenant_activation.activated_at IS
  'Setpunkt der späteren der beiden Meilensteine. Read-only — wird vom Trigger berechnet.';

CREATE INDEX IF NOT EXISTS tenant_activation_activated_idx
  ON public.tenant_activation (activated_at)
  WHERE activated_at IS NOT NULL;

-- updated_at-Trigger
CREATE OR REPLACE FUNCTION public.tenant_activation_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  -- activated_at = später der beiden Meilensteine, sobald beide gesetzt
  IF NEW.first_scan_completed_at IS NOT NULL
     AND NEW.first_report_exported_at IS NOT NULL
     AND NEW.activated_at IS NULL
  THEN
    NEW.activated_at := GREATEST(
      NEW.first_scan_completed_at,
      NEW.first_report_exported_at
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tenant_activation_update_modtime ON public.tenant_activation;
CREATE TRIGGER tenant_activation_update_modtime
  BEFORE INSERT OR UPDATE ON public.tenant_activation
  FOR EACH ROW EXECUTE FUNCTION public.tenant_activation_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 2. RLS — Tenant-Members lesen ihren eigenen Aktivierungsstatus.
--    Service-Role schreibt (via Trigger-Owner / Edge Functions).
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.tenant_activation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_activation tenant member read" ON public.tenant_activation;
CREATE POLICY "tenant_activation tenant member read"
  ON public.tenant_activation FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "tenant_activation service-role full access" ON public.tenant_activation;
CREATE POLICY "tenant_activation service-role full access"
  ON public.tenant_activation FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT ON public.tenant_activation TO authenticated;
GRANT ALL    ON public.tenant_activation TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Trigger: scan_runs.status → 'completed' → first_scan_completed_at
--    Erster abgeschlossener Scan pro Tenant gewinnt (COALESCE-NULL).
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tenant_activation_capture_scan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_should_capture BOOLEAN := false;
BEGIN
  -- Nur beim Transit nach 'completed' triggern (nicht bei jedem UPDATE
  -- eines bereits abgeschlossenen Runs). Wir splitten nach TG_OP, damit
  -- OLD niemals im INSERT-Pfad dereferenziert wird.
  IF TG_OP = 'INSERT' AND NEW.status = 'completed' THEN
    v_should_capture := true;
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'completed'
        AND OLD.status IS DISTINCT FROM 'completed' THEN
    v_should_capture := true;
  END IF;

  IF v_should_capture THEN
    INSERT INTO public.tenant_activation
      (tenant_id, first_scan_completed_at, first_scan_run_id)
    VALUES
      (NEW.tenant_id, COALESCE(NEW.completed_at, now()), NEW.id)
    ON CONFLICT (tenant_id) DO UPDATE
      SET first_scan_completed_at = COALESCE(
            public.tenant_activation.first_scan_completed_at,
            EXCLUDED.first_scan_completed_at
          ),
          first_scan_run_id       = COALESCE(
            public.tenant_activation.first_scan_run_id,
            EXCLUDED.first_scan_run_id
          );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS scan_runs_capture_activation ON public.scan_runs;
CREATE TRIGGER scan_runs_capture_activation
  AFTER INSERT OR UPDATE OF status ON public.scan_runs
  FOR EACH ROW EXECUTE FUNCTION public.tenant_activation_capture_scan();

-- ─────────────────────────────────────────────────────────────────────
-- 4. Trigger: audit_evidence INSERT → first_report_exported_at
--    Sobald die erste Evidence-Zeile pro Tenant entsteht, gilt das als
--    „Report exportiert" — Evidence ist der zuverlässigste Marker für
--    „der Kunde hat was Exportierbares in der Hand".
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tenant_activation_capture_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.tenant_activation
    (tenant_id, first_report_exported_at, first_report_audit_id)
  VALUES
    (NEW.tenant_id, COALESCE(NEW.created_at, now()), NEW.audit_id)
  ON CONFLICT (tenant_id) DO UPDATE
    SET first_report_exported_at = COALESCE(
          public.tenant_activation.first_report_exported_at,
          EXCLUDED.first_report_exported_at
        ),
        first_report_audit_id   = COALESCE(
          public.tenant_activation.first_report_audit_id,
          EXCLUDED.first_report_audit_id
        );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_evidence_capture_activation ON public.audit_evidence;
CREATE TRIGGER audit_evidence_capture_activation
  AFTER INSERT ON public.audit_evidence
  FOR EACH ROW EXECUTE FUNCTION public.tenant_activation_capture_report();

-- ─────────────────────────────────────────────────────────────────────
-- 5. Backfill bestehender Tenants — kein Datenverlust für Kunden, die
--    bereits Scans/Reports erstellt haben, bevor Tracking lief.
-- ─────────────────────────────────────────────────────────────────────

-- 5a. Backfill aus scan_runs
INSERT INTO public.tenant_activation
  (tenant_id, first_scan_completed_at, first_scan_run_id)
SELECT
  sr.tenant_id,
  MIN(sr.completed_at) AS first_completed,
  (SELECT id FROM public.scan_runs sr2
    WHERE sr2.tenant_id = sr.tenant_id AND sr2.status = 'completed'
    ORDER BY sr2.completed_at ASC LIMIT 1) AS first_run_id
FROM public.scan_runs sr
WHERE sr.status = 'completed' AND sr.completed_at IS NOT NULL
GROUP BY sr.tenant_id
ON CONFLICT (tenant_id) DO UPDATE
  SET first_scan_completed_at = COALESCE(
        public.tenant_activation.first_scan_completed_at,
        EXCLUDED.first_scan_completed_at
      ),
      first_scan_run_id       = COALESCE(
        public.tenant_activation.first_scan_run_id,
        EXCLUDED.first_scan_run_id
      );

-- 5b. Backfill aus audit_evidence
INSERT INTO public.tenant_activation
  (tenant_id, first_report_exported_at, first_report_audit_id)
SELECT
  ae.tenant_id,
  MIN(ae.created_at) AS first_export,
  (SELECT audit_id FROM public.audit_evidence ae2
    WHERE ae2.tenant_id = ae.tenant_id
    ORDER BY ae2.created_at ASC LIMIT 1) AS first_audit
FROM public.audit_evidence ae
WHERE ae.tenant_id IS NOT NULL
GROUP BY ae.tenant_id
ON CONFLICT (tenant_id) DO UPDATE
  SET first_report_exported_at = COALESCE(
        public.tenant_activation.first_report_exported_at,
        EXCLUDED.first_report_exported_at
      ),
      first_report_audit_id   = COALESCE(
        public.tenant_activation.first_report_audit_id,
        EXCLUDED.first_report_audit_id
      );

-- 5c. activated_at-Backfill für Zeilen, bei denen beide Meilensteine
--     bereits gesetzt sind (der updated-Trigger feuert beim Backfill-
--     UPDATE und setzt activated_at automatisch; dieser explizite UPDATE
--     deckt die Backfill-INSERT-Zeilen ab, wo beide direkt zusammen kamen).
UPDATE public.tenant_activation
   SET activated_at = GREATEST(first_scan_completed_at, first_report_exported_at)
 WHERE activated_at IS NULL
   AND first_scan_completed_at  IS NOT NULL
   AND first_report_exported_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Aggregations-RPC für die Analytics-/Admin-Dashboards.
--    Liefert die Aktivierungs-Funnel-Zahlen für ein Zeitfenster.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tenant_activation_funnel(
  p_since TIMESTAMPTZ DEFAULT (now() - interval '30 days')
)
RETURNS TABLE (
  tenants_total              BIGINT,
  scan_completed             BIGINT,
  report_exported            BIGINT,
  activated                  BIGINT,
  activation_rate_percent    NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH cohort AS (
    SELECT t.id AS tenant_id
    FROM public.tenants t
    WHERE t.created_at >= p_since
  ),
  joined AS (
    SELECT c.tenant_id, ta.first_scan_completed_at, ta.first_report_exported_at, ta.activated_at
    FROM cohort c
    LEFT JOIN public.tenant_activation ta ON ta.tenant_id = c.tenant_id
  )
  SELECT
    COUNT(*)::bigint                                            AS tenants_total,
    COUNT(*) FILTER (WHERE first_scan_completed_at IS NOT NULL)::bigint  AS scan_completed,
    COUNT(*) FILTER (WHERE first_report_exported_at IS NOT NULL)::bigint AS report_exported,
    COUNT(*) FILTER (WHERE activated_at IS NOT NULL)::bigint    AS activated,
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE ROUND(
        100.0 * COUNT(*) FILTER (WHERE activated_at IS NOT NULL) / COUNT(*),
        1
      )
    END AS activation_rate_percent
  FROM joined;
$$;

COMMENT ON FUNCTION public.tenant_activation_funnel(TIMESTAMPTZ) IS
  'Aktivierungs-Funnel für die in p_since gestarteten Tenants. activation_rate_percent ist das KPI für das 90-Tage-Programm (Ziel: >=80%).';

REVOKE ALL ON FUNCTION public.tenant_activation_funnel(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_activation_funnel(TIMESTAMPTZ) TO service_role;

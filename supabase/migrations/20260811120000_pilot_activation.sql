-- Pilot-Aktivierung: Free Audit → 14-Tage-Pilot → Governance Runtime.
--
-- Verbindet den anonymen Lead-Magnet-Audit (`gdpr_audits`, 20260506110000) mit
-- dem authentifizierten Tenant. Bis hierher war ein Audit dauerhaft besitzerlos:
-- die Tabelle hatte keinerlei Ownership-Spalten, der Report-CTA verlor den
-- `audit_id` und der Datensatz war für den Kunden nie erreichbar.
--
-- Ausschließlich additiv: keine Spalte, Tabelle oder Policy wird entfernt,
-- RLS bleibt überall aktiv.
--
-- Compliance-Bezug
--   DSGVO Art. 5 Abs. 1 lit. b (Zweckbindung): Der Übergang eines anonymen
--   Scans in die Verantwortung eines Tenants wird mit `claimed_at` als
--   Zeitpunkt festgehalten und ist damit im Prüfpfad nachvollziehbar.
--   EU AI Act Art. 12 (Aufzeichnungspflichten): Der gewährte Governance-Umfang
--   muss aus persistierten Verträgen ableitbar sein — dafür muss die
--   Pilot-Subscription überhaupt angelegt werden können (siehe Abschnitt 3).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Audit-Ownership
-- ─────────────────────────────────────────────────────────────────────────────
-- Alle drei Spalten sind NULL, solange der Audit anonym ist. Der Claim setzt
-- sie gemeinsam und genau einmal (siehe Edge Function `pilot-activate`).
-- ON DELETE SET NULL statt CASCADE: Ein gelöschter User/Tenant darf die
-- Audit-Historie nicht mitreißen — der Nachweis, dass ein Scan stattgefunden
-- hat, bleibt bestehen (DSGVO Art. 5 Abs. 1 lit. e, Aufbewahrung).

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

-- Partieller Index für den Claim-Pfad: der atomare UPDATE filtert auf
-- „noch nicht beansprucht", das ist die einzige heiße Abfrage auf diesen
-- Spalten.
CREATE INDEX IF NOT EXISTS idx_gdpr_audits_unclaimed
  ON public.gdpr_audits(created_at)
  WHERE claimed_at IS NULL;

COMMENT ON COLUMN public.gdpr_audits.user_id IS
  'Der User, der den Audit beim Pilot-Start beansprucht hat. NULL = anonym.';
COMMENT ON COLUMN public.gdpr_audits.tenant_id IS
  'Der Tenant, dem der Audit gehört. NULL = anonym. Wird gemeinsam mit user_id und claimed_at gesetzt.';
COMMENT ON COLUMN public.gdpr_audits.claimed_at IS
  'Zeitpunkt des Übergangs anonym → tenant-eigen. Einmalig; ein zweiter Tenant kann denselben Audit nicht beanspruchen.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — Tenant liest den eigenen, beanspruchten Audit
-- ─────────────────────────────────────────────────────────────────────────────
-- Bisher durfte laut 20260506110000 ausschließlich `is_super_admin` lesen. Ohne
-- die folgende Policy könnte ein Kunde den Audit, den er gerade beansprucht hat,
-- im eigenen Dashboard nicht sehen — die Daten wären zwar zugeordnet, aber
-- unerreichbar.
--
-- Warum `tenant_id IS NOT NULL` explizit: `is_tenant_member(NULL)` liefert NULL,
-- nicht false. Ohne den Guard hinge die Sichtbarkeit anonymer Zeilen an der
-- NULL-Semantik der Policy-Auswertung — der Guard macht sie unmissverständlich
-- unsichtbar.
--
-- `is_tenant_member` ist der etablierte SECURITY-DEFINER-Helper aus
-- 20260723000001_rls_recursion_fix_security_definer.sql; er löst über
-- `memberships` auf und vermeidet die RLS-Rekursion.

DROP POLICY IF EXISTS "gdpr_audits tenant_read" ON public.gdpr_audits;
CREATE POLICY "gdpr_audits tenant_read"
    ON public.gdpr_audits FOR SELECT
    USING (
      tenant_id IS NOT NULL
      AND public.is_tenant_member(tenant_id)
    );

-- Die bestehende Policy "gdpr_audits super_admin_read" bleibt unverändert
-- bestehen. Schreibzugriff weiterhin ausschließlich über service_role
-- (Edge Functions `gdpr-audit` und `pilot-activate`).

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Blocker: subscriptions.stripe_customer_id war NOT NULL
-- ─────────────────────────────────────────────────────────────────────────────
-- `stripe_customer_id TEXT NOT NULL` stammt aus 20260406000000_entitlements_schema
-- und wurde nie gelockert. Jede Subscription ohne Stripe-Kunden scheiterte damit
-- am INSERT (SQLSTATE 23502) — betroffen ist genau der Fall, den der Pilot
-- braucht: ein Tenant ohne Abo-Zeile, der einen kartenlosen 14-Tage-Trial startet.
--
-- Der Pilot erzeugt bewusst KEINEN Stripe-Kunden: er ist kartenlos, es gibt
-- nichts abzurechnen, und eine Stripe-Abhängigkeit an dieser Stelle würde die
-- Aktivierung an die Verfügbarkeit externer Secrets koppeln. Ein Stripe-Kunde
-- entsteht erst beim Upgrade über den bestehenden Checkout.
--
-- Bestandsdaten bleiben unberührt: das Lockern einer NOT-NULL-Bedingung
-- invalidiert keine vorhandene Zeile.

ALTER TABLE public.subscriptions
  ALTER COLUMN stripe_customer_id DROP NOT NULL;

COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS
  'Stripe-Kunden-ID. NULL für kartenlose Trials/Pilots, die nie einen Stripe-Kunden erzeugen; wird beim Upgrade über den Checkout gesetzt.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Race-sicheres Monitoring-Enrollment
-- ─────────────────────────────────────────────────────────────────────────────
-- `monitoring_sources` (20260624000002) hat KEINEN Unique-Constraint auf
-- (tenant_id, url). Ein naives SELECT-dann-INSERT ist unter READ COMMITTED
-- nicht sicher: zwei gleichzeitige Aktivierungen sehen beide „existiert nicht"
-- und legen beide an.
--
-- Warum kein neuer Unique-Index: Die Tabelle steht in Produktion und der
-- Migrations-Ledger ist bekanntermaßen nicht deckungsgleich mit dem Repo
-- (docs/runbooks/p0-2-migration-reconciliation.md). Ein CREATE UNIQUE INDEX
-- würde an vorhandenen Duplikaten scheitern und damit alle nachfolgenden
-- Migrationen blockieren — das Risiko steht in keinem Verhältnis.
--
-- Stattdessen serialisiert ein Transaktions-Advisory-Lock über
-- (tenant_id, url). Er wird beim Commit/Rollback automatisch freigegeben,
-- sperrt nur diese eine Domain dieses einen Tenants und fasst weder Schema
-- noch Bestandsdaten an.
--
-- SECURITY DEFINER, weil der Aufrufer (Edge Function `pilot-activate`) zwar
-- mit service_role arbeitet, die Atomarität aber im Statement selbst liegen
-- soll statt in mehreren PostgREST-Roundtrips.

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

  -- Serialisiert konkurrierende Aktivierungen derselben Domain desselben
  -- Tenants. Gilt bis zum Transaktionsende.
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
    -- Wiederholte Aktivierung: reaktivieren, aber einen bereits früher
    -- geplanten Scan nicht nach hinten schieben.
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

-- Nur die Edge Function darf das aufrufen — der Browser hat hier nichts zu suchen.
REVOKE ALL ON FUNCTION public.pilot_enroll_monitoring_source(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pilot_enroll_monitoring_source(UUID, TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.pilot_enroll_monitoring_source(UUID, TEXT, TEXT) IS
  'Idempotentes, race-sicheres Enrollment einer Domain in monitoring_sources. Serialisiert per pg_advisory_xact_lock über (tenant_id, url), weil die Tabelle keinen Unique-Constraint hat. Gibt die id der aktiven Quelle zurück.';

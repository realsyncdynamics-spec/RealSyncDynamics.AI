-- Onboarding-Verkürzung: anonyme Lead-Magnet-Audits beim Signup
-- automatisch dem neuen Tenant zuordnen.
--
-- Heutiger Friction-Point:
--   Nutzer macht auf /audit einen anonymen DSGVO-Scan (Lead-Magnet,
--   gdpr_audits.tenant_id = NULL). Will er das Ergebnis vertieft sehen,
--   muss er sich registrieren — und steht dann vor einem leeren
--   Workspace. Er muss die Domain erneut eingeben und auf einen zweiten
--   Scan warten. Aktivierungszeit > 10 Minuten.
--
-- Diese Migration schließt diese Lücke:
--   1. claim_anonymous_audits_for_tenant(tenant_id, email) übernimmt
--      alle gdpr_audits-Zeilen mit gleicher Email (case-insensitiv) und
--      tenant_id IS NULL in den neuen Tenant.
--   2. Wird ein Audit übernommen, wird tenant_activation.
--      first_scan_completed_at auf den frühesten Audit-Zeitpunkt
--      gestempelt — d. h. der Aktivierungsmilestone „erster Scan
--      abgeschlossen" zählt rückwirkend ab dem anonymen Free-Audit.
--   3. handle_new_auth_user (Auto-Tenant-on-Signup) ruft die Funktion
--      direkt nach Tenant-Erstellung auf. Ergebnis: ab Magic-Link-
--      Return ist mindestens ein Audit-Report im Workspace sichtbar,
--      ohne dass der Nutzer eine zweite Domain eingeben muss.
--
-- Sicherheitsmodell:
--   SECURITY DEFINER, weil sowohl auth-trigger-Kontext als auch ein
--   späterer Manual-Call (z. B. Invite-Flow) das RLS auf gdpr_audits
--   und tenant_activation umgehen muss. Die Funktion validiert Email
--   und Tenant-ID explizit, um Missbrauch zu vermeiden.

CREATE OR REPLACE FUNCTION public.claim_anonymous_audits_for_tenant(
  p_tenant_id UUID,
  p_email     TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count    INTEGER := 0;
  v_earliest TIMESTAMPTZ;
BEGIN
  IF p_tenant_id IS NULL OR p_email IS NULL OR trim(p_email) = '' THEN
    RETURN 0;
  END IF;

  -- Defensive: Tenant muss existieren, damit der UPDATE keinen Orphan
  -- pointer setzt (ON DELETE SET NULL fängt das später ab, aber wir
  -- wollen den fehlerhaften Call gleich abblocken).
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RETURN 0;
  END IF;

  UPDATE public.gdpr_audits
     SET tenant_id = p_tenant_id
   WHERE tenant_id IS NULL
     AND lower(email) = lower(p_email);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    -- Frühester übernommener Audit zählt als „first_scan_completed_at"
    -- für den Aktivierungs-Funnel — sonst würde die Aktivierungsrate
    -- den Vorlauf-Free-Audit komplett unterschlagen.
    SELECT min(created_at) INTO v_earliest
      FROM public.gdpr_audits
     WHERE tenant_id = p_tenant_id
       AND lower(email) = lower(p_email);

    INSERT INTO public.tenant_activation
      (tenant_id, first_scan_completed_at)
    VALUES (p_tenant_id, v_earliest)
    ON CONFLICT (tenant_id) DO UPDATE
       SET first_scan_completed_at = COALESCE(
             public.tenant_activation.first_scan_completed_at,
             EXCLUDED.first_scan_completed_at
           );
  END IF;

  RETURN v_count;
END $$;

COMMENT ON FUNCTION public.claim_anonymous_audits_for_tenant(UUID, TEXT) IS
  'Übernimmt alle anonymen gdpr_audits-Zeilen mit passender Email in den Tenant. Stempelt tenant_activation.first_scan_completed_at auf den frühesten Audit-Zeitpunkt (idempotent via COALESCE). Liefert die Anzahl übernommener Zeilen.';

REVOKE ALL ON FUNCTION public.claim_anonymous_audits_for_tenant(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_anonymous_audits_for_tenant(UUID, TEXT) TO service_role;

-- ─────────────────────────────────────────────────────────────────────
-- handle_new_auth_user erweitern: Audits nach Tenant-Erstellung
-- direkt übernehmen. Die Logik bleibt sonst identisch.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_local_part  TEXT;
    v_tenant_name TEXT;
    v_tenant_id   UUID;
BEGIN
    -- Skip if this user already has any membership (defensive — re-runs
    -- of seed scripts shouldn't double-create).
    IF EXISTS (SELECT 1 FROM public.memberships WHERE user_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    v_local_part  := COALESCE(split_part(NEW.email, '@', 1), 'mein-team');
    v_tenant_name := initcap(replace(v_local_part, '.', ' ')) || '''s Workspace';

    INSERT INTO public.tenants (name)
    VALUES (v_tenant_name)
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (v_tenant_id, NEW.id, 'owner');

    -- Onboarding-Verkürzung: übernehme anonyme gdpr_audits mit gleicher
    -- Email-Adresse. So sieht der Nutzer beim ersten Login direkt
    -- mindestens einen Audit-Report im Workspace, ohne dass er nochmal
    -- eine Domain eingeben muss. Fehler werden gefangen, damit der
    -- Signup auch dann durchgeht, wenn die Übernahme aus irgendeinem
    -- Grund scheitert (z. B. fehlende Tabelle in einem Test-Setup).
    BEGIN
      PERFORM public.claim_anonymous_audits_for_tenant(v_tenant_id, NEW.email);
    EXCEPTION WHEN OTHERS THEN
      -- best-effort — Signup darf nicht wegen Audit-Claim scheitern.
      NULL;
    END;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
    'Bootstraps tenant + owner membership for every new auth.users row und übernimmt anonyme gdpr_audits mit passender Email (best-effort). SECURITY DEFINER required.';

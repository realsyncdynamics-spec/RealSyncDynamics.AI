-- AP2 — memberships als einzige Mitgliedschaftsquelle (additiv)
--
-- Freigabe: Dominik Steiner, 20.11.2026 (Branch, additive Migration, RLS-Tests,
-- Draft-PR). Nicht gegen Produktion ausgefuehrt. Kein DROP der Tabelle.
--
-- Abhaengigkeiten (Endstand der Migrationskette auf main @ 20261118150000):
--   * public.memberships und public.is_tenant_member(uuid)
--     (20260430180000, spaeter 20260723000001)
--   * public.tenant_memberships und public.has_tenant_membership(uuid)
--     (20260602100000)
--   * public.notify_quota_alert (letzte Fassung 20260705140000)
--
-- Was umgestellt wird
--   1. has_tenant_membership liest nur noch ueber is_tenant_member, also
--      public.memberships. Signatur, SECURITY DEFINER, search_path und Grants
--      bleiben. Dadurch folgen alle Aufrufer ohne Textaenderung:
--        Policies: runtime_events tenant-read, runtime_event_cursors tenant-read,
--          tenant_cost_ledger tenant-read, tenant_cost_caps tenant-read
--        Views: v_cost_per_tenant, v_cost_per_feature, v_cost_per_agent,
--          v_tenant_risk_score, v_tenant_risk_cost_quadrant,
--          v_compliance_signals_open
--        Funktionen: runtime_events_advance_cursor, runtime_events_verify_chain,
--          request_subject_erasure, incident_correlation_export,
--          propagate_cost_attribution, compute_tenant_risk_score,
--          compute_subject_risk_score, compute_racpo, compute_tenant_quadrant,
--          detect_token_explosion, detect_consent_regression,
--          detect_cost_per_outcome_explosion, dsr_subject_inventory
--   2. Policies, deren Ausdruck die Tabelle tenant_memberships direkt nennt,
--      werden nur ersetzt, wenn sie existieren (kein Wiederanlegen einer
--      bereits entfernten Policy):
--        api_calls.api_calls tenant_member_read
--        webhook_endpoints tenant_member_read|insert|update|delete
--        webhook_deliveries.webhook_deliveries tenant_member_read
--        quota_alerts.quota_alerts tenant_member_read
--        email_notifications.email_notifications tenant_member_read
--        custom_controls: Users can read|create|update|delete controls in their frameworks
--        custom_framework_mappings: Users can read|create|delete mappings in their frameworks
--        api_rate_limit_configs: Users can view|update their tenant's rate limit configs
--        api_rate_limit_violations: Users can view their tenant's rate limit violations
--   3. notify_quota_alert sucht Admin-Empfaenger in memberships.role = 'admin'.
--
-- Rollenmapping (Existenz vs. Admin-Mail)
--   tenant_memberships: owner | admin | member | viewer
--   memberships:       owner | admin | dpo | editor | viewer_auditor
--   Existenzpruefungen fragen keine Rolle ab. Jede Zeile in memberships
--   entspricht einer Zeile in tenant_memberships, unabhaengig vom Token.
--   'member' und 'viewer' haben in memberships kein gleichnamiges Token;
--   editor, dpo und viewer_auditor sind dort die operativen bzw. lesenden
--   Rollen und zaehlen bei der Existenz mit.
--   Die Admin-Mail bleibt exakt role = 'admin'. owner wird nicht ergaenzt
--   (das war vorher auch so). Ein Admin nur in tenant_memberships, dessen
--   memberships-Rolle nicht admin ist, bekommt die Mail danach nicht mehr.
--   Das weist supabase/verify/ap2_tenant_memberships_coverage.sql aus.
--
-- Bestandsschutz
--   Liegt eine tenant_memberships-Zeile ohne (tenant_id, user_id) in
--   memberships, bricht diese Migration ab, bevor etwas umgestellt wird.
--   Sie kopiert keine Zeilen: 'member'/'viewer' passen nicht in den
--   aktuellen memberships-Check.
--
-- Einfrieren
--   Kommentar plus Entzug von INSERT/UPDATE/DELETE/TRUNCATE fuer anon,
--   authenticated und PUBLIC. SELECT bleibt. service_role und Eigentuemer
--   bleiben, sonst brechen bestehende Tests und Wartung. Die eigenen
--   Policies der Tabelle (self-read, deny-writes) bleiben.
--
-- Rollback: supabase/rollback/20261120160200_ap2_memberships_single_source.sql
-- Rueckbau-Entwurf (nicht aktiv): supabase/drafts/NOT_ACTIVATED_ap2_drop_tenant_memberships.sql

-- 1. Abbruch, wenn die Altzeilen nicht in memberships enthalten sind.
DO $ap2_guard$
DECLARE
  missing integer;
BEGIN
  IF to_regclass('public.tenant_memberships') IS NULL
     OR to_regclass('public.memberships') IS NULL THEN
    RAISE EXCEPTION
      'AP2 abgebrochen: memberships oder tenant_memberships fehlt.';
  END IF;

  SELECT count(*)::integer
    INTO missing
    FROM public.tenant_memberships tm
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.memberships m
      WHERE m.tenant_id = tm.tenant_id
        AND m.user_id = tm.user_id
   );

  IF missing > 0 THEN
    RAISE EXCEPTION
      'AP2 abgebrochen: % Zeile(n) in tenant_memberships ohne Gegenstueck (tenant_id, user_id) in memberships. Zuerst supabase/verify/ap2_tenant_memberships_coverage.sql auswerten. Nichts wurde umgestellt.',
      missing;
  END IF;
END
$ap2_guard$;

-- 2. Kompatibilitaetsfunktion auf memberships umstellen.
CREATE OR REPLACE FUNCTION public.has_tenant_membership(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.is_tenant_member(p_tenant_id);
$$;

COMMENT ON FUNCTION public.has_tenant_membership(UUID) IS
    'AP2: Kompatibilitaetsname. Liest ausschliesslich ueber is_tenant_member (public.memberships). Signatur, SECURITY DEFINER, search_path und Grants unveraendert. tenant_memberships ist keine Quelle mehr.';

-- 3. Direkt verweisende Policies nur ersetzen, wenn sie noch existieren.
CREATE OR REPLACE FUNCTION public.ap2_replace_policy(p_table text, p_name text, p_sql text)
RETURNS void
LANGUAGE plpgsql
AS $ap2_replace$
BEGIN
  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policy
     WHERE polrelid = format('public.%I', p_table)::regclass
       AND polname = p_name
  ) THEN
    RETURN;
  END IF;
  EXECUTE format('DROP POLICY %I ON public.%I', p_name, p_table);
  EXECUTE p_sql;
END
$ap2_replace$;

SELECT public.ap2_replace_policy(
  'api_calls',
  'api_calls tenant_member_read',
  $sql$CREATE POLICY "api_calls tenant_member_read"
    ON public.api_calls FOR SELECT
    USING (public.is_tenant_member(tenant_id))$sql$
);

SELECT public.ap2_replace_policy(
  'webhook_endpoints',
  'webhook_endpoints tenant_member_read',
  $sql$CREATE POLICY "webhook_endpoints tenant_member_read"
    ON public.webhook_endpoints FOR SELECT
    USING (public.is_tenant_member(tenant_id))$sql$
);
SELECT public.ap2_replace_policy(
  'webhook_endpoints',
  'webhook_endpoints tenant_member_insert',
  $sql$CREATE POLICY "webhook_endpoints tenant_member_insert"
    ON public.webhook_endpoints FOR INSERT
    WITH CHECK (public.is_tenant_member(tenant_id))$sql$
);
SELECT public.ap2_replace_policy(
  'webhook_endpoints',
  'webhook_endpoints tenant_member_update',
  $sql$CREATE POLICY "webhook_endpoints tenant_member_update"
    ON public.webhook_endpoints FOR UPDATE
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id))$sql$
);
SELECT public.ap2_replace_policy(
  'webhook_endpoints',
  'webhook_endpoints tenant_member_delete',
  $sql$CREATE POLICY "webhook_endpoints tenant_member_delete"
    ON public.webhook_endpoints FOR DELETE
    USING (public.is_tenant_member(tenant_id))$sql$
);

SELECT public.ap2_replace_policy(
  'webhook_deliveries',
  'webhook_deliveries tenant_member_read',
  $sql$CREATE POLICY "webhook_deliveries tenant_member_read"
    ON public.webhook_deliveries FOR SELECT
    USING (EXISTS (
      SELECT 1
        FROM public.webhook_endpoints we
       WHERE we.id = webhook_deliveries.webhook_id
         AND public.is_tenant_member(we.tenant_id)
    ))$sql$
);

SELECT public.ap2_replace_policy(
  'quota_alerts',
  'quota_alerts tenant_member_read',
  $sql$CREATE POLICY "quota_alerts tenant_member_read"
    ON public.quota_alerts FOR SELECT
    USING (public.is_tenant_member(tenant_id))$sql$
);

SELECT public.ap2_replace_policy(
  'email_notifications',
  'email_notifications tenant_member_read',
  $sql$CREATE POLICY "email_notifications tenant_member_read"
    ON public.email_notifications FOR SELECT
    USING (public.is_tenant_member(tenant_id))$sql$
);

SELECT public.ap2_replace_policy(
  'custom_controls',
  'Users can read controls in their frameworks',
  $sql$CREATE POLICY "Users can read controls in their frameworks"
    ON public.custom_controls FOR SELECT
    USING (framework_id IN (
      SELECT cf.id FROM public.custom_frameworks cf
       WHERE public.is_tenant_member(cf.tenant_id)
    ))$sql$
);
SELECT public.ap2_replace_policy(
  'custom_controls',
  'Users can create controls in their frameworks',
  $sql$CREATE POLICY "Users can create controls in their frameworks"
    ON public.custom_controls FOR INSERT
    WITH CHECK (framework_id IN (
      SELECT cf.id FROM public.custom_frameworks cf
       WHERE public.is_tenant_member(cf.tenant_id)
    ))$sql$
);
SELECT public.ap2_replace_policy(
  'custom_controls',
  'Users can update controls in their frameworks',
  $sql$CREATE POLICY "Users can update controls in their frameworks"
    ON public.custom_controls FOR UPDATE
    USING (framework_id IN (
      SELECT cf.id FROM public.custom_frameworks cf
       WHERE public.is_tenant_member(cf.tenant_id)
    ))$sql$
);
SELECT public.ap2_replace_policy(
  'custom_controls',
  'Users can delete controls in their frameworks',
  $sql$CREATE POLICY "Users can delete controls in their frameworks"
    ON public.custom_controls FOR DELETE
    USING (framework_id IN (
      SELECT cf.id FROM public.custom_frameworks cf
       WHERE public.is_tenant_member(cf.tenant_id)
    ))$sql$
);

SELECT public.ap2_replace_policy(
  'custom_framework_mappings',
  'Users can read mappings in their frameworks',
  $sql$CREATE POLICY "Users can read mappings in their frameworks"
    ON public.custom_framework_mappings FOR SELECT
    USING (framework_id IN (
      SELECT cf.id FROM public.custom_frameworks cf
       WHERE public.is_tenant_member(cf.tenant_id)
    ))$sql$
);
SELECT public.ap2_replace_policy(
  'custom_framework_mappings',
  'Users can create mappings in their frameworks',
  $sql$CREATE POLICY "Users can create mappings in their frameworks"
    ON public.custom_framework_mappings FOR INSERT
    WITH CHECK (framework_id IN (
      SELECT cf.id FROM public.custom_frameworks cf
       WHERE public.is_tenant_member(cf.tenant_id)
    ))$sql$
);
SELECT public.ap2_replace_policy(
  'custom_framework_mappings',
  'Users can delete mappings in their frameworks',
  $sql$CREATE POLICY "Users can delete mappings in their frameworks"
    ON public.custom_framework_mappings FOR DELETE
    USING (framework_id IN (
      SELECT cf.id FROM public.custom_frameworks cf
       WHERE public.is_tenant_member(cf.tenant_id)
    ))$sql$
);

-- Der Zweig tenants.id = auth.uid() bleibt erhalten (Bestand, praktisch leer).
SELECT public.ap2_replace_policy(
  'api_rate_limit_configs',
  'Users can view their tenant''s rate limit configs',
  $sql$CREATE POLICY "Users can view their tenant's rate limit configs"
    ON public.api_rate_limit_configs FOR SELECT
    USING (
      tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid())
      OR public.is_tenant_member(tenant_id)
    )$sql$
);
SELECT public.ap2_replace_policy(
  'api_rate_limit_configs',
  'Users can update their tenant''s rate limit configs',
  $sql$CREATE POLICY "Users can update their tenant's rate limit configs"
    ON public.api_rate_limit_configs FOR UPDATE
    USING (
      tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid())
      OR public.is_tenant_member(tenant_id)
    )$sql$
);
SELECT public.ap2_replace_policy(
  'api_rate_limit_violations',
  'Users can view their tenant''s rate limit violations',
  $sql$CREATE POLICY "Users can view their tenant's rate limit violations"
    ON public.api_rate_limit_violations FOR SELECT
    USING (
      tenant_id IN (SELECT id FROM public.tenants WHERE id = auth.uid())
      OR public.is_tenant_member(tenant_id)
    )$sql$
);

DROP FUNCTION public.ap2_replace_policy(text, text, text);

-- 4. Admin-Mail aus memberships. Sonst unveraenderte Fassung von 20260705140000.
CREATE OR REPLACE FUNCTION public.notify_quota_alert(
  p_tenant_id UUID,
  p_alert_type TEXT,
  p_api_calls_count INTEGER,
  p_quota_limit INTEGER
) RETURNS void AS $$
DECLARE
  v_alert_id UUID;
  v_member_email TEXT;
  v_subject TEXT;
  v_body TEXT;
BEGIN
  INSERT INTO public.quota_alerts (tenant_id, alert_type, api_calls_count, quota_limit, message)
  VALUES (
    p_tenant_id,
    p_alert_type,
    p_api_calls_count,
    p_quota_limit,
    CASE
      WHEN p_alert_type = 'warning_80' THEN 'API quota usage at 80% (' || p_api_calls_count || '/' || p_quota_limit || ')'
      WHEN p_alert_type = 'limit_exceeded' THEN 'API quota limit exceeded (' || p_api_calls_count || '/' || p_quota_limit || ')'
      ELSE 'API quota alert'
    END
  ) RETURNING id INTO v_alert_id;

  INSERT INTO public.webhook_deliveries (webhook_id, event_type, event_data, created_at)
  SELECT
    we.id,
    p_alert_type,
    jsonb_build_object(
      'event_type', p_alert_type,
      'tenant_id', p_tenant_id,
      'timestamp', now()::text,
      'api_calls', p_api_calls_count,
      'quota_limit', p_quota_limit,
      'message', CASE
        WHEN p_alert_type = 'warning_80' THEN 'Your API quota usage is at 80%'
        WHEN p_alert_type = 'limit_exceeded' THEN 'Your API quota limit has been exceeded'
        ELSE 'API quota alert'
      END
    ),
    now()
  FROM public.webhook_endpoints we
  WHERE we.tenant_id = p_tenant_id
    AND we.is_active = true
    AND p_alert_type = ANY(we.events);

  -- AP2: Empfaenger aus memberships, weiterhin nur role = 'admin'.
  FOR v_member_email IN
    SELECT u.email
    FROM public.memberships m
    JOIN auth.users u ON m.user_id = u.id
    WHERE m.tenant_id = p_tenant_id AND m.role = 'admin'
  LOOP
    v_subject := CASE
      WHEN p_alert_type = 'warning_80' THEN 'Alert: API Quota at 80%'
      WHEN p_alert_type = 'limit_exceeded' THEN 'Alert: API Quota Exceeded'
      ELSE 'API Quota Alert'
    END;

    v_body := CASE
      WHEN p_alert_type = 'warning_80' THEN 'Your API quota usage has reached 80% (' || p_api_calls_count || ' of ' || p_quota_limit || ' calls). Please review your usage or upgrade your plan.'
      WHEN p_alert_type = 'limit_exceeded' THEN 'Your API quota limit has been exceeded (' || p_api_calls_count || ' of ' || p_quota_limit || ' calls). Further API requests will be blocked. Please upgrade your plan or contact support.'
      ELSE 'An API quota event has occurred.'
    END;

    INSERT INTO public.email_notifications (tenant_id, recipient_email, event_type, subject, body, created_at)
    VALUES (p_tenant_id, v_member_email, p_alert_type, v_subject, v_body, now());
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Nichts darf die Alttabelle weiter als Quelle nennen.
DO $ap2_left$
DECLARE
  leftover text;
BEGIN
  SELECT string_agg(n.nspname || '.' || c.relname || ' / ' || p.polname, ', ' ORDER BY c.relname, p.polname)
    INTO leftover
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname <> 'tenant_memberships'
     AND (
       coalesce(pg_get_expr(p.polqual, p.polrelid), '') ILIKE '%tenant_memberships%'
       OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ILIKE '%tenant_memberships%'
     );
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'AP2: Policies verweisen weiter auf tenant_memberships: %', leftover;
  END IF;

  SELECT string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ' ORDER BY p.proname)
    INTO leftover
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosrc ILIKE '%tenant_memberships%';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'AP2: Funktionen verweisen weiter auf tenant_memberships: %', leftover;
  END IF;

  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO leftover
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind IN ('v', 'm')
     AND pg_get_viewdef(c.oid) ILIKE '%tenant_memberships%';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'AP2: Views verweisen weiter auf tenant_memberships: %', leftover;
  END IF;
END
$ap2_left$;

-- 6. Tabelle einfrieren. Grants nur einmal sichern, damit ein zweiter Lauf
--    den Snapshot nicht leert.
DO $ap2_freeze$
DECLARE
  snap text;
  comment_text text;
BEGIN
  IF coalesce(obj_description('public.tenant_memberships'::regclass), '')
     LIKE '%AP2_WRITE_GRANT_SNAPSHOT=%' THEN
    RETURN;
  END IF;

  SELECT coalesce(string_agg(grantee || '=' || privilege_type, ',' ORDER BY grantee, privilege_type), '')
    INTO snap
    FROM (
      SELECT CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END AS grantee,
             a.privilege_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r'::"char", c.relowner))) a
        LEFT JOIN pg_roles r ON r.oid = a.grantee
       WHERE n.nspname = 'public'
         AND c.relname = 'tenant_memberships'
         AND a.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
         AND (a.grantee = 0 OR r.rolname IN ('anon', 'authenticated'))
    ) s;

  comment_text :=
    'EINGEFROREN (AP2, 2026-11-20). Keine Mitgliedschaftsquelle. '
    || 'INSERT/UPDATE/DELETE/TRUNCATE fuer anon, authenticated und PUBLIC entzogen. SELECT bleibt. '
    || 'service_role und Eigentuemer unveraendert. Tabelle nicht geloescht. '
    || E'\nAP2_WRITE_GRANT_SNAPSHOT=' || snap;

  EXECUTE format('COMMENT ON TABLE public.tenant_memberships IS %L', comment_text);
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.tenant_memberships FROM PUBLIC;
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.tenant_memberships FROM anon;
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.tenant_memberships FROM authenticated;
END
$ap2_freeze$;

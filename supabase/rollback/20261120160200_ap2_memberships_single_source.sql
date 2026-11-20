-- Rollback AP2. Nicht Teil von supabase/migrations, wird von db push nicht angewendet.
-- Stellt den Funktions- und Policy-Stand von vor 20261120160200 wieder her
-- und gibt genau die Schreibrechte zurueck, die der Vorwaertslauf entzogen hat.
-- Voraussetzung: die Vorwaerts-Migration wurde angewendet.
-- Nicht gegen Produktion ausgefuehrt.

CREATE OR REPLACE FUNCTION public.has_tenant_membership(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.tenant_memberships
         WHERE tenant_id = p_tenant_id
           AND user_id   = auth.uid()
    );
$$;

COMMENT ON FUNCTION public.has_tenant_membership(UUID) IS
    'SPEC-001 RLS helper. Returns true iff auth.uid() is a member of the given tenant. SECURITY DEFINER to avoid RLS recursion.';

CREATE OR REPLACE FUNCTION public.notify_quota_alert(
  p_tenant_id UUID,
  p_alert_type TEXT,
  p_api_calls_count INTEGER,
  p_quota_limit INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_alert_id UUID;
  v_member_email TEXT;
  v_subject TEXT;
  v_body TEXT;
  v_email_event TEXT;
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

  -- Seit 20260705200000 hat webhook_deliveries kein webhook_id. Ein statisches
  -- INSERT bricht den Aufruf ab, bevor die Admin-Mail geschrieben wird.
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'webhook_deliveries'
       AND column_name = 'webhook_id'
  ) THEN
    EXECUTE $ins$
      INSERT INTO public.webhook_deliveries (webhook_id, event_type, event_data, created_at)
      SELECT
        we.id,
        $1,
        jsonb_build_object(
          'event_type', $1,
          'tenant_id', $2,
          'timestamp', now()::text,
          'api_calls', $3,
          'quota_limit', $4,
          'message', CASE
            WHEN $1 = 'warning_80' THEN 'Your API quota usage is at 80%'
            WHEN $1 = 'limit_exceeded' THEN 'Your API quota limit has been exceeded'
            ELSE 'API quota alert'
          END
        ),
        now()
      FROM public.webhook_endpoints we
      WHERE we.tenant_id = $2
        AND we.is_active = true
        AND $1 = ANY(we.events)
    $ins$
    USING p_alert_type, p_tenant_id, p_api_calls_count, p_quota_limit;
  END IF;

  -- email_notifications.event_type erlaubt warning_80 nicht
  -- (Check aus 20260705140000). Die Empfaenger bleiben tenant_memberships.admin.
  v_email_event := CASE p_alert_type
    WHEN 'warning_80' THEN 'quota_warning'
    WHEN 'limit_exceeded' THEN 'quota_exceeded'
    ELSE p_alert_type
  END;

  FOR v_member_email IN
    SELECT u.email
    FROM public.tenant_memberships m
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
    VALUES (p_tenant_id, v_member_email, v_email_event, v_subject, v_body, now());
  END LOOP;
END;
$fn$;

-- Policies nur zuruecksetzen, wenn sie vorhanden sind. Eine in Produktion
-- bereits entfernte Policy wird hier nicht wieder angelegt.
DO $ap2_rb$
BEGIN
  -- ::regclass in derselben Bedingung wie to_regclass wirft, wenn die
  -- Tabelle fehlt. Deshalb erst die Existenz, dann die Policy.
  IF to_regclass('public.api_calls') IS NOT NULL THEN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.api_calls'::regclass AND polname = 'api_calls tenant_member_read') THEN
    DROP POLICY "api_calls tenant_member_read" ON public.api_calls;
    CREATE POLICY "api_calls tenant_member_read"
      ON public.api_calls FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = api_calls.tenant_id AND m.user_id = auth.uid()
      ));
  END IF;
  END IF;

  IF to_regclass('public.webhook_endpoints') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.webhook_endpoints'::regclass AND polname = 'webhook_endpoints tenant_member_read') THEN
      DROP POLICY "webhook_endpoints tenant_member_read" ON public.webhook_endpoints;
      CREATE POLICY "webhook_endpoints tenant_member_read"
        ON public.webhook_endpoints FOR SELECT
        USING (EXISTS (
          SELECT 1 FROM public.tenant_memberships m
          WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.webhook_endpoints'::regclass AND polname = 'webhook_endpoints tenant_member_insert') THEN
      DROP POLICY "webhook_endpoints tenant_member_insert" ON public.webhook_endpoints;
      CREATE POLICY "webhook_endpoints tenant_member_insert"
        ON public.webhook_endpoints FOR INSERT
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.tenant_memberships m
          WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.webhook_endpoints'::regclass AND polname = 'webhook_endpoints tenant_member_update') THEN
      DROP POLICY "webhook_endpoints tenant_member_update" ON public.webhook_endpoints;
      CREATE POLICY "webhook_endpoints tenant_member_update"
        ON public.webhook_endpoints FOR UPDATE
        USING (EXISTS (
          SELECT 1 FROM public.tenant_memberships m
          WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
        ))
        WITH CHECK (EXISTS (
          SELECT 1 FROM public.tenant_memberships m
          WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.webhook_endpoints'::regclass AND polname = 'webhook_endpoints tenant_member_delete') THEN
      DROP POLICY "webhook_endpoints tenant_member_delete" ON public.webhook_endpoints;
      CREATE POLICY "webhook_endpoints tenant_member_delete"
        ON public.webhook_endpoints FOR DELETE
        USING (EXISTS (
          SELECT 1 FROM public.tenant_memberships m
          WHERE m.tenant_id = webhook_endpoints.tenant_id AND m.user_id = auth.uid()
        ));
    END IF;
  END IF;

  -- Nur wiederherstellen, wenn die Policy existiert UND jede Spalte, die der
  -- Ausdruck nennt. Seit 20260705200000 fehlt webhook_id; die Policy gibt es
  -- live nicht. DROP und CREATE bleiben in derselben Bedingung, sonst bliebe
  -- nach einem Abbruch keine Lese-Policy uebrig.
  IF to_regclass('public.webhook_deliveries') IS NOT NULL
     AND to_regclass('public.webhook_endpoints') IS NOT NULL
     AND to_regclass('public.tenant_memberships') IS NOT NULL THEN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.webhook_deliveries'::regclass AND polname = 'webhook_deliveries tenant_member_read')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'webhook_deliveries' AND column_name = 'webhook_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'webhook_endpoints' AND column_name = 'id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'webhook_endpoints' AND column_name = 'tenant_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_memberships' AND column_name = 'tenant_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_memberships' AND column_name = 'user_id')
  THEN
    DROP POLICY "webhook_deliveries tenant_member_read" ON public.webhook_deliveries;
    CREATE POLICY "webhook_deliveries tenant_member_read"
      ON public.webhook_deliveries FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.webhook_endpoints we
        JOIN public.tenant_memberships m ON we.tenant_id = m.tenant_id
        WHERE we.id = webhook_deliveries.webhook_id AND m.user_id = auth.uid()
      ));
  END IF;
  END IF;

  IF to_regclass('public.quota_alerts') IS NOT NULL THEN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.quota_alerts'::regclass AND polname = 'quota_alerts tenant_member_read') THEN
    DROP POLICY "quota_alerts tenant_member_read" ON public.quota_alerts;
    CREATE POLICY "quota_alerts tenant_member_read"
      ON public.quota_alerts FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = quota_alerts.tenant_id AND m.user_id = auth.uid()
      ));
  END IF;
  END IF;

  IF to_regclass('public.email_notifications') IS NOT NULL THEN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.email_notifications'::regclass AND polname = 'email_notifications tenant_member_read') THEN
    DROP POLICY "email_notifications tenant_member_read" ON public.email_notifications;
    CREATE POLICY "email_notifications tenant_member_read"
      ON public.email_notifications FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM public.tenant_memberships m
        WHERE m.tenant_id = email_notifications.tenant_id AND m.user_id = auth.uid()
      ));
  END IF;
  END IF;

  IF to_regclass('public.custom_controls') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.custom_controls'::regclass AND polname = 'Users can read controls in their frameworks') THEN
      DROP POLICY "Users can read controls in their frameworks" ON public.custom_controls;
      CREATE POLICY "Users can read controls in their frameworks"
        ON public.custom_controls FOR SELECT
        USING (framework_id IN (
          SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
          )
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.custom_controls'::regclass AND polname = 'Users can create controls in their frameworks') THEN
      DROP POLICY "Users can create controls in their frameworks" ON public.custom_controls;
      CREATE POLICY "Users can create controls in their frameworks"
        ON public.custom_controls FOR INSERT
        WITH CHECK (framework_id IN (
          SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
          )
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.custom_controls'::regclass AND polname = 'Users can update controls in their frameworks') THEN
      DROP POLICY "Users can update controls in their frameworks" ON public.custom_controls;
      CREATE POLICY "Users can update controls in their frameworks"
        ON public.custom_controls FOR UPDATE
        USING (framework_id IN (
          SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
          )
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.custom_controls'::regclass AND polname = 'Users can delete controls in their frameworks') THEN
      DROP POLICY "Users can delete controls in their frameworks" ON public.custom_controls;
      CREATE POLICY "Users can delete controls in their frameworks"
        ON public.custom_controls FOR DELETE
        USING (framework_id IN (
          SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
          )
        ));
    END IF;
  END IF;

  IF to_regclass('public.custom_framework_mappings') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.custom_framework_mappings'::regclass AND polname = 'Users can read mappings in their frameworks') THEN
      DROP POLICY "Users can read mappings in their frameworks" ON public.custom_framework_mappings;
      CREATE POLICY "Users can read mappings in their frameworks"
        ON public.custom_framework_mappings FOR SELECT
        USING (framework_id IN (
          SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
          )
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.custom_framework_mappings'::regclass AND polname = 'Users can create mappings in their frameworks') THEN
      DROP POLICY "Users can create mappings in their frameworks" ON public.custom_framework_mappings;
      CREATE POLICY "Users can create mappings in their frameworks"
        ON public.custom_framework_mappings FOR INSERT
        WITH CHECK (framework_id IN (
          SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
          )
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.custom_framework_mappings'::regclass AND polname = 'Users can delete mappings in their frameworks') THEN
      DROP POLICY "Users can delete mappings in their frameworks" ON public.custom_framework_mappings;
      CREATE POLICY "Users can delete mappings in their frameworks"
        ON public.custom_framework_mappings FOR DELETE
        USING (framework_id IN (
          SELECT id FROM public.custom_frameworks WHERE tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()
          )
        ));
    END IF;
  END IF;

  IF to_regclass('public.api_rate_limit_configs') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.api_rate_limit_configs'::regclass AND polname = 'Users can view their tenant''s rate limit configs') THEN
      DROP POLICY "Users can view their tenant's rate limit configs" ON public.api_rate_limit_configs;
      CREATE POLICY "Users can view their tenant's rate limit configs"
        ON public.api_rate_limit_configs FOR SELECT
        USING (tenant_id IN (
          SELECT id FROM public.tenants WHERE id = auth.uid() OR
          id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
        ));
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.api_rate_limit_configs'::regclass AND polname = 'Users can update their tenant''s rate limit configs') THEN
      DROP POLICY "Users can update their tenant's rate limit configs" ON public.api_rate_limit_configs;
      CREATE POLICY "Users can update their tenant's rate limit configs"
        ON public.api_rate_limit_configs FOR UPDATE
        USING (tenant_id IN (
          SELECT id FROM public.tenants WHERE id = auth.uid() OR
          id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
        ));
    END IF;
  END IF;

  IF to_regclass('public.api_rate_limit_violations') IS NOT NULL THEN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.api_rate_limit_violations'::regclass AND polname = 'Users can view their tenant''s rate limit violations') THEN
    DROP POLICY "Users can view their tenant's rate limit violations" ON public.api_rate_limit_violations;
    CREATE POLICY "Users can view their tenant's rate limit violations"
      ON public.api_rate_limit_violations FOR SELECT
      USING (tenant_id IN (
        SELECT id FROM public.tenants WHERE id = auth.uid() OR
        id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid())
      ));
  END IF;
  END IF;
END
$ap2_rb$;

-- Entzogene Schreibrechte aus dem Snapshot zurueckgeben, Kommentar loeschen.
DO $ap2_unfreeze$
DECLARE
  comment_text text;
  snap text;
  item text;
  role_name text;
  priv text;
BEGIN
  comment_text := obj_description('public.tenant_memberships'::regclass);
  snap := substring(coalesce(comment_text, '') FROM 'AP2_WRITE_GRANT_SNAPSHOT=([^\n]*)');
  IF snap IS NOT NULL AND btrim(snap) <> '' THEN
    FOREACH item IN ARRAY string_to_array(snap, ',') LOOP
      role_name := split_part(item, '=', 1);
      priv := split_part(item, '=', 2);
      IF priv NOT IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE') THEN
        CONTINUE;
      END IF;
      IF role_name = 'PUBLIC' THEN
        EXECUTE format('GRANT %s ON TABLE public.tenant_memberships TO PUBLIC', priv);
      ELSIF role_name IN ('anon', 'authenticated') THEN
        EXECUTE format('GRANT %s ON TABLE public.tenant_memberships TO %I', priv, role_name);
      END IF;
    END LOOP;
  END IF;
  COMMENT ON TABLE public.tenant_memberships IS NULL;
END
$ap2_unfreeze$;

-- Gate 0 — Security Hardening (Mandantentrennung vor jeder Dashboard-Arbeit)
--
-- Gemessen am 2026-09-27 gegen das voll migrierte Schema (alle Migrationen,
-- CI-Bootstrap): Drei Klassen von Lücken, jede einzeln geprüft — nicht
-- pauschal geändert.
--
-- 1. Policies mit `true`, die als „Service role …“ benannt sind, aber ohne
--    `TO service_role` angelegt wurden. Sie gelten damit für PUBLIC, also
--    auch für anon und authenticated. service_role umgeht RLS ohnehin
--    (BYPASSRLS); die Policies haben für den Server-Weg nie etwas bewirkt,
--    für den Browser dagegen alles geöffnet:
--      governance_audit_log        INSERT  → Prüfpfad fälschbar
--      website_compliance_reports  INSERT  → Berichte für fremde Mandanten anlegbar
--                                  UPDATE  → heute nur durch die SELECT-Policy
--                                            (20260924033000) gebremst; mitgehärtet
--      deployment_logs             INSERT
--      dashboard_notifications     INSERT  → Benachrichtigungen an beliebige Nutzer
--      api_calls                   INSERT  → Nutzungszähler fremder Mandanten manipulierbar
--      email_notifications         INSERT
--      agent_token_usage           INSERT, SELECT → Verbrauch aller Mandanten lesbar
--      agent_configuration         ALL     → Budgets fremder Mandanten lesbar und änderbar
--    Korrektur: `ALTER POLICY … TO service_role`. Die Policies bleiben
--    bestehen, nur ihre Rollenbindung wird korrekt. Legitime Schreiber sind
--    ausschliesslich Edge Functions mit Admin-Client und SECURITY-DEFINER-
--    Funktionen (Tabelleneigentümer, umgehen RLS) — beide unberührt.
--    agent_token_usage behält eine Leseregel für Mitglieder des eigenen
--    Mandanten.
--
--    Bewusst NICHT geändert (geprüft, gewollt):
--      * Read-all-Policies auf Referenzkatalogen ohne tenant_id
--        (framework_controls, compliance_frameworks, iso_control_*,
--        policy_pack_*, agent_profiles, workflow_templates,
--        webhook_event_types, sub_processor_changes).
--      * sub_processor_subscriptions „sp_sub_anon_insert“: öffentliche
--        Anmeldung für Art.-28-Hinweise, laut 20260507140000 so gewollt.
--        Restrisiko (frei wählbare tenant_id beim Anmelden) ist im PR
--        dokumentiert und gehört in eine eigene Entscheidung.
--      * webhook_deliveries: im Endschema bereits auf service_role gebunden.
--
-- 2. scan_results — die Lese-Policy aus 20260714000002 vergleicht
--    `tenant_id = (SELECT tenant_id FROM auth.users …)`. auth.users hat
--    keine Spalte tenant_id; Postgres bindet den Namen deshalb an die ÄUSSERE
--    Zeile (scan_results.tenant_id). Die Bedingung lautet effektiv
--    `tenant_id = tenant_id` — immer wahr. Dass das heute nicht leckt, liegt
--    allein daran, dass authenticated auth.users nicht lesen darf: jede
--    Abfrage bricht mit „permission denied for table users“ ab. Die Tabelle
--    ist damit für jeden Browser-Nutzer unlesbar (auch den eigenen Mandanten),
--    und ein künftiger Grant auf auth.users öffnete das Cross-Tenant-Leck.
--    Korrektur: kanonische Mitgliedschaft über public.is_tenant_member
--    (→ public.memberships).
--
-- 3. SECURITY-DEFINER-Funktionen mit p_tenant_id ohne Mitgliedschaftsprüfung,
--    aber für authenticated ausführbar: mcp_plan_limits, mcp_quota_state,
--    mcp_active_key_count, llm_quota_for_tenant, llm_quota_used_for_tenant.
--    Einzige Aufrufer sind Edge Functions über den Admin-Client
--    (mcp-api-key-manager, governance-agent, _shared/llm-quota.ts).
--    Korrektur: dieselbe Regel wie tenant_entitlements() (20260920130000):
--    service_role sieht alles, ein Nutzer nur seinen eigenen Mandanten,
--    alle anderen nichts (Tabellenfunktionen: keine Zeile; Skalare: NULL).
--
-- 4. Views über gehärtete Tabellen: agent_token_usage_analytics und
--    api_monthly_usage liefen ohne security_invoker mit den Rechten ihres
--    Eigentümers und umgingen damit die RLS der Basistabelle — anon las über
--    sie Zeilen fremder Mandanten, obwohl der direkte Zugriff 0 Zeilen
--    liefert. Mit security_invoker gilt die Policy der Basistabelle.
--    Identisch mit #1629 (dort gefunden); idempotent, falls beide landen.
--    Folge-Befund: Die Lese-Policy auf api_calls prüft gegen
--    tenant_memberships (einmal befüllt, kein Sync-Trigger). Erst durch
--    security_invoker greift sie wirklich — Mitglieder, die nur in
--    memberships stehen, sähen ihre eigene API-Nutzung (ApiUsageStats) nicht
--    mehr. Deshalb additiv eine Leseregel über die kanonische Mitgliedschaft
--    (is_tenant_member → public.memberships); die alte Policy bleibt.
--
-- Kanonische Mandanten-Autorität bleibt: JWT → public.memberships →
-- tenant_id. tenant_memberships wird hier nicht verwendet.
--
-- Nicht destruktiv: keine Tabelle, Spalte, Funktion oder Policy entfernt.
-- Geprüft durch test/runtime/db/gate0-security-hardening.db.test.ts.

-- ─── 1. Service-Role-Policies korrekt binden ────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('governance_audit_log',       'Service role can insert audit entries'),
      ('website_compliance_reports', 'Service role can insert/update reports'),
      ('website_compliance_reports', 'Service role can update reports'),
      ('deployment_logs',            'Service role can insert logs'),
      ('dashboard_notifications',    'Service role can create notifications'),
      ('api_calls',                  'api_calls service_role_insert'),
      ('email_notifications',        'email_notifications service_role_insert'),
      ('agent_token_usage',          'Service role can insert token usage'),
      ('agent_token_usage',          'Service role can view token usage'),
      ('agent_configuration',        'Service role can manage agent config')
    ) AS v(tbl, pol)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tbl AND policyname = r.pol
    ) THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO service_role', r.pol, r.tbl);
    ELSE
      -- Kein stilles Überspringen: Fehlt die Policy, ist das Schema anders als
      -- gemessen. Die Invariante im DB-Test fängt eine umbenannte Variante.
      RAISE NOTICE 'gate0: Policy % auf % nicht vorhanden — übersprungen', r.pol, r.tbl;
    END IF;
  END LOOP;
END $$;

-- Mitglieder lesen den Token-Verbrauch ihres eigenen Mandanten weiter.
DROP POLICY IF EXISTS "agent_token_usage tenant_member_read" ON public.agent_token_usage;
CREATE POLICY "agent_token_usage tenant_member_read"
  ON public.agent_token_usage FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- ─── 2. scan_results: kanonische Mitgliedschaft ─────────────────────────────

ALTER POLICY "Users can view their tenant's scan results"
  ON public.scan_results
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- ─── 3. SECURITY-DEFINER-Funktionen: Mitgliedschafts-Guard ──────────────────
--
-- Gleiche Signaturen und Rückgabetypen, gleiche Rechte (CREATE OR REPLACE
-- behält die ACL). Nur der Guard kommt hinzu.

CREATE OR REPLACE FUNCTION public.mcp_plan_limits(p_tenant_id UUID)
RETURNS TABLE (plan_key TEXT, api_access BOOLEAN, max_keys INT, max_calls_monthly INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH resolved_key AS (
        SELECT COALESCE(
            (SELECT regexp_replace(s.plan_key, '_yearly$', '')
               FROM public.subscriptions s
              WHERE s.tenant_id = p_tenant_id
              ORDER BY s.updated_at DESC
              LIMIT 1),
            'free_audit'
        ) AS k
    )
    SELECT
        c.plan_key,
        COALESCE((c.permissions ->> 'api')::BOOLEAN, FALSE),
        COALESCE((c.limits ->> 'apiKeys')::INT, 0),
        COALESCE((c.limits ->> 'apiCallsPerMonth')::INT, 0)
      FROM public.plan_catalog c
      JOIN resolved_key r ON c.plan_key = r.k
     WHERE auth.role() = 'service_role'
        OR public.is_tenant_member(p_tenant_id);
$$;

CREATE OR REPLACE FUNCTION public.mcp_quota_state(p_tenant_id UUID)
RETURNS TABLE (allowed BOOLEAN, api_access BOOLEAN, used BIGINT, limit_calls INT, plan_key TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT
        l.api_access
          AND (l.max_calls_monthly = -1 OR COALESCE(q.calls, 0) < l.max_calls_monthly),
        l.api_access,
        COALESCE(q.calls, 0),
        l.max_calls_monthly,
        l.plan_key
      FROM public.mcp_plan_limits(p_tenant_id) l
      LEFT JOIN public.mcp_quota_counters q
             ON q.tenant_id = p_tenant_id
            AND q.period_month = date_trunc('month', now())::DATE
     WHERE auth.role() = 'service_role'
        OR public.is_tenant_member(p_tenant_id);
$$;

CREATE OR REPLACE FUNCTION public.mcp_active_key_count(p_tenant_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT CASE
        WHEN auth.role() = 'service_role' OR public.is_tenant_member(p_tenant_id) THEN
            (SELECT COUNT(*)::INT
               FROM public.mcp_api_keys
              WHERE tenant_id = p_tenant_id
                AND active
                AND (expires_at IS NULL OR expires_at > now()))
    END;
$$;

CREATE OR REPLACE FUNCTION public.llm_quota_for_tenant(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' OR public.is_tenant_member(p_tenant_id) THEN
      COALESCE(
        (SELECT value
           FROM public.tenant_entitlements(p_tenant_id)
          WHERE key = 'limit.llm_queries_monthly'
          LIMIT 1),
        10
      )
  END;
$$;

CREATE OR REPLACE FUNCTION public.llm_quota_used_for_tenant(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.role() = 'service_role' OR public.is_tenant_member(p_tenant_id) THEN
      (SELECT COUNT(*)::int
         FROM public.llm_query_history
        WHERE tenant_id = p_tenant_id
          AND occurred_at >= date_trunc('month', now() AT TIME ZONE 'UTC'))
  END;
$$;

-- ─── 4. Views über gehärteten Tabellen: RLS nicht mehr umgehen ──────────────

ALTER VIEW public.agent_token_usage_analytics SET (security_invoker = on);
ALTER VIEW public.api_monthly_usage SET (security_invoker = on);

DROP POLICY IF EXISTS "api_calls member_read_canonical" ON public.api_calls;
CREATE POLICY "api_calls member_read_canonical"
  ON public.api_calls FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

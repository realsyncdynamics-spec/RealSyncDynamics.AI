-- Gate 0 — Ergänzung zu #1629 (Mandantentrennung vor jeder Dashboard-Arbeit)
--
-- #1629 (20260927120000_gate0_rls_hardening.sql) härtet die „Service role“-
-- Policies, die KI-Governance-Tabellen, ai_evidence_events, memberships und
-- die Views agent_token_usage_analytics/api_monthly_usage. Diese Migration
-- trägt nur, was dort fehlt — gemessen am 2026-09-27 gegen das voll migrierte
-- Schema, jeder Fall einzeln geprüft. Sie ist unabhängig von #1629 lauffähig.
--
-- 1. scan_results — die Lese-Policy aus 20260714000002 vergleicht
--    `tenant_id = (SELECT tenant_id FROM auth.users …)`. auth.users hat
--    keine Spalte tenant_id; Postgres bindet den Namen deshalb an die ÄUSSERE
--    Zeile (scan_results.tenant_id). Die Bedingung lautet effektiv
--    `tenant_id = tenant_id` — immer wahr. Dass das heute nicht leckt, liegt
--    allein daran, dass authenticated auth.users nicht lesen darf: jede
--    Abfrage bricht mit „permission denied for table users“ ab. Die Tabelle
--    ist damit für jeden Browser-Nutzer unlesbar (auch den eigenen Mandanten),
--    und ein künftiger Grant auf auth.users öffnete das Cross-Tenant-Leck.
--    Korrektur: kanonische Mitgliedschaft über public.is_tenant_member.
--
-- 2. SECURITY-DEFINER-Funktionen mit p_tenant_id ohne Mitgliedschaftsprüfung,
--    aber für authenticated ausführbar: mcp_plan_limits, mcp_quota_state,
--    mcp_active_key_count, llm_quota_for_tenant, llm_quota_used_for_tenant.
--    Ein fremder Nutzer las Plan, Kontingent und Key-Anzahl jedes Mandanten.
--    Einzige Aufrufer sind Edge Functions über den Admin-Client
--    (mcp-api-key-manager, governance-agent, _shared/llm-quota.ts).
--    Korrektur: dieselbe Regel wie tenant_entitlements() (20260920130000):
--    service_role sieht alles, ein Nutzer nur seinen eigenen Mandanten,
--    alle anderen nichts (Tabellenfunktionen: keine Zeile; Skalare: NULL).
--
-- 3. api_calls — die Lese-Policy prüft gegen tenant_memberships (einmal
--    befüllt, kein Sync-Trigger). Solange api_monthly_usage die RLS umging,
--    fiel das nicht auf. Mit security_invoker (#1629) greift sie wirklich:
--    Mitglieder, die nur in memberships stehen, sähen ihre eigene
--    API-Nutzung (ApiUsageStats) nicht mehr. Additive Leseregel über die
--    kanonische Mitgliedschaft; die alte Policy bleibt.
--
-- Kanonische Mandanten-Autorität bleibt: JWT → public.memberships →
-- tenant_id. tenant_memberships wird hier nicht verwendet.
--
-- Nicht destruktiv: keine Tabelle, Spalte, Funktion oder Policy entfernt.
-- Geprüft durch test/runtime/db/gate0-security-hardening.db.test.ts.

-- ─── 1. scan_results: kanonische Mitgliedschaft ─────────────────────────────

ALTER POLICY "Users can view their tenant's scan results"
  ON public.scan_results
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- ─── 2. SECURITY-DEFINER-Funktionen: Mitgliedschafts-Guard ──────────────────
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

-- ─── 3. api_calls: Leseregel über die kanonische Mitgliedschaft ─────────────

DROP POLICY IF EXISTS "api_calls member_read_canonical" ON public.api_calls;
CREATE POLICY "api_calls member_read_canonical"
  ON public.api_calls FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- MCP-Kontingente — Durchsetzung der Plan-Limits für den MCP Governance Server.
--
-- Bisher konnte jedes Tenant-Mitglied MCP-Keys ausstellen und den Server
-- unbegrenzt abfragen, unabhängig vom Plan. `shared/pricing.ts` sieht API-
-- Zugriff aber erst ab Agency vor und begrenzt ihn (apiKeys, apiCallsPerMonth).
-- Diese Migration liefert die Grundlage, um beides durchzusetzen.
--
-- Quelle der Limits ist bewusst `plan_catalog` und NICHT die
-- entitlements/product_entitlements-Kette hinter `tenant_entitlements()`:
-- `plan_catalog` wird aus shared/pricing.ts erzeugt und von
-- `npm run check:pricing` sowie `test/config/pricing-ssot.test.ts` gegen die
-- Quelle geprüft. Die entitlements-Werte für `limit.api_calls_monthly` stammen
-- aus 20260618000000 und sind gegenüber der Quelle veraltet (Growth 5000,
-- obwohl Growth keinen API-Zugriff hat; Plan-Key `scale`, der laut CLAUDE.md
-- nicht mehr existiert). Diese Abweichung wird hier NICHT stillschweigend
-- mitkorrigiert — sie betrifft alle bestehenden gateFeature-Aufrufer und
-- gehört in eine eigene Entscheidung.

-- ─── 1. Monatszähler ─────────────────────────────────────────────────────
--
-- Ein Zähler statt COUNT(*) über mcp_key_usage: die Prüfung läuft bei jedem
-- Request und muss ein einzelner indizierter Zeilenzugriff bleiben.
CREATE TABLE IF NOT EXISTS public.mcp_quota_counters (
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- Erster Tag des Abrechnungsmonats (UTC).
    period_month DATE NOT NULL,
    calls        BIGINT NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, period_month)
);

ALTER TABLE public.mcp_quota_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_quota_counters tenant-select" ON public.mcp_quota_counters;
CREATE POLICY "mcp_quota_counters tenant-select" ON public.mcp_quota_counters
    FOR SELECT USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.mcp_quota_counters IS
    'Verbrauchte MCP-Aufrufe pro Tenant und Monat. Wird von mcp_log_usage fortgeschrieben; Grundlage der 429-Sperre.';

-- ─── 2. Plan-Limits eines Tenants ────────────────────────────────────────
--
-- Auflösung wie in tenant_entitlements(): jüngste Subscription, sonst der
-- freie Plan. Jahres-Varianten (`agency_yearly`) tragen dieselben Limits wie
-- der Basisplan, deshalb wird das Suffix abgeschnitten.
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
      JOIN resolved_key r ON c.plan_key = r.k;
$$;

REVOKE ALL ON FUNCTION public.mcp_plan_limits(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_plan_limits(UUID) TO authenticated, service_role;

-- ─── 3. Kontingentstand ──────────────────────────────────────────────────
--
-- `allowed` fasst beides zusammen: kein API-Zugriff im Plan ODER Kontingent
-- ausgeschöpft. `-1` bedeutet in plan_catalog unbegrenzt.
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
            AND q.period_month = date_trunc('month', now())::DATE;
$$;

REVOKE ALL ON FUNCTION public.mcp_quota_state(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_quota_state(UUID) TO authenticated, service_role;

-- ─── 4. Zähler bei jeder Nutzung fortschreiben ───────────────────────────
--
-- mcp_log_usage wird ersetzt (gleiche Signatur): zusätzlich zum Protokoll
-- wird der Monatszähler erhöht. Lebenszyklus-Einträge des Triggers
-- (mcp_api_key.*) zählen NICHT als Aufruf — sie sind Verwaltung, kein Zugriff.
-- p_count = FALSE für Requests, die wegen des Kontingents abgewiesen wurden:
-- sie gehören in den Prüfpfad, aber nicht in die Verbrauchszahl. Sonst zählte
-- ein Agent in einer Schleife seinen eigenen Verbrauch über den tatsächlich
-- geleisteten Dienst hinaus — eine Zahl, die man niemandem in Rechnung stellen
-- oder als Nachweis vorlegen könnte.
CREATE OR REPLACE FUNCTION public.mcp_log_usage(
    p_key_id UUID,
    p_action TEXT,
    p_status INT,
    p_ip INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_latency_ms INT DEFAULT NULL,
    p_error TEXT DEFAULT NULL,
    p_count BOOLEAN DEFAULT TRUE
)
RETURNS void
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    INSERT INTO public.mcp_key_usage (
        key_id, action, status, ip_address, user_agent, latency_ms, error_message
    ) VALUES (p_key_id, p_action, p_status, p_ip, p_user_agent, p_latency_ms, p_error);

    UPDATE public.mcp_api_keys
       SET last_used_at = now(), last_used_ip = p_ip
     WHERE id = p_key_id
    RETURNING tenant_id INTO v_tenant_id;

    IF v_tenant_id IS NOT NULL AND p_count THEN
        INSERT INTO public.mcp_quota_counters (tenant_id, period_month, calls)
        VALUES (v_tenant_id, date_trunc('month', now())::DATE, 1)
        ON CONFLICT (tenant_id, period_month)
        DO UPDATE SET calls = public.mcp_quota_counters.calls + 1, updated_at = now();
    END IF;
END;
$$;

-- Die Signatur aus 20260820000000 (ohne p_count) bleibt sonst als Überladung
-- bestehen und würde weiterhin ohne Zähler laufen.
DROP FUNCTION IF EXISTS public.mcp_log_usage(UUID, TEXT, INT, INET, TEXT, INT, TEXT);

REVOKE ALL ON FUNCTION public.mcp_log_usage(UUID, TEXT, INT, INET, TEXT, INT, TEXT, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_log_usage(UUID, TEXT, INT, INET, TEXT, INT, TEXT, BOOLEAN)
    TO service_role;

-- ─── 5. Aktive Keys zählen (für das apiKeys-Limit) ───────────────────────
CREATE OR REPLACE FUNCTION public.mcp_active_key_count(p_tenant_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COUNT(*)::INT
      FROM public.mcp_api_keys
     WHERE tenant_id = p_tenant_id
       AND active
       AND (expires_at IS NULL OR expires_at > now());
$$;

REVOKE ALL ON FUNCTION public.mcp_active_key_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_active_key_count(UUID) TO authenticated, service_role;

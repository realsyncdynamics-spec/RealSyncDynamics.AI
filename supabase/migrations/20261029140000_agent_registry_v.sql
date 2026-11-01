-- M1-a: Vereinheitlichtes Agentenregister (nur lesend).
-- Additiv: legt ausschließlich eine VIEW an, ändert keine Tabellen/Daten.
-- security_invoker = on → RLS der Basistabellen gilt für den Aufrufer
-- (autonomous_agents: is_tenant_member(tenant_id); agent_profiles: authenticated read).
--
-- Status wird NUR aus belegten Quellen abgeleitet:
--   autonomous_agents.enabled = false            → 'offline'
--   letzter Run status running/pending           → 'working' / 'waiting'
--   letzter Run status failed                    → 'error'
--   sonst                                        → 'unknown'
-- agent_profiles ist ein globaler Katalog ohne Laufzeitdaten → immer 'unknown'.

CREATE OR REPLACE VIEW public.agent_registry_v
WITH (security_invoker = on) AS
SELECT
  'autonomous:' || a.id::text            AS registry_id,
  'autonomous_agents'::text              AS source,
  a.tenant_id                            AS tenant_id,
  a.name                                 AS name,
  a.type                                 AS agent_type,
  a.description                          AS description,
  a.enabled                              AS enabled,
  CASE
    WHEN a.enabled IS FALSE              THEN 'offline'
    WHEN r.status = 'running'            THEN 'working'
    WHEN r.status = 'pending'            THEN 'waiting'
    WHEN r.status = 'failed'             THEN 'error'
    ELSE 'unknown'
  END                                    AS status,
  CASE WHEN r.id IS NULL THEN 'none' ELSE 'autonomous_agent_runs' END AS status_source,
  COALESCE(r.completed_at, r.started_at, a.last_executed_at) AS last_activity_at,
  r.id                                   AS current_run_id,
  r.status                               AS current_run_status,
  r.error_message                        AS last_error
FROM public.autonomous_agents a
LEFT JOIN LATERAL (
  SELECT rr.id, rr.status, rr.started_at, rr.completed_at, rr.error_message
  FROM public.autonomous_agent_runs rr
  WHERE rr.agent_id = a.id
  ORDER BY rr.created_at DESC NULLS LAST
  LIMIT 1
) r ON true
UNION ALL
SELECT
  'profile:' || p.id::text,
  'agent_profiles',
  NULL::uuid,
  p.name,
  p.type,
  p.description,
  p.enabled,
  CASE WHEN p.enabled IS FALSE THEN 'offline' ELSE 'unknown' END,
  'none',
  NULL::timestamptz,
  NULL::uuid,
  NULL::text,
  NULL::text
FROM public.agent_profiles p;

REVOKE ALL ON public.agent_registry_v FROM anon;
GRANT SELECT ON public.agent_registry_v TO authenticated;

COMMENT ON VIEW public.agent_registry_v IS
  'M1-a Command Center: read-only Agentenregister. Status nur aus belegten Quellen, sonst unknown.';

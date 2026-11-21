-- Nachtrag: Diese Migration wurde am 18.11.2026 direkt auf RealSyncDynamicsLive
-- angewendet und fehlte im Repo. Ohne die Datei bricht `supabase db push` mit
-- "Remote migration versions not found in local migrations directory" ab.
-- Inhalt wortgleich aus supabase_migrations.schema_migrations (version
-- 20261118190317, name revoke_anon_secdef_triggers) uebernommen.
-- Auf Produktion bereits angewendet; db push ueberspringt sie dort.
-- Nur REVOKE/GRANT, idempotent.

REVOKE EXECUTE ON FUNCTION public.agent_change_evidence_block_modification()  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.agent_config_versions_before_insert()       FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.agent_tasks_coordination_guard()            FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.ai_evidence_block_delete()                  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.ai_evidence_block_update()                  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_evidence_block_modification()         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.audit_jobs_notify_worker()                  FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.b2_websites_ensure_asset()                   FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.bots_enforce_quota()                        FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.connector_registry_derive_class()           FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.evidence_anchors_block_mutation()           FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.needs_check_results_rate_limit()            FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.platform_operators_sync_profile_flag()      FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.verify_api_key(p_full_key text) FROM anon, authenticated, public;
GRANT  EXECUTE ON FUNCTION public.verify_api_key(p_full_key text) TO service_role;

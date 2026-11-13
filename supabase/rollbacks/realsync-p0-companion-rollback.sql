-- =============================================================================
-- Rollback zur Companion-Migration
-- 20261113153000_p0_service_role_grants_for_public_replacements.sql
--
-- Nimmt nur die expliziten service_role-Grants dieser zweiten Migration
-- zurück. v2 selbst bleibt unangetastet (dafür realsync-p0-live-rollback-v2.sql).
--
-- Hinweis: Wenn service_role das Recht bereits vor der Companion-Migration
-- explizit hatte (so im Localtest-Katalog nach v2), entfernt dieses Rollback
-- es trotzdem. Vor erneutem Apply von v2-alone das dokumentieren.
-- =============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.platform_stats() FROM service_role;
REVOKE EXECUTE ON FUNCTION public.audit_share_get(uuid) FROM service_role;

COMMIT;

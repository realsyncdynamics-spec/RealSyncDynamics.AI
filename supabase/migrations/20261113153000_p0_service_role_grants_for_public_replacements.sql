-- =============================================================================
-- Zweite Migration, NICHT Bestandteil von DRAFT-v2.
-- Zeitpunkt nach v2 (20261113152000). Nur GRANT an service_role, damit die
-- Ersatz-Edge-Functions public-platform-stats und audit-share-get die
-- bestehenden SECURITY-DEFINER-RPCs intern aufrufen können.
--
-- v2 entzieht EXECUTE an PUBLIC/anon/authenticated, erwähnt service_role
-- auf diesen beiden Funktionen aber nicht. Lag das Recht live nur über
-- PUBLIC, wäre der service_role-Aufruf nach v2 42501.
--
-- Draft, nicht anwenden, bis Compliance & Security votiert.
-- Rollback: realsync-p0-companion-rollback.sql
-- =============================================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.platform_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_share_get(uuid) TO service_role;

COMMIT;

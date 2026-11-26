-- =============================================================================
-- Live-Rollback zu realsync-p0-live-migration-DRAFT-v2.1.sql
-- DRAFT — nicht ausfuehren, ausser als bewusster Notfall nach einem Apply von
-- v2.1 und nur nach ausdruecklicher Anweisung. Stellt den UNSICHEREN
-- Live-Ist-Stand vom 13. November 2026, 12:22 Uhr (Europe/Berlin) wieder her.
--
-- Stand: 13. November 2026 (Europe/Berlin)
-- Basiert auf realsync-p0-live-rollback-v2.sql (v2 bleibt unveraendert).
-- Must-fixes aus realsync-p0-v2-review-2026-11-13.md (Abschnitte 2, 5 und 9),
-- Option A (exakt invers).
--
-- Changelog gegenueber v2:
--   1. Must-fix 1: Kein Companion-Rollback. Fuer platform_stats und
--      audit_share_get gibt es kein isoliertes REVOKE EXECUTE … FROM
--      service_role. Die bestehenden Inverse-Zeilen bleiben: REVOKE ALL
--      (inkl. service_role) und anschliessend GRANT an anon, authenticated,
--      service_role — das gibt den Live-Ist wieder, in dem service_role das
--      Recht bereits explizit hatte. Ein Companion-REVOKE ohne Wiedergabe
--      wuerde service_role das Recht wegnehmen.
--   2. Must-fix 2 / Option A: Rollback fuer
--      creatorseal.get_current_usage(uuid),
--      creatorseal.check_and_increment_quota(uuid) und
--      creatorseal.sync_stripe_subscription(...) stellt PUBLIC- bzw.
--      authenticated-Execute exakt auf den Live-Ist zurueck (SQL aus
--      Review-Abschnitt 2). Alle drei sind SECURITY DEFINER ohne auth.uid();
--      das Zurueckgeben der Client-Rechte oeffnet denselben unsicheren Pfad
--      bewusst, weil der Rollback den Live-Ist wiederherstellen muss.
--   3. pg_default_acl creatorseal: nur noch
--      REVOKE EXECUTE ON FUNCTIONS FROM service_role.
--      KEIN GRANT EXECUTE TO PUBLIC (der hinterliesse {=X/postgres} statt
--      keinem Eintrag). Table-/Sequenz-Default-Tanz entfernt: Live und der
--      Stand nach v2/v2.1 haben dort keine pg_default_acl-Zeile; der Tanz
--      ist unnoetig.
--
-- Quelle der Rechte: nur lesende Katalogqueries auf
-- RealSyncDynamicsLive (ebljyceifhnlzhjfyxup).
-- NICHT der Localtest-Rollback (realsync-p0-localtest-rollback.sql).
-- Nicht gegen ein Supabase-Projekt laufen lassen, ausser im genehmigten
-- Notfall auf genau dem Projekt, auf dem v2.1 zuvor angewendet wurde.
--
-- Dieses Skript macht P0 rueckgaengig: anon kann danach wieder u. a.
-- stripe_webhook_events und die Orakel-RPCs nutzen. Das ist beabsichtigt
-- nur als Notfall, nicht als dauerhafter Sollzustand.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Inverse P0-5: table-level INSERT fuer anon und authenticated wiederherstellen
-- (Live relacl profiles: anon=ardDxtm, authenticated=ardDxtm; INSERT schliesst
-- alle Spalten ein, inkl. is_super_admin und role. UPDATE bleibt entzogen.)
-- -----------------------------------------------------------------------------
REVOKE INSERT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE INSERT (
  id, full_name, organization_name, eu_compliance_mode, avatar_url,
  created_at, updated_at, ai_data_residency,
  onboarding_completed_at, onboarding_dismissed_at, onboarding_step
) ON TABLE public.profiles FROM authenticated;
GRANT INSERT ON TABLE public.profiles TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Inverse M3: Default Privileges auf den Live-Ist vom 13.11.2026
-- agentos (grantor/role postgres):
--   Tabellen {anon=r, authenticated=arwd, service_role=arwdDxtm}
--   Funktionen {anon=X, authenticated=X}  (kein service_role)
--   Sequenzen: kein pg_default_acl-Eintrag
-- creatorseal: keine Eintraege in pg_default_acl (Postgres-Voreinstellung).
-- Nach dem Invertieren pg_default_acl gegen diese Baseline pruefen.
-- -----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
-- service_role-Table-Default (arwdDxtm) wurde von v2 nicht entzogen.

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  REVOKE EXECUTE ON FUNCTIONS FROM service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

-- Sequenz-Default: v2 hat REVOKE ALL von PUBLIC/anon/authenticated gesetzt.
-- Live hatte keinen Eintrag. Volle Ruecknahme auf den Katalog-Default:
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  GRANT ALL ON SEQUENCES TO PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- v2.1: exakt invers zum Funktions-Default an service_role.
-- Live hatte keinen pg_default_acl-Eintrag fuer creatorseal. Ein REVOKE des
-- service_role-Execute-Defaults entfernt die Zeile (leere Default-ACL wird
-- geloescht). KEIN GRANT EXECUTE TO PUBLIC: das hinterliesse {=X/postgres}.
-- Table-/Sequenz-Defaults: der v2-REVOKE von PUBLIC/anon/authenticated war
-- ein No-Op (kein Eintrag vorher, keiner nach v2/v2.1). Keine Inverse noetig.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA creatorseal
  REVOKE EXECUTE ON FUNCTIONS FROM service_role;

-- -----------------------------------------------------------------------------
-- Inverse P0-4 creatorseal: RLS-Flag und Objekt-Grants
-- -----------------------------------------------------------------------------
ALTER TABLE creatorseal.webhook_events DISABLE ROW LEVEL SECURITY;

-- Funktionen: Live
--   set_updated_at / handle_new_auth_user: proacl NULL (= Default PUBLIC)
--   get_current_usage / check_and_increment_quota / sync_stripe_subscription:
--   siehe Option-A-Block unmittelbar danach (Must-fix 2).
--   uebrige: explizites service_role, kein PUBLIC/anon/authenticated; das
--   bleibt nach v2.1 und nach diesem Rollback erhalten.
REVOKE ALL ON FUNCTION creatorseal.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION creatorseal.handle_new_auth_user() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION creatorseal.set_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION creatorseal.handle_new_auth_user() TO PUBLIC;

-- Must-fix 2, Option A (Review v2 Abschnitt 2): exakt invers zu
-- REVOKE ALL ON ALL FUNCTIONS IN SCHEMA creatorseal FROM PUBLIC, anon, authenticated.
-- Live-proacl 13.11.2026:
--   get_current_usage: PUBLIC + explizit authenticated + service_role
--   check_and_increment_quota: PUBLIC + service_role
--   sync_stripe_subscription: PUBLIC + service_role
-- Alle drei SECURITY DEFINER ohne auth.uid() / auth.jwt() im Koerper.
REVOKE ALL ON FUNCTION creatorseal.get_current_usage(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION creatorseal.get_current_usage(uuid)
  TO PUBLIC, authenticated, service_role;

REVOKE ALL ON FUNCTION creatorseal.check_and_increment_quota(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION creatorseal.check_and_increment_quota(uuid)
  TO PUBLIC, service_role;

REVOKE ALL ON FUNCTION creatorseal.sync_stripe_subscription(
    uuid, text, text, text, text,
    timestamp with time zone, timestamp with time zone,
    timestamp with time zone, boolean, timestamp with time zone)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION creatorseal.sync_stripe_subscription(
    uuid, text, text, text, text,
    timestamp with time zone, timestamp with time zone,
    timestamp with time zone, boolean, timestamp with time zone)
  TO PUBLIC, service_role;

-- Tabellen (Live-relacl 13.11.2026):
--   plans, anchor_batches: anon=r, authenticated=r
--   public_verifications (View): anon=r, authenticated=r
--   profiles: authenticated=rw
--   subscriptions, usage_counters: authenticated=r
--   user_keys, verifications, webhook_events: relacl null (nur Owner)
GRANT USAGE ON SCHEMA creatorseal TO anon, authenticated;
GRANT SELECT ON TABLE creatorseal.plans TO anon, authenticated;
GRANT SELECT ON TABLE creatorseal.anchor_batches TO anon, authenticated;
GRANT SELECT ON TABLE creatorseal.public_verifications TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE creatorseal.profiles TO authenticated;
GRANT SELECT ON TABLE creatorseal.subscriptions TO authenticated;
GRANT SELECT ON TABLE creatorseal.usage_counters TO authenticated;

-- -----------------------------------------------------------------------------
-- Inverse P0-4 agentos: RLS aus auf den 15 Objekten, Grants, Funktionen
-- -----------------------------------------------------------------------------
ALTER TABLE agentos.agent_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.audit_logs_2026_04 DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.audit_logs_2026_05 DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.audit_logs_2026_06 DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.gateway_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.risk_levels DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.stripe_webhook_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_execution_idempotency DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_execution_idempotency_2026_04 DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_execution_idempotency_2026_05 DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_execution_idempotency_2026_06 DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.tenant_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.workflow_statuses DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA agentos TO anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'agentos' AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format('GRANT SELECT ON TABLE %s TO anon', r.rel);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO authenticated', r.rel);
  END LOOP;
END$$;

-- Funktionen auf Live-Matrix zurueck (13.11.2026):
-- PUBLIC+anon+authenticated (service_role nur ueber PUBLIC) fuer alle ausser Hook.
-- Hook: postgres, supabase_auth_admin, authenticated, anon — KEIN PUBLIC, KEIN service_role.
REVOKE ALL ON FUNCTION agentos.resolve_api_token(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.touch_api_token(uuid, inet) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.accept_tenant_invite(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.set_updated_at() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.current_tenant_id() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.current_role_level() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.handle_new_auth_user() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.create_monthly_partitions() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.detach_old_audit_partitions() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.drop_old_idempotency_partitions() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION agentos.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION agentos.resolve_api_token(text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agentos.touch_api_token(uuid, inet) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agentos.accept_tenant_invite(text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agentos.set_updated_at() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agentos.current_tenant_id() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agentos.current_role_level() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agentos.handle_new_auth_user() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agentos.create_monthly_partitions() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agentos.detach_old_audit_partitions() TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agentos.drop_old_idempotency_partitions() TO PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION agentos.custom_access_token_hook(jsonb)
  TO supabase_auth_admin, anon, authenticated;
-- service_role bleibt ohne Execute auf den Hook (Live-Ist).
-- USAGE war live nicht gesetzt; v2 hat es ergaenzt und wird hier zurueckgenommen.
REVOKE USAGE ON SCHEMA agentos FROM supabase_auth_admin;

-- -----------------------------------------------------------------------------
-- Inverse P0-2
-- Live relacl siteos_anonymous_builds: anon=arwdDxtm, authenticated=arwdDxtm,
-- service_role=arwdDxtm (service_role wurde von v2 nicht entzogen).
-- -----------------------------------------------------------------------------
GRANT ALL ON TABLE public.siteos_anonymous_builds TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Inverse P0-1: public-Funktionen auf Live-Execute-Matrix
-- Erfasst in has_function_privilege am 13.11.2026 (siehe Localtest-Baseline).
-- Branding-REVOKE war in v2 auskommentiert — hier kein Gegenstueck noetig.
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.verify_api_key(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_api_key(text) TO anon, service_role;

REVOKE ALL ON FUNCTION public.platform_stats() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_stats() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.audit_share_get(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.audit_share_get(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_onboarding_progress(integer, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_onboarding_progress(integer, uuid, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.affiliate_validate(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.affiliate_validate(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.ai_evidence_verify_chain(uuid, bigint, bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_evidence_verify_chain(uuid, bigint, bigint) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.asset_lifecycle_state(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.asset_lifecycle_state(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.connector_enforcement_summary(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.connector_enforcement_summary(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.m365_reaction_summary(uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.m365_reaction_summary(uuid, timestamp with time zone) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.pdp_shadow_readiness(uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pdp_shadow_readiness(uuid, timestamp with time zone) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.verify_c2pa_assertion(jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_c2pa_assertion(jsonb, text) TO anon, service_role;
-- authenticated bleibt ohne Execute (Live-Ist).

REVOKE ALL ON FUNCTION public.has_tenant_membership(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_tenant_membership(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_tenant_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_tenant_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_tenant_owner_or_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner_or_admin(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_tenant_owner(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_tenant_writer(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_writer(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_set_membership_role(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_set_membership_role(uuid, uuid, text) TO authenticated, service_role;

-- Trigger: Live typischerweise PUBLIC + anon + authenticated + service_role
REVOKE ALL ON FUNCTION public.agent_change_evidence_block_modification() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.agent_config_versions_before_insert() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.agent_tasks_coordination_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_evidence_block_delete() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_evidence_block_update() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.audit_evidence_block_modification() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.audit_jobs_notify_worker() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.b2_websites_ensure_asset() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bots_enforce_quota() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.connector_registry_derive_class() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.evidence_anchors_block_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.platform_operators_sync_profile_flag() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.agent_change_evidence_block_modification() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_config_versions_before_insert() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_tasks_coordination_guard() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_evidence_block_delete() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_evidence_block_update() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.audit_evidence_block_modification() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.audit_jobs_notify_worker() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.b2_websites_ensure_asset() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bots_enforce_quota() TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.connector_registry_derive_class() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evidence_anchors_block_mutation() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_operators_sync_profile_flag() TO PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_customers_list() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_erase_lead_data(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_funnel_kpis(integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_funnel_leads(text, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_system_health() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_customers_list() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_erase_lead_data(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_funnel_kpis(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_funnel_leads(text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_system_health() TO authenticated, service_role;

COMMIT;

-- Nach einem Notfall-Rollback: Advisors, Hook-Login, Share-Links und
-- pg_default_acl gegen die Baseline vom 13.11.2026 pruefen.

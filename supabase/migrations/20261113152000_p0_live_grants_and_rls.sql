-- =============================================================================
-- DRAFT v2 — NOT APPLIED, not a migration history entry, not for production
-- until Dominik Steiner gives an explicit live release for exactly this file
-- on RealSyncDynamicsLive (ebljyceifhnlzhjfyxup).
--
-- Stand: 13. November 2026 (Europe/Berlin)
-- Basiert auf realsync-p0-live-migration-DRAFT.sql (v1, unveraendert lassen)
-- plus Must-/Should-Fixes aus realsync-p0-draft-review-2026-11-13.md.
-- Funktionsliste und ACLs gegen den Live-Katalog (nur SELECT) vom 13.11.2026
-- abgeglichen.
--
-- Do not run this file against any Supabase project.
-- Begleitender Rollback: realsync-p0-live-rollback-v2.sql
-- Voraussetzung bleibt ein schema-identisches Staging/Branch von Live
-- (PostgREST, GoTrue-Hook, Edge Functions). Der Localtest ersetzt das nicht.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- P0-1  REVOKE EXECUTE on SECURITY DEFINER functions
-- -----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.verify_api_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_api_key(text) TO service_role;
-- Frontend/Edge: supabase/functions/api-gateway/index.ts ruft verify_api_key
-- bereits mit dem service_role-Key auf. Dieser Pfad bleibt erhalten.

REVOKE ALL ON FUNCTION public.platform_stats() FROM PUBLIC, anon, authenticated;
-- Ersatz (nicht in diesem Apply, siehe Bericht Abschnitt 5):
--   Edge Function z. B. public-platform-stats, nur nicht-personenbezogene
--   Aggregate (domains_scanned, audits_total, open_risks, evidence_pct,
--   last_scan_at), Cache, Rate-Limit, kein SECURITY-DEFINER-RPC fuer anon.
--   Aufrufer im Repo: src/hooks/usePlatformStats.ts (sb.rpc('platform_stats')).
--   In diesem Tree wurde kein weiterer Importer der Hook-Datei gefunden;
--   vor Live dennoch Marketing-Landing und bestehende Bundles pruefen.

REVOKE ALL ON FUNCTION public.audit_share_get(uuid) FROM PUBLIC, anon, authenticated;
-- Ersatz (nicht in diesem Apply, siehe Bericht Abschnitt 5):
--   Edge Function z. B. audit-share-get, Bindung an ein eigenes Share-Token
--   (nicht die interne Audit-UUID), minimierte non-PII-Felder, Rate-Limit.
--   Aufrufer im Repo:
--     src/pages/AuditResultPage.tsx        Route /audit/result/:auditId
--     src/pages/AuditShare.tsx             Route /audit/share/:token
--     src/features/audit/loadSharedAudit.ts
--       (zusaetzlich genutzt von GovernanceOnboarding, GovernanceRecommendation)

-- TEMPORARY bis spaetestens 27. November 2026, 18:00 Uhr (Europe/Berlin).
-- Der Entzug von get_tenant_branding_by_domain bleibt in diesem Schritt
-- bewusst AUSKOMMENTIERT, solange der Ersatz nicht angebunden ist.
-- Fristvorschlag: innerhalb von 14 Tagen nach einer allfaelligen Live-Freigabe
-- von P0, spaetestens am 27.11.2026, die unten spezifizierte Edge Function
-- (bzw. die bestehende tenant-branding-get, gehaertet) in Produktion anbinden,
-- die Antwort ohne tenant_id ausliefern, das Frontend nur noch darueber
-- gehen lassen, danach diese REVOKE-Zeile in einem eigenen, getesteten
-- Schritt ausfuehren. Die alte Signatur darf danach nicht erneut an anon
-- vergeben werden.
--
-- Rest-Risiko in der Uebergangszeit: die Funktion liefert anon zu einer
-- (oft oeffentlichen) custom_domain unter anderem tenant_id, Support-Kontakt
-- und custom_css. Das ist kein dauerhaft akzeptabler Zustand.
--
-- Spezifikation Ersatz-Edge-Function (separate Arbeit, nicht dieser Apply):
--   * Ausgangspunkt: supabase/functions/tenant-branding-get/index.ts
--     (oeffentliches GET, nutzt bereits service_role / admin.rpc; verifiziert
--     im Repo; leitet heute das volle JSON inkl. tenant_id weiter).
--   * Query nur noch ?domain= (kein ?tenant_id= als oeffentlicher Pivot).
--   * Antwortfelder ausschliesslich: company_name, custom_domain, brand_colors,
--     custom_logo_url, favicon_url, support_email, support_phone, support_url,
--     footer_text, custom_css. KEIN tenant_id, keine internen IDs.
--   * Rate-Limit und Cache (z. B. je IP/Domain), keine Auth noetig.
--   * CSS in unsicheren Einbettungen als XSS-Risiko behandeln (nicht ungefiltert
--     als Markup interpretieren).
--   * Direktes anon-RPC aus dem Client vermeiden. Im aktuellen src/ wurde
--     kein .rpc('get_tenant_branding_by_domain') gefunden.
-- REVOKE ALL ON FUNCTION public.get_tenant_branding_by_domain(text)
--   FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.update_onboarding_progress(integer, uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_onboarding_progress(integer, uuid, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.affiliate_validate(text) FROM PUBLIC, anon;
-- Hinweis: Im aktuellen Frontend (src/lib/affiliate.ts, AuditLanding,
-- AuditChatHero, OptimizerScan, main.tsx) wird der Code nur aus ?ref= / ?via=
-- in localStorage gelegt und als referral_code mitgeschickt. Ein direkter
-- Aufruf von affiliate_validate wurde in src/ und supabase/functions nicht
-- gefunden. authenticated behalt Execute. Externe/alte Clients, die den
-- RPC vor dem Login nutzen, wuerden 42501 erhalten.

REVOKE ALL ON FUNCTION public.ai_evidence_verify_chain(uuid, bigint, bigint)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_evidence_verify_chain(uuid, bigint, bigint)
  TO authenticated;

REVOKE ALL ON FUNCTION public.asset_lifecycle_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asset_lifecycle_state(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.connector_enforcement_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connector_enforcement_summary(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.m365_reaction_summary(uuid, timestamp with time zone)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.m365_reaction_summary(uuid, timestamp with time zone)
  TO authenticated;

REVOKE ALL ON FUNCTION public.pdp_shadow_readiness(uuid, timestamp with time zone)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pdp_shadow_readiness(uuid, timestamp with time zone)
  TO authenticated;

-- KEIN GRANT an authenticated (Live-Ist: anon ja, authenticated nein).
REVOKE ALL ON FUNCTION public.verify_c2pa_assertion(jsonb, text) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.has_tenant_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_tenant_membership(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_tenant_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_tenant_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_tenant_owner_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner_or_admin(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_tenant_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_tenant_writer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_writer(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated;

REVOKE ALL ON FUNCTION public.can_set_membership_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_set_membership_role(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.agent_change_evidence_block_modification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_config_versions_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agent_tasks_coordination_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_evidence_block_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_evidence_block_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_evidence_block_modification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_jobs_notify_worker() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.b2_websites_ensure_asset() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bots_enforce_quota() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.connector_registry_derive_class() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evidence_anchors_block_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_operators_sync_profile_flag() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.admin_customers_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_erase_lead_data(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_funnel_kpis(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_funnel_leads(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_system_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_customers_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_erase_lead_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_funnel_kpis(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_funnel_leads(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_system_health() TO authenticated;

-- -----------------------------------------------------------------------------
-- P0-2  siteos_anonymous_builds: Client-Grants entfernen
-- -----------------------------------------------------------------------------

REVOKE ALL ON TABLE public.siteos_anonymous_builds FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- P0-3  Leaked-Password-Protection — kein SQL (eigener Dashboard-Schritt)
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- P0-4  agentos / creatorseal
-- Vor Live: Dashboard Settings → API → Exposed schemas und Custom Access
-- Token Hook (Funktion + Rolle supabase_auth_admin) pruefen und dokumentieren.
-- -----------------------------------------------------------------------------

REVOKE ALL ON SCHEMA agentos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA agentos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA agentos FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA agentos FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION agentos.resolve_api_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION agentos.touch_api_token(uuid, inet) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION agentos.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION agentos.accept_tenant_invite(text) FROM PUBLIC, anon, authenticated;

-- service_role hatte Execute auf den folgenden Funktionen live NUR ueber PUBLIC
-- (Katalog 13.11.2026, keine explizite service_role-Zeile in proacl). Der
-- pauschale REVOKE FROM PUBLIC wuerde das Recht sonst entziehen.
GRANT EXECUTE ON FUNCTION agentos.resolve_api_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION agentos.touch_api_token(uuid, inet) TO service_role;
GRANT EXECUTE ON FUNCTION agentos.accept_tenant_invite(text) TO service_role;
GRANT EXECUTE ON FUNCTION agentos.set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION agentos.current_tenant_id() TO service_role;
GRANT EXECUTE ON FUNCTION agentos.current_role_level() TO service_role;
GRANT EXECUTE ON FUNCTION agentos.handle_new_auth_user() TO service_role;
GRANT EXECUTE ON FUNCTION agentos.create_monthly_partitions() TO service_role;
GRANT EXECUTE ON FUNCTION agentos.detach_old_audit_partitions() TO service_role;
GRANT EXECUTE ON FUNCTION agentos.drop_old_idempotency_partitions() TO service_role;
-- P1 (nicht in diesem Apply): resolve_api_token so ersetzen, dass die
-- Rueckgabe kein user_email mehr enthaelt. Client-Execute ist mit P0 entzogen.

-- M1: Hook-Grant fest, idempotent. Bewusst KEIN Grant an service_role,
-- anon oder authenticated (Live-Ist: service_role hat kein EXECUTE).
GRANT EXECUTE ON FUNCTION agentos.custom_access_token_hook(jsonb)
  TO supabase_auth_admin;
-- Lokal und am Live-Katalog (13.11.2026) hat supabase_auth_admin KEIN USAGE
-- auf Schema agentos (nspacl: postgres, anon, authenticated, service_role).
-- Ohne USAGE schlaegt der Funktionsaufruf mit 42501 auf das Schema fehl,
-- selbst wenn EXECUTE gewaehrt ist. Deshalb hier zusaetzlich:
GRANT USAGE ON SCHEMA agentos TO supabase_auth_admin;

ALTER TABLE agentos.agent_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.audit_logs_2026_04 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.audit_logs_2026_05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.audit_logs_2026_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.gateway_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.risk_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_execution_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_execution_idempotency_2026_04 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_execution_idempotency_2026_05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_execution_idempotency_2026_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.tenant_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentos.workflow_statuses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA creatorseal FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA creatorseal FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA creatorseal FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA creatorseal FROM PUBLIC, anon, authenticated;

-- Live: set_updated_at und handle_new_auth_user haben proacl NULL (nur
-- Default-PUBLIC). Alle anderen creatorseal-Funktionen haben bereits ein
-- explizites service_role-Recht und behalten es nach REVOKE FROM PUBLIC.
GRANT EXECUTE ON FUNCTION creatorseal.set_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION creatorseal.handle_new_auth_user() TO service_role;

ALTER TABLE creatorseal.webhook_events ENABLE ROW LEVEL SECURITY;

-- M3: Default Privileges, damit neue Objekte P0-4 nicht wieder oeffnen.
-- Live agentos (grantor postgres): Tabellen {anon=r, authenticated=arwd,
-- service_role=arwdDxtm}; Funktionen {anon=X, authenticated=X} ohne
-- service_role. Live creatorseal: keine Eintraege in pg_default_acl.
-- Nur FOR ROLE postgres ist belegt; falls spaeter supabase_admin in diesen
-- Schemas anlegt, denselben Block fuer diese Rolle nachziehen (P1).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA agentos
  GRANT EXECUTE ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA creatorseal
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA creatorseal
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA creatorseal
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA creatorseal
  GRANT EXECUTE ON FUNCTIONS TO service_role;

-- -----------------------------------------------------------------------------
-- P0-5  profiles.is_super_admin (und role)
-- Table-level INSERT entziehen, danach Spaltenliste ohne is_super_admin und
-- ohne role (Waechter-Trigger schuetzt nur is_super_admin). welcome_email_sent_at
-- ebenfalls nicht in der Client-Insert-Liste. Signup laeuft ueber
-- public.handle_new_auth_user (SECURITY DEFINER, Trigger auf auth.users).
-- -----------------------------------------------------------------------------

REVOKE INSERT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT INSERT (
  id, full_name, organization_name, eu_compliance_mode, avatar_url,
  created_at, updated_at, ai_data_residency,
  onboarding_completed_at, onboarding_dismissed_at, onboarding_step
) ON TABLE public.profiles TO authenticated;

-- -----------------------------------------------------------------------------
-- P0-6  Edge Functions — kein SQL (separater Schritt, nicht mit erledigt)
-- -----------------------------------------------------------------------------

COMMIT;
-- Nach Staging/Branch: Advisors, Login/Token-Refresh (Hook), Signup,
-- service_role-UPDATE auf agentos.tenants (Trigger set_updated_at),
-- Landing (Stats, Share-Links, Affiliate), dann erst Live-Freigabe.

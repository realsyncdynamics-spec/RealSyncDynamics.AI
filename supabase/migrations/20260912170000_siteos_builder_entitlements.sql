-- SiteOS Builder monetization — plan entitlements.
--
-- SSoT: shared/pricing.ts (PlanLimits.sites, PlanPermissions.siteosBuilder /
-- siteosPublish, PLAN_ENTITLEMENTS). Gates use keys only — never plan names.
--
-- Free Audit: siteos.builder=0, siteos.publish=0, limit.sites=0
-- Starter / Growth / Agency: builder+publish on, sites 1 / 3 / 10
-- Enterprise: -1 (contract); Partner: 50
--
-- Rein additiv: kein Key gelöscht, kein Bestandswert überschrieben.

BEGIN;

INSERT INTO public.entitlements (key, description, kind)
SELECT v.key, v.beschreibung, v.kind
FROM (VALUES
  ('siteos.builder', 'SiteOS Builder: Tenant-Sites anlegen und übernehmen', 'boolean'),
  ('siteos.publish', 'SiteOS Publish-Pfad (Gate/Approve); öffentliches Deploy bleibt Preview bis live', 'boolean'),
  ('limit.sites', 'SiteOS-Websites je Mandant (distinct slug)', 'limit')
) AS v(key, beschreibung, kind)
WHERE NOT EXISTS (
  SELECT 1 FROM public.entitlements e WHERE e.key = v.key
);

-- Boolean: siteos.builder / siteos.publish (1 = an, 0 = aus)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, z.value
FROM (VALUES
  ('siteos.builder', 'free_audit', 0),
  ('siteos.publish', 'free_audit', 0),
  ('siteos.builder', 'starter', 1),
  ('siteos.publish', 'starter', 1),
  ('siteos.builder', 'growth', 1),
  ('siteos.publish', 'growth', 1),
  ('siteos.builder', 'agency', 1),
  ('siteos.publish', 'agency', 1),
  ('siteos.builder', 'enterprise', 1),
  ('siteos.publish', 'enterprise', 1),
  ('siteos.builder', 'partner', 1),
  ('siteos.publish', 'partner', 1),
  ('siteos.builder', 'governance_launch', 1),
  ('siteos.publish', 'governance_launch', 0)
) AS z(key, plan_key, value)
JOIN public.entitlements e ON e.key = z.key
JOIN public.products p
  ON p.default_for_plan_key = z.plan_key
  OR p.default_for_plan_key = z.plan_key || '_yearly'
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_entitlements pe
  WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
);

-- Limit: sites je Plan
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, z.value
FROM (VALUES
  ('limit.sites', 'free_audit', 0),
  ('limit.sites', 'starter', 1),
  ('limit.sites', 'growth', 3),
  ('limit.sites', 'agency', 10),
  ('limit.sites', 'enterprise', -1),
  ('limit.sites', 'partner', 50),
  ('limit.sites', 'governance_launch', 1)
) AS z(key, plan_key, value)
JOIN public.entitlements e ON e.key = z.key
JOIN public.products p
  ON p.default_for_plan_key = z.plan_key
  OR p.default_for_plan_key = z.plan_key || '_yearly'
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_entitlements pe
  WHERE pe.product_id = p.id AND pe.entitlement_id = e.id
);

COMMIT;

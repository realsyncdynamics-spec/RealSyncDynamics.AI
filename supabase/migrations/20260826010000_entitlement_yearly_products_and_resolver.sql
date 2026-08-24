-- P0-A/6 — Jahresprodukte berechtigen und den Auflöser gegen leere Produkte
-- absichern.
--
-- Befund (gemessen am 2026-08-23 gegen RealSyncDynamicsLive):
-- Sieben Produkte tragen einen Stripe-Preis und **null** Entitlements — die
-- vier Jahrespläne und die drei Website-Rebuild-Produkte.
--
-- Warum das nicht bloß unvollständig, sondern kaputt ist: `tenant_entitlements()`
-- löst das Produkt über `COALESCE` auf und nimmt den ersten nicht-leeren Wert.
-- Wer jährlich bucht, trägt den Jahres-Price; damit greift der erste Zweig und
-- liefert die Jahres-Produkt-ID. Die ist nicht NULL, also wird der Rückfall auf
-- `free_tier` **nie** erreicht. Der Join auf `product_entitlements` findet null
-- Zeilen — der Kunde hat keine Berechtigungen. Nicht weniger: keine.
--
-- Live noch latent: vier Subscriptions, keine davon jährlich. Der Fehler
-- schlüge beim ersten Jahresabschluss zu.
--
-- Zwei Korrekturen, beide nötig:
--   1. Daten — jedes Jahresprodukt bekommt die Berechtigungen seines
--      Monatszwillings.
--   2. Auflösung — ein Produkt **ohne** Berechtigungen gewinnt den COALESCE
--      nicht mehr. Das ist das Netz für jedes künftige Produkt, an das beim
--      Anlegen niemand denkt.

BEGIN;

-- ── 1. Daten ────────────────────────────────────────────────────────────────
-- Jahresprodukt erbt vom Monatszwilling. Die Zuordnung folgt `yearlyPlanKey`
-- in `shared/pricing.ts`.
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT jahr.id, pe.entitlement_id, pe.value
FROM (VALUES
  ('starter_yearly', 'starter'),
  ('growth_yearly',  'growth'),
  ('agency_yearly',  'agency'),
  ('partner_yearly', 'partner')
) AS paar(jahr_key, monat_key)
JOIN public.products jahr  ON jahr.default_for_plan_key  = paar.jahr_key
JOIN public.products monat ON monat.default_for_plan_key = paar.monat_key
JOIN public.product_entitlements pe ON pe.product_id = monat.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_entitlements x
  WHERE x.product_id = jahr.id AND x.entitlement_id = pe.entitlement_id
);

-- Bewusst NICHT behandelt:
--
--   `website_rebuild_managed|premium|enterprise` bleiben ohne Berechtigungen.
--   Die dafür nötigen Keys (`site.build`, `site.preview`, `site.deploy`)
--   existieren noch nicht; sie gehören zu P0-C der Zielmatrix
--   (docs/architecture/canonical-builder-target-matrix.md §4). Ihnen ersatzweise
--   einen Abo-Satz zu geben, wäre geraten statt entschieden.
--   Kein kaufbarer Pfad ist betroffen: Die drei Tarife haben keinen Aufrufer im
--   Frontend — `createSiteOsCheckoutSession()` kauft `governance_launch`.
--
--   `enterprise_yearly` steht in `shared/pricing.ts`, hat aber **kein** Produkt
--   in der Datenbank. Ein Produkt ohne Stripe-Price anzulegen hieße, einen
--   Preis zu erfinden. Gemeldet, nicht stillschweigend erzeugt.

-- ── 2. Auflösung ────────────────────────────────────────────────────────────
-- Unverändert bleiben: die Mitgliedschaftsprüfung (`authorized`), die Auswahl
-- der jüngsten Subscription, die additive Vereinigung mit den Grant-Produkten
-- und die Aggregation (`-1` = unbegrenzt gewinnt vor jedem endlichen Wert).
--
-- Neu sind zwei Dinge:
--   * `EXISTS (… product_entitlements …)` an den beiden Produkt-Zweigen: Ein
--     leeres Produkt gewinnt den COALESCE nicht mehr, statt den Kunden ohne
--     Berechtigungen zurückzulassen.
--   * Ein Zwischenzweig, der einen Variantenschlüssel auf seinen Basisplan
--     zurückführt (`growth_yearly` → `growth`). Damit trägt auch ein künftiges
--     `enterprise_yearly` ohne eigenes Produkt.
CREATE OR REPLACE FUNCTION public.tenant_entitlements(p_tenant_id uuid)
 RETURNS TABLE(key text, kind text, value integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  WITH authorized AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.tenant_id = p_tenant_id
        AND m.user_id = auth.uid()
    ) AS ok
  ),
  active_sub AS (
    SELECT *
    FROM public.subscriptions
    WHERE tenant_id = p_tenant_id
    ORDER BY updated_at DESC
    LIMIT 1
  ),
  subscription_product AS (
    SELECT COALESCE(
      (SELECT p.id FROM public.products p
       WHERE p.stripe_price_id = (SELECT stripe_price_id FROM active_sub)
         AND EXISTS (SELECT 1 FROM public.product_entitlements pe WHERE pe.product_id = p.id)
       LIMIT 1),
      (SELECT p.id FROM public.products p
       WHERE p.default_for_plan_key = (SELECT plan_key FROM active_sub)
         AND EXISTS (SELECT 1 FROM public.product_entitlements pe WHERE pe.product_id = p.id)
       LIMIT 1),
      -- Variantenschlüssel auf den Basisplan zurückführen, damit eine
      -- Jahres- oder Sondervariante ohne eigenes Produkt nicht ins Leere fällt.
      (SELECT p.id FROM public.products p
       WHERE p.default_for_plan_key = regexp_replace(
               COALESCE((SELECT plan_key FROM active_sub), ''), '_yearly$', '')
         AND EXISTS (SELECT 1 FROM public.product_entitlements pe WHERE pe.product_id = p.id)
       LIMIT 1),
      (SELECT p.id FROM public.products p WHERE p.default_for_plan_key = 'free_tier' LIMIT 1),
      (SELECT p.id FROM public.products p WHERE p.default_for_plan_key = 'free' LIMIT 1)
    ) AS id
  ),
  grant_products AS (
    SELECT DISTINCT g.product_id AS id
    FROM public.entitlement_grants g
    WHERE g.tenant_id = p_tenant_id
      AND g.status = 'active'
      AND (g.expires_at IS NULL OR g.expires_at > now())
  ),
  contributing_products AS (
    SELECT id FROM subscription_product WHERE id IS NOT NULL
    UNION
    SELECT id FROM grant_products
  )
  SELECT
    e.key,
    e.kind,
    CASE WHEN bool_or(pe.value = -1) THEN -1 ELSE MAX(pe.value) END AS value
  FROM contributing_products cp
  JOIN public.product_entitlements pe ON pe.product_id = cp.id
  JOIN public.entitlements e ON e.id = pe.entitlement_id
  CROSS JOIN authorized a
  WHERE a.ok
  GROUP BY e.key, e.kind;
$function$;

COMMIT;

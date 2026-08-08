-- ═══════════════════════════════════════════════════════════════════════════
--  tenant_entitlements(): Subscription UND entitlement_grants vereinigen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bisher löste die Funktion GENAU EIN Produkt auf — das der jüngsten
-- Subscription. Grants (`entitlement_grants`) kamen darin nicht vor, ein
-- bezahlter Governance Launch hätte also keine Wirkung gehabt.
--
-- Neu: Vereinigung aus
--   (a) dem Produkt der Subscription (Auflösung unverändert)
--   (b) den Produkten aller gültigen Grants des Tenants
--
-- Konfliktregel: höherer Wert gewinnt. `-1` bedeutet laut Wertsemantik
-- „unbegrenzt" und muss deshalb jeden endlichen Wert schlagen — MAX() allein
-- würde es als kleinsten Zahlwert behandeln, der CASE hebt es explizit an.
-- Ein Growth-Kunde verliert damit nichts, wenn er zusätzlich kauft.
--
-- ── Fallback-Kette (wichtig) ───────────────────────────────────────────────
--   Produktion und Repo sind hier auseinandergelaufen. Prüfung der Live-DB am
--   2026-08-08: dort läuft noch die Fassung von 20260430200000 mit Fallback
--   `'free'`; die Korrektur auf `'free_tier'` (20260802000000) wurde nie
--   angewandt, und ein Produkt mit default_for_plan_key='free_tier' existiert
--   in Produktion NICHT.
--
--   Ein hart auf `'free_tier'` gesetzter Fallback hätte dort jedem Tenant
--   ohne Subscription SÄMTLICHE Rechte entzogen (kein Produkt trifft zu →
--   leeres Ergebnis). Die Kette probiert deshalb der Reihe nach:
--     1. Stripe-Price-Treffer der Subscription
--     2. default_for_plan_key der Subscription
--     3. 'free_tier'  (Repo-Zielzustand, sobald 20260802000000 angewandt ist)
--     4. 'free'       (aktueller Produktionszustand)
--   Sie ist damit in BEIDEN Welten korrekt und bleibt es während der
--   Migrations-Nachführung (docs/runbooks/p0-2-migration-reconciliation.md).
--
--   Zusätzlich robuster als zuvor: hat eine Subscription einen plan_key ohne
--   passendes Produkt, lieferte die alte Fassung ein LEERES Ergebnis. Jetzt
--   greift der Free-Fallback — „kein Produkt gefunden" darf keinen Tenant
--   komplett aussperren.
--
-- Compliance-Bezug
--   EU AI Act Art. 12 / Art. 26: Der gewährte Governance-Umfang muss zu jedem
--   Zeitpunkt aus persistierten Verträgen ableitbar sein. Diese Funktion ist
--   die einzige Stelle, die das tut — daher STABLE, SECURITY DEFINER und ein
--   fixierter search_path.

CREATE OR REPLACE FUNCTION public.tenant_entitlements(p_tenant_id UUID)
RETURNS TABLE (key TEXT, kind TEXT, value INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH active_sub AS (
        SELECT *
        FROM public.subscriptions
        WHERE tenant_id = p_tenant_id
        ORDER BY updated_at DESC
        LIMIT 1
    ),
    -- (a) Produkt der Subscription, mit der oben beschriebenen Fallback-Kette.
    subscription_product AS (
        SELECT COALESCE(
            (SELECT p.id FROM public.products p
              WHERE p.stripe_price_id = (SELECT stripe_price_id FROM active_sub)),
            (SELECT p.id FROM public.products p
              WHERE p.default_for_plan_key = (SELECT plan_key FROM active_sub)),
            (SELECT p.id FROM public.products p WHERE p.default_for_plan_key = 'free_tier'),
            (SELECT p.id FROM public.products p WHERE p.default_for_plan_key = 'free')
        ) AS id
    ),
    -- (b) Produkte aller gültigen Grants. Widerrufene und abgelaufene Grants
    --     gewähren bewusst nichts, bleiben aber als Prüfpfad bestehen.
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
    JOIN public.entitlements e          ON e.id = pe.entitlement_id
    GROUP BY e.key, e.kind;
$$;

COMMENT ON FUNCTION public.tenant_entitlements(UUID) IS
    'Vereinigt die Entitlements der Subscription mit denen aller gültigen entitlement_grants (status=active, nicht abgelaufen). Konflikt: höherer Wert gewinnt, -1 (unbegrenzt) schlägt jeden endlichen Wert. Produktauflösung: Stripe-Price, sonst default_for_plan_key, sonst free_tier, sonst free.';

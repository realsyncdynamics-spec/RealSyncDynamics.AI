-- ═══════════════════════════════════════════════════════════════════════════
--  tenant_entitlements(): Abo UND Einmalkäufe vereinigen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bisher (20260802000000) löste die Funktion GENAU EIN Produkt auf: das des
-- jüngsten Abos, mit Fallback auf `free_tier`. Einmalkäufe
-- (`tenant_one_time_purchases`) kamen darin nicht vor — ein bezahlter
-- Governance Launch hätte keine Wirkung gehabt.
--
-- Jetzt: Vereinigung aus
--   (a) dem Produkt des Abos  — Auflösung unverändert: erst Treffer über
--       `stripe_price_id`, sonst über `default_for_plan_key`, sonst
--       `free_tier`
--   (b) den Produkten aller bezahlten Einmalkäufe des Tenants
--
-- Konfliktregel: MAX(value) je Key. Damit gilt immer der größere Umfang.
--   - Ein Growth-Kunde, der zusätzlich Governance Launch bucht, VERLIERT
--     nichts: wo Growth höher liegt, gewinnt Growth.
--   - Ein Tenant ohne Abo bekommt durch den Kauf echte Entitlements.
--   `-1` bedeutet laut Wertsemantik „unbegrenzt" und ist damit das Maximum;
--   MAX() würde es jedoch als kleinsten Zahlwert behandeln. Der CASE unten
--   hebt `-1` deshalb explizit über jeden endlichen Wert.
--
-- Der `free_tier`-Fallback aus 20260802000000 bleibt erhalten. Er darf nicht
-- auf 'free' zurückgedreht werden: die Governance-Module hängen an
-- `free_tier`, und ein Tenant ohne Abo verlöre sonst seinen Dashboard-Zugang.
--
-- Compliance-Bezug
--   EU AI Act Art. 12 / Art. 26: Der gewährte Governance-Umfang eines Tenants
--   muss zu jedem Zeitpunkt aus persistierten Verträgen ableitbar sein. Diese
--   Funktion ist die einzige Stelle, die das tut — deshalb STABLE und
--   SECURITY DEFINER mit fixiertem search_path.

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
    -- (a) Produkt des Abos — Auflösung identisch zu 20260802000000.
    subscription_product AS (
        SELECT p.id
        FROM public.products p
        WHERE p.stripe_price_id = (SELECT stripe_price_id FROM active_sub)
        UNION ALL
        SELECT p.id
        FROM public.products p
        WHERE p.default_for_plan_key = COALESCE(
            (SELECT plan_key FROM active_sub),
            'free_tier'
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.products p2
            WHERE p2.stripe_price_id = (SELECT stripe_price_id FROM active_sub)
        )
        LIMIT 1
    ),
    -- (b) Produkte aller bezahlten Einmalkäufe. Erstattete und noch nicht
    --     bestätigte Käufe gewähren bewusst nichts.
    one_time_products AS (
        SELECT DISTINCT p.id
        FROM public.tenant_one_time_purchases otp
        JOIN public.products p
          ON p.stripe_price_id = otp.stripe_price_id
          OR p.default_for_plan_key = otp.plan_key
        WHERE otp.tenant_id = p_tenant_id
          AND otp.status = 'paid'
    ),
    contributing_products AS (
        SELECT id FROM subscription_product
        UNION
        SELECT id FROM one_time_products
    )
    SELECT
        e.key,
        e.kind,
        -- „unbegrenzt" (-1) schlägt jeden endlichen Wert.
        CASE WHEN bool_or(pe.value = -1) THEN -1 ELSE MAX(pe.value) END AS value
    FROM contributing_products cp
    JOIN public.product_entitlements pe ON pe.product_id = cp.id
    JOIN public.entitlements e          ON e.id = pe.entitlement_id
    GROUP BY e.key, e.kind;
$$;

COMMENT ON FUNCTION public.tenant_entitlements(UUID) IS
    'Vereinigt die Entitlements des Abos mit denen aller bezahlten Einmalkäufe (tenant_one_time_purchases). Konflikt: höherer Wert gewinnt, -1 (unbegrenzt) schlägt jeden endlichen Wert. Abo-Auflösung: Stripe-Price-Treffer, sonst default_for_plan_key, sonst free_tier.';

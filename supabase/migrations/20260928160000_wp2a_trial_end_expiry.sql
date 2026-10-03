-- WP2a — Testphasen laufen ab (Blocker B11, .claude/os-funnel/PLAN.md §2).
--
-- ── Der Befund ─────────────────────────────────────────────────────────────
--
-- `create-trial-subscription` legt kartenlose Testphasen an: `status =
-- 'trialing'` plus `trial_end`, ohne Stripe-Subscription. Der Auflöser
-- `tenant_entitlements_resolve()` (20260920130000) zählte jedes
-- `trialing`-Abo als wirksam und las `trial_end` nicht; kein Webhook und
-- kein Job setzt eine abgelaufene Testphase zurück. Ergebnis: Growth-Rechte
-- ohne Ende für jeden, der einmal eine Testphase gestartet hat.
--
-- ── Die Regel ──────────────────────────────────────────────────────────────
--
-- `abo_wirksam` zählt `trialing` nur noch, solange
-- `COALESCE(trial_end, trial_ends_at)` in der Zukunft liegt oder fehlt.
-- Fehlt das Ende, ist es eine Stripe-Testphase, die Stripe selbst per
-- Statuswechsel beendet. Alles andere bleibt Zeile für Zeile wie in
-- 20260920130000: Grace Period, Produktauflösung, Grants, Add-ons,
-- Aggregation, Signatur und Rechte (CREATE OR REPLACE behält sie).
--
-- Wie bei der Grace Period verliert der Mandant nach Ablauf die bezahlten
-- Funktionen, **nicht** seine Daten: Diese Function liest nur.
--
-- Die öffentliche Hülle `tenant_entitlements()` bleibt unverändert; sie ruft
-- diesen Rumpf auf. Geprüft durch test/runtime/db/trial-expiry.db.test.ts.

BEGIN;

CREATE OR REPLACE FUNCTION public.tenant_entitlements_resolve(p_tenant_id uuid)
 RETURNS TABLE(key text, kind text, value integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  WITH active_sub AS (
    SELECT *
    FROM public.subscriptions
    WHERE tenant_id = p_tenant_id
    ORDER BY updated_at DESC
    LIMIT 1
  ),
  abo_wirksam AS (
    SELECT CASE
      -- Regulär zahlend.
      WHEN s.status = 'active' THEN true

      -- Testphase: nur bis zu ihrem Ende. Kartenlose Testphasen
      -- (`create-trial-subscription`) schreiben `trial_end` ohne
      -- Stripe-Subscription; kein Webhook und kein Job beendet sie — deshalb
      -- prüft der Auflöser das Ende selbst. `trial_end IS NULL` gilt bewusst
      -- als laufend: eine Stripe-Testphase ohne gespeichertes Ende beendet
      -- Stripe über den Statuswechsel (trialing → active/past_due/canceled).
      WHEN s.status = 'trialing'
       AND (COALESCE(s.trial_end, s.trial_ends_at) IS NULL
            OR COALESCE(s.trial_end, s.trial_ends_at) > now()) THEN true

      -- Zahlungsverzug innerhalb der Grace Period: alles bleibt aktiv.
      -- `past_due_since IS NULL` gilt bewusst als „innerhalb" — eine fehlende
      -- Information ist kein Zahlungsverzug.
      WHEN s.status = 'past_due'
       AND (s.past_due_since IS NULL
            OR s.past_due_since > now() - interval '7 days') THEN true

      ELSE false
    END AS ok
    FROM active_sub s
  ),
  subscription_product AS (
    SELECT CASE
      -- Kein wirksames Abo — auch der Fall „gar keine Subscription", weil
      -- `abo_wirksam` dann keine Zeile liefert und der Ausdruck NULL wird.
      WHEN (SELECT ok FROM abo_wirksam) IS NOT TRUE THEN
        COALESCE(
          (SELECT p.id FROM public.products p
            WHERE p.default_for_plan_key = 'free_audit'
              AND EXISTS (SELECT 1 FROM public.product_entitlements pe WHERE pe.product_id = p.id)
            LIMIT 1),
          (SELECT p.id FROM public.products p WHERE p.default_for_plan_key = 'free_tier' LIMIT 1),
          (SELECT p.id FROM public.products p WHERE p.default_for_plan_key = 'free' LIMIT 1)
        )

      ELSE
        COALESCE(
          (SELECT p.id FROM public.products p
            WHERE p.stripe_price_id = (SELECT stripe_price_id FROM active_sub)
              AND EXISTS (SELECT 1 FROM public.product_entitlements pe WHERE pe.product_id = p.id)
            LIMIT 1),
          (SELECT p.id FROM public.products p
            WHERE p.default_for_plan_key = (SELECT plan_key FROM active_sub)
              AND EXISTS (SELECT 1 FROM public.product_entitlements pe WHERE pe.product_id = p.id)
            LIMIT 1),
          -- Variantenschlüssel auf den Basisplan zurückführen, damit eine
          -- Jahresvariante ohne eigenes Produkt nicht ins Leere fällt.
          (SELECT p.id FROM public.products p
            WHERE p.default_for_plan_key = regexp_replace(
                    COALESCE((SELECT plan_key FROM active_sub), ''), '_yearly$', '')
              AND EXISTS (SELECT 1 FROM public.product_entitlements pe WHERE pe.product_id = p.id)
            LIMIT 1),
          (SELECT p.id FROM public.products p WHERE p.default_for_plan_key = 'free_tier' LIMIT 1),
          (SELECT p.id FROM public.products p WHERE p.default_for_plan_key = 'free' LIMIT 1)
        )
    END AS id
  ),
  grant_products AS (
    -- Einmal-Grants bleiben von der Grace Period unberührt.
    SELECT DISTINCT g.product_id AS id
    FROM public.entitlement_grants g
    WHERE g.tenant_id = p_tenant_id
      AND g.status = 'active'
      AND g.source <> 'addon_subscription'
      AND (g.expires_at IS NULL OR g.expires_at > now())
  ),
  contributing_products AS (
    SELECT id FROM subscription_product WHERE id IS NOT NULL
    UNION
    SELECT id FROM grant_products
  ),
  basis AS (
    SELECT
      e.key,
      e.kind,
      CASE WHEN bool_or(pe.value = -1) THEN -1 ELSE MAX(pe.value) END AS value
    FROM contributing_products cp
    JOIN public.product_entitlements pe ON pe.product_id = cp.id
    JOIN public.entitlements e ON e.id = pe.entitlement_id
    GROUP BY e.key, e.kind
  ),
  addon_grants AS (
    -- Positionen des Abos: wirksam genau dann, wenn das Abo wirksam ist.
    SELECT g.product_id, GREATEST(COALESCE(g.quantity, 1), 1) AS quantity
    FROM public.entitlement_grants g
    WHERE g.tenant_id = p_tenant_id
      AND g.status = 'active'
      AND g.source = 'addon_subscription'
      AND (g.expires_at IS NULL OR g.expires_at > now())
      AND (SELECT ok FROM abo_wirksam) IS TRUE
  ),
  zusatz AS (
    SELECT
      e.key,
      e.kind,
      CASE
        WHEN bool_or(pe.value = -1) THEN -1
        WHEN e.kind = 'limit' THEN SUM(pe.value * ag.quantity)::integer
        ELSE MAX(pe.value)
      END AS value
    FROM addon_grants ag
    JOIN public.product_entitlements pe ON pe.product_id = ag.product_id
    JOIN public.entitlements e ON e.id = pe.entitlement_id
    GROUP BY e.key, e.kind
  )
  SELECT
    COALESCE(b.key, z.key) AS key,
    COALESCE(b.kind, z.kind) AS kind,
    CASE
      WHEN b.value = -1 OR z.value = -1 THEN -1
      WHEN COALESCE(b.kind, z.kind) = 'limit'
        THEN (COALESCE(b.value, 0) + COALESCE(z.value, 0))::integer
      ELSE GREATEST(COALESCE(b.value, 0), COALESCE(z.value, 0))
    END AS value
  FROM basis b
  FULL OUTER JOIN zusatz z ON z.key = b.key;
$function$;

COMMENT ON FUNCTION public.tenant_entitlements_resolve(uuid) IS
  'Interner Entitlement-Auflöser OHNE Autorisierungsprüfung. Nur für '
  'SECURITY-DEFINER-Funktionen dieser Datenbank (tenant_entitlements, '
  'bots_enforce_quota). Öffentliche Aufrufer nutzen tenant_entitlements(). '
  'Seit 20260928160000 (WP2a) zählt trialing nur bis trial_end/trial_ends_at.';

COMMIT;

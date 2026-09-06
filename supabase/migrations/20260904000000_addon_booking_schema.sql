-- ═══════════════════════════════════════════════════════════════════════════
--  Add-on-Buchung — Schema (AP5, AP6, AP8) und additive Kontingente im Auflöser
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Plan: docs/product/implementierungsplan-paketmodell.md AP5–AP8,
-- Hergang und Vertrag: docs/product/addon-booking.md.
--
-- Was diese Migration leistet:
--   1. `plan_addons` bekommt den wiederkehrenden Stripe-Price, das Produkt,
--      das seine Rechte trägt, und die gewährten Keys (`grants`).
--   2. `entitlement_dependencies` — Abhängigkeiten zwischen Keys, geprüft
--      beim Buchen (AP8). Die Zeilen selbst schreibt die Katalog-Migration.
--   3. `entitlement_grants` kennt die Quelle `addon_subscription` samt Menge
--      und Stripe-Position — ein Add-on wird über denselben Grant-Weg
--      wirksam wie ein Einmalkauf (AP6.2, Empfehlung „entitlement_grants").
--   4. `subscription_addons` bekommt Mandant und Zustand; die Tabelle war
--      seit 20260406 leer und ohne Schreiber.
--   5. `tenant_entitlements()` summiert Kontingente aus Add-on-Grants auf den
--      Planwert, statt das Maximum zu nehmen. Signatur, Mitgliedschaftsprüfung
--      und Grace Period bleiben unverändert.
--
-- Was sie NICHT tut: Sie legt keinen Stripe-Price an (AP5 braucht die
-- Freigabe des Eigentümers und läuft außerhalb des Repos). Solange
-- `plan_addons.stripe_price_id` NULL ist, meldet `subscription-addons` das
-- Add-on ehrlich als „noch nicht buchbar" — kein Knopf, der ins Leere greift.
--
-- Alles additiv. Kein Key, kein Produkt, kein Preis wird gelöscht.

BEGIN;

-- ── 1. plan_addons ─────────────────────────────────────────────────────────

ALTER TABLE public.plan_addons
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS grants jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS per_unit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.plan_addons.stripe_price_id IS
  'Wiederkehrender Stripe-Price (price_…) des Add-ons. NULL = noch nicht '
  'buchbar. Trägt der Betreiber nach; der Katalog-Generator überschreibt '
  'diese Spalte nie.';
COMMENT ON COLUMN public.plan_addons.product_id IS
  'products-Zeile, deren product_entitlements der Add-on-Grant gewährt. '
  'Sentinel-Price internal_addon_<addon_id>, kein default_for_plan_key.';
COMMENT ON COLUMN public.plan_addons.grants IS
  'Gewährte Entitlement-Keys mit Wert, Spiegel von AddOn.grants in '
  'shared/pricing.ts. Zur Anzeige — autorisiert wird über product_entitlements.';

-- Eine Price gehört zu genau einem Add-on; NULL bleibt mehrfach erlaubt.
CREATE UNIQUE INDEX IF NOT EXISTS plan_addons_stripe_price_id_key
  ON public.plan_addons (stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

-- ── 2. entitlement_dependencies (AP8) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.entitlement_dependencies (
  entitlement_id          uuid NOT NULL REFERENCES public.entitlements(id) ON DELETE CASCADE,
  requires_entitlement_id uuid NOT NULL REFERENCES public.entitlements(id) ON DELETE CASCADE,
  created_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entitlement_id, requires_entitlement_id),
  CONSTRAINT entitlement_dependencies_not_self CHECK (entitlement_id <> requires_entitlement_id)
);

COMMENT ON TABLE public.entitlement_dependencies IS
  'Key A setzt Key B voraus. Geprüft beim Buchen eines Add-ons '
  '(subscription-addons), nicht in tenant_entitlements(). Quelle: '
  'ENTITLEMENT_DEPENDENCIES in shared/pricing.ts.';

-- Globaler Katalog ohne Mandantenbezug — lesbar für angemeldete Nutzer wie
-- `entitlements` selbst; schreiben nur per Service-Role (keine Policy).
ALTER TABLE public.entitlement_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "entitlement_dependencies read" ON public.entitlement_dependencies;
CREATE POLICY "entitlement_dependencies read"
  ON public.entitlement_dependencies FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── 3. entitlement_grants: Quelle addon_subscription ───────────────────────

ALTER TABLE public.entitlement_grants
  DROP CONSTRAINT IF EXISTS entitlement_grants_source_check;
ALTER TABLE public.entitlement_grants
  ADD CONSTRAINT entitlement_grants_source_check
  CHECK (source IN ('one_time_purchase', 'manual', 'promotion', 'migration', 'addon_subscription'));

ALTER TABLE public.entitlement_grants
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS addon_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_item_id text;

ALTER TABLE public.entitlement_grants
  DROP CONSTRAINT IF EXISTS entitlement_grants_quantity_positive;
ALTER TABLE public.entitlement_grants
  ADD CONSTRAINT entitlement_grants_quantity_positive CHECK (quantity >= 1);

COMMENT ON COLUMN public.entitlement_grants.quantity IS
  'Gebuchte Menge (per_unit-Add-ons). Kontingente des Produkts werden in '
  'tenant_entitlements() damit multipliziert. Einzelpositionen: 1.';
COMMENT ON COLUMN public.entitlement_grants.stripe_subscription_item_id IS
  'Stripe-Position (si_…) des Add-ons. Bei source = addon_subscription '
  'zugleich purchase_reference — der Idempotenz-Anker für den Webhook.';

CREATE INDEX IF NOT EXISTS entitlement_grants_subscription_idx
  ON public.entitlement_grants (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ── 4. subscription_addons: Mandant und Zustand ────────────────────────────

ALTER TABLE public.subscription_addons
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.subscription_addons
  DROP CONSTRAINT IF EXISTS subscription_addons_status_check;
ALTER TABLE public.subscription_addons
  ADD CONSTRAINT subscription_addons_status_check CHECK (status IN ('active', 'removed'));

CREATE INDEX IF NOT EXISTS subscription_addons_tenant_status_idx
  ON public.subscription_addons (tenant_id, status);

COMMENT ON TABLE public.subscription_addons IS
  'Add-on-Positionen eines Abos (Stripe subscription items). Geschrieben von '
  'subscription-addons und stripe-webhook. RLS deny_all: gelesen wird über '
  'die Function, die Berechtigungen liefert tenant_entitlements().';

-- ── 5. Auflöser: Kontingente aus Add-ons sind additiv ──────────────────────
--
-- Unverändert gegenüber 20260831020000: Mitgliedschaftsprüfung (inkl.
-- Service-Role), Auswahl der jüngsten Subscription, Grace Period
-- (`abo_wirksam`), Auflösung des Abo-Produkts, Behandlung von Einmal-Grants.
--
-- Neu: Grants mit `source = 'addon_subscription'` werden getrennt
-- aggregiert. Für `limit`-Keys wird ihr Wert (mal Menge) auf den Wert aus
-- Abo und Einmal-Grants **addiert**; boolesche Keys werden vereinigt; `-1`
-- schlägt weiterhin alles. Ohne diese Trennung ergäbe ein Response Pack
-- (+5.000) auf Growth (2.000) per MAX() 5.000 statt 7.000 — der Kunde
-- bekäme weniger, als er bezahlt.
--
-- Add-on-Grants zählen nur, solange das Abo wirksam ist: Sie sind Positionen
-- dieses Abos. Endet es oder läuft die Grace Period ab, ruhen sie mit ihm —
-- ohne dass jemand die Grant-Zeilen anfassen müsste.
CREATE OR REPLACE FUNCTION public.tenant_entitlements(p_tenant_id uuid)
 RETURNS TABLE(key text, kind text, value integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  WITH authorized AS (
    SELECT (
      -- Serverseitiger Aufruf: Edge Functions lösen Entitlements über den
      -- Admin-Client auf. Dort gibt es keinen angemeldeten Nutzer.
      auth.role() = 'service_role'
      -- Aufruf aus dem Browser: nur für den eigenen Mandanten.
      OR EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.tenant_id = p_tenant_id
          AND m.user_id = auth.uid()
      )
    ) AS ok
  ),
  active_sub AS (
    SELECT *
    FROM public.subscriptions
    WHERE tenant_id = p_tenant_id
    ORDER BY updated_at DESC
    LIMIT 1
  ),
  abo_wirksam AS (
    SELECT CASE
      -- Regulär zahlend oder in der Testphase.
      WHEN s.status IN ('active', 'trialing') THEN true

      -- Zahlungsverzug innerhalb der Grace Period: alles bleibt aktiv.
      --
      -- `past_due_since IS NULL` gilt bewusst als „innerhalb". Fehlt der
      -- Zeitstempel — bei Altdaten oder wenn das Webhook-Ereignis nie
      -- ankam —, darf daraus keine Sperrung entstehen. Eine fehlende
      -- Information ist kein Zahlungsverzug. Lieber ein Kunde zu lange
      -- freigeschaltet als einer zu Unrecht ausgesperrt.
      WHEN s.status = 'past_due'
       AND (s.past_due_since IS NULL
            OR s.past_due_since > now() - interval '7 days') THEN true

      -- Alles Übrige (past_due nach Ablauf, canceled, unpaid,
      -- incomplete_expired, paused) zählt nicht mehr.
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
    -- Einmal-Grants bleiben von der Grace Period unberührt: Ein Einmalkauf
    -- ist bezahlt und verfällt nicht, weil ein *anderes* Abo in Verzug gerät.
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
  FULL OUTER JOIN zusatz z ON z.key = b.key
  CROSS JOIN authorized a
  WHERE a.ok;
$function$;

COMMENT ON FUNCTION public.tenant_entitlements(uuid) IS
  'Wirksame Entitlements eines Mandanten: Abo-Produkt (mit Grace Period) '
  'vereinigt mit Einmal-Grants per MAX, Add-on-Grants additiv für limit-Keys '
  '(mal Menge), -1 schlägt alles. Service-Role oder Mitgliedschaft nötig. '
  'Siehe 20260904000000_addon_booking_schema.sql.';

-- CREATE OR REPLACE behält Privilegien; das Grant steht trotzdem hier, damit
-- ein frisches `db reset` denselben Stand erreicht wie 20260831020000.
GRANT EXECUTE ON FUNCTION public.tenant_entitlements(uuid) TO authenticated;

COMMIT;

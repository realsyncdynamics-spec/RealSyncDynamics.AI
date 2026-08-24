-- AP4 — Grace Period: sieben Tage nach einer fehlgeschlagenen Zahlung.
--
-- Entscheidung des Eigentümers vom 2026-08-24:
--   „Bei past_due innerhalb der Grace Period bleibt alles aktiv — Dashboard,
--    Governance-Funktionen, Monitoring, geplante Scans. Erst nach Ablauf der
--    sieben Tage werden die kostenpflichtigen Entitlements pausiert. Wir
--    wollen nicht ausgerechnet bei einem Zahlungsproblem die
--    Governance-Überwachung eines Kunden abrupt abschalten."
--
-- ── Der Befund, der das nötig macht ────────────────────────────────────────
--
-- `tenant_entitlements()` fragte den Status der Subscription **gar nicht** ab.
-- Ein Abo in `past_due`, `canceled` oder `unpaid` lieferte damit unbegrenzt
-- weiter alle Berechtigungen. Es gab also keine Ablaufsteuerung — die Grace
-- Period war faktisch unendlich.
--
-- ── Die fehlende Information ───────────────────────────────────────────────
--
-- `subscriptions` hatte keine Spalte, die festhält, **wann** `past_due`
-- begann. Vorhanden waren `status`, `current_period_end`, `canceled_at` und
-- `updated_at` — keine davon taugt dafür: `updated_at` ändert sich bei jeder
-- Änderung, und `current_period_end` schreibt Stripe je nach Konfiguration
-- fort. Deshalb eine eigene Spalte, gesetzt vom Webhook.

BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz;

COMMENT ON COLUMN public.subscriptions.past_due_since IS
  'Beginn des Zahlungsverzugs. Gesetzt von stripe-webhook beim Wechsel nach '
  'past_due, geleert bei jedem anderen Status. Anker der 7-Tage-Grace-Period '
  'in tenant_entitlements(). NULL bei past_due bedeutet bewusst: keine '
  'Sperrung — siehe Migration 20260829000000.';

-- ── Der Auflöser ───────────────────────────────────────────────────────────
--
-- Unverändert bleiben: die Mitgliedschaftsprüfung (`authorized`), die Auswahl
-- der jüngsten Subscription, die additive Vereinigung mit den Grant-Produkten,
-- die Aggregation (`-1` schlägt jeden endlichen Wert) und die Signatur.
--
-- Neu ist `abo_wirksam`: Es entscheidet, ob das Abo für die Auflösung zählt.
-- Zählt es nicht, fällt der Mandant auf den Free-Plan zurück — er verliert
-- die bezahlten Funktionen, **nicht** seine Daten. Mandant, Domains, Evidence,
-- Prüfpfad und Konfiguration bleiben unangetastet; diese Function liest nur.
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
    -- Grants bleiben von der Grace Period unberührt: Ein Einmalkauf ist
    -- bezahlt und verfällt nicht, weil ein *anderes* Abo in Verzug gerät.
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

-- Ausführungsrecht ausdrücklich setzen. `tenant_entitlements` stand in #1124
-- namentlich auf der Liste der Functions, deren Rechte einmal verlorengegangen
-- waren; sich auf das Erhalten der ACL durch CREATE OR REPLACE zu verlassen,
-- wäre genau die Annahme, die schon einmal nicht gehalten hat.
GRANT EXECUTE ON FUNCTION public.tenant_entitlements(uuid) TO authenticated;

COMMIT;

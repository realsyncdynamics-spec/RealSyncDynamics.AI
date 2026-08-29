-- Korrektur einer Regression, die auf diesem Branch entstanden ist.
--
-- ── Was passiert ist ───────────────────────────────────────────────────────
--
-- `20260828010000_entitlement_yearly_products_and_resolver.sql` hat
-- `tenant_entitlements()` um eine Mitgliedschaftsprüfung ergänzt:
--
--     WITH authorized AS (
--       SELECT EXISTS (SELECT 1 FROM memberships m
--                      WHERE m.tenant_id = p_tenant_id
--                        AND m.user_id = auth.uid()) AS ok
--     )
--     … CROSS JOIN authorized a WHERE a.ok
--
-- Der Kommentar dort behauptet, die Prüfung sei „unverändert" übernommen
-- worden. Das war falsch: Die Fassung davor (20260808120000) hatte **keine**.
-- Die Prüfung schließt ein echtes Loch — vorher konnte jeder eingeloggte
-- Nutzer die Entitlements jedes beliebigen Mandanten lesen. Sie sperrt aber
-- zugleich den Aufrufer aus, für den die Funktion in erster Linie da ist.
--
-- ── Warum das den Server trifft ────────────────────────────────────────────
--
-- `_shared/entitlements.ts` und `_shared/usage.ts` rufen die Funktion über
-- den **Admin-Client** auf (`admin.rpc('tenant_entitlements', …)`). Ein
-- service_role-Token trägt keinen `sub`-Claim, also ist `auth.uid()` NULL,
-- also greift keine Mitgliedschaft, also liefert die Funktion null Zeilen.
--
-- Folgen, beide schlecht und in verschiedene Richtungen:
--
--   `gateFeature()`    → `hasFeature()` false → FORBIDDEN. Alle zehn
--                        Functions mit Entitlement-Gate (bot-chat,
--                        policy-packs, evidence-vault, scheduler,
--                        bulk-scan, provenance, bot-voice-webhook,
--                        automation-trigger, whatsapp-webhook,
--                        workflow-trigger) hätten **jeden** Aufruf
--                        abgewiesen, für jeden Plan bis Enterprise.
--
--   `consumeUsage()`   → `planLimit` NULL → die Plan-Grenze wird
--                        übersprungen. Kontingente wären lautlos
--                        wirkungslos geworden.
--
-- Gemessen gegen eine echte PostgreSQL, Growth-Mandant mit 47 Entitlements:
--
--   | Aufrufer                     | vor 20260828010000 | mit Prüfung | hier |
--   |------------------------------|-------------------:|------------:|-----:|
--   | Browser, Mitglied            |                 47 |          47 |   47 |
--   | Edge Function (service_role) |                 47 |       **0** |   47 |
--   | Fremder eingeloggter Nutzer  |             **47** |           0 |    0 |
--
-- Die mittlere Spalte ist der Stand dieses Branches, die rechte der Stand
-- nach dieser Migration. Beide Eigenschaften sollen gelten, nicht eine.
--
-- ── Die Korrektur ─────────────────────────────────────────────────────────
--
-- `authorized` erlaubt zusätzlich den service_role-Aufruf. `auth.role()`
-- liest den Rollen-Claim des JWT und funktioniert deshalb auch in einer
-- SECURITY-DEFINER-Funktion, in der `current_user` der Eigentümer ist.
--
-- Das ist keine Aufweichung: Wer den service_role-Key hat, umgeht RLS
-- ohnehin vollständig und könnte `product_entitlements` direkt lesen. Die
-- Prüfung schützt gegen fremde **Nutzer**-Token, und genau das tut sie
-- weiterhin.
--
-- Der Rest der Funktion ist Wort für Wort der Stand aus
-- 20260829000000_grace_period.sql.

BEGIN;

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

COMMENT ON FUNCTION public.tenant_entitlements(uuid) IS
  'Loest die Entitlements eines Mandanten auf: wirksames Abo (inkl. 7 Tage '
  'Grace Period bei past_due) vereinigt mit allen gueltigen '
  'entitlement_grants; -1 (unbegrenzt) schlaegt jeden endlichen Wert. '
  'Zugriff: eigener Mandant (Mitgliedschaft) oder service_role — Edge '
  'Functions loesen ueber den Admin-Client auf und haben keinen Nutzer.';

-- Wie in 20260829000000 ausdruecklich gesetzt statt auf das Erhalten der ACL
-- durch CREATE OR REPLACE zu vertrauen.
GRANT EXECUTE ON FUNCTION public.tenant_entitlements(uuid) TO authenticated;

COMMIT;

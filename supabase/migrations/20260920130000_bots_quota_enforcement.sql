-- Bot-Kontingent serverseitig durchsetzen (P0-5b).
--
-- ── Befund (2026-09-20) ───────────────────────────────────────────────────
--
-- `limit.bots` wird verkauft (Starter 1 / Growth 2 / Agency 10 / Partner 50)
-- und nirgends durchgesetzt. Bot-Anlage läuft aus dem Browser direkt über
-- PostgREST auf `public.bots`; die vier RLS-Policies prüfen nur
-- `is_tenant_member(tenant_id)`. Keine Edge Function im Schreibpfad, kein
-- Trigger, kein Zähler. `limit.bots` kam ausschließlich in Anzeige-Code vor.
--
-- ── Entwurf ───────────────────────────────────────────────────────────────
--
-- 1. Der Entitlement-Auflöser wird in zwei Funktionen geteilt, ohne seine
--    Logik zu verdoppeln: `tenant_entitlements_resolve()` ist der bisherige
--    Rumpf OHNE die Autorisierungs-CTE; `tenant_entitlements()` wird zur
--    dünnen Hülle, die genau diese Prüfung (service_role ODER Mitgliedschaft)
--    davorsetzt. Vertrag und Rechte der öffentlichen Funktion bleiben gleich.
--
--    Warum: Die Autorisierung hängt an `auth.uid()` / `auth.role()`, also an
--    JWT-Claims. Ein Trigger, der aus einer Migration, einem Seed, psql oder
--    dem SQL-Editor feuert, hat keine — und bekäme vom öffentlichen Auflöser
--    eine leere Menge. Ein Kontingent, das je nach Aufrufkontext „leer" ist,
--    ist keins. Der Trigger liest deshalb den internen Rumpf; der ist
--    SECURITY DEFINER, für anon/authenticated nicht ausführbar und wird nur
--    von den beiden Definer-Funktionen dieser Datei aufgerufen.
--
-- 2. Quelle des Limits ist derselbe Auflöser wie für jedes andere Gate:
--    Abo-Produkt + Einmal-Grants + Add-on-Positionen (mal Menge), `-1`
--    schlägt alles. NICHT nur `plan_catalog.limits.bots`: „Add-on: Agency
--    Bot Pack" trägt `limit.bots = 5` und wird per Grant gebucht — wer nur
--    den Plan liest, sperrt genau die Kunden aus, die nachgekauft haben.
--
-- 3. `BEFORE INSERT ON public.bots`, je Zeile. Nicht auf UPDATE/DELETE:
--    Bearbeiten, Deaktivieren und Löschen bestehender Bots bleiben frei;
--    das Kontingent betrifft das Erzeugen zusätzlicher Bots.
--
-- 4. Atomar. Ein naives `count(*) < limit` lässt zwei gleichzeitige Inserts
--    beide den letzten Platz sehen. Deshalb VOR dem Zählen ein
--    transaktionsgebundener Advisory-Lock je Mandant
--    (`pg_advisory_xact_lock`): der zweite Insert wartet, bis der erste
--    festgeschrieben ist, zählt dann neu — und scheitert. Unter READ
--    COMMITTED (PostgREST-Default) sieht das Zählen nach dem Lock die
--    zwischenzeitlich festgeschriebene Zeile.
--
-- 5. Autorisierung zuerst. Postgres wendet die RLS-Policy (WITH CHECK) erst
--    NACH den BEFORE-Triggern an. Prüfte der Trigger das Kontingent vor der
--    Mitgliedschaft, verriete die Fehlerart einem angemeldeten Fremden Plan
--    und Auslastung des Mandanten. Deshalb steht für anon/authenticated
--    dieselbe Prüfung wie in der Policy an erster Stelle, mit derselben
--    Meldung und demselben SQLSTATE.
--
-- 6. Fail closed. Kein `bots.enabled`, kein `limit.bots` oder `0` → Insert
--    abgelehnt. Das gilt für jeden Aufrufer, service_role eingeschlossen:
--    die Produkt-Quota ist keine Frage der Datenbankrolle. Wer aus einer
--    Edge Function einen Bot anlegen will, prüft vorher (siehe
--    onboarding-orchestrator) und behandelt die Ablehnung.
--
-- ── Bestand ───────────────────────────────────────────────────────────────
--
-- Gemessen: kein Mandant über Limit. Ein Bot liegt auf dem Seed-Mandanten
-- `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` (free_audit, kein `bots.enabled`).
-- Diese Zeile bleibt: Durchsetzung ist vorwärtsgerichtet, die Migration
-- löscht nichts. Der Bot ist zur Laufzeit ohnehin stumm — `bot-chat` prüft
-- `bots.enabled`. Ein weiterer Bot für diesen Mandanten wird ab jetzt
-- abgelehnt.
--
-- Verifiziert durch test/runtime/db/bots-quota.db.test.ts (echtes Postgres)
-- und test/billing/bots-quota-contract.test.ts (Quelltext).

BEGIN;

-- ─── 0. Release-Gate: der Endzustand von #1491 muss vorliegen ────────────
--
-- Reihenfolge: #1491 → 20260920120000 → Verifikation → #1492 → diese Datei.
-- Ohne den korrigierten Katalog fiele Enterprise fail closed (kein
-- bots.enabled, kein limit.bots).
--
-- Geprüft wird der ZUSTAND, nicht ein Stellvertreter-Key: Das Vokabular
-- (bots.chat u. a.) legt bereits 20260628193759 an — auf einem frischen
-- `db reset` existiert es also auch ohne #1491, und ein Gate auf den Key
-- liefe dort ins Leere. Was auf der Live-DB fehlt und was #1491 herstellt,
-- ist die Zuordnung am aktuellen Enterprise-Produkt: bots.enabled = 1,
-- limit.bots = -1, bots.chat = 1 (PLAN_ENTITLEMENTS.enterprise). Trägt ein
-- Produkt mit default_for_plan_key enterprise / enterprise_yearly einen der
-- drei Werte nicht — oder gibt es gar kein solches Produkt —, bricht diese
-- Migration laut ab, statt still ein Kontingent von 0 zu erzwingen. Ist der Zustand bereits da (frischer
-- Reset, oder #1491 angewendet), läuft sie durch.
-- >>> RELEASE-GATE >>>
DO $$
BEGIN
  IF NOT EXISTS (
    -- Gar kein Enterprise-Produkt: dann kann auch #1491 nichts zuordnen
    -- (seine Migration joint an vorhandene products). Fail closed statt
    -- leerer Menge. enterprise_yearly muss nicht existieren — der Basisplan-
    -- Fallback in tenant_entitlements() deckt das ab —, eines von beiden aber.
    SELECT 1
    FROM public.products p
    WHERE p.default_for_plan_key IN ('enterprise', 'enterprise_yearly')
  )
  OR EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.default_for_plan_key IN ('enterprise', 'enterprise_yearly')
      AND (
        NOT EXISTS (
          SELECT 1 FROM public.product_entitlements pe
          JOIN public.entitlements e ON e.id = pe.entitlement_id
          WHERE pe.product_id = p.id AND e.key = 'bots.enabled' AND pe.value = 1
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.product_entitlements pe
          JOIN public.entitlements e ON e.id = pe.entitlement_id
          WHERE pe.product_id = p.id AND e.key = 'limit.bots' AND pe.value = -1
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.product_entitlements pe
          JOIN public.entitlements e ON e.id = pe.entitlement_id
          WHERE pe.product_id = p.id AND e.key = 'bots.chat' AND pe.value = 1
        )
      )
  ) THEN
    RAISE EXCEPTION 'Release-Gate: Entitlement-Parität aus 20260920120000 (#1491) fehlt — kein Enterprise-Produkt vorhanden oder eines trägt nicht bots.enabled=1, limit.bots=-1, bots.chat=1. Erst #1491 anwenden und verifizieren, dann 20260920130000.'
      USING ERRCODE = 'P0001';
  END IF;
END $$;
-- <<< RELEASE-GATE <<<

-- ─── 1. Interner Auflöser: bisheriger Rumpf ohne Autorisierungs-CTE ──────
--
-- Der Rumpf ist Zeile für Zeile der aus 20260904000000 (identisch mit der
-- deployten Funktion, per md5 des kommentarfreien Rumpfs geprüft) — nur die
-- CTE `authorized` und ihr CROSS JOIN fehlen. Sie sitzen jetzt in der Hülle.
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
      -- Regulär zahlend oder in der Testphase.
      WHEN s.status IN ('active', 'trialing') THEN true

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
  'bots_enforce_quota). Öffentliche Aufrufer nutzen tenant_entitlements().';

-- Kein Aufrufer außerhalb der Datenbank. Der Eigentümer (postgres) behält
-- EXECUTE; die beiden Definer-Funktionen unten laufen als Eigentümer.
REVOKE ALL ON FUNCTION public.tenant_entitlements_resolve(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- ─── 2. Öffentlicher Auflöser: Hülle mit der bisherigen Autorisierung ────
--
-- Gleiche Signatur, gleiche Rechte (CREATE OR REPLACE behält sie), gleiche
-- Regel: Serverseitiger Aufruf (service_role) sieht alles, ein Nutzer nur
-- seinen eigenen Mandanten, alle anderen nichts. Geprüft durch
-- test/runtime/db/tenant-entitlements-callers.db.test.ts.
CREATE OR REPLACE FUNCTION public.tenant_entitlements(p_tenant_id uuid)
 RETURNS TABLE(key text, kind text, value integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
  SELECT r.key, r.kind, r.value
  FROM public.tenant_entitlements_resolve(p_tenant_id) r
  WHERE
    -- Serverseitiger Aufruf: Edge Functions lösen Entitlements über den
    -- Admin-Client auf. Dort gibt es keinen angemeldeten Nutzer.
    auth.role() = 'service_role'
    -- Aufruf aus dem Browser: nur für den eigenen Mandanten.
    OR EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.tenant_id = p_tenant_id
        AND m.user_id = auth.uid()
    );
$function$;

COMMENT ON FUNCTION public.tenant_entitlements(uuid) IS
  'Wirksame Entitlements eines Mandanten: Abo-Produkt (mit Grace Period) '
  'vereinigt mit Einmal-Grants per MAX, Add-on-Grants additiv für limit-Keys '
  '(mal Menge), -1 schlägt alles. Service-Role oder Mitgliedschaft nötig. '
  'Rumpf in tenant_entitlements_resolve(); siehe 20260904000000 und '
  '20260920130000_bots_quota_enforcement.sql.';

GRANT EXECUTE ON FUNCTION public.tenant_entitlements(uuid) TO authenticated;

-- ─── 3. Bot-Kontingent eines Mandanten ───────────────────────────────────
--
-- `enabled`  = `bots.enabled` gewährt (1 oder -1)
-- `max_bots` = `limit.bots`; fehlt der Key, 0 — fail closed. (`free_audit`
--              führt `bots.count = 0` statt `limit.bots`; beides bedeutet
--              hier dasselbe: kein Bot.)
-- `used`     = vorhandene Bots des Mandanten, aktiv oder nicht. Ein
--              deaktivierter Bot ist ein konfigurierter Bot; Löschen gibt
--              den Platz frei.
CREATE OR REPLACE FUNCTION public.bots_quota(p_tenant_id uuid)
 RETURNS TABLE(enabled boolean, max_bots integer, used integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH ent AS (
    SELECT r.key, r.value FROM public.tenant_entitlements_resolve(p_tenant_id) r
  )
  SELECT
    COALESCE((SELECT e.value = -1 OR e.value > 0 FROM ent e WHERE e.key = 'bots.enabled'), false),
    COALESCE((SELECT e.value FROM ent e WHERE e.key = 'limit.bots'), 0),
    (SELECT count(*)::integer FROM public.bots b WHERE b.tenant_id = p_tenant_id);
$function$;

COMMENT ON FUNCTION public.bots_quota(uuid) IS
  'Bot-Kontingent eines Mandanten aus dem Entitlement-Auflöser: enabled, '
  'max_bots (-1 = unbegrenzt, 0 = keins), used. Für Edge Functions '
  '(service_role) und den Insert-Trigger auf public.bots.';

REVOKE ALL ON FUNCTION public.bots_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bots_quota(uuid) TO service_role;

-- ─── 4. Trigger: BEFORE INSERT, serialisiert je Mandant ─────────────────
CREATE OR REPLACE FUNCTION public.bots_enforce_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_enabled boolean;
  v_limit   integer;
  v_used    integer;
BEGIN
  -- Autorisierung VOR Lock und Kontingent. Postgres prüft die RLS-Policy
  -- (WITH CHECK) erst NACH den BEFORE-Triggern. Ohne diese Zeilen könnte ein
  -- angemeldeter Nutzer über die Fehlerart — BOTS_NOT_ENTITLED oder
  -- BOT_QUOTA_EXCEEDED statt 42501 — Plan und Auslastung eines fremden
  -- Mandanten ablesen. Gleiche Meldung, gleicher SQLSTATE wie die Policy:
  -- die beiden Pfade sind von außen nicht unterscheidbar. service_role ist
  -- hier ausgenommen und unterliegt danach trotzdem der Produkt-Quota; ein
  -- Aufruf ohne JWT (Migration, psql) hat auth.role() = NULL und ist kein
  -- Client.
  IF auth.role() IN ('anon', 'authenticated')
     AND NOT public.is_tenant_member(NEW.tenant_id) THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "bots"'
      USING ERRCODE = '42501';
  END IF;

  -- Erst der Lock, dann das Zählen. Der Lock lebt bis zum Ende der
  -- Transaktion; ein paralleler Insert desselben Mandanten wartet hier und
  -- zählt anschließend die inzwischen festgeschriebene Zeile mit.
  PERFORM pg_advisory_xact_lock(hashtext('public.bots.quota'), hashtext(NEW.tenant_id::text));

  SELECT q.enabled, q.max_bots, q.used
    INTO v_enabled, v_limit, v_used
    FROM public.bots_quota(NEW.tenant_id) q;

  IF NOT v_enabled OR v_limit = 0 THEN
    RAISE EXCEPTION 'Bots sind in diesem Plan nicht enthalten.'
      USING ERRCODE = 'P0001',
            DETAIL  = 'BOTS_NOT_ENTITLED',
            HINT    = 'Plan mit Bot-Modul wählen (ab Starter).';
  END IF;

  IF v_limit = -1 THEN
    RETURN NEW;
  END IF;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'Bot-Kontingent erreicht: % von % Bots belegt.', v_used, v_limit
      USING ERRCODE = 'P0001',
            DETAIL  = 'BOT_QUOTA_EXCEEDED',
            HINT    = 'Plan erweitern oder einen bestehenden Bot löschen.';
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.bots_enforce_quota() IS
  'BEFORE-INSERT-Trigger auf public.bots: lehnt den Insert ab, wenn der '
  'Mandant kein bots.enabled hat oder limit.bots erreicht ist. Advisory-Lock '
  'je Mandant macht die Prüfung gegen parallele Inserts dicht. DETAIL trägt '
  'den Code (BOTS_NOT_ENTITLED / BOT_QUOTA_EXCEEDED). Ein Client ohne '
  'Mitgliedschaft bekommt vorher 42501 wie von der RLS-Policy.';

DROP TRIGGER IF EXISTS bots_enforce_quota ON public.bots;
CREATE TRIGGER bots_enforce_quota
  BEFORE INSERT ON public.bots
  FOR EACH ROW
  EXECUTE FUNCTION public.bots_enforce_quota();

COMMIT;

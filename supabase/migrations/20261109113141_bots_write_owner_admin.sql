-- Schreibrechte auf public.bots: nur Owner/Admin des Mandanten.
--
-- Angleichung an die übrigen Bot-Konfigurationstabellen
-- (`voice_bot_configs`, `whatsapp_channels`): Anlegen, Ändern und Löschen
-- eines Bots ist eine Konfigurationsentscheidung des Mandanten und gehört
-- zu Owner/Admin. Lesen bleibt für jedes Mitglied offen.
--
-- Umfang:
--   1. Alle schreibenden Policies auf public.bots (INSERT, UPDATE, DELETE,
--      ALL) werden entfernt — auch solche, die nicht aus einer Repo-Migration
--      stammen. Permissive Policies werden ODER-verknüpft; eine einzige
--      verbliebene Mitglieder-Policy würde die neue Regel aushebeln.
--   2. Neue Policies INSERT/UPDATE/DELETE für `authenticated` mit
--      `is_tenant_owner_or_admin(tenant_id)`. UPDATE prüft USING und
--      WITH CHECK, damit eine Zeile nicht in einen fremden Mandanten
--      verschoben werden kann.
--   3. Die Lese-Policy bleibt bzw. wird angelegt, falls sie nur als
--      ALL-Policy existierte.
--   4. `bots_enforce_quota()` prüft für Clients dieselbe Rolle wie die
--      Policy, damit eine Mitgliedsrolle ohne Schreibrecht denselben
--      SQLSTATE 42501 bekommt wie ein Fremder (keine Plan-/Auslastungscodes).
--
-- Nicht im Umfang: Default von `enabled`, Aktivierungs-Freigabe,
-- agent-runtime. Bestand und Service-Role-Pfade (onboarding-orchestrator,
-- provision-voice-agent, öffentliche Bot-Functions) sind unverändert;
-- service_role umgeht RLS. Keine Daten werden geändert.

-- ─── 1. Schreibende Policies entfernen ─────────────────────────────────────
DO $$
DECLARE p record;
BEGIN
    FOR p IN
        SELECT policyname
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename  = 'bots'
           AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    LOOP
        EXECUTE format('DROP POLICY %I ON public.bots', p.policyname);
    END LOOP;
END $$;

-- ─── 2. Owner/Admin-Policies ───────────────────────────────────────────────
CREATE POLICY "bots admin-insert" ON public.bots
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

CREATE POLICY "bots admin-update" ON public.bots
    FOR UPDATE TO authenticated
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

CREATE POLICY "bots admin-delete" ON public.bots
    FOR DELETE TO authenticated
    USING (public.is_tenant_owner_or_admin(tenant_id));

-- ─── 3. Lesen für Mitglieder sicherstellen ─────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'bots' AND cmd = 'SELECT'
    ) THEN
        CREATE POLICY "bots tenant-read" ON public.bots
            FOR SELECT USING (public.is_tenant_member(tenant_id));
    END IF;
END $$;

ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;

-- ─── 4. Quota-Trigger: gleiche Rolle wie die Policy ────────────────────────
-- Rumpf unverändert aus 20260920130000_bots_quota_enforcement.sql bis auf
-- is_tenant_member → is_tenant_owner_or_admin.
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
  -- Autorisierung VOR Lock und Kontingent (RLS WITH CHECK greift erst nach
  -- BEFORE-Triggern). Gleiche Meldung, gleicher SQLSTATE wie die Policy.
  IF auth.role() IN ('anon', 'authenticated')
     AND NOT public.is_tenant_owner_or_admin(NEW.tenant_id) THEN
    RAISE EXCEPTION 'new row violates row-level security policy for table "bots"'
      USING ERRCODE = '42501';
  END IF;

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
  'Owner/Admin-Rolle bekommt vorher 42501 wie von der RLS-Policy.';

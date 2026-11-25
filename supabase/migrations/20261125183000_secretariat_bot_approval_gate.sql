-- KI-Sekretariat: serverseitige Freigabe und Aktivierungspruefung.
--
-- Rein additiv: neue Tabelle, neue Funktionen, ein neuer Trigger. Kein DROP von
-- Daten, keine Datenaenderung, bestehende Policies und Trigger auf public.bots
-- bleiben unveraendert. Der Trigger wirkt nur auf Bots mit `config ? 'secretariat'`
-- (Bestand 25.11.2026 in Produktion: 0 solche Bots; alle anderen Bots unberuehrt).
--
-- Zusagen (geprueft in test/runtime/db/secretariat-approval-gate.db.test.ts):
--   1. Ein Sekretariats-Bot ist nur aktiv, wenn eine gueltige Freigabe besteht.
--      Das gilt fuer jeden Schreibweg (PostgREST, Bot-Editor, service_role, RPC),
--      weil ein BEFORE-Trigger es durchsetzt, nicht die Oberflaeche.
--   2. Freigeben duerfen nur Owner/Admin des Mandanten (Rolle aus memberships,
--      nie aus dem Request). Der Pruefgegenstand und sein Hash entstehen hier
--      serverseitig, nicht im Browser.
--   3. Jede spaetere Aenderung an Persona, Begruessung, Kanal, Faehigkeiten oder
--      Konfiguration macht die Freigabe ungueltig (invalidated_at), auch wenn der
--      Inhalt spaeter auf den alten Stand zurueckgesetzt wird.
--   4. Aktivieren (enabled false -> true) duerfen nur Owner/Admin oder serverseitige
--      Pfade ohne Nutzerkontext; aktiv mit ungueltiger Freigabe ist unmoeglich.
--   5. Freigaben sind nur ueber die SECURITY-DEFINER-Funktionen schreibbar.
--      Mitglieder des Mandanten lesen sie (Pruefpfad), sonst niemand.

-- ─── 1. Freigaben (Pruefpfad) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bot_approvals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bot_id             UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  subject_sha256     TEXT NOT NULL CHECK (subject_sha256 ~ '^[0-9a-f]{64}$'),
  approved_by        UUID NOT NULL,
  approved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at     TIMESTAMPTZ,
  invalidated_reason TEXT CHECK (invalidated_reason IN ('content_changed', 'superseded')),
  CONSTRAINT bot_approvals_invalidation_pair
    CHECK ((invalidated_at IS NULL) = (invalidated_reason IS NULL))
);

-- Hoechstens eine gueltige Freigabe je Bot.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bot_approvals_active
  ON public.bot_approvals(bot_id) WHERE invalidated_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bot_approvals_tenant
  ON public.bot_approvals(tenant_id, approved_at DESC);

ALTER TABLE public.bot_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_approvals tenant-read" ON public.bot_approvals;
CREATE POLICY "bot_approvals tenant-read" ON public.bot_approvals
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- Schreiben nur ueber die Funktionen unten (Eigentuemer der Funktionen).
REVOKE ALL ON public.bot_approvals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.bot_approvals TO authenticated;

COMMENT ON TABLE public.bot_approvals IS
  'Freigaben von Sekretariats-Bots (Pruefpfad). Schreiben nur ueber approve_secretariat_bot() und den Trigger bots_secretariat_approval_guard.';

-- ─── 2. Pruefgegenstand und Hash ────────────────────────────────────────────
-- Alles, was das Verhalten des Bots gegenueber Anfragenden bestimmt. Nicht
-- enthalten: name, description (nur Anzeige), enabled (ist die Aktivierung
-- selbst), Zeitstempel, und die veraltete Browser-Freigabe
-- config.secretariat.approval (kein Nachweis, wird ignoriert).
CREATE OR REPLACE FUNCTION public.bot_approval_subject(p_bot public.bots)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'v',            1,
    'tenant_id',    p_bot.tenant_id,
    'channel',      p_bot.channel,
    'persona',      p_bot.persona,
    'greeting',     p_bot.greeting,
    'capabilities', p_bot.capabilities,
    'config',       p_bot.config #- '{secretariat,approval}'
  );
$$;

-- jsonb hat eine kanonische Textform (sortierte Schluessel, keine Dubletten),
-- gleicher Inhalt ergibt also denselben Hash.
CREATE OR REPLACE FUNCTION public.bot_approval_subject_sha256(p_bot public.bots)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT encode(sha256(convert_to(public.bot_approval_subject(p_bot)::text, 'UTF8')), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.bot_has_valid_approval(p_bot public.bots)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.bot_approvals a
     WHERE a.bot_id = p_bot.id
       AND a.tenant_id = p_bot.tenant_id
       AND a.invalidated_at IS NULL
       AND a.subject_sha256 = public.bot_approval_subject_sha256(p_bot)
  );
$$;

REVOKE ALL ON FUNCTION public.bot_approval_subject(public.bots) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_approval_subject_sha256(public.bots) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_has_valid_approval(public.bots) FROM PUBLIC, anon, authenticated, service_role;

-- ─── 3. Trigger: Aktivierung nur mit gueltiger Freigabe ─────────────────────
CREATE OR REPLACE FUNCTION public.bots_secretariat_approval_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_secretariat BOOLEAN := NEW.config ? 'secretariat';
  v_activating     BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Die Kennzeichnung laesst sich nicht entfernen: Sonst wuerde aus einem
    -- nicht freigegebenen Sekretariats-Bot ein ungepruefter allgemeiner Bot.
    IF (OLD.config ? 'secretariat') AND NOT v_is_secretariat THEN
      RAISE EXCEPTION 'secretariat marker cannot be removed from bot %', OLD.id
        USING ERRCODE = '42501';
    END IF;
    IF NOT v_is_secretariat THEN
      RETURN NEW;
    END IF;
    -- Inhalt geaendert: bisherige Freigabe gilt nicht mehr (auch nicht nach Ruecksetzen).
    IF public.bot_approval_subject(OLD) IS DISTINCT FROM public.bot_approval_subject(NEW) THEN
      UPDATE public.bot_approvals
         SET invalidated_at = now(), invalidated_reason = 'content_changed'
       WHERE bot_id = OLD.id AND invalidated_at IS NULL;
    END IF;
    v_activating := NEW.enabled AND NOT OLD.enabled;
  ELSE
    IF NOT v_is_secretariat THEN
      RETURN NEW;
    END IF;
    v_activating := NEW.enabled;
  END IF;

  IF NEW.enabled AND NOT public.bot_has_valid_approval(NEW) THEN
    RAISE EXCEPTION 'secretariat bot % requires a valid server-side approval to be enabled', NEW.id
      USING ERRCODE = '42501';
  END IF;

  -- Einschalten ist eine Entscheidung von Owner/Admin. Ohne Nutzerkontext
  -- (service_role, Migration) gilt allein die Freigabe oben.
  IF v_activating AND auth.uid() IS NOT NULL
     AND NOT public.is_tenant_owner_or_admin(NEW.tenant_id) THEN
    RAISE EXCEPTION 'only tenant owner or admin may enable secretariat bot %', NEW.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bots_secretariat_approval_guard() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS bots_secretariat_approval_guard ON public.bots;
CREATE TRIGGER bots_secretariat_approval_guard
  BEFORE INSERT OR UPDATE ON public.bots
  FOR EACH ROW EXECUTE FUNCTION public.bots_secretariat_approval_guard();

-- ─── 4. RPC: Freigabe durch Owner/Admin ─────────────────────────────────────
-- p_expected_updated_at: Stand, den der Inhaber geprueft hat. Hat sich der Bot
-- seitdem geaendert, wird nichts freigegeben (kein Freigeben ungesehener Inhalte).
CREATE OR REPLACE FUNCTION public.approve_secretariat_bot(
  p_bot_id              UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_activate            BOOLEAN DEFAULT false
)
RETURNS TABLE (approval_id UUID, subject_sha256 TEXT, approved_at TIMESTAMPTZ, enabled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_bot    public.bots;
  v_fields JSONB;
  v_hash   TEXT;
  v_id     UUID;
  v_at     TIMESTAMPTZ := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_bot FROM public.bots b WHERE b.id = p_bot_id FOR UPDATE;
  -- Gleiche Meldung fuer „fehlt“ und „fremder Mandant / falsche Rolle“.
  IF NOT FOUND OR NOT public.is_tenant_owner_or_admin(v_bot.tenant_id) THEN
    RAISE EXCEPTION 'bot not found or not permitted' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_bot.config ? 'secretariat') THEN
    RAISE EXCEPTION 'not a secretariat bot' USING ERRCODE = '22023';
  END IF;
  IF p_expected_updated_at IS NULL OR v_bot.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'bot changed since review, please review again' USING ERRCODE = '40001';
  END IF;

  -- Pflichtangaben serverseitig (Spiegel von approvalBlockers im Frontend).
  v_fields := v_bot.config -> 'secretariat' -> 'fields';
  IF coalesce(v_fields -> 'businessName' ->> 'status', '') <> 'known'
     OR (coalesce(v_fields -> 'phone' ->> 'status', '') <> 'known'
         AND coalesce(v_fields -> 'email' ->> 'status', '') <> 'known') THEN
    RAISE EXCEPTION 'approval blocked: business name and phone or email required' USING ERRCODE = '22023';
  END IF;

  v_hash := public.bot_approval_subject_sha256(v_bot);

  UPDATE public.bot_approvals a
     SET invalidated_at = v_at, invalidated_reason = 'superseded'
   WHERE a.bot_id = v_bot.id AND a.invalidated_at IS NULL;

  INSERT INTO public.bot_approvals (tenant_id, bot_id, subject_sha256, approved_by, approved_at)
  VALUES (v_bot.tenant_id, v_bot.id, v_hash, v_uid, v_at)
  RETURNING id INTO v_id;

  IF p_activate AND NOT v_bot.enabled THEN
    -- Laeuft durch den Trigger oben (Freigabe gueltig, Rolle Owner/Admin).
    UPDATE public.bots b SET enabled = true WHERE b.id = v_bot.id;
  END IF;

  RETURN QUERY
    SELECT v_id, v_hash, v_at, b.enabled FROM public.bots b WHERE b.id = v_bot.id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_secretariat_bot(UUID, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_secretariat_bot(UUID, TIMESTAMPTZ, BOOLEAN) TO authenticated;

-- ─── 5. Status fuer die Oberflaeche (Mitglieder des Mandanten) ──────────────
CREATE OR REPLACE FUNCTION public.secretariat_bot_approval_status(p_bot_id UUID)
RETURNS TABLE (has_active_approval BOOLEAN, valid BOOLEAN, ever_approved BOOLEAN, approved_at TIMESTAMPTZ, approved_by UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bot public.bots;
BEGIN
  SELECT * INTO v_bot FROM public.bots b WHERE b.id = p_bot_id;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_tenant_member(v_bot.tenant_id) THEN
    RAISE EXCEPTION 'bot not found or not permitted' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT a.id IS NOT NULL,
           coalesce(a.subject_sha256 = public.bot_approval_subject_sha256(v_bot), false),
           EXISTS (SELECT 1 FROM public.bot_approvals e WHERE e.bot_id = v_bot.id),
           a.approved_at,
           a.approved_by
      FROM (SELECT 1) AS one
      LEFT JOIN LATERAL (
        SELECT x.id, x.subject_sha256, x.approved_at, x.approved_by
          FROM public.bot_approvals x
         WHERE x.bot_id = v_bot.id AND x.invalidated_at IS NULL
         LIMIT 1
      ) AS a ON true;
END;
$$;

REVOKE ALL ON FUNCTION public.secretariat_bot_approval_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secretariat_bot_approval_status(UUID) TO authenticated;

-- ─── 6. Laufzeitpruefung fuer die Bot-Edge-Functions (resolveBot) ───────────
-- true fuer jeden Nicht-Sekretariats-Bot, fuer Sekretariats-Bots nur mit
-- gueltiger Freigabe. NULL, wenn der Bot fehlt (Aufrufer behandelt das als nein).
CREATE OR REPLACE FUNCTION public.bot_runtime_approval_ok(p_bot_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
           WHEN NOT (b.config ? 'secretariat') THEN true
           ELSE public.bot_has_valid_approval(b)
         END
    FROM public.bots b
   WHERE b.id = p_bot_id;
$$;

REVOKE ALL ON FUNCTION public.bot_runtime_approval_ok(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_runtime_approval_ok(UUID) TO service_role;

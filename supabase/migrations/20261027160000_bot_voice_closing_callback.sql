-- Telefon: Gesprächsabschluss vor dem harten Limit + Rückrufstatus
-- (Nacharbeit PR #2044, Merge-Blocker „kein stummes Auflegen“).
--
-- Additiv. Keine bestehende Funktion, Tabelle oder Policy wird verändert.
--
-- 1. Rückrufstatus am bestehenden Gespräch (Schema A, bot_conversations).
--    Kein neuer Lead-Speicher. PR C übernimmt diese Einträge später in
--    inquiries und /app/anfragen.
--    Idempotent: bot_voice_mark_callback setzt den Status höchstens einmal je
--    Gespräch (Zeilensperre). Erst nach erfolgreicher Speicherung darf die
--    Ansage den Rückrufwunsch als „erfasst“ bestätigen.
--    Keine neuen personenbezogenen Daten: Die Rufnummer steht bereits in
--    contact_label. Unterdrückte Nummer → kein Rückrufstatus.
--
-- 2. Abschlussphase: bot_voice_closing_calls liefert offene Twilio-Anrufe,
--    deren Restzeit im Fenster [Ende − p_closing_lead, Ende − p_hard_lead)
--    liegt. bot_voice_claim_closing beansprucht die Ansage genau einmal je
--    Anruf (parallel laufende Worker sagen nie doppelt an).
--    Der harte Abbruch (bot_voice_overdue_calls, Status=completed) bleibt
--    unverändert und unabhängig: Die Ansage verlängert das Limit nie.
--
-- Budget: Nichts hier rechnet ab, reserviert oder gibt frei.

BEGIN;

-- ============================================================
-- 1. Rückrufstatus an bot_conversations
-- ============================================================
ALTER TABLE public.bot_conversations
  ADD COLUMN IF NOT EXISTS callback_status       text,
  ADD COLUMN IF NOT EXISTS callback_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS callback_reason       text;

DO $$
BEGIN
  ALTER TABLE public.bot_conversations
    ADD CONSTRAINT bot_conversations_callback_status_chk
    CHECK (callback_status IS NULL OR callback_status IN ('erfasst'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.bot_conversations
    ADD CONSTRAINT bot_conversations_callback_reason_chk
    CHECK (callback_reason IS NULL OR callback_reason IN ('zeitlimit', 'budget'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.bot_conversations
    ADD CONSTRAINT bot_conversations_callback_consistent_chk
    CHECK ((callback_status IS NULL) = (callback_requested_at IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_conversations_callback_open
  ON public.bot_conversations (tenant_id, callback_requested_at DESC)
  WHERE callback_status IS NOT NULL;

COMMENT ON COLUMN public.bot_conversations.callback_status IS
  'Rückrufwunsch aus einem durch Zeit- oder Budgetlimit beendeten Anruf. Gesetzt von bot_voice_mark_callback (service_role). Owner/Admin des eigenen Mandanten können die Zeile laut bestehender Policy bot_conversations_upd ändern (unverändert). Sichtbarkeit in /app/anfragen: PR C.';

-- Ergebnis: captured | already_captured | no_number | no_conversation
CREATE OR REPLACE FUNCTION public.bot_voice_mark_callback(
  p_tenant_id uuid,
  p_call_ref  text,
  p_reason    text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv public.bot_conversations%ROWTYPE;
  v_number text;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_tenant_id IS NULL OR p_call_ref IS NULL OR length(p_call_ref) NOT BETWEEN 1 AND 200
     OR p_reason IS NULL OR p_reason NOT IN ('zeitlimit', 'budget') THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = '22023';
  END IF;

  -- Zeilensperre: parallele Aufrufe (Webhook + Enforcer, Wiederholungen)
  -- warten aufeinander; genau einer setzt den Status.
  SELECT * INTO v_conv
    FROM public.bot_conversations c
   WHERE c.tenant_id = p_tenant_id AND c.channel = 'voice' AND c.external_ref = p_call_ref
   ORDER BY c.created_at
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'no_conversation';
  END IF;
  IF v_conv.callback_status IS NOT NULL THEN
    RETURN 'already_captured';
  END IF;

  -- Nur zurückrufbare Nummern (E.164). Unterdrückte oder unbekannte Nummern
  -- → kein Rückrufstatus. Twilio wandelt Carrier-Statuswörter in Ziffern
  -- (support.twilio.com, Artikel 223179988): ANONYMOUS 266696687,
  -- RESTRICTED 7378742833, BLOCKED 2562533, UNKNOWN 8656696,
  -- UNAVAILABLE 86282452253, EMPTY/keine Kennung 464.
  v_number := btrim(coalesce(v_conv.contact_label, ''));
  IF v_number !~ '^\+[1-9][0-9]{6,14}$'
     OR ltrim(v_number, '+') IN ('266696687', '7378742833', '2562533', '8656696', '86282452253', '464') THEN
    RETURN 'no_number';
  END IF;

  UPDATE public.bot_conversations
     SET callback_status = 'erfasst',
         callback_requested_at = now(),
         callback_reason = p_reason
   WHERE id = v_conv.id;
  RETURN 'captured';
END;
$$;

-- ============================================================
-- 2. Abschlussphase
-- ============================================================
CREATE OR REPLACE FUNCTION public.bot_voice_closing_calls(
  p_closing_lead_seconds integer,
  p_hard_lead_seconds    integer,
  p_limit                integer
) RETURNS TABLE (
  reservation_id uuid,
  tenant_id      uuid,
  call_ref       text,
  account_sid    text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.bot_usage_assert_internal();
  IF p_closing_lead_seconds IS NULL OR p_hard_lead_seconds IS NULL OR p_hard_lead_seconds < 0
     OR p_closing_lead_seconds <= p_hard_lead_seconds OR p_limit IS NULL OR p_limit < 1 THEN
    RAISE EXCEPTION 'invalid arguments' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT r.id, r.tenant_id, r.external_ref, r.metadata->>'account_sid'
      FROM public.bot_usage_reservations r
     WHERE r.resource = 'voice_seconds' AND r.provider = 'twilio' AND r.status = 'open'
       AND r.created_at + make_interval(secs => greatest(r.reserved_amount - p_closing_lead_seconds, 0)) <= now()
       -- Ab dem harten Zeitpunkt nur noch Status=completed, keine Ansage mehr.
       AND now() < r.created_at + make_interval(secs => greatest(r.reserved_amount - p_hard_lead_seconds, 0))
       AND coalesce((r.metadata->>'closing_claimed')::boolean, false) = false
       AND coalesce((r.metadata->>'hangup_done')::boolean, false) = false
     ORDER BY r.created_at
     LIMIT p_limit;
END;
$$;

-- Beansprucht die Ansage genau einmal je Anruf. true = dieser Aufrufer sagt an.
-- Nur metadata; Status, Betrag und Ledger bleiben unberührt.
CREATE OR REPLACE FUNCTION public.bot_voice_claim_closing(
  p_reservation_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  UPDATE public.bot_usage_reservations
     SET metadata = metadata || jsonb_build_object('closing_claimed', true, 'closing_claimed_at', now())
   WHERE id = p_reservation_id AND resource = 'voice_seconds' AND status = 'open'
     AND coalesce((metadata->>'closing_claimed')::boolean, false) = false;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.bot_voice_record_closing(
  p_reservation_id uuid,
  p_result         text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  PERFORM public.bot_usage_assert_internal();
  UPDATE public.bot_usage_reservations
     SET metadata = metadata || jsonb_build_object(
           'closing_last_result', left(coalesce(p_result, ''), 120),
           'closing_last_at', now())
   WHERE id = p_reservation_id AND resource = 'voice_seconds';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$;

-- ============================================================
-- 3. Rechte: nur service_role
-- ============================================================
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.bot_voice_mark_callback(uuid,text,text)',
    'public.bot_voice_closing_calls(integer,integer,integer)',
    'public.bot_voice_claim_closing(uuid)',
    'public.bot_voice_record_closing(uuid,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', f);
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
    EXCEPTION WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

COMMIT;

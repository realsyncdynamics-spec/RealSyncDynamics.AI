-- AI Receptionist: Übergabe an Menschen (K4, PR C)
--
-- Eine Bot-Konversation kann eine Übergabe an einen Menschen anfordern:
--   * automatisch durch die Bot-Edge-Functions (Service-Role), wenn der
--     Kunde ausdrücklich einen Menschen/Rückruf verlangt oder der Assistent
--     unsicher ist (Marker in der Antwort),
--   * manuell durch ein Mandantenmitglied im Bot-Posteingang.
-- Mitarbeitende übernehmen die Übergabe und schließen sie ab.
--
-- Rein additiv: neue Spalten mit Default, kein Umbau bestehender Daten.
-- Schreibzugriff aus dem Frontend ausschließlich über die RPC
-- `bot_conversation_handoff` (SECURITY DEFINER). Mandant und handelnde
-- Person kommen aus der Zeile bzw. auth.uid(), nie aus dem Request.

ALTER TABLE public.bot_conversations
    ADD COLUMN IF NOT EXISTS handoff_status TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS handoff_reason TEXT,
    ADD COLUMN IF NOT EXISTS handoff_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS handoff_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS handoff_accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS handoff_resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS handoff_resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bot_conversations_handoff_status_check'
          AND conrelid = 'public.bot_conversations'::regclass
    ) THEN
        ALTER TABLE public.bot_conversations
            ADD CONSTRAINT bot_conversations_handoff_status_check
            CHECK (handoff_status IN ('none', 'requested', 'accepted', 'resolved'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'bot_conversations_handoff_reason_check'
          AND conrelid = 'public.bot_conversations'::regclass
    ) THEN
        ALTER TABLE public.bot_conversations
            ADD CONSTRAINT bot_conversations_handoff_reason_check
            CHECK (handoff_reason IS NULL
                   OR handoff_reason IN ('customer_request', 'assistant_uncertain', 'manual'));
    END IF;
END $$;

-- Offene Übergaben je Mandant schnell finden (Posteingang, Zähler).
CREATE INDEX IF NOT EXISTS idx_bot_conversations_handoff_open
    ON public.bot_conversations(tenant_id, handoff_requested_at DESC)
    WHERE handoff_status IN ('requested', 'accepted');

COMMENT ON COLUMN public.bot_conversations.handoff_status IS
    'Übergabe an Menschen: none | requested | accepted | resolved. Schreiben nur Service-Role oder RPC bot_conversation_handoff.';

-- ─── RPC: Übergabe anfordern / übernehmen / abschließen ─────────────────────
CREATE OR REPLACE FUNCTION public.bot_conversation_handoff(
    p_conversation_id UUID,
    p_action TEXT
)
RETURNS public.bot_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_row public.bot_conversations;
BEGIN
    -- Fail-closed: ohne angemeldete Person keine Änderung.
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_row
    FROM public.bot_conversations
    WHERE id = p_conversation_id
    FOR UPDATE;

    -- Fremde und unbekannte Konversationen sind nicht unterscheidbar.
    IF NOT FOUND OR NOT public.is_tenant_member(v_row.tenant_id) THEN
        RAISE EXCEPTION 'conversation not found' USING ERRCODE = 'P0002';
    END IF;

    IF p_action = 'request' THEN
        IF v_row.handoff_status IN ('requested', 'accepted') THEN
            RETURN v_row; -- idempotent
        END IF;
        UPDATE public.bot_conversations SET
            handoff_status       = 'requested',
            handoff_reason       = 'manual',
            handoff_requested_at = now(),
            handoff_accepted_at  = NULL,
            handoff_accepted_by  = NULL,
            handoff_resolved_at  = NULL,
            handoff_resolved_by  = NULL,
            updated_at           = now()
        WHERE id = v_row.id
        RETURNING * INTO v_row;

    ELSIF p_action = 'accept' THEN
        IF v_row.handoff_status <> 'requested' THEN
            RAISE EXCEPTION 'invalid handoff transition % -> accepted', v_row.handoff_status
                USING ERRCODE = '22023';
        END IF;
        UPDATE public.bot_conversations SET
            handoff_status      = 'accepted',
            handoff_accepted_at = now(),
            handoff_accepted_by = v_uid,
            updated_at          = now()
        WHERE id = v_row.id
        RETURNING * INTO v_row;

    ELSIF p_action = 'resolve' THEN
        IF v_row.handoff_status NOT IN ('requested', 'accepted') THEN
            RAISE EXCEPTION 'invalid handoff transition % -> resolved', v_row.handoff_status
                USING ERRCODE = '22023';
        END IF;
        UPDATE public.bot_conversations SET
            handoff_status      = 'resolved',
            handoff_resolved_at = now(),
            handoff_resolved_by = v_uid,
            updated_at          = now()
        WHERE id = v_row.id
        RETURNING * INTO v_row;

    ELSE
        RAISE EXCEPTION 'unknown handoff action %', p_action USING ERRCODE = '22023';
    END IF;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_conversation_handoff(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bot_conversation_handoff(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.bot_conversation_handoff(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.bot_conversation_handoff(UUID, TEXT) IS
    'Übergabe an Menschen im Bot-Posteingang: request | accept | resolve. Mandant aus der Zeile, Person aus auth.uid().';

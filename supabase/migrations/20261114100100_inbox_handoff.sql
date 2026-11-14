-- PR C, Schritt 2: Posteingang mit Übergabe an Menschen (E8 = B, E10).
-- ADDITIV / NON-BREAKING. Keine Daten-Updates an Bestandszeilen, keine
-- Erweiterung bestehender Zugriffsrechte.
--
-- Inhalt
--   * bot_conversations.channel  + 'form'                  (alte Werte bleiben)
--   * bot_conversations.status   + 'in_bearbeitung', 'erledigt'
--     („Neu“ im UI = bestehender Status 'open', E10 — kein Wert 'neu')
--   * neue, nullable Spalten assigned_to, handed_off_at, resolved_at
--   * Tabelle bot_conversation_intake (1:1): Anliegen, Kontakt, Terminwunsch.
--     Terminwunsch ist ein WUNSCH, nie ein bestätigter Termin.
--   * Tabelle bot_conversation_events: append-only Änderungsprotokoll.
--     governance_events wurde geprüft und ist ungeeignet (Compliance-
--     Ereignisstrom: event_source-Enum ohne Inbox-Quelle, kein Bezug auf
--     Konversation, keine Akteurs-ID).
--   * RPCs inbox_take_over / inbox_resolve mit Compare-and-Set:
--       open           → in_bearbeitung   (assigned_to = Aufrufer)
--       in_bearbeitung → erledigt
--     Konkurrierende Übernahme: genau einer gewinnt, der zweite erhält
--     'conflict'. Fremder Mandant / fehlende Owner/Admin-Berechtigung /
--     unbekannt → 'not_found' (keine Leckage).
--
-- Zugriffsrechte
--   * Die bestehenden Policies auf bot_conversations bleiben unverändert.
--   * Ausschließlich Owner/Admin (is_tenant_owner_or_admin) dürfen übernehmen
--     und erledigen — NUR über die RPCs. Editor/DPO/Viewer-Auditor bleiben read-only. Ein Guard-Trigger sperrt direkte Client-Updates der neuen
--     Inbox-Felder (auch für Owner/Admin), damit Statusmaschine, Zuständigkeit
--     und Prüfpfad nicht umgangen werden. open ↔ closed bleibt wie bisher.
--   * Intake und Events: Lesen für Mitglieder, Schreiben nur Server (RPC /
--     service_role).

-- 1. Erweiterung der Checks (Obermenge der bisherigen Werte) -----------------

-- Die bisherigen CHECKs stammen aus Inline-Definitionen (20260628121531) und
-- tragen Postgres-Autonamen. Damit die Migration nicht von einem Namen abhängt
-- (Security-Review 08.11.2026: sonst bliebe in Prod der alte CHECK bestehen und
-- channel = 'form' scheiterte mit 23514), werden alle CHECK-Constraints der
-- Tabelle entfernt, die ausschliesslich die Spalte channel bzw. status prüfen.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.bot_conversations'::regclass
          AND c.contype = 'c'
          AND (
               (pg_get_constraintdef(c.oid) ~* '\mchannel\M' AND pg_get_constraintdef(c.oid) !~* '\mstatus\M')
            OR (pg_get_constraintdef(c.oid) ~* '\mstatus\M'  AND pg_get_constraintdef(c.oid) !~* '\mchannel\M'
                AND pg_get_constraintdef(c.oid) !~* 'callback')
          )
    LOOP
        EXECUTE format('ALTER TABLE public.bot_conversations DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.bot_conversations ADD CONSTRAINT bot_conversations_channel_check
    CHECK (channel IN ('chat', 'voice', 'telegram', 'whatsapp', 'form'));

ALTER TABLE public.bot_conversations ADD CONSTRAINT bot_conversations_status_check
    CHECK (status IN ('open', 'closed', 'in_bearbeitung', 'erledigt'));

-- 2. Neue Spalten -------------------------------------------------------------

ALTER TABLE public.bot_conversations
    ADD COLUMN IF NOT EXISTS assigned_to   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS handed_off_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_at   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bot_conversations_inbox
    ON public.bot_conversations(tenant_id, status, last_message_at DESC NULLS LAST);

-- 3. Guard: neue Inbox-Felder nur über RPC / Server ---------------------------
-- current_user ist bei direktem Client-Zugriff 'authenticated'/'anon', innerhalb
-- der SECURITY-DEFINER-RPCs der Funktionsbesitzer, bei service_role
-- 'service_role'. Damit greift die Sperre nur für den direkten Client-Weg.
CREATE OR REPLACE FUNCTION public.bot_conversations_inbox_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.status IN ('in_bearbeitung', 'erledigt')
           OR NEW.assigned_to IS NOT NULL
           OR NEW.handed_off_at IS NOT NULL
           OR NEW.resolved_at IS NOT NULL THEN
            RAISE EXCEPTION 'bot_conversations: inbox fields are set via inbox RPCs only'
                USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;

    IF (NEW.status IS DISTINCT FROM OLD.status
            AND (NEW.status IN ('in_bearbeitung', 'erledigt') OR OLD.status IN ('in_bearbeitung', 'erledigt')))
       OR NEW.assigned_to   IS DISTINCT FROM OLD.assigned_to
       OR NEW.handed_off_at IS DISTINCT FROM OLD.handed_off_at
       OR NEW.resolved_at   IS DISTINCT FROM OLD.resolved_at THEN
        RAISE EXCEPTION 'bot_conversations: inbox fields are set via inbox RPCs only'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_conversations_inbox_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bot_conversations_inbox_guard ON public.bot_conversations;
CREATE TRIGGER trg_bot_conversations_inbox_guard
    BEFORE INSERT OR UPDATE ON public.bot_conversations
    FOR EACH ROW EXECUTE FUNCTION public.bot_conversations_inbox_guard();

-- 4. Intake (1:1) -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bot_conversation_intake (
    conversation_id    UUID PRIMARY KEY REFERENCES public.bot_conversations(id) ON DELETE CASCADE,
    tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    anliegen           TEXT CHECK (anliegen IS NULL OR char_length(anliegen) <= 4000),
    kontakt_name       TEXT CHECK (kontakt_name IS NULL OR char_length(kontakt_name) <= 200),
    kontakt_telefon    TEXT CHECK (kontakt_telefon IS NULL OR char_length(kontakt_telefon) <= 50),
    kontakt_email      TEXT CHECK (kontakt_email IS NULL OR char_length(kontakt_email) <= 320),
    terminwunsch       TEXT CHECK (terminwunsch IS NULL OR char_length(terminwunsch) <= 500),
    terminwunsch_zeit  TIMESTAMPTZ,
    einwilligung_at    TIMESTAMPTZ,
    quelle             TEXT NOT NULL CHECK (quelle IN ('chat', 'voice', 'whatsapp', 'telegram', 'form')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_conversation_intake_tenant
    ON public.bot_conversation_intake(tenant_id, created_at DESC);

COMMENT ON COLUMN public.bot_conversation_intake.terminwunsch IS
    'Terminwunsch der anfragenden Person. Kein bestätigter Termin; Bestätigung nur nach erfolgreicher Buchung (eigener Pfad).';

-- tenant_id muss dem Mandanten der Konversation entsprechen.
CREATE OR REPLACE FUNCTION public.bot_conversation_intake_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_tenant UUID;
BEGIN
    SELECT tenant_id INTO v_tenant FROM public.bot_conversations WHERE id = NEW.conversation_id;
    IF v_tenant IS NULL OR v_tenant <> NEW.tenant_id THEN
        RAISE EXCEPTION 'bot_conversation_intake: tenant mismatch' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_conversation_intake_tenant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bot_conversation_intake_tenant ON public.bot_conversation_intake;
CREATE TRIGGER trg_bot_conversation_intake_tenant
    BEFORE INSERT OR UPDATE ON public.bot_conversation_intake
    FOR EACH ROW EXECUTE FUNCTION public.bot_conversation_intake_tenant();

ALTER TABLE public.bot_conversation_intake ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_conversation_intake tenant-read" ON public.bot_conversation_intake;
CREATE POLICY "bot_conversation_intake tenant-read"
    ON public.bot_conversation_intake FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

REVOKE ALL ON public.bot_conversation_intake FROM anon, authenticated;
GRANT SELECT ON public.bot_conversation_intake TO authenticated;
GRANT ALL ON public.bot_conversation_intake TO service_role;

-- 5. Änderungsprotokoll (append-only) -----------------------------------------

CREATE TABLE IF NOT EXISTS public.bot_conversation_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conversation_id  UUID NOT NULL REFERENCES public.bot_conversations(id) ON DELETE CASCADE,
    event            TEXT NOT NULL CHECK (event IN ('taken_over', 'resolved')),
    actor_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    from_status      TEXT NOT NULL,
    to_status        TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_conversation_events_conv
    ON public.bot_conversation_events(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bot_conversation_events_tenant
    ON public.bot_conversation_events(tenant_id, created_at DESC);

-- Append-only: kein UPDATE, für niemanden. Löschen nur über Kaskade bzw.
-- service_role (Aufbewahrung), nicht für Clients.
--
-- Einzige Ausnahme (Codex-Review 14.11.2026, P1): die FK-Anonymisierung
-- `actor_id ON DELETE SET NULL` beim Löschen eines Kontos (Art. 17 DSGVO,
-- `gdpr-delete`). Sie ändert ausschliesslich actor_id von einem Wert auf NULL;
-- jede andere Änderung bleibt verboten. Ohne diese Ausnahme scheiterte
-- `auth.admin.deleteUser`, sobald die Person je übernommen/erledigt hat.
CREATE OR REPLACE FUNCTION public.bot_conversation_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.actor_id IS NOT NULL
       AND NEW.actor_id IS NULL
       AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
        RETURN NEW;  -- FK-Anonymisierung
    END IF;
    RAISE EXCEPTION 'bot_conversation_events is append-only' USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.bot_conversation_events_append_only() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bot_conversation_events_append_only ON public.bot_conversation_events;
CREATE TRIGGER trg_bot_conversation_events_append_only
    BEFORE UPDATE ON public.bot_conversation_events
    FOR EACH ROW EXECUTE FUNCTION public.bot_conversation_events_append_only();

ALTER TABLE public.bot_conversation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_conversation_events tenant-read" ON public.bot_conversation_events;
CREATE POLICY "bot_conversation_events tenant-read"
    ON public.bot_conversation_events FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- Auch service_role ohne UPDATE/TRUNCATE (TRUNCATE umginge den Trigger).
REVOKE ALL ON public.bot_conversation_events FROM anon, authenticated, service_role;
GRANT SELECT ON public.bot_conversation_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.bot_conversation_events TO service_role;

-- 6. RPCs mit Compare-and-Set -------------------------------------------------
-- Rückgabe: 'ok' | 'conflict' (Status passt nicht mehr, z. B. schon übernommen)
--           | 'not_found' (unbekannt, fremd oder nicht Owner/Admin — nicht unterscheidbar)

CREATE OR REPLACE FUNCTION public.inbox_take_over(p_conversation_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid    UUID := auth.uid();
    v_tenant UUID;
BEGIN
    IF v_uid IS NULL THEN
        RETURN 'not_found';
    END IF;

    UPDATE public.bot_conversations c
       SET status = 'in_bearbeitung', assigned_to = v_uid, handed_off_at = now()
     WHERE c.id = p_conversation_id
       AND c.status = 'open'
       AND public.is_tenant_owner_or_admin(c.tenant_id)
    RETURNING c.tenant_id INTO v_tenant;

    IF v_tenant IS NOT NULL THEN
        INSERT INTO public.bot_conversation_events (tenant_id, conversation_id, event, actor_id, from_status, to_status)
        VALUES (v_tenant, p_conversation_id, 'taken_over', v_uid, 'open', 'in_bearbeitung');
        RETURN 'ok';
    END IF;

    SELECT c.tenant_id INTO v_tenant FROM public.bot_conversations c
     WHERE c.id = p_conversation_id AND public.is_tenant_owner_or_admin(c.tenant_id);
    RETURN CASE WHEN v_tenant IS NULL THEN 'not_found' ELSE 'conflict' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.inbox_resolve(p_conversation_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid    UUID := auth.uid();
    v_tenant UUID;
BEGIN
    IF v_uid IS NULL THEN
        RETURN 'not_found';
    END IF;

    UPDATE public.bot_conversations c
       SET status = 'erledigt', resolved_at = now()
     WHERE c.id = p_conversation_id
       AND c.status = 'in_bearbeitung'
       AND public.is_tenant_owner_or_admin(c.tenant_id)
    RETURNING c.tenant_id INTO v_tenant;

    IF v_tenant IS NOT NULL THEN
        INSERT INTO public.bot_conversation_events (tenant_id, conversation_id, event, actor_id, from_status, to_status)
        VALUES (v_tenant, p_conversation_id, 'resolved', v_uid, 'in_bearbeitung', 'erledigt');
        RETURN 'ok';
    END IF;

    SELECT c.tenant_id INTO v_tenant FROM public.bot_conversations c
     WHERE c.id = p_conversation_id AND public.is_tenant_owner_or_admin(c.tenant_id);
    RETURN CASE WHEN v_tenant IS NULL THEN 'not_found' ELSE 'conflict' END;
END;
$$;

REVOKE ALL ON FUNCTION public.inbox_take_over(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.inbox_resolve(UUID)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inbox_take_over(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inbox_resolve(UUID)   TO authenticated, service_role;

-- 7. Atomare Annahme einer Formularanfrage (Edge Function inbox-form-submit) ---
-- Codex-Review 14.11.2026 (P2): Zählen → Einfügen in getrennten Requests war
-- doppelt anfällig — (a) ein zweiter Request mit gleicher nonce sah die
-- Konversation, bevor Intake und Nachricht existierten, und bekam „duplicate“,
-- obwohl der erste Request danach kompensierend löschte; (b) parallele
-- Requests lasen denselben Zählerstand und überschritten das Kontingent.
--
-- Deshalb läuft alles in EINER Transaktion unter einem Advisory-Lock je
-- Binding: Auflösung (fail-closed), Duplikatprüfung, beide Kontingente, die
-- drei Inserts. Eine Konversation ist damit erst sichtbar, wenn sie
-- vollständig ist; „duplicate“ heisst immer „vollständig gespeichert“.
-- Nur service_role. Mandant/Bot stammen ausschliesslich aus dem Binding.

CREATE INDEX IF NOT EXISTS idx_bot_conversations_form_ip_hash
    ON public.bot_conversations (tenant_id, (metadata->>'ip_hash'), created_at DESC)
    WHERE channel = 'form';
CREATE INDEX IF NOT EXISTS idx_bot_conversations_form_binding
    ON public.bot_conversations (tenant_id, (metadata->>'binding_id'), created_at DESC)
    WHERE channel = 'form';

CREATE OR REPLACE FUNCTION public.inbox_form_submit_intake(
    p_site_ref        TEXT,
    p_nonce           TEXT,
    p_ip_hash         TEXT,
    p_anliegen        TEXT,
    p_kontakt_name    TEXT,
    p_kontakt_telefon TEXT,
    p_kontakt_email   TEXT,
    p_terminwunsch    TEXT,
    p_contact_label   TEXT,
    p_ip_limit        INTEGER DEFAULT 10,
    p_site_limit      INTEGER DEFAULT 60
)
RETURNS TABLE (status TEXT, conversation_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_binding   RECORD;
    v_ref       TEXT;
    v_existing  UUID;
    v_since     TIMESTAMPTZ := now() - interval '1 hour';
    v_ip_count  INTEGER;
    v_site_count INTEGER;
    v_conv      UUID;
    v_now       TIMESTAMPTZ := now();
BEGIN
    -- Eingabeformate wie in der Function; alles andere ist not_found/ungültig,
    -- ohne Schreibzugriff.
    IF p_site_ref !~ '^[A-Za-z0-9_-]{24}$' OR p_nonce !~ '^[A-Za-z0-9_-]{16,64}$'
       OR p_ip_hash IS NULL OR length(p_ip_hash) <> 64
       OR p_anliegen IS NULL OR length(p_anliegen) < 3 THEN
        RETURN QUERY SELECT 'not_found'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    SELECT * INTO v_binding FROM public.resolve_site_inbox(p_site_ref);
    IF v_binding.tenant_id IS NULL THEN
        RETURN QUERY SELECT 'not_found'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    -- Serialisierung je Binding: Zählen und Einfügen sind damit atomar.
    PERFORM pg_advisory_xact_lock(hashtext('inbox_form:' || v_binding.binding_id::text));

    v_ref := 'form:' || p_site_ref || ':' || p_nonce;
    SELECT c.id INTO v_existing
      FROM public.bot_conversations c
     WHERE c.bot_id = v_binding.bot_id AND c.external_ref = v_ref;
    IF v_existing IS NOT NULL THEN
        RETURN QUERY SELECT 'duplicate'::TEXT, v_existing;
        RETURN;
    END IF;

    SELECT count(*) INTO v_ip_count
      FROM public.bot_conversations c
     WHERE c.tenant_id = v_binding.tenant_id AND c.channel = 'form'
       AND c.metadata->>'ip_hash' = p_ip_hash AND c.created_at >= v_since;
    SELECT count(*) INTO v_site_count
      FROM public.bot_conversations c
     WHERE c.tenant_id = v_binding.tenant_id AND c.channel = 'form'
       AND c.metadata->>'binding_id' = v_binding.binding_id::text AND c.created_at >= v_since;
    IF v_ip_count >= p_ip_limit OR v_site_count >= p_site_limit THEN
        RETURN QUERY SELECT 'rate_limited'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    INSERT INTO public.bot_conversations
        (tenant_id, bot_id, channel, status, external_ref, contact_label, metadata, last_message_at)
    VALUES (
        v_binding.tenant_id, v_binding.bot_id, 'form', 'open', v_ref,
        coalesce(nullif(p_contact_label, ''), 'Formular'),
        jsonb_build_object(
            'source', 'site_form',
            'site_ref', p_site_ref,
            'binding_id', v_binding.binding_id,
            'website_project_id', v_binding.website_project_id,
            'ip_hash', p_ip_hash
        ),
        v_now
    )
    RETURNING id INTO v_conv;

    INSERT INTO public.bot_conversation_intake
        (conversation_id, tenant_id, anliegen, kontakt_name, kontakt_telefon, kontakt_email, terminwunsch, einwilligung_at, quelle)
    VALUES (v_conv, v_binding.tenant_id, p_anliegen, p_kontakt_name, p_kontakt_telefon, p_kontakt_email, p_terminwunsch, v_now, 'form');

    INSERT INTO public.bot_messages (tenant_id, conversation_id, bot_id, role, content, metadata)
    VALUES (v_binding.tenant_id, v_conv, v_binding.bot_id, 'user', p_anliegen, '{"source":"site_form"}'::jsonb);

    RETURN QUERY SELECT 'received'::TEXT, v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.inbox_form_submit_intake(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inbox_form_submit_intake(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER)
    TO service_role;

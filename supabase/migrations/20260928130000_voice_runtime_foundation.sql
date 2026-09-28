-- Voice Runtime — Fundament (PR 1 von 6: Provider-Interface + Datenmodell).
-- ADDITIV / NON-BREAKING. Kein Deploy, kein Backfill, keine Aenderung an
-- bestehenden Tabellen.
--
-- Leitplanken:
--   * Keine zweite Bot-Welt. Ein Voice-Agent IST ein Eintrag in `public.bots`
--     (Feature A, auf den der gesamte Anwendungscode zielt). Diese Migration
--     ergaenzt nur die Voice-Runtime-Konfiguration daneben.
--     `voice_channels` (Feature B, FK auf bot_agents) wird bewusst NICHT
--     verwendet — siehe docs/runtime/PRODUCTION_BLOCKERS.md, Blocker 2.
--   * Tenant kommt nie aus URL/Body. Eingehende Anrufe werden serverseitig
--     ueber `voice_number_bindings` (E.164 → bot_id → tenant_id) aufgeloest.
--     Bindungen schreibt nur die Service-Role (Nummern-Provisionierung),
--     sonst koennte ein Tenant fremde Rufnummern auf seinen Bot legen.
--   * Das Modell (Grok, OpenAI, …) schlaegt nur vor. Entscheidung, Ausfuehrung,
--     Verifikation und Evidenz liegen in getrennten Tabellen; die
--     Reihenfolge erzwingen Trigger fail-closed auch gegen fehlerhaften
--     Service-Code:
--       - Entscheidung ist einmalig und nur durch 'policy-engine'.
--       - Ausfuehrung nur bei ALLOW oder bestaetigtem REQUIRE_CONFIRMATION.
--       - 'confirmed' nur mit externer Referenz aus erfolgreicher Ausfuehrung.
--       - Evidenz ist append-only mit Hash-Kette je Session.
--   * Schreibpfade: Edge Functions / Voice Runtime (Service-Role).
--     Tenant-Mitglieder lesen per RLS; Owner/Admin pflegen nur die Bot-
--     Konfiguration.
--
-- Typen normativ in packages/agent-runtime-contracts (voice-provider.ts).

-- ─── 1. Voice-Konfiguration je Bot (1:1 zu public.bots) ─────────────────────
CREATE TABLE IF NOT EXISTS public.voice_bot_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bot_id          UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    -- Intelligence Runtime. Austauschbar; Policy/Governance haengen NICHT
    -- am Provider.
    provider        TEXT NOT NULL
                        CHECK (provider IN ('grok', 'openai', 'gemini', 'claude', 'custom')),
    model           TEXT NOT NULL,
    voice           TEXT,
    language        TEXT NOT NULL DEFAULT 'de-DE',
    -- Pflicht-Hinweis zu Gespraechsbeginn (Art. 50 EU AI Act).
    disclosure_text TEXT NOT NULL DEFAULT 'Hinweis: Sie sprechen mit einem KI-Assistenten.',
    -- Versionierte Policy-Referenz, z. B. 'appointment.booking.v1'.
    policy_ref      TEXT NOT NULL,
    -- Werkzeuge, die dem Modell ueberhaupt angeboten werden. Angeboten heisst
    -- nicht erlaubt — das entscheidet ausschliesslich die Policy.
    offered_tools   TEXT[] NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'paused')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (bot_id)
);

CREATE INDEX IF NOT EXISTS idx_voice_bot_configs_tenant
    ON public.voice_bot_configs(tenant_id);

-- ─── 2. Rufnummer → Bot → Tenant ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_number_bindings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bot_id              UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    phone_number_e164   TEXT NOT NULL CHECK (phone_number_e164 ~ '^\+[1-9][0-9]{6,14}$'),
    telephony_provider  TEXT NOT NULL
                            CHECK (telephony_provider IN ('telnyx', 'twilio', 'sip', 'test')),
    -- Referenz beim Telefonie-Provider (Number-/Connection-ID), kein Secret.
    provider_ref        TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'active', 'released')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eine Nummer darf zu jedem Zeitpunkt hoechstens EINEM Bot gehoeren —
-- mandantenuebergreifend. Das ist die Tenant-Isolation fuer eingehende Anrufe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_number_bindings_active_number
    ON public.voice_number_bindings(phone_number_e164)
    WHERE status <> 'released';
CREATE INDEX IF NOT EXISTS idx_voice_number_bindings_tenant
    ON public.voice_number_bindings(tenant_id);

-- ─── 3. Sessions (ein Anruf / eine Realtime-Verbindung) ─────────────────────
CREATE TABLE IF NOT EXISTS public.voice_sessions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bot_id                UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
    -- Transkript-Pfad bleibt bot_conversations/bot_messages (channel='voice').
    conversation_id       UUID REFERENCES public.bot_conversations(id) ON DELETE SET NULL,
    number_binding_id     UUID REFERENCES public.voice_number_bindings(id) ON DELETE SET NULL,
    -- Provider/Modell zum Zeitpunkt der Session (Snapshot fuer die Evidenz).
    provider              TEXT NOT NULL
                              CHECK (provider IN ('grok', 'openai', 'gemini', 'claude', 'custom')),
    model                 TEXT NOT NULL,
    policy_ref            TEXT NOT NULL,
    provider_session_ref  TEXT,
    telephony_call_ref    TEXT,
    correlation_id        UUID NOT NULL DEFAULT gen_random_uuid(),
    status                TEXT NOT NULL DEFAULT 'idle'
                              CHECK (status IN (
                                  'idle', 'consent_required', 'listening', 'transcribing',
                                  'reasoning', 'policy_check', 'awaiting_confirmation',
                                  'speaking', 'killed', 'rate_limited', 'ended', 'failed')),
    disclosure_played_at  TIMESTAMPTZ,
    consent_purposes      TEXT[] NOT NULL DEFAULT '{}',
    kill_switch           BOOLEAN NOT NULL DEFAULT false,
    started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at              TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_sessions_tenant
    ON public.voice_sessions(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_bot
    ON public.voice_sessions(bot_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_sessions_call_ref
    ON public.voice_sessions(telephony_call_ref)
    WHERE telephony_call_ref IS NOT NULL;

-- ─── 4. Tool-Requests + Policy-Entscheidung ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_tool_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id        UUID NOT NULL REFERENCES public.voice_sessions(id) ON DELETE CASCADE,
    -- Tool-Call-ID des Providers (Idempotenz je Session).
    provider_call_id  TEXT,
    tool              TEXT NOT NULL,
    -- Nur Argument-NAMEN gehen in die Entscheidung (pdp/toolcall.ts, K6).
    argument_keys     TEXT[] NOT NULL DEFAULT '{}',
    -- Argumentwerte werden fuer die Ausfuehrung gebraucht, enthalten aber
    -- typischerweise personenbezogene Daten → Aufbewahrung nach Tenant-DSR.
    args              JSONB NOT NULL DEFAULT '{}'::jsonb,
    proposed_by       TEXT NOT NULL DEFAULT 'llm' CHECK (proposed_by = 'llm'),
    -- Entscheidung (einmalig, siehe Trigger).
    verdict           TEXT CHECK (verdict IN ('ALLOW', 'DENY', 'REQUIRE_CONFIRMATION')),
    reason            TEXT,
    risk              TEXT CHECK (risk IN ('low', 'medium', 'high')),
    policy_ref        TEXT,
    trace             JSONB NOT NULL DEFAULT '[]'::jsonb,
    decided_by        TEXT CHECK (decided_by = 'policy-engine'),
    decided_at        TIMESTAMPTZ,
    -- Bestaetigung fuer REQUIRE_CONFIRMATION.
    confirmed_by      TEXT CHECK (confirmed_by IN ('caller', 'staff')),
    confirmed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT voice_tool_requests_decision_complete CHECK (
        (verdict IS NULL AND decided_by IS NULL AND decided_at IS NULL)
        OR (verdict IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL
            AND risk IS NOT NULL AND policy_ref IS NOT NULL)
    ),
    CONSTRAINT voice_tool_requests_confirmation_only_when_required CHECK (
        confirmed_at IS NULL
        OR (verdict = 'REQUIRE_CONFIRMATION' AND confirmed_by IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_voice_tool_requests_session
    ON public.voice_tool_requests(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_voice_tool_requests_tenant
    ON public.voice_tool_requests(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_voice_tool_requests_provider_call
    ON public.voice_tool_requests(session_id, provider_call_id)
    WHERE provider_call_id IS NOT NULL;

-- ─── 5. Ausfuehrung + Verifikation ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_executions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tool_request_id      UUID NOT NULL REFERENCES public.voice_tool_requests(id) ON DELETE CASCADE,
    status               TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'succeeded', 'failed', 'timeout')),
    -- Vom Zielsystem gelieferte ID (z. B. appointment_id).
    external_ref         TEXT,
    error_code           TEXT,
    -- Erst 'confirmed' erlaubt dem Agenten eine verbindliche Zusage.
    verification_status  TEXT NOT NULL DEFAULT 'unverified'
                             CHECK (verification_status IN ('unverified', 'confirmed', 'mismatch', 'failed')),
    verified_at          TIMESTAMPTZ,
    started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at          TIMESTAMPTZ,
    CONSTRAINT voice_executions_confirmed_requires_success CHECK (
        verification_status <> 'confirmed'
        OR (status = 'succeeded' AND external_ref IS NOT NULL AND verified_at IS NOT NULL)
    ),
    UNIQUE (tool_request_id)
);

CREATE INDEX IF NOT EXISTS idx_voice_executions_tenant
    ON public.voice_executions(tenant_id, started_at DESC);

-- ─── 6. Evidenz (append-only, Hash-Kette je Session) ────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_evidence (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id       UUID NOT NULL REFERENCES public.voice_sessions(id) ON DELETE CASCADE,
    seq              INTEGER NOT NULL CHECK (seq >= 1),
    kind             TEXT NOT NULL CHECK (kind IN (
                         'session.start', 'session.end', 'disclosure.played',
                         'consent.granted', 'consent.revoked',
                         'turn.user', 'turn.assistant',
                         'tool.request', 'policy.decision', 'confirmation.received',
                         'tool.result', 'verification.result',
                         'provider.error', 'kill.engaged', 'rate.limited')),
    tool_request_id  UUID REFERENCES public.voice_tool_requests(id) ON DELETE CASCADE,
    -- Nur Metadaten/Referenzen, keine Transkripte oder Argumentwerte.
    payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
    prev_hash        TEXT NOT NULL CHECK (prev_hash ~ '^[0-9a-f]{64}$'),
    hash             TEXT NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_voice_evidence_tenant
    ON public.voice_evidence(tenant_id, created_at DESC);

-- ─── 7. Fail-closed-Trigger ─────────────────────────────────────────────────

-- 7a. Tenant-Konsistenz: Kindzeilen muessen den Tenant ihres Elternteils tragen.
CREATE OR REPLACE FUNCTION public.voice_enforce_tenant_consistency()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE parent_tenant UUID;
BEGIN
    IF TG_TABLE_NAME IN ('voice_bot_configs', 'voice_number_bindings', 'voice_sessions') THEN
        SELECT tenant_id INTO parent_tenant FROM public.bots WHERE id = NEW.bot_id;
    ELSIF TG_TABLE_NAME IN ('voice_tool_requests', 'voice_evidence') THEN
        SELECT tenant_id INTO parent_tenant FROM public.voice_sessions WHERE id = NEW.session_id;
    ELSIF TG_TABLE_NAME = 'voice_executions' THEN
        SELECT tenant_id INTO parent_tenant FROM public.voice_tool_requests WHERE id = NEW.tool_request_id;
    END IF;
    IF parent_tenant IS NULL OR parent_tenant <> NEW.tenant_id THEN
        RAISE EXCEPTION 'voice: tenant mismatch on %', TG_TABLE_NAME USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'voice_bot_configs', 'voice_number_bindings', 'voice_sessions',
        'voice_tool_requests', 'voice_executions', 'voice_evidence'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_tenant ON public.%1$I;', t);
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_tenant BEFORE INSERT OR UPDATE ON public.%1$I '
            'FOR EACH ROW EXECUTE FUNCTION public.voice_enforce_tenant_consistency();', t);
    END LOOP;
END $$;

-- 7b. Entscheidung ist einmalig; Request-Identitaet ist unveraenderlich.
CREATE OR REPLACE FUNCTION public.voice_tool_requests_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.tool IS DISTINCT FROM OLD.tool
       OR NEW.args IS DISTINCT FROM OLD.args
       OR NEW.argument_keys IS DISTINCT FROM OLD.argument_keys
       OR NEW.session_id IS DISTINCT FROM OLD.session_id THEN
        RAISE EXCEPTION 'voice: tool request is immutable' USING ERRCODE = '42501';
    END IF;
    IF OLD.verdict IS NOT NULL AND (
           NEW.verdict IS DISTINCT FROM OLD.verdict
        OR NEW.reason IS DISTINCT FROM OLD.reason
        OR NEW.risk IS DISTINCT FROM OLD.risk
        OR NEW.policy_ref IS DISTINCT FROM OLD.policy_ref
        OR NEW.trace IS DISTINCT FROM OLD.trace
        OR NEW.decided_at IS DISTINCT FROM OLD.decided_at) THEN
        RAISE EXCEPTION 'voice: policy decision is final' USING ERRCODE = '42501';
    END IF;
    IF OLD.confirmed_at IS NOT NULL AND NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
        RAISE EXCEPTION 'voice: confirmation is final' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_voice_tool_requests_guard ON public.voice_tool_requests;
CREATE TRIGGER trg_voice_tool_requests_guard
    BEFORE UPDATE ON public.voice_tool_requests
    FOR EACH ROW EXECUTE FUNCTION public.voice_tool_requests_guard();

-- 7c. Keine Ausfuehrung ohne passende Entscheidung.
CREATE OR REPLACE FUNCTION public.voice_executions_require_decision()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
    SELECT verdict, confirmed_at INTO r
      FROM public.voice_tool_requests WHERE id = NEW.tool_request_id;
    IF r.verdict = 'ALLOW'
       OR (r.verdict = 'REQUIRE_CONFIRMATION' AND r.confirmed_at IS NOT NULL) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'voice: execution without ALLOW or confirmation' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_voice_executions_require_decision ON public.voice_executions;
CREATE TRIGGER trg_voice_executions_require_decision
    BEFORE INSERT ON public.voice_executions
    FOR EACH ROW EXECUTE FUNCTION public.voice_executions_require_decision();

-- 7d. Evidenz ist append-only. Einzige Ausnahme: die Kaskade, wenn die
-- ganze Session (Bot-/Tenant-Loeschung, DSGVO-Loeschpfad) entfernt wird —
-- dann existiert die Session im Snapshot des RI-Triggers nicht mehr.
CREATE OR REPLACE FUNCTION public.voice_evidence_append_only()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND NOT EXISTS (SELECT 1 FROM public.voice_sessions WHERE id = OLD.session_id) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'voice: evidence is append-only' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_voice_evidence_append_only ON public.voice_evidence;
CREATE TRIGGER trg_voice_evidence_append_only
    BEFORE UPDATE OR DELETE ON public.voice_evidence
    FOR EACH ROW EXECUTE FUNCTION public.voice_evidence_append_only();

-- 7e. updated_at
DROP TRIGGER IF EXISTS update_voice_bot_configs_modtime ON public.voice_bot_configs;
CREATE TRIGGER update_voice_bot_configs_modtime
    BEFORE UPDATE ON public.voice_bot_configs
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
DROP TRIGGER IF EXISTS update_voice_number_bindings_modtime ON public.voice_number_bindings;
CREATE TRIGGER update_voice_number_bindings_modtime
    BEFORE UPDATE ON public.voice_number_bindings
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
DROP TRIGGER IF EXISTS update_voice_sessions_modtime ON public.voice_sessions;
CREATE TRIGGER update_voice_sessions_modtime
    BEFORE UPDATE ON public.voice_sessions
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

REVOKE ALL ON FUNCTION public.voice_enforce_tenant_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voice_tool_requests_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voice_executions_require_decision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voice_evidence_append_only() FROM PUBLIC, anon, authenticated;

-- ─── 8. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.voice_bot_configs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_number_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_tool_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_executions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_evidence        ENABLE ROW LEVEL SECURITY;

-- Lesen: Tenant-Mitglieder (memberships → is_tenant_member).
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'voice_bot_configs', 'voice_number_bindings', 'voice_sessions',
        'voice_tool_requests', 'voice_executions', 'voice_evidence'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || ' tenant-read', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated '
            'USING (public.is_tenant_member(tenant_id));', t || ' tenant-read', t);
    END LOOP;
END $$;

-- Schreiben: nur die Bot-Konfiguration, nur Owner/Admin. Sessions, Requests,
-- Ausfuehrungen, Evidenz und Nummern-Bindungen schreibt ausschliesslich die
-- Service-Role (fuer die RLS nicht greift).
DROP POLICY IF EXISTS "voice_bot_configs admin-insert" ON public.voice_bot_configs;
DROP POLICY IF EXISTS "voice_bot_configs admin-update" ON public.voice_bot_configs;
CREATE POLICY "voice_bot_configs admin-insert"
    ON public.voice_bot_configs FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));
CREATE POLICY "voice_bot_configs admin-update"
    ON public.voice_bot_configs FOR UPDATE TO authenticated
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

COMMENT ON TABLE public.voice_bot_configs IS
    'Voice-Runtime-Konfiguration je Bot (Provider, Modell, Policy-Ref). Provider ist austauschbar, Governance nicht.';
COMMENT ON TABLE public.voice_number_bindings IS
    'E.164-Rufnummer → Bot → Tenant. Einzige Quelle fuer den Tenant eingehender Anrufe. Nur Service-Role schreibt.';
COMMENT ON TABLE public.voice_sessions IS
    'Voice-Sessions (Anruf/Realtime-Verbindung) mit Provider-/Modell-/Policy-Snapshot.';
COMMENT ON TABLE public.voice_tool_requests IS
    'Vom Modell vorgeschlagene Tool-Calls inkl. einmaliger Policy-Entscheidung (decided_by = policy-engine).';
COMMENT ON TABLE public.voice_executions IS
    'Ausfuehrung freigegebener Tool-Requests inkl. Read-back-Verifikation. Nur confirmed erlaubt eine Zusage an den Anrufer.';
COMMENT ON TABLE public.voice_evidence IS
    'Append-only Evidenz-Kette je Voice-Session (prev_hash → hash).';

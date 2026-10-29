-- Voice-Agent je Mandant automatisch bereitstellen (ElevenLabs Conversational AI).
-- ADDITIV / NON-BREAKING. Neue Tabelle, keine Änderung an bestehenden Objekten.
--
-- Ablauf:
--   stripe-webhook   → nach dem Abo-Sync: gewährt tenant_entitlements()
--                      `bots.voice`? Soll-Zustand `desired_state` setzen,
--                      `status = 'pending'`, provision-voice-agent anstoßen.
--   provision-voice-agent
--                    → beansprucht die Zeile (status → 'provisioning'),
--                      legt die `public.bots`-Zeile an, dupliziert die
--                      ElevenLabs-Vorlage, setzt Auth = an und Tageslimit,
--                      schreibt agent_id + Evidenz (governance_evidence-Kette).
--
-- Leitplanken:
--   * Keine zweite Bot-Welt (vgl. 20260928130000_voice_runtime_foundation):
--     Der Agent IST eine Zeile in `public.bots` (channel = 'voice'). Diese
--     Tabelle hält nur die Provider-Verknüpfung und den Lebenszyklus.
--   * Entscheidend ist das Entitlement `bots.voice` (Add-on „Voice“ oder
--     Plan), nicht der rohe Checkout. Damit gilt dieselbe Rechte-Quelle wie
--     überall sonst.
--   * Eine Zeile je Mandant. Reaktivierung nach Kündigung nutzt dieselbe Zeile
--     und denselben Agenten.
--   * Kündigung sperrt (status 'suspended', bots.enabled = false). Gespräche
--     starten ausschließlich über eine Signed URL des Backends; ohne aktive
--     Zeile wird keine ausgegeben. Löschen beim Provider ist ein eigener,
--     bewusster Schritt (AVV-Löschfrist), nicht Teil dieser Migration.
--   * Keine Secrets in dieser Tabelle. API-Key und Vorlagen-ID liegen in
--     Vault / Function-Secrets.
--   * Schreiben nur Service-Role (Edge Functions). Mitglieder lesen per RLS.

CREATE TABLE IF NOT EXISTS public.tenant_voice_agents (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bot_id                 UUID REFERENCES public.bots(id) ON DELETE SET NULL,
    provider               TEXT NOT NULL DEFAULT 'elevenlabs'
                               CHECK (provider IN ('elevenlabs')),
    -- Agent-ID beim Provider (kein Secret).
    provider_agent_id      TEXT,
    -- Vorlage, aus der der Agent dupliziert wurde (Snapshot für die Evidenz).
    template_agent_id      TEXT,
    -- Was die Abrechnung verlangt …
    desired_state          TEXT NOT NULL DEFAULT 'active'
                               CHECK (desired_state IN ('active', 'suspended')),
    -- … und was tatsächlich umgesetzt ist.
    status                 TEXT NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'provisioning', 'active', 'suspended', 'failed')),
    stripe_subscription_id TEXT,
    last_stripe_event_id   TEXT,
    -- Angewandte Konfiguration (Name, Auth, Tageslimit) — ohne Secrets.
    config_snapshot        JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempts               INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error             TEXT,
    claimed_at             TIMESTAMPTZ,
    -- Letzte Prüfung einer abgeschlossenen Zeile durch den Reconcile-Lauf
    -- (abgelaufene Grants, geänderte Minuten). Rotiert die Abholliste.
    reconciled_at          TIMESTAMPTZ,
    provisioned_at         TIMESTAMPTZ,
    suspended_at           TIMESTAMPTZ,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_voice_agents_active_has_agent CHECK (
        status <> 'active' OR (provider_agent_id IS NOT NULL AND bot_id IS NOT NULL)
    ),
    CONSTRAINT tenant_voice_agents_provisioning_claimed CHECK (
        status <> 'provisioning' OR claimed_at IS NOT NULL
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_voice_agents_tenant
    ON public.tenant_voice_agents(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_voice_agents_provider_agent
    ON public.tenant_voice_agents(provider, provider_agent_id)
    WHERE provider_agent_id IS NOT NULL;
-- Abholliste für den Worker / Reconcile-Lauf.
CREATE INDEX IF NOT EXISTS idx_tenant_voice_agents_open
    ON public.tenant_voice_agents(status, updated_at)
    WHERE status IN ('pending', 'provisioning', 'failed');

-- bot_id muss demselben Mandanten gehören.
CREATE OR REPLACE FUNCTION public.tenant_voice_agents_bot_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE bot_tenant UUID;
BEGIN
    IF NEW.bot_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT tenant_id INTO bot_tenant FROM public.bots WHERE id = NEW.bot_id;
    IF bot_tenant IS NULL OR bot_tenant <> NEW.tenant_id THEN
        RAISE EXCEPTION 'tenant_voice_agents: bot belongs to another tenant' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_voice_agents_bot_tenant() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tenant_voice_agents_bot_tenant ON public.tenant_voice_agents;
CREATE TRIGGER trg_tenant_voice_agents_bot_tenant
    BEFORE INSERT OR UPDATE OF bot_id, tenant_id ON public.tenant_voice_agents
    FOR EACH ROW EXECUTE FUNCTION public.tenant_voice_agents_bot_tenant();

DROP TRIGGER IF EXISTS update_tenant_voice_agents_modtime ON public.tenant_voice_agents;
CREATE TRIGGER update_tenant_voice_agents_modtime
    BEFORE UPDATE ON public.tenant_voice_agents
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

ALTER TABLE public.tenant_voice_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_voice_agents tenant-read" ON public.tenant_voice_agents;
CREATE POLICY "tenant_voice_agents tenant-read"
    ON public.tenant_voice_agents FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

-- Kein INSERT/UPDATE/DELETE für anon/authenticated: Bereitstellung und
-- Sperre schreibt ausschließlich die Service-Role.
REVOKE INSERT, UPDATE, DELETE ON public.tenant_voice_agents FROM anon, authenticated;

-- Abschluss eines Laufs in EINER Transaktion: Claim prüfen → Evidenz
-- anhängen → Bot schalten → Status setzen. Ein überholter Lauf (Claim
-- verloren) verändert nichts; scheitert die Evidenz, bleibt alles, wie es
-- war. Damit kann kein Bot eingeschaltet sein, ohne dass Beleg und Status
-- dazu passen.
--
-- Rückgabe: 'ok' | 'lost_claim' | 'evidence_conflict' (Kettenkopf bewegt —
-- neu lesen, neu hashen, erneut aufrufen).
CREATE OR REPLACE FUNCTION public.finish_tenant_voice_agent(
    p_id                     UUID,
    p_claimed_at             TIMESTAMPTZ,
    p_status                 TEXT,
    p_bot_enabled            BOOLEAN,
    p_bot_config             JSONB,
    p_config_snapshot        JSONB,
    p_last_error             TEXT,
    p_evidence               JSONB,
    p_expected_previous_hash TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    r    public.tenant_voice_agents%ROWTYPE;
    v_ev UUID;
BEGIN
    IF p_status NOT IN ('active', 'suspended', 'failed') THEN
        RAISE EXCEPTION 'finish_tenant_voice_agent: invalid status %', p_status USING ERRCODE = '22023';
    END IF;

    SELECT * INTO r FROM public.tenant_voice_agents WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR r.status <> 'provisioning' OR r.claimed_at IS DISTINCT FROM p_claimed_at THEN
        RETURN 'lost_claim';
    END IF;

    IF p_evidence IS NOT NULL THEN
        IF (p_evidence ->> 'tenant_id')::uuid IS DISTINCT FROM r.tenant_id THEN
            RAISE EXCEPTION 'finish_tenant_voice_agent: evidence tenant mismatch' USING ERRCODE = '42501';
        END IF;
        v_ev := public.append_governance_evidence(p_evidence, p_expected_previous_hash);
        IF v_ev IS NULL THEN
            RETURN 'evidence_conflict';
        END IF;
    END IF;

    IF r.bot_id IS NOT NULL AND p_bot_enabled IS NOT NULL THEN
        UPDATE public.bots
           SET enabled = p_bot_enabled,
               config  = COALESCE(p_bot_config, config)
         WHERE id = r.bot_id AND tenant_id = r.tenant_id;
    END IF;

    UPDATE public.tenant_voice_agents SET
        status          = p_status,
        config_snapshot = COALESCE(p_config_snapshot, config_snapshot),
        last_error      = p_last_error,
        claimed_at      = NULL,
        reconciled_at   = now(),
        attempts        = CASE WHEN p_status = 'failed' THEN attempts ELSE 0 END,
        provisioned_at  = CASE WHEN p_status = 'active' THEN now() ELSE provisioned_at END,
        suspended_at    = CASE WHEN p_status = 'suspended' THEN now()
                               WHEN p_status = 'active' THEN NULL
                               ELSE suspended_at END
     WHERE id = p_id;

    RETURN 'ok';
END;
$$;

COMMENT ON FUNCTION public.finish_tenant_voice_agent(UUID, TIMESTAMPTZ, TEXT, BOOLEAN, JSONB, JSONB, TEXT, JSONB, TEXT) IS
    'Schließt einen provision-voice-agent-Lauf atomar ab (Claim → Evidenz → Bot → Status). Nur service_role.';

REVOKE ALL     ON FUNCTION public.finish_tenant_voice_agent(UUID, TIMESTAMPTZ, TEXT, BOOLEAN, JSONB, JSONB, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.finish_tenant_voice_agent(UUID, TIMESTAMPTZ, TEXT, BOOLEAN, JSONB, JSONB, TEXT, JSONB, TEXT) TO service_role;

COMMENT ON TABLE public.tenant_voice_agents IS
    'Voice-Agent je Mandant beim Provider (ElevenLabs): Verknüpfung zu public.bots, Soll-/Ist-Zustand aus bots.voice. Nur Service-Role schreibt.';

-- AI Data Residency — opt-in routing zwischen Cloud (Anthropic/Google/OpenAI)
-- und lokalem EU-Modell (Ollama auf Kodee-VPS).
--
-- Modell:
--   * Per-User-Toggle:    profiles.ai_data_residency      ('cloud' | 'eu_local')
--   * Per-Tenant-Policy:  tenants.ai_data_residency_policy
--                        ('user_choice' | 'enforce_eu_local' | 'enforce_cloud')
--   * Effektive Auflösung via public.resolve_ai_residency(tenant, user).
--
-- Tools markieren ihre lokale Verfügbarkeit über ai_tools.ollama_model_id —
-- NULL = Tool im EU-lokal-Modus nicht verfügbar (Caller wirft LOCAL_UNAVAILABLE).

-- ─── 1. profiles: per-user toggle ────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS ai_data_residency TEXT NOT NULL DEFAULT 'cloud'
        CHECK (ai_data_residency IN ('cloud', 'eu_local'));

COMMENT ON COLUMN public.profiles.ai_data_residency IS
    'Persönlicher Datenschutz-Modus für AI-Tools. eu_local routet alle Calls auf den lokalen Ollama-Endpunkt; cloud nutzt Anthropic/Google/OpenAI.';

-- ─── 2. tenants: per-org policy override ─────────────────────────────────────
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS ai_data_residency_policy TEXT NOT NULL DEFAULT 'user_choice'
        CHECK (ai_data_residency_policy IN ('user_choice', 'enforce_eu_local', 'enforce_cloud'));

COMMENT ON COLUMN public.tenants.ai_data_residency_policy IS
    'Workspace-Policy. user_choice = Mitglieder entscheiden selbst (Default). enforce_eu_local / enforce_cloud = Override durch Admin.';

-- ─── 3. ai_tools: ollama als vierter Provider + lokales Modell-Mapping ───────
ALTER TABLE public.ai_tools DROP CONSTRAINT IF EXISTS ai_tools_model_provider_check;
ALTER TABLE public.ai_tools
    ADD CONSTRAINT ai_tools_model_provider_check
    CHECK (model_provider IN ('anthropic', 'google', 'openai', 'ollama'));

ALTER TABLE public.ai_tools
    ADD COLUMN IF NOT EXISTS ollama_model_id TEXT;

COMMENT ON COLUMN public.ai_tools.ollama_model_id IS
    'Lokales Ollama-Modell, das aktiviert wird wenn der Caller im eu_local-Modus ist. NULL = Tool ist nicht für lokale Inferenz freigegeben (typisch: Tools mit hohen Reasoning-Anforderungen).';

-- ─── 4. Auflösungs-Funktion: tenant-policy gewinnt, sonst user-pref ──────────
CREATE OR REPLACE FUNCTION public.resolve_ai_residency(
    p_tenant_id UUID,
    p_user_id   UUID
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_policy TEXT;
    v_pref   TEXT;
BEGIN
    SELECT ai_data_residency_policy INTO v_policy
    FROM public.tenants WHERE id = p_tenant_id;

    IF v_policy = 'enforce_eu_local' THEN RETURN 'eu_local'; END IF;
    IF v_policy = 'enforce_cloud'    THEN RETURN 'cloud';    END IF;

    -- user_choice (Default) oder Tenant fehlt → user-pref
    IF p_user_id IS NULL THEN RETURN 'cloud'; END IF;

    SELECT ai_data_residency INTO v_pref
    FROM public.profiles WHERE id = p_user_id;

    RETURN COALESCE(v_pref, 'cloud');
END;
$$;

COMMENT ON FUNCTION public.resolve_ai_residency(UUID, UUID) IS
    'Liefert "cloud" oder "eu_local" für (tenant, user). Tenant-Policy hat Vorrang vor User-Pref.';

-- ─── 5. Seed: lokale Modelle für die drei Default-Tools ──────────────────────
-- Mapping-Logik:
--   code_explain → qwen2.5:7b-instruct-q4_K_M  (Code-Verständnis stark, läuft auf 16GB CPU)
--   log_analyze  → qwen2.5:7b-instruct-q4_K_M  (Log-Pattern-Matching, gleiche Klasse)
--   vps_status   → NULL                         (braucht Opus-Reasoning, lokal zu schwach)
UPDATE public.ai_tools SET ollama_model_id = 'qwen2.5:7b-instruct-q4_K_M'
    WHERE key IN ('code_explain', 'log_analyze');

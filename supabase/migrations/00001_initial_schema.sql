-- INITIAL SCHEMA FOR REALSYNC AGENT OS (V1.1)
-- FOUNTAIN OF SOVEREIGNTY: EU-COMPLIANT ARCHITECTURE

-- 0. TRIGGERS & UTILS
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. PROFILES (Extending auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    organization_name TEXT,
    role TEXT DEFAULT 'user',
    eu_compliance_mode BOOLEAN DEFAULT true,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer können ihr eigenes Profil lesen"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Nutzer können ihr eigenes Profil aktualisieren"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE TRIGGER trig_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.profiles IS 'Erweiterte Benutzerdaten mit Fokus auf EU-Compliance-Status und Organisationszugehörigkeit.';

-- 2. C2PA ASSETS (CreatorSeal)
CREATE TABLE IF NOT EXISTS public.c2pa_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_name TEXT NOT NULL,
    asset_hash TEXT NOT NULL, -- SHA-256
    status TEXT CHECK (status IN ('verifiziert', 'ausstehend', 'warnung')) DEFAULT 'ausstehend',
    metadata JSONB DEFAULT '{}'::jsonb, -- Herkunftsnachweis-Daten
    storage_path TEXT, -- Link zum verschlüsselten Storage-Bucket
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.c2pa_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Besitzer können ihre eigenen Assets verwalten"
    ON public.c2pa_assets FOR ALL
    USING (auth.uid() = owner_id);

CREATE TRIGGER trig_assets_updated_at
    BEFORE UPDATE ON public.c2pa_assets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.c2pa_assets IS 'Digitaler Herkunftsnachweis (CreatorSeal) für Assets basierend auf C2PA Standards.';

-- 3. WORKFLOWS (UFO-Bridge Automation)
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    actions_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Besitzer können ihre eigenen Workflows verwalten"
    ON public.workflows FOR ALL
    USING (auth.uid() = owner_id);

CREATE TRIGGER trig_workflows_updated_at
    BEFORE UPDATE ON public.workflows
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.workflows IS 'Automatisierte Prüf- und Verarbeitungsabläufe der UFO-Bridge.';

-- 4. PRÜFPFAD (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL, -- e.g., 'asset', 'workflow', 'auth'
    entity_id UUID,
    action TEXT NOT NULL, -- e.g., 'created', 'verified', 'deleted'
    metadata JSONB DEFAULT '{}'::jsonb, -- Detaillierte Log-Daten
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer können ihren eigenen Prüfpfad einsehen"
    ON public.audit_logs FOR SELECT
    USING (auth.uid() = actor_id);

COMMENT ON TABLE public.audit_logs IS 'Unveränderlicher Prüfpfad zur Einhaltung der Revisionssicherheit und DSGVO-Transparenz.';

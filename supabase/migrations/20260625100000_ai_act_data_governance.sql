-- AI-Act Daten-Governance (Art. 10) — dokumentierte Trainings-, Validierungs-
-- und Testdatensätze pro KI-System.
--
-- Art. 10 Verordnung 2024/1689 verlangt für Hochrisiko-Systeme eine
-- dokumentierte Daten-Governance: Herkunft und Erhebungsprozess, Vorverar-
-- beitung/Annotation, Annahmen, Eignung/Repräsentativität, Bias-Prüfung und
-- bekannte Lücken — zzgl. Rechtsgrundlage (DSGVO) bei personenbezogenen Daten.
--
-- Bewusst registry-agnostisch verknüpft (`ai_system_ref` als Freitext statt
-- harter FK), weil das KI-System-Inventar aktuell über mehrere Tabellen
-- verteilt ist (governance_assets, enterprise_ai_system_registry, ai_systems).
-- Jede Zeile ist tenant-scoped und folgt dem RLS-Muster aus
-- 20260612100000_ai_act_risk_inventory.sql.

CREATE TABLE IF NOT EXISTS public.ai_act_datasets (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- Lose Verknüpfung zum KI-System (Name oder ID aus beliebigem Registry).
    ai_system_ref            TEXT,
    name                     TEXT NOT NULL,
    -- Rolle des Datensatzes im ML-Lebenszyklus (Art. 10 Abs. 1).
    dataset_role             TEXT NOT NULL DEFAULT 'training'
                               CHECK (dataset_role IN ('training', 'validation', 'testing', 'production_input', 'other')),
    -- Herkunft & Erhebungsprozess (Art. 10 Abs. 2 lit. b/c).
    source_description       TEXT,
    origin_jurisdictions     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    -- Personenbezug + Rechtsgrundlage (DSGVO-Bezug).
    contains_personal_data   BOOLEAN NOT NULL DEFAULT false,
    special_categories       BOOLEAN NOT NULL DEFAULT false,
    legal_basis              TEXT,
    -- Verantwortliche Person für den Datensatz (Data Steward).
    data_steward             TEXT,
    -- Vorverarbeitung/Annotation (Art. 10 Abs. 2 lit. d).
    preprocessing_notes      TEXT,
    -- Bias-Prüfung (Art. 10 Abs. 2 lit. f/g).
    bias_assessment          TEXT,
    -- Eignung/Repräsentativität (Art. 10 Abs. 3).
    representativeness_note   TEXT,
    -- Bekannte Lücken/Mängel (Art. 10 Abs. 2 lit. h).
    known_gaps               TEXT,
    collected_from           DATE,
    collected_to             DATE,
    -- Optionaler Verweis auf einen Nachweis im Evidence-Vault (kein harter FK).
    evidence_id              UUID,
    metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by               UUID,            -- auth.users.id, nullable für Edge-Func-Ingest
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_act_datasets_tenant_created
    ON public.ai_act_datasets(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_act_datasets_tenant_system
    ON public.ai_act_datasets(tenant_id, ai_system_ref);
CREATE INDEX IF NOT EXISTS idx_ai_act_datasets_tenant_role
    ON public.ai_act_datasets(tenant_id, dataset_role);

ALTER TABLE public.ai_act_datasets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_act_datasets tenant-select" ON public.ai_act_datasets;
CREATE POLICY "ai_act_datasets tenant-select"
    ON public.ai_act_datasets FOR SELECT
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "ai_act_datasets tenant-insert" ON public.ai_act_datasets;
CREATE POLICY "ai_act_datasets tenant-insert"
    ON public.ai_act_datasets FOR INSERT
    WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "ai_act_datasets tenant-update" ON public.ai_act_datasets;
CREATE POLICY "ai_act_datasets tenant-update"
    ON public.ai_act_datasets FOR UPDATE
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "ai_act_datasets tenant-delete" ON public.ai_act_datasets;
CREATE POLICY "ai_act_datasets tenant-delete"
    ON public.ai_act_datasets FOR DELETE
    USING (public.is_tenant_member(tenant_id));

DROP TRIGGER IF EXISTS update_ai_act_datasets_modtime ON public.ai_act_datasets;
CREATE TRIGGER update_ai_act_datasets_modtime
    BEFORE UPDATE ON public.ai_act_datasets
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

COMMENT ON TABLE public.ai_act_datasets IS
    'Daten-Governance-Dokumentation nach EU-AI-Act Art. 10 (Trainings-/Validierungs-/Testdaten pro KI-System), tenant-scoped.';
COMMENT ON COLUMN public.ai_act_datasets.ai_system_ref IS
    'Lose Verknüpfung zum KI-System (Name oder ID); kein harter FK, da Registry über mehrere Tabellen verteilt ist.';
COMMENT ON COLUMN public.ai_act_datasets.bias_assessment IS
    'Dokumentierte Prüfung möglicher Verzerrungen (Art. 10 Abs. 2 lit. f/g).';

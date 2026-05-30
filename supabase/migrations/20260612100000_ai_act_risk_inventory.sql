-- AI-Act-Risiko-Inventar — persistierte Tenant-Klassifikationen.
--
-- Ergänzt den öffentlichen Wizard /ai-act-klassifikator: ein eingeloggter
-- Tenant kann seine Klassifikations-Ergebnisse als KI-System-Inventar
-- speichern, durchsuchen und versionieren. Jede Inventur ist tenant-scoped
-- und folgt der Risiko-Pyramide aus Verordnung 2024/1689:
--
--   prohibited  → Art. 5  (verbotene Praktiken)
--   high        → Annex III (Conformity Assessment Pflicht)
--   limited     → Art. 50  (Transparenz-Pflicht)
--   minimal     → kein spezifischer Regulierungs-Pflicht
--
-- Speichert das vollständige Klassifikations-Resultat als JSONB damit das
-- Inventar auch nach Registry-Updates (annex-iii.json Version-Bumps) sauber
-- nachvollziehbar bleibt (registry_version + Snapshot).

CREATE TABLE IF NOT EXISTS public.ai_act_risk_inventory (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    description             TEXT,
    severity                TEXT NOT NULL
                              CHECK (severity IN ('prohibited', 'high', 'limited', 'minimal')),
    -- Snapshot des Klassifikations-Outputs aus dem Wizard.
    matched_use_cases       JSONB NOT NULL DEFAULT '[]'::jsonb,
    prohibited_triggers     JSONB NOT NULL DEFAULT '[]'::jsonb,
    limited_triggers        JSONB NOT NULL DEFAULT '[]'::jsonb,
    has_prohibited_overlay  BOOLEAN NOT NULL DEFAULT false,
    confidence_score        INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    registry_version        TEXT,
    notes                   TEXT,
    classified_by           UUID,            -- auth.users.id, nullable für Edge-Func-Ingest
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_act_risk_inventory_tenant_created
    ON public.ai_act_risk_inventory(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_act_risk_inventory_tenant_severity
    ON public.ai_act_risk_inventory(tenant_id, severity);

ALTER TABLE public.ai_act_risk_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_act_risk_inventory tenant-select" ON public.ai_act_risk_inventory;
CREATE POLICY "ai_act_risk_inventory tenant-select"
    ON public.ai_act_risk_inventory FOR SELECT
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "ai_act_risk_inventory tenant-insert" ON public.ai_act_risk_inventory;
CREATE POLICY "ai_act_risk_inventory tenant-insert"
    ON public.ai_act_risk_inventory FOR INSERT
    WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "ai_act_risk_inventory tenant-update" ON public.ai_act_risk_inventory;
CREATE POLICY "ai_act_risk_inventory tenant-update"
    ON public.ai_act_risk_inventory FOR UPDATE
    USING (public.is_tenant_member(tenant_id))
    WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "ai_act_risk_inventory tenant-delete" ON public.ai_act_risk_inventory;
CREATE POLICY "ai_act_risk_inventory tenant-delete"
    ON public.ai_act_risk_inventory FOR DELETE
    USING (public.is_tenant_member(tenant_id));

DROP TRIGGER IF EXISTS update_ai_act_risk_inventory_modtime ON public.ai_act_risk_inventory;
CREATE TRIGGER update_ai_act_risk_inventory_modtime
    BEFORE UPDATE ON public.ai_act_risk_inventory
    FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

COMMENT ON TABLE public.ai_act_risk_inventory IS
    'Tenant-Inventar klassifizierter KI-Systeme nach EU-AI-Act-Risiko-Pyramide (Art. 5 / Annex III / Art. 50).';
COMMENT ON COLUMN public.ai_act_risk_inventory.matched_use_cases IS
    'Snapshot der gematchten Annex-III-Use-Cases zum Klassifikations-Zeitpunkt (Registry-versioniert).';
COMMENT ON COLUMN public.ai_act_risk_inventory.registry_version IS
    'src/rules/annex-iii.json Version unter der klassifiziert wurde — bleibt stabil bei Registry-Updates.';

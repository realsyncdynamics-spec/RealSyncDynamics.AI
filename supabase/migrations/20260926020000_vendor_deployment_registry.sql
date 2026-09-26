-- Anbieter-/Deployment-Registry (Fakten) + Mandanten-Konfiguration + Assessment-Snapshots
--
-- ZWECK
--
-- Grundlage fuer das spaetere Gateway v2: Routing nach Datenstandort
-- (DE_ONLY / EU_ONLY / EU_EFTA / GLOBAL_ALLOWED), erlaubten/gesperrten
-- Vendoren und geforderten Faehigkeiten. Die Richtlinie entscheidet VOR dem
-- Aufruf; der Provider hat keine Autoritaet.
--
-- Quelle der Wahrheit fuer die Fakten sind die versionierten Dateien unter
-- registry/ (JSON Schema Draft 2020-12, CI-Gates). Diese Migration legt nur
-- die Tabellen an – KEINE Seeds. Ein spaeterer Import-Job (service_role)
-- uebernimmt die Dateien 1:1 (Zuordnung: scripts/registry/import-dry-run.ts).
--
-- GRUNDSAETZE
--
--   * Bewertet wird das Deployment, nicht die Marke. Region, Jurisdiktion,
--     Drittstaatenzugriff und Siegel haengen am Deployment.
--   * Keine Ergebnis-, Routing- oder Immunitaets-Spalte in den Registry-
--     Tabellen (kein result, kein routing_allowed, kein cloud_act_safe).
--     Routing-Zulaessigkeit wird aus Fakten + Policy ABGELEITET
--     (supabase/functions/_shared/registry/residency.ts), nie gespeichert.
--   * Ergebnisse gibt es nur als Snapshot (deployment_assessments) mit
--     inputs, inputs_hash, policy_profile, rule_version, evidence_cutoff.
--     Snapshots sind append-only.
--   * Zertifikate gelten nur fuer die in applies_to_sku genannten Produkte.
--
-- WIEDERVERWENDUNG
--
--   * public.tenants, public.is_tenant_member(), public.is_tenant_owner_or_admin()
--   * public.set_updated_at()
--   * public.vendors (mandantenbezogenes DPA-/Subprozessor-Inventar) wird NICHT
--     dupliziert: tenant_deployment_configs.tenant_vendor_id verweist optional darauf.
--   * public.ai_systems (optional: ai_system_id), public.governance_evidence
--     (Pruefpfad eines Snapshots).
--   * Risikoklassen wie ai_act_risk_inventory.severity plus 'not_assessed'.
--
-- DSGVO Art. 28/44 ff. (Auftragsverarbeitung, Drittlandtransfer), Art. 5 Abs. 2
-- (Rechenschaft); EU AI Act Art. 13/26 (Transparenz/Betreiberpflichten).

BEGIN;

-- ============================================================
-- 1. Globale, kuratierte Registry-Tabellen (Fakten)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.registry_vendors (
    vendor_id              TEXT PRIMARY KEY CHECK (vendor_id ~ '^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$'),
    display_name           TEXT NOT NULL CHECK (length(display_name) > 0),
    legal_name             TEXT,
    legal_name_status      TEXT NOT NULL CHECK (legal_name_status IN ('verified', 'claimed', 'unknown')),
    legal_seat_country     TEXT[] NOT NULL DEFAULT '{}',
    brands                 TEXT[] NOT NULL DEFAULT '{}',
    control_change_status  TEXT NOT NULL CHECK (control_change_status IN ('none', 'signed_not_closed', 'closed', 'unknown')),
    facts                  JSONB NOT NULL,
    schema_version         TEXT NOT NULL,
    source_file            TEXT NOT NULL,
    source_sha256          TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    imported_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT registry_vendors_legal_name_unknown CHECK (legal_name_status <> 'unknown' OR legal_name IS NULL)
);

COMMENT ON TABLE public.registry_vendors IS
    'Registry: Rechtstraeger (nicht Marke). Global, kuratiert, Import aus registry/vendors/*.json. Keine Bewertung, keine Region.';
COMMENT ON COLUMN public.registry_vendors.facts IS 'Vollstaendige Registry-Datei (Fakten mit Quelle, captured_at, Status).';
COMMENT ON COLUMN public.registry_vendors.control_change_status IS 'unknown ist zulaessig und ehrlicher als ein unbelegtes none.';
COMMENT ON COLUMN public.registry_vendors.source_sha256 IS 'sha256 der importierten Datei (Nachvollziehbarkeit Datei -> Zeile).';

CREATE TABLE IF NOT EXISTS public.registry_deployments (
    deployment_id                       TEXT PRIMARY KEY CHECK (deployment_id ~ '^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$'),
    vendor_id                           TEXT NOT NULL REFERENCES public.registry_vendors(vendor_id) ON DELETE RESTRICT,
    brand                               TEXT,
    product_name                        TEXT NOT NULL,
    product_sku                         TEXT NOT NULL,
    deployment_kind                     TEXT NOT NULL CHECK (deployment_kind IN ('shared_serverless', 'dedicated', 'self_hosted', 'on_premise', 'hybrid', 'unknown')),
    listing_status                      TEXT NOT NULL CHECK (listing_status IN ('active', 'preview', 'retired')),
    connector_type                      TEXT NOT NULL,
    api_base_url                        TEXT,
    inference_region_scope              TEXT NOT NULL CHECK (inference_region_scope IN ('country', 'eu', 'eu_efta', 'europe', 'global', 'unknown')),
    inference_country_codes             TEXT[] NOT NULL DEFAULT '{}',
    inference_region_code               TEXT,
    inference_region_status             TEXT NOT NULL CHECK (inference_region_status IN ('verified', 'claimed', 'unknown')),
    external_inference_egress           BOOLEAN,
    external_inference_egress_status    TEXT NOT NULL CHECK (external_inference_egress_status IN ('verified', 'claimed', 'unknown')),
    third_country_access_status         TEXT NOT NULL CHECK (third_country_access_status IN ('no_access_claimed', 'access_possible', 'access_confirmed', 'unknown')),
    third_country_requires_review       BOOLEAN NOT NULL,
    eu_commission_seal_status           TEXT NOT NULL CHECK (eu_commission_seal_status IN ('awarded', 'none_documented', 'unknown')),
    eu_commission_seal_level            TEXT CHECK (eu_commission_seal_level IN ('SEAL-0', 'SEAL-1', 'SEAL-2', 'SEAL-3', 'SEAL-4')),
    eu_commission_seal_applies_to_sku   TEXT[] NOT NULL DEFAULT '{}',
    pricing_scheme                      TEXT NOT NULL CHECK (pricing_scheme IN ('per_model', 'category', 'contract_only', 'unknown')),
    capabilities                        JSONB NOT NULL DEFAULT '{}'::jsonb,
    pricing                             JSONB NOT NULL DEFAULT '{}'::jsonb,
    jurisdiction                        JSONB NOT NULL DEFAULT '{}'::jsonb,
    facts                               JSONB NOT NULL,
    schema_version                      TEXT NOT NULL,
    source_file                         TEXT NOT NULL,
    source_sha256                       TEXT NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
    imported_at                         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT registry_deployments_region_unknown CHECK (inference_region_scope <> 'unknown' OR inference_region_status = 'unknown'),
    CONSTRAINT registry_deployments_country_codes CHECK (inference_region_scope <> 'country' OR cardinality(inference_country_codes) > 0),
    CONSTRAINT registry_deployments_seal_level CHECK (
        (eu_commission_seal_status = 'awarded' AND eu_commission_seal_level IS NOT NULL AND cardinality(eu_commission_seal_applies_to_sku) > 0)
        OR (eu_commission_seal_status <> 'awarded' AND eu_commission_seal_level IS NULL)
    )
);

COMMENT ON TABLE public.registry_deployments IS
    'Registry: bewertbares Deployment (Produkt + Region + Connector). Nur Fakten. Routing-Zulaessigkeit wird abgeleitet (residency.ts), nie gespeichert; Ergebnisse nur in deployment_assessments.';
COMMENT ON COLUMN public.registry_deployments.third_country_access_status IS
    'Fakt, kein Immunitaets-Flag. no_access_claimed ist eine Anbieterbehauptung; nie aus der Region abgeleitet.';
COMMENT ON COLUMN public.registry_deployments.eu_commission_seal_applies_to_sku IS
    'Siegel gilt nur fuer diese Produkte; nie auf eine Marke vererbt. SEAL-3 ist nie SEAL-4.';
COMMENT ON COLUMN public.registry_deployments.external_inference_egress IS
    'true = Inferenz wird an einen externen Dritten weitergereicht; NULL = unbelegt. Unter strict_eu_sovereignty nie PASS.';

CREATE TABLE IF NOT EXISTS public.registry_models (
    deployment_id            TEXT NOT NULL REFERENCES public.registry_deployments(deployment_id) ON DELETE CASCADE,
    model_id                 TEXT NOT NULL CHECK (model_id ~ '^[a-z0-9][a-z0-9._-]{0,127}$'),
    api_model_id             TEXT,
    display_name             TEXT NOT NULL,
    model_type               TEXT NOT NULL CHECK (model_type IN ('chat', 'embedding', 'reranker', 'ocr', 'audio', 'image', 'other')),
    availability             TEXT NOT NULL CHECK (availability IN ('available', 'preview', 'deprecated', 'unavailable', 'unknown')),
    inference_region_scope   TEXT CHECK (inference_region_scope IN ('country', 'eu', 'eu_efta', 'europe', 'global', 'unknown')),
    inference_country_codes  TEXT[],
    price_category           TEXT,
    price                    JSONB,
    capabilities             JSONB NOT NULL DEFAULT '{}'::jsonb,
    facts                    JSONB NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (deployment_id, model_id),
    CONSTRAINT registry_models_price_xor_category CHECK (price IS NULL OR price_category IS NULL)
);

COMMENT ON TABLE public.registry_models IS
    'Registry: Modelle je Deployment. Kategorie-Preise (z. B. STACKIT Standard/Plus/Premium) stehen am Deployment; das Modell traegt dann nur price_category, nie einen eigenen Preis.';

CREATE TABLE IF NOT EXISTS public.registry_certifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_kind      TEXT NOT NULL CHECK (owner_kind IN ('vendor', 'deployment')),
    vendor_id       TEXT NOT NULL REFERENCES public.registry_vendors(vendor_id) ON DELETE CASCADE,
    deployment_id   TEXT REFERENCES public.registry_deployments(deployment_id) ON DELETE CASCADE,
    cert_id         TEXT NOT NULL,
    scheme          TEXT NOT NULL,
    name            TEXT NOT NULL,
    scope           TEXT NOT NULL CHECK (length(scope) > 0),
    applies_to_sku  TEXT[] NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('verified', 'claimed', 'unknown')),
    sources         JSONB NOT NULL CHECK (jsonb_typeof(sources) = 'array' AND jsonb_array_length(sources) >= 1),
    captured_at     TIMESTAMPTZ NOT NULL,
    valid_from      DATE,
    valid_until     DATE,
    verification    JSONB,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT registry_certifications_owner CHECK ((owner_kind = 'vendor') = (deployment_id IS NULL)),
    CONSTRAINT registry_certifications_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from),
    CONSTRAINT registry_certifications_verified CHECK (status <> 'verified' OR verification IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS registry_certifications_uniq
    ON public.registry_certifications (vendor_id, COALESCE(deployment_id, ''), cert_id);

COMMENT ON TABLE public.registry_certifications IS
    'Registry: Zertifikate/Testate mit scope, Quelle(n), captured_at, Gueltigkeit und applies_to_sku. applies_to_sku leer = keinem Produkt zurechenbar.';

CREATE TABLE IF NOT EXISTS public.registry_claims (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id  TEXT NOT NULL REFERENCES public.registry_deployments(deployment_id) ON DELETE CASCADE,
    claim_id       TEXT NOT NULL,
    claim_type     TEXT NOT NULL,
    model_ids      TEXT[] NOT NULL DEFAULT '{}',
    value          JSONB,
    statement      TEXT NOT NULL,
    status         TEXT NOT NULL CHECK (status IN ('verified', 'claimed', 'unknown')),
    sources        JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources) = 'array'),
    captured_at    TIMESTAMPTZ NOT NULL,
    verification   JSONB,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (deployment_id, claim_id),
    -- Evidence-Regel auch in der DB: belegte Claims tragen mindestens eine Quelle.
    CONSTRAINT registry_claims_sourced CHECK (status = 'unknown' OR jsonb_array_length(sources) >= 1),
    CONSTRAINT registry_claims_verified CHECK (status <> 'verified' OR verification IS NOT NULL)
);

COMMENT ON TABLE public.registry_claims IS
    'Registry: Governance-Claims je Deployment mit Quelle, Datum und Verifikationsstatus (claimed = Anbieterquelle, verified = unabhaengig geprueft).';

-- ============================================================
-- 2. Mandanten-Konfiguration je Deployment
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenant_deployment_configs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    deployment_id        TEXT NOT NULL REFERENCES public.registry_deployments(deployment_id) ON DELETE RESTRICT,
    label                TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
    tenant_vendor_id     UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    ai_system_id         UUID REFERENCES public.ai_systems(id) ON DELETE SET NULL,
    intended_purpose     TEXT,
    use_case_risk_class  TEXT NOT NULL DEFAULT 'not_assessed'
                         CHECK (use_case_risk_class IN ('not_assessed', 'minimal', 'limited', 'high', 'prohibited')),
    residency_class      TEXT NOT NULL CHECK (residency_class IN ('DE_ONLY', 'EU_ONLY', 'EU_EFTA', 'GLOBAL_ALLOWED')),
    policy_profile       TEXT NOT NULL DEFAULT 'eu_data_residency'
                         CHECK (policy_profile IN ('strict_eu_sovereignty', 'eu_data_residency', 'baseline')),
    allowed_models       TEXT[] NOT NULL DEFAULT '{}',
    settings             JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(settings) = 'object'),
    created_by           UUID,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, label)
);

COMMENT ON TABLE public.tenant_deployment_configs IS
    'Mandanten-Konfiguration eines Registry-Deployments: Zweck, Risikoklasse (not_assessed bis bewertet), Residency-Klasse, Policy-Profil. Kein Ergebnisfeld.';
COMMENT ON COLUMN public.tenant_deployment_configs.tenant_vendor_id IS
    'Optional: Verweis auf das mandantenbezogene DPA-/Subprozessor-Inventar public.vendors (keine Duplizierung).';
COMMENT ON COLUMN public.tenant_deployment_configs.use_case_risk_class IS
    'Wie ai_act_risk_inventory.severity plus not_assessed. Bei not_assessed trifft ein Assessment keine AI-Act-Konformitaetsaussage.';

CREATE INDEX IF NOT EXISTS tenant_deployment_configs_tenant_idx ON public.tenant_deployment_configs (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_deployment_configs_deployment_idx ON public.tenant_deployment_configs (deployment_id);

-- ============================================================
-- 3. Assessment-Snapshots (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deployment_assessments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    config_id               UUID REFERENCES public.tenant_deployment_configs(id) ON DELETE SET NULL,
    deployment_id           TEXT NOT NULL REFERENCES public.registry_deployments(deployment_id) ON DELETE RESTRICT,
    model_id                TEXT,
    policy_profile          TEXT NOT NULL CHECK (policy_profile IN ('strict_eu_sovereignty', 'eu_data_residency', 'baseline')),
    assurance_target        TEXT NOT NULL CHECK (assurance_target IN ('routing_eligibility', 'data_residency', 'full_supply_chain_sovereignty', 'ai_act_documentation_support')),
    rule_version            TEXT NOT NULL CHECK (rule_version ~ '^[a-z0-9_.-]+@\d+\.\d+\.\d+$'),
    evaluated_at            TIMESTAMPTZ NOT NULL,
    evidence_cutoff         TIMESTAMPTZ NOT NULL,
    expires_at              TIMESTAMPTZ,
    result                  TEXT NOT NULL CHECK (result IN ('PASS', 'CONDITIONAL', 'FAIL', 'UNKNOWN', 'STALE')),
    inputs                  JSONB NOT NULL CHECK (jsonb_typeof(inputs) = 'object'),
    inputs_hash             TEXT NOT NULL CHECK (inputs_hash ~ '^[0-9a-f]{64}$'),
    inputs_hash_method      TEXT NOT NULL DEFAULT 'sha256_hex(utf8(RFC8785_JCS(inputs)))',
    derived                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    findings                JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(findings) = 'array'),
    governance_evidence_id  UUID REFERENCES public.governance_evidence(id) ON DELETE RESTRICT,
    evidence_ids            UUID[] NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT deployment_assessments_time_order CHECK (evidence_cutoff <= evaluated_at),
    CONSTRAINT deployment_assessments_expiry CHECK (expires_at IS NULL OR expires_at > evaluated_at)
);

COMMENT ON TABLE public.deployment_assessments IS
    'Snapshot einer Deployment-Bewertung fuer genau diese inputs/policy_profile/rule_version/evidence_cutoff. Append-only; nur service_role schreibt. Keine UI-Farbe, kein Deployment-Status.';
COMMENT ON COLUMN public.deployment_assessments.inputs_hash IS
    'sha256_hex(utf8(RFC8785_JCS(inputs))) – gleiche Konvention wie governance_evidence.content_hash (_shared/evidence-hash.ts).';

CREATE INDEX IF NOT EXISTS deployment_assessments_tenant_idx ON public.deployment_assessments (tenant_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS deployment_assessments_deployment_idx ON public.deployment_assessments (deployment_id, evaluated_at DESC);

CREATE OR REPLACE FUNCTION public.deployment_assessments_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'deployment_assessments ist append-only (% nicht erlaubt)', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION public.deployment_assessments_append_only() IS
    'Sperrt UPDATE auf Assessment-Snapshots. Neue Bewertung = neuer Snapshot.';

DROP TRIGGER IF EXISTS deployment_assessments_no_update ON public.deployment_assessments;
CREATE TRIGGER deployment_assessments_no_update
    BEFORE UPDATE ON public.deployment_assessments
    FOR EACH ROW EXECUTE FUNCTION public.deployment_assessments_append_only();

-- ============================================================
-- 4. updated_at-Trigger
-- ============================================================

DROP TRIGGER IF EXISTS registry_vendors_updated_at ON public.registry_vendors;
CREATE TRIGGER registry_vendors_updated_at BEFORE UPDATE ON public.registry_vendors
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS registry_deployments_updated_at ON public.registry_deployments;
CREATE TRIGGER registry_deployments_updated_at BEFORE UPDATE ON public.registry_deployments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS registry_models_updated_at ON public.registry_models;
CREATE TRIGGER registry_models_updated_at BEFORE UPDATE ON public.registry_models
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS registry_certifications_updated_at ON public.registry_certifications;
CREATE TRIGGER registry_certifications_updated_at BEFORE UPDATE ON public.registry_certifications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS registry_claims_updated_at ON public.registry_claims;
CREATE TRIGGER registry_claims_updated_at BEFORE UPDATE ON public.registry_claims
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS tenant_deployment_configs_updated_at ON public.tenant_deployment_configs;
CREATE TRIGGER tenant_deployment_configs_updated_at BEFORE UPDATE ON public.tenant_deployment_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. RLS
-- ============================================================

-- 5a. Globale Registry: lesen fuer angemeldete Nutzer, schreiben nur service_role (Import-Job).
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['registry_vendors', 'registry_deployments', 'registry_models', 'registry_certifications', 'registry_claims'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM authenticated', t);
        EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
        EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_authenticated', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_select_authenticated', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role_all', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t || '_service_role_all', t);
    END LOOP;
END;
$$;

-- 5b. Mandanten-Konfiguration: Mitglieder lesen, Owner/Admin schreiben.
ALTER TABLE public.tenant_deployment_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_deployment_configs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_deployment_configs TO authenticated;
GRANT ALL ON public.tenant_deployment_configs TO service_role;

DROP POLICY IF EXISTS tenant_deployment_configs_select ON public.tenant_deployment_configs;
CREATE POLICY tenant_deployment_configs_select ON public.tenant_deployment_configs
    FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS tenant_deployment_configs_insert ON public.tenant_deployment_configs;
CREATE POLICY tenant_deployment_configs_insert ON public.tenant_deployment_configs
    FOR INSERT TO authenticated WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));
DROP POLICY IF EXISTS tenant_deployment_configs_update ON public.tenant_deployment_configs;
CREATE POLICY tenant_deployment_configs_update ON public.tenant_deployment_configs
    FOR UPDATE TO authenticated USING (public.is_tenant_owner_or_admin(tenant_id)) WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));
DROP POLICY IF EXISTS tenant_deployment_configs_delete ON public.tenant_deployment_configs;
CREATE POLICY tenant_deployment_configs_delete ON public.tenant_deployment_configs
    FOR DELETE TO authenticated USING (public.is_tenant_owner_or_admin(tenant_id));
DROP POLICY IF EXISTS tenant_deployment_configs_service_role ON public.tenant_deployment_configs;
CREATE POLICY tenant_deployment_configs_service_role ON public.tenant_deployment_configs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5c. Assessments: Mitglieder lesen; schreiben (INSERT) nur service_role (Evaluator).
ALTER TABLE public.deployment_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.deployment_assessments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.deployment_assessments FROM authenticated;
GRANT SELECT ON public.deployment_assessments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.deployment_assessments TO service_role;
REVOKE UPDATE, TRUNCATE ON public.deployment_assessments FROM service_role;

DROP POLICY IF EXISTS deployment_assessments_select ON public.deployment_assessments;
CREATE POLICY deployment_assessments_select ON public.deployment_assessments
    FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS deployment_assessments_service_role ON public.deployment_assessments;
CREATE POLICY deployment_assessments_service_role ON public.deployment_assessments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

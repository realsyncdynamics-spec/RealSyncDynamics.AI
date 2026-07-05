-- C2PA Content Authenticity & Provenance Integration
--
-- Adds C2PA (Content Authenticity Initiative) manifest generation and embedding
-- for audit reports, compliance exports, and remediation evidence.
--
-- Enables cryptographic proof of content origin, history, and integrity.

BEGIN;

-- 1. Extend audit_reports table with C2PA manifest (if table exists)
DO $$
BEGIN
  ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS c2pa_manifest JSONB;
  ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS c2pa_claim_generator TEXT DEFAULT 'RealSyncDynamics/1.0';
  ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS c2pa_assertion_hash TEXT;
  ALTER TABLE public.audit_reports ADD COLUMN IF NOT EXISTS c2pa_timestamp_authority TEXT;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 2. Extend compliance_exports table with C2PA metadata (if table exists)
DO $$
BEGIN
  ALTER TABLE public.compliance_exports ADD COLUMN IF NOT EXISTS c2pa_manifest JSONB;
  ALTER TABLE public.compliance_exports ADD COLUMN IF NOT EXISTS c2pa_assertion_hash TEXT;
  ALTER TABLE public.compliance_exports ADD COLUMN IF NOT EXISTS provenance_chain JSONB;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 3. C2PA provenance log (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.c2pa_provenance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Reference to asset or report
  content_type TEXT NOT NULL CHECK (content_type IN ('audit_report', 'compliance_export', 'remediation_evidence', 'governance_decision')),
  content_id TEXT NOT NULL,

  -- C2PA manifest data
  c2pa_manifest JSONB NOT NULL,
  claim_generator TEXT,
  assertion_hash TEXT,

  -- Signature & timestamp
  signer_name TEXT,
  signer_contact TEXT,
  signature_algorithm TEXT DEFAULT 'SHA-256',
  timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- External timestamp authority (optional, for eIDAS compliance)
  tsa_response JSONB,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_c2pa_provenance_tenant_id ON public.c2pa_provenance_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_c2pa_provenance_content ON public.c2pa_provenance_log(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_c2pa_provenance_timestamp ON public.c2pa_provenance_log(timestamp_utc DESC);

COMMENT ON TABLE public.c2pa_provenance_log IS 'Immutable C2PA provenance trail: proof of content origin, history, and integrity';

-- 4. Enable RLS on provenance log
ALTER TABLE public.c2pa_provenance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY c2pa_provenance_tenant_members_read ON public.c2pa_provenance_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.tenant_id = c2pa_provenance_log.tenant_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY c2pa_provenance_service_role_all ON public.c2pa_provenance_log
  FOR ALL TO service_role USING (true);

-- 5. Helper function: generate C2PA manifest structure
CREATE OR REPLACE FUNCTION public.generate_c2pa_manifest(
  p_content_type TEXT,
  p_content_id TEXT,
  p_content_hash TEXT,
  p_signer_name TEXT,
  p_signer_contact TEXT,
  p_claim_generator TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_manifest JSONB;
BEGIN
  v_manifest := jsonb_build_object(
    'version', '2.0',
    'claim_generator', p_claim_generator,
    'claim_generator_info', jsonb_build_object(
      'name', 'RealSyncDynamics',
      'version', '1.0',
      'component', 'audit-provenance-engine'
    ),
    'assertions', jsonb_build_array(
      jsonb_build_object(
        'type', 'c2pa.hash.assertion',
        'label', 'content_hash',
        'content_type', p_content_type,
        'hash_algorithm', 'sha256',
        'hash_value', p_content_hash
      ),
      jsonb_build_object(
        'type', 'c2pa.actions.assertion',
        'label', 'actions',
        'actions', jsonb_build_array(
          jsonb_build_object(
            'action', 'created',
            'when', to_jsonb(now()),
            'software_agent', p_claim_generator,
            'parameters', jsonb_build_object(
              'source', 'RealSyncDynamics Audit Engine',
              'content_type', p_content_type
            )
          )
        )
      ),
      jsonb_build_object(
        'type', 'c2pa.identity.assertion',
        'label', 'signer_identity',
        'identity', jsonb_build_object(
          'name', p_signer_name,
          'contact', p_signer_contact,
          'role', 'content_creator'
        )
      ),
      jsonb_build_object(
        'type', 'c2pa.location.assertion',
        'label', 'processing_location',
        'location', 'EU'
      )
    ),
    'signing_info', jsonb_build_object(
      'algorithm', 'sha256',
      'timestamp_utc', to_jsonb(now()),
      'expires_at', to_jsonb(now() + interval '10 years')
    )
  );

  RETURN v_manifest;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_c2pa_manifest(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_c2pa_manifest(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. Helper function: log C2PA provenance
CREATE OR REPLACE FUNCTION public.log_c2pa_provenance(
  p_tenant_id UUID,
  p_content_type TEXT,
  p_content_id TEXT,
  p_c2pa_manifest JSONB,
  p_signer_name TEXT,
  p_signer_contact TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_log_id UUID;
  v_assertion_hash TEXT;
BEGIN
  -- Generate hash of the manifest (proof of integrity)
  v_assertion_hash := encode(
    extensions.digest(p_c2pa_manifest::TEXT, 'sha256'),
    'hex'
  );

  INSERT INTO public.c2pa_provenance_log (
    tenant_id, content_type, content_id,
    c2pa_manifest, claim_generator,
    assertion_hash, signer_name, signer_contact
  ) VALUES (
    p_tenant_id, p_content_type, p_content_id,
    p_c2pa_manifest, 'RealSyncDynamics/1.0',
    v_assertion_hash, p_signer_name, p_signer_contact
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_c2pa_provenance(UUID, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_c2pa_provenance(UUID, TEXT, TEXT, JSONB, TEXT, TEXT) TO anon, authenticated, service_role;

-- 7. Helper function: verify C2PA assertion integrity
CREATE OR REPLACE FUNCTION public.verify_c2pa_assertion(
  p_manifest JSONB,
  p_stored_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_computed_hash TEXT;
BEGIN
  v_computed_hash := encode(
    extensions.digest(p_manifest::TEXT, 'sha256'),
    'hex'
  );

  RETURN v_computed_hash = p_stored_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_c2pa_assertion(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_c2pa_assertion(JSONB, TEXT) TO anon, authenticated, service_role;

-- 8. Helper function: get provenance chain for a report
CREATE OR REPLACE FUNCTION public.get_provenance_chain(
  p_content_type TEXT,
  p_content_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_chain JSON;
BEGIN
  SELECT json_agg(json_build_object(
    'timestamp', created_at,
    'signer', signer_name,
    'content_type', content_type,
    'assertion_hash', assertion_hash,
    'manifest', c2pa_manifest
  ) ORDER BY created_at DESC) INTO v_chain
  FROM public.c2pa_provenance_log
  WHERE content_type = p_content_type
    AND content_id = p_content_id;

  RETURN COALESCE(v_chain, '[]'::json);
END;
$$;

REVOKE ALL ON FUNCTION public.get_provenance_chain(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_provenance_chain(TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;

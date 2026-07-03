-- Add signing_keys table for cryptographic provenance verification
-- Stores Ed25519 public keys and HMAC secrets per organization
-- Private keys are stored only in secure vault, never in database

CREATE TABLE signing_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Key metadata
  algorithm TEXT NOT NULL CHECK (algorithm IN ('ed25519', 'hmac-sha256')),
  public_key_or_secret TEXT NOT NULL, -- Base64-encoded public key (ed25519) or secret (hmac)
  issuer TEXT NOT NULL, -- Organization identifier

  -- Lifecycle
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rotated_from_id UUID REFERENCES signing_keys(id),

  -- Audit trail
  created_by UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ,

  CONSTRAINT valid_key_lifecycle CHECK (
    created_at <= COALESCE(expires_at, now() + interval '10 years')
  )
);

-- Indices for performance
CREATE INDEX idx_signing_keys_tenant_id ON signing_keys(tenant_id);
CREATE INDEX idx_signing_keys_tenant_active ON signing_keys(tenant_id, is_active);
CREATE INDEX idx_signing_keys_expires_at ON signing_keys(expires_at);

-- RLS: Tenants can only access their own signing keys
ALTER TABLE signing_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their signing keys"
  ON signing_keys FOR SELECT
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE id = auth.jwt() -> 'tenant_id')
  );

CREATE POLICY "Tenants can create signing keys"
  ON signing_keys FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE id = auth.jwt() -> 'tenant_id')
  );

CREATE POLICY "Tenants can update their signing keys"
  ON signing_keys FOR UPDATE
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE id = auth.jwt() -> 'tenant_id')
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE id = auth.jwt() -> 'tenant_id')
  );

-- Comment for documentation
COMMENT ON TABLE signing_keys IS 'Cryptographic signing keys for provenance verification. Public keys only; private keys in secure vault.';
COMMENT ON COLUMN signing_keys.algorithm IS 'Signing algorithm: ed25519 (asymmetric) or hmac-sha256 (symmetric)';
COMMENT ON COLUMN signing_keys.public_key_or_secret IS 'For ed25519: Base64-encoded public key. For hmac-sha256: shared secret.';
COMMENT ON COLUMN signing_keys.is_active IS 'If FALSE, key is rotated out but kept for backward compatibility';
COMMENT ON COLUMN signing_keys.rotated_from_id IS 'Reference to previous key when rotating';

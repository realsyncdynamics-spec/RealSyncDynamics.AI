-- Enterprise Plus Sprint A (observe-mode): vereinheitlichte MFA-Erzwingungsspalte.
-- Additiv, ohne bestehende RLS-Policies oder AAL2-Hard-Enforcement zu ändern.

ALTER TABLE public.tenant_security_settings
  ADD COLUMN IF NOT EXISTS mfa_enforced BOOLEAN NOT NULL DEFAULT false;

-- Bestehende Konfiguration übernehmen (falls legacy enforce_mfa_all gesetzt ist).
UPDATE public.tenant_security_settings
SET mfa_enforced = COALESCE(enforce_mfa_all, false)
WHERE mfa_enforced IS DISTINCT FROM COALESCE(enforce_mfa_all, false);

COMMENT ON COLUMN public.tenant_security_settings.mfa_enforced IS
  'Observe-Mode MFA-Erzwingung je Tenant (UI/Policy-Vorbereitung, ohne AAL2-RLS-Hardlock).';

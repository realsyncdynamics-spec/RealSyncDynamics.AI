-- ============================================================
-- Integration-Credentials-Haertung (Plan P0-1, Freigabe E8 vom 2026-08-24)
--
-- Befund S1 aus docs/architecture/governance-os-enforcement-plan.md:
-- integration_configs.credentials wurde als Klartext-JSONB aus dem Browser
-- geschrieben und war ueber die tenant_read-RLS-Policy fuer JEDES
-- Tenant-Mitglied lesbar (die View las mit select('*')).
--
-- Neues Modell:
--   * Zugangsdaten werden ausschliesslich von der Edge Function
--     `integration-credentials` (service_role) versiegelt in
--     credentials_enc geschrieben (AES-256-GCM, _shared/secretBox.ts).
--   * Clients sehen nur Metadaten — durchgesetzt per SPALTENRECHTEN,
--     nicht nur per Konvention: RLS ist zeilenbasiert und kann eine
--     einzelne Spalte nicht verbergen, deshalb Grants auf Spaltenebene.
--   * Client-INSERT entfaellt komplett: Der bisherige Browser-Insert war
--     ohnehin funktionslos (tenant_id NOT NULL wurde nie gesetzt).
--     UPDATE bleibt fuer Metadaten (name, enabled) erlaubt — das ist der
--     bestehende Aktivieren/Entfernen-Pfad der View.
--
-- DSGVO Art. 32 (Stand der Technik), Auftrag §5. Additiv: keine Spalte
-- wird entfernt; bestehende Zeilen (so vorhanden) bleiben unangetastet.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'integration_configs'
  ) THEN
    -- Versiegelte Zugangsdaten (Format v1:<iv>:<ciphertext>, secretBox.ts)
    ALTER TABLE public.integration_configs
      ADD COLUMN IF NOT EXISTS credentials_enc TEXT;

    -- Der Klartext-Pfad bekommt einen Default, damit die Edge Function die
    -- NOT-NULL-Spalte befuellen kann, ohne je Klartext hineinzulegen.
    ALTER TABLE public.integration_configs
      ALTER COLUMN credentials SET DEFAULT '{}'::jsonb;

    -- Spaltenrechte: Tabellen-Grants zuruecknehmen, dann nur Metadaten
    -- explizit wieder freigeben. service_role behaelt vollen Zugriff
    -- (bypasst weder Grants noch braucht es sie: eigene Rolle).
    REVOKE ALL ON public.integration_configs FROM anon;
    REVOKE SELECT, INSERT, UPDATE ON public.integration_configs FROM authenticated;
    GRANT SELECT (id, tenant_id, integration_id, name, enabled, created_at, updated_at)
      ON public.integration_configs TO authenticated;
    GRANT UPDATE (name, enabled)
      ON public.integration_configs TO authenticated;
  END IF;
END;
$$;

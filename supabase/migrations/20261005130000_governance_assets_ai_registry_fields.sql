-- KI-Register (Auftrag §14): Felder je KI-System auf governance_assets —
-- dem System of Record für /app/ai-systems (20260625200000). Bisher fehlten
-- Systemtyp, Modell, Betriebsmodell und Datenstandort; die Oberfläche las
-- metadata.model_name, das nichts schrieb.
--
--   ai_system_type    external_ai | local_ai | agent | bot | workflow | browser_agent
--   model_name        Modellbezeichnung (frei, 1–200 Zeichen)
--   deployment_model  vendor_cloud | own_cloud | on_premises | local_device
--   data_residency    eu | adequacy | third_country | unknown
--
-- Werte schreibt nur governance-resources (service_role, owner/admin);
-- Mitglieder haben keine Schreib-Policy auf governance_assets. Dieselben
-- Listen stehen in supabase/functions/governance-resources/registryFields.ts
-- und src/features/governance/ai-registry/registryModel.ts
-- (Parität: test/governance/ai-registry-parity.test.ts).
--
-- Additiv: neue, nullable Spalten und eine View; Bestandszeilen unverändert.

ALTER TABLE public.governance_assets
  ADD COLUMN IF NOT EXISTS ai_system_type   text,
  ADD COLUMN IF NOT EXISTS model_name       text,
  ADD COLUMN IF NOT EXISTS deployment_model text,
  ADD COLUMN IF NOT EXISTS data_residency   text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governance_assets_ai_system_type_check') THEN
    ALTER TABLE public.governance_assets ADD CONSTRAINT governance_assets_ai_system_type_check
      CHECK (ai_system_type IS NULL
             OR ai_system_type IN ('external_ai', 'local_ai', 'agent', 'bot', 'workflow', 'browser_agent'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governance_assets_deployment_model_check') THEN
    ALTER TABLE public.governance_assets ADD CONSTRAINT governance_assets_deployment_model_check
      CHECK (deployment_model IS NULL
             OR deployment_model IN ('vendor_cloud', 'own_cloud', 'on_premises', 'local_device'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governance_assets_data_residency_check') THEN
    ALTER TABLE public.governance_assets ADD CONSTRAINT governance_assets_data_residency_check
      CHECK (data_residency IS NULL
             OR data_residency IN ('eu', 'adequacy', 'third_country', 'unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'governance_assets_model_name_length_check') THEN
    ALTER TABLE public.governance_assets ADD CONSTRAINT governance_assets_model_name_length_check
      CHECK (model_name IS NULL OR char_length(model_name) BETWEEN 1 AND 200);
  END IF;
END $$;

COMMENT ON COLUMN public.governance_assets.ai_system_type IS
  'KI-Systemtyp (Auftrag §14): external_ai, local_ai, agent, bot, workflow, browser_agent. NULL = nicht angegeben.';
COMMENT ON COLUMN public.governance_assets.model_name IS
  'Modellbezeichnung, wie vom Mandanten angegeben (z. B. gpt-4.1, granite4.2:8b).';
COMMENT ON COLUMN public.governance_assets.deployment_model IS
  'Betrieb: vendor_cloud (Anbieter-Cloud/SaaS), own_cloud (eigene Cloud-Instanz), on_premises, local_device.';
COMMENT ON COLUMN public.governance_assets.data_residency IS
  'Datenstandort: eu (EU/EWR), adequacy (Drittland mit Angemessenheitsbeschluss, Art. 45 DSGVO), third_country, unknown.';

-- Nachweise je Asset (Anzahl, jüngster Zeitpunkt) für die Register-Ampel.
-- security_invoker: es gilt die Lese-Policy von governance_evidence für den
-- Aufrufer (Mitglieder sehen nur ihren Mandanten) — siehe Gate 0
-- (20260927150000, Invariante in gate0-views-security-invoker.db.test.ts).
CREATE OR REPLACE VIEW public.governance_asset_evidence_stats
WITH (security_invoker = true) AS
SELECT e.tenant_id,
       e.asset_id,
       count(*)::integer  AS evidence_count,
       max(e.created_at)  AS latest_evidence_at
  FROM public.governance_evidence e
 WHERE e.asset_id IS NOT NULL
 GROUP BY e.tenant_id, e.asset_id;

COMMENT ON VIEW public.governance_asset_evidence_stats IS
  'Nachweise je governance_asset (Anzahl, jüngster). security_invoker: RLS von governance_evidence gilt.';

REVOKE ALL ON public.governance_asset_evidence_stats FROM PUBLIC, anon;
GRANT SELECT ON public.governance_asset_evidence_stats TO authenticated, service_role;

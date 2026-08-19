-- Firmenprofil aus dem Registrierungs-Onboarding.
--
-- ## Warum diese Tabelle jetzt entsteht
--
-- `supabase/functions/save-company-profile/index.ts` schreibt seit ihrer
-- Entstehung nach `public.company_profiles`. Die Tabelle gab es nie — weder im
-- Live-Schema noch als Migration im Repo (am 2026-08-19 gegen
-- `information_schema.tables` geprüft, nicht aus der Migrationsliste
-- geschlossen).
--
-- Aufgefallen ist das nicht, weil die Function nie deployt war. Wäre sie es
-- gewesen, hätte sie den Fehlschlag des Inserts abgefangen und trotzdem
-- `success: true` zurückgegeben — die Angaben des Nutzers wären
-- verschwunden, während die Oberfläche „Einrichtung abgeschlossen" zeigt.
-- Genau das ist der Grund, warum diese Migration vor dem Deploy kommt und
-- nicht danach.
--
-- ## Form
--
-- Ein Profil je Mandant (`UNIQUE (tenant_id)`) — die Function macht
-- „vorhanden? dann UPDATE, sonst INSERT" und wäre bei mehreren Zeilen je
-- Mandant nicht deterministisch.
--
-- `onboarding_answers` bleibt bewusst `jsonb` ohne Schema: Die Fragen in
-- `src/unified-entry/pages/PostRegisterOnboardingPage.tsx` sind Produktinhalt
-- und ändern sich schneller als eine Spaltenliste. Der Wertebereich von
-- `sector` dagegen ist geprüft — er steuert die Policy-Pack-Empfehlung und
-- darf nicht driften.

CREATE TABLE IF NOT EXISTS public.company_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sector              TEXT NOT NULL,
  onboarding_answers  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_profiles_tenant_key UNIQUE (tenant_id),
  -- Spiegel von VALID_SECTORS in supabase/functions/save-company-profile und
  -- SECTORS in src/unified-entry/pages/PostRegisterOnboardingPage.tsx.
  -- Alle drei Ebenen müssen denselben Wertebereich führen.
  CONSTRAINT company_profiles_sector_check CHECK (
    sector IN ('saas', 'agency', 'healthcare', 'public_sector', 'generic')
  )
);

COMMENT ON TABLE public.company_profiles IS
  'Branche und Onboarding-Antworten je Mandant. Geschrieben von der Edge '
  'Function save-company-profile (service_role); gelesen von der SPA über RLS.';

CREATE INDEX IF NOT EXISTS idx_company_profiles_tenant
  ON public.company_profiles (tenant_id);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

-- Lesen darf jedes Mitglied des Mandanten: Das Profil beschreibt den
-- Arbeitsbereich, nicht eine einzelne Person.
DROP POLICY IF EXISTS "company_profiles_tenant_read" ON public.company_profiles;
CREATE POLICY "company_profiles_tenant_read"
  ON public.company_profiles FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()));

-- Schreiben nur owner/admin. Die Branche steuert die Policy-Empfehlung; sie
-- still umzustellen wäre eine Governance-Änderung ohne Vier-Augen-Prinzip.
DROP POLICY IF EXISTS "company_profiles_tenant_write" ON public.company_profiles;
CREATE POLICY "company_profiles_tenant_write"
  ON public.company_profiles FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS "company_profiles_tenant_update" ON public.company_profiles;
CREATE POLICY "company_profiles_tenant_update"
  ON public.company_profiles FOR UPDATE TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ))
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Die Edge Function läuft mit service_role und umgeht RLS ohnehin; die Policy
-- steht trotzdem da, damit die Rechte an der Tabelle vollständig ablesbar sind
-- und nicht aus dem Fehlen einer Regel geschlossen werden müssen.
DROP POLICY IF EXISTS "company_profiles_service_write" ON public.company_profiles;
CREATE POLICY "company_profiles_service_write"
  ON public.company_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

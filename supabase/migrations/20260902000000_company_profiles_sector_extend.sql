-- Branchen-Wertebereich von company_profiles um die Unternehmenstypen der
-- Onboarding-Erklaerung (/onboarding-erklaert) erweitern.
--
-- Warum: Die Seite nennt Kleinunternehmen, Handel, Moebelhaus, Produktion,
-- Dienstleister, Agentur und Industrie als waehlbare Typen. Der Flow kannte
-- bisher nur saas, agency, healthcare, public_sector und generic — Marketing
-- und Produkt sagten damit Unterschiedliches.
--
-- ADDITIV, ausdruecklich: Die neue Liste ist eine echte OBERMENGE der alten.
-- saas, healthcare und public_sector bleiben gueltig und waehlbar. Sie zu
-- streichen haette zwei Schaeden: Bestandszeilen in company_profiles wuerden
-- den Constraint verletzen (ALTER TABLE ... ADD CONSTRAINT validiert
-- bestehende Zeilen und schluege fehl), und die Hochstufung regulierter
-- Branchen auf Enterprise in src/core/onboarding/recommendationEngine.ts
-- liefe ins Leere.
--
-- Diese Liste ist der Spiegel von:
--   - SECTORS in src/config/sectors.ts (Quelle fuers Frontend)
--   - VALID_SECTORS in supabase/functions/save-company-profile/index.ts
-- Alle drei Ebenen muessen denselben Wertebereich fuehren; durchgesetzt von
-- test/config/sectors-parity.test.ts.

ALTER TABLE public.company_profiles
  DROP CONSTRAINT IF EXISTS company_profiles_sector_check;

ALTER TABLE public.company_profiles
  ADD CONSTRAINT company_profiles_sector_check CHECK (
    sector IN (
      'small_business',
      'retail',
      'furniture_retail',
      'manufacturing',
      'services',
      'agency',
      'industrial',
      'saas',
      'healthcare',
      'public_sector',
      'generic'
    )
  );

COMMENT ON CONSTRAINT company_profiles_sector_check ON public.company_profiles IS
  'Wertebereich der Branche. Spiegel von src/config/sectors.ts und VALID_SECTORS '
  'in save-company-profile. Werte ergaenzen, nie entfernen — Bestandsmandanten '
  'tragen die alten IDs.';

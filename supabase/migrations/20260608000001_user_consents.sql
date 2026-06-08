-- user_consents: DSGVO-konformes Consent-Protokoll für anonymisierte Plattform-Analyse.
--
-- consent_type: 'platform_improvement_analytics'
--   Nutzer stimmt zu, dass anonymisierte + aggregierte Scan-Ergebnisse zur
--   Verbesserung der Plattform, Risikoanalyse und Branchen-Benchmarks genutzt werden.
--   Keine personenbezogenen Daten fließen in Benchmarks ein.
--   Trial funktioniert auch ohne diese Zustimmung.
--   Consent ist jederzeit widerrufbar (revoked_at setzen).

CREATE TABLE IF NOT EXISTS public.user_consents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_id        uuid        NULL,
  scan_result_id   uuid        NULL,
  consent_type     text        NOT NULL,
  consent_version  text        NOT NULL DEFAULT '1.0',
  granted          boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz NULL
);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_consents" ON public.user_consents
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "service_role_all" ON public.user_consents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS user_consents_user_type_idx
  ON public.user_consents(user_id, consent_type);

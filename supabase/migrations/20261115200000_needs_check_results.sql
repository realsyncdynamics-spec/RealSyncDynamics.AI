-- Bedarfs-Check: gespeicherte Ergebnisse angemeldeter Nutzer.
--
-- Der Check unter /check wertet nur Angaben des Nutzers aus (Ziel,
-- Anwendungsbereich, Website ja/nein). Empfehlungen werden im Client aus
-- diesen Angaben abgeleitet; gespeichert werden nur die Angaben und die IDs
-- der Empfehlungen — kein Freitext, keine personenbezogenen Daten außer der
-- optionalen Website-Adresse.
--
-- Zugriff: ausschließlich der eigene Nutzer (auth.uid()). Kein Mandanten-
-- bezug, darum keine Mandantenrechte nötig; das ist strenger als eine
-- Mandantenfreigabe. anon hat keinen Zugriff.
--
-- Validierung serverseitig über CHECK-Constraints; ein Trigger begrenzt die
-- Anzahl gespeicherter Ergebnisse je Nutzer und Tag.

CREATE TABLE IF NOT EXISTS public.needs_check_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal                text NOT NULL,
  area                text NOT NULL,
  has_website         boolean NOT NULL,
  website_url         text NULL,
  recommendation_ids  text[] NOT NULL,
  audit_id            uuid NULL,
  result_basis        text NOT NULL DEFAULT 'answers',
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT needs_check_goal_chk CHECK (goal IN ('website', 'inquiries', 'rules', 'unsure')),
  CONSTRAINT needs_check_area_chk CHECK (area IN ('handwerk', 'praxis', 'kanzlei', 'handel', 'dienstleistung', 'agentur', 'sonstiges')),
  CONSTRAINT needs_check_url_chk CHECK (
    website_url IS NULL
    OR (has_website AND char_length(website_url) <= 300 AND website_url ~ '^https?://[^\s/]+\.[^\s]+$')
  ),
  CONSTRAINT needs_check_recs_chk CHECK (
    cardinality(recommendation_ids) BETWEEN 1 AND 4
    AND recommendation_ids <@ ARRAY[
      'build.new_site', 'build.modernize', 'automate.chat', 'govern.website_scan', 'govern.runtime'
    ]::text[]
  ),
  CONSTRAINT needs_check_basis_chk CHECK (result_basis IN ('answers', 'answers_and_scan')),
  CONSTRAINT needs_check_scan_chk CHECK ((result_basis = 'answers_and_scan') = (audit_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS needs_check_results_user_created_idx
  ON public.needs_check_results (user_id, created_at DESC);

ALTER TABLE public.needs_check_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.needs_check_results FROM anon;
REVOKE ALL ON public.needs_check_results FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.needs_check_results TO authenticated;
GRANT ALL ON public.needs_check_results TO service_role;

DROP POLICY IF EXISTS needs_check_select_own ON public.needs_check_results;
CREATE POLICY needs_check_select_own ON public.needs_check_results
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS needs_check_insert_own ON public.needs_check_results;
CREATE POLICY needs_check_insert_own ON public.needs_check_results
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS needs_check_delete_own ON public.needs_check_results;
CREATE POLICY needs_check_delete_own ON public.needs_check_results
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- Kein UPDATE: ein gespeichertes Ergebnis bleibt, wie es war.

-- Höchstens 20 gespeicherte Ergebnisse je Nutzer und 24 Stunden.
CREATE OR REPLACE FUNCTION public.needs_check_results_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recent integer;
BEGIN
  SELECT count(*) INTO recent
  FROM public.needs_check_results
  WHERE user_id = NEW.user_id
    AND created_at > now() - interval '24 hours';
  IF recent >= 20 THEN
    RAISE EXCEPTION 'needs_check_rate_limited' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.needs_check_results_rate_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS needs_check_results_rate_limit_trg ON public.needs_check_results;
CREATE TRIGGER needs_check_results_rate_limit_trg
  BEFORE INSERT ON public.needs_check_results
  FOR EACH ROW EXECUTE FUNCTION public.needs_check_results_rate_limit();

COMMENT ON TABLE public.needs_check_results IS
  'Bedarfs-Check (/check): Angaben und Empfehlungs-IDs je Nutzer. RLS: nur eigene Zeilen. Kein UPDATE.';

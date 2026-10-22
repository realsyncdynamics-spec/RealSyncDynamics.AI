-- WP-4 — Beta-Feedback aus dem Dashboard (docs/claude/BETA_V5_WORKPLAN.md).
--
-- ── Zweck ──────────────────────────────────────────────────────────────────
--
-- Der Feedback-Weg in der Beta führte bisher auf das allgemeine Kontaktformular
-- (`/kontakt?topic=beta-feedback`): ohne Mandant, ohne Route, ohne Nutzer —
-- für die Triage unbrauchbar. Diese Migration legt den Nachweis an, den der
-- Feedback-Button in der App-Shell schreibt:
--
--   beta_feedback(tenant_id, user_id, route, text, created_at)
--
-- ── Zugriff ────────────────────────────────────────────────────────────────
--
-- Schreiben: angemeldete Mitglieder des Mandanten (`is_tenant_member`), nur
-- unter eigener `user_id` und nur für den Mandanten, dem sie angehören. Kein
-- Edge-Function-Umweg nötig: RLS trägt beide Bedingungen (WITH CHECK).
--
-- Lesen (Mandant): eigene Einträge des Mandanten — der Tester sieht, was er
-- gemeldet hat. Lesen (Team): `admin_beta_feedback()` für Plattform-Operatoren
-- (`is_platform_operator()`, 20261003060000) — SECURITY DEFINER, prüft die
-- Rolle in der Datenbank, nicht im Browser.
--
-- Ändern/Löschen: niemand ausser service_role (Art.-17-Pfad folgt dem
-- Nutzer-Löschpfad, nicht dieser Migration).
--
-- Additiv: eine neue, leere Tabelle und eine neue Funktion. Keine Änderung
-- an bestehenden Objekten.

BEGIN;

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,                      -- ohne FK: Nachweis überdauert Art.-17-Löschung
  route       text NOT NULL
                CHECK (route ~ '^/' AND length(route) <= 512),
  text        text NOT NULL
                CHECK (length(btrim(text)) >= 3 AND length(text) <= 4000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.beta_feedback IS
  'Beta-Feedback aus der App-Shell (WP-4): Mandant, Nutzer, Route, Text. Schreiben per RLS (Mitglied, eigene user_id); Team liest über admin_beta_feedback().';

CREATE INDEX IF NOT EXISTS idx_beta_feedback_tenant_created
  ON public.beta_feedback (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_created
  ON public.beta_feedback (created_at DESC);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beta_feedback_member_insert" ON public.beta_feedback;
CREATE POLICY "beta_feedback_member_insert" ON public.beta_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS "beta_feedback_tenant_read" ON public.beta_feedback;
CREATE POLICY "beta_feedback_tenant_read" ON public.beta_feedback
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "beta_feedback_service" ON public.beta_feedback;
CREATE POLICY "beta_feedback_service" ON public.beta_feedback
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.beta_feedback FROM anon, authenticated;
GRANT SELECT, INSERT ON public.beta_feedback TO authenticated;
GRANT ALL ON public.beta_feedback TO service_role;

-- ── Team-Ansicht ───────────────────────────────────────────────────────────
--
-- Liefert die jüngsten Einträge mandantenübergreifend, angereichert um
-- Mandantenname und E-Mail des Melders (aus auth.users — deshalb SECURITY
-- DEFINER). Die Rolle wird hier geprüft; ohne sie: Fehler, keine Zeilen.

CREATE OR REPLACE FUNCTION public.admin_beta_feedback(
  p_limit integer DEFAULT 200,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  tenant_id   uuid,
  tenant_name text,
  user_id     uuid,
  user_email  text,
  route       text,
  text        text,
  created_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT f.id,
           f.tenant_id,
           t.name AS tenant_name,
           f.user_id,
           u.email::text AS user_email,
           f.route,
           f.text,
           f.created_at
      FROM public.beta_feedback f
      LEFT JOIN public.tenants t ON t.id = f.tenant_id
      LEFT JOIN auth.users u ON u.id = f.user_id
     WHERE p_tenant_id IS NULL OR f.tenant_id = p_tenant_id
     ORDER BY f.created_at DESC
     LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 1000);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_beta_feedback(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_beta_feedback(integer, uuid) TO authenticated, service_role;

COMMIT;

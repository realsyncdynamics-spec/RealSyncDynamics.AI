-- WP-4 — Beta-Feedback aus der App (docs/claude/BETA_V5_WORKPLAN.md).
--
-- ── Zweck ──────────────────────────────────────────────────────────────────
--
-- Bisher führte „Feedback geben“ auf /kontakt?topic=beta-feedback: Mandant,
-- Nutzer und Seite gingen verloren. `beta_feedback` speichert die Rückmeldung
-- direkt aus der App, mit Mandant, Nutzer und Route. Das Team liest sie unter
-- /admin/beta-feedback.
--
-- ── Zugriff ────────────────────────────────────────────────────────────────
--
-- Schreiben: angemeldete Mitglieder des Mandanten, nur als sie selbst
--   (`user_id = auth.uid()`, `is_tenant_member(tenant_id)`).
-- Lesen: die eigenen Einträge; alle Einträge nur für Plattform-Betreiber
--   (`is_platform_operator()`).
-- Ändern/Löschen: niemand außer `service_role`. Rückmeldungen sind ein
--   Nachweis dessen, was gesagt wurde.
--
-- `user_id` mit FK auf auth.users ON DELETE CASCADE: Löscht jemand sein Konto
-- (Art. 17 DSGVO), verschwinden auch seine Freitexte.
--
-- Additiv: eine neue, leere Tabelle. Keine Änderung an bestehenden Objekten.

BEGIN;

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  route       text NOT NULL CHECK (char_length(route) BETWEEN 1 AND 200 AND left(route, 1) = '/'),
  text        text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.beta_feedback IS
  'Beta-Feedback aus der App (WP-4). Schreiben: Mitglieder als sie selbst. Lesen: eigene Einträge, alle nur für Plattform-Betreiber.';

CREATE INDEX IF NOT EXISTS beta_feedback_created_at_idx
  ON public.beta_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS beta_feedback_tenant_idx
  ON public.beta_feedback (tenant_id, created_at DESC);

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beta_feedback_member_insert" ON public.beta_feedback;
CREATE POLICY "beta_feedback_member_insert" ON public.beta_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.is_tenant_member(tenant_id)
  );

DROP POLICY IF EXISTS "beta_feedback_read" ON public.beta_feedback;
CREATE POLICY "beta_feedback_read" ON public.beta_feedback
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_platform_operator()
  );

DROP POLICY IF EXISTS "beta_feedback_service" ON public.beta_feedback;
CREATE POLICY "beta_feedback_service" ON public.beta_feedback
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.beta_feedback FROM anon, authenticated;
GRANT SELECT, INSERT ON public.beta_feedback TO authenticated;
GRANT ALL ON public.beta_feedback TO service_role;

COMMIT;

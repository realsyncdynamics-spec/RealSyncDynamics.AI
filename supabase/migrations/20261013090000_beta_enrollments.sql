-- WP-3 — Offene Beta serverseitig (docs/claude/BETA_V5_WORKPLAN.md).
--
-- ── Zweck ──────────────────────────────────────────────────────────────────
--
-- Die Edge Function `beta-enroll` vergibt Beta-Mandanten den Growth-Umfang
-- über den bestehenden Entitlement-Pfad (`subscriptions`, status
-- 'trialing', `trial_end` = Beta-Ende). Diese Migration legt nur an, was dafür
-- fehlt:
--
--   1. `subscriptions.source` — woher ein Abo stammt ('beta'; NULL = wie
--      bisher Stripe/Trial/Free). Macht Beta-Abos abfragbar und den Aufruf
--      idempotent.
--   2. `beta_enrollments` — ein Nachweis je Mandant mit dem Zustand **vor**
--      der Beta (`previous_plan_key`, `previous_status`). Das ist der Rückweg
--      nach dem 31.01.2027 und die Grundlage für Erinnerungs-Mails.
--
-- Ablauf ohne Job: `tenant_entitlements_resolve()` zählt `trialing` nur,
-- solange `trial_end` in der Zukunft liegt (20260928160000). Nach dem
-- Beta-Ende fällt der Mandant auf seine freie Stufe zurück; Daten bleiben.
--
-- ── Zugriff ────────────────────────────────────────────────────────────────
--
-- Lesen: Mitglieder des Mandanten (`is_tenant_member`). Schreiben:
-- ausschließlich `service_role` (Edge Function `beta-enroll`).
--
-- Additiv: eine neue, leere Spalte und eine neue Tabelle. Keine Änderung an
-- bestehenden Zeilen, keine Änderung am Auflöser.

BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.subscriptions.source IS
  'Herkunft des Abos: ''beta'' = offene Beta (beta-enroll). NULL = Stripe, Trial oder Free wie bisher.';

CREATE TABLE IF NOT EXISTS public.beta_enrollments (
  tenant_id          uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enrolled_by        uuid,                -- ohne FK: Nachweis überdauert Art.-17-Löschung
  enrolled_at        timestamptz NOT NULL DEFAULT now(),
  plan_key           text NOT NULL,
  ends_at            timestamptz NOT NULL,
  source             text NOT NULL DEFAULT 'beta',
  previous_plan_key  text,
  previous_status    text
);

COMMENT ON TABLE public.beta_enrollments IS
  'Offene Beta (WP-3): ein Eintrag je Mandant mit Vorzustand des Abos. Schreiben nur service_role (beta-enroll).';

ALTER TABLE public.beta_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beta_enrollments_tenant_read" ON public.beta_enrollments;
CREATE POLICY "beta_enrollments_tenant_read" ON public.beta_enrollments
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "beta_enrollments_service" ON public.beta_enrollments;
CREATE POLICY "beta_enrollments_service" ON public.beta_enrollments
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.beta_enrollments FROM anon, authenticated;
GRANT SELECT ON public.beta_enrollments TO authenticated;
GRANT ALL ON public.beta_enrollments TO service_role;

COMMIT;

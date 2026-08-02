-- Nacherfassung von Schema-Objekten, die NUR in der Produktions-DB existieren.
--
-- Hintergrund (siehe DEBUG_ROOT_CAUSE_2026-08-02.md): Im Remote-Migrations-
-- Ledger stehen 12 Versionen, zu denen es keine Repo-Datei gibt. Sie blockieren
-- `supabase db push` vollstaendig ("Remote migration versions not found in local
-- migrations directory") und muessen vor der Reconciliation auf `reverted`
-- gesetzt werden. Ein reines Revert wuerde die zugehoerigen Objekte aber
-- dauerhaft aus dem Repo verlieren: ein frisches Environment oder ein
-- `supabase db reset` haette sie nicht.
--
-- Diese Migration faengt die tatsaechlich fehlenden Objekte ein, aus dem
-- Live-Zustand der Prod-DB ausgelesen. Sie ist rein additiv und idempotent.
--
-- Zuordnung der 12 Ledger-Waisen:
--   20260510                              → Repo-Datei existiert (20260510_ai_governance_core.sql) — nichts zu tun
--   20260628121531/121551/121603          → Duplikate von 20260628120000/120100/120200 — nichts zu tun
--   20260628193744/193759/193820          → dito, zweite Anwendung derselben drei — nichts zu tun
--   20260701121059 remove_duplicate_
--     auth_user_trigger                   → nichts zu tun: 20260501000000 legt
--                                           `on_auth_user_created` bereits mit
--                                           vorangestelltem DROP IF EXISTS an und
--                                           konvergiert damit auf denselben Zustand
--                                           (Prod hat genau diesen einen Trigger)
--   20260715105402 create_document_vault  → HIER erfasst (Abschnitt 1)
--   20260720124405 restrict_document_
--     vault_to_super_admin                → HIER erfasst (Abschnitt 1, RLS-Policy)
--   20260720123711 add_missing_tenants_
--     industry_column                     → HIER erfasst (Abschnitt 2)
--   20260720123325 perf_lint_fixes_rls_
--     initplan_dup_index_search_path      → BEWUSST NICHT erfasst, siehe Abschnitt 3
--
-- ────────────────────────────────────────────────────────────────────────────
-- 1. document_vault
-- ────────────────────────────────────────────────────────────────────────────
-- Zentrale Uebersicht hochgeladener/fotografierter Dokumente. Zugriff ist auf
-- Super-Admins und die service_role beschraenkt (kein Tenant-Scoping — die
-- Tabelle hat bewusst keine tenant_id).

CREATE TABLE IF NOT EXISTS public.document_vault (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_date     date        NOT NULL DEFAULT CURRENT_DATE,
  title             text        NOT NULL,
  category          text        NOT NULL,
  case_reference    text,
  description       text,
  storage_path      text,
  source_chat_note  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_vault IS
  'Zentrale Übersicht aller fotografierten/hochgeladenen Dokumente aus Chats mit Claude, sortiert nach Datum und Kategorie.';

DO $$ BEGIN
  ALTER TABLE public.document_vault
    ADD CONSTRAINT document_vault_category_check
    CHECK (category = ANY (ARRAY['dokument'::text, 'foto'::text, 'sonstiges'::text]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_document_vault_date     ON public.document_vault (captured_date DESC);
CREATE INDEX IF NOT EXISTS idx_document_vault_category ON public.document_vault (category);

ALTER TABLE public.document_vault ENABLE ROW LEVEL SECURITY;

-- Die Sub-Selects um auth.role()/auth.uid() sind Absicht (RLS-InitPlan-
-- Optimierung): so wertet Postgres sie einmal pro Query aus statt pro Zeile.
-- Genau diese Form steht auch in Produktion.
DROP POLICY IF EXISTS "owner full access" ON public.document_vault;
CREATE POLICY "owner full access"
  ON public.document_vault
  FOR ALL
  USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin = true
    )
  )
  WITH CHECK (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.is_super_admin = true
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 2. tenants.industry
-- ────────────────────────────────────────────────────────────────────────────
-- Branche des Tenants. Wird von der Policy-Pack-Auto-Empfehlung gelesen
-- (Tenant-Branche-Signaling). In Prod als nullable text ohne Default angelegt.
--
-- Anmerkung: 20260702130000_tenant_industry.sql im Repo deckt dasselbe Feld ab,
-- ist aber nie angewendet worden. Diese Erfassung ist der Sicherheitsgurt fuer
-- den Fall, dass die Reconciliation-Reihenfolge sie ueberspringt — beide sind
-- `ADD COLUMN IF NOT EXISTS` und stoeren einander nicht.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS industry text;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Bewusst NICHT erfasst: 20260720123325 (perf_lint_fixes)
-- ────────────────────────────────────────────────────────────────────────────
-- Diese Migration hat bestehende Objekte optimiert statt neue anzulegen:
-- RLS-InitPlan-Umschreibungen (auth.uid() → (SELECT auth.uid())), Entfernen
-- doppelter Indizes und Pinnen von search_path auf Funktionen. Aus dem
-- Zielzustand allein laesst sich nicht zuverlaessig rekonstruieren, welche
-- Objekte sie im Einzelnen angefasst hat — eine geratene Nachbildung waere
-- schlechter als eine ehrliche Luecke.
--
-- Auswirkung: rein Performance, keine Korrektheit. Ein aus dem Repo frisch
-- aufgebautes Environment ist funktional identisch, aber ohne diese
-- Optimierungen. Wer sie dort haben will, laesst den Supabase-Performance-
-- Advisor erneut laufen und committet das Ergebnis als eigene Migration.

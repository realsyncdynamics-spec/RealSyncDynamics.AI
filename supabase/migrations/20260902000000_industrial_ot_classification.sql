-- ═══════════════════════════════════════════════════════════════════════════
--  Policy Pack "Industrial OT" — EU-AI-Act-Indikatoren für industrielle KI
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Erweitert das bestehende AI-Act-Inventar (ai_systems), kein neues Modul.
-- Der Fragebogen (src/core/governance/policy-pack-industrial-ot.json) wird
-- deterministisch ausgewertet (src/core/governance/industrial-ot.ts); die
-- Engine setzt ausschließlich Indikatoren, nie die Einstufung selbst — das
-- höchste Ergebnis ist HIGH_RISK_CANDIDATE bzw. PROHIBITED_CHECK, beides
-- Prüfaufträge an Menschen (EU AI Act Art. 5, Art. 6, Anhang I/III).
--
-- EU-AI-Act-Bezug: Art. 18 (Aufbewahrung technischer Dokumentation) verlangt
-- einen unveränderlichen Nachweis der Bewertung — deshalb ist
-- industrial_assessment append-only und trägt den SHA-256 der kanonisch
-- serialisierten Antworten. DSGVO-Bezug: worker_monitoring dokumentiert die
-- Verarbeitung von Beschäftigtendaten (Art. 88 DSGVO, § 26 BDSG).

-- ─── 1. Ergebniszustände ─────────────────────────────────────────────────────
-- Vier Zustände; PROHIBITED_CHECK ist bewusst von HIGH_RISK_CANDIDATE
-- getrennt: eine nach Art. 5 verbotene Praktik (seit 02.02.2025 ohne
-- Übergangsfrist) darf nicht im Kandidaten-Status verschwinden.
-- Werteliste gespiegelt in src/core/governance/industrial-ot.ts (Outcome) —
-- Parität geprüft durch test/governance/industrial-ot-parity.test.ts.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ot_outcome') THEN
    CREATE TYPE ot_outcome AS ENUM (
      'MINIMAL',
      'TRANSPARENCY',
      'HIGH_RISK_CANDIDATE',
      'PROHIBITED_CHECK'
    );
  END IF;
END $$;

-- ─── 2. Industrielles KI-System ──────────────────────────────────────────────
-- Die Antwort-Spalten spiegeln die inputs des Pack-JSON; der Wertebereich ist
-- geprüft, weil er die Indikator-Prädikate steuert und nicht driften darf.
CREATE TABLE IF NOT EXISTS public.industrial_system (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ai_system_id      UUID REFERENCES public.ai_systems(id) ON DELETE SET NULL,

  site              TEXT NOT NULL,
  sector            TEXT NOT NULL,
  asset             TEXT NOT NULL,

  intervention      TEXT NOT NULL CHECK (intervention IN ('advisory', 'operator_confirm', 'closed_loop')),
  safety_function   TEXT NOT NULL CHECK (safety_function IN ('yes', 'no', 'unclear')),
  machinery_ce      TEXT NOT NULL CHECK (machinery_ce IN ('yes', 'no', 'unclear')),
  critical_infra    TEXT NOT NULL DEFAULT 'none'
                    CHECK (critical_infra IN ('none', 'strom', 'gas', 'waerme', 'wasser', 'verkehr', 'digitale_infrastruktur')),
  learning          TEXT CHECK (learning IN ('static', 'ml_offline_update', 'self_evolving_online')),
  worker_monitoring TEXT NOT NULL DEFAULT 'none'
                    CHECK (worker_monitoring IN ('none', 'performance', 'behaviour_safety', 'emotion')),
  human_interaction BOOLEAN NOT NULL DEFAULT false,
  generates_content BOOLEAN NOT NULL DEFAULT false,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industrial_system_tenant
  ON public.industrial_system (tenant_id);
CREATE INDEX IF NOT EXISTS idx_industrial_system_site
  ON public.industrial_system (tenant_id, site);

-- ─── 3. Bewertungsergebnis (append-only) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.industrial_assessment (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id             UUID NOT NULL REFERENCES public.industrial_system(id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  pack_id               TEXT NOT NULL DEFAULT 'industrial_ot',
  pack_version          TEXT NOT NULL,
  legal_basis_version   TEXT NOT NULL,

  answers               JSONB NOT NULL,
  answers_sha256        TEXT  NOT NULL,
  -- [{id, outcome, legal_basis, open_question, measures[]}]
  triggered_indicators  JSONB NOT NULL,
  outcome               ot_outcome NOT NULL,
  open_questions        INTEGER NOT NULL DEFAULT 0,

  evaluated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_by          UUID REFERENCES auth.users(id),
  evidence_id           UUID REFERENCES public.ai_evidence_events(id)
);

CREATE INDEX IF NOT EXISTS idx_industrial_assessment_system
  ON public.industrial_assessment (system_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_industrial_assessment_tenant
  ON public.industrial_assessment (tenant_id);

-- Append-only: Eine Bewertung ist ein Nachweis (Art. 18). Eine neue Bewertung
-- ist eine neue Zeile; die alte bleibt unverändert stehen.
CREATE OR REPLACE FUNCTION public.fn_industrial_assessment_immutable() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'industrial_assessment ist append-only (Nachweisintegrität)';
END $$;

DROP TRIGGER IF EXISTS trg_industrial_assessment_immutable ON public.industrial_assessment;
CREATE TRIGGER trg_industrial_assessment_immutable
  BEFORE UPDATE OR DELETE ON public.industrial_assessment
  FOR EACH ROW EXECUTE FUNCTION public.fn_industrial_assessment_immutable();

-- ─── 4. Maßnahmen-Tracking ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.industrial_measure (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id  UUID NOT NULL REFERENCES public.industrial_assessment(id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  indicator_id   TEXT NOT NULL,
  measure        TEXT NOT NULL,
  legal_basis    TEXT,
  due_date       DATE,
  owner_id       UUID REFERENCES auth.users(id),
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'waived')),
  waiver_reason  TEXT,
  closed_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_industrial_measure_tenant_status
  ON public.industrial_measure (tenant_id, status, due_date);

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
-- Zugriff nur für Mitglieder des Mandanten (is_tenant_member, wie überall im
-- Inventar). Die Unveränderlichkeit der Bewertungen erzwingt der Trigger aus
-- Abschnitt 3 zusätzlich — RLS regelt hier nur die Mandanten-Grenze.
ALTER TABLE public.industrial_system     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industrial_assessment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industrial_measure    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['industrial_system', 'industrial_assessment', 'industrial_measure'] LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS %1$s_tenant ON public.%1$I;
      CREATE POLICY %1$s_tenant ON public.%1$I
        FOR ALL TO authenticated
        USING (public.is_tenant_member(tenant_id))
        WITH CHECK (public.is_tenant_member(tenant_id));
    $f$, t);
  END LOOP;
END $$;

-- ─── 6. Kontingent-Gate ──────────────────────────────────────────────────────
-- Kein hartkodierter Plan-Name: Das Limit kommt aus dem kanonischen
-- Plan-Katalog (Quelle: shared/pricing.ts, Limit `industrialOtSystems`,
-- eingespielt durch 20260902000100_canonical_plan_catalog.sql). -1 bedeutet
-- unbegrenzt. Ohne aktives Abo gilt das Free-Kontingent; fehlt der
-- Katalog-Eintrag (Migrationsfenster), fällt das Gate auf 1 zurück statt zu
-- blockieren.
CREATE OR REPLACE FUNCTION public.fn_industrial_quota() RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_key TEXT;
  v_limit    INTEGER;
  v_count    INTEGER;
BEGIN
  v_plan_key := COALESCE(public.get_tenant_plan_key(NEW.tenant_id), 'free_audit');

  SELECT COALESCE((limits ->> 'industrialOtSystems')::integer, 1)
    INTO v_limit
    FROM public.plan_catalog
   WHERE plan_key = v_plan_key;

  v_limit := COALESCE(v_limit, 1);
  IF v_limit = -1 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.industrial_system
   WHERE tenant_id = NEW.tenant_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Kontingent erreicht: % industrielle KI-Systeme im Plan %. Upgrade erforderlich.', v_limit, v_plan_key
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

-- SECURITY DEFINER liest Katalog und Abo am RLS vorbei; direkt aufrufbar sein
-- muss die Funktion für Client-Rollen nicht — der Trigger läuft ohnehin.
REVOKE EXECUTE ON FUNCTION public.fn_industrial_quota() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_industrial_quota ON public.industrial_system;
CREATE TRIGGER trg_industrial_quota
  BEFORE INSERT ON public.industrial_system
  FOR EACH ROW EXECUTE FUNCTION public.fn_industrial_quota();

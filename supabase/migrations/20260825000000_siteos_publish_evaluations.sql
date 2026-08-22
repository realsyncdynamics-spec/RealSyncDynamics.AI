-- Migration: 20260825000000_siteos_publish_evaluations.sql
-- SiteOS Publish Gate — Persistenz der Evaluationen.
--
-- Additiv. Es werden keine bestehenden Tabellen, Policies oder Constraints
-- verändert.
--
-- Normative Grundlage: docs/architecture/target-architecture.md §7. Die
-- Regeln, die hier auf Datenbankebene abgesichert werden:
--
--   G1  Die Auswertung läuft serverseitig. Deshalb schreibt ausschliesslich
--       service_role; es gibt keine INSERT-Policy für Anwendungsrollen.
--   G4  `publishable` ist rein abgeleitet und wird nicht von Hand gesetzt.
--       Deshalb ist die Spalte GENERATED ALWAYS aus dem Vertrag — die
--       Datenbank rechnet sie nach, statt der Anwendung zu glauben.
--   G5  `evaluation_id` ist der Prüfpfad-Anker. Jede Publish-Aktion
--       referenziert genau eine Evaluation, deshalb ist er eindeutig.
--   G6  Eine Evaluation gilt für genau einen Artefakt-Hash. Er steht als
--       eigene Spalte, nicht nur im JSON, damit die Bindung indizierbar und
--       prüfbar ist.
--
-- Append-only: Eine Evaluation ist ein Nachweis darüber, was zu einem
-- Zeitpunkt galt. Wäre sie änderbar, liesse sich nachträglich behaupten, eine
-- Veröffentlichung sei getragen gewesen. Es gibt deshalb weder UPDATE- noch
-- DELETE-Policy für Anwendungsrollen.

CREATE TABLE IF NOT EXISTS public.siteos_publish_evaluations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Prüfpfad-Anker (G5). Von der Edge Function vergeben, hier eindeutig.
  evaluation_id       TEXT NOT NULL,

  -- Artefakt, für das diese Evaluation gilt (G6). Ändert sich das Artefakt,
  -- verfällt die Evaluation — geprüft wird das in mayPublish().
  artifact_sha256     TEXT NOT NULL,

  -- Optionaler Bezug auf die Blueprint-Version, aus der das Artefakt entstand.
  blueprint_id        UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,

  -- Der vollständige Vertrag, so wie ihn packages/siteos-core erzeugt hat.
  -- Vollständig statt feldweise: Die Evaluation soll später exakt so gelesen
  -- werden können, wie sie entstanden ist, auch wenn der Vertrag um Felder
  -- wächst.
  contract            JSONB NOT NULL,

  -- Spiegelspalten für Abfragen. Sie stammen AUS dem Vertrag und werden von
  -- der Datenbank abgeleitet, nicht von der Anwendung geschrieben (G4).
  status              TEXT GENERATED ALWAYS AS (contract ->> 'status') STORED,
  publishable         BOOLEAN GENERATED ALWAYS AS ((contract ->> 'publishable')::BOOLEAN) STORED,
  evaluated_at        TIMESTAMPTZ GENERATED ALWAYS AS ((contract ->> 'evaluated_at')::TIMESTAMPTZ) STORED,

  -- Wer die Auswertung ausgelöst hat. Nicht wer sie entschieden hat — das tut
  -- niemand, sie ist abgeleitet.
  requested_by        UUID,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT siteos_publish_evaluations_evaluation_id_key UNIQUE (evaluation_id),
  CONSTRAINT siteos_publish_evaluations_status_valid
    CHECK (contract ->> 'status' IN ('passed', 'blocked', 'pending')),
  CONSTRAINT siteos_publish_evaluations_artifact_present
    CHECK (length(artifact_sha256) > 0),
  -- Die Bindung an das Artefakt muss auch im Vertrag stehen, sonst könnten
  -- Spalte und Nachweis auseinanderlaufen.
  CONSTRAINT siteos_publish_evaluations_artifact_matches_contract
    CHECK (contract ->> 'artifact_sha256' = artifact_sha256)
);

COMMENT ON TABLE public.siteos_publish_evaluations IS
  'Serverseitige Auswertungen des SiteOS Publish Gate (target-architecture.md §7). Append-only; Schreiben nur über Edge Functions (service_role). publishable ist abgeleitet, nicht gesetzt.';

CREATE INDEX IF NOT EXISTS siteos_publish_evaluations_tenant_created_idx
  ON public.siteos_publish_evaluations (tenant_id, created_at DESC);

-- Der Zugriffspfad vor einer Veröffentlichung: "gibt es für dieses Artefakt
-- eine tragende Evaluation?"
CREATE INDEX IF NOT EXISTS siteos_publish_evaluations_artifact_idx
  ON public.siteos_publish_evaluations (tenant_id, artifact_sha256, created_at DESC);

ALTER TABLE public.siteos_publish_evaluations ENABLE ROW LEVEL SECURITY;

-- Lesen für Mitglieder des Mandanten. Eine Evaluation ist der Nachweis
-- gegenüber dem eigenen Mandanten; sie gehört ihm, nicht der Plattform.
DROP POLICY IF EXISTS siteos_publish_evaluations_select ON public.siteos_publish_evaluations;
CREATE POLICY siteos_publish_evaluations_select
  ON public.siteos_publish_evaluations
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- Kein INSERT, kein UPDATE, kein DELETE für authenticated. Das ist keine
-- Lücke, sondern G1: Würde der Client schreiben dürfen, wäre die Evaluation
-- kein Nachweis, sondern eine Behauptung.

-- ─────────────────────────────────────────────────────────────────────────
--  Freigaben an ein Artefakt binden
-- ─────────────────────────────────────────────────────────────────────────
--
-- G4 verlangt, dass die Ausnahme ein Approval ist — eine Person mit
-- Begründung — und nie ein Flag. G6 verlangt, dass eine Bewertung für genau
-- ein Artefakt gilt. Beides zusammen heisst: Auch die Freigabe muss an ein
-- Artefakt gebunden sein. Sonst trüge eine Freigabe, die für einen Build
-- erteilt wurde, einen anderen — derselbe Fehler wie bei einer veralteten
-- Evaluation, nur mit Unterschrift.
--
-- `governance_approvals` bindet heute an `asset_id` und `event_id`. Ein
-- Artefakt ist keines von beidem: Es ist eine konkrete, gehashte Fassung.
-- Deshalb hier ein additiver, nullbarer `subject_ref` im selben Format, das
-- `evidence_snapshots` bereits benutzt — bestehende Zeilen und Policies
-- bleiben unberührt.
ALTER TABLE public.governance_approvals
  ADD COLUMN IF NOT EXISTS subject_ref TEXT;

COMMENT ON COLUMN public.governance_approvals.subject_ref IS
  'Optionaler Bezug auf ein konkretes Subjekt im Format <domäne>:<typ>:<kennung>, z.B. siteos:artifact:<sha256>. Bindet eine Freigabe an genau eine Fassung (target-architecture.md §7, G4/G6).';

CREATE INDEX IF NOT EXISTS governance_approvals_subject_ref_idx
  ON public.governance_approvals (tenant_id, subject_ref)
  WHERE subject_ref IS NOT NULL;

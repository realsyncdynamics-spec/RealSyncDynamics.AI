-- SiteOS Publish Gate — Persistenz der Freigabebewertung (Contract §7).
--
-- BEFUND
-- Heute trägt `siteos_blueprints.status = 'approved'` die Freigabe. Das ist
-- ein Feld, das jemand setzt — und damit genau das, was Contract §7 G4
-- ausschliesst: „Es gibt kein manuelles Ueberschreiben. Eine Ausnahme ist
-- immer ein Approval, nie ein Flag."
--
-- ANSATZ
-- Die Bewertung wird als eigener, unveraenderlicher Datensatz geschrieben.
-- `publishable` ist dabei **keine Spalte, die jemand setzen kann**, sondern
-- eine generierte Spalte: Die Datenbank leitet sie aus denselben fuenf
-- Bedingungen ab wie `evaluatePublishGate` im Kern. Ein UPDATE, das die
-- Veroeffentlichung erzwingen will, hat damit keine Angriffsflaeche mehr —
-- es muesste die Bedingungen selbst faelschen, und die stehen einzeln im
-- Pruefpfad.
--
-- G5: Die Zeilen-ID ist der Anker. Jede Publish-Aktion referenziert genau
--     eine Evaluation.
-- G6: `artifact_sha256` bindet die Bewertung an ein Artefakt. Ein neues
--     Buendel braucht eine neue Bewertung; die alte bleibt als Beleg stehen.
--
-- WAS DIESE MIGRATION NICHT TUT
-- Sie schaltet keinen Publish-Pfad frei. Deployment (`cloudflare-deployer`)
-- und Domain (`website-domain-manager`) liegen im Repo, sind aber nicht
-- deployt; ohne sie gibt es nichts zu veroeffentlichen. Das Gate steht
-- damit bewusst **vor** dem ersten Publish-Pfad — so verlangt es die
-- Zielarchitektur, und nur so lässt es sich nicht nachtraeglich umgehen.

BEGIN;

CREATE TABLE IF NOT EXISTS public.siteos_publish_evaluations (
  -- Zugleich die `evaluation_id` des Contracts (G5).
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  blueprint_id            UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,

  -- Gegenstand der Bewertung (G6). Das Artefakt ist das Buendel, das
  -- ausgeliefert wuerde — nicht der Blueprint: Zwei Blueprints koennen
  -- dasselbe HTML erzeugen, und veroeffentlicht wird das HTML.
  artifact_sha256         TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  blueprint_sha256        TEXT NOT NULL CHECK (blueprint_sha256 ~ '^[0-9a-f]{64}$'),

  status                  TEXT NOT NULL CHECK (status IN ('passed', 'blocked', 'pending')),
  evidence_complete       BOOLEAN NOT NULL,
  backend_preservation    TEXT NOT NULL CHECK (backend_preservation IN ('preserve_all', 'changed', 'unknown')),
  policy_compliant        BOOLEAN NOT NULL,
  human_approval_required BOOLEAN NOT NULL,

  -- Die Ableitungsregel aus §7, wörtlich — und in der Datenbank erzwungen.
  -- Ohne GENERATED waere `publishable` eine gewoehnliche Spalte, und jeder
  -- Schreibpfad mit service_role koennte sie unabhaengig von den Gruenden
  -- setzen. Genau diese Luecke schliesst die Zielarchitektur mit G4.
  publishable             BOOLEAN GENERATED ALWAYS AS (
                            status = 'passed'
                            AND evidence_complete
                            AND backend_preservation = 'preserve_all'
                            AND policy_compliant
                            AND NOT human_approval_required
                          ) STORED,

  -- Begruendung im Klartext. Das Frontend rendert sie (G2) und leitet
  -- nichts daraus ab.
  blockers                JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings                JSONB NOT NULL DEFAULT '[]'::jsonb,

  finding_count           INTEGER NOT NULL DEFAULT 0,
  severity_max            TEXT,

  -- Freigabe: Person und Begruendung sind Pflicht, sobald eine erteilt
  -- wurde. Ein Approval ohne beides waere wieder ein Flag (G4).
  approved_by             UUID,
  approved_at             TIMESTAMPTZ,
  approval_reason         TEXT,
  CONSTRAINT siteos_publish_approval_complete CHECK (
    (approved_by IS NULL AND approved_at IS NULL AND approval_reason IS NULL)
    OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND approval_reason IS NOT NULL)
  ),

  evaluated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS siteos_publish_evaluations_tenant_idx
  ON public.siteos_publish_evaluations (tenant_id, evaluated_at DESC);

-- Die letzte Bewertung zu einem Artefakt ist der haeufigste Zugriff:
-- „darf dieser Stand veroeffentlicht werden?"
CREATE INDEX IF NOT EXISTS siteos_publish_evaluations_artifact_idx
  ON public.siteos_publish_evaluations (tenant_id, artifact_sha256, evaluated_at DESC);

ALTER TABLE public.siteos_publish_evaluations ENABLE ROW LEVEL SECURITY;

-- Lesen fuer Mitglieder des Mandanten. Schreiben ausschliesslich ueber die
-- Edge Function mit service_role: Eine clientseitig erzeugte Bewertung waere
-- exakt das, was G1 ausschliesst.
DROP POLICY IF EXISTS "siteos_publish_evaluations tenant-select" ON public.siteos_publish_evaluations;
CREATE POLICY "siteos_publish_evaluations tenant-select"
  ON public.siteos_publish_evaluations FOR SELECT
  USING (public.is_tenant_member(tenant_id));

COMMENT ON TABLE public.siteos_publish_evaluations IS
  'Publish-Gate-Bewertungen (Zielarchitektur §7). Append-only, Anker jeder Publish-Aktion. Schreiben nur ueber Edge Function siteos/publish-gate (service_role).';
COMMENT ON COLUMN public.siteos_publish_evaluations.publishable IS
  'Generiert aus den fuenf Bedingungen der Ableitungsregel — nicht setzbar (G4).';
COMMENT ON COLUMN public.siteos_publish_evaluations.artifact_sha256 IS
  'Bindet die Bewertung an genau ein Auslieferungsbuendel (G6). Aendert sich das Buendel, verfaellt die Bewertung.';
COMMENT ON COLUMN public.siteos_publish_evaluations.blockers IS
  'Klartext-Begruendung. Das Frontend rendert sie und leitet publishable nie selbst ab (G2).';

COMMIT;

-- SiteOS Publish Gate — Persistenz des normativen Contracts.
-- Contract: docs/architecture/target-architecture.md §7 (Regeln G1–G6).
-- Regel:    packages/siteos-core/src/governance/publish-gate.ts
--
-- Die Zielarchitektur nennt das Gate als einzige Stelle, an der eine
-- Veroeffentlichung entstehen darf, und verlangt es **vor** dem ersten
-- Publish-Pfad. Genau deshalb steht diese Migration vor dem Deployment-Weg
-- und nicht danach: ein Gate, das nach dem ersten Publish nachgereicht wird,
-- muss einen Bestand legitimieren, den es nie geprueft hat.
--
-- Der Kern dieser Migration ist, dass die drei scharfen Regeln nicht im
-- Anwendungscode stehen, sondern im Schema:
--
--   G4  publishable ist rein abgeleitet  → GENERATED ALWAYS Spalte
--   G5  eine Publish-Aktion referenziert genau eine Evaluation → NOT NULL FK
--   G6  eine Evaluation gilt fuer genau einen Artefakt-Hash → zusammengesetzter FK
--
-- Anwendungscode laesst sich umgehen, ein Constraint nicht. Ein Gate, dessen
-- Durchsetzung von der Disziplin des Aufrufers abhaengt, ist kein Nachweis.
--
-- Additiv: keine bestehende Tabelle wird veraendert, keine Policy angefasst.
-- siteos_blueprints.status behaelt seine vier Werte (draft|approved|deployed|
-- archived) — der Lebenszyklus liegt laut Zielarchitektur §4.2 oberhalb der
-- Versionsstatus, nicht an ihrer Stelle.

-- ── 1. Die Evaluation ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.siteos_publish_evaluations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Optional: nicht jede Bewertung haengt an einer gespeicherten Blueprint-
  -- Version (Vorabpruefung eines Artefakts ist zulaessig). Der Artefakt-Hash
  -- ist der verbindliche Anker, nicht die Zeile.
  blueprint_id UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,

  -- G6: der Anker. Aendert sich das Artefakt, verfaellt die Evaluation —
  -- durchgesetzt ueber den zusammengesetzten FK der Aktionstabelle unten.
  artifact_sha256  CHAR(64) NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  blueprint_sha256 CHAR(64) NOT NULL CHECK (blueprint_sha256 ~ '^[0-9a-f]{64}$'),

  -- Die Contract-Felder aus §7, unveraendert benannt.
  status TEXT NOT NULL CHECK (status IN ('passed', 'blocked', 'pending')),
  evidence_complete       BOOLEAN NOT NULL,
  backend_preservation    TEXT NOT NULL
    CHECK (backend_preservation IN ('preserve_all', 'changed', 'unknown')),
  policy_compliant        BOOLEAN NOT NULL,
  human_approval_required BOOLEAN NOT NULL,

  -- G4: Es gibt keinen Schreibpfad fuer publishable. Die Ableitungsregel aus
  -- §7 steht hier woertlich; ein INSERT, der sie umgehen will, kann die Spalte
  -- gar nicht adressieren. Damit ist ein manuelles Ueberschreiben nicht "nicht
  -- vorgesehen", sondern unmoeglich.
  publishable BOOLEAN GENERATED ALWAYS AS (
    status = 'passed'
    AND evidence_complete = TRUE
    AND backend_preservation = 'preserve_all'
    AND policy_compliant = TRUE
    AND human_approval_required = FALSE
  ) STORED,

  -- G2: die Begruendung wandert mit dem Ergebnis, damit das Frontend sie
  -- anzeigen kann, ohne sie aus den Einzelfeldern zu rekonstruieren.
  -- Array von PublishGateReason (code, message, ref).
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,

  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Wer die Auswertung angestossen hat. NULL bei Cron/Automatik.
  evaluated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Zieltabelle des zusammengesetzten FK (G5+G6). Die Spalten muessen als
-- Einheit eindeutig sein, damit eine Aktion nicht nur auf die Evaluation,
-- sondern auf *diese Evaluation mit diesem Hash und diesem Ergebnis* zeigt.
CREATE UNIQUE INDEX IF NOT EXISTS siteos_publish_evaluations_gate_key
  ON public.siteos_publish_evaluations (id, artifact_sha256, publishable);

CREATE INDEX IF NOT EXISTS siteos_publish_evaluations_tenant_idx
  ON public.siteos_publish_evaluations (tenant_id, evaluated_at DESC);

-- Nachschlagen der juengsten gueltigen Bewertung zu einem Artefakt.
CREATE INDEX IF NOT EXISTS siteos_publish_evaluations_artifact_idx
  ON public.siteos_publish_evaluations (tenant_id, artifact_sha256, evaluated_at DESC);

COMMENT ON TABLE public.siteos_publish_evaluations IS
  'Serverseitige Auswertung des SiteOS Publish Gate (Zielarchitektur §7). '
  'Unveraenderlich: eine Neubewertung ist eine neue Zeile, keine Korrektur '
  'der alten.';

COMMENT ON COLUMN public.siteos_publish_evaluations.publishable IS
  'G4: rein abgeleitet, GENERATED ALWAYS. Kein manuelles Ueberschreiben — '
  'eine Ausnahme ist immer ein Approval, nie ein Flag.';

COMMENT ON COLUMN public.siteos_publish_evaluations.backend_preservation IS
  'G3/§7: "unknown" ist ein zulaessiges, aber blockierendes Ergebnis. '
  'Formularziele, Zahlungswege, Buchungsstrecken, Einwilligungen, '
  'Schnittstellen — bewusst getrennt von policy_compliant.';

-- ── 2. Unveraenderlichkeit ──────────────────────────────────────────────────
-- §4.1 Regel 5: Zustaende werden fortgeschrieben, nicht ueberschrieben. Eine
-- Evaluation, die sich nachtraeglich aendern laesst, belegt nichts: der
-- Pruefpfad koennte den Stand zeigen, den jemand spaeter gewuenscht hat.

CREATE OR REPLACE FUNCTION public.siteos_publish_evaluations_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION
    'siteos_publish_evaluations ist unveraenderlich (Zielarchitektur §7 G4/§4.1). '
    'Eine Neubewertung wird als neue Zeile angelegt.';
END;
$$;

DROP TRIGGER IF EXISTS siteos_publish_evaluations_no_update ON public.siteos_publish_evaluations;
CREATE TRIGGER siteos_publish_evaluations_no_update
  BEFORE UPDATE OR DELETE ON public.siteos_publish_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.siteos_publish_evaluations_immutable();

-- ── 3. Die Publish-Aktion ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.siteos_publish_actions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- G5: der Pruefpfad-Anker. NOT NULL, weil eine Veroeffentlichung ohne
  -- tragende Bewertung spaeter nicht belegbar waere.
  evaluation_id UUID NOT NULL,

  -- Redundant zur Evaluation — und genau das ist der Zweck: die beiden
  -- Spalten unten bilden zusammen mit evaluation_id den FK, der G6 erzwingt.
  artifact_sha256 CHAR(64) NOT NULL,

  -- Immer TRUE. Die Spalte existiert nur, damit der FK auf den Unique-Index
  -- (id, artifact_sha256, publishable) zeigen kann. Eine nicht freigegebene
  -- Evaluation hat publishable = FALSE und findet damit keinen FK-Partner:
  -- der INSERT scheitert an der Datenbank, nicht an einem if im Handler.
  gate_passed BOOLEAN NOT NULL DEFAULT TRUE CHECK (gate_passed = TRUE),

  -- Wohin veroeffentlicht wurde. NULL, solange der Deployment-Pfad offen ist
  -- (SITEOS_ARCHITECTURE §6) — die Aktion ist dann bereits belegt, das Ziel
  -- wird nachgetragen.
  target_url TEXT,

  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT siteos_publish_actions_gate_fk
    FOREIGN KEY (evaluation_id, artifact_sha256, gate_passed)
    REFERENCES public.siteos_publish_evaluations (id, artifact_sha256, publishable)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS siteos_publish_actions_tenant_idx
  ON public.siteos_publish_actions (tenant_id, published_at DESC);

CREATE INDEX IF NOT EXISTS siteos_publish_actions_evaluation_idx
  ON public.siteos_publish_actions (evaluation_id);

COMMENT ON TABLE public.siteos_publish_actions IS
  'Jede Veroeffentlichung, verankert an genau einer bestandenen Evaluation '
  '(G5) fuer genau einen Artefakt-Hash (G6). Beides ueber den '
  'zusammengesetzten Fremdschluessel erzwungen, nicht ueber Anwendungslogik.';

COMMENT ON CONSTRAINT siteos_publish_actions_gate_fk ON public.siteos_publish_actions IS
  'G5+G6+G4 in einem Constraint: die Aktion findet nur dann eine Zielzeile, '
  'wenn Evaluation, Artefakt-Hash und publishable=TRUE zusammenpassen. Ein '
  'Artefaktwechsel nach der Freigabe laesst den Schluessel ins Leere laufen.';

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
-- Lesen: Mitglieder des Mandanten. Schreiben: ausschliesslich Service-Role.
--
-- G1 verlangt eine serverseitige Auswertung. Duerfte ein Client selbst
-- schreiben, koennte er sich eine bestandene Evaluation anlegen — die
-- GENERATED-Spalte wuerde ihn nicht daran hindern, denn er kontrolliert dann
-- die Eingangsfelder. Der Schreibschutz ist deshalb Teil des Contracts, nicht
-- nur uebliche Vorsicht.

ALTER TABLE public.siteos_publish_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "publish_evaluations tenant-select" ON public.siteos_publish_evaluations;
CREATE POLICY "publish_evaluations tenant-select" ON public.siteos_publish_evaluations
  FOR SELECT USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "publish_evaluations service-all" ON public.siteos_publish_evaluations;
CREATE POLICY "publish_evaluations service-all" ON public.siteos_publish_evaluations
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.siteos_publish_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "publish_actions tenant-select" ON public.siteos_publish_actions;
CREATE POLICY "publish_actions tenant-select" ON public.siteos_publish_actions
  FOR SELECT USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "publish_actions service-all" ON public.siteos_publish_actions;
CREATE POLICY "publish_actions service-all" ON public.siteos_publish_actions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ── 5. Die juengste gueltige Freigabe ───────────────────────────────────────
-- Fail-closed (G3): kein Treffer ⇒ nicht veroeffentlichbar. Die Funktion gibt
-- deshalb bei fehlender Bewertung eine vollstaendige, blockierende Antwort
-- zurueck statt NULL — ein Aufrufer, der NULL bekommt, faengt an zu raten.

CREATE OR REPLACE FUNCTION public.siteos_publish_gate_state(
  p_tenant_id       UUID,
  p_artifact_sha256 TEXT
)
RETURNS TABLE (
  evaluation_id UUID,
  publishable   BOOLEAN,
  status        TEXT,
  reasons       JSONB,
  evaluated_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Mandantenpruefung ausdruecklich im Rumpf: SECURITY DEFINER umgeht RLS,
  -- also muss die Zugehoerigkeit hier stehen und nicht in einer Policy.
  IF NOT (public.is_tenant_member(p_tenant_id) OR auth.role() = 'service_role') THEN
    RETURN QUERY SELECT
      NULL::UUID, FALSE, 'blocked'::TEXT,
      '[{"code":"POLICY_VIOLATION","message":"Kein Zugriff auf diesen Mandanten.","ref":null}]'::JSONB,
      NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT e.id, e.publishable, e.status, e.reasons, e.evaluated_at
      FROM public.siteos_publish_evaluations e
     WHERE e.tenant_id = p_tenant_id
       AND e.artifact_sha256 = p_artifact_sha256
     ORDER BY e.evaluated_at DESC
     LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID, FALSE, 'pending'::TEXT,
      '[{"code":"BACKEND_UNKNOWN","message":"Fuer dieses Artefakt liegt keine Bewertung vor.","ref":null}]'::JSONB,
      NULL::TIMESTAMPTZ;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.siteos_publish_gate_state(UUID, TEXT) IS
  'Juengste Gate-Bewertung zu einem Artefakt-Hash. Fail-closed (G3): ohne '
  'Bewertung publishable=FALSE mit Begruendung, nie NULL.';

REVOKE ALL ON FUNCTION public.siteos_publish_gate_state(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.siteos_publish_gate_state(UUID, TEXT) TO authenticated, service_role;

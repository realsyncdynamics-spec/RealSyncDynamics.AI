-- B3 (Asset → Findings → Evidence → Monitoring).
-- Contract: docs/architecture/asset-lifecycle-contract.md (§4, §5, §6, §9 D4/D5).
--
-- B2 hat die Bruecke Audit → Asset gelegt. B3 schliesst die restlichen drei
-- Kanten, damit der Lebenszyklus-Zustand *abgeleitet* statt behauptet werden
-- kann:
--
--   Asset → Findings     : findings kannte nur die websites-Projektion
--   Findings → Evidence  : evidence_ref war freier TEXT ohne Fremdschluessel (D4)
--   Asset → Monitoring   : scan_schedules trug Domain-Strings, keine Relation (D5)
--
-- Additiv: keine Spalte wird entfernt, keine bestehende Policy geaendert.
-- domains TEXT[] bleibt als Ausfuehrungsliste des Dispatchers bestehen; die
-- neue Relation ist der Governance-Bezug daneben, nicht ihr Ersatz.
--
-- Bewusst NICHT in dieser Migration:
--   D2 (governance_assets.tenant_id nullable → NOT NULL): unveraendert offen,
--       Begruendung in 20260821000000.
--   D6 (audit_recheck_subscriptions ohne Schreibpfad): der Cron laeuft seit
--       20260506290000 gegen eine leere Tabelle. Ob der Schreibpfad gebaut oder
--       der Cron abgestellt wird, ist eine Produktentscheidung — keine, die
--       eine Migration still treffen darf.

-- ── 1. D5: Die Monitoring-Beziehung als Relation ────────────────────────────
-- Contract §5: "Die Monitoring-Beziehung ist eine Relation zwischen Asset und
-- Zeitplan, nicht zwischen E-Mail und Domain." Ein Zeitplan deckt mehrere
-- Domains ab, eine Domain kann in mehreren Zeitplaenen stehen — deshalb eine
-- Zuordnungstabelle und kein Feld an einer der beiden Seiten.

CREATE TABLE IF NOT EXISTS public.scan_schedule_assets (
  schedule_id UUID NOT NULL REFERENCES public.scan_schedules(id)    ON DELETE CASCADE,
  asset_id    UUID NOT NULL REFERENCES public.governance_assets(id) ON DELETE CASCADE,
  -- Denormalisiert, damit die RLS-Policy den Mandanten ohne Join auf zwei
  -- Elterntabellen pruefen kann (governance_assets traegt nur service_all).
  tenant_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (schedule_id, asset_id)
);

CREATE INDEX IF NOT EXISTS scan_schedule_assets_asset_idx
  ON public.scan_schedule_assets(asset_id);

COMMENT ON TABLE public.scan_schedule_assets IS
  'Monitoring-Beziehung Asset ↔ Zeitplan (Contract §5). "Monitoring aktiv" wird '
  'ausschliesslich hierueber abgeleitet — es gibt kein Flag am Asset.';

ALTER TABLE public.scan_schedule_assets ENABLE ROW LEVEL SECURITY;

-- Lesen wie bei scan_schedules: Mitglieder des Mandanten. Schreiben bleibt der
-- Service-Role vorbehalten (Edge Function scheduler), damit ein Client sich
-- keine Monitoring-Beziehung selbst anlegen kann — sie ist ein Governance-Fakt,
-- kein Nutzerwunsch.
DROP POLICY IF EXISTS "scan_schedule_assets tenant-select" ON public.scan_schedule_assets;
CREATE POLICY "scan_schedule_assets tenant-select" ON public.scan_schedule_assets
  FOR SELECT USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "scan_schedule_assets service-all" ON public.scan_schedule_assets;
CREATE POLICY "scan_schedule_assets service-all" ON public.scan_schedule_assets
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Backfill: bestehende Zeitplaene ueber ihre Domain-Liste an die Assets binden,
-- die B2 an den websites-Datensaetzen angelegt hat. Domains ohne Website-
-- Projektion bleiben unverknuepft — sie haben (noch) kein Asset, und ein
-- erfundener Bezug waere schlechter als gar keiner.
INSERT INTO public.scan_schedule_assets (schedule_id, asset_id, tenant_id)
SELECT s.id, w.governance_asset_id, s.tenant_id
  FROM public.scan_schedules s
  CROSS JOIN LATERAL unnest(s.domains) AS d(domain)
  JOIN public.websites w
    ON w.domain = d.domain
   AND w.tenant_id = s.tenant_id
 WHERE w.governance_asset_id IS NOT NULL
ON CONFLICT (schedule_id, asset_id) DO NOTHING;

-- ── 2. D4: Der Nachweisbezug bekommt seinen Fremdschluessel ─────────────────
-- evidence_ref bleibt als opaker Zeiger bestehen (Storage-Key, externe
-- Dokument-ID, Hash). Danebengestellt wird der referenziell gesicherte Bezug
-- auf eine Zeile in governance_evidence — nur der traegt einen Nachweis im
-- Sinne des Prüfpfads.

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS evidence_id UUID
    REFERENCES public.governance_evidence(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS findings_evidence_idx
  ON public.findings(evidence_id) WHERE evidence_id IS NOT NULL;

COMMENT ON COLUMN public.findings.evidence_id IS
  'Referenziell gesicherter Nachweis zu diesem Befund (Contract §9 D4). '
  'evidence_ref bleibt der freie Zeiger fuer alles, was keine Zeile in '
  'governance_evidence ist.';

-- Wo evidence_ref bereits eine gueltige governance_evidence-UUID enthaelt,
-- wird der Bezug uebernommen. Der Regex-Vorfilter ist noetig, weil ::uuid auf
-- beliebigem Text hart fehlschlaegt statt NULL zu liefern.
UPDATE public.findings f
   SET evidence_id = ge.id
  FROM public.governance_evidence ge
 WHERE f.evidence_id IS NULL
   AND f.evidence_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND ge.id = f.evidence_ref::uuid;

-- ── 3. Befunde am Asset ─────────────────────────────────────────────────────
-- Analog zu scan_runs.asset_id aus B2: website_id bleibt, asset_id kommt
-- daneben, damit ein Befund auch fuer kuenftige Nicht-Website-Assets
-- (api, agent, …) adressierbar ist.

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS asset_id UUID
    REFERENCES public.governance_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS findings_asset_idx
  ON public.findings(asset_id) WHERE asset_id IS NOT NULL;

UPDATE public.findings f
   SET asset_id = w.governance_asset_id
  FROM public.websites w
 WHERE f.website_id = w.id
   AND f.asset_id IS NULL
   AND w.governance_asset_id IS NOT NULL;

-- ── 4. Der abgeleitete Lebenszyklus-Zustand (Contract §6) ───────────────────
-- Kein Statusfeld. Der Zustand wird aus fuenf Eingaben berechnet und ist damit
-- immer so wahr wie die Datenbasis — genau das, was Phase A fuer das Dashboard
-- durchgesetzt hat, eine Ebene tiefer.
--
-- Fail-closed: Fehlt eine Voraussetzung, ist das Ergebnis nie ACTIVE. Ist das
-- Asset nicht sichtbar (fremder Mandant, geloescht), ist es UNKNOWN — nicht der
-- zuletzt bekannte Wert und kein Fehler, der den Aufrufer zum Raten zwingt.
--
-- SECURITY DEFINER, weil governance_assets nur eine service_all-Policy traegt;
-- die Mandantenpruefung passiert deshalb ausdruecklich im Rumpf, nicht ueber
-- RLS. search_path gepinnt (Advisor function_search_path_mutable).

CREATE OR REPLACE FUNCTION public.asset_lifecycle_state(p_asset_id UUID)
RETURNS TABLE (
  asset_id          UUID,
  state             TEXT,
  completed_runs    INT,
  findings_count    INT,
  evidence_count    INT,
  monitoring_active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant     UUID;
  v_runs       INT;
  v_findings   INT;
  v_evidence   INT;
  v_monitoring BOOLEAN;
BEGIN
  SELECT ga.tenant_id INTO v_tenant
    FROM public.governance_assets ga WHERE ga.id = p_asset_id;

  -- Unbekanntes Asset oder fremder Mandant: dieselbe Antwort. Ein
  -- unterscheidbares "gibt es, darfst du nicht sehen" waere ein Leck.
  IF v_tenant IS NULL
     OR NOT (public.is_tenant_member(v_tenant) OR auth.role() = 'service_role') THEN
    RETURN QUERY SELECT p_asset_id, 'UNKNOWN'::TEXT, 0, 0, 0, FALSE;
    RETURN;
  END IF;

  -- Nur abgeschlossene Runs zaehlen. Ein fehlgeschlagener Run belegt, dass die
  -- Beobachtung NICHT stattgefunden hat (Contract §4/§6) — er darf keinen
  -- Zustand fortschreiben.
  SELECT count(*) INTO v_runs
    FROM public.scan_runs sr
   WHERE sr.asset_id = p_asset_id AND sr.status = 'completed';

  SELECT count(*) INTO v_findings
    FROM public.findings f WHERE f.asset_id = p_asset_id;

  SELECT count(*) INTO v_evidence
    FROM public.governance_evidence ge WHERE ge.asset_id = p_asset_id;

  -- "Monitoring aktiv" exakt nach Contract §5 — kein next_reaudit_at, keine
  -- Vermutung aus einem Datum.
  SELECT EXISTS (
    SELECT 1
      FROM public.scan_schedule_assets ssa
      JOIN public.scan_schedules s ON s.id = ssa.schedule_id
     WHERE ssa.asset_id = p_asset_id
       AND s.enabled = TRUE
       AND s.paused  = FALSE
       AND s.next_run_at IS NOT NULL
  ) INTO v_monitoring;

  RETURN QUERY SELECT
    p_asset_id,
    CASE
      WHEN v_monitoring AND v_runs >= 2 THEN 'CONTINUOUSLY_OBSERVED'
      WHEN v_monitoring                 THEN 'MONITORING_ACTIVE'
      WHEN v_evidence  >= 1             THEN 'EVIDENCE_CREATED'
      WHEN v_runs      >= 1             THEN 'BASELINE_VERIFIED'
      ELSE                                   'ASSET_CREATED'
    END::TEXT,
    v_runs, v_findings, v_evidence, v_monitoring;
END;
$$;

COMMENT ON FUNCTION public.asset_lifecycle_state(UUID) IS
  'Leitet den Lebenszyklus-Zustand eines Assets aus Beobachtung, Befund, '
  'Nachweis und Monitoring-Beziehung ab (Contract §6). Fail-closed: ohne '
  'sichtbares Asset UNKNOWN, ohne aktive Monitoring-Beziehung nie '
  'MONITORING_ACTIVE. ANONYMOUS_BASELINE ist hier nicht erreichbar — dieser '
  'Zustand hat per Definition kein Asset und wird vom Aufrufer bestimmt.';

REVOKE ALL ON FUNCTION public.asset_lifecycle_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.asset_lifecycle_state(UUID) TO authenticated, service_role;

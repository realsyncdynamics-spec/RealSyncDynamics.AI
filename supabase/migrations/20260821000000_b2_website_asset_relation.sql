-- B2 (Audit → Asset): websites an governance_assets binden.
-- Contract: docs/architecture/asset-lifecycle-contract.md (§2, §4, §9 D1/D3).
--
-- Kernproblem, das diese Migration schliesst: Beobachtung und Befund haengen
-- an websites, der Nachweis (governance_evidence) haengt an governance_assets —
-- und die beiden Tabellen kannten einander nicht (Defekt D1). Ein Nachweis war
-- damit keinem Befund zuordenbar, weil der gemeinsame Bezugspunkt fehlte.
--
-- Additiv: keine Spalte wird entfernt, keine bestehende Policy geaendert.
--
-- Bewusst NICHT in dieser Migration (Contract §9):
--   D2 (governance_assets.tenant_id nullable → NOT NULL): In Produktion
--       existiert eine Zeile, deren Mandant erst geklaert werden muss. Ein
--       SET NOT NULL wuerde blind fehlschlagen oder blind zuordnen — beides
--       falsch. Neue Assets aus dem Trigger unten tragen den Mandanten immer.
--   D5/D6 (scan_schedules/audit_recheck_subscriptions): gehoeren zu B3
--       (Monitoring), nicht zur Audit→Asset-Bruecke.

-- ── 1. Die Relation (D1) ────────────────────────────────────────────────────
-- Richtung laut Contract §2: die Projektion kennt ihr Asset, nicht umgekehrt.

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS governance_asset_id UUID
    REFERENCES public.governance_assets(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.websites.governance_asset_id IS
  'Kanonisches Asset dieser Website-Projektion (Contract §2). Wird vom '
  'Trigger b2_websites_ensure_asset serverseitig gesetzt; ein websites-'
  'Datensatz ohne Asset gilt nach B2 als unvollstaendig.';

-- Ein Asset hat hoechstens eine Website-Projektion (Contract §2, Regel 2).
CREATE UNIQUE INDEX IF NOT EXISTS websites_governance_asset_unique
  ON public.websites(governance_asset_id)
  WHERE governance_asset_id IS NOT NULL;

-- ── 2. Observation Runs am Asset (Contract §4) ──────────────────────────────
-- website_id bleibt bestehen; asset_id kommt additiv daneben, damit ein Run
-- auch fuer kuenftige Nicht-Website-Assets (api, agent, …) adressierbar ist.

ALTER TABLE public.scan_runs
  ADD COLUMN IF NOT EXISTS asset_id UUID
    REFERENCES public.governance_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS scan_runs_asset_idx
  ON public.scan_runs(asset_id) WHERE asset_id IS NOT NULL;

-- ── 3. Trigger: kein websites-Datensatz ohne Asset ──────────────────────────
-- Serverseitig statt in jedem Aufrufer (scansApi, Edge Functions, kuenftige
-- Importe): der Lebenszyklus-Zustand wird laut Contract §6 aus der Existenz
-- des Assets abgeleitet — dann darf seine Anlage nicht davon abhaengen, dass
-- jeder Schreibpfad daran denkt.
--
-- SECURITY DEFINER, weil governance_assets nur eine service_all-Policy traegt:
-- Der Trigger muss das Asset auch dann anlegen koennen, wenn der ausloesende
-- Insert (per RLS erlaubt) nicht von der Service-Role kommt. search_path
-- gepinnt nach Repo-Konvention (Advisor function_search_path_mutable).

CREATE OR REPLACE FUNCTION public.b2_websites_ensure_asset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  asset_tenant UUID;
BEGIN
  IF NEW.governance_asset_id IS NULL THEN
    INSERT INTO public.governance_assets
      (tenant_id, asset_type, name, system_url, status)
    VALUES
      (NEW.tenant_id, 'website', NEW.domain, 'https://' || NEW.domain, 'active')
    RETURNING id INTO NEW.governance_asset_id;
  ELSE
    -- Wird ein Asset explizit mitgegeben, muss der Mandant uebereinstimmen
    -- (Contract §2, Regel 3). Sonst liesse sich per Insert ein fremdes Asset
    -- an den eigenen Mandanten binden.
    SELECT tenant_id INTO asset_tenant
      FROM public.governance_assets WHERE id = NEW.governance_asset_id;
    IF asset_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION
        'governance_asset % gehoert nicht zum Mandanten der Website (% <> %)',
        NEW.governance_asset_id, asset_tenant, NEW.tenant_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_b2_websites_ensure_asset ON public.websites;
CREATE TRIGGER trg_b2_websites_ensure_asset
  BEFORE INSERT ON public.websites
  FOR EACH ROW EXECUTE FUNCTION public.b2_websites_ensure_asset();

-- ── 4. Backfill ─────────────────────────────────────────────────────────────
-- In Produktion ist websites leer (Stand 2026-08-15); der Backfill traegt in
-- anderen Umgebungen nach, was der Trigger kuenftig garantiert.

DO $$
DECLARE
  w RECORD;
  new_asset UUID;
BEGIN
  FOR w IN
    SELECT id, tenant_id, domain
    FROM public.websites
    WHERE governance_asset_id IS NULL
  LOOP
    INSERT INTO public.governance_assets
      (tenant_id, asset_type, name, system_url, status)
    VALUES
      (w.tenant_id, 'website', w.domain, 'https://' || w.domain, 'active')
    RETURNING id INTO new_asset;

    UPDATE public.websites
      SET governance_asset_id = new_asset
      WHERE id = w.id;
  END LOOP;
END;
$$;

-- Bestehende Runs an das Asset ihrer Website haengen.
UPDATE public.scan_runs sr
  SET asset_id = w.governance_asset_id
  FROM public.websites w
  WHERE sr.website_id = w.id
    AND sr.asset_id IS NULL
    AND w.governance_asset_id IS NOT NULL;

-- ── 5. D3: findings.scan_run_id bekommt seinen Fremdschluessel ──────────────
-- Der FK fehlte nur, weil findings (20260610200000) VOR scan_runs
-- (20260611000000) angelegt wurde — der Grund ist seit Jahren entfallen.
-- Verwaiste Verweise (moeglich in Umgebungen mit geloeschten Runs) werden
-- vorher genullt, sonst schluege der Constraint fehl.

UPDATE public.findings f
  SET scan_run_id = NULL
  WHERE scan_run_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.scan_runs s WHERE s.id = f.scan_run_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'findings_scan_run_fk'
  ) THEN
    ALTER TABLE public.findings
      ADD CONSTRAINT findings_scan_run_fk
      FOREIGN KEY (scan_run_id) REFERENCES public.scan_runs(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

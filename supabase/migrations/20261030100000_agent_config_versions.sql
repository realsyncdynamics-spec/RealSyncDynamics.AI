-- M5 Command Center: versionierte Soll-Konfigurationen je Agent (Details / Bibliothek / Computer).
-- Additiv. Begründung neue Tabelle statt Erweiterung: agent_profiles ist global (kein tenant_id) und
-- nicht versioniert; agent_knowledge_base bleibt Wissensspeicher und wird aus der Bibliothek nur referenziert.
-- Versionen sind unveränderlich; Clients legen nur Entwürfe an. Aktivierung nur über
-- activate_agent_config_version (Owner/Admin, ausdrückliche Bestätigung, Audit in agent_actions_log).
-- Kein Schreiben in externe Admin-APIs: Soll ≠ Ist, Abgleich manuell/unterstützt.

CREATE TABLE IF NOT EXISTS public.agent_config_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_ref     TEXT NOT NULL CHECK (length(agent_ref) BETWEEN 1 AND 200),
  section       TEXT NOT NULL CHECK (section IN ('details','library','computer')),
  version       INT  NOT NULL DEFAULT 0,
  config        JSONB NOT NULL CHECK (jsonb_typeof(config) = 'object'),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','superseded')),
  change_note   TEXT CHECK (change_note IS NULL OR length(change_note) <= 2000),
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_by  UUID,
  activated_at  TIMESTAMPTZ,
  UNIQUE (tenant_id, agent_ref, section, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_config_versions_one_active
  ON public.agent_config_versions(tenant_id, agent_ref, section) WHERE status = 'active';

ALTER TABLE public.agent_config_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_config_versions_member_read ON public.agent_config_versions;
CREATE POLICY agent_config_versions_member_read ON public.agent_config_versions
  FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agent_config_versions_admin_draft ON public.agent_config_versions;
CREATE POLICY agent_config_versions_admin_draft ON public.agent_config_versions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.memberships m
            WHERE m.tenant_id = agent_config_versions.tenant_id
              AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));
-- Bewusst keine UPDATE-/DELETE-Policy: Versionen sind unveränderlich.

REVOKE ALL ON public.agent_config_versions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.agent_config_versions TO authenticated;

-- Inserts: immer Entwurf, Version fortlaufend, Ersteller = Aufrufer.
CREATE OR REPLACE FUNCTION public.agent_config_versions_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Jede neue Version startet als Entwurf (auch serverseitig); aktiv nur via Aktivierungsfunktion.
  NEW.status := 'draft';
  NEW.activated_by := NULL;
  NEW.activated_at := NULL;
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  PERFORM pg_advisory_xact_lock(hashtext(NEW.tenant_id::text || NEW.agent_ref || NEW.section));
  SELECT COALESCE(max(version), 0) + 1 INTO NEW.version
    FROM public.agent_config_versions
   WHERE tenant_id = NEW.tenant_id AND agent_ref = NEW.agent_ref AND section = NEW.section;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agent_config_versions_before_insert ON public.agent_config_versions;
CREATE TRIGGER agent_config_versions_before_insert BEFORE INSERT ON public.agent_config_versions
  FOR EACH ROW EXECUTE FUNCTION public.agent_config_versions_before_insert();

-- Inhalt unveränderlich; nur Statuswechsel durch die Aktivierungsfunktion.
CREATE OR REPLACE FUNCTION public.agent_config_versions_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.config IS DISTINCT FROM OLD.config OR NEW.tenant_id <> OLD.tenant_id
     OR NEW.agent_ref <> OLD.agent_ref OR NEW.section <> OLD.section OR NEW.version <> OLD.version THEN
    RAISE EXCEPTION 'agent_config_versions: Versionen sind unveränderlich' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agent_config_versions_immutable ON public.agent_config_versions;
CREATE TRIGGER agent_config_versions_immutable BEFORE UPDATE ON public.agent_config_versions
  FOR EACH ROW EXECUTE FUNCTION public.agent_config_versions_immutable();

CREATE OR REPLACE FUNCTION public.activate_agent_config_version(p_id uuid, p_confirm boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  r public.agent_config_versions%ROWTYPE;
  v_prev UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nicht angemeldet' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.agent_config_versions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version nicht gefunden' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.memberships m
                 WHERE m.tenant_id = r.tenant_id AND m.user_id = v_uid AND m.role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'nur Owner/Admin des Mandanten' USING ERRCODE = '42501';
  END IF;
  IF r.status <> 'draft' THEN RAISE EXCEPTION 'nur Entwürfe können aktiviert werden' USING ERRCODE = '22023'; END IF;
  IF p_confirm IS NOT TRUE THEN RAISE EXCEPTION 'Aktivierung erfordert ausdrückliche Bestätigung' USING ERRCODE = '22023'; END IF;

  UPDATE public.agent_config_versions SET status = 'superseded'
   WHERE tenant_id = r.tenant_id AND agent_ref = r.agent_ref AND section = r.section AND status = 'active'
   RETURNING id INTO v_prev;
  UPDATE public.agent_config_versions SET status = 'active', activated_by = v_uid, activated_at = now()
   WHERE id = p_id;

  INSERT INTO public.agent_actions_log(tenant_id, action_type, input, output, status)
  VALUES (r.tenant_id, 'config_activate',
          jsonb_build_object('config_version_id', p_id, 'agent_ref', r.agent_ref, 'section', r.section,
                             'version', r.version, 'actor', v_uid),
          jsonb_build_object('superseded_id', v_prev), 'ok');

  RETURN jsonb_build_object('id', p_id, 'version', r.version, 'superseded_id', v_prev);
END $$;
REVOKE ALL ON FUNCTION public.activate_agent_config_version(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_agent_config_version(uuid, boolean) TO authenticated;

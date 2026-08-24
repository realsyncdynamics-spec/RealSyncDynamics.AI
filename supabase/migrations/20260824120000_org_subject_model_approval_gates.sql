-- ============================================================
-- Governance OS P1-1 + P1-4: Subjektmodell und PDP-Approval-Gates
-- (Plan docs/architecture/governance-os-enforcement-plan.md, Freigabe "GO")
--
-- P1-1: Ohne Organisationseinheiten, Principals und feingranulare Rollen
-- sind Policies wie "user.role = employee" oder "nur Standort X" nicht
-- formulierbar. tenant bleibt die EINZIGE Isolationsgrenze — org_units
-- strukturieren innerhalb eines Tenants, sie ersetzen keine RLS.
--
-- Vererbung ueber den Baum laeuft ueber einen MATERIALISIERTEN PFAD
-- (org_path), nicht ueber Rekursion in RLS-Policies — die Rekursionsfalle
-- ist im Repo dokumentiert (20260723000001, Kommentar in 20260822000000).
--
-- P1-4: require_approval war bisher eine Sackgasse (403 ohne Weg zur
-- Freigabe). pdp_approval_gates schliesst die Kette: Entscheidung ->
-- Gate (Request-Fingerprint) -> Freigabe durch Rolle -> die naechste
-- identische Anfrage ist gedeckt und laeuft durch. Der CEO muss nicht
-- jede Aktion freigeben: approver_role adressiert eine ROLLE.
--
-- EU-AI-Act Art. 14 (Human Oversight), Art. 12 (Aufzeichnung).
-- Additiv: tenant_memberships und bestehende Policies bleiben unberuehrt.
-- ============================================================

-- 1. Organisationseinheiten (Standort / Abteilung / Team) ---------------------

CREATE TABLE IF NOT EXISTS public.org_units (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id  uuid REFERENCES public.org_units(id) ON DELETE CASCADE,
  name       text NOT NULL,
  kind       text NOT NULL DEFAULT 'unit'
               CHECK (kind IN ('location', 'department', 'team', 'unit')),
  -- Materialisierter Pfad aus Unit-IDs: '/<root-id>/<...>/<eigene-id>'.
  -- Wird ausschliesslich vom Trigger gepflegt.
  org_path   text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Geschwister mit gleichem Namen verhindern; NULLS NOT DISTINCT, damit auch
-- zwei Wurzeln desselben Tenants nicht gleich heissen koennen (PG15+).
CREATE UNIQUE INDEX IF NOT EXISTS org_units_sibling_name_idx
  ON public.org_units (tenant_id, parent_id, name) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS org_units_tenant_path_idx
  ON public.org_units (tenant_id, org_path);

-- Pfadpflege + Schutzregeln. Warum Trigger statt Anwendungscode: Der Pfad
-- ist Entscheidungsgrundlage des PDP — er darf nicht davon abhaengen, dass
-- jeder Schreibpfad ihn korrekt setzt.
CREATE OR REPLACE FUNCTION public.org_units_maintain_path()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_row public.org_units;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.org_path := '/' || NEW.id;
    RETURN NEW;
  END IF;
  SELECT * INTO parent_row FROM public.org_units WHERE id = NEW.parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'org_units: parent % not found', NEW.parent_id;
  END IF;
  -- Baum darf Tenant-Grenzen nie ueberschreiten
  IF parent_row.tenant_id <> NEW.tenant_id THEN
    RAISE EXCEPTION 'org_units: parent belongs to another tenant';
  END IF;
  -- Zyklen-Schutz: der eigene Knoten darf nicht im Pfad des Parents liegen
  IF position('/' || NEW.id || '/' IN parent_row.org_path || '/') > 0 THEN
    RAISE EXCEPTION 'org_units: cycle detected';
  END IF;
  NEW.org_path := parent_row.org_path || '/' || NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_units_maintain_path_trg ON public.org_units;
CREATE TRIGGER org_units_maintain_path_trg
  BEFORE INSERT OR UPDATE OF parent_id ON public.org_units
  FOR EACH ROW EXECUTE FUNCTION public.org_units_maintain_path();

-- Beim Umhaengen eines Teilbaums die Pfade aller Nachfahren nachziehen.
CREATE OR REPLACE FUNCTION public.org_units_repath_descendants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.org_path IS DISTINCT FROM OLD.org_path THEN
    UPDATE public.org_units
       SET org_path = NEW.org_path || substr(org_path, length(OLD.org_path) + 1)
     WHERE tenant_id = NEW.tenant_id
       AND org_path LIKE OLD.org_path || '/%';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS org_units_repath_descendants_trg ON public.org_units;
CREATE TRIGGER org_units_repath_descendants_trg
  AFTER UPDATE OF org_path ON public.org_units
  FOR EACH ROW EXECUTE FUNCTION public.org_units_repath_descendants();

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_units_tenant_select ON public.org_units;
CREATE POLICY org_units_tenant_select
  ON public.org_units FOR SELECT
  USING (public.is_tenant_member(tenant_id));
-- Struktur aendern duerfen nur owner/admin — eine Org-Struktur ist
-- Governance-Stammdatum, kein Selbstbedienungsfeld.
DROP POLICY IF EXISTS org_units_admin_insert ON public.org_units;
CREATE POLICY org_units_admin_insert
  ON public.org_units FOR INSERT
  WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));
DROP POLICY IF EXISTS org_units_admin_update ON public.org_units;
CREATE POLICY org_units_admin_update
  ON public.org_units FOR UPDATE
  USING (public.is_tenant_owner_or_admin(tenant_id))
  WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));
DROP POLICY IF EXISTS org_units_admin_delete ON public.org_units;
CREATE POLICY org_units_admin_delete
  ON public.org_units FOR DELETE
  USING (public.is_tenant_owner_or_admin(tenant_id));

-- 2. Principals (user | service | agent | device) -----------------------------

CREATE TABLE IF NOT EXISTS public.principals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('user', 'service', 'agent', 'device')),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_unit_id  uuid REFERENCES public.org_units(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  -- Externe Identitaet (Geraete-ID, Agent-Name, Service-Account) fuer
  -- Zuordnung aus PEPs, die keine auth.users kennen.
  external_ref text,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS principals_tenant_user_idx
  ON public.principals (tenant_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS principals_tenant_external_idx
  ON public.principals (tenant_id, external_ref) WHERE external_ref IS NOT NULL;

ALTER TABLE public.principals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS principals_tenant_select ON public.principals;
CREATE POLICY principals_tenant_select
  ON public.principals FOR SELECT
  USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS principals_admin_write ON public.principals;
CREATE POLICY principals_admin_write
  ON public.principals FOR ALL
  USING (public.is_tenant_owner_or_admin(tenant_id))
  WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

-- 3. Rollen-Bindungen ---------------------------------------------------------
--
-- Additiv zu tenant_memberships (owner/admin/member/viewer bleiben dort
-- die Zugriffsrollen der App). role_bindings traegt die GOVERNANCE-Rollen,
-- die der Auftrag verlangt: Datenschutzbeauftragte, IT-Admin,
-- Compliance-Officer, Freigeber — mit Geltungsbereich Tenant oder Teilbaum.

CREATE TABLE IF NOT EXISTS public.role_bindings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  principal_id uuid NOT NULL REFERENCES public.principals(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN (
                 'owner', 'admin', 'member', 'viewer',
                 'dpo', 'it_admin', 'compliance_officer', 'approver', 'employee'
               )),
  scope_type   text NOT NULL DEFAULT 'tenant' CHECK (scope_type IN ('tenant', 'org_unit')),
  org_unit_id  uuid REFERENCES public.org_units(id) ON DELETE CASCADE,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope_type = 'tenant'   AND org_unit_id IS NULL) OR
    (scope_type = 'org_unit' AND org_unit_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS role_bindings_unique_idx
  ON public.role_bindings (principal_id, role, scope_type, org_unit_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS role_bindings_principal_idx
  ON public.role_bindings (tenant_id, principal_id);

ALTER TABLE public.role_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_bindings_tenant_select ON public.role_bindings;
CREATE POLICY role_bindings_tenant_select
  ON public.role_bindings FOR SELECT
  USING (public.is_tenant_member(tenant_id));
DROP POLICY IF EXISTS role_bindings_admin_write ON public.role_bindings;
CREATE POLICY role_bindings_admin_write
  ON public.role_bindings FOR ALL
  USING (public.is_tenant_owner_or_admin(tenant_id))
  WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

-- 4. PDP-Approval-Gates (P1-4) ------------------------------------------------
--
-- Warum eigene Tabelle statt governance_approvals: die ist mit
-- event_id NOT NULL UNIQUE fest an den Ingest-Event-Strom gekoppelt.
-- Ein PDP-Gate haengt an einer ENTSCHEIDUNG (Fingerprint des Requests),
-- nicht an einem Ingest-Event.

CREATE TABLE IF NOT EXISTS public.pdp_approval_gates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Deterministischer Fingerprint des Entscheidungs-Requests
  -- (approvalFingerprint() in _shared/pdp/core.ts). Eine Freigabe deckt
  -- genau die Wiederholung DERSELBEN Aktion, nichts Breiteres.
  fingerprint       text NOT NULL,
  policy_id         uuid,
  -- Rolle, die freigeben darf (role_bindings.role); owner/admin duerfen immer.
  approver_role     text NOT NULL DEFAULT 'approver',
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  -- Redaktionsarme Request-Zusammenfassung fuer den Freigeber (keine Inhalte,
  -- nur Kanal/Verb/Ziel/Klassifikation — Datenminimierung).
  request_summary   jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by      uuid REFERENCES public.principals(id) ON DELETE SET NULL,
  resolved_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at       timestamptz,
  resolution_reason text,
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Pro Fingerprint hoechstens EIN offenes Gate — wiederholte blockierte
-- Versuche erzeugen keine Gate-Flut (Plan R11).
CREATE UNIQUE INDEX IF NOT EXISTS pdp_approval_gates_pending_idx
  ON public.pdp_approval_gates (tenant_id, fingerprint) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS pdp_approval_gates_lookup_idx
  ON public.pdp_approval_gates (tenant_id, fingerprint, status, expires_at);

ALTER TABLE public.pdp_approval_gates ENABLE ROW LEVEL SECURITY;
-- Lesen: alle Tenant-Mitglieder (der Betroffene soll sein Gate sehen).
-- Schreiben: nur serverseitig (governance-approvals prueft die Rolle) —
-- deshalb keine Client-Write-Policy.
DROP POLICY IF EXISTS pdp_approval_gates_tenant_select ON public.pdp_approval_gates;
CREATE POLICY pdp_approval_gates_tenant_select
  ON public.pdp_approval_gates FOR SELECT
  USING (public.is_tenant_member(tenant_id));

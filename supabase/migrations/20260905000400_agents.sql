-- ADR 0011, D4 — agents: mandantenbezogene Agenten.
--
-- Entscheid des Eigentümers vom 2026-09-04 (Option A): `agent_profiles`
-- bleibt unangetastet der globale Katalog, den `20260624000000` bewusst
-- angelegt hat („Globale Katalog-Tabellen … Keine Tenant-Bindung",
-- Policy `USING (true)`). Mandantenbezogene Agenten bekommen ein eigenes
-- Zuhause, statt den Katalog umzudeuten. Kein bestehender Lesevertrag
-- ändert sich.
--
-- Warum das nötig ist — Befund B6 (ADR 0011): `onboarding-orchestrator`
-- legt heute pro Mandant eine Zeile in `agent_profiles` an, samt
-- firmenspezifischem `system_prompt`. Bei `USING (true)` läse jeder
-- eingeloggte Nutzer jedes Mandanten die Agenten aller anderen. Bisher ohne
-- Folgen — die vier vorhandenen Zeilen sind alle intern und die Function
-- wird von nirgends aufgerufen —, aber mit dem ersten echten Onboarding wäre
-- es ein Datenabfluss. Diese Tabelle ist das Ziel, auf das der Orchestrator
-- umgestellt wird; die Umstellung selbst ist ein eigener Schritt, weil drei
-- Tabellen per Fremdschlüssel am Katalog hängen.
--
-- DSGVO Art. 5 Abs. 1 lit. f / Art. 32: Mandantentrennung ab der ersten Zeile.
-- EU AI Act Art. 14: `org_unit_id` und `role_key` beantworten „wer
-- beaufsichtigt was" — ohne beides ist ein Agent nach ADR 0011 nicht
-- governance-fähig.

CREATE TABLE IF NOT EXISTS public.agents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- NOT NULL, anders als bei org_units: Ein mandantenbezogener Agent ohne
    -- Mandant ist ein Widerspruch. Der Platform-Scope-Fall aus D4 kann hier
    -- also nicht auftreten — die Policies unten führen ihn deshalb nicht als
    -- Zweig, statt ihn als toten Ast mitzuschleppen. Plattform-Agenten sind
    -- der Katalog `agent_profiles`.
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Wo der Agent in der Organisation hängt. NULL erlaubt: Ein Agent darf
    -- existieren, bevor die Organisation modelliert ist. Der Trigger unten
    -- hält die Zuordnung im selben Mandanten.
    org_unit_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,

    role_key    TEXT NOT NULL REFERENCES public.agent_roles(key),

    name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    description TEXT,

    -- Stilllegen statt Löschen (Prüfpfad, wie bei org_units und
    -- platform_operators). 'retired' ist Endzustand, nicht Löschung.
    status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'paused', 'retired')),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT agents_name_per_tenant UNIQUE (tenant_id, name)
);

COMMENT ON TABLE public.agents IS
    'Mandantenbezogene Agenten. Der globale Katalog interner Agenten bleibt '
    'public.agent_profiles — die beiden sind nicht dasselbe. ADR 0011, D4, Option A.';
COMMENT ON COLUMN public.agents.org_unit_id IS
    'Zustaendige Organisationseinheit, immer im selben Mandanten (Trigger).';

CREATE INDEX IF NOT EXISTS idx_agents_tenant   ON public.agents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_org_unit ON public.agents (org_unit_id);
CREATE INDEX IF NOT EXISTS idx_agents_role     ON public.agents (role_key);

DROP TRIGGER IF EXISTS trig_agents_updated_at ON public.agents;
CREATE TRIGGER trig_agents_updated_at
    BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Invariante: der Agent hängt in seinem eigenen Mandanten ─────────────────
-- Ein Fremdschlüssel auf org_units prüft nur, DASS die Einheit existiert —
-- nicht, dass sie demselben Mandanten gehört. Ohne diese Prüfung könnte ein
-- Agent unter eine fremde oder unter eine Plattform-Einheit gehängt werden,
-- und jede Auswertung entlang der Organisation liefe über die Mandantengrenze.
-- Dieselbe Klasse Fehler wie in org_units, eine Beziehung weiter.
-- SECURITY DEFINER, weil die Einheit nach RLS für den Aufrufer unsichtbar
-- sein kann und die Prüfung sie trotzdem lesen muss.
CREATE OR REPLACE FUNCTION public.agents_guard_org_unit_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
    unit_tenant UUID;
    unit_found  BOOLEAN;
BEGIN
    IF NEW.org_unit_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT true, o.tenant_id INTO unit_found, unit_tenant
    FROM public.org_units o WHERE o.id = NEW.org_unit_id;

    IF unit_found IS NULL THEN
        RAISE EXCEPTION 'agents: Organisationseinheit % existiert nicht', NEW.org_unit_id
            USING ERRCODE = '23503';
    END IF;

    IF unit_tenant IS DISTINCT FROM NEW.tenant_id THEN
        RAISE EXCEPTION
            'agents: Organisationseinheit gehoert zu einem anderen Scope (Einheit %, Agent %)',
            unit_tenant, NEW.tenant_id
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.agents_guard_org_unit_scope() IS
    'Haelt agents.org_unit_id im selben Mandanten wie den Agenten. ADR 0011, D4.';

DROP TRIGGER IF EXISTS trig_agents_guard_org_unit_scope ON public.agents;
CREATE TRIGGER trig_agents_guard_org_unit_scope
    BEFORE INSERT OR UPDATE OF org_unit_id, tenant_id ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.agents_guard_org_unit_scope();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Zwei Fälle statt drei, weil tenant_id NOT NULL ist: eigener Mandant und
-- alles andere. Lesen dürfen Mitglieder, Schreiben nur owner/admin (ADR 0005)
-- — ein Agent ist eine Zuständigkeit, keine Notiz.
--
-- Absichtlich NICHT enthalten: ein Lesezweig für Plattform-Operatoren. Das
-- wäre Cross-Tenant-Einsicht in Kundendaten und damit eine eigene
-- Datenschutzentscheidung, keine Nebenwirkung dieser Migration.
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agents_select ON public.agents;
CREATE POLICY agents_select
    ON public.agents FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS agents_insert ON public.agents;
CREATE POLICY agents_insert
    ON public.agents FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

-- USING und WITH CHECK, aus demselben Grund wie bei org_units und B1: Ohne
-- WITH CHECK liesse sich der Agent in einen fremden Mandanten umhaengen.
DROP POLICY IF EXISTS agents_update ON public.agents;
CREATE POLICY agents_update
    ON public.agents FOR UPDATE TO authenticated
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS agents_delete ON public.agents;
CREATE POLICY agents_delete
    ON public.agents FOR DELETE TO authenticated
    USING (public.is_tenant_owner_or_admin(tenant_id));

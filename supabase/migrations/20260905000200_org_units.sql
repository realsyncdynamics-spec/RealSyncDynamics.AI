-- ADR 0011, D4 — erste Tabelle der Agenten-Organisationsebene.
--
-- Reihenfolge aus D4: org_units → agent_roles → agents → agent_teams →
-- agent_tickets → agent_reports → agent_kg_* → agent_escalations.
-- platform_operators (20260905000100) kam davor, weil die erste
-- Platform-Scope-Policy is_platform_operator() bereits braucht.
--
-- Der Regel aus D4 folgend bringt diese Migration RLS, Policies und die
-- Invarianten in DERSELBEN Datei mit wie CREATE TABLE. Keine Tabelle wird
-- produktiv sichtbar, bevor ihre Policy existiert — ein Fenster zwischen zwei
-- Migrationen ist ein offenes Fenster (CLAUDE.md §5, public.integrations).
--
-- EU AI Act Art. 14 (menschliche Aufsicht): Die Organisationseinheit ist der
-- Ort, an dem die Zuständigkeit für einen Agenten hängt. Ohne sie ist
-- „wer beaufsichtigt wen" nicht beantwortbar.
-- DSGVO Art. 5 Abs. 1 lit. f / Art. 32: Mandantentrennung, siehe RLS unten.

CREATE TABLE IF NOT EXISTS public.org_units (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- NULL = Platform Scope (RSD-intern), NOT NULL = Tenant Scope.
    -- Die Spalte ist bewusst nullable — abweichend von CLAUDE.md §3, wo
    -- tenant_id NOT NULL gefordert ist. Der Grund steht in ADR 0011, D4: Die
    -- Organisationsebene kennt drei Fälle, nicht zwei, und der Platform Scope
    -- ist keiner, der einem Mandanten gehört. Die Policies unten behandeln
    -- beide Fälle ausdrücklich; es gibt keine Zeile, die durch eine Lücke
    -- zwischen ihnen sichtbar würde.
    tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,

    parent_id   UUID REFERENCES public.org_units(id) ON DELETE CASCADE,

    -- Stabiler Bezeichner für Code und Migrationen; name ist die Anzeige.
    key         TEXT NOT NULL CHECK (key ~ '^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$'),
    name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    description TEXT,

    -- Stilllegen ohne Löschen: Die Zeile bleibt als Nachweis erhalten, welche
    -- Einheit wann bestand (Prüfpfad). Löschen würde die Historie schneiden.
    active      BOOLEAN NOT NULL DEFAULT true,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.org_units IS
    'Organisationseinheiten der Agentenebene, hierarchisch. tenant_id NULL = '
    'Platform Scope (nur Plattform-Operatoren), sonst Tenant Scope. ADR 0011, D4.';
COMMENT ON COLUMN public.org_units.tenant_id IS
    'NULL = Platform Scope. Bewusste Ausnahme von der NOT-NULL-Regel aus '
    'CLAUDE.md §3 — Begründung in ADR 0011, D4.';

-- `key` ist je Scope eindeutig. Zwei Teilindizes statt UNIQUE NULLS NOT
-- DISTINCT: Letzteres gibt es erst ab PostgreSQL 15, und ein Index, der auf
-- jeder unterstützten Version dasselbe tut, ist die haltbarere Zusage.
CREATE UNIQUE INDEX IF NOT EXISTS org_units_key_per_tenant
    ON public.org_units (tenant_id, key) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS org_units_key_platform
    ON public.org_units (key) WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_units_tenant ON public.org_units (tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_units_parent ON public.org_units (parent_id);

DROP TRIGGER IF EXISTS trig_org_units_updated_at ON public.org_units;
CREATE TRIGGER trig_org_units_updated_at
    BEFORE UPDATE ON public.org_units
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Invarianten der Hierarchie ──────────────────────────────────────────────
-- Zwei Dinge, die eine Fremdschlüsselbeziehung allein nicht leisten kann.
--
-- 1. Die Hierarchie darf den Scope nicht überschreiten. Ohne diese Prüfung
--    könnte eine Mandanten-Einheit unter eine Plattform-Einheit gehängt
--    werden — und jede spätere Auswertung „alles unterhalb von X" würde
--    Mandantengrenzen überschreiten. Das ist der DENY-Fall aus D4, nur eine
--    Ebene tiefer. SECURITY DEFINER, weil die Prüfung die Elternzeile lesen
--    muss, die der Aufrufer nach RLS womöglich nicht sehen darf.
-- 2. Kein Zyklus. Ein Zyklus bricht nichts beim Einfügen, sondern erst beim
--    ersten rekursiven Lesen — dann aber als Endlosschleife. Solche Fehler
--    zeigen sich zur Unzeit; die Prüfung kostet hier fast nichts, weil
--    Organisationshierarchien flach sind.
CREATE OR REPLACE FUNCTION public.org_units_guard_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
    parent_tenant UUID;
    parent_exists BOOLEAN;
    walker        UUID;
    hops          INT := 0;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'org_units: eine Einheit kann nicht ihr eigenes Elternteil sein'
            USING ERRCODE = '23514';
    END IF;

    SELECT true, o.tenant_id INTO parent_exists, parent_tenant
    FROM public.org_units o WHERE o.id = NEW.parent_id;

    IF parent_exists IS NULL THEN
        RAISE EXCEPTION 'org_units: Elterneinheit % existiert nicht', NEW.parent_id
            USING ERRCODE = '23503';
    END IF;

    IF parent_tenant IS DISTINCT FROM NEW.tenant_id THEN
        RAISE EXCEPTION
            'org_units: Elterneinheit liegt in einem anderen Scope (Eltern-Mandant %, eigener Mandant %)',
            parent_tenant, NEW.tenant_id
            USING ERRCODE = '23514';
    END IF;

    -- Von der Elternzeile aufwärts laufen: Taucht die eigene id auf, wäre der
    -- Zyklus geschlossen. Die Obergrenze schützt vor einem bereits vorhandenen
    -- Zyklus (dann liefe die Schleife selbst endlos).
    walker := NEW.parent_id;
    WHILE walker IS NOT NULL AND hops < 64 LOOP
        IF walker = NEW.id THEN
            RAISE EXCEPTION 'org_units: die Änderung würde einen Zyklus in der Hierarchie schliessen'
                USING ERRCODE = '23514';
        END IF;
        SELECT o.parent_id INTO walker FROM public.org_units o WHERE o.id = walker;
        hops := hops + 1;
    END LOOP;

    IF hops >= 64 THEN
        RAISE EXCEPTION 'org_units: Hierarchie tiefer als 64 Ebenen — vermutlich ein Zyklus'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.org_units_guard_hierarchy() IS
    'Haelt die Hierarchie innerhalb eines Scopes und frei von Zyklen. ADR 0011, D4.';

DROP TRIGGER IF EXISTS trig_org_units_guard_hierarchy ON public.org_units;
CREATE TRIGGER trig_org_units_guard_hierarchy
    BEFORE INSERT OR UPDATE OF parent_id, tenant_id ON public.org_units
    FOR EACH ROW EXECUTE FUNCTION public.org_units_guard_hierarchy();

-- ── RLS: die drei Fälle aus D4, ausdrücklich ────────────────────────────────
-- tenant_id IS NULL          → Platform Scope → nur is_platform_operator()
-- tenant_id = eigener Mandant → Tenant Scope   → Mitglieder lesen, Admins schreiben
-- tenant_id = fremder Mandant → DENY (fällt aus beiden Bedingungen heraus)
--
-- Der Platform-Fall bekommt eine EIGENE, ausdrückliche Bedingung. Sich darauf
-- zu verlassen, dass is_tenant_member(NULL) false liefert, wäre eine Zusage
-- über eine Implementierung statt über eine Policy (ADR 0011, D4).
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_units_select ON public.org_units;
CREATE POLICY org_units_select
    ON public.org_units FOR SELECT TO authenticated
    USING (
        (tenant_id IS NULL     AND public.is_platform_operator())
        OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
    );

-- Schreiben ist Verwaltung, nicht Mitarbeit: im Mandanten nur owner/admin
-- (ADR 0005), im Platform Scope nur Plattform-Operatoren.
DROP POLICY IF EXISTS org_units_insert ON public.org_units;
CREATE POLICY org_units_insert
    ON public.org_units FOR INSERT TO authenticated
    WITH CHECK (
        (tenant_id IS NULL     AND public.is_platform_operator())
        OR (tenant_id IS NOT NULL AND public.is_tenant_owner_or_admin(tenant_id))
    );

-- USING und WITH CHECK beide gesetzt: Ohne WITH CHECK liesse sich eine Zeile
-- aus dem eigenen Mandanten heraus in einen fremden schieben — derselbe
-- Fehler wie in Befund B1, nur mit tenant_id statt is_super_admin.
DROP POLICY IF EXISTS org_units_update ON public.org_units;
CREATE POLICY org_units_update
    ON public.org_units FOR UPDATE TO authenticated
    USING (
        (tenant_id IS NULL     AND public.is_platform_operator())
        OR (tenant_id IS NOT NULL AND public.is_tenant_owner_or_admin(tenant_id))
    )
    WITH CHECK (
        (tenant_id IS NULL     AND public.is_platform_operator())
        OR (tenant_id IS NOT NULL AND public.is_tenant_owner_or_admin(tenant_id))
    );

DROP POLICY IF EXISTS org_units_delete ON public.org_units;
CREATE POLICY org_units_delete
    ON public.org_units FOR DELETE TO authenticated
    USING (
        (tenant_id IS NULL     AND public.is_platform_operator())
        OR (tenant_id IS NOT NULL AND public.is_tenant_owner_or_admin(tenant_id))
    );

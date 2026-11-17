-- PR C, Schritt 1: Veröffentlichte Seite ↔ Empfangsassistent (E9 = A, 02.11.2026).
-- ADDITIV / NON-BREAKING. Neue Tabelle + zwei Funktionen, keine Änderung an
-- bestehenden Objekten.
--
-- Zweck
--   Ein Kontaktformular auf einer veröffentlichten SiteOS-Seite
--   (`website_projects`) liefert Anfragen in den Posteingang eines Bots
--   (`bots`, nicht `bot_agents`). Das öffentliche Formular kennt dafür nur eine
--   nicht erratbare `site_ref` — niemals `tenant_id` oder `bot_id`.
--
-- Leitplanken
--   * Eine Seite = ein Eingang (unique website_project_id).
--   * `site_ref` wird ausschließlich serverseitig erzeugt (144 Bit Zufall,
--     base64url, 24 Zeichen) und ist danach unveränderlich. Ein vom Client
--     mitgeschickter Wert wird überschrieben.
--   * Seite UND Bot müssen zum Mandanten des Bindings gehören (Trigger).
--     Die Berechtigung wird im Trigger ZUERST geprüft: BEFORE-Trigger laufen
--     vor der RLS-Prüfung (WITH CHECK). Ohne diese Reihenfolge könnte ein
--     Angemeldeter über die Fehlerart ablesen, ob eine fremde Seite oder ein
--     fremder Bot existiert (gleiches Muster wie `bots_enforce_quota`).
--   * `tenant_id`, `website_project_id`, `site_ref`, `created_by` sind nach
--     dem Anlegen unveränderlich. Änderbar: `bot_id`, `enabled`.
--   * Lesen: Mitglieder des Mandanten. Anlegen/Ändern: Owner/Admin.
--     Kein DELETE für anon/authenticated — Abschalten über enabled = false.
--   * Auflösung fail-closed (`resolve_site_inbox`): nur wenn Binding aktiv,
--     Seite `live` und Bot aktiv; sonst keine Zeile. Nur service_role.
--   * Standardmäßig deaktiviert (enabled = false): Eine neue Verbindung nimmt
--     erst nach ausdrücklichem Einschalten Anfragen an.

CREATE TABLE IF NOT EXISTS public.site_inbox_bindings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    website_project_id  UUID NOT NULL REFERENCES public.website_projects(id) ON DELETE CASCADE,
    bot_id              UUID NOT NULL REFERENCES public.bots(id) ON DELETE RESTRICT,
    site_ref            TEXT NOT NULL,
    enabled             BOOLEAN NOT NULL DEFAULT false,
    created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    disabled_at         TIMESTAMPTZ,
    CONSTRAINT site_inbox_bindings_site_ref_format
        CHECK (site_ref ~ '^[A-Za-z0-9_-]{24}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_site_inbox_bindings_project
    ON public.site_inbox_bindings(website_project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_site_inbox_bindings_site_ref
    ON public.site_inbox_bindings(site_ref);
CREATE INDEX IF NOT EXISTS idx_site_inbox_bindings_tenant
    ON public.site_inbox_bindings(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_inbox_bindings_bot
    ON public.site_inbox_bindings(bot_id);

COMMENT ON TABLE public.site_inbox_bindings IS
    'PR C: Zuordnung veröffentlichte SiteOS-Seite → Bot-Posteingang. Öffentlicher Schlüssel ist site_ref (serverseitig erzeugt, unveränderlich).';

-- Serverseitige site_ref: 18 Zufallsbytes = 144 Bit, base64url ohne Padding.
CREATE OR REPLACE FUNCTION public.site_inbox_new_ref()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public, extensions, pg_temp
AS $$
    SELECT translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
$$;

REVOKE ALL ON FUNCTION public.site_inbox_new_ref() FROM PUBLIC, anon, authenticated;

-- Guard: Berechtigung → Unveränderlichkeit → Mandantengleichheit.
CREATE OR REPLACE FUNCTION public.site_inbox_bindings_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_project_tenant UUID;
    v_bot_tenant     UUID;
BEGIN
    -- 1. Berechtigung zuerst (siehe Kopfkommentar). Gleiche Meldung und
    --    gleicher SQLSTATE wie die RLS-Policy.
    IF auth.role() IN ('anon', 'authenticated')
       AND NOT public.is_tenant_owner_or_admin(NEW.tenant_id) THEN
        RAISE EXCEPTION 'new row violates row-level security policy for table "site_inbox_bindings"'
            USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Client-Wert ignorieren: site_ref entsteht nur hier.
        NEW.site_ref    := public.site_inbox_new_ref();
        NEW.created_at  := now();
        NEW.disabled_at := NULL;
        IF auth.role() IN ('anon', 'authenticated') THEN
            NEW.created_by := auth.uid();
        END IF;
    ELSE
        -- created_by darf nur auf NULL fallen: FK-Anonymisierung beim Löschen
        -- des Kontos (ON DELETE SET NULL, Art. 17 DSGVO). Jede andere Änderung
        -- bleibt verboten (Codex-Review 14.11.2026, P1).
        IF NEW.tenant_id          IS DISTINCT FROM OLD.tenant_id
           OR NEW.website_project_id IS DISTINCT FROM OLD.website_project_id
           OR NEW.site_ref        IS DISTINCT FROM OLD.site_ref
           OR (NEW.created_by     IS DISTINCT FROM OLD.created_by AND NEW.created_by IS NOT NULL)
           OR NEW.created_at      IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'site_inbox_bindings: immutable column changed'
                USING ERRCODE = '42501';
        END IF;
        IF OLD.enabled AND NOT NEW.enabled THEN
            NEW.disabled_at := now();
        ELSIF NEW.enabled AND NOT OLD.enabled THEN
            NEW.disabled_at := NULL;
        ELSE
            NEW.disabled_at := OLD.disabled_at;
        END IF;
        NEW.updated_at := now();
    END IF;

    -- 2. Seite und Bot müssen demselben Mandanten gehören.
    SELECT tenant_id INTO v_project_tenant
      FROM public.website_projects WHERE id = NEW.website_project_id;
    SELECT tenant_id INTO v_bot_tenant
      FROM public.bots WHERE id = NEW.bot_id;

    IF v_project_tenant IS NULL OR v_project_tenant <> NEW.tenant_id
       OR v_bot_tenant IS NULL OR v_bot_tenant <> NEW.tenant_id THEN
        RAISE EXCEPTION 'new row violates row-level security policy for table "site_inbox_bindings"'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.site_inbox_bindings_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_site_inbox_bindings_guard ON public.site_inbox_bindings;
CREATE TRIGGER trg_site_inbox_bindings_guard
    BEFORE INSERT OR UPDATE ON public.site_inbox_bindings
    FOR EACH ROW EXECUTE FUNCTION public.site_inbox_bindings_guard();

ALTER TABLE public.site_inbox_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_inbox_bindings tenant-read" ON public.site_inbox_bindings;
CREATE POLICY "site_inbox_bindings tenant-read"
    ON public.site_inbox_bindings FOR SELECT TO authenticated
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "site_inbox_bindings admin-insert" ON public.site_inbox_bindings;
CREATE POLICY "site_inbox_bindings admin-insert"
    ON public.site_inbox_bindings FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS "site_inbox_bindings admin-update" ON public.site_inbox_bindings;
CREATE POLICY "site_inbox_bindings admin-update"
    ON public.site_inbox_bindings FOR UPDATE TO authenticated
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

-- Kein DELETE und kein Zugriff für anon. Spaltenrechte für authenticated:
-- nur, was der Guard ohnehin zulässt.
REVOKE ALL ON public.site_inbox_bindings FROM anon, authenticated;
GRANT SELECT ON public.site_inbox_bindings TO authenticated;
GRANT INSERT (tenant_id, website_project_id, bot_id, enabled) ON public.site_inbox_bindings TO authenticated;
GRANT UPDATE (bot_id, enabled) ON public.site_inbox_bindings TO authenticated;
GRANT ALL ON public.site_inbox_bindings TO service_role;

-- Fail-closed Auflösung für die öffentliche Formular-Funktion (Schritt 3).
-- Liefert genau dann eine Zeile, wenn Binding aktiv, Seite live und Bot aktiv.
-- Unbekannt, deaktiviert, nicht live oder Bot aus → keine Zeile; der Aufrufer
-- antwortet einheitlich 404 und schreibt nichts.
CREATE OR REPLACE FUNCTION public.resolve_site_inbox(p_site_ref TEXT)
RETURNS TABLE (binding_id UUID, tenant_id UUID, bot_id UUID, website_project_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT b.id, b.tenant_id, b.bot_id, b.website_project_id
      FROM public.site_inbox_bindings b
      JOIN public.website_projects p ON p.id = b.website_project_id AND p.tenant_id = b.tenant_id
      JOIN public.bots bo            ON bo.id = b.bot_id           AND bo.tenant_id = b.tenant_id
     WHERE p_site_ref ~ '^[A-Za-z0-9_-]{24}$'
       AND b.site_ref = p_site_ref
       AND b.enabled
       AND p.status = 'live'
       AND bo.enabled;
$$;

REVOKE ALL ON FUNCTION public.resolve_site_inbox(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_site_inbox(TEXT) TO service_role;

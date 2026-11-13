-- Social-Designs des Creative Studio (Konva-JSON, mandantenisoliert).
--
-- Speichert das Editor-Dokument, nicht Binärdateien. preview_path bleibt leer,
-- bis ein privater Storage-Pfad angebunden ist. Diese Migration wird mit dem
-- PR nur eingecheckt und hier nicht gegen Produktion ausgeführt.
--
-- Schreiben: owner, admin, member. Lesen: jedes Mitglied, auch viewer.
-- tenant_id und created_by sind nach dem Insert unveränderlich.

CREATE TABLE public.social_designs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  format_id       text        NOT NULL,
  konva_json      jsonb       NOT NULL,
  brand_snapshot  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  preview_path    text,
  created_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at      timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at      timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT social_designs_title_len CHECK (char_length(title) BETWEEN 1 AND 160),
  CONSTRAINT social_designs_format_id_check CHECK (format_id IN (
    'instagram-feed-1080',
    'instagram-portrait-1080x1350',
    'story-1080x1920',
    'linkedin-landscape-1200x627',
    'landscape-1600x900'
  )),
  CONSTRAINT social_designs_json_object CHECK (
    jsonb_typeof(konva_json) = 'object' AND jsonb_typeof(brand_snapshot) = 'object'
  ),
  CONSTRAINT social_designs_json_size CHECK (octet_length(konva_json::text) <= 8000000),
  CONSTRAINT social_designs_preview_path_len CHECK (preview_path IS NULL OR char_length(preview_path) <= 512)
);

COMMENT ON TABLE public.social_designs IS
  'Social-Design-Dokumente (Konva-JSON) je Mandant. Keine Kanal-Tokens, keine KI-Läufe.';
COMMENT ON COLUMN public.social_designs.konva_json IS
  'Editor-Dokument Version 1: formatId, Ebenen, Token-Pfade. Keine Geheimnisse.';
COMMENT ON COLUMN public.social_designs.brand_snapshot IS
  'Aufgelöste Brand-Kit-Tokens zum Speicherzeitpunkt. Kein Zugangsgeheimnis.';
COMMENT ON COLUMN public.social_designs.preview_path IS
  'Reserviert für einen späteren privaten Storage-Pfad. In diesem Schnitt immer NULL.';

CREATE INDEX social_designs_tenant_updated_idx
  ON public.social_designs (tenant_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.social_designs_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'social_designs.tenant_id is immutable';
    END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'social_designs.created_by is immutable';
    END IF;
  END IF;
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER social_designs_guard
  BEFORE INSERT OR UPDATE ON public.social_designs
  FOR EACH ROW EXECUTE FUNCTION public.social_designs_guard();

ALTER TABLE public.social_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_designs_select_member
  ON public.social_designs
  FOR SELECT
  TO authenticated
  USING (public.has_tenant_membership(tenant_id));

CREATE POLICY social_designs_insert_editor
  ON public.social_designs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM public.tenant_memberships AS membership
       WHERE membership.tenant_id = social_designs.tenant_id
         AND membership.user_id = auth.uid()
         AND membership.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY social_designs_update_editor
  ON public.social_designs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tenant_memberships AS membership
       WHERE membership.tenant_id = social_designs.tenant_id
         AND membership.user_id = auth.uid()
         AND membership.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.tenant_memberships AS membership
       WHERE membership.tenant_id = social_designs.tenant_id
         AND membership.user_id = auth.uid()
         AND membership.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY social_designs_delete_editor
  ON public.social_designs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.tenant_memberships AS membership
       WHERE membership.tenant_id = social_designs.tenant_id
         AND membership.user_id = auth.uid()
         AND membership.role IN ('owner', 'admin', 'member')
    )
  );

REVOKE ALL ON TABLE public.social_designs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_designs TO authenticated;
GRANT ALL ON TABLE public.social_designs TO service_role;

REVOKE ALL ON FUNCTION public.social_designs_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.social_designs_guard() TO authenticated, service_role;

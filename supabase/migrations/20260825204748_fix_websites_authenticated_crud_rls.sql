-- Nachgezogen am 2026-08-30 aus dem Produktions-Ledger.
--
-- WARUM DIESE DATEI NACHTRÄGLICH ENTSTEHT
--
-- Diese Migration wurde am 2026-08-25 direkt gegen die Produktionsdatenbank
-- angewandt und ist dort unter `20260825204748` verbucht — eine Datei im Repo
-- gab es nie. Damit kannte das Repo die Sicherheitslage der Live-Datenbank
-- nicht: Wer lokal `supabase db reset` ausführte, bekam eine `websites`-Tabelle
-- ohne INSERT/UPDATE/DELETE-Policies und damit ein anderes Verhalten als live.
--
-- Der Inhalt ist wortgleich aus `supabase_migrations.schema_migrations`
-- übernommen, nicht rekonstruiert. Version und Name entsprechen dem Ledger,
-- damit `supabase db push` sie als bereits angewandt erkennt und nicht erneut
-- ausführt. Für eine frische lokale Datenbank stellt sie denselben Stand her.
--
-- Sicherheitsrelevanz: Die Policies binden jeden Schreibzugriff an
-- `is_tenant_member(tenant_id)` — Mandantentrennung nach §3. Ohne sie
-- scheiterte jedes Anlegen einer Website an der RLS.

-- Fix authenticated CRUD access for the Websites workspace.
-- SELECT already existed; INSERT/UPDATE/DELETE were missing, causing:
-- new row violates row-level security policy for table "websites"

DROP POLICY IF EXISTS websites_tenant_insert ON public.websites;
DROP POLICY IF EXISTS websites_tenant_update ON public.websites;
DROP POLICY IF EXISTS websites_tenant_delete ON public.websites;

CREATE POLICY websites_tenant_insert
ON public.websites
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY websites_tenant_update
ON public.websites
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (public.is_tenant_member(tenant_id))
WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY websites_tenant_delete
ON public.websites
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (public.is_tenant_member(tenant_id));

-- =============================================================================
-- NICHT AKTIVIERT. Kein Migrationsdateiname, kein db push, kein Deploy.
-- Rueckbau-Entwurf fuer public.tenant_memberships NACH AP2 und nach einem
-- Beobachtungszeitraum. Erst ausfuehren, wenn Dominik den Entwurf freigibt
-- UND die Session-Variable gesetzt ist. Ohne diese Variable bricht die Datei
-- ab, bevor etwas geloescht wird.
--
--   SET ap2.allow_decommission = 'yes';
--
-- Voraussetzung: 20261120160200_ap2_memberships_single_source.sql ist angewendet
-- und keine Policy, Funktion oder View ausser der Tabelle selbst liest sie.
-- has_tenant_membership bleibt als Kompatibilitaetsname auf memberships.
-- =============================================================================

DO $ap2_draft_guard$
BEGIN
  IF current_setting('ap2.allow_decommission', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION
      'NICHT AKTIVIERT. Rueckbau von tenant_memberships ist ein Entwurf. SET ap2.allow_decommission = ''yes'' nur nach Freigabe und Beobachtungszeitraum.';
  END IF;
END
$ap2_draft_guard$;

DO $ap2_draft_pre$
DECLARE
  leftover text;
BEGIN
  IF to_regclass('public.tenant_memberships') IS NULL THEN
    RAISE EXCEPTION 'Entwurf: public.tenant_memberships existiert nicht.';
  END IF;

  SELECT string_agg(c.relname || ' / ' || p.polname, ', ')
    INTO leftover
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname <> 'tenant_memberships'
     AND (
       coalesce(pg_get_expr(p.polqual, p.polrelid), '') ILIKE '%tenant_memberships%'
       OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ILIKE '%tenant_memberships%'
     );
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Entwurf abgebrochen, Policies haengen noch an tenant_memberships: %', leftover;
  END IF;

  SELECT string_agg(p.proname, ', ')
    INTO leftover
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosrc ILIKE '%tenant_memberships%';
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'Entwurf abgebrochen, Funktionen lesen tenant_memberships noch: %', leftover;
  END IF;
END
$ap2_draft_pre$;

-- Erst hier, und nur mit der Session-Variable, wuerde die Tabelle wegfallen.
-- DROP TABLE entfernt die eigenen Policies self-read und deny-writes mit.
DROP TABLE public.tenant_memberships;

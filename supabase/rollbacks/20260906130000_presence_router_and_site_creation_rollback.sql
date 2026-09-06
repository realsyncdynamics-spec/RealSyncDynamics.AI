-- RÜCKWEG zu 20260906130000_presence_router_and_site_creation.sql
--
-- ⚠️ WIRD NIEMALS AUTOMATISCH AUSGEFÜHRT. Liegt in `supabase/rollbacks/`
-- und damit ausserhalb des CLI-Scan-Pfads — Begründung im Kopf des
-- Rückwegs zu 20260906120000 und in CLAUDE.md §2.
--
-- Ausführung von Hand, mit Vorsatz:
--     psql "$DATABASE_URL" -f supabase/rollbacks/20260906130000_..._rollback.sql
-- und danach die Zeile aus `supabase_migrations.schema_migrations` entfernen.
--
-- ⚠️ WAS DIESER RÜCKWEG WIRKLICH ZURÜCKNIMMT — bitte lesen, bevor er läuft:
--
--   * Die Schranke „kein Publish ohne angenommenen AVV" fällt weg. Danach
--     kann eine Presence Site online gehen, ohne dass ein
--     Auftragsverarbeitungsvertrag vorliegt (DSGVO Art. 28).
--   * Neue Sites registrieren ihr KI-System nicht mehr selbst. Danach
--     entstehen Websites mit Lead-Assistent, die in keinem
--     Governance-Bestand stehen — genau der Zustand, den dieses Produkt bei
--     seinen Kunden aufdeckt.
--   * Das Tabellenrecht für `anon` bleibt zurückgenommen. Es wird hier
--     bewusst NICHT wiederhergestellt: Es war nie beabsichtigt, sondern kam
--     aus den Default-Privileges (§7 des Hinwegs). Einen Befund im Rückweg
--     wieder herzustellen wäre die falsche Art von Symmetrie.
--
-- Der Guard unten bricht ab, solange veröffentlichte Sites bestehen — sie
-- verlören mit dem Trigger ihre Absicherung.

BEGIN;

-- ============================================================
-- Guard
-- ============================================================

DO $$
DECLARE
    v_live BIGINT;
BEGIN
    SELECT count(*) INTO v_live
    FROM public.presence_sites WHERE status = 'published';

    IF v_live > 0 THEN
        RAISE EXCEPTION
            'Rückweg abgebrochen: % veröffentlichte Presence Site(s). '
            'Ohne den Trigger entfällt die AVV-Schranke (DSGVO Art. 28) für sie. '
            'Erst depublizieren oder den Guard bewusst entfernen.', v_live;
    END IF;
END $$;

-- ============================================================
-- 1. Trigger und Trigger-Funktionen (Abschnitte 3-4)
-- ============================================================

DROP TRIGGER IF EXISTS presence_sites_guard_publish_trg  ON public.presence_sites;
DROP TRIGGER IF EXISTS presence_sites_a_bootstrap_trg    ON public.presence_sites;

DROP FUNCTION IF EXISTS public.presence_sites_guard_publish();
DROP FUNCTION IF EXISTS public.presence_sites_bootstrap();

-- ============================================================
-- 2. Auflösung und Hindernis-Auskunft (Abschnitte 2, 5)
-- ============================================================

DROP FUNCTION IF EXISTS public.presence_resolve_host(TEXT);
DROP FUNCTION IF EXISTS public.presence_publish_blockers(UUID);

-- ============================================================
-- 3. Verknüpfung Site → KI-System (Abschnitt 1)
-- ============================================================
--
-- Die erzeugten `ai_systems`-Zeilen bleiben stehen. Ein registriertes
-- KI-System ist ein Eintrag im Governance-Bestand; ihn beim Rückbau einer
-- Verknüpfung mitzulöschen hiesse, Prüfpfad zu entfernen, weil sich eine
-- Spalte ändert.

DROP INDEX IF EXISTS public.presence_sites_ai_system_idx;
ALTER TABLE public.presence_sites DROP COLUMN IF EXISTS ai_system_id;

COMMIT;

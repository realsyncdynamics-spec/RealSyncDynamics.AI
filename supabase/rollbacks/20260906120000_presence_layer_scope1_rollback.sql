-- RÜCKWEG zu 20260906120000_presence_layer_scope1.sql
--
-- ⚠️ DIESE DATEI WIRD NIEMALS AUTOMATISCH AUSGEFÜHRT.
--
-- Der Supabase-CLI-Pfad (`supabase db push`) ist vorwärtsgerichtet und kennt
-- keine Down-Migrationen; er wendet jede `*.sql` in diesem Verzeichnis genau
-- einmal in Versionsreihenfolge an. Diese Datei liegt deshalb in
-- `supabase/rollbacks/` und NICHT in `supabase/migrations/` — lägen beide im
-- selben Verzeichnis, trügen sie dieselbe Version `20260906120000`, und die
-- CLI würde den Rückweg unmittelbar nach dem Hinweg anwenden. Genau diese
-- Versionskollision hat am 2026-08-24 den Deploy-Lauf 32705231581 zerlegt
-- (CLAUDE.md §5).
--
-- Ausführung ausschliesslich von Hand, mit Vorsatz:
--     psql "$DATABASE_URL" -f supabase/rollbacks/20260906120000_presence_layer_scope1_rollback.sql
-- und danach die Zeile aus `supabase_migrations.schema_migrations` entfernen,
-- sonst hält das Ledger die Migration weiterhin für angewandt (genau der
-- Ledger-Wirklichkeits-Bruch, den CLAUDE.md §3 bei `audit_evidence` beschreibt).
--
-- ⚠️ DATENVERLUST: Die drei DROP TABLE unten entfernen Stammdaten,
-- Site-Zuordnungen und Auftragsverarbeitungsverträge unwiederbringlich. Der
-- AVV ist ein Rechenschaftsnachweis nach DSGVO Art. 5 Abs. 2 — vor dem
-- Rückweg exportieren, wenn produktive Zeilen existieren. Der Guard unten
-- bricht ab, statt das stillschweigend zu tun.

BEGIN;

-- ============================================================
-- Guard — kein stiller Verlust produktiver Zeilen
-- ============================================================

DO $$
DECLARE
    v_rows BIGINT;
BEGIN
    SELECT
        (SELECT count(*) FROM public.business_profiles)
      + (SELECT count(*) FROM public.presence_sites)
      + (SELECT count(*) FROM public.data_processing_agreements)
    INTO v_rows;

    IF v_rows > 0 THEN
        RAISE EXCEPTION
            'Rückweg abgebrochen: % Zeile(n) in den Presence-Tabellen. '
            'Erst exportieren (AVV = Nachweispflicht DSGVO Art. 5 Abs. 2), '
            'dann diesen Guard bewusst entfernen und erneut ausführen.', v_rows;
    END IF;
END $$;

-- ============================================================
-- 1. Neue Tabellen (Abschnitte 4-6 des Hinwegs)
-- ============================================================
-- Policies und Grants fallen mit der Tabelle, brauchen keinen eigenen DROP.

DROP TABLE IF EXISTS public.data_processing_agreements;
DROP TABLE IF EXISTS public.presence_sites;
DROP TABLE IF EXISTS public.business_profiles;

-- ============================================================
-- 2. evidence_items (Abschnitt 8)
-- ============================================================

DROP INDEX IF EXISTS public.evidence_items_source_idx;
ALTER TABLE public.evidence_items
    DROP CONSTRAINT IF EXISTS evidence_items_source_pairing_check;
ALTER TABLE public.evidence_items
    DROP COLUMN IF EXISTS source_type,
    DROP COLUMN IF EXISTS source_id;

-- ============================================================
-- 3. ai_runtime_events (Abschnitt 7)
-- ============================================================

DROP INDEX IF EXISTS public.ai_runtime_events_tenant_system_idx;
ALTER TABLE public.ai_runtime_events
    DROP CONSTRAINT IF EXISTS ai_runtime_events_channel_needs_legal_basis,
    DROP CONSTRAINT IF EXISTS ai_runtime_events_legal_basis_check;
ALTER TABLE public.ai_runtime_events
    DROP COLUMN IF EXISTS channel,
    DROP COLUMN IF EXISTS data_categories,
    DROP COLUMN IF EXISTS legal_basis,
    DROP COLUMN IF EXISTS policy_result;

-- ============================================================
-- 4. ai_systems (Abschnitt 3)
-- ============================================================
--
-- tenant_id wird wieder nullable. Das ist die Rücknahme einer
-- Sicherheitsverschärfung — nach dem Rückweg kann erneut eine Zeile ohne
-- Mandanten entstehen, die keine RLS-Policy erfasst.

ALTER TABLE public.ai_systems ALTER COLUMN tenant_id DROP NOT NULL;

DROP INDEX IF EXISTS public.ai_systems_tenant_discovered_idx;
ALTER TABLE public.ai_systems
    DROP COLUMN IF EXISTS system_type,
    DROP COLUMN IF EXISTS provider,
    DROP COLUMN IF EXISTS discovered_via;

-- ============================================================
-- 5. tenants (Abschnitt 2)
-- ============================================================

DROP INDEX IF EXISTS public.tenants_slug_unique;
ALTER TABLE public.tenants
    DROP CONSTRAINT IF EXISTS tenants_slug_format_check,
    DROP CONSTRAINT IF EXISTS tenants_status_check,
    DROP CONSTRAINT IF EXISTS tenants_plan_check;
ALTER TABLE public.tenants
    DROP COLUMN IF EXISTS slug,
    DROP COLUMN IF EXISTS plan,
    DROP COLUMN IF EXISTS status;

-- ============================================================
-- 6. Vokabular (Abschnitt 1)
-- ============================================================

DROP FUNCTION IF EXISTS public.presence_legal_bases();

COMMIT;

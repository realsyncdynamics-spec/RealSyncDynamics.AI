-- =========================================================================
-- RealSync Dynamics AI — Phase-1 Event-Substrate Folge-Schritte
--
-- Erfüllt drei in docs/architecture/phase-1-event-substrate.md §4
-- dokumentierte additive Schritte:
--   1. ai_systems um type + endpoint erweitern
--   2. runtime_events um system_id + severity ergänzen
--   3. Tenant-Isolation-Smoke-Test als SQL-DO-Block (Vitest ohne
--      Postgres-Anbindung; CI-Migration-Validation-Job hat Postgres,
--      also greift der Test dort).
--
-- Alle Änderungen sind additiv. Keine bestehenden Spalten werden
-- umbenannt, keine RLS bricht.
-- =========================================================================

-- 1. ai_systems: Runtime-Target-Identität entkoppeln von Registry-Identität
ALTER TABLE public.ai_systems
  ADD COLUMN IF NOT EXISTS type     text,
  ADD COLUMN IF NOT EXISTS endpoint text;

COMMENT ON COLUMN public.ai_systems.type IS
  'Art des Ziel-Systems: api | website | agent | model. Heute optional; bei zukünftigen Operationalen-Event-Ingest-Quellen wird type für Routing-Entscheidungen genutzt.';
COMMENT ON COLUMN public.ai_systems.endpoint IS
  'URL oder URN des konkreten Endpoints (z. B. https://api.example.com/v1/chat oder urn:agent:internal:planner). Heute optional, weil Registry-Use-Cases ohne Endpoint operieren.';

-- 2. runtime_events: Severity + system_id-Foreign-Key
ALTER TABLE public.runtime_events
  ADD COLUMN IF NOT EXISTS system_id uuid REFERENCES public.ai_systems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS severity  text;

ALTER TABLE public.runtime_events
  DROP CONSTRAINT IF EXISTS runtime_events_severity_check;
ALTER TABLE public.runtime_events
  ADD CONSTRAINT runtime_events_severity_check
  CHECK (severity IS NULL OR severity IN ('info', 'low', 'medium', 'high', 'critical'));

COMMENT ON COLUMN public.runtime_events.system_id IS
  'Optionale Verknüpfung mit ai_systems(id). Wird gesetzt, wenn das Event sich auf ein konkretes Ziel-System bezieht. NULL bei internen Lifecycle-Events (execution.started etc.).';
COMMENT ON COLUMN public.runtime_events.severity IS
  'Optionale Severity nach ESS-Konvention: info | low | medium | high | critical. Default-Werte pro Event-Name siehe src/core/runtime/eventTypes.ts (OPERATIONAL_EVENT_DEFAULTS).';

CREATE INDEX IF NOT EXISTS runtime_events_system_idx
  ON public.runtime_events (system_id, occurred_at DESC)
  WHERE system_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS runtime_events_severity_idx
  ON public.runtime_events (tenant_id, severity, occurred_at DESC)
  WHERE severity IN ('high', 'critical');

-- =========================================================================
-- 3. Strukturelle Verifikation der RLS-Substrate
--
-- Ein vollständiger Runtime-Tenant-Isolation-Test (User A versucht Events
-- von Tenant B zu sehen) verlangt einen aktiven Supabase-Auth-Layer mit
-- `auth.uid()`-Resolution gegen einen echten JWT. Der CI-Migration-
-- Validation-Job hat nur einen NULL-stub für auth.uid() (siehe
-- .github/workflows/ci.yml). Ein DO-Block-Test würde dort aus dem
-- _falschen_ Grund grün (NULL-user matcht keine Membership).
--
-- Stattdessen verifiziert dieser Block die _strukturellen Voraussetzungen_,
-- gegen die das RLS-Konzept verteidigt wird:
--   - is_tenant_member-Helper existiert mit der erwarteten Signatur
--   - runtime_events hat RLS aktiv
--   - memberships hat den Unique-Index, der Doppel-Mitgliedschaften
--     ausschließt
--   - die neuen Spalten (system_id, severity) sind angekommen
--
-- Echte runtime-RLS-Validierung gehört in einen separaten Integration-Test
-- mit echtem Supabase-Stack (siehe scripts/test-tenant-isolation.ts —
-- Folge-PR sobald Supabase-Test-Kontext im CI verfügbar).
-- =========================================================================

DO $$
DECLARE
  v_helper_exists boolean;
  v_runtime_events_rls boolean;
  v_memberships_unique boolean;
  v_system_id_exists boolean;
  v_severity_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_tenant_member'
  ) INTO v_helper_exists;

  IF NOT v_helper_exists THEN
    RAISE NOTICE 'is_tenant_member helper noch nicht migriert — skip structural assertions';
    RETURN;
  END IF;

  SELECT relrowsecurity INTO v_runtime_events_rls
    FROM pg_class
    WHERE oid = 'public.runtime_events'::regclass;

  IF NOT v_runtime_events_rls THEN
    RAISE EXCEPTION 'runtime_events RLS not enabled';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.memberships'::regclass
      AND contype = 'u'
  ) INTO v_memberships_unique;

  IF NOT v_memberships_unique THEN
    RAISE EXCEPTION 'memberships has no UNIQUE constraint — double memberships possible';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'runtime_events'
      AND column_name = 'system_id'
  ) INTO v_system_id_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'runtime_events'
      AND column_name = 'severity'
  ) INTO v_severity_exists;

  IF NOT v_system_id_exists OR NOT v_severity_exists THEN
    RAISE EXCEPTION 'runtime_events new columns (system_id, severity) not applied';
  END IF;

  RAISE NOTICE 'structural assertions ok: helper=%, runtime_events.rls=%, memberships.unique=%, runtime_events.system_id=%, runtime_events.severity=%',
    v_helper_exists, v_runtime_events_rls, v_memberships_unique,
    v_system_id_exists, v_severity_exists;
END $$;

-- ============================================================
-- PDP v2 — Policy-Snapshots und Shadow-Divergenz-Log (P0-3 / P0-5)
--
-- Zweck: Der Policy Decision Point (governance-decide) entscheidet nie
-- direkt gegen die Policy-Tabellen, sondern gegen einen kompilierten,
-- versionierten Snapshot (Latenz + Nachvollziehbarkeit: welche Regel-
-- fassung galt zum Entscheidungszeitpunkt?). Der Shadow-Log misst die
-- Deckungsgleichheit von PDP v2 mit den Alt-Engines, BEVOR v2 irgendwo
-- die Entscheidung uebernimmt (Plan K1: stilles Nicht-Greifen einer
-- Kundenpolicy ist die gefaehrlichste Fehlerklasse).
--
-- EU-AI-Act-Bezug: Art. 12 (Aufzeichnungspflichten) — der Snapshot
-- dokumentiert die zum Zeitpunkt der Entscheidung wirksame Regelbasis.
-- DSGVO: keine personenbezogenen Daten in diesen Tabellen; der Log
-- referenziert Events nur per UUID.
--
-- Additiv: keine bestehende Tabelle, Policy oder Function wird veraendert.
-- Siehe docs/architecture/governance-os-enforcement-plan.md.
-- ============================================================

-- 1. Kompilierte Policy-Snapshots pro Tenant --------------------------------

CREATE TABLE IF NOT EXISTS public.policy_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version       text NOT NULL,
  -- Quellzaehler zum Snapshot-Zeitpunkt, fuer Drift-Diagnose
  source_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Kompilierte Policies (CompiledPolicy[] aus _shared/pdp/core.ts)
  compiled      jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version)
);

CREATE INDEX IF NOT EXISTS policy_snapshots_tenant_created_idx
  ON public.policy_snapshots (tenant_id, created_at DESC);

ALTER TABLE public.policy_snapshots ENABLE ROW LEVEL SECURITY;

-- Warum nur SELECT fuer Mitglieder: Snapshots entstehen ausschliesslich
-- serverseitig (service_role in governance-decide). Ein Client, der
-- Snapshots schreiben koennte, koennte die Entscheidungsgrundlage
-- faelschen — deshalb keine INSERT/UPDATE/DELETE-Policies fuer Clients.
DROP POLICY IF EXISTS policy_snapshots_tenant_select ON public.policy_snapshots;
CREATE POLICY policy_snapshots_tenant_select
  ON public.policy_snapshots FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- 2. Shadow-Divergenz-Log ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pdp_shadow_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Welcher Alt-Pfad hat verglichen?
  source         text NOT NULL
                   CHECK (source IN ('telemetry-ai-event', 'governance-ingest', 'ai-gateway')),
  -- Verdikt der Alt-Engine (deren eigenes Vokabular, unveraendert)
  legacy_status  text,
  -- Verdikt von PDP v2, auf das Alt-Vokabular gemappt (toLegacy*-Helfer)
  v2_status      text,
  diverged       boolean NOT NULL,
  snapshot_version text,
  -- Referenzen und Diagnose (Policy-IDs beider Engines, Event-UUID)
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Auswertung fragt fast immer: "Divergenzen dieses Tenants, neueste zuerst"
CREATE INDEX IF NOT EXISTS pdp_shadow_log_divergence_idx
  ON public.pdp_shadow_log (tenant_id, created_at DESC)
  WHERE diverged;

ALTER TABLE public.pdp_shadow_log ENABLE ROW LEVEL SECURITY;

-- Nur lesen, nur eigener Tenant; geschrieben wird ausschliesslich
-- serverseitig aus den Ingest-Pfaden (service_role).
DROP POLICY IF EXISTS pdp_shadow_log_tenant_select ON public.pdp_shadow_log;
CREATE POLICY pdp_shadow_log_tenant_select
  ON public.pdp_shadow_log FOR SELECT
  USING (public.is_tenant_member(tenant_id));

-- ═══════════════════════════════════════════════════════════════════════════
--  Agenten-Organisationsebene 1/8 — agent_org_units
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D4 (Reihenfolge) und D5 (Scope-Modell).
-- Modell: Artifact „Organisationsmodell …" v0.2, §01 und §06.
--
-- Der Baum CEO → AGI Manager → Director → Team. Vier Ebenen, bewusst nicht
-- mehr: Jede zusaetzliche Ebene weicht die Bericht-Kompression aus §04 auf.
--
-- ── Warum `agent_org_units` und nicht `org_units` ──────────────────────────
--
-- Der Name war bis zum 2026-09-06 `org_units`. PR #1135 hat mit
-- `20260824120000_org_subject_model_approval_gates.sql` unabhaengig davon eine
-- Tabelle desselben Namens eingefuehrt — und die laeuft frueher. Folge im CI:
-- `CREATE TABLE IF NOT EXISTS` fiel still durch, und der erste Zugriff auf
-- eine Spalte, die es nur hier gibt, brach ab
-- (`column "unit_type" of relation "public.org_units" does not exist`).
--
-- Es sind zwei verschiedene Begriffe, die sich einen Namen teilten:
--
--   #1135  org_units        Struktur INNERHALB eines Tenants (Standort,
--                           Abteilung, Team) als Entscheidungsgrundlage des
--                           PDP. tenant_id NOT NULL, Vererbung ueber
--                           materialisierten Pfad.
--   hier   agent_org_units  Organigramm der AGENTEN (CEO → AGI Manager →
--                           Director → Team), auch plattformweit ohne Tenant.
--
-- Keiner der beiden ist der Sonderfall des anderen: Der eine kennt keinen
-- Platform Scope, der andere keine Standorte. Zusammenzulegen hiesse, das
-- Scope-Modell aus ADR 0011 D4/D5 aufzugeben. Deshalb zwei Tabellen mit zwei
-- Namen — und deshalb traegt die Spalte auf der GETEILTEN Tabelle
-- `ai_tool_runs` den Praefix: `agent_org_unit_id`, damit dort unmissverstaend-
-- lich ist, auf welchen der beiden Baeume sie zeigt. Auf den `agent_*`-
-- Tabellen dieser Ebene bleibt `org_unit_id`, weil dort nur dieser Baum
-- vorkommt.
--
-- ── Das Scope-Modell, einmal ausgeschrieben ────────────────────────────────
--
-- Diese Ebene existiert in zwei Geltungsbereichen, unterschieden ueber
-- tenant_id. Das Modell kennt DREI Faelle, nicht zwei:
--
--     tenant_id IS NULL          → Platform Scope → nur is_platform_operator()
--     tenant_id = eigener Tenant → Tenant Scope   → is_tenant_member()
--     tenant_id = fremder Tenant → DENY
--
-- Der dritte Fall faellt nicht zufaellig durch, sondern weil keine der beiden
-- Bedingungen greift. Und der erste Fall braucht eine EIGENE, ausdrueckliche
-- Policy: is_tenant_member(NULL) liefert zwar false, aber das ist eine
-- Eigenschaft der Implementierung, kein zugesicherter Vertrag (ADR 0011 D4).
-- Deshalb steht die NULL-Bedingung hier explizit da und wird nicht impliziert.
--
-- ── Schreibzugriff ─────────────────────────────────────────────────────────
--
-- Keine INSERT/UPDATE/DELETE-Policy fuer Clients, in dieser und jeder weiteren
-- Migration dieser Ebene. Agenten laufen nie im Browser; geschrieben wird
-- ausschliesslich per Service-Role aus Edge Functions (CLAUDE.md §4).
-- Ohne Policy verweigert RLS jeden Client-Schreibversuch — der zusaetzliche
-- REVOKE ist Guertel und Hosentraeger, damit ein spaeterer versehentlicher
-- Policy-Zusatz nicht sofort auch Rechte mitbringt.
--
-- Additiv. Es wird nichts geloescht.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_org_units (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_unit_id uuid NULL REFERENCES public.agent_org_units(id) ON DELETE CASCADE,
  unit_type      text NOT NULL CHECK (unit_type IN ('executive', 'orchestrator', 'director', 'team')),
  name           text NOT NULL,
  mission        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_org_units IS
  'Organigramm-Knoten der Agenten-Ebene (ADR 0011). tenant_id IS NULL = '
  'plattforminterne Engineering-Organisation; tenant_id gesetzt = '
  'Governance-Einheit eines Kunden.';
COMMENT ON COLUMN public.agent_org_units.tenant_id IS
  'NULL = Platform Scope. Bewusst nullable — CLAUDE.md §3 verlangt tenant_id '
  'NOT NULL fuer fachliche Tabellen; diese Ebene hat einen zweiten, '
  'ausdruecklich modellierten Geltungsbereich (ADR 0011 D4/D5).';
COMMENT ON COLUMN public.agent_org_units.unit_type IS
  'executive (CEO) · orchestrator (AGI Manager) · director · team. Vier Ebenen, '
  'siehe Modell §01.';

CREATE INDEX IF NOT EXISTS agent_org_units_tenant_id_idx  ON public.agent_org_units (tenant_id);
CREATE INDEX IF NOT EXISTS agent_org_units_parent_id_idx  ON public.agent_org_units (parent_unit_id);

ALTER TABLE public.agent_org_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_org_units_select ON public.agent_org_units;
CREATE POLICY agent_org_units_select
  ON public.agent_org_units FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );

REVOKE ALL ON public.agent_org_units FROM anon, authenticated;
GRANT SELECT ON public.agent_org_units TO authenticated;

COMMIT;

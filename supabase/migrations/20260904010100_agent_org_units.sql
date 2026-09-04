-- ═══════════════════════════════════════════════════════════════════════════
--  Agenten-Organisationsebene 1/8 — org_units
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 D4 (Reihenfolge) und D5 (Scope-Modell).
-- Modell: Artifact „Organisationsmodell …" v0.2, §01 und §06.
--
-- Der Baum CEO → AGI Manager → Director → Team. Vier Ebenen, bewusst nicht
-- mehr: Jede zusaetzliche Ebene weicht die Bericht-Kompression aus §04 auf.
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

CREATE TABLE IF NOT EXISTS public.org_units (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_unit_id uuid NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
  unit_type      text NOT NULL CHECK (unit_type IN ('executive', 'orchestrator', 'director', 'team')),
  name           text NOT NULL,
  mission        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.org_units IS
  'Organigramm-Knoten der Agenten-Ebene (ADR 0011). tenant_id IS NULL = '
  'plattforminterne Engineering-Organisation; tenant_id gesetzt = '
  'Governance-Einheit eines Kunden.';
COMMENT ON COLUMN public.org_units.tenant_id IS
  'NULL = Platform Scope. Bewusst nullable — CLAUDE.md §3 verlangt tenant_id '
  'NOT NULL fuer fachliche Tabellen; diese Ebene hat einen zweiten, '
  'ausdruecklich modellierten Geltungsbereich (ADR 0011 D4/D5).';
COMMENT ON COLUMN public.org_units.unit_type IS
  'executive (CEO) · orchestrator (AGI Manager) · director · team. Vier Ebenen, '
  'siehe Modell §01.';

CREATE INDEX IF NOT EXISTS org_units_tenant_id_idx  ON public.org_units (tenant_id);
CREATE INDEX IF NOT EXISTS org_units_parent_id_idx  ON public.org_units (parent_unit_id);

ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_units_select ON public.org_units;
CREATE POLICY org_units_select
  ON public.org_units FOR SELECT
  TO authenticated
  USING (
    (tenant_id IS NULL AND public.is_platform_operator())
    OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
  );

REVOKE ALL ON public.org_units FROM anon, authenticated;
GRANT SELECT ON public.org_units TO authenticated;

COMMIT;

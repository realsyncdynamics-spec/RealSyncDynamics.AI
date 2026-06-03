-- Öffentliche Plattform-Aggregate für das Landing-Hero-Widget.
--
-- Die Landing-Seite (/landing) ist öffentlich/unauthentifiziert und darf
-- keine RLS-geschützten Tenant-Daten lesen. Statt Demo-Platzhaltern liefert
-- diese SECURITY-DEFINER-RPC ausschließlich NICHT-personenbezogene Aggregate
-- aus dem öffentlichen Free-Scan-Funnel (gdpr_audits) — niemals einzelne
-- domain/email/company/url-Werte, sondern nur Gesamtzahlen.
--
-- Quelle: gdpr_audits (öffentlicher Audit-Funnel, kein Tenant-Scope).
-- scan_runs/findings bleiben tenant-RLS-geschützt und werden NICHT exponiert.
--
-- Rückgabe (eine Zeile):
--   domains_scanned   — Anzahl distinkter geprüfter Domains
--   audits_total      — Anzahl durchgeführter Audits
--   open_risks        — Anzahl High/Critical-Befunde (offene Risiken)
--   evidence_pct      — Anteil Audits mit Score >= 50 (auditfähige Evidenz), in %
--   last_scan_at      — Zeitstempel der letzten Prüfung

CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS TABLE (
  domains_scanned  INTEGER,
  audits_total     INTEGER,
  open_risks       INTEGER,
  evidence_pct     INTEGER,
  last_scan_at     TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    count(DISTINCT g.domain)::int                                       AS domains_scanned,
    count(*)::int                                                       AS audits_total,
    count(*) FILTER (WHERE g.severity IN ('high', 'critical'))::int     AS open_risks,
    COALESCE(
      round(
        100.0 * count(*) FILTER (WHERE g.score >= 50)
        / NULLIF(count(*), 0)
      )::int,
      0
    )                                                                   AS evidence_pct,
    max(g.created_at)                                                   AS last_scan_at
  FROM public.gdpr_audits g;
$$;

REVOKE ALL ON FUNCTION public.platform_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_stats() TO anon, authenticated;

-- IDOR in public.get_compliance_timeline schliessen.
--
-- BEFUND
--
-- Die Funktion ist SECURITY DEFINER, umgeht damit RLS, nimmt die Mandanten-ID
-- als Aufruferparameter entgegen und prueft keine Mitgliedschaft:
--
--     WHERE tenant_id = p_tenant_id AND domain = p_domain
--
-- Zugleich darf `anon` sie ausfuehren — sogar doppelt. Der ACL in Produktion
-- (gemessen 2026-08-30) lautet:
--
--     =X/postgres | postgres=X/postgres | anon=X/postgres
--     | authenticated=X/postgres | service_role=X/postgres
--
-- Der fuehrende `=X/postgres` ist der Default-Grant an PUBLIC, den Postgres
-- beim Anlegen JEDER Funktion vergibt; `anon=X/postgres` ist zusaetzlich
-- explizit gesetzt. Ein Probe-Request mit dem oeffentlichen Anon-Key und einer
-- frei gewaehlten tenant_id lieferte HTTP 200 (leer nur, weil
-- audit_monitor_results derzeit keine Zeilen haelt). Sobald dort Scans liegen,
-- sind Scan-Historie, Risk-Scores und Tracker-Funde fremder Mandanten
-- abrufbar — Domain ist oeffentlich bekannt, die tenant_id wandert durch URLs,
-- Exporte und Support-Vorgaenge.
--
-- Die Absicht war bereits eine andere: 20260826000001_restore_client_function_grants.sql
-- fuehrt get_compliance_timeline in der Liste `v_auth` ("nur authenticated"),
-- nicht in `v_anon`. Diese Migration stellt her, was dort gemeint war, und
-- ergaenzt die fehlende Autorisierungspruefung.
--
-- VORGEHEN
--
-- 1. Mitgliedschaftspruefung in die WHERE-Klausel. Ein Nicht-Mitglied bekommt
--    eine leere Antwort statt eines Fehlers — dieselbe Antwort wie fuer eine
--    unbekannte Domain. Das folgt der im Repo bereits etablierten Linie aus
--    asset_lifecycle_state ("Unbekanntes Asset oder fremder Mandant: dieselbe
--    Antwort"), damit die Funktion nicht als Existenz-Orakel taugt.
-- 2. search_path pinnen (fehlte; Haertung gegen Schema-Hijacking).
-- 3. EXECUTE von PUBLIC und anon entziehen, authenticated + service_role
--    behalten. Ohne Schritt 3 bliebe der Default-Grant bestehen, auch wenn
--    Schritt 1 den Datenabfluss schon verhindert — zwei unabhaengige Riegel.
--
-- Additiv und idempotent. Signatur und Rueckgabetyp bleiben unveraendert,
-- der Aufrufer in src/pages/RiskDashboard.tsx muss nicht angepasst werden.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_compliance_timeline(
  p_domain text, p_tenant_id uuid, p_limit integer DEFAULT 30
) RETURNS TABLE (
  scanned_at timestamptz, risk_score integer, risk_level text,
  trackers text[], drift boolean, new_t text[], scan_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT scanned_at, risk_score, risk_level, trackers,
         drift_detected, new_trackers, scan_type
    FROM public.audit_monitor_results
   WHERE tenant_id = p_tenant_id
     AND domain    = p_domain
     -- Autorisierung. Ohne diese Zeile liest jeder Aufrufer jeden Mandanten:
     -- SECURITY DEFINER umgeht die RLS auf audit_monitor_results, und
     -- p_tenant_id kommt vom Aufrufer, nicht aus der Session.
     AND public.is_tenant_member(p_tenant_id)
   ORDER BY scanned_at DESC
   LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_compliance_timeline(text, uuid, integer) IS
  'Scan-Historie einer Domain fuer EINEN Mandanten. SECURITY DEFINER, deshalb '
  'mit eigener Mitgliedschaftspruefung ueber is_tenant_member(); Nicht-Mitglieder '
  'erhalten eine leere Antwort. Nicht an anon freigeben.';

REVOKE ALL ON FUNCTION public.get_compliance_timeline(text, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_compliance_timeline(text, uuid, integer)
  TO authenticated, service_role;

COMMIT;

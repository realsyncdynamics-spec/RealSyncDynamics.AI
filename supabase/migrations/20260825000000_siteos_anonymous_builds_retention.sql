-- Migration: 20260825000000_siteos_anonymous_builds_retention.sql
-- Der 7-Tage-Verfall anonymer Entwürfe — tatsächlich vollzogen.
--
-- ## Was fehlte
--
-- `siteos_anonymous_builds` (Migration 20260822180000) führt `expires_at`,
-- einen passenden Teilindex, und die Handler antworten nach Ablauf mit 410.
-- Gelöscht hat die Zeilen aber nichts: keine Funktion, kein Cron-Job, kein
-- DELETE. Blueprint und `ip_hash` wären dauerhaft liegen geblieben.
--
-- Der Tabellenkommentar dort sagt „Verfall nach 7 Tagen (Art. 5 Abs. 1
-- lit. e DSGVO)". Eine Frist, die nur beim Lesen gilt, ist keine Frist —
-- die Daten sind weiterhin gespeichert, und gespeichert ist das, worauf die
-- Speicherbegrenzung sich bezieht. Für ein Produkt, das Aufbewahrung als
-- Zusage führt, ist das die falsche Stelle für eine Lücke.
--
-- ## Was hier dazukommt
--
-- Eine Löschfunktion und ein stündlicher Job. Dasselbe Muster wie beim
-- Memory-Decay (`memory-decay-hourly`, Migration 20260819000000) — samt der
-- dort gelernten Lehre: Ohne registrierten pg_cron-Job passiert nichts.
--
-- Additiv. Es wird keine bestehende Spalte, Policy oder Zusicherung
-- geändert.

-- ============================================================
-- §1 Der Löschlauf
-- ============================================================

CREATE OR REPLACE FUNCTION public.purge_expired_anonymous_builds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
-- Fester Suchpfad: eine SECURITY-DEFINER-Funktion ohne ihn ist über einen
-- untergeschobenen `search_path` angreifbar (dieselbe Härtung wie in
-- 20260627225340).
SET search_path = public, pg_temp
AS $$
DECLARE
  removed integer;
BEGIN
  -- Zwei Bedingungen, und die zweite ist die wichtigere:
  --
  --   `expires_at < now()`   die Frist ist um
  --   `claimed_at IS NULL`   der Entwurf gehört noch niemandem
  --
  -- Ein übernommener Entwurf verfällt NICHT. Ab der Übernahme gehört er
  -- einem Mandanten und folgt dessen Aufbewahrung; ihn hier mitzunehmen,
  -- hiesse fremde Daten zu löschen, weil ihre anonyme Vorgeschichte alt
  -- geworden ist.
  --
  -- Die Reihenfolge der Prädikate entspricht dem Teilindex
  -- `siteos_anonymous_builds_expiry_idx (expires_at) WHERE claimed_at IS NULL`,
  -- der genau für diese Abfrage angelegt wurde: Der Lauf liest den Index,
  -- nicht die Tabelle.
  DELETE FROM public.siteos_anonymous_builds
  WHERE claimed_at IS NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_anonymous_builds() IS
  'Loescht abgelaufene, nicht uebernommene anonyme Entwuerfe samt Blueprint und ip_hash (DSGVO Art. 5 Abs. 1 lit. e). Uebernommene Entwuerfe bleiben — sie gehoeren ab dem Claim einem Mandanten. Gibt die Zahl der geloeschten Zeilen zurueck.';

-- Aufrufbar bleibt die Funktion nur fuer die Rollen, die sie brauchen.
-- `anon` und `authenticated` haben hier nichts zu suchen: Ein Loeschlauf
-- ist kein Endpunkt.
REVOKE ALL ON FUNCTION public.purge_expired_anonymous_builds() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_anonymous_builds() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_anonymous_builds() TO service_role;

-- ============================================================
-- §2 Der Job
-- ============================================================
--
-- Stuendlich. Die Frist ist sieben Tage; die Genauigkeit der Loeschung muss
-- dem nicht auf die Minute folgen, aber ein taeglicher Lauf hiesse im
-- schlechtesten Fall einen Tag Nachlauf auf eine Zusage, die auf den Tag
-- genau formuliert ist.
--
-- `IF NOT EXISTS` auf dem Schema: In der CI-Umgebung ist `cron` ein Stub
-- (siehe ci.yml), in Produktion die echte Erweiterung. Beide vertragen
-- diesen Aufruf.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'siteos-anonymous-builds-purge-hourly',
      '17 * * * *',
      $job$SELECT public.purge_expired_anonymous_builds();$job$
    );
  ELSE
    RAISE NOTICE 'Schema cron nicht vorhanden — Job nicht registriert. Ohne ihn verfaellt kein Entwurf.';
  END IF;
END;
$$;

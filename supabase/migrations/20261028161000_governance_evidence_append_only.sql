-- governance_evidence append-only (Review-Migration, nicht automatisch anwenden).
--
-- Befund (Claim-to-Execution-Matrix, docs/qa/landing-to-runtime-parity.md):
-- governance_evidence trägt die Hash-Kette pro Mandant (content_hash,
-- previous_hash; Anhängen über append_governance_evidence, 20260928140100).
-- Anders als ai_evidence_events (20260901090000) und evidence_snapshots
-- verhinderte nichts, dass eine Zeile nachträglich geändert oder gelöscht
-- wird. service_role umgeht RLS — ein versehentliches UPDATE oder DELETE
-- hätte eine Kette hinterlassen, die gültig aussieht oder still Lücken hat.
--
-- Dieselbe Bauart wie ai_evidence_events:
--   - UPDATE: ausnahmslos abgewiesen (42501). Korrekturen sind neue Einträge.
--   - DELETE: abgewiesen, AUSSER app.evidence_retention_purge = 'on' ist im
--     selben Transaktionskontext gesetzt. Löschen muss möglich bleiben
--     (DSGVO Art. 17, Aufbewahrungsfristen), aber nur mit erklärter Absicht.
--
-- Bewusste Folge: Die Fremdschlüssel asset_id (ON DELETE SET NULL) und
-- event_id (ON DELETE CASCADE) führen ihre Aktion als UPDATE bzw. DELETE auf
-- governance_evidence aus. Ein hartes Löschen eines governance_assets- oder
-- governance_events-Eintrags, auf den Evidence zeigt, schlägt damit fehl.
-- Geprüft am 2026-10-16: Kein Code im Repository löscht diese Tabellen hart
-- (Assets werden archiviert), keine hat einen Fremdschlüssel auf tenants.
-- Wer sie dennoch löschen muss, setzt den Schalter oben bewusst.
--
-- Grenze: Gegen jemanden, der service_role hält und den Schalter absichtlich
-- setzt, schützt das NICHT. Es macht Manipulation nicht unmöglich, sondern
-- verhindert die versehentliche — erkennbar bleibt sie über die Hash-Kette.
--
-- Rein additiv: keine Spalte, keine Policy, keine Daten werden geändert.

CREATE OR REPLACE FUNCTION public.governance_evidence_block_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION
        'governance_evidence is append-only — UPDATE rejected'
        USING ERRCODE = '42501',
              HINT = 'Korrekturen werden als NEUER Eintrag geschrieben (append_governance_evidence), nie durch Überschreiben.';
END;
$$;

COMMENT ON FUNCTION public.governance_evidence_block_update() IS
    'Append-only-Wächter für governance_evidence. UPDATE wird immer abgewiesen (42501), '
    'auch über ON DELETE SET NULL eines referenzierten governance_assets-Eintrags.';

CREATE OR REPLACE FUNCTION public.governance_evidence_block_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF current_setting('app.evidence_retention_purge', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION
        'governance_evidence is append-only — DELETE rejected'
        USING ERRCODE = '42501',
              HINT = 'Löschen nur mit app.evidence_retention_purge = on im selben Transaktionskontext.';
END;
$$;

COMMENT ON FUNCTION public.governance_evidence_block_delete() IS
    'Append-only-Wächter mit Ausnahmepfad: DELETE nur bei app.evidence_retention_purge = on '
    '(gleiche Variable wie ai_evidence_events). Schützt gegen versehentliches Löschen, '
    'nicht gegen missbrauchtes service_role.';

DROP TRIGGER IF EXISTS governance_evidence_no_update ON public.governance_evidence;
CREATE TRIGGER governance_evidence_no_update
    BEFORE UPDATE ON public.governance_evidence
    FOR EACH ROW EXECUTE FUNCTION public.governance_evidence_block_update();

DROP TRIGGER IF EXISTS governance_evidence_no_delete ON public.governance_evidence;
CREATE TRIGGER governance_evidence_no_delete
    BEFORE DELETE ON public.governance_evidence
    FOR EACH ROW EXECUTE FUNCTION public.governance_evidence_block_delete();

-- service_role umgeht RLS, aber keinen Trigger. Die Rechte trotzdem
-- entziehen, wo sie über Default-Privileges entstanden sind.
REVOKE UPDATE, DELETE ON public.governance_evidence FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.governance_evidence_block_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.governance_evidence_block_update() TO service_role;
REVOKE ALL ON FUNCTION public.governance_evidence_block_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.governance_evidence_block_delete() TO service_role;

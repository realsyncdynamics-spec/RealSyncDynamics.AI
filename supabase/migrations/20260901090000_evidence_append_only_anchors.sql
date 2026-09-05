-- ============================================================
-- Governance OS P1-6: Evidence-Härtung (Befund S4)
--
-- AUSGANGSLAGE, gemessen — und eine Korrektur der eigenen Ist-Analyse:
-- `runtime_events` ist bereits gehärtet (Reject-Trigger für UPDATE und
-- DELETE, Verifier-RPC, Migration 20260602100000). Der Befund S4 des
-- Plans war insoweit zu pauschal formuliert.
--
-- Die Lücke liegt bei `ai_evidence_events` — genau der Tabelle, in die
-- der Policy Decision Point seine Entscheidungen schreibt. Sie führt
-- zwar eine Hash-Kette (prev_hash/event_hash/chain_index, Migration
-- 20260510), hat aber KEINEN Append-only-Zwang: Jeder Code mit
-- service_role kann Zeilen ändern oder löschen, ohne Spur.
--
-- Diese Migration schließt das in drei Schritten:
--   1. Append-only-Trigger, mit einem einzigen, ausdrücklich erklärten
--      Ausnahmepfad für rechtmäßige Aufbewahrungslöschung.
--   2. Verifier-Funktion, die die Kette nachrechnet statt sie zu glauben.
--   3. Anker-Tabelle für signierte Prüfpunkte.
--
-- EHRLICHE GRENZE, hier und in der Doku benannt: Diese Migration macht
-- Manipulation nicht unmöglich. Wer service_role hält, kann den
-- Ausnahmepfad selbst setzen. Sie hebt die Schwelle von „stilles
-- Umschreiben durch beliebigen Code" auf „ausdrückliche, protokollierte
-- Absicht" — und der Anker macht nachträgliche Änderungen ERKENNBAR,
-- sofern er die Plattform verlässt. Ein Anker, den niemand exportiert,
-- ist Dekoration. Echte Unveränderlichkeit braucht WORM-Speicher oder
-- einen Zeitstempeldienst Dritter; beides ist eine eigene Integration.
--
-- EU AI Act Art. 12 (Aufzeichnungspflichten), DSGVO Art. 5 Abs. 2
-- (Rechenschaftspflicht) und Art. 17 (Löschanspruch — deshalb der
-- Ausnahmepfad statt eines absoluten Löschverbots).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Append-only auf ai_evidence_events
-- ============================================================

-- UPDATE ist ausnahmslos verboten. Ein nachträglich geänderter
-- Evidence-Eintrag ist schlimmer als gar keiner: Er sieht gültig aus.
CREATE OR REPLACE FUNCTION public.ai_evidence_block_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION
        'ai_evidence_events is append-only — UPDATE rejected'
        USING ERRCODE = '42501',
              HINT = 'Korrekturen werden als NEUER Eintrag geschrieben, nie durch Überschreiben.';
END;
$$;

COMMENT ON FUNCTION public.ai_evidence_block_update() IS
    'P1-6 Append-only-Wächter. UPDATE wird immer abgewiesen (42501). '
    'Eine Korrektur ist ein neuer Eintrag, damit die Kette lückenlos bleibt.';

-- DELETE ist verboten, AUSSER der Aufrufer erklärt ausdrücklich eine
-- Aufbewahrungslöschung. Warum kein absolutes Verbot: DSGVO Art. 17 und
-- die eigene Aufbewahrungsregel (ai_evidence_retention.hard_delete_after_days)
-- verlangen, dass Löschen möglich BLEIBT. Ein Produkt, das Löschen
-- technisch unmöglich macht, verletzt genau das Recht, das es schützen soll.
--
-- Der Ausnahmepfad ist bewusst eine Session-Variable und keine Rolle:
-- Er zwingt den löschenden Code, seine Absicht im selben Transaktions-
-- kontext zu erklären. Ein versehentliches DELETE — der häufigste reale
-- Fall — schlägt damit fehl. Gegen jemanden, der service_role hält und
-- die Variable bewusst setzt, schützt er NICHT; dafür ist der Anker da.
CREATE OR REPLACE FUNCTION public.ai_evidence_block_delete()
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
        'ai_evidence_events is append-only — DELETE rejected'
        USING ERRCODE = '42501',
              HINT = 'Aufbewahrungslöschung nur über public.ai_evidence_purge_expired().';
END;
$$;

COMMENT ON FUNCTION public.ai_evidence_block_delete() IS
    'P1-6 Append-only-Wächter mit Ausnahmepfad. DELETE wird abgewiesen, '
    'ausser app.evidence_retention_purge=on ist im selben Transaktions-'
    'kontext gesetzt (nur ai_evidence_purge_expired setzt das). Schuetzt '
    'gegen versehentliches Loeschen, nicht gegen missbrauchtes service_role.';

DROP TRIGGER IF EXISTS ai_evidence_events_no_update ON public.ai_evidence_events;
CREATE TRIGGER ai_evidence_events_no_update
    BEFORE UPDATE ON public.ai_evidence_events
    FOR EACH ROW EXECUTE FUNCTION public.ai_evidence_block_update();

DROP TRIGGER IF EXISTS ai_evidence_events_no_delete ON public.ai_evidence_events;
CREATE TRIGGER ai_evidence_events_no_delete
    BEFORE DELETE ON public.ai_evidence_events
    FOR EACH ROW EXECUTE FUNCTION public.ai_evidence_block_delete();

-- Gürtel und Hosenträger: service_role umgeht RLS, aber keinen Trigger.
REVOKE UPDATE, DELETE ON public.ai_evidence_events FROM PUBLIC;

-- ============================================================
-- 2. Aufbewahrungslöschung — der einzige erlaubte Löschpfad
-- ============================================================
--
-- Bis heute deklariert ai_evidence_retention eine Aufbewahrungsfrist,
-- ohne dass irgendein Code sie durchsetzt: hard_delete_after_days stand
-- da, gelöscht hat nie jemand. Diese Funktion macht die Regel
-- ausführbar — und schreibt jede Löschung in den Prüfpfad, BEVOR sie
-- passiert. Wer löscht, hinterlässt damit einen Eintrag, den er nach
-- dem UPDATE-Verbot nicht mehr ändern kann.
CREATE OR REPLACE FUNCTION public.ai_evidence_purge_expired(
    p_tenant_id UUID,
    p_dry_run   BOOLEAN DEFAULT TRUE
) RETURNS TABLE (
    purged_count  BIGINT,
    oldest_purged TIMESTAMPTZ,
    newest_purged TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_days   INT;
    v_cutoff TIMESTAMPTZ;
    v_count  BIGINT;
    v_oldest TIMESTAMPTZ;
    v_newest TIMESTAMPTZ;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id is required — kein mandantenuebergreifendes Loeschen';
    END IF;

    SELECT hard_delete_after_days INTO v_days
    FROM public.ai_evidence_retention WHERE tenant_id = p_tenant_id;
    IF v_days IS NULL THEN
        -- Keine Regel hinterlegt heisst NICHT loeschen. Ein Default
        -- waere hier gefaehrlich: er wuerde Evidence entfernen, ohne
        -- dass jemand eine Frist gesetzt hat.
        RETURN QUERY SELECT 0::BIGINT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    v_cutoff := now() - (v_days || ' days')::INTERVAL;

    SELECT count(*), min(created_at), max(created_at)
    INTO v_count, v_oldest, v_newest
    FROM public.ai_evidence_events
    WHERE tenant_id = p_tenant_id AND created_at < v_cutoff;

    IF p_dry_run OR v_count = 0 THEN
        RETURN QUERY SELECT v_count, v_oldest, v_newest;
        RETURN;
    END IF;

    -- Erst den Nachweis der Loeschung schreiben, dann loeschen. Die
    -- Reihenfolge ist wesentlich: Der Eintrag ueberlebt die Loeschung
    -- und ist selbst nicht mehr aenderbar.
    INSERT INTO public.ai_evidence_events (
        tenant_id, event_type, event_summary, risk_level, evidence
    ) VALUES (
        p_tenant_id, 'evidence:retention_purge',
        format('Aufbewahrungslöschung: %s Einträge älter als %s Tage entfernt', v_count, v_days),
        'medium',
        jsonb_build_object(
            'purged_count', v_count,
            'retention_days', v_days,
            'cutoff', v_cutoff,
            'oldest_purged', v_oldest,
            'newest_purged', v_newest
        )
    );

    PERFORM set_config('app.evidence_retention_purge', 'on', true);
    DELETE FROM public.ai_evidence_events
    WHERE tenant_id = p_tenant_id AND created_at < v_cutoff;
    PERFORM set_config('app.evidence_retention_purge', 'off', true);

    RETURN QUERY SELECT v_count, v_oldest, v_newest;
END;
$$;

COMMENT ON FUNCTION public.ai_evidence_purge_expired(UUID, BOOLEAN) IS
    'Setzt ai_evidence_retention.hard_delete_after_days durch — der einzige '
    'erlaubte Loeschpfad. Schreibt den Nachweis VOR der Loeschung. Ohne '
    'hinterlegte Frist wird nichts geloescht. Default ist Trockenlauf.';

REVOKE ALL ON FUNCTION public.ai_evidence_purge_expired(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_evidence_purge_expired(UUID, BOOLEAN) TO service_role;

-- ============================================================
-- 3. Verifier — die Kette nachrechnen, nicht glauben
-- ============================================================
--
-- Bildet exakt die Berechnung aus tg_evidence_event_chain() (Migration
-- 20260510) nach. Weicht eine Zeile ab, ist sie nach dem Schreiben
-- veraendert worden — oder die Kette hat eine Luecke.
CREATE OR REPLACE FUNCTION public.ai_evidence_verify_chain(
    p_tenant_id UUID,
    p_from      BIGINT DEFAULT 1,
    p_to        BIGINT DEFAULT NULL
) RETURNS TABLE (
    chain_index   BIGINT,
    event_id      UUID,
    hash_ok       BOOLEAN,
    link_ok       BOOLEAN,
    created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    r          RECORD;
    v_expected BYTEA;
    v_prev     BYTEA := NULL;
    v_first    BOOLEAN := TRUE;
BEGIN
    IF NOT public.is_tenant_member(p_tenant_id) THEN
        RAISE EXCEPTION 'forbidden: caller is not a member of tenant %', p_tenant_id
            USING ERRCODE = '42501';
    END IF;

    FOR r IN
        SELECT e.id, e.tenant_id, e.created_at, e.event_type, e.event_summary,
               e.evidence, e.prev_hash, e.event_hash, e.chain_index
        FROM public.ai_evidence_events e
        WHERE e.tenant_id = p_tenant_id
          AND e.event_hash IS NOT NULL
          AND e.chain_index >= p_from
          AND (p_to IS NULL OR e.chain_index <= p_to)
        ORDER BY e.chain_index
    LOOP
        -- Bewusst OHNE Schema-Präfix: pgcrypto liegt in Supabase unter
        -- `extensions`, in der CI-Stub-Umgebung unter `public`. Der
        -- search_path oben deckt beide ab; ein festes `extensions.digest`
        -- würde in der CI scheitern. Dieselbe Schreibweise nutzt die
        -- Ketten-Trigger-Funktion aus Migration 20260510.
        v_expected := digest(
            coalesce(r.prev_hash, ''::bytea)
            || convert_to(r.id::text, 'UTF8')
            || convert_to(coalesce(r.created_at::text, ''), 'UTF8')
            || convert_to(r.event_type, 'UTF8')
            || convert_to(r.event_summary, 'UTF8')
            || convert_to(coalesce(r.evidence::text, '{}'), 'UTF8'),
            'sha256'
        );

        chain_index := r.chain_index;
        event_id    := r.id;
        created_at  := r.created_at;
        hash_ok     := (v_expected = r.event_hash);
        -- Beim ersten geprueften Eintrag laesst sich die Verkettung nicht
        -- pruefen, wenn der Ausschnitt nicht am Kettenanfang beginnt.
        link_ok     := CASE
                         WHEN v_first AND p_from > 1 THEN NULL
                         ELSE r.prev_hash IS NOT DISTINCT FROM v_prev
                       END;
        v_prev  := r.event_hash;
        v_first := FALSE;
        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ai_evidence_verify_chain(UUID, BIGINT, BIGINT) IS
    'Rechnet die Evidence-Hash-Kette nach: hash_ok prueft den Eintrag selbst, '
    'link_ok die Verkettung zum Vorgaenger (NULL beim ersten Eintrag eines '
    'Ausschnitts). Mitgliedschaftsgeschuetzt.';

REVOKE ALL ON FUNCTION public.ai_evidence_verify_chain(UUID, BIGINT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_evidence_verify_chain(UUID, BIGINT, BIGINT)
    TO authenticated, service_role;

-- ============================================================
-- 4. Anker — signierte Prüfpunkte der Kette
-- ============================================================
--
-- Ein Anker hält fest: „Zum Zeitpunkt T endete die Kette des Mandanten X
-- bei Index N mit Hash H." Wird die Historie später geändert, passt der
-- nachgerechnete Hash nicht mehr zum Anker.
--
-- Der Nutzen entsteht erst durch den EXPORT: Solange der Anker nur hier
-- liegt, kann derselbe Angreifer, der die Kette umschreibt, auch ihn
-- neu schreiben. Deshalb ist die Tabelle append-only und der Anker zum
-- Mitnehmen gedacht — beim Kunden, beim Prüfer, oder bei einem
-- Zeitstempeldienst Dritter (eigene Integration, noch nicht gebaut).
CREATE TABLE IF NOT EXISTS public.evidence_anchors (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    -- Zustand der Kette zum Ankerzeitpunkt
    chain_index    bigint NOT NULL,
    chain_hash     bytea  NOT NULL CHECK (octet_length(chain_hash) = 32),
    event_count    bigint NOT NULL,
    -- Signatur ueber die kanonische Ankerform (siehe evidence-anchor)
    signature      text,
    signature_alg  text CHECK (signature_alg IN ('ed25519', 'hmac-sha256')),
    signing_key_id text,
    -- Wurde der Anker aus der Plattform herausgegeben? Erst dann wirkt er.
    exported_at    timestamptz,
    export_note    text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, chain_index)
);

CREATE INDEX IF NOT EXISTS evidence_anchors_tenant_idx
    ON public.evidence_anchors (tenant_id, created_at DESC);

ALTER TABLE public.evidence_anchors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_anchors_tenant_select ON public.evidence_anchors;
CREATE POLICY evidence_anchors_tenant_select
    ON public.evidence_anchors FOR SELECT
    USING (public.is_tenant_member(tenant_id));

-- Anker entstehen ausschliesslich serverseitig; kein Client schreibt hier.
-- Und einmal gesetzt, aendert sich ein Anker nie — sonst waere er keiner.
CREATE OR REPLACE FUNCTION public.evidence_anchors_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Einzige erlaubte Aenderung: den Export vermerken. Alles andere
    -- wuerde den Anker als Beweismittel entwerten.
    IF TG_OP = 'UPDATE'
       AND NEW.tenant_id      IS NOT DISTINCT FROM OLD.tenant_id
       AND NEW.chain_index    IS NOT DISTINCT FROM OLD.chain_index
       AND NEW.chain_hash     IS NOT DISTINCT FROM OLD.chain_hash
       AND NEW.event_count    IS NOT DISTINCT FROM OLD.event_count
       AND NEW.signature      IS NOT DISTINCT FROM OLD.signature
       AND NEW.signature_alg  IS NOT DISTINCT FROM OLD.signature_alg
       AND NEW.signing_key_id IS NOT DISTINCT FROM OLD.signing_key_id
       AND NEW.created_at     IS NOT DISTINCT FROM OLD.created_at
       AND OLD.exported_at    IS NULL
    THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION
        'evidence_anchors is append-only — % rejected', TG_OP
        USING ERRCODE = '42501',
              HINT = 'Nur das erstmalige Vermerken des Exports ist erlaubt.';
END;
$$;

COMMENT ON FUNCTION public.evidence_anchors_block_mutation() IS
    'Anker sind unveraenderlich. Einzige Ausnahme: exported_at/export_note '
    'duerfen EINMAL gesetzt werden, solange exported_at noch NULL ist.';

DROP TRIGGER IF EXISTS evidence_anchors_no_update ON public.evidence_anchors;
CREATE TRIGGER evidence_anchors_no_update
    BEFORE UPDATE ON public.evidence_anchors
    FOR EACH ROW EXECUTE FUNCTION public.evidence_anchors_block_mutation();

DROP TRIGGER IF EXISTS evidence_anchors_no_delete ON public.evidence_anchors;
CREATE TRIGGER evidence_anchors_no_delete
    BEFORE DELETE ON public.evidence_anchors
    FOR EACH ROW EXECUTE FUNCTION public.evidence_anchors_block_mutation();

REVOKE UPDATE, DELETE ON public.evidence_anchors FROM PUBLIC;

-- ============================================================
-- 5. Trigger-Funktionen gegen den Postgres-Default schliessen
-- ============================================================
--
-- WARUM: `CREATE FUNCTION` vergibt EXECUTE an PUBLIC. Wer beim Anlegen kein
-- REVOKE schreibt, oeffnet die Funktion fuer `anon` — ohne dass irgendwo ein
-- GRANT steht, an dem man es sehen wuerde. Genau dieser Default hat den
-- Repo-Stand gegenueber Produktion aufgehen lassen (siehe
-- 20260903044500_align_repo_function_grants_with_prod). Trigger-Funktionen
-- brauchen kein direktes EXECUTE: Der Trigger-Mechanismus ruft sie ohne
-- Rechtepruefung auf. Ein direkter Aufruf durch einen anonymen Nutzer hat
-- dagegen keinen legitimen Zweck.
--
-- service_role bekommt seinen Grant EXPLIZIT, bevor der Entzug greift —
-- `REVOKE ... FROM PUBLIC` nimmt auch ihm das Recht, wenn es dort nur ueber
-- PUBLIC bestand. Genau so entstand der ACL-Vorfall vom 2026-08-23.
DO $$
DECLARE
    fn TEXT;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'public.ai_evidence_block_update()',
        'public.ai_evidence_block_delete()',
        'public.evidence_anchors_block_mutation()'
    ] LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    END LOOP;
END $$;

COMMIT;

-- Presence Layer — Scope 1, Teil 2: Auflösung (Aufgabe 3) und Site-Erstellung (Aufgabe 4)
--
-- ZWECK
--
-- Zwei Dinge, die zusammengehören, weil das eine ohne das andere nicht
-- funktioniert:
--
--   * Der Tenant-Router (Aufgabe 3) braucht einen Weg, einen Hostnamen in
--     einen Mandanten und dessen Template-Konfiguration aufzulösen.
--   * Die Site-Erstellung (Aufgabe 4) muss beim Anlegen einer Site
--     automatisch das KI-System registrieren und den AVV anlegen — und
--     verhindern, dass veröffentlicht wird, bevor der AVV angenommen ist.
--
-- Weiterhin KEIN Enforcement und KEINE Policy-Auswertung. Was hier steht,
-- sind Auflösung, Registrierung und eine Datenschranke — keine Bewertung.
--
-- ENTSCHEIDUNG ZUM LESEPFAD DES ROUTERS (2026-09-06)
--
-- Der Router ist ein Cloudflare Worker und damit **kein** Ort für den
-- Service-Role-Schlüssel (CLAUDE.md §3: ausschliesslich in Edge Functions).
-- Ein Leserecht für `anon` direkt auf `presence_sites` scheidet ebenfalls
-- aus: Die Tabelle führt unveröffentlichte Entwürfe und die internen
-- Bereitstellungskennungen `cloudflare_project` und `deployment_id`. Der
-- anon-Schlüssel ist per Definition öffentlich (CLAUDE.md §2) — ein
-- Tabellen-Leserecht wäre damit ein öffentliches Leserecht.
--
-- Gewählt ist deshalb das Muster, das der Bestand für genau diesen Fall
-- bereits verwendet: `get_tenant_branding_by_domain` löst eine Domain über
-- eine SECURITY-DEFINER-Funktion auf, ist an `anon` erteilt und gibt
-- kuratiertes JSON zurück, während die Tabelle geschlossen bleibt. Kein
-- neues Muster, sondern das vorhandene.
--
-- COMPLIANCE-BEZUG
--
-- DSGVO Art. 5 Abs. 1 lit. c (Datenminimierung — die Auflösung gibt nur
-- heraus, was zum Ausliefern der Seite nötig ist), Art. 28 (der AVV muss
-- vor der Verarbeitung stehen, nicht danach), Art. 5 Abs. 2
-- (Rechenschaftspflicht — die Registrierung des KI-Systems entsteht
-- automatisch und nicht auf Zuruf). EU AI Act Art. 12/49 (ein betriebenes
-- KI-System muss im Bestand geführt sein).
--
-- Rückweg: `supabase/rollbacks/20260906130000_..._rollback.sql`.

BEGIN;

-- ============================================================
-- 1. Verknüpfung Site → registriertes KI-System
-- ============================================================
--
-- Die Richtung ist bewusst diese: Die Site zeigt auf ihr KI-System, nicht
-- umgekehrt. `ai_systems` ist der allgemeine Governance-Bestand und soll
-- keine presence-spezifische Spalte tragen — sonst bekommt die Registratur
-- für jedes künftige Produkt eine eigene Fremdschlüsselspalte.
--
-- ON DELETE SET NULL, nicht CASCADE: Wird das KI-System aus dem Bestand
-- genommen, verschwindet nicht die Website. Der umgekehrte Fall — Site weg,
-- System bleibt — ist gewollt: Der Prüfpfad überlebt das Asset.

ALTER TABLE public.presence_sites
    ADD COLUMN IF NOT EXISTS ai_system_id UUID
        REFERENCES public.ai_systems(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS presence_sites_ai_system_idx
    ON public.presence_sites (ai_system_id) WHERE ai_system_id IS NOT NULL;

COMMENT ON COLUMN public.presence_sites.ai_system_id IS
    'Das beim Anlegen automatisch registrierte KI-System dieser Site (Website Assistant).';

-- ============================================================
-- 2. Veröffentlichungs-Hindernisse — eine Stelle, die sie kennt
-- ============================================================
--
-- Gibt die Gründe zurück, aus denen ein Mandant derzeit nicht
-- veröffentlichen darf. Als Array, damit spätere Gründe hinzukommen können,
-- ohne den Vertrag zu ändern.
--
-- WARUM ALS FUNKTION UND NICHT ALS CHECK-BEDINGUNG: Ein CHECK kann nur die
-- eigene Zeile sehen. Der AVV steht in einer anderen Tabelle.
--
-- ⚠️ ABGRENZUNG ZUM PUBLISH GATE (P2-3). Diese Funktion ist **kein zweites
-- Tor**. Sie beantwortet eine Datenfrage — „liegt ein angenommener AVV
-- vor?" —, keine Policy-Frage. Der Publish Gate
-- (`SITEOS_PUBLISH_PDP`, `siteos_publish_evaluations`) bleibt laut
-- CLAUDE.md §14 der Pfad, der vor jedem Publish steht; diese Funktion ist
-- eine **Vorbedingung, die er mitlesen kann**, nicht ein Konkurrent.
-- Die Verdrahtung gehört in den Publish-Pfad, den es in Scope 1 noch nicht
-- gibt — sie ist hier ausdrücklich nicht gebaut und nicht behauptet.

-- ⚠️ BEWUSST OHNE SECURITY DEFINER, nachträglich korrigiert.
--
-- Die erste Fassung war SECURITY DEFINER. Der Bestands-Wächter
-- `security-regressions.db.test.ts` hat sie sofort beanstandet, und er hatte
-- recht — aus einem Grund, der weiter reicht als seine eigene Regel:
--
-- Eine SECURITY-DEFINER-Funktion, die einen `tenant_id` ENTGEGENNIMMT, umgeht
-- RLS und beantwortet die Frage für JEDEN Mandanten, den der Aufrufer
-- hinschreibt. Sie hätte damit jedem — nicht nur `anon`, sondern auch jedem
-- angemeldeten Nutzer eines fremden Mandanten — verraten, ob ein beliebiger
-- anderer Mandant einen angenommenen AVV hat. Eine Vertragstatsache über
-- ein fremdes Unternehmen.
--
-- Als SECURITY INVOKER gilt RLS für den Aufrufer: Ein Mandant sieht seinen
-- eigenen AVV und sonst nichts; für einen fremden `tenant_id` bekommt er
-- 'dpa_not_accepted' — dieselbe Antwort wie für einen Mandanten ohne AVV,
-- also keine Auskunft. Der Trigger unten ist selbst SECURITY DEFINER und
-- ruft sie im Eigentümer-Kontext, sieht deshalb weiterhin alles. Die
-- Durchsetzung verliert nichts, die Auskunft verliert ihre Neugier.
CREATE OR REPLACE FUNCTION public.presence_publish_blockers(p_tenant_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT coalesce(array_agg(grund), '{}')::TEXT[]
    FROM (
        SELECT 'dpa_not_accepted' AS grund
        WHERE NOT EXISTS (
            SELECT 1 FROM public.data_processing_agreements d
            WHERE d.tenant_id = p_tenant_id
              AND d.status = 'accepted'
        )
    ) g;
$$;

COMMENT ON FUNCTION public.presence_publish_blockers(UUID) IS
    'Gründe, aus denen ein Mandant derzeit keine Presence Site veröffentlichen darf. '
    'Datenfrage, keine Policy-Auswertung — der Publish Gate (P2-3) bleibt der Entscheider.';

-- ============================================================
-- 3. Die Schranke: kein Publish ohne angenommenen AVV
-- ============================================================
--
-- Als Trigger und nicht als Anwendungslogik, aus einem Grund: `service_role`
-- umgeht RLS, aber **kein** Trigger. Eine Prüfung in einer Edge Function
-- griffe nur dort, wo jemand daran gedacht hat, sie aufzurufen. Diese greift
-- überall — auch beim Direktzugriff eines Betreibers auf die Datenbank.
--
-- DSGVO Art. 28: Die Auftragsverarbeitung braucht ihre vertragliche
-- Grundlage, *bevor* verarbeitet wird. Eine veröffentlichte Website mit
-- Lead-Assistent verarbeitet personenbezogene Daten von Besuchern.

CREATE OR REPLACE FUNCTION public.presence_sites_guard_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_blockers TEXT[];
BEGIN
    -- Nur beim Übergang NACH 'published' prüfen. Eine bereits
    -- veröffentlichte Site, die aus anderen Gründen aktualisiert wird, soll
    -- nicht plötzlich unveränderbar sein, wenn der AVV später zurückgezogen
    -- wird — dafür ist das Zurücksetzen des Status der richtige Weg.
    IF NEW.status IS DISTINCT FROM 'published' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'published' THEN
        RETURN NEW;
    END IF;

    v_blockers := public.presence_publish_blockers(NEW.tenant_id);

    IF array_length(v_blockers, 1) > 0 THEN
        RAISE EXCEPTION
            'presence_site darf nicht veröffentlicht werden: %',
            array_to_string(v_blockers, ', ')
            USING ERRCODE = 'check_violation',
                  HINT = 'Der Auftragsverarbeitungsvertrag (DSGVO Art. 28) muss '
                         'angenommen sein, bevor eine Site online geht.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS presence_sites_guard_publish_trg ON public.presence_sites;
CREATE TRIGGER presence_sites_guard_publish_trg
    BEFORE INSERT OR UPDATE OF status ON public.presence_sites
    FOR EACH ROW
    EXECUTE FUNCTION public.presence_sites_guard_publish();

-- ============================================================
-- 4. Site-Erstellung: KI-System und AVV entstehen automatisch
-- ============================================================
--
-- Als BEFORE-INSERT-Trigger, nicht als Edge-Function-Logik. Der Auftrag
-- sagt „beim Anlegen einer presence_site **automatisch**" — und automatisch
-- heisst: auch dann, wenn die Site auf einem Weg entsteht, an den beim Bau
-- niemand gedacht hat. Ein vergessener Funktionsaufruf hinterliesse eine
-- Website mit Lead-Assistent, die in keinem Governance-Bestand steht. Genau
-- das ist der Zustand, den dieses Produkt bei seinen Kunden aufdeckt.
--
-- SECURITY DEFINER, weil der Trigger in `ai_systems` und
-- `data_processing_agreements` schreibt und der anlegende Nutzer dort nicht
-- unbedingt Schreibrechte hat.
--
-- ZUR SICHERHEIT DIESES SECURITY DEFINER: Er schreibt ausschliesslich mit
-- `NEW.tenant_id` — also mit dem Mandanten der Zeile, die gerade entsteht.
-- Deren INSERT-Policy (`is_tenant_owner_or_admin`) wird nach den
-- BEFORE-Triggern ausgewertet; schlägt sie fehl, rollt die gesamte Anweisung
-- samt dieser Einträge zurück. Ein fremder `tenant_id` kann hier also nichts
-- erzeugen, das bestehen bliebe.

CREATE OR REPLACE FUNCTION public.presence_sites_bootstrap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_ai_system_id UUID;
BEGIN
    -- 1. Das KI-System der Site registrieren.
    --
    -- Der Name trägt den Slug, weil ein Mandant mehrere Sites haben kann und
    -- drei Zeilen namens „Website Assistant" im Bestand niemandem helfen.
    IF NEW.ai_system_id IS NULL THEN
        INSERT INTO public.ai_systems (
            tenant_id, name, system_type, provider, purpose,
            status, discovered_via
        )
        VALUES (
            NEW.tenant_id,
            'Website Assistant — ' || NEW.slug,
            'website_assistant',
            NULL,                       -- steht erst fest, wenn der Assistent läuft
            'Lead-Erfassung und Besucherauskunft auf der Presence Site',
            'draft',                    -- nicht 'active': er läuft noch nicht
            'presence_onboarding'
        )
        RETURNING id INTO v_ai_system_id;

        NEW.ai_system_id := v_ai_system_id;
    END IF;

    -- 2. Den AVV anlegen, falls der Mandant noch keinen gültigen hat.
    --
    -- `dpa_one_active_per_tenant` lässt nur einen pending/accepted je Mandant
    -- zu — deshalb NOT EXISTS statt ON CONFLICT: Ein Mandant mit bereits
    -- angenommenem AVV soll nicht auf 'pending' zurückgeworfen werden, wenn
    -- er seine zweite Site anlegt.
    INSERT INTO public.data_processing_agreements (tenant_id, status, version)
    SELECT NEW.tenant_id, 'pending', 'v1.0'
    WHERE NOT EXISTS (
        SELECT 1 FROM public.data_processing_agreements d
        WHERE d.tenant_id = NEW.tenant_id
          AND d.status IN ('pending', 'accepted')
    );

    RETURN NEW;
END;
$$;

-- Reihenfolge zählt: `bootstrap` muss VOR `guard_publish` laufen, damit eine
-- Site, die sofort als 'published' angelegt wird, den gerade erzeugten
-- AVV sieht (und daran scheitert — genau richtig). PostgreSQL führt Trigger
-- gleicher Art alphabetisch nach Namen aus, deshalb der Namenspräfix.
DROP TRIGGER IF EXISTS presence_sites_a_bootstrap_trg ON public.presence_sites;
CREATE TRIGGER presence_sites_a_bootstrap_trg
    BEFORE INSERT ON public.presence_sites
    FOR EACH ROW
    EXECUTE FUNCTION public.presence_sites_bootstrap();

-- ============================================================
-- 5. Hostname → Mandant: die Auflösung für den Router
-- ============================================================
--
-- Gibt NULL zurück, wenn nichts passt oder die Site nicht veröffentlicht
-- ist. Ein Entwurf ist über den Router **nicht** erreichbar; er existiert
-- für den Mandanten, nicht für das Netz.
--
-- WAS BEWUSST NICHT ZURÜCKGEGEBEN WIRD (DSGVO Art. 5 Abs. 1 lit. c):
--   * `cloudflare_project`, `deployment_id` — interne Bereitstellungs-
--     kennungen. Der Router braucht sie nicht; er IST die Bereitstellung.
--   * `owner_name` aus dem Betriebsprofil — der Name der Inhaberin ist ein
--     personenbezogenes Datum und für das Ausliefern der Seite nicht nötig.
--     Wer ihn im Impressum zeigen will, pflegt ihn in den Seiteninhalt ein;
--     das ist dann eine Entscheidung, keine stille Nebenwirkung.
--
-- Rückgabe absichtlich JSON und nicht SETOF record: So kann die Struktur
-- additiv wachsen, ohne dass ein Signaturwechsel den laufenden Worker bricht.

CREATE OR REPLACE FUNCTION public.presence_resolve_host(p_host TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_host  TEXT;
    v_slug  TEXT;
    v_out   JSON;
BEGIN
    IF p_host IS NULL OR length(trim(p_host)) = 0 THEN
        RETURN NULL;
    END IF;

    -- Normalisieren: Kleinschreibung, Port weg, abschliessender Punkt weg.
    -- Ein Host-Header darf all das tragen; ohne Normalisierung schlüge die
    -- Auflösung je nach Aufrufer unterschiedlich aus.
    v_host := lower(trim(p_host));
    v_host := split_part(v_host, ':', 1);
    v_host := rtrim(v_host, '.');

    -- {slug}.realsync.app → slug. Nur genau eine Ebene: `a.b.realsync.app`
    -- ist kein gültiger Mandanten-Host und darf nicht auf `a` auflösen.
    IF v_host LIKE '%.realsync.app' THEN
        v_slug := left(v_host, length(v_host) - length('.realsync.app'));
        IF position('.' IN v_slug) > 0 THEN
            v_slug := NULL;
        END IF;
    END IF;

    SELECT json_build_object(
        'tenant_id',   s.tenant_id,
        'site_id',     s.id,
        'slug',        s.slug,
        'template_id', s.template_id,
        'status',      s.status,
        'published_at', s.published_at,
        'ai_system_id', s.ai_system_id,
        'business', CASE WHEN b.id IS NULL THEN NULL ELSE json_build_object(
            'business_name', b.business_name,
            'address',       b.address,
            'phone',         b.phone,
            'email',         b.email,
            'logo_url',      b.logo_url,
            'services',      b.services,
            'opening_hours', b.opening_hours
        ) END
    )
    INTO v_out
    FROM public.presence_sites s
    LEFT JOIN public.business_profiles b ON b.tenant_id = s.tenant_id
    WHERE s.status = 'published'
      AND (
            s.custom_domain = v_host
        OR (v_slug IS NOT NULL AND s.slug = v_slug)
      )
    LIMIT 1;

    RETURN v_out;
END;
$$;

COMMENT ON FUNCTION public.presence_resolve_host(TEXT) IS
    'Löst einen Hostnamen ({slug}.realsync.app oder Custom Domain) in Mandant und '
    'Template-Konfiguration auf. Nur veröffentlichte Sites; gibt bewusst weder '
    'Bereitstellungskennungen noch owner_name heraus. Muster wie get_tenant_branding_by_domain.';

-- ============================================================
-- 6. Rechte
-- ============================================================
--
-- `anon` darf ausschliesslich die Auflösung aufrufen — nicht die Tabellen
-- lesen. Das ist der ganze Zweck der Konstruktion: Der Router kommt mit dem
-- öffentlichen anon-Schlüssel aus und sieht trotzdem nur veröffentlichte
-- Sites und nur die Felder oben.
-- ⚠️ ERST ZURÜCKNEHMEN, DANN ERTEILEN — und das ist keine Formsache.
--
-- `CREATE FUNCTION` erteilt EXECUTE automatisch an PUBLIC. Ein `GRANT ... TO
-- authenticated` danach schränkt deshalb NICHTS ein; es bestätigt nur einen
-- Teil dessen, was ohnehin schon jeder darf. Genau dieser Irrtum stand in
-- der ersten Fassung dieser Migration, und er ist derselbe wie bei den
-- Tabellenrechten in §7: eine Zeile, die wie eine Beschränkung aussieht und
-- keine ist.
REVOKE ALL ON FUNCTION public.presence_resolve_host(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_publish_blockers(UUID) FROM PUBLIC;

-- Der Router braucht die Auflösung mit dem öffentlichen anon-Schlüssel. Das
-- ist vertretbar, weil die Funktion nur veröffentlichte Sites kennt und
-- einen HOSTNAMEN entgegennimmt — keinen tenant_id, den man durchprobieren
-- könnte, um über fremde Mandanten etwas zu erfahren.
GRANT EXECUTE ON FUNCTION public.presence_resolve_host(TEXT) TO anon, authenticated, service_role;

-- Die Hindernis-Auskunft ist für angemeldete Nutzer (Oberfläche: „warum kann
-- ich nicht veröffentlichen?") und den Server. Nicht für anon.
GRANT EXECUTE ON FUNCTION public.presence_publish_blockers(UUID) TO authenticated, service_role;

-- Trigger-Funktionen ruft niemand direkt auf.
REVOKE ALL ON FUNCTION public.presence_sites_bootstrap() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.presence_sites_guard_publish() FROM PUBLIC;

-- ============================================================
-- 7. Ein Recht zurücknehmen, das niemand vergeben hat
-- ============================================================
--
-- BEFUND, gemessen am 2026-09-06 gegen das voll migrierte Schema.
--
-- Die drei Presence-Tabellen tragen `anon=arwd` — SELECT, INSERT, UPDATE
-- **und** DELETE für die anonyme Rolle. Migration `20260906120000` hat das
-- nicht vergeben; sie hat ausdrücklich nur `authenticated` berechtigt und im
-- Kommentar festgehalten „anon bekommt nichts". Das war falsch, und zwar
-- nicht durch einen Fehler in der Migration:
--
-- `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ... ON TABLES TO anon,
-- authenticated` läuft **vor** allen Migrationen — in CI so wie in Supabase.
-- Jede neu erzeugte Tabelle in `public` bekommt diese Rechte bei ihrer
-- Erzeugung. Eine Migration, die danach nur `authenticated` erwähnt, nimmt
-- `anon` nichts weg; sie bestätigt bloss etwas, das schon da war.
--
-- **Heute ist nichts abgeflossen**: RLS ist auf allen drei Tabellen aktiv,
-- und keine Policy trifft auf `anon` zu — die Abfrage liefert null Zeilen,
-- nachgemessen. Der Befund ist trotzdem einer, weil zwischen dem
-- öffentlichen anon-Schlüssel und diesen Zeilen genau **eine** Schicht steht
-- statt zwei. Es genügte eine später hinzugefügte, gut gemeinte Policy für
-- eine öffentliche Liste veröffentlichter Sites — und `anon` hätte damit
-- nicht nur Lese-, sondern auch Schreib- und Löschrecht auf Entwürfen und
-- Auftragsverarbeitungsverträgen.
--
-- Deshalb hier ausdrücklich zurückgenommen. Der Router braucht es nicht: Er
-- geht über `presence_resolve_host()`, und genau dafür ist die Funktion da.
--
-- ⚠️ Der Befund ist grösser als diese drei Tabellen — er gilt für **jede**
-- Tabelle, die dieses Repo in `public` anlegt. Hier wird nur der eigene
-- Bereich in Ordnung gebracht; die Frage, ob `anon` überhaupt je
-- Default-Schreibrechte bekommen sollte, ist eine Betreiberentscheidung und
-- gehört nicht in diese Migration.

REVOKE ALL ON public.presence_sites             FROM anon;
REVOKE ALL ON public.business_profiles          FROM anon;
REVOKE ALL ON public.data_processing_agreements FROM anon;

COMMIT;

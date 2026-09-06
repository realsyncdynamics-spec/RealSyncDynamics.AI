-- Presence Layer — Scope 1: Datenmodell + RLS
--
-- ZWECK
--
-- Handwerksbetriebe erhalten eine erzeugte Website ("Presence Site"). Jede
-- solche Site erzeugt einen Eintrag im Governance-Bestand: Presence erzeugt
-- digitale Assets, Governance kontrolliert und beweist, was darin passiert.
--
-- Diese Migration liefert AUSSCHLIESSLICH Datenmodell und RLS. Kein
-- Enforcement, keine Policy-Auswertung, keine Laufzeit-Erzeugung von
-- Evidence. Was hier steht, sind Tatsachen und Schranken — keine Fähigkeiten,
-- die zur Laufzeit niemand einlöst.
--
-- GEMESSENER IST-ZUSTAND (2026-09-06, Projekt ebljyceifhnlzhjfyxup)
--
-- Der Auftrag nennt sieben Tabellen. Zwei davon existierten bereits
-- (`tenants` mit 6 Zeilen, `ai_systems` mit 0 Zeilen), zwei weitere hatten
-- funktionsgleiche Nachbarn im Bestand (`ai_runtime_events`,
-- `evidence_items`). Deshalb legt diese Migration nur DREI Tabellen neu an
-- und erweitert VIER bestehende. Keine Zeile Bestandsdaten wird verändert.
--
-- ENTSCHEIDUNGEN DES EIGENTÜMERS (2026-09-06), die vom naheliegenden
-- Vorgehen abweichen und deshalb hier festgehalten sind:
--
--   1. `tenants` erhält slug, plan UND status — wie im Auftrag. Zur
--      Nachrangigkeit von `plan` siehe Abschnitt 2, sie ist wichtig.
--   2. Kein eigenes `ai_events`. Der Presence-Ereignisstrom wird in
--      `ai_runtime_events` gefaltet (Abschnitt 7).
--   3. Kein eigenes `evidence`. Presence-Nachweise laufen über den
--      bestehenden Evidence Vault (Abschnitt 8).
--   4. `ai_systems.tenant_id` wird auf NOT NULL verschärft (Abschnitt 3).
--
-- COMPLIANCE-BEZUG
--
-- DSGVO Art. 6 (Rechtsgrundlage — Abschnitt 7), Art. 28 (Auftrags-
-- verarbeitung — Abschnitt 6), Art. 5 Abs. 2 (Rechenschaftspflicht — die
-- Mandantentrennung in Abschnitt 9 ist ihre technische Voraussetzung).
-- EU AI Act Art. 12 (Protokollierung) für den Ereignisstrom.
--
-- Rückweg: `20260906120000_presence_layer_scope1_rollback.sql`.

BEGIN;

-- ============================================================
-- 1. Vokabular — einmal definiert, überall referenziert
-- ============================================================
--
-- Bewusst CHECK-Constraints statt PostgreSQL-ENUM-Typen: Ein ENUM lässt sich
-- nur mit ALTER TYPE erweitern, das ausserhalb einer Transaktion laufen muss
-- und nicht rücknehmbar ist. Ein CHECK ist additiv änderbar und passt damit
-- zur Repo-Regel "Migrationen immer additiv" (CLAUDE.md §3).

-- Rechtsgrundlagen nach DSGVO Art. 6 Abs. 1. Der Auftrag nennt genau diese
-- vier; 'vital_interests' und 'public_task' fehlen absichtlich — sie kommen
-- im Presence-Kontext (Handwerksbetrieb, Lead-Erfassung) nicht vor, und ein
-- unbenutzter Wert im Vokabular lädt zur falschen Wahl ein.
CREATE OR REPLACE FUNCTION public.presence_legal_bases()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT ARRAY['consent', 'contract', 'legitimate_interest', 'legal_obligation']::TEXT[];
$$;

COMMENT ON FUNCTION public.presence_legal_bases() IS
    'DSGVO Art. 6 Abs. 1 — die im Presence Layer zulässigen Rechtsgrundlagen. '
    'Steht doppelt: hier und in der CHECK-Bedingung ai_runtime_events_legal_basis_check. '
    'Nie einseitig ändern.';

-- ============================================================
-- 2. tenants — slug, plan, status
-- ============================================================

ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS slug   TEXT,
    ADD COLUMN IF NOT EXISTS plan   TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- slug wird zur DNS-Bezeichnung in {slug}.realsync.app. Deshalb keine
-- beliebige Zeichenkette: Ein Slug, der als Hostname unzulässig ist, würde
-- den Router (Aufgabe 3) mit einer Route beliefern, die nie auflösbar ist.
-- Regel nach RFC 1123: Kleinbuchstaben, Ziffern, Bindestrich, nicht am Rand,
-- höchstens 63 Zeichen.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_slug_format_check'
    ) THEN
        ALTER TABLE public.tenants
            ADD CONSTRAINT tenants_slug_format_check
            CHECK (slug IS NULL OR slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');
    END IF;
END $$;

-- Teil-Unique: Die 6 Bestandsmandanten haben keinen Slug und sollen sich
-- nicht gegenseitig über NULL blockieren.
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique
    ON public.tenants (slug) WHERE slug IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_status_check'
    ) THEN
        ALTER TABLE public.tenants
            ADD CONSTRAINT tenants_status_check
            CHECK (status IN ('active', 'trial', 'suspended', 'closed'));
    END IF;
END $$;

COMMENT ON COLUMN public.tenants.slug IS
    'DNS-Bezeichnung des Mandanten für {slug}.realsync.app. Adresse, nicht Anzeigename.';

COMMENT ON COLUMN public.tenants.status IS
    'Lebenszyklus des Mandanten: active | trial | suspended | closed.';

-- ⚠️ NACHRANGIGKEIT VON tenants.plan — bitte vor Gebrauch lesen.
--
-- Die kanonische Quelle für Planzugehörigkeit ist und bleibt
-- `shared/pricing.ts` → `subscriptions.plan_key` → `tenant_entitlements()` /
-- `get_tenant_plan_key()` (CLAUDE.md §7). Diese Spalte ist auf ausdrückliche
-- Entscheidung des Eigentümers vom 2026-09-06 angelegt worden, obwohl sie
-- damit eine zweite Stelle ist, an der ein Planname steht.
--
-- Daraus folgt eine harte Regel: **Kein Zugriffsgate liest diese Spalte.**
-- Berechtigungen laufen ausschliesslich über hasPermission() / hasModule() /
-- limitOf() bzw. tenant_entitlements(). Wer hier gatet, baut ein
-- Berechtigungssystem, das gegenüber der Abrechnung auseinanderläuft — und
-- der Kunde bemerkt es als bezahltes, aber gesperrtes Modul.
--
-- Der CHECK bindet den Wert wenigstens an die sechs realen Ränge, damit hier
-- kein erfundener Planname landet (der Name "Scale" ist untersagt, §7).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tenants_plan_check'
    ) THEN
        ALTER TABLE public.tenants
            ADD CONSTRAINT tenants_plan_check
            CHECK (plan IS NULL OR plan IN
                ('free', 'starter', 'growth', 'agency', 'enterprise', 'partner'));
    END IF;
END $$;

COMMENT ON COLUMN public.tenants.plan IS
    'NACHRANGIG. Kanonisch ist subscriptions.plan_key via get_tenant_plan_key(). '
    'Diese Spalte darf für KEIN Zugriffsgate herangezogen werden.';

-- ============================================================
-- 3. ai_systems — Presence-Felder und Mandantenpflicht
-- ============================================================

ALTER TABLE public.ai_systems
    ADD COLUMN IF NOT EXISTS system_type    TEXT,
    ADD COLUMN IF NOT EXISTS provider       TEXT,
    ADD COLUMN IF NOT EXISTS discovered_via TEXT;

-- VERSCHÄRFUNG, freigegeben am 2026-09-06.
--
-- tenant_id war nullable. Eine Zeile ohne Mandant ist von keiner
-- RLS-Policy erfasst — sie gehört niemandem und ist damit für jeden
-- unsichtbar oder, bei anders formulierten Policies, für jeden sichtbar.
-- Für eine Tabelle, die den KI-Bestand eines Mandanten führt, ist das der
-- Bruch der Mandantentrennung an ihrer Wurzel.
--
-- Gefahrlos zum Zeitpunkt dieser Migration: Die Tabelle enthält 0 Zeilen
-- (gemessen 2026-09-06). Der Guard unten stellt sicher, dass das auch beim
-- Anwenden noch gilt — sonst bricht die Migration, statt Daten zu verlieren.
DO $$
DECLARE
    v_orphans BIGINT;
BEGIN
    SELECT count(*) INTO v_orphans FROM public.ai_systems WHERE tenant_id IS NULL;
    IF v_orphans > 0 THEN
        RAISE EXCEPTION
            'ai_systems: % Zeile(n) ohne tenant_id. NOT NULL würde sie unzugänglich machen. '
            'Erst zuordnen, dann diese Migration erneut anwenden.', v_orphans;
    END IF;
END $$;

ALTER TABLE public.ai_systems ALTER COLUMN tenant_id SET NOT NULL;

-- provider steht neben dem vorhandenen vendor. Der Auftrag nennt provider
-- ausdrücklich; vendor bleibt unangetastet, weil bestehender Code darauf
-- schreibt (telemetry-ai-event, ai_runtime_events.vendor). Für den
-- Presence-Pfad ist provider das Feld — wer aggregiert, muss beide lesen.
COMMENT ON COLUMN public.ai_systems.provider IS
    'Anbieter des KI-Systems im Presence-Pfad. Der Bestand nutzt weiterhin vendor; '
    'beide Spalten existieren nebeneinander, siehe Migration 20260906120000.';

COMMENT ON COLUMN public.ai_systems.system_type IS
    'Art des Systems, z. B. website_assistant. Frei, weil der Bestand noch keine Typisierung hat.';

COMMENT ON COLUMN public.ai_systems.discovered_via IS
    'Wie das System in den Bestand kam, z. B. presence_onboarding. Herkunftsnachweis der Registrierung.';

CREATE INDEX IF NOT EXISTS ai_systems_tenant_discovered_idx
    ON public.ai_systems (tenant_id, discovered_via) WHERE discovered_via IS NOT NULL;

-- ============================================================
-- 4. business_profiles — Stammdaten des Betriebs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.business_profiles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    owner_name    TEXT,
    address       TEXT,
    phone         TEXT,
    email         TEXT,
    logo_url      TEXT,
    services      JSONB NOT NULL DEFAULT '[]'::jsonb,
    opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Ein Betrieb je Mandant. Der Auftrag sagt es nicht ausdrücklich, aber
    -- das Produkt schon: ein Handwerksbetrieb = ein Mandant. Ohne diese
    -- Schranke entstünden zwei konkurrierende Stammdatensätze, und die
    -- Site-Erzeugung müsste raten, welcher gilt.
    CONSTRAINT business_profiles_one_per_tenant UNIQUE (tenant_id),

    -- services ist eine Liste, opening_hours ein Objekt. Ohne diese Prüfung
    -- nimmt jsonb auch eine Zahl oder einen String entgegen, und der Fehler
    -- fällt erst beim Rendern der Website auf.
    CONSTRAINT business_profiles_services_is_array
        CHECK (jsonb_typeof(services) = 'array'),
    CONSTRAINT business_profiles_opening_hours_is_object
        CHECK (jsonb_typeof(opening_hours) = 'object')
);

COMMENT ON TABLE public.business_profiles IS
    'Stammdaten des Handwerksbetriebs, Quelle für die erzeugte Presence Site. '
    'Enthält personenbezogene Daten (owner_name, phone, email) — DSGVO Art. 4 Nr. 1.';

-- ============================================================
-- 5. presence_sites — die erzeugte Website
-- ============================================================

CREATE TABLE IF NOT EXISTS public.presence_sites (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    template_id        TEXT NOT NULL,
    slug               TEXT NOT NULL,
    custom_domain      TEXT,
    cloudflare_project TEXT,
    deployment_id      TEXT,
    status             TEXT NOT NULL DEFAULT 'draft',
    published_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT presence_sites_status_check
        CHECK (status IN ('draft', 'review', 'published', 'suspended', 'archived')),

    -- Wie tenants.slug: Das ist eine DNS-Bezeichnung, keine Überschrift.
    CONSTRAINT presence_sites_slug_format_check
        CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),

    -- published_at und status dürfen sich nicht widersprechen. Eine Site,
    -- die als veröffentlicht geführt wird, aber keinen Zeitpunkt trägt,
    -- macht jede spätere Beweisführung über den Zeitpunkt unmöglich.
    CONSTRAINT presence_sites_published_needs_timestamp
        CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS presence_sites_slug_unique
    ON public.presence_sites (slug);

CREATE UNIQUE INDEX IF NOT EXISTS presence_sites_custom_domain_unique
    ON public.presence_sites (custom_domain) WHERE custom_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS presence_sites_tenant_idx
    ON public.presence_sites (tenant_id, created_at DESC);

COMMENT ON TABLE public.presence_sites IS
    'Erzeugte Website eines Mandanten. Ein Deployment bedient alle Mandanten; '
    'die Zuordnung Host → Mandant läuft über slug bzw. custom_domain.';

COMMENT ON COLUMN public.presence_sites.slug IS
    'DNS-Bezeichnung der Site für {slug}.realsync.app. Global eindeutig, nicht nur je Mandant — '
    'zwei Mandanten können sich denselben Hostnamen nicht teilen.';

-- ============================================================
-- 6. data_processing_agreements — AVV nach DSGVO Art. 28
-- ============================================================
--
-- Nicht zu verwechseln mit `dpias` (Datenschutz-Folgenabschätzung, Art. 35).
-- Der AVV regelt das Verhältnis Verantwortlicher ↔ Auftragsverarbeiter; die
-- DSFA bewertet ein Verarbeitungsrisiko. Beide existieren nebeneinander.

CREATE TABLE IF NOT EXISTS public.data_processing_agreements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending',
    version      TEXT NOT NULL,
    accepted_at  TIMESTAMPTZ,
    accepted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    document_url TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT dpa_status_check
        CHECK (status IN ('pending', 'accepted', 'withdrawn', 'superseded')),

    -- Ein angenommener AVV ohne Zeitpunkt und ohne annehmende Person ist
    -- kein Nachweis, sondern eine Behauptung. DSGVO Art. 5 Abs. 2 verlangt
    -- die Belegbarkeit — deshalb steht sie hier als Schranke, nicht als
    -- Konvention, an die sich Anwendungscode halten möge.
    CONSTRAINT dpa_accepted_needs_proof
        CHECK (status <> 'accepted' OR (accepted_at IS NOT NULL AND accepted_by IS NOT NULL))
);

-- Höchstens ein gültiger AVV je Mandant. Ältere Fassungen bleiben als
-- 'superseded' erhalten — der Prüfpfad braucht sie.
CREATE UNIQUE INDEX IF NOT EXISTS dpa_one_active_per_tenant
    ON public.data_processing_agreements (tenant_id)
    WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS dpa_tenant_status_idx
    ON public.data_processing_agreements (tenant_id, status);

COMMENT ON TABLE public.data_processing_agreements IS
    'Auftragsverarbeitungsvertrag nach DSGVO Art. 28. Nicht identisch mit dpias (Art. 35 DSFA).';

-- ============================================================
-- 7. ai_runtime_events — der Presence-Ereignisstrom, eingefaltet
-- ============================================================
--
-- Der Auftrag nennt eine Tabelle `ai_events`. Sie wird NICHT angelegt.
-- `ai_runtime_events` trägt bereits tenant_id, ai_system_id, event_type,
-- risk_level, occurred_at und metadata — also sechs der zehn geforderten
-- Felder. Ein dritter Ereignisstrom neben diesem und `ai_evidence_events`
-- wäre genau die Fragmentierung, die P2-5 eine Ebene höher vermieden hat.
-- Entscheidung des Eigentümers vom 2026-09-06.

ALTER TABLE public.ai_runtime_events
    ADD COLUMN IF NOT EXISTS channel         TEXT,
    ADD COLUMN IF NOT EXISTS data_categories TEXT[] NOT NULL DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS legal_basis     TEXT,
    ADD COLUMN IF NOT EXISTS policy_result   TEXT;

-- ⚠️ ABWEICHUNG VOM AUFTRAG, bewusst und begründet.
--
-- Der Auftrag verlangt `legal_basis NOT NULL` — "ohne Rechtsgrundlage darf
-- kein Event entstehen". Eine Spaltenweite NOT NULL ist hier aber nicht
-- umsetzbar, ohne einen der beiden Fehler zu machen:
--
--   (a) NOT NULL mit DEFAULT: Dann entstehen weiterhin Ereignisse ohne
--       geprüfte Rechtsgrundlage — sie tragen nur stillschweigend ein
--       Etikett, das niemand gesetzt hat. Das ist schlechter als gar keine
--       Angabe, weil es einen Nachweis vortäuscht.
--   (b) NOT NULL ohne DEFAULT: Bricht `telemetry-ai-event` (Zeile 206 ff.),
--       das heute ohne legal_basis schreibt — ein öffentlicher Contract,
--       den CLAUDE.md §12 ausdrücklich schützt.
--
-- Umgesetzt ist deshalb die Regel dort, wo sie hingehört: **an den
-- Presence-Kanälen**. Ein Ereignis, das einen Kanal benennt, muss eine
-- Rechtsgrundlage tragen. Der bestehende Gateway-Pfad schreibt ohne Kanal
-- und behält seinen Contract; er hat seine eigene Rechtsgrundlagen-Frage,
-- die dieser Scope nicht beantwortet.
--
-- Für den Presence Layer ist die Zusage damit vollständig eingelöst:
-- Ohne Rechtsgrundlage entsteht dort kein Ereignis. DSGVO Art. 6 Abs. 1.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_runtime_events_legal_basis_check'
    ) THEN
        ALTER TABLE public.ai_runtime_events
            ADD CONSTRAINT ai_runtime_events_legal_basis_check
            CHECK (legal_basis IS NULL OR legal_basis IN
                ('consent', 'contract', 'legitimate_interest', 'legal_obligation'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_runtime_events_channel_needs_legal_basis'
    ) THEN
        ALTER TABLE public.ai_runtime_events
            ADD CONSTRAINT ai_runtime_events_channel_needs_legal_basis
            CHECK (channel IS NULL OR legal_basis IS NOT NULL);
    END IF;
END $$;

COMMENT ON COLUMN public.ai_runtime_events.legal_basis IS
    'DSGVO Art. 6 Abs. 1. Pflicht, sobald channel gesetzt ist — erzwungen durch '
    'ai_runtime_events_channel_needs_legal_basis. Ohne Kanal (Bestands-Gateway-Pfad) optional.';

COMMENT ON COLUMN public.ai_runtime_events.channel IS
    'Presence-Kanal des Ereignisses, z. B. website_assistant. Setzt legal_basis zur Pflicht.';

COMMENT ON COLUMN public.ai_runtime_events.data_categories IS
    'Kategorien verarbeiteter Daten nach DSGVO Art. 30 Abs. 1 lit. c.';

-- Der Auftrag verlangt (tenant_id, occurred_at) und (tenant_id, ai_system_id).
-- Ersteres existiert bereits als ai_runtime_events_tenant_idx; nur das
-- zweite fehlt.
CREATE INDEX IF NOT EXISTS ai_runtime_events_tenant_system_idx
    ON public.ai_runtime_events (tenant_id, ai_system_id);

-- ============================================================
-- 8. evidence_items — Presence-Herkunft im bestehenden Vault
-- ============================================================
--
-- Der Auftrag nennt eine Tabelle `evidence`. Sie wird NICHT angelegt.
-- Der Evidence Vault trägt eine Hash-Kette, deren Kanonisierung zeichengenau
-- zwischen `packages/evidence-chain` und `supabase/functions/evidence-vault`
-- übereinstimmen muss (CLAUDE.md §2). Eine zweite Tabelle mit eigenem `hash`
-- erzeugte einen Beweispfad, den die Verifizierung nicht kennt — also einen
-- Nachweis, den niemand prüfen kann. Entscheidung des Eigentümers 2026-09-06.
--
-- Von den geforderten Feldern sind vorhanden: hash (file_hash), timestamp
-- (created_at), retention_until (expires_at), metadata. Es fehlen nur die
-- beiden Herkunftsfelder.

ALTER TABLE public.evidence_items
    ADD COLUMN IF NOT EXISTS source_type TEXT,
    ADD COLUMN IF NOT EXISTS source_id   UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'evidence_items_source_pairing_check'
    ) THEN
        -- Eine Quellenangabe ist nur als Paar brauchbar: Ein source_type
        -- ohne id zeigt nirgendwohin, eine id ohne Typ ist nicht auflösbar.
        ALTER TABLE public.evidence_items
            ADD CONSTRAINT evidence_items_source_pairing_check
            CHECK ((source_type IS NULL) = (source_id IS NULL));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS evidence_items_source_idx
    ON public.evidence_items (tenant_id, source_type, source_id)
    WHERE source_type IS NOT NULL;

COMMENT ON COLUMN public.evidence_items.source_type IS
    'Herkunft des Nachweises, z. B. presence_site. Nur zusammen mit source_id gültig.';

COMMENT ON COLUMN public.evidence_items.source_id IS
    'Kennung der Quellzeile. retention_until des Auftrags ist die bestehende Spalte expires_at.';

-- ============================================================
-- 9. RLS — Mandantentrennung auf den neuen Tabellen
-- ============================================================
--
-- Muster wie im übrigen Repo: is_tenant_member() für Lesen,
-- is_tenant_owner_or_admin() für Schreiben. Beide sind SECURITY DEFINER und
-- lösen über public.memberships gegen auth.uid() auf.
--
-- WARUM SCHREIBEN NUR FÜR OWNER/ADMIN: business_profiles bestimmt, was
-- öffentlich über den Betrieb ausgesagt wird; presence_sites bestimmt, was
-- unter welchem Hostnamen erreichbar ist; der AVV ist eine
-- Willenserklärung. Alle drei sind Entscheidungen des Betriebs, nicht
-- Arbeitsdaten eines beliebigen Mitglieds.
--
-- ── SERVICE-ROLE-PFAD, ausdrücklich dokumentiert ──────────────────────────
--
-- `service_role` umgeht RLS grundsätzlich (BYPASSRLS) — keine der folgenden
-- Policies wirkt auf sie. Das ist gewollt und die einzige Art, wie
-- serverseitige Automatik (Site-Erzeugung, Deployment-Rückmeldung von
-- Cloudflare, Aufbewahrungsläufe) schreiben kann.
--
-- Daraus folgen zwei Regeln, die nirgends technisch erzwingbar sind und
-- deshalb hier stehen:
--
--   1. Der Service-Role-Key liegt AUSSCHLIESSLICH in Edge Functions. Nie im
--      Browser, nie im Cloudflare Worker aus Aufgabe 3 — der Router löst
--      Hostnamen auf und liest Template-Konfiguration; dafür genügt der
--      anon-Key plus die Lesepolicies unten.
--   2. Jede Edge Function, die mit Service-Role auf diese Tabellen schreibt,
--      muss den tenant_id-Filter SELBST setzen. RLS fängt sie nicht ab.
--      Ein vergessenes WHERE ist dort ein mandantenübergreifender Zugriff.

ALTER TABLE public.business_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_sites               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_processing_agreements   ENABLE ROW LEVEL SECURITY;

-- ── business_profiles ──
DROP POLICY IF EXISTS business_profiles_tenant_select ON public.business_profiles;
CREATE POLICY business_profiles_tenant_select
    ON public.business_profiles FOR SELECT
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS business_profiles_admin_insert ON public.business_profiles;
CREATE POLICY business_profiles_admin_insert
    ON public.business_profiles FOR INSERT
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS business_profiles_admin_update ON public.business_profiles;
CREATE POLICY business_profiles_admin_update
    ON public.business_profiles FOR UPDATE
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS business_profiles_admin_delete ON public.business_profiles;
CREATE POLICY business_profiles_admin_delete
    ON public.business_profiles FOR DELETE
    USING (public.is_tenant_owner_or_admin(tenant_id));

-- ── presence_sites ──
DROP POLICY IF EXISTS presence_sites_tenant_select ON public.presence_sites;
CREATE POLICY presence_sites_tenant_select
    ON public.presence_sites FOR SELECT
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS presence_sites_admin_insert ON public.presence_sites;
CREATE POLICY presence_sites_admin_insert
    ON public.presence_sites FOR INSERT
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS presence_sites_admin_update ON public.presence_sites;
CREATE POLICY presence_sites_admin_update
    ON public.presence_sites FOR UPDATE
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS presence_sites_admin_delete ON public.presence_sites;
CREATE POLICY presence_sites_admin_delete
    ON public.presence_sites FOR DELETE
    USING (public.is_tenant_owner_or_admin(tenant_id));

-- ── data_processing_agreements ──
--
-- Kein DELETE für Clients, auch nicht für Owner. Ein AVV ist ein
-- Rechenschaftsnachweis nach DSGVO Art. 5 Abs. 2; Rücknahme läuft über
-- status = 'withdrawn', nicht über Löschen. Eine Policy, die es erlaubte,
-- wäre die Möglichkeit, den eigenen Prüfpfad zu bereinigen.
DROP POLICY IF EXISTS dpa_tenant_select ON public.data_processing_agreements;
CREATE POLICY dpa_tenant_select
    ON public.data_processing_agreements FOR SELECT
    USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS dpa_admin_insert ON public.data_processing_agreements;
CREATE POLICY dpa_admin_insert
    ON public.data_processing_agreements FOR INSERT
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

DROP POLICY IF EXISTS dpa_admin_update ON public.data_processing_agreements;
CREATE POLICY dpa_admin_update
    ON public.data_processing_agreements FOR UPDATE
    USING (public.is_tenant_owner_or_admin(tenant_id))
    WITH CHECK (public.is_tenant_owner_or_admin(tenant_id));

-- ============================================================
-- 10. Rechte
-- ============================================================
--
-- Ausdrücklich statt auf Default-Privileges vertrauend: Die CI-Lehre vom
-- 2026-09-06 (CLAUDE.md §5) war, dass pauschale Grants und ausdrückliche
-- Revokes einander überschreiben, je nach Reihenfolge.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presence_sites    TO authenticated;
GRANT SELECT, INSERT, UPDATE          ON public.data_processing_agreements TO authenticated;

GRANT EXECUTE ON FUNCTION public.presence_legal_bases() TO authenticated, service_role;

-- anon bekommt nichts. Der Router aus Aufgabe 3 löst öffentlich erreichbare
-- Hostnamen auf — welchen Weg er dafür bekommt, entscheidet Aufgabe 3;
-- ein pauschales Leserecht für anon auf presence_sites wäre es nicht, denn
-- die Tabelle führt auch unveröffentlichte Entwürfe.

COMMIT;

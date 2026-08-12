-- P0-Sicherheitshärtung — schliesst die Befunde C-01, C-03 und H-01…H-04 aus
-- docs/audits/CODE_REALITY_AUDIT_2026-08-09.md.
--
-- WARUM EINE NACHGELAGERTE MIGRATION UND KEINE KORREKTUR AM ORIGINAL
--
-- Die verursachenden Migrationen (20260406000000, 20260517000000,
-- 20260518000000, 20260628193744, 20260705*, 20260706011047, 20260717191000
-- u. a.) sind bereits gemergt. Die Append-only-Regel aus CLAUDE.md §3 und der
-- CI-Check in .github/workflows/ci.yml verbieten es, sie zu editieren — zu
-- Recht: eine bereits angewendete Migration nachtraeglich zu aendern erzeugt
-- Drift zwischen Ledger und Schema. Diese Migration laeuft deshalb NACH ihnen
-- und korrigiert das Ergebnis.
--
-- ZUM ZEITPUNKT DER ERSTELLUNG WAR PRODUKTION NICHT BETROFFEN
--
-- Abgleich gegen die Live-DB am 2026-08-09: 137 von 270 Migrationen
-- angewendet, 177 Tabellen, davon 177 mit RLS — kein einziger der unten
-- behandelten Faelle war produktiv wirksam. Die betroffenen Migrationen
-- liegen alle im nicht angewendeten Rueckstand. Genau das macht diese Datei
-- dringend: sobald der Rueckstand ueber
-- docs/runbooks/p0-2-migration-reconciliation.md ausgerollt wird, entstehen
-- die Luecken in einem Zug. Diese Migration schliesst sie im selben Zug wieder,
-- bevor irgendein Client sie sehen kann.
--
-- Alles hier ist additiv und idempotent: kein DROP TABLE, kein Datenverlust,
-- keine Aenderung an bestehenden Spalten. Mehrfach ausfuehrbar.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- TEIL 1 — C-01: Cross-Tenant-IDOR ueber anon-freigegebene RPCs
-- ═══════════════════════════════════════════════════════════════════════
--
-- Sieben SECURITY-DEFINER-Funktionen nehmen die Mandanten-ID als Parameter
-- vom Aufrufer entgegen, pruefen keine Mitgliedschaft und waren per
-- GRANT EXECUTE an `anon` freigegeben. SECURITY DEFINER umgeht RLS per
-- Definition — damit war fremder Compliance-Score lesbar UND schreibbar,
-- ohne Konto, allein mit der oeffentlichen Anon-Key und einer Tenant-UUID.
--
-- Der Entzug ist der vollstaendige Fix, nicht nur eine Abschwaechung: eine
-- Pruefung aller Aufrufer (src/ und supabase/functions/) hat ergeben, dass
-- JEDER Aufruf aus einer Edge Function mit service_role kommt — es gibt
-- keinen einzigen Frontend-Aufruf. `anon` und `authenticated` brauchen diese
-- Funktionen also gar nicht.
--
-- `authenticated` wird bewusst mit entzogen: ein eingeloggter Nutzer von
-- Tenant A darf get_dashboard_summary(<Tenant B>) genauso wenig aufrufen wie
-- ein anonymer. Solange die Funktionen keinen is_tenant_member()-Guard
-- tragen, waere jede Freigabe an `authenticated` derselbe Fehler in klein.
--
-- to_regprocedure() liefert NULL statt zu werfen, wenn die Funktion (noch)
-- nicht existiert — die Migration bleibt damit auch in einer DB lauffaehig,
-- in der der 20260705-Block nie angewendet wurde.

DO $$
DECLARE
    sig TEXT;
    sigs TEXT[] := ARRAY[
        -- 20260705300000_dashboard_intelligence_layer.sql
        'public.get_dashboard_summary(uuid)',
        'public.update_compliance_score(uuid,int,int,int,int,int,int,int,int,int)',
        'public.add_dashboard_insight(uuid,text,text,text,text,text,int,boolean,text)',
        -- 20260705240000_compliance_monitoring_alerts.sql
        'public.get_unresolved_alerts(uuid)',
        'public.log_compliance_alert(uuid,uuid,text,text,text,text,text)',
        'public.resolve_compliance_alert(uuid)',
        'public.acknowledge_compliance_alert(uuid,uuid)',
        -- 20260705210000_partner_provisioning.sql
        'public.partner_increment_quota(uuid)',
        'public.partner_get_quota_used(uuid)',
        -- 20260705220000_white_label_branding.sql
        'public.get_tenant_branding(uuid)',
        'public.get_tenant_branding_by_domain(text)'
    ];
BEGIN
    FOREACH sig IN ARRAY sigs LOOP
        IF to_regprocedure(sig) IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
            RAISE NOTICE 'P0-Haertung: EXECUTE auf % nur noch service_role', sig;
        END IF;
    END LOOP;
END $$;

-- Offen und bewusst nicht Teil dieser Migration: die Funktionskoerper um
-- einen is_tenant_member(p_tenant_id)-Guard erweitern, damit sie spaeter
-- gefahrlos auch an `authenticated` freigegeben werden koennen. Das aendert
-- Verhalten und gehoert in einen eigenen, testbaren Schritt. Der Entzug hier
-- schliesst die Luecke sofort und ohne Verhaltensrisiko.


-- ═══════════════════════════════════════════════════════════════════════
-- TEIL 2 — H-01…H-04: Policies, die PUBLIC statt service_role treffen
-- ═══════════════════════════════════════════════════════════════════════
--
-- Zehn Policies heissen "Service role can …", tragen aber keine
-- TO service_role-Klausel. In Postgres gilt eine Policy ohne TO fuer PUBLIC.
-- Die Absicht war korrekt, die Umsetzung nicht.
--
-- Schwerpunkt: governance_audit_log nahm INSERTs von jedem entgegen. Ein
-- Pruefpfad, dessen Eintraege nicht authentisch sind, ist als Nachweis
-- wertlos — fuer EU-AI-Act Art. 12 disqualifizierend.
--
-- Vorgehen: alte Policy droppen, gleichnamige mit TO service_role neu
-- anlegen. Drop-then-create haelt die Migration replayfaehig.

DO $$
DECLARE
    r RECORD;
    fixes TEXT[][] := ARRAY[
        -- {tabelle, policy-name, kommando}
        ARRAY['agent_configuration',         'Service role can manage agent config',      'ALL'],
        ARRAY['agent_token_usage',           'Service role can view token usage',         'SELECT'],
        ARRAY['agent_token_usage',           'Service role can insert token usage',       'INSERT'],
        ARRAY['governance_audit_log',        'Service role can insert audit entries',     'INSERT'],
        ARRAY['website_compliance_reports',  'Service role can insert/update reports',    'INSERT'],
        ARRAY['website_compliance_reports',  'Service role can update reports',           'UPDATE'],
        ARRAY['api_calls',                   'api_calls service_role_insert',             'INSERT'],
        ARRAY['webhook_deliveries',          'webhook_deliveries service_role_insert',    'INSERT'],
        ARRAY['email_notifications',         'email_notifications service_role_insert',   'INSERT'],
        ARRAY['dashboard_notifications',     'Service role can create notifications',     'INSERT'],
        ARRAY['deployment_logs',             'Service role can insert logs',              'INSERT']
    ];
    i INT;
    tbl TEXT; pol TEXT; cmd TEXT;
BEGIN
    FOR i IN 1 .. array_length(fixes, 1) LOOP
        tbl := fixes[i][1]; pol := fixes[i][2]; cmd := fixes[i][3];

        IF to_regclass('public.' || tbl) IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);

        IF cmd = 'SELECT' THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR SELECT TO service_role USING (true)', pol, tbl);
        ELSIF cmd = 'INSERT' THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR INSERT TO service_role WITH CHECK (true)', pol, tbl);
        ELSIF cmd = 'UPDATE' THEN
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR UPDATE TO service_role USING (true) WITH CHECK (true)', pol, tbl);
        ELSE
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', pol, tbl);
        END IF;
    END LOOP;
END $$;

-- Lesezugriff fuer Mitglieder, wo die Daten fachlich zum Mandanten gehoeren.
-- Ohne das waeren die Tabellen nach der Haertung nur noch fuer Edge Functions
-- sichtbar und die zugehoerige UI liefe ins Leere. Nur SELECT — geschrieben
-- wird weiterhin ausschliesslich serverseitig.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['agent_token_usage','agent_configuration','governance_audit_log',
                             'website_compliance_reports','api_calls'] LOOP
        IF to_regclass('public.' || t) IS NOT NULL
           AND EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name=t AND column_name='tenant_id')
        THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' member-read', t);
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id))',
                t || ' member-read', t);
        END IF;
    END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- TEIL 3 — C-03: 33 Tabellen ohne Row Level Security
-- ═══════════════════════════════════════════════════════════════════════
--
-- Das Repo enthaelt kein REVOKE auf Tabellenebene; Supabase-Default-
-- Privileges geben `anon` und `authenticated` Zugriff auf neue Tabellen in
-- `public`. Ohne RLS heisst das: vollstaendiger mandantenuebergreifender
-- Lese- und Schreibzugriff. Betroffen u. a. das komplette Steuer-Evidence-
-- Modul (personenbezogene Daten in einem DSGVO-Produkt) und
-- provenance_records — also ausgerechnet die Integritaetsschicht.
--
-- Drei Gruppen, nach tatsaechlicher Spaltenlage getrennt:
--   A) tenant_id direkt vorhanden        → Mitglieder-Policy + service_role
--   B) Mandant nur ueber FK erreichbar   → Policy ueber Join
--   C) kein Mandantenbezug (Infra)       → RLS an, KEINE Policy (= service_role only)

-- ── Gruppe A: tenant_id direkt ────────────────────────────────────────
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        -- Steuer-Evidence (20260518000000, 20260523000000)
        'tax_years','tax_documents','tax_document_links','tax_audit_events',
        'tax_evidence_exports','tax_reminders','tax_advisor_reviews','tax_advisor_review_comments',
        -- Inventory (20260517000000)
        'inventory_items','inventory_locations','inventory_suppliers','inventory_movements',
        'inventory_stock_levels','inventory_barcodes','inventory_audit_events',
        'inventory_purchase_orders','inventory_purchase_order_items',
        -- Bots / Commerce (20260628193744)
        'bot_agents','bot_question_catalog','voice_channels','appointments',
        'availability_rules','orders','order_items',
        -- Sonstige
        'seo_marketing_audit_log'
    ] LOOP
        IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

        -- Typ-Guard: is_tenant_member(UUID) passt nur auf eine uuid-Spalte.
        -- _operation_metrics fuehrt tenant_id z. B. als TEXT und liegt deshalb
        -- in Gruppe C. Faellt kuenftig eine weitere Tabelle aus dem Muster,
        -- bekommt sie hier RLS ohne Policy (fail-closed) statt die ganze
        -- Migration zu kippen — sicher ist die richtige Fehlerrichtung.
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema='public' AND table_name=t
                         AND column_name='tenant_id' AND data_type='uuid') THEN
            RAISE NOTICE 'P0-Haertung: %.tenant_id fehlt oder ist nicht uuid — nur RLS, keine Mitglieder-Policy', t;
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' tenant-rw', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
            'USING (public.is_tenant_member(tenant_id)) '
            'WITH CHECK (public.is_tenant_member(tenant_id))',
            t || ' tenant-rw', t);

        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' service-all', t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
            t || ' service-all', t);
    END LOOP;
END $$;

-- ── Gruppe B: Mandant nur ueber Fremdschluessel ───────────────────────
--
-- provenance_records haengt an assets.tenant_id, subscription_addons an
-- subscriptions.tenant_id. Beide bekommen nur Lesezugriff fuer Mitglieder —
-- geschrieben wird ausschliesslich serverseitig. Bei provenance_records ist
-- das nicht nur Vorsicht, sondern Absicht: Herkunftsnachweise, die der
-- Client selbst schreiben koennte, waeren als Nachweis wertlos.
DO $$
BEGIN
    IF to_regclass('public.provenance_records') IS NOT NULL THEN
        ALTER TABLE public.provenance_records ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "provenance_records member-read" ON public.provenance_records;
        CREATE POLICY "provenance_records member-read"
            ON public.provenance_records FOR SELECT TO authenticated
            USING (EXISTS (
                SELECT 1 FROM public.assets a
                WHERE a.id = provenance_records.asset_id
                  AND public.is_tenant_member(a.tenant_id)
            ));

        DROP POLICY IF EXISTS "provenance_records service-all" ON public.provenance_records;
        CREATE POLICY "provenance_records service-all"
            ON public.provenance_records FOR ALL TO service_role
            USING (true) WITH CHECK (true);
    END IF;

    IF to_regclass('public.subscription_addons') IS NOT NULL THEN
        ALTER TABLE public.subscription_addons ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "subscription_addons member-read" ON public.subscription_addons;
        CREATE POLICY "subscription_addons member-read"
            ON public.subscription_addons FOR SELECT TO authenticated
            USING (EXISTS (
                SELECT 1 FROM public.subscriptions s
                WHERE s.id = subscription_addons.subscription_id
                  AND public.is_tenant_member(s.tenant_id)
            ));

        DROP POLICY IF EXISTS "subscription_addons service-all" ON public.subscription_addons;
        CREATE POLICY "subscription_addons service-all"
            ON public.subscription_addons FOR ALL TO service_role
            USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ── Gruppe C: kein Mandantenbezug → RLS ohne Policy ───────────────────
--
-- RLS ohne Policy heisst "deny all" fuer anon/authenticated und laesst nur
-- service_role durch (das BYPASSRLS traegt). Genau richtig fuer interne
-- Infrastruktur: Rate-Limit-Zaehler, Circuit-Breaker-Zustand,
-- Integrations-Katalog, Retention-Policies und aggregierte Metriken haben
-- keinen Client-Lesegrund.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        '_rate_limits','_circuit_breakers','_operation_metrics','integrations',
        'memory_retention_policies','social_publishing_metrics_hourly'
    ] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        END IF;
    END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- TEIL 4 — M-03: SECURITY DEFINER ohne festgesetzten search_path
-- ═══════════════════════════════════════════════════════════════════════
--
-- Nachzuegler zur bestehenden Pin-Migration
-- 20260530210241_pin_remaining_function_search_paths.sql. Ohne gesetzten
-- search_path ist Hijacking ueber ein gleichnamiges Objekt in einem frueher
-- durchsuchten Schema moeglich. In Supabase gedaempft, weil `public` nicht
-- frei beschreibbar ist — Haertung, kein akutes Loch.
--
-- KORREKTUR ZUM AUDIT-BERICHT: dort standen 5 betroffene Funktionen. Die
-- Zahl stammte aus statischer Analyse der Migrationsdateien und war zu
-- niedrig — der Parser erkannte `SECURITY DEFINER` nur, wenn es VOR dem
-- $$-Body steht. Funktionen der Form
--     CREATE FUNCTION f() RETURNS x AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
-- fielen durch das Raster. Gegen ein real aufgebautes Schema abgefragt sind
-- es 18. Deshalb hier keine Namensliste mehr, sondern eine Abfrage auf
-- pg_proc: das kann per Konstruktion niemanden uebersehen und deckt auch
-- kuenftige Nachzuegler ab, solange die Migration erneut laeuft.

DO $$
DECLARE
    r RECORD;
    n INT := 0;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace ns ON ns.oid = p.pronamespace
        WHERE ns.nspname = 'public'
          AND p.prosecdef
          AND (p.proconfig IS NULL
               OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', r.sig);
        n := n + 1;
    END LOOP;
    RAISE NOTICE 'P0-Haertung: search_path auf % SECURITY-DEFINER-Funktionen gesetzt', n;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- TEIL 5 — C-01 (erweitert): anon verliert EXECUTE auf SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════════════════
--
-- ERWEITERUNG GEGENUEBER DEM AUDIT-BERICHT
--
-- Der Bericht nannte 7 Funktionen mit explizitem `GRANT EXECUTE ... TO anon`.
-- Ein Test gegen ein real aufgebautes Schema zeigt: das war nur die Spitze.
-- Postgres vergibt EXECUTE auf JEDE neu angelegte Funktion per Default an
-- PUBLIC — und PUBLIC schliesst `anon` ein. Ein explizites GRANT ist also gar
-- nicht noetig, damit ein anonymer Aufrufer eine SECURITY-DEFINER-Funktion
-- starten kann; es genuegt, das REVOKE zu vergessen.
--
-- Betroffen sind dadurch u. a. tenant_entitlements(uuid) (verraet den
-- Berechtigungsumfang eines beliebigen Mandanten), has_feature(uuid,text),
-- recommend_governance_plan(uuid) und rund zwei Dutzend weitere
-- tenant-parametrisierte RPCs. Die bestehenden Teil-Revokes
-- (20260506220000, 20260620000000, 20260802192603) haben je einen Ausschnitt
-- erwischt, nie die Gesamtmenge.
--
-- Vorgehen deshalb umgekehrt: standardmaessig entziehen, gezielt freigeben.
--   REVOKE von PUBLIC + anon  → schliesst auch kuenftige Vergessens-Faelle
--   GRANT an authenticated    → eingeloggte Nutzer behalten ihren Zugriff;
--                               die Funktionen filtern selbst ueber auth.uid()
--                               bzw. sind durch RLS auf den Zieltabellen gedeckt
--   GRANT an service_role     → Edge Functions unveraendert
--
-- Die Allowlist enthaelt ausschliesslich Funktionen, die fuer nicht
-- eingeloggte Besucher gedacht sind. Zwei Muster rechtfertigen das:
--   a) der Parameter IST das Geheimnis (Token, Key, Hash) — nicht erratbar
--   b) es gibt gar keinen Mandantenbezug (Health, aggregierte Plattformzahlen,
--      oeffentliche C2PA-Verifikation)
-- Alles andere gehoert nicht in die Hand von `anon`.

DO $$
DECLARE
    r RECORD;
    revoked INT := 0;
    allowlist TEXT[] := ARRAY[
        -- (a) Parameter ist das Geheimnis
        'audit_share_get',              -- Share-Token fuer Audit-Reports
        'get_rebuild_status_by_token',  -- Rebuild-Status per Token
        'affiliate_validate',           -- Affiliate-Code
        'api_key_validate',             -- API-Key-Hash
        'partner_validate_key',         -- Partner-API-Key
        -- (b) kein Mandantenbezug / bewusst oeffentlich
        'health_ping',                  -- Uptime-Probe
        'platform_stats',               -- aggregierte Zahlen fuer die Landing
        'report_unknown_tracker',       -- anonyme Tracker-Telemetrie
        'verify_c2pa_assertion',        -- oeffentliche Herkunfts-Verifikation
        'get_provenance_chain'          -- dito; Content-Hash als Schluessel
    ];
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS sig, p.proname
        FROM pg_proc p
        JOIN pg_namespace ns ON ns.oid = p.pronamespace
        WHERE ns.nspname = 'public'
          AND p.prosecdef
          AND NOT (p.proname = ANY (allowlist))
          AND has_function_privilege('anon', p.oid, 'EXECUTE')
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
        revoked := revoked + 1;
    END LOOP;
    RAISE NOTICE 'P0-Haertung: anon-EXECUTE auf % SECURITY-DEFINER-Funktionen entzogen', revoked;
END $$;

-- Die in TEIL 1 behandelten Funktionen bleiben strenger als der Rest: dort
-- wurde auch `authenticated` entzogen, weil sie die Mandanten-ID ungeprueft
-- als Parameter nehmen. TEIL 5 laeuft danach und darf das nicht aufweichen —
-- deshalb hier erneut auf service_role verengen.
DO $$
DECLARE
    sig TEXT;
BEGIN
    FOREACH sig IN ARRAY ARRAY[
        'public.get_dashboard_summary(uuid)',
        'public.update_compliance_score(uuid,int,int,int,int,int,int,int,int,int)',
        'public.add_dashboard_insight(uuid,text,text,text,text,text,int,boolean,text)',
        'public.get_unresolved_alerts(uuid)',
        'public.log_compliance_alert(uuid,uuid,text,text,text,text,text)',
        'public.resolve_compliance_alert(uuid)',
        'public.acknowledge_compliance_alert(uuid,uuid)',
        'public.partner_increment_quota(uuid)',
        'public.partner_get_quota_used(uuid)',
        'public.get_tenant_branding(uuid)',
        'public.get_tenant_branding_by_domain(text)'
    ] LOOP
        IF to_regprocedure(sig) IS NOT NULL THEN
            EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
        END IF;
    END LOOP;
END $$;

COMMIT;

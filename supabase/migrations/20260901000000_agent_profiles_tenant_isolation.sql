-- agent_profiles — Mandantentrennung nachziehen.
--
-- ## Warum
--
-- `agent_profiles` wurde in `20260624000000_agent_operations_layer_schema.sql`
-- bewusst als **globaler Katalog** angelegt: vier interne Governance-Agenten,
-- „Keine Tenant-Bindung", lesbar fuer alle `authenticated`. Fuer diesen Zweck
-- war `USING (true)` richtig.
--
-- Inzwischen schreibt der Onboarding-Pfad **kundenbezogene** Zeilen in
-- dieselbe Tabelle (`type = 'business'`, Firmenname in `name`, `description`
-- und `system_prompt`). Damit gilt der urspruengliche Vertrag nicht mehr:
-- Jeder eingeloggte Nutzer koennte Firmennamen und Assistenten-Prompts aller
-- anderen Mandanten lesen. Das widerspricht CLAUDE.md §3 (Mandantentrennung
-- ist nicht verhandelbar).
--
-- Stand bei Erstellung dieser Migration: 4 Zeilen, alle vom 2026-08-12
-- geseedet, **keine** mit `type = 'business'`. Der Befund war also latent und
-- noch nicht eingetreten — das ist der guenstigste Zeitpunkt, ihn zu schliessen.
--
-- ## Warum `is_global` statt einer Typ-Liste in der Policy
--
-- Die Alternative waere gewesen, die vier Katalog-Typen direkt in die Policy
-- zu schreiben. Das koppelt eine Sicherheitsregel an Datenwerte und muss bei
-- jedem neuen internen Agenten nachgezogen werden — wer das vergisst, sperrt
-- sich selbst aus oder oeffnet die Tabelle wieder.
--
-- `is_global` ist die Aussage selbst, und sie **faellt geschlossen aus**:
-- Der Vorgabewert ist `false`. Eine neu eingefuegte Zeile, die weder
-- `tenant_id` noch `is_global` setzt — genau das tut der Onboarding-Pfad
-- heute —, ist damit ueber RLS fuer **niemanden** lesbar, statt fuer alle.
-- Das ist die richtige Richtung fuer einen Fehler.
--
-- ## Warum `tenant_id` NULL erlaubt bleibt
--
-- Die vier Katalogzeilen gehoeren zu keinem Mandanten; `NOT NULL` waere fuer
-- sie falsch. Ausserdem wuerde `NOT NULL` den laufenden Onboarding-Pfad, der
-- die Spalte nicht setzt, sofort brechen. Diese Migration schliesst die
-- Leseluecke, ohne einen Schreibpfad zu zerreissen: Lesen ueber `service_role`
-- (Edge Functions) ist von RLS ohnehin unberuehrt.
--
-- Additiv und idempotent. Keine Zeile wird geloescht, kein Schreibpfad
-- entzogen.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Spalten
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.agent_profiles
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Bewusst OHNE `ON DELETE CASCADE`: An `agent_profiles(id)` haengen
-- `agent_knowledge_base`, `agent_actions_log` und `agent_training_sessions`.
-- Ein Kaskadenloeschen ueber den Mandanten wuerde Nachweise mitreissen, die
-- der Pruefpfad braucht. Ein Mandant mit Agentenprofilen laesst sich damit
-- nicht beilaeufig loeschen — das ist hier die gewollte Bremse.

ALTER TABLE public.agent_profiles
    ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS agent_profiles_tenant_id_idx
    ON public.agent_profiles (tenant_id)
    WHERE tenant_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Bestand: die vier Katalogzeilen als global markieren
-- ─────────────────────────────────────────────────────────────────────────
--
-- Eng gefasst ueber die Typen aus dem Seed von `20260624000000` und
-- zusaetzlich ueber `tenant_id IS NULL`. Eine kundenbezogene Zeile kann so
-- nicht versehentlich global werden, auch wenn diese Migration spaeter
-- erneut laeuft.

UPDATE public.agent_profiles
   SET is_global = true
 WHERE tenant_id IS NULL
   AND is_global = false
   AND type IN ('automation', 'support', 'voice_call', 'screenshot_fix');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Lese-Policy
-- ─────────────────────────────────────────────────────────────────────────
--
-- Global lesbar bleibt nur, was ausdruecklich als global markiert ist.
-- Alles andere braucht eine Mandantenzugehoerigkeit. Der dritte Fall —
-- weder global noch einem Mandanten zugeordnet — ist ueber RLS unsichtbar;
-- so eine Zeile ist ein Fehler und soll nicht stillschweigend gelesen werden.

DROP POLICY IF EXISTS "agent_profiles read for authenticated" ON public.agent_profiles;
CREATE POLICY "agent_profiles read for authenticated"
    ON public.agent_profiles FOR SELECT
    TO authenticated
    USING (
        is_global
        OR (tenant_id IS NOT NULL AND public.is_tenant_member(tenant_id))
    );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Dokumentation am Objekt
-- ─────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.agent_profiles IS
    'Agentenprofile. Zwei Arten in einer Tabelle: der globale Katalog der internen Governance-Agenten (is_global = true, tenant_id IS NULL) und mandantenbezogene Profile aus dem Onboarding (tenant_id gesetzt). Lesen fuer authenticated nur ueber die jeweilige Bedingung; Schreibzugriff nur via service_role (Edge Functions).';

COMMENT ON COLUMN public.agent_profiles.tenant_id IS
    'Mandant, dem dieses Profil gehoert. NULL nur fuer den globalen Katalog.';

COMMENT ON COLUMN public.agent_profiles.is_global IS
    'Faellt geschlossen aus: Vorgabewert false. Nur ausdruecklich als global markierte Zeilen sind fuer alle authenticated lesbar.';

-- ═══════════════════════════════════════════════════════════════════════════
--  Plattform-Berechtigung — platform_operators + is_platform_operator()
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Entscheid: ADR 0011 (docs/adr/0011-agent-organisationsmodell-plattform-scope.md),
-- Status Accepted 2026-09-01, Punkt D5. Modell: docs/architecture — Artifact
-- „Organisationsmodell für ein hierarchisches Multi-Agent-System" v0.2, §06/§10.
--
-- WARUM DIESE MIGRATION ZUERST KOMMT: Die erste Platform-Scope-Policy
-- (org_units, 20260904010100) ruft is_platform_operator() auf. Die Funktion
-- muss also vor der ersten Tabelle stehen, die sie braucht — die D4-Reihenfolge
-- beginnt faktisch hier, nicht bei org_units.
--
-- WARUM NICHT profiles: profiles beschreibt den Benutzer im normalen
-- Produktkontext. Der Plattform-Operator ist eine privilegierte interne
-- Berechtigung, die gerade NICHT aus einem Tenant-Kontext abgeleitet werden
-- darf. Die Sicherheitsgrenze lautet
--     is_platform_operator() → platform_operators → auth.uid()
-- und nicht
--     tenant_id → profiles → irgendwelche Tenant-Rollen.
--
-- ABGRENZUNG, damit hier keine falsche Zusage entsteht: Diese Migration löst
-- den Befund B1 aus ADR 0011 NICHT ab. profiles.is_super_admin bleibt
-- unverändert, samt seiner offenen Rechteausweitung. platform_operators regelt
-- ausschliesslich die neue Agenten-Organisationsebene. Der Fix zu B1 ist ein
-- eigener Entscheid und eine eigene Migration.
--
-- EU-AI-Act / DSGVO: Die Tabelle entscheidet, wer plattforminterne
-- Governance-Daten sehen darf. Sie ist damit selbst zugriffsrelevant und
-- traegt deshalb RLS ohne jede Client-Policy (siehe unten).
--
-- Additiv. Es wird nichts geloescht und nichts bestehendes veraendert.

BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_operators (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'operator',
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_operators IS
  'Internes Ops-Personal von RealSyncDynamics.AI. Einzige Quelle fuer '
  'is_platform_operator() (ADR 0011 D5). Kein Tenant-Bezug: Plattform-Scope '
  'ist ausdruecklich kein Tenant.';
COMMENT ON COLUMN public.platform_operators.role IS
  'Wertebereich bewusst offen (ADR 0011, offener Punkt 3). is_platform_operator() '
  'unterscheidet heute NICHT zwischen Rollen und liefert nur boolean. Wer feiner '
  'pruefen will, baut eine eigene Funktion — nicht eine zweite Bedeutung in diese.';
COMMENT ON COLUMN public.platform_operators.active IS
  'Entzug ohne Loeschen. is_platform_operator() prueft active, nicht blosse Existenz.';

-- ── RLS: an, ohne jede Client-Policy ───────────────────────────────────────
--
-- Eine Berechtigungsquelle, die ihr eigenes Subjekt beschreiben darf, ist
-- keine Sicherheitsgrenze (ADR 0011, abgeleitete Regel zu D5, Begruendung B1).
-- Deshalb: RLS an, keine Policy fuer authenticated/anon, keine Schreibrechte.
-- Gepflegt wird die Tabelle ausschliesslich per Service-Role aus einer Edge
-- Function oder per Migration. Service-Role umgeht RLS und braucht keine Policy.
--
-- Bewusst auch KEIN Leserecht: Wer Plattform-Operator ist, geht Clients nichts an.
ALTER TABLE public.platform_operators ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_operators FROM anon, authenticated;

-- ── is_platform_operator() ─────────────────────────────────────────────────
--
-- Muster uebernommen von public.is_tenant_member()
-- (20260723000001_rls_recursion_fix_security_definer.sql): STABLE,
-- SECURITY DEFINER, SET search_path = public. SECURITY DEFINER ist noetig,
-- weil platform_operators selbst RLS ohne Lese-Policy traegt — ohne DEFINER
-- saehe die Funktion im Client-Kontext nie eine Zeile und lieferte immer false.
--
-- Die Funktion liefert ausschliesslich boolean und exponiert damit keine
-- privilegierten Daten: Der Aufrufer erfaehrt nur etwas ueber sich selbst.
CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.platform_operators po
     WHERE po.user_id = auth.uid()
       AND po.active
  );
$$;

COMMENT ON FUNCTION public.is_platform_operator() IS
  'True gdw. auth.uid() ein aktiver Plattform-Operator ist. Einzige Quelle: '
  'public.platform_operators (ADR 0011 D5). SECURITY DEFINER, weil die Quelle '
  'RLS ohne Lese-Policy traegt. Liefert nur boolean.';

-- Client-Grants: authenticated braucht EXECUTE, weil die Policies der
-- Agenten-Ebene die Funktion im Kontext des anfragenden Nutzers auswerten.
-- anon bekommt sie NICHT — alle Policies dieser Ebene sind TO authenticated,
-- und ein Grant, den niemand braucht, ist eine unnoetig breite Flaeche.
-- Soll-Liste im Guard nachgezogen: scripts/check-function-acl-drift.mjs.
REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO service_role;

COMMIT;

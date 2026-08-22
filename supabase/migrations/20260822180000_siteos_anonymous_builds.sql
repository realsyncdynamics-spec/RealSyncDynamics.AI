-- Anonyme Build-Sitzungen: Idee → Bau → Vorschau → Konto → Claim.
--
-- ## Warum eine Tabelle und nicht der Browser
--
-- Der bisherige anonyme Entwurf lag als Prompt plus Anweisungsfolge im
-- localStorage. Beim Uebernehmen wurde die Folge serverseitig nachgespielt.
-- Deterministisch, aber mit einer Schwaeche, die genau das
-- Akzeptanzkriterium verfehlt: Der Blueprint wird beim Claim **neu
-- erzeugt**. Solange `packages/siteos-core` sich nicht aendert, kommt
-- dasselbe heraus. Aendert es sich zwischen Vorschau und Anmeldung, bekommt
-- der Kunde etwas anderes als das, was er gesehen und gewollt hat — und
-- niemand merkt es, weil beide Ergebnisse „richtig" sind.
--
-- Deshalb liegt der Blueprint ab jetzt serverseitig. Der Claim **verschiebt**
-- ihn, statt ihn nachzubauen.
--
-- ## Warum eine Zeile ohne tenant_id vertretbar ist
--
-- Das Schema baut auf `tenant_id` und RLS auf; eine Zeile ohne Mandanten ist
-- dort normalerweise ein Fehler. Hier ist sie der Gegenstand: Ein anonymer
-- Entwurf gehoert per Definition niemandem, bis ihn jemand uebernimmt.
--
-- Der Praezedenzfall steht daneben: `anon_chat_runs` (Migration
-- 20260606000000) fuehrt anonyme Vorgaenge genauso. Die Absicherung ist
-- dieselbe — RLS an, **keine** Policy. Ohne Policy liest und schreibt ueber
-- PostgREST niemand; erreichbar ist die Tabelle ausschliesslich mit
-- service_role, also nur aus einer Edge Function.
--
-- ## Verfall
--
-- Sieben Tage, wie beim Preview-Worker (`workers/siteos-preview`). Das ist
-- keine Aufraeumkosmetik: Daten ohne Zweckbindung und ohne Zuordnung
-- duerfen nicht unbegrenzt liegen (Art. 5 Abs. 1 lit. e DSGVO). Ein
-- uebernommener Entwurf faellt nicht mehr weg — er gehoert dann einem
-- Mandanten und folgt dessen Aufbewahrung.

BEGIN;

-- ============================================================
-- §1 Neue Operation im anonymen Prüfpfad
-- ============================================================
-- `anon_chat_runs.op` ist per CHECK auf die vier Assistenten-Operationen
-- begrenzt. Der Build-Pfad schreibt in dieselbe Tabelle — ein zweiter
-- anonymer Prüfpfad daneben waere die zweite Wahrheit über denselben
-- Gegenstand.
ALTER TABLE public.anon_chat_runs
  DROP CONSTRAINT IF EXISTS anon_chat_runs_op_check;
ALTER TABLE public.anon_chat_runs
  ADD CONSTRAINT anon_chat_runs_op_check
  CHECK (op IN (
    'chat_anon',
    'start_audit_scan',
    'explain_finding',
    'generate_fix_snippet',
    -- Neu: anonymer SiteOS-Build und dessen Verfeinerungen.
    'siteos_build_anon',
    'siteos_refine_anon'
  ));

-- ============================================================
-- §2 Die Sitzung
-- ============================================================

CREATE TABLE IF NOT EXISTS public.siteos_anonymous_builds (
  -- Zugleich die Sitzungskennung, die der Browser behaelt. 128 Bit aus
  -- gen_random_uuid(): Wer sie hat, hat den Entwurf — sie ist damit ein
  -- Zugriffsmittel und darf nicht ratbar sein.
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Der Gegenstand. Serverseitig erzeugt, serverseitig gehalten.
  blueprint            JSONB NOT NULL,
  content_sha256       TEXT NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  slug                 TEXT NOT NULL,
  name                 TEXT NOT NULL,
  industry             TEXT NOT NULL,

  -- Ergebnis der Analyse zum selben Stand. Mitgefuehrt, damit die Vorschau
  -- den Pruefstand zeigen kann, ohne erneut zu rechnen.
  findings             JSONB NOT NULL DEFAULT '[]'::jsonb,
  scores               JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Steigt bei jeder Verfeinerung. Der Claim uebernimmt genau die Version,
  -- die zuletzt in der Vorschau stand.
  version              INTEGER NOT NULL DEFAULT 1,

  -- Herkunft (Art. 50 EU AI Act). `origin_model` ist NULL, wenn kein
  -- generatives Modell beteiligt war — das ist der Normalfall.
  prompt_sha256        TEXT,
  origin_model         TEXT,

  -- Kennung im Preview-Worker, falls die Vorschau dort ausgeliefert wird.
  -- NULL, solange der Worker nicht deployt ist; die Sitzung funktioniert
  -- auch ohne ihn.
  preview_id           TEXT,

  -- Missbrauchsabwehr und Zuordnung im Pruefpfad. Klartext-IP wird nie
  -- gespeichert (wie bei anon_chat_runs und waitlist_signups).
  ip_hash              TEXT NOT NULL,

  -- Übernahme. Alle drei zusammen oder keines — eine halb uebernommene
  -- Sitzung waere ein Zustand, den niemand aufloesen kann.
  claimed_tenant_id    UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  claimed_blueprint_id UUID REFERENCES public.siteos_blueprints(id) ON DELETE SET NULL,
  claimed_at           TIMESTAMPTZ,
  CONSTRAINT siteos_anonymous_builds_claim_complete CHECK (
    (claimed_tenant_id IS NULL AND claimed_blueprint_id IS NULL AND claimed_at IS NULL)
    OR (claimed_tenant_id IS NOT NULL AND claimed_blueprint_id IS NOT NULL AND claimed_at IS NOT NULL)
  ),

  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verfallslauf und Missbrauchsabwehr sind die beiden einzigen Abfragen, die
-- nicht ueber den Primaerschluessel gehen.
CREATE INDEX IF NOT EXISTS siteos_anonymous_builds_expiry_idx
  ON public.siteos_anonymous_builds (expires_at)
  WHERE claimed_at IS NULL;
CREATE INDEX IF NOT EXISTS siteos_anonymous_builds_ip_idx
  ON public.siteos_anonymous_builds (ip_hash, created_at);

ALTER TABLE public.siteos_anonymous_builds ENABLE ROW LEVEL SECURITY;
-- Absichtlich KEINE Policy: siehe Kopf. Ohne Policy ist die Tabelle ueber
-- PostgREST fuer anon und authenticated vollstaendig zu.

COMMENT ON TABLE public.siteos_anonymous_builds IS
  'Anonyme SiteOS-Build-Sitzungen vor der Registrierung. Kein tenant_id (der Entwurf gehoert noch niemandem), RLS ohne Policy — Zugriff nur ueber Edge Functions mit service_role. Verfall nach 7 Tagen (Art. 5 Abs. 1 lit. e DSGVO).';
COMMENT ON COLUMN public.siteos_anonymous_builds.id IS
  'Sitzungskennung und zugleich Zugriffsmittel — wer sie kennt, erreicht den Entwurf.';
COMMENT ON COLUMN public.siteos_anonymous_builds.version IS
  'Steigt bei jeder Verfeinerung. Der Claim uebernimmt diese Version unveraendert, ohne Neuerzeugung.';
COMMENT ON COLUMN public.siteos_anonymous_builds.claimed_blueprint_id IS
  'Gesetzt beim Claim. Macht die Uebernahme idempotent: ein zweiter Claim liefert dieselbe Blueprint-Zeile.';

COMMIT;

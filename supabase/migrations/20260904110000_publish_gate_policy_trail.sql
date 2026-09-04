-- P2-3 — SiteOS Publish Gate als Enforcement-Punkt: Prüfpfad der
-- Richtlinien-Entscheidung.
--
-- ## Was sich fachlich ändert (und was ausdrücklich nicht)
--
-- Der Publish Gate leitete `policy_compliant` bisher allein aus der fest
-- verdrahteten Befundtabelle des Produkts ab. Ab jetzt entscheidet zusätzlich
-- der PDP mit den Regeln DES MANDANTEN mit.
--
-- Die Ableitungsregel aus §7 der Zielarchitektur bleibt dabei **unangetastet**
-- — und damit auch die generierte Spalte `publishable`. Die PDP-Entscheidung
-- wirkt auf vorhandene Vertragsfelder: `block` nimmt `policy_compliant`,
-- `require_approval` setzt `human_approval_required`. Ein sechstes Feld hätte
-- die normative Regel geändert; das steht nicht zur Disposition.
--
-- ## Warum diese Spalten trotzdem gebraucht werden
--
-- Im Vertrag sind zwei sehr verschiedene Lagen dasselbe
-- `policy_compliant: false`:
--
--   1. Eine Richtlinie des Mandanten hat die Veröffentlichung untersagt.
--   2. Der PDP war nicht erreichbar, also ist gar nichts festgestellt.
--
-- Für den Betroffenen ist der Unterschied entscheidend — im ersten Fall muss
-- er die Site ändern, im zweiten muss jemand einen Dienst reparieren. Für
-- einen Prüfer ebenso: Ein Gate, das wegen eines Ausfalls sperrt, hat nicht
-- „die Richtlinie durchgesetzt", es hat nur nicht durchgelassen. Die
-- Unterscheidung im Klartext steht bereits im Sperrgrund; hier steht sie
-- maschinell auswertbar.
--
-- ## Additiv
--
-- Nur neue, nullable Spalten mit Vorgabewerten. Bestehende Zeilen bleiben
-- gültig: Für Bewertungen von vor dieser Migration ist `policy_engine_status`
-- NULL, und das heißt wahrheitsgemäß „damals wurde keine Richtlinie
-- ausgewertet" — nicht „ausgewertet und nichts gefunden".

BEGIN;

ALTER TABLE public.siteos_publish_evaluations
  -- 'evaluated' | 'unavailable'. NULL = vor P2-3 bewertet, siehe oben.
  ADD COLUMN IF NOT EXISTS policy_engine_status    TEXT,
  -- Entscheidung des PDP. NULL, wenn er nicht geantwortet hat.
  ADD COLUMN IF NOT EXISTS policy_decision         TEXT,
  -- Regeln, die zugetroffen haben. Leer heisst „keine getroffen" — das ist
  -- eine Aussage und deshalb nicht dasselbe wie NULL.
  ADD COLUMN IF NOT EXISTS policy_matched_ids      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Fassung des ausgewerteten Regelstands. Ohne sie liesse sich eine alte
  -- Entscheidung spaeter nicht nachrechnen: Die Regeln koennten sich
  -- inzwischen geaendert haben.
  ADD COLUMN IF NOT EXISTS policy_snapshot_version TEXT;

-- Werte aus geschlossenem Vokabular. Ein Tippfehler im Schreibpfad soll
-- auffallen, nicht stillschweigend im Pruefpfad landen.
ALTER TABLE public.siteos_publish_evaluations
  DROP CONSTRAINT IF EXISTS siteos_publish_policy_engine_status_valid;
ALTER TABLE public.siteos_publish_evaluations
  ADD CONSTRAINT siteos_publish_policy_engine_status_valid
  CHECK (policy_engine_status IS NULL OR policy_engine_status IN ('evaluated', 'unavailable'));

ALTER TABLE public.siteos_publish_evaluations
  DROP CONSTRAINT IF EXISTS siteos_publish_policy_decision_valid;
ALTER TABLE public.siteos_publish_evaluations
  ADD CONSTRAINT siteos_publish_policy_decision_valid
  CHECK (policy_decision IS NULL OR policy_decision IN ('allow', 'warn', 'block', 'require_approval', 'log_only'));

-- Ein Ausfall des PDP darf nie als Konformitaet erscheinen (§7 G3).
--
-- Diese Bedingung ist absichtlich in der Datenbank und nicht nur im Code:
-- Der Kern leitet sie bereits ab, aber `siteos_publish_evaluations` ist mit
-- service_role beschreibbar. Waere die Regel nur in TypeScript, koennte ein
-- kuenftiger Schreibpfad sie umgehen, ohne dass es auffiele — dieselbe
-- Ueberlegung, aus der `publishable` eine generierte Spalte ist.
ALTER TABLE public.siteos_publish_evaluations
  DROP CONSTRAINT IF EXISTS siteos_publish_policy_unavailable_blocks;
ALTER TABLE public.siteos_publish_evaluations
  ADD CONSTRAINT siteos_publish_policy_unavailable_blocks
  CHECK (policy_engine_status IS DISTINCT FROM 'unavailable' OR policy_compliant = false);

-- „Welche Veroeffentlichungen hat eine Richtlinie gesperrt?" ist die
-- Prueferfrage zu diesem Gate. Ohne Index ist sie ein Full Scan.
CREATE INDEX IF NOT EXISTS siteos_publish_evaluations_policy_idx
  ON public.siteos_publish_evaluations (tenant_id, policy_decision, evaluated_at DESC)
  WHERE policy_decision IS NOT NULL;

COMMENT ON COLUMN public.siteos_publish_evaluations.policy_engine_status IS
  'Ob der PDP geantwortet hat. NULL = Bewertung stammt aus der Zeit vor P2-3, als keine Mandanten-Richtlinie ausgewertet wurde.';
COMMENT ON COLUMN public.siteos_publish_evaluations.policy_decision IS
  'Entscheidung des PDP. block nimmt policy_compliant, require_approval setzt human_approval_required — beides ueber die Ableitung im Kern, nicht direkt.';

COMMIT;

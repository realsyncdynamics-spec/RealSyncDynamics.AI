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
--   1. Eine Richtlinie des Mandanten hat die Veröffentlichung untersagt
--      (`consulted` + `block`).
--   2. Der PDP war nicht erreichbar, also ist gar nichts festgestellt
--      (`unavailable`).
--
-- Und eine dritte, die gar nicht sperrt und trotzdem festgehalten gehört:
--
--   3. Der PDP wurde befragt, seine Antwort bindet aber nicht
--      (`not_enforcing` — `SITEOS_PUBLISH_PDP` steht auf `shadow` oder `off`).
--      Ohne diese Spalte liesse sich spaeter nicht belegen, ob eine
--      Veroeffentlichung unter Durchsetzung oder unter Beobachtung stattfand.
--      Fuer einen Pruefer ist das der Unterschied zwischen einer Schranke und
--      einem Protokoll.
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
  -- 'consulted' | 'not_enforcing' | 'unavailable'.
  -- NULL = vor P2-3 bewertet, siehe oben.
  ADD COLUMN IF NOT EXISTS policy_engine_status    TEXT,
  -- Entscheidung des PDP. NULL, wenn er nicht geantwortet hat.
  ADD COLUMN IF NOT EXISTS policy_decision         TEXT,
  -- Begruendungen des PDP im Klartext, wie er sie formuliert hat. Leer heisst
  -- „keine Regel hat zugetroffen" — das ist eine Aussage und deshalb nicht
  -- dasselbe wie NULL.
  --
  -- BEWUSST KEINE SPALTE fuer die Fassung des Regelstands: Sie waere fuer die
  -- Nachrechenbarkeit wertvoll, aber `consultPolicyEngine` reicht sie heute
  -- nicht heraus. Eine Spalte, die immer NULL ist, sieht aus wie ein Nachweis
  -- und ist keiner — schlimmer als ihr Fehlen. Sie gehoert nachgezogen, wenn
  -- der PEP die Snapshot-Version mitfuehrt.
  ADD COLUMN IF NOT EXISTS policy_reasons          JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Werte aus geschlossenem Vokabular. Ein Tippfehler im Schreibpfad soll
-- auffallen, nicht stillschweigend im Pruefpfad landen.
ALTER TABLE public.siteos_publish_evaluations
  DROP CONSTRAINT IF EXISTS siteos_publish_policy_engine_status_valid;
ALTER TABLE public.siteos_publish_evaluations
  ADD CONSTRAINT siteos_publish_policy_engine_status_valid
  CHECK (policy_engine_status IS NULL OR policy_engine_status IN ('consulted', 'not_enforcing', 'unavailable'));

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
  'consulted = befragt und bindend; not_enforcing = befragt, aber SITEOS_PUBLISH_PDP steht nicht auf enforce; unavailable = keine Antwort. NULL = Bewertung stammt aus der Zeit vor P2-3.';
COMMENT ON COLUMN public.siteos_publish_evaluations.policy_decision IS
  'Entscheidung des PDP. block nimmt policy_compliant, require_approval setzt human_approval_required — beides ueber die Ableitung im Kern, nicht direkt.';

COMMIT;

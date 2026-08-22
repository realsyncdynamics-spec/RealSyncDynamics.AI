-- Migration: 20260827000000_siteos_draft_revisions.sql
-- SiteOS — Änderungen an einem anonymen Entwurf, nachvollziehbar.
--
-- Additiv. Bestehende Spalten, Policies und Constraints bleiben unberührt;
-- die einzige Änderung an Bestehendem ist eine erweiterte CHECK-Liste und
-- eine neue Spalte mit Default (s. u.).
--
-- ── Warum eine Revisionskette und nicht nur ein Überschreiben ────────────
--
-- Der Entwurf ändert sich, während der Besucher ihn ansieht: „mach den Hero
-- grösser", „entferne die Team-Sektion". Fachlich ist jede dieser Änderungen
-- eine neue Fassung derselben Sache — nicht ein neuer Entwurf.
--
-- Würde nur der Blueprint überschrieben, liesse sich hinterher nicht mehr
-- belegen, wie die übernommene Fassung entstanden ist. Für ein Produkt, das
-- Prüfpfad und Hash-Ketten zusagt, wäre das die falsche Stelle zum Sparen:
-- Genau hier entsteht der Inhalt, für den später jemand geradesteht.
--
-- Die Kette hält deshalb je Fassung fest, welcher Hash gilt und aus welchem
-- er hervorging. Sie ist damit dasselbe Prinzip wie die Versionskette in
-- `siteos_blueprints` — nur eine Stufe früher, vor dem Konto.
--
-- ── Was hier bewusst NICHT gespeichert wird ─────────────────────────────
--
-- Der Anweisungstext des Besuchers steht nirgends, nur sein Hash und die
-- erkannte Operation. Dieselbe Regel gilt bereits für den ursprünglichen
-- Prompt (`prompt_sha256`): Wer kein Konto hat, hat in keine Speicherung
-- seiner Formulierungen eingewilligt (DSGVO Art. 5 Abs. 1 lit. c).
--
-- Die Operation genügt für den Nachweis — „hero.emphasis" sagt, was
-- geschehen ist; der Wortlaut sagt es nicht besser.

-- Der Sicherheits-Gate-Prüfpfad kennt seit der Vorgängermigration fünf
-- Operationen. Die Änderung ist die sechste. Additiv: die bestehenden fünf
-- bleiben unverändert gültig.
ALTER TABLE public.anon_chat_runs DROP CONSTRAINT IF EXISTS anon_chat_runs_op_check;
ALTER TABLE public.anon_chat_runs ADD CONSTRAINT anon_chat_runs_op_check
  CHECK (op = ANY (ARRAY[
    'chat_anon',
    'start_audit_scan',
    'explain_finding',
    'generate_fix_snippet',
    'anon_site_build',
    'anon_site_iterate'
  ]));

-- Aktuelle Fassungsnummer des Entwurfs. 0 ist die erzeugte Erstfassung.
--
-- Dient zugleich als optimistische Sperre: Zwei gleichzeitige Änderungen am
-- selben Entwurf würden sonst beide gewinnen und eine davon spurlos
-- überschreiben. Die Edge Function aktualisiert deshalb nur unter der
-- Bedingung, dass die Nummer noch die erwartete ist.
ALTER TABLE public.siteos_anonymous_drafts
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.siteos_anonymous_drafts
  DROP CONSTRAINT IF EXISTS siteos_anonymous_drafts_revision_nonneg;
ALTER TABLE public.siteos_anonymous_drafts
  ADD CONSTRAINT siteos_anonymous_drafts_revision_nonneg CHECK (revision >= 0);

COMMENT ON COLUMN public.siteos_anonymous_drafts.revision IS
  'Fassungsnummer, 0 = Erstfassung. Zugleich optimistische Sperre gegen gleichzeitige Aenderungen.';

CREATE TABLE IF NOT EXISTS public.siteos_anonymous_draft_revisions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Beim Verfall des Entwurfs verschwindet die Kette mit ihm: Sie belegt
  -- etwas ueber Inhalte, die es dann nicht mehr gibt.
  draft_id            UUID NOT NULL
                      REFERENCES public.siteos_anonymous_drafts(id) ON DELETE CASCADE,

  revision            INTEGER NOT NULL,

  -- Kanonischer Hash der Fassung. Identische Berechnung wie in
  -- siteos_anonymous_drafts und siteos_blueprints.
  content_sha256      CHAR(64) NOT NULL,
  -- Hash der Fassung, aus der diese hervorging. NULL nur bei der Erstfassung.
  prev_sha256         CHAR(64),

  -- Die erkannte Operation, z. B. 'hero.emphasis' oder 'block.remove'.
  -- 'create' fuer die Erstfassung.
  op                  TEXT NOT NULL,
  -- Hash der Anweisung. Der Wortlaut selbst wird nie gespeichert.
  instruction_sha256  CHAR(64),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT siteos_draft_revisions_unique UNIQUE (draft_id, revision),
  CONSTRAINT siteos_draft_revisions_nonneg CHECK (revision >= 0),
  -- Genau die Erstfassung hat keinen Vorgaenger. Jede spaetere hat einen —
  -- eine Kette mit Luecke waere kein Nachweis, sondern eine Behauptung.
  CONSTRAINT siteos_draft_revisions_chain
    CHECK ((revision = 0) = (prev_sha256 IS NULL))
);

COMMENT ON TABLE public.siteos_anonymous_draft_revisions IS
  'Fassungskette eines anonymen Entwurfs. Append-only, Deny-by-default-RLS, ausschliesslich service_role. Haelt Hash und Vorgaenger-Hash je Fassung fest; der Anweisungstext des Besuchers wird bewusst nicht gespeichert (DSGVO Art. 5 Abs. 1 lit. c).';

CREATE INDEX IF NOT EXISTS siteos_draft_revisions_draft_idx
  ON public.siteos_anonymous_draft_revisions (draft_id, revision DESC);

ALTER TABLE public.siteos_anonymous_draft_revisions ENABLE ROW LEVEL SECURITY;

-- Bewusst KEINE Policy — dasselbe Deny-by-default wie bei der Elterntabelle.
-- Ein Entwurf ohne Mandant ist ueber die API nicht auffindbar; seine
-- Fassungskette darf es erst recht nicht sein.

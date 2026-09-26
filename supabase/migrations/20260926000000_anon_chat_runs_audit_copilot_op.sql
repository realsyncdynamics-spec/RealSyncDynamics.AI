-- anon_chat_runs: neue Operation 'audit_copilot_anon' für den öffentlichen
-- Audit-Co-Piloten (/audit, ohne Login) im ai-gateway (mode 'audit_anon').
--
-- Warum eine eigene Operation statt 'explain_finding': die bestehenden
-- Audit-Werkzeuge des governance-agent liefern Mock-Antworten ohne LLM.
-- Der neue Pfad ruft ein Modell auf (model/input_tokens/output_tokens
-- gesetzt). Beides unter einem Wert zu führen, verfälscht Kosten- und
-- Missbrauchsauswertung.
--
-- Reihenfolge: Diese Migration MUSS vor dem ai-gateway-Deploy laufen.
-- Ohne sie scheitert der Reserve-Insert am CHECK und der anonyme Pfad
-- antwortet fail-closed mit 503 LOG_UNAVAILABLE (kein offener Pfad).
--
-- Liste = 20260822180000 + 'audit_copilot_anon'; synchron mit AnonOp in
-- supabase/functions/_shared/anonAudit.ts.

BEGIN;

ALTER TABLE public.anon_chat_runs
  DROP CONSTRAINT IF EXISTS anon_chat_runs_op_check;
ALTER TABLE public.anon_chat_runs
  ADD CONSTRAINT anon_chat_runs_op_check
  CHECK (op IN (
    'chat_anon',
    'start_audit_scan',
    'explain_finding',
    'generate_fix_snippet',
    'siteos_build_anon',
    'siteos_refine_anon',
    -- Neu: öffentlicher Audit-Co-Pilot über ai-gateway (mode 'audit_anon').
    'audit_copilot_anon'
  ));

COMMIT;

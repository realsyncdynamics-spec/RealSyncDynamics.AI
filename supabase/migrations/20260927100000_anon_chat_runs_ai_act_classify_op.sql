-- anon_chat_runs: neue Operation 'ai_act_classify_anon' für den öffentlichen
-- AI-Act-Klassifikator (/ai-act-klassifikator, ohne Login) in der
-- Edge-Function `ai-act-classify`.
--
-- Warum diese Migration nötig ist — gemessen am 2026-09-27 gegen die
-- deployte Function:
--
--   * 11 Aufrufe ohne jedes Token (verify_jwt = false) -> 11× HTTP 200, also
--     11 bezahlte Provider-Calls auf Betreiber-Keys.
--   * In `anon_chat_runs` und `ai_tool_runs` danach: 0 Zeilen. Der einzige
--     Nachweis der 11 Calls sind die Plattform-Logs, die keine Kosten,
--     kein Modell und keine Tokens führen.
--   * Das dokumentierte Limit (4/Minute je IP-Hash, FEATURE_LIMITS in
--     _shared/aiGateway/rateLimit.ts) hat NICHT EINMAL gegriffen: die 11
--     Anfragen landeten in 11 verschiedenen Ausführungskontexten, und der
--     Zähler liegt im Arbeitsspeicher des Isolate. Er kann per Konstruktion
--     nicht greifen.
--
-- Damit war `ai-act-classify` die einzige anonyme LLM-Fläche ohne das
-- Verfahren, das governance-agent, siteos und ai-gateway längst benutzen:
-- Reserve-Insert vor der Arbeit (fail-closed) plus ein Kontingent, das in
-- der Datenbank steht und deshalb Kaltstarts und Isolate überlebt.
--
-- Reihenfolge: Diese Migration MUSS vor dem ai-act-classify-Deploy laufen.
-- Ohne sie scheitert der Reserve-Insert am CHECK und der anonyme Pfad
-- antwortet fail-closed mit 503 — kein offener Pfad. Das Frontend fällt
-- in diesem Fall auf `extractSignalsLocal()` zurück (deterministisch,
-- ohne Provider), das Werkzeug bleibt also benutzbar.
--
-- Liste = 20260926000000 + 'ai_act_classify_anon'; synchron mit AnonOp in
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
    'audit_copilot_anon',
    -- Neu: öffentlicher AI-Act-Klassifikator (ai-act-classify).
    'ai_act_classify_anon'
  ));

-- Das Kontingent liest (op, ip_hash, occurred_at). Der bestehende Index
-- anon_chat_runs_ip_time_idx (ip_hash, occurred_at) trägt die Abfrage schon,
-- lässt `op` aber als Restfilter übrig. Da die Zählung auf dem heißen Pfad
-- JEDES anonymen Aufrufs liegt, bekommt sie einen passenden Index.
CREATE INDEX IF NOT EXISTS anon_chat_runs_op_ip_time_idx
  ON public.anon_chat_runs (op, ip_hash, occurred_at DESC);

COMMIT;

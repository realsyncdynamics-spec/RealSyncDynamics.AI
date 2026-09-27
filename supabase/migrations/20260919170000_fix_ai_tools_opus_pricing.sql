-- Phase 1 (Economics Engine) — Korrektur falscher Modellpreise in ai_tools.
--
-- ai_tools.cost_input_per_million_usd / cost_output_per_million_usd sind ECHTE
-- Providerkosten, keine Verkaufspreise. _shared/ai.ts rechnet daraus:
--
--   costUsd  → ai_tool_runs.cost_usd
--            → recordUsage('limit.ai_cost_monthly_cents')
--            → unitPriceUsd im tenant_cost_ledger
--
-- Ein falscher Wert verfaelscht damit Kostenrechnung, Quota-Verbrauch und
-- Ledger gleichzeitig.
--
-- Ist-Zustand in Produktion (geprueft 2026-09-15):
--
--   key                  model_id              in    out
--   bot_reply            claude-sonnet-4-6     3.00  15.00   korrekt
--   code_explain         claude-sonnet-4-6     3.00  15.00   korrekt
--   log_analyze          claude-sonnet-4-6     3.00  15.00   korrekt
--   vps_action_advisor   claude-sonnet-4-6     3.00  15.00   korrekt
--   vps_status           claude-opus-4-7      15.00  75.00   FALSCH — 3x zu hoch
--
-- Claude Opus 4.7 kostet $5.00 / $25.00 je 1M Tokens, nicht $15.00 / $75.00.
-- Jeder vps_status-Aufruf wurde intern mit dem Dreifachen seiner tatsaechlichen
-- Providerkosten verbucht.
--
-- Nicht-destruktiv: aendert ausschliesslich zwei numerische Spalten der Zeilen,
-- die den falschen Wert tragen. Bereits korrigierte Zeilen bleiben unberuehrt
-- (idempotent). Keine Schemaaenderung, keine Loeschung.
--
-- Kein Rueckstand zu korrigieren
-- ------------------------------
-- Diese Migration wirkt nur vorwaerts. Bereits gebuchte Werte in
-- ai_tool_runs.cost_usd, in gesettelten tenant_cost_ledger-Zeilen und in den
-- append-only Usage-Events auf limit.ai_cost_monthly_cents koennte ein UPDATE
-- auf ai_tools nicht rueckrechnen.
--
-- Das ist hier folgenlos, weil es keine solchen Zeilen gibt. Geprueft gegen
-- Produktion am 2026-09-19:
--
--   ai_tool_runs gesamt ............................. 1
--   davon vps_status ................................ 0
--   aufgelaufene vps_status-Kosten .................. $0
--   tenant_cost_ledger-Zeilen mit Opus-model_ref .... 0
--   usage_events auf limit.ai_cost_monthly_cents .... 0
--
-- vps_status wurde seit Anlage des Tools nie ausgefuehrt. Ein Backfill haette
-- keine Zeile zu treffen, und ein Korrektur-INSERT in den append-only Ledger
-- wuerde eine Bewegung erfinden, die es nie gab. Genau deshalb ist jetzt der
-- richtige Zeitpunkt: die Migration schliesst das Fenster, BEVOR die erste
-- fehlerhafte Buchung entsteht.

UPDATE public.ai_tools
   SET cost_input_per_million_usd  = 5.00,
       cost_output_per_million_usd = 25.00,
       updated_at                  = now()
 WHERE model_provider = 'anthropic'
   AND model_id       = 'claude-opus-4-7'
   AND (cost_input_per_million_usd  IS DISTINCT FROM 5.00
     OR cost_output_per_million_usd IS DISTINCT FROM 25.00);

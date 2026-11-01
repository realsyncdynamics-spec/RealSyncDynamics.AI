-- ============================================================================
-- Enterprise: endliche Kontingente für den Self-Service-Checkout.
--
-- Dominik 2026-10-24: Enterprise wird zu 1.498 € / Monat direkt über Checkout
-- verkauft, ohne Testphase. Bis dahin war Enterprise ein Vertragsplan
-- (`availability: 'contract'`) und trug auf allen `limit.*`-Keys `-1` —
-- „das System begrenzt hier nicht, der Vertrag tut es". Ein Checkout-Kauf hat
-- keinen Vertrag; ohne diese Migration bekäme er unbegrenzte KI-Kosten,
-- Tokens, Bot-Nachrichten und Voice-Minuten.
--
-- Werte (Freigabe Dominik 2026-10-24):
--   * Wo die Preisseite eine Zahl nennt, gilt sie (Sites/Domains 25, Seats 50,
--     Bots 20, 50.000 Antworten, 2.000 Automationen, 250.000 API-Calls,
--     200 Exporte, 500 Bulk-Jobs).
--   * Der Rest ist das 2,5-Fache von Agency, u. a. KI-Kosten 250 € / Monat.
--   * `limit.llm_queries_monthly` und `limit.agent_runs_monthly` bleiben `-1`
--     wie bei Agency; die KI-Kosten deckelt `limit.ai_cost_monthly_cents`.
--
-- Bestandsschutz: Gemessen am 2026-10-24 gegen `ebljyceifhnlzhjfyxup` —
-- null Abos auf `enterprise` oder `enterprise_yearly`. Die Kürzung trifft
-- niemanden. `public.subscriptions` wird nicht angefasst.
--
-- Additiv: Es werden weder Zeilen noch Spalten noch Policies entfernt, nur
-- Werte in `product_entitlements` gesetzt. Idempotent über
-- `IS DISTINCT FROM`. `enterprise_yearly` ist mit drin, falls die Zeile
-- existiert (gemessen: nein) — gleicher Plan, gleiche Kontingente.
-- ============================================================================

WITH soll(ent_key, wert) AS (VALUES
    ('limit.ai_calls_monthly',                 25000),
    ('limit.ai_cost_monthly_cents',            25000),
    ('limit.ai_tokens_monthly',             25000000),
    ('limit.api_calls_monthly',               250000),
    ('limit.automation_runs_monthly',           2000),
    ('limit.bot_messages_monthly',             50000),
    ('limit.bot_voice_minutes_monthly',         1250),
    ('limit.bots',                                20),
    ('limit.bulk_jobs_monthly',                  500),
    ('limit.compliance_exports_monthly',         200),
    ('limit.domains',                             25),
    ('limit.sites',                               25),
    ('limit.team_seats',                          50),
    ('limit.whatsapp_conversations_monthly',    6250),
    ('limit.workflow_runs_monthly',             2500)
)
UPDATE public.product_entitlements pe
   SET value = s.wert
  FROM soll s
  JOIN public.entitlements e ON e.key = s.ent_key
  JOIN public.products p     ON p.default_for_plan_key IN ('enterprise', 'enterprise_yearly')
 WHERE pe.product_id = p.id
   AND pe.entitlement_id = e.id
   AND pe.value IS DISTINCT FROM s.wert;

-- Nachweis: Alle 15 Paare der Monatsvariante existieren UND tragen den
-- Sollwert. Nur auf den Wert zu prüfen wäre blind — fehlte eine Zeile,
-- zählte die Prüfung null Abweichungen und liefe still durch.
DO $$
DECLARE
  vorhanden  integer;
  abweichend integer;
BEGIN
  WITH soll(ent_key, wert) AS (VALUES
      ('limit.ai_calls_monthly',                 25000),
      ('limit.ai_cost_monthly_cents',            25000),
      ('limit.ai_tokens_monthly',             25000000),
      ('limit.api_calls_monthly',               250000),
      ('limit.automation_runs_monthly',           2000),
      ('limit.bot_messages_monthly',             50000),
      ('limit.bot_voice_minutes_monthly',         1250),
      ('limit.bots',                                20),
      ('limit.bulk_jobs_monthly',                  500),
      ('limit.compliance_exports_monthly',         200),
      ('limit.domains',                             25),
      ('limit.sites',                               25),
      ('limit.team_seats',                          50),
      ('limit.whatsapp_conversations_monthly',    6250),
      ('limit.workflow_runs_monthly',             2500)
  )
  SELECT count(*), count(*) FILTER (WHERE pe.value IS DISTINCT FROM s.wert)
    INTO vorhanden, abweichend
    FROM soll s
    JOIN public.entitlements e         ON e.key = s.ent_key
    JOIN public.products p             ON p.default_for_plan_key = 'enterprise'
    JOIN public.product_entitlements pe ON pe.product_id = p.id AND pe.entitlement_id = e.id;

  IF vorhanden <> 15 OR abweichend <> 0 THEN
    RAISE EXCEPTION 'Enterprise-Kontingente: % von 15 Paaren vorhanden, % abweichend',
      vorhanden, abweichend;
  END IF;
  RAISE NOTICE 'Enterprise-Kontingente gesetzt: 15 von 15 Paaren auf Sollwert.';
END $$;

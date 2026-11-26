-- Vorabprüfung für 20261125190000_bot_appointments_writer_policy_dedupe.sql
-- Nur lesend. Muss vor dem Einspielen 0 Zeilen liefern, sonst bricht der
-- Aufbau von bot_appointments_open_conversation_uniq ab (die Migration
-- löscht keine Daten). Gefundene Duplikate fachlich klären, nicht
-- automatisch entfernen.

SELECT tenant_id,
       bot_id,
       conversation_id,
       customer_name,
       requested_at,
       count(*)                AS anzahl,
       array_agg(id ORDER BY created_at) AS ids
  FROM public.bot_appointments
 WHERE status = 'requested'
   AND conversation_id IS NOT NULL
 GROUP BY tenant_id, bot_id, conversation_id, customer_name, requested_at
HAVING count(*) > 1;

-- agent-os-runner: das fehlende Bearer-Token im Vault erzeugen
--
-- BEFUND (gemessen gegen die Live-DB am 2026-09-01)
-- `agent-os-runner-hourly` und `-daily` sind seit ihrer Registrierung am
-- 2026-05-29 **2.365 Mal gelaufen und 2.365 Mal gescheitert** — kein einziger
-- Erfolg in drei Monaten. Beide Seiten melden dieselbe Ursache:
--
--   cron.job_run_details : Vault-Secret "agent_os_runner_token" fehlt
--   POST /agent-os-runner: {"code":"NOT_CONFIGURED","detail":"vault token missing: empty"}
--
-- Damit laeuft der Deadline-Sentinel nicht: ueberfaellige 72-h-Meldefristen,
-- faellige DPIA-Reviews und DSR-Fristen werden nicht in `governance_alerts`
-- sichtbar. Heute ohne Schaden — `incidents` und `dpias` sind leer —, aber
-- der Ausfall wartet auf den ersten Kunden, der etwas anlegt. Fuer ein
-- Produkt, das Fristenueberwachung zusagt, ist das ein Compliance-Befund.
--
-- WARUM DAS HIER GEHT UND BEIM SERVICE-ROLE-KEY NICHT
-- Migration 20260820000000 hat den Ausfall gefunden und **beide** fehlenden
-- Secrets an den Betreiber verwiesen. Fuer `service_role_key` ist das
-- richtig: Dort ist der Wert vorgegeben — die Empfaenger vergleichen gegen
-- `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, das Geheimnis kommt von
-- aussen und gehoert nicht in die Git-History.
--
-- Bei `agent_os_runner_token` ist es anders, und das wurde damals uebersehen:
-- Sender und Empfaenger lesen **dieselbe Vault-Zeile**. `dispatch_cron_function`
-- holt sie ueber `get_app_secret`, und `agent-os-runner/index.ts` tut in
-- Zeile 54 exakt dasselbe. Es gibt keinen vorgegebenen Wert, gegen den
-- verglichen wird — es gibt nur die Forderung, dass beide Seiten denselben
-- sehen. Ein hier erzeugter Zufallswert erfuellt sie vollstaendig.
--
-- Der Wert entsteht beim Anwenden, nicht beim Schreiben: In Git steht der
-- Ausdruck, nie das Ergebnis. Jede Umgebung bekommt ihr eigenes Token —
-- genau die Trennung, die ein geteiltes Literal nicht haette.
--
-- Kein `cron.schedule` noetig: Beide Jobs sind registriert und aktiv und
-- greifen ab dem naechsten Tick von selbst.

BEGIN;

DO $$
BEGIN
  -- Nur anlegen, wenn nichts da ist. Ein bestehendes Token zu ueberschreiben
  -- wuerde eine funktionierende Umgebung beim naechsten `db push` stillegen —
  -- und der Empfaenger merkte es nicht, weil er dieselbe Zeile liest.
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'agent_os_runner_token') THEN
    RAISE NOTICE 'agent_os_runner_token existiert bereits — unveraendert gelassen.';
  ELSE
    PERFORM vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'agent_os_runner_token',
      'Bearer-Token zwischen pg_cron (dispatch_cron_function) und der Edge Function agent-os-runner. Beide Seiten lesen diese Zeile via get_app_secret; der Wert ist frei und entsteht beim Anwenden der Migration.'
    );
  END IF;
END
$$;

COMMIT;

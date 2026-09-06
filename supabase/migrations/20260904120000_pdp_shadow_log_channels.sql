-- Shadow-Protokoll: Quellen um Publish- und Bot-Kanäle erweitern (P2-3, P2-5).
--
-- ## Der Befund, der diese Migration ausgelöst hat
--
-- `pdp_shadow_log.source` liess bis hier nur die drei Alt-Pfade zu
-- (`telemetry-ai-event`, `governance-ingest`, `ai-gateway`). Der Publish Gate
-- aus P2-3 schreibt im Beobachtungsbetrieb aber unter `siteos_publish` — die
-- Zeile waere von der CHECK-Bedingung abgewiesen worden.
--
-- Aufgefallen ist das nicht durch einen Fehler, sondern beim Lesen: Der
-- Aufruf lag hinter `.catch(() => {})`. Der Beobachtungsbetrieb haette also
-- geschwiegen statt zu protokollieren — und weil `shadow` der VORGABEWERT
-- ist, waere genau der Normalfall folgenlos geblieben. Ein Shadow-Modus, der
-- nichts sammelt, ist keine Vorstufe zur Durchsetzung, sondern ein
-- Ausschalter mit gutem Namen.
--
-- ## Warum die Bot-Kanäle gleich mit hinein
--
-- P2-5 haengt `bot-chat`, `whatsapp-webhook` und `bot-voice-webhook` an
-- denselben PEP, ebenfalls mit `shadow` als Vorgabe. Sie einzeln nachzureichen
-- hiesse, denselben stillen Ausfall dreimal zu wiederholen.
--
-- ## Additiv
--
-- Die CHECK-Bedingung wird nur ERWEITERT. Bestehende Zeilen bleiben gueltig,
-- kein bisher zulaessiger Wert faellt weg.

BEGIN;

ALTER TABLE public.pdp_shadow_log
  DROP CONSTRAINT IF EXISTS pdp_shadow_log_source_check;

ALTER TABLE public.pdp_shadow_log
  ADD CONSTRAINT pdp_shadow_log_source_check
  CHECK (source IN (
    -- Alt-Pfade (P0)
    'telemetry-ai-event',
    'governance-ingest',
    'ai-gateway',
    -- Publish Gate (P2-3)
    'siteos_publish',
    -- Bot-Kanäle (P2-5) — ein PEP, drei Kanäle. Getrennt gefuehrt, weil die
    -- Frage „wo weicht v2 ab?" je Kanal beantwortet werden muss: Ein
    -- Sprachkanal traegt andere Signale als ein Web-Chat.
    'bot-chat',
    'bot-whatsapp',
    'bot-voice'
  ));

COMMENT ON COLUMN public.pdp_shadow_log.source IS
  'Kanal, der den Vergleich geschrieben hat. Erweiterbar — aber nur additiv: Ein entfernter Wert macht historische Zeilen ungueltig.';

COMMIT;

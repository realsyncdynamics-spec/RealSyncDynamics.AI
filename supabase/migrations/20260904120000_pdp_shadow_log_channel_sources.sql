-- P2-5 — Der Shadow-Vergleich muss die neuen Enforcement-Punkte annehmen.
--
-- ## Warum diese Migration nötig ist — ein Befund, kein Ausbau
--
-- `pdp_shadow_log.source` trug eine CHECK-Liste mit genau drei Werten aus
-- P0-5 (`telemetry-ai-event`, `governance-ingest`, `ai-gateway`). Seither
-- sind Enforcement-Punkte dazugekommen, die denselben Beobachtungsbetrieb
-- führen: der SiteOS Publish Gate (P2-3), der Agent-PEP (P1-5) und mit
-- P2-5 die drei Bot-Kanäle.
--
-- Ein Schreibversuch mit einem nicht gelisteten `source` schlägt an der
-- CHECK-Bedingung fehl. `logShadowComparison()` schluckt Fehler bewusst —
-- der Beobachtungsbetrieb darf den Alt-Pfad unter keinen Umständen
-- beeinflussen. Beides zusammen ergibt genau die Fehlerklasse K1 des
-- Enforcement-Plans: Das System **sieht aus**, als würde es mitschreiben,
-- und schreibt nichts mit. Wer später fragt „wie oft hätte der PDP
-- gesperrt, bevor wir auf enforce gestellt haben?", bekommt eine leere
-- Tabelle und hält sie für ein gutes Zeichen.
--
-- ## Warum eine Liste und keine freie Textspalte
--
-- Die Liste ist der Grund, warum die Spalte auswertbar ist. Ein Tippfehler
-- im PEP („bot_whatapp") würde sonst eine eigene Quelle erfinden, und die
-- Divergenzauswertung eines Kanals wäre still unvollständig. Der Preis ist
-- diese Migration bei jedem neuen PEP — das ist beabsichtigt.
--
-- Additiv: Die Spalte, ihre Daten, die RLS-Policy und der Index bleiben
-- unverändert. Erweitert wird ausschließlich die Menge erlaubter Werte.
-- DSGVO: Es ändert sich nichts an dem, was gespeichert wird — der
-- Vergleich trägt Verdikte und Policy-IDs, keine Inhalte.

ALTER TABLE public.pdp_shadow_log
  DROP CONSTRAINT IF EXISTS pdp_shadow_log_source_check;

ALTER TABLE public.pdp_shadow_log
  ADD CONSTRAINT pdp_shadow_log_source_check
  CHECK (source IN (
    -- P0-5: die drei Alt-Pfade
    'telemetry-ai-event',
    'governance-ingest',
    'ai-gateway',
    -- P1-5: Agent-Runtime (Tool-Aufrufe)
    'agent_runtime',
    -- P2-3: SiteOS Publish Gate
    'siteos_publish',
    -- P2-4: CI/CD-Gate des platform/-Stacks
    'cicd_gate',
    -- P2-5: die drei Bot-Kanäle. Getrennt geführt, nicht als ein
    -- „bot"-Sammelwert: Ob eine Richtlinie im Telefonkanal anders
    -- greift als im Web-Chat, ist genau die Frage, die der
    -- Beobachtungsbetrieb beantworten soll.
    'bot_chat',
    'bot_whatsapp',
    'bot_voice'
  ));

COMMENT ON COLUMN public.pdp_shadow_log.source IS
  'Enforcement-Punkt, der den Vergleich geschrieben hat. Erweiterung nur per Migration — '
  'ein freier Text würde Tippfehler zu eigenen Quellen machen und die Divergenzauswertung '
  'still unvollständig lassen (P2-5).';

-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02), Option A.
-- 1:1 aus supabase_migrations.schema_migrations, Version 20260628121603.
-- Gehoert zu Bots-Feature A (bots / bot_appointments / bot_orders) — dem
-- Feature, auf das der gesamte Anwendungscode zielt.
--
-- Hinweis: 20260628193820 (Feature B) fuegt denselben ai_tools-Key 'bot_reply'
-- mit abweichender Definition ein, allerdings mit `where not exists`. Da diese
-- Migration hier zuerst laeuft, gewinnt A's Definition; B's Variante ist ein
-- No-op. Siehe docs/runtime/PRODUCTION_BLOCKERS.md, Blocker 2.

-- Bots — AI-Tool bot_reply.
INSERT INTO public.ai_tools
    (key, name, description, model_provider, model_id, system_prompt,
     max_tokens, temperature, cost_input_per_million_usd, cost_output_per_million_usd,
     required_entitlement_key)
VALUES
    ('bot_reply',
     'Bot-Antwort',
     'Generiert die Antwort eines Konversations-Bots auf eine Nutzernachricht.',
     'anthropic', 'claude-sonnet-4-6',
     'Du bist ein hilfreicher, freundlicher Kundenservice-Assistent für ein Unternehmen. '
     || 'Antworte knapp, höflich und auf Deutsch (außer der Nutzer schreibt in einer anderen Sprache). '
     || 'Beantworte nur Fragen im Rahmen des Unternehmens. Wenn du etwas nicht weißt, sage das ehrlich '
     || 'und biete an, einen Menschen einzuschalten. Erfinde keine Preise, Termine oder Zusagen.',
     1024, 0.5, 3.00, 15.00,
     'ai.tool.bot_reply')
ON CONFLICT (key) DO NOTHING;

COMMENT ON COLUMN public.ai_tools.system_prompt IS
    'Basis-System-Prompt. Tools wie bot_reply ergänzen ihn zur Laufzeit (z.B. um die Bot-Persona).';

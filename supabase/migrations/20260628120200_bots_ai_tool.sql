-- Bots — AI-Tool `bot_reply`.
--
-- Registriert das AI-Tool, das die Edge Function `bot-chat` über den
-- gemeinsamen runAiTool()-Pfad aufruft. Das Boolean-Entitlement
-- `ai.tool.bot_reply` wird in 20260628120100 an Growth+ gebunden;
-- runAiTool() prüft es vor jedem Aufruf.
--
-- Der eigentliche System-Prompt setzt sich zur Laufzeit zusammen aus
-- diesem Basis-Prompt + der Bot-Persona (bots.persona) — siehe bot-chat.

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

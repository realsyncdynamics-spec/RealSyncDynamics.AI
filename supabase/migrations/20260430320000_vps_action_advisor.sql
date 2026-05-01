-- AI advisor for write VPS actions.
--
-- A new AI tool dedicated to assessing the impact / risk of a planned write
-- action (service.restart, compose.up, compose.restart) before the user
-- types the confirmation token.

-- 1. Entitlement key for the new tool
INSERT INTO public.entitlements (key, description, kind) VALUES
    ('ai.tool.vps_action_advisor', 'AI: Risiko-Bewertung für VPS-Schreib-Aktionen', 'boolean')
ON CONFLICT (key) DO NOTHING;

-- 2. Plan bindings — mirror who already has write actions via Kodee
WITH plan_def(plan_key, ent_key, val) AS (VALUES
    ('silver',            'ai.tool.vps_action_advisor', 1),
    ('gold',              'ai.tool.vps_action_advisor', 1),
    ('enterprise_public', 'ai.tool.vps_action_advisor', 1)
)
INSERT INTO public.product_entitlements (product_id, entitlement_id, value)
SELECT p.id, e.id, pd.val
FROM plan_def pd
JOIN public.products p     ON p.default_for_plan_key = pd.plan_key
JOIN public.entitlements e ON e.key = pd.ent_key
ON CONFLICT (product_id, entitlement_id) DO NOTHING;

-- 3. Register the tool itself
INSERT INTO public.ai_tools
    (key, name, description, model_provider, model_id, system_prompt,
     max_tokens, temperature, cost_input_per_million_usd, cost_output_per_million_usd)
VALUES
    ('vps_action_advisor',
     'VPS-Aktion bewerten',
     'Bewertet die Auswirkungen einer geplanten Schreib-Aktion (Restart, Compose-Up, …) und schlägt sicherere Alternativen vor.',
     'anthropic', 'claude-sonnet-4-6',
     'Du bist ein erfahrener Site-Reliability-Ingenieur. Dir wird eine geplante VPS-Schreib-Aktion plus Kontext über das Zielsystem übergeben. Antworte knapp auf Deutsch in Markdown mit folgender Struktur: ' ||
     '**Risiko**: low | medium | high (Begründung in einem Satz). ' ||
     '**Was passiert**: 1-3 Bullet-Points. ' ||
     '**Vorbedingungen**: was sollte vorher geprüft / gesichert werden. ' ||
     '**Sicherere Alternativen**: 0-2 Optionen mit konkreten Befehlen. ' ||
     'Wenn die Aktion klar harmlos ist, sag das in einem Satz und höre auf.',
     900, 0.3, 3.00, 15.00)
ON CONFLICT (key) DO NOTHING;

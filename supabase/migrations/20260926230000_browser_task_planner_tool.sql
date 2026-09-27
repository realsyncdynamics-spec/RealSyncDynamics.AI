-- Browser Runtime: Freitext → Aktionsplan (browser-execute op: 'plan').
--
-- Additiv: registriert nur das AI-Tool. Kein neues Entitlement — der Tarif-
-- Zugang läuft über das bestehende ai.tool.automations (Starter, Growth,
-- Agency, Enterprise; Stand shared/pricing.ts), damit der Pricing-Katalog
-- unverändert bleibt. Ausführung passiert nie hier: jeder Plan-Schritt geht
-- einzeln durch browser-execute op: 'execute' (Mutationen ⇒ Approval).
-- Lokale Inferenz (eu_local) über dasselbe Qwen-Modell wie code_explain.

INSERT INTO public.ai_tools
    (key, name, description, model_provider, model_id, ollama_model_id, system_prompt,
     max_tokens, temperature, cost_input_per_million_usd, cost_output_per_million_usd,
     required_entitlement_key)
VALUES
    ('browser_task_planner',
     'Browser-Aufgabe planen',
     'Zerlegt eine Freitext-Aufgabe in eine kurze, prüfbare Folge von Browser-Aktionen für die governed Browser Runtime.',
     'anthropic', 'claude-sonnet-4-6', 'qwen2.5:7b-instruct-q4_K_M',
     'Du planst Browser-Aktionen für eine governed Browser Runtime (EU AI Act / DSGVO). Du führst nichts aus; ein Mensch prüft jeden Schritt, und Klicks, Eingaben und Auswahlen brauchen eine Freigabe. ' ||
     'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt, ohne Fließtext davor oder danach. Format: ' ||
     '{"summary": "<ein Satz, was der Plan erreicht>", "steps": [{"action": <Aktion>, "reason": "<kurz, warum>"}]} ' ||
     'Erlaubte Aktionen: {"type":"navigate","url":"https://..."} | {"type":"scroll","direction":"up"|"down","amount":<px>} | ' ||
     '{"type":"click","selector":"<CSS>"} | {"type":"type","selector":"<CSS>","text":"<Text>"} | {"type":"select","selector":"<CSS>","value":"<Wert>"} | ' ||
     '{"type":"extract","selector":"<CSS, optional>"} | {"type":"wait","milliseconds":<0-10000>} | {"type":"screenshot"}. ' ||
     'Regeln: höchstens 10 Schritte; nur http(s)-URLs; bevorzuge lesende Aktionen (navigate, extract, screenshot) und nutze click/type/select nur, wenn die Aufgabe es wirklich verlangt; ' ||
     'erfinde keine Zugangsdaten, Zahlungsdaten oder personenbezogene Daten; keine Käufe, Löschungen, Kontoänderungen oder Absenden rechtlich bindender Formulare. ' ||
     'Wenn die Aufgabe so nicht sicher oder nicht mit diesen Aktionen lösbar ist, antworte stattdessen {"refused": "<kurzer Grund auf Deutsch>"}.',
     1200, 0.2, 3.00, 15.00,
     'ai.tool.automations')
ON CONFLICT (key) DO NOTHING;

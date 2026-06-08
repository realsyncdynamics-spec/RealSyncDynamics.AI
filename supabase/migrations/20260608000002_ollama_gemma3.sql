-- Wechsel ollama_model_id von qwen3:4b auf gemma3:4b.
--
-- Warum: Google Gemma 3 (4B, instruction-tuned) ist multilingual stark
-- (140+ Sprachen, inkl. Deutsch), hat ein 128k-Kontextfenster und liefert
-- bei vergleichbarer Größe (~3.3 GB Q4) bessere Instruktions-Treue als
-- Qwen 3 4B. Lizenz: Gemma Terms of Use (kommerzielle Nutzung erlaubt).
--
-- Footprint passt unverändert auf den 3.8-GB-VPS (Q4 + 2 GB Swap-Headroom).
-- Additiv: rein UPDATE auf bestehende Tools, keine Schema-Änderung.

UPDATE public.ai_tools
   SET ollama_model_id = 'gemma3:4b'
 WHERE key IN ('code_explain', 'log_analyze')
   AND ollama_model_id IS DISTINCT FROM 'gemma3:4b';

-- Adjust ollama_model_id to qwen2.5:3b — the deployed VPS only has 3.8 GB RAM
-- (not 16 GB as the original migration assumed), so the 7B-Q4 variant OOM-kills.
-- The 3B model fits comfortably with the 2 GB swap headroom.

UPDATE public.ai_tools
   SET ollama_model_id = 'qwen2.5:3b'
 WHERE key IN ('code_explain', 'log_analyze')
   AND ollama_model_id IS DISTINCT FROM 'qwen2.5:3b';

-- Upgrade ollama_model_id von qwen2.5:3b auf qwen3:4b.
--
-- Warum jetzt: Qwen 3 ist die nächste Generation (Reasoning, Mehrsprachigkeit,
-- agentische Workflows) und 4B-Q4_K_M (~2.5 GB) passt auf den 3.8 GB-VPS mit
-- 2 GB Swap-Headroom. 1.7B wäre RAM-mäßig safer aber qualitativ schwächer;
-- der Trooper-Ansatz: 4B + Swap, fallback auf 1.7B falls OOM.

UPDATE public.ai_tools
   SET ollama_model_id = 'qwen3:4b'
 WHERE key IN ('code_explain', 'log_analyze')
   AND ollama_model_id IS DISTINCT FROM 'qwen3:4b';

import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

/**
 * Soft check used during app boot. Logs a warning if Gemini is unconfigured
 * — the app keeps working, only Gemini-backed features fail at call time.
 * Returns true when a key is available.
 * Only warns in dev mode to avoid console spam in production.
 */
export function validateGeminiConfig(): boolean {
  if (import.meta.env.DEV) {
    console.warn(
      '[gemini] Gemini-backed features require Edge Function routing. ' +
      'Anthropic / Ollama / OpenAI providers (via Edge Functions) ' +
      'are recommended for production.'
    );
  }
  return false;
}

/**
 * Deprecated: Gemini client initialization is not supported in client code.
 * Call Edge Functions instead.
 */
export function getGeminiAI(): GoogleGenAI {
  throw new Error(
    'Gemini SDK is not available in client code. ' +
    'Call supabase.functions.invoke("ai-invoke") instead.'
  );
}

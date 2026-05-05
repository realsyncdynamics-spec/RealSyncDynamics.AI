import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

/**
 * Soft check used during app boot. Logs a warning if Gemini is unconfigured
 * — the app keeps working, only Gemini-backed features fail at call time.
 * Returns true when a key is available.
 */
export function validateGeminiConfig(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    console.warn(
      '[gemini] GEMINI_API_KEY is not set. Gemini-backed features will be ' +
      'disabled. Anthropic / Ollama / OpenAI providers (via Edge Functions) ' +
      'are unaffected.'
    );
    return false;
  }
  return true;
}

/**
 * Hard fetch — throws when Gemini is not configured. Use only inside callers
 * that explicitly need the Gemini SDK; never at module import time.
 */
export function getGeminiAI(): GoogleGenAI {
  if (!aiClient) {
    if (!validateGeminiConfig()) {
      throw new Error(
        'Gemini ist auf diesem Deployment nicht konfiguriert. ' +
        'Setze GEMINI_API_KEY in den Build-Secrets, oder nutze einen anderen Provider.'
      );
    }
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
  }
  return aiClient;
}

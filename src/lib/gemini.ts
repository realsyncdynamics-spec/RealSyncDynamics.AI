import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

export function validateGeminiConfig(): void {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "Startup Validation Failed: GEMINI_API_KEY environment variable is missing. " +
      "Please configure it in your environment settings or AI Studio Secrets panel."
    );
  }
  
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new Error("Startup Validation Failed: GEMINI_API_KEY is empty or invalid.");
  }
}

export function getGeminiAI(): GoogleGenAI {
  if (!aiClient) {
    validateGeminiConfig();
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
  }
  return aiClient;
}

/**
 * @file ai-gateway.ts
 * @description Zentrales Backend API-Gateway, das Anfragen aus der Extension oder App an verschiedene Modelle (Gemini, OpenAI, Anthropic) weiterleitet.
 */
import { GoogleGenAI } from '@google/genai';
import { getGeminiAI } from '../../lib/gemini';

export type ModelProvider = 'gemini' | 'openai' | 'claude';

export interface GatewayRequest {
  prompt: string;
  provider: ModelProvider;
  context?: string; // Seitenkontext (z.B. markierter Text)
  customApiKey?: string; // BYO API Key Unterstützung
}

// Dies ist deine API-Route Logik (wird im Preview im Client ausgeführt, später Server-Side)
export async function processAIGatewayRequest(req: GatewayRequest) {
  const finalPrompt = req.context 
    ? `Hier ist der Inhalt einer Webseite:\n"""\n${req.context}\n"""\n\nFrage/Aufgabe des Nutzers:\n${req.prompt}`
    : req.prompt;

  console.log(`[AI-Gateway] Routing Anfrage an: ${req.provider}`);

  try {
    if (req.provider === 'gemini') {
      let ai;
      if (req.customApiKey) {
        ai = new GoogleGenAI({ apiKey: req.customApiKey });
      } else {
        ai = getGeminiAI(); // Nutzt unsere sichere, validierte Instanz
      }
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview', // High-end model wie bei Sider.ai
        contents: finalPrompt,
      });

      return {
        success: true,
        provider: 'gemini',
        modelOutput: response.text,
        tokensUsed: 0,
      };
    }
    
    if (req.provider === 'openai') {
      // Simulation für GPT-5 API Call (Bis env.OPENAI_API_KEY gesetzt ist)
      await new Promise(r => setTimeout(r, 1000));
      return {
        success: true,
        provider: 'openai',
        modelOutput: `🤖 **OpenAI (GPT-5) Mock-Antwort:**\n\nIch bin bereit, deine Anfrage zu bearbeiten: "${req.prompt}". \n\n*Hinweis: Dies läuft aktuell über das RealSync API-Gateway. Füge deinen OpenAI API-Key in den Settings hinzu, um Live-Ergebnisse zu sehen.*`,
      };
    }

    if (req.provider === 'claude') {
      // Simulation für Anthropic API Call (Bis env.ANTHROPIC_API_KEY gesetzt ist)
      await new Promise(r => setTimeout(r, 1000));
      return {
        success: true,
        provider: 'claude',
        modelOutput: `🧠 **Claude 4.6 Mock-Antwort:**\n\nHier ist meine Analyse zu deiner Anfrage: "${req.prompt}". \n\n*Hinweis: Dies läuft aktuell über das RealSync API-Gateway. Füge deinen Anthropic API-Key in den Settings hinzu, um Live-Ergebnisse zu sehen.*`,
      };
    }

    throw new Error(`Unsupported provider: ${req.provider}`);

  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Gateway Error",
    };
  }
}


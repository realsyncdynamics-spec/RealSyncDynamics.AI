import { describe, it, expect } from 'vitest';
import { detectAIDisclosure, __test } from '../../supabase/functions/_shared/ai-disclosure-check';

const { detectAIServiceAPIs, detectAIDisclosureText } = __test;

describe('AI Disclosure Detection', () => {
  describe('detectAIServiceAPIs', () => {
    it('detects OpenAI ChatGPT API usage', () => {
      const html = `<script src="https://api.openai.com/v1/chat/completions"></script>`;
      const result = detectAIServiceAPIs(html);
      expect(result).toContain('OpenAI (ChatGPT)');
    });

    it('detects Anthropic Claude API usage', () => {
      const html = `<script src="https://api.anthropic.com/messages"></script>`;
      const result = detectAIServiceAPIs(html);
      expect(result).toContain('Anthropic (Claude)');
    });

    it('detects Google Gemini API usage', () => {
      const html = `<script>const genAI = new GoogleGenerativeAI(key);</script>`;
      const result = detectAIServiceAPIs(html);
      expect(result).toContain('Google (Gemini)');
    });

    it('detects GPT model references', () => {
      const html = `<script>const model = "gpt-4"; const response = createChatCompletion({model});</script>`;
      const result = detectAIServiceAPIs(html);
      expect(result).toContain('OpenAI (ChatGPT)');
    });

    it('handles multiple AI services', () => {
      const html = `
        <script src="https://api.openai.com/chat"></script>
        <script src="https://api.anthropic.com/messages"></script>
      `;
      const result = detectAIServiceAPIs(html);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result).toContain('OpenAI (ChatGPT)');
      expect(result).toContain('Anthropic (Claude)');
    });

    it('returns empty array when no AI APIs detected', () => {
      const html = `<html><body><p>Normal website content</p></body></html>`;
      const result = detectAIServiceAPIs(html);
      expect(result).toEqual([]);
    });
  });

  describe('detectAIDisclosureText', () => {
    it('detects English "powered by AI" text', () => {
      const html = `<footer>Powered by artificial intelligence</footer>`;
      const result = detectAIDisclosureText(html);
      expect(result).toBe(true);
    });

    it('detects German "KI-generiert" text', () => {
      const html = `<p>Diese Inhalte sind KI-generiert.</p>`;
      const result = detectAIDisclosureText(html);
      expect(result).toBe(true);
    });

    it('detects "Chatbot" mention', () => {
      const html = `<p>Chat with our AI chatbot for support.</p>`;
      const result = detectAIDisclosureText(html);
      expect(result).toBe(true);
    });

    it('detects German "Künstliche Intelligenz" mention', () => {
      const html = `<p>Der Einsatz von künstlicher Intelligenz hilft uns...</p>`;
      const result = detectAIDisclosureText(html);
      expect(result).toBe(true);
    });

    it('returns false when no AI disclosure text', () => {
      const html = `<html><body><p>Normal website content</p></body></html>`;
      const result = detectAIDisclosureText(html);
      expect(result).toBe(false);
    });

    it('is case-insensitive', () => {
      const html = `<p>POWERED BY OPENAI</p>`;
      const result = detectAIDisclosureText(html);
      expect(result).toBe(true);
    });
  });

  describe('detectAIDisclosure (integrated)', () => {
    it('detects AI with no disclosure (high risk)', () => {
      const html = `
        <html>
          <head>
            <script src="https://api.openai.com/chat"></script>
          </head>
          <body><p>Normal website</p></body>
        </html>
      `;
      const result = detectAIDisclosure(html);
      expect(result.detected_ai_tools.length).toBeGreaterThan(0);
      expect(result.has_disclosure).toBe(false);
      expect(result.confidence).toBe('medium');
    });

    it('detects AI with disclosure (compliant)', () => {
      const html = `
        <html>
          <head>
            <script src="https://api.openai.com/chat"></script>
          </head>
          <body>
            <footer>Powered by OpenAI</footer>
          </body>
        </html>
      `;
      const result = detectAIDisclosure(html);
      expect(result.detected_ai_tools.length).toBeGreaterThan(0);
      expect(result.has_disclosure).toBe(true);
      expect(result.confidence).toEqual('high');
    });

    it('detects disclosure text without AI API (false positive edge case)', () => {
      const html = `<p>Powered by artificial intelligence</p>`;
      const result = detectAIDisclosure(html);
      // No AI APIs detected, but disclosure text exists
      // This is informational (medium confidence)
      expect(result.has_disclosure).toBe(true);
      expect(result.detected_ai_tools.length).toBe(0);
    });

    it('returns clean evidence array', () => {
      const html = `
        <script src="https://api.openai.com/chat"></script>
        <p>Powered by AI</p>
      `;
      const result = detectAIDisclosure(html);
      expect(result.evidence).toBeDefined();
      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0]).toContain('OpenAI');
    });

    it('handles empty HTML gracefully', () => {
      const result = detectAIDisclosure('');
      expect(result.detected_ai_tools).toEqual([]);
      expect(result.has_disclosure).toBe(false);
      expect(result.confidence).toBe('low');
    });

    it('handles malformed HTML', () => {
      const html = `<script src="https://api.openai.com/v1 onclick="alert(1)">`;
      const result = detectAIDisclosure(html);
      expect(result.detected_ai_tools).toContain('OpenAI (ChatGPT)');
    });
  });
});
